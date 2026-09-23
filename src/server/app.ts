import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import { createClient } from '@supabase/supabase-js';

// ==========================================
// SUPABASE ADMIN CLIENT (service_role — server-only, never sent to the browser)
// ==========================================
const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error(
    '[Server] SUPABASE_URL/VITE_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set for admin user-management endpoints to function. ' +
      'These are server-only secrets — never prefix SUPABASE_SERVICE_ROLE_KEY with VITE_.'
  );
}

const supabaseAdmin = SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY
  ? createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { autoRefreshToken: false, persistSession: false } })
  : null;

function log(level: 'info' | 'warn' | 'error', message: string, meta?: Record<string, unknown>) {
  const entry = { level, message, time: new Date().toISOString(), ...meta };
  console[level === 'info' ? 'log' : level](JSON.stringify(entry));
}

export const app = express();

// ==========================================
// SECURITY MIDDLEWARE
// ==========================================
app.use(helmet());
app.use(
  cors({
    origin: process.env.ALLOWED_ORIGIN ? process.env.ALLOWED_ORIGIN.split(',') : true,
    credentials: true,
  })
);
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true, limit: '2mb' }));

const adminLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api/admin', adminLimiter);

// ==========================================
// CALLER AUTHENTICATION / AUTHORIZATION HELPERS
// Every admin endpoint independently verifies the caller's Supabase JWT and
// re-checks their permission server-side — the browser's own claim of
// "I have this permission" is never trusted.
// ==========================================
interface CallerContext {
  userId: string;
  email: string;
  profile: Record<string, any>;
  role: Record<string, any> | null;
}

async function getCallerContext(req: express.Request): Promise<CallerContext | null> {
  if (!supabaseAdmin) return null;
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) return null;
  const token = authHeader.slice('Bearer '.length);

  const { data: userData, error: userError } = await supabaseAdmin.auth.getUser(token);
  if (userError || !userData.user) return null;

  const { data: profile } = await supabaseAdmin.from('profiles').select('*').eq('id', userData.user.id).maybeSingle();
  if (!profile || profile.status !== 'active') return null;

  const { data: role } = await supabaseAdmin.from('roles').select('*').eq('code', profile.role_code).maybeSingle();

  return { userId: userData.user.id, email: userData.user.email || profile.email, profile, role: role ?? null };
}

function callerHasPermission(caller: CallerContext, permissionCode: string): boolean {
  if (caller.role?.code === 'super_admin') return true;
  return Boolean(caller.role?.permissions?.includes(permissionCode));
}

function requireAdmin(permissionCode: string) {
  return async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (!supabaseAdmin) {
      return res.status(503).json({ success: false, error: 'Server is not configured with Supabase admin credentials.' });
    }
    const caller = await getCallerContext(req);
    if (!caller) {
      return res.status(401).json({ success: false, error: 'Unauthorized: invalid or missing session.' });
    }
    if (!callerHasPermission(caller, permissionCode)) {
      return res.status(403).json({ success: false, error: `Forbidden: missing required permission "${permissionCode}".` });
    }
    (req as any).caller = caller;
    next();
  };
}

// ==========================================
// API ROUTES
// ==========================================
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

const publicLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 20, standardHeaders: true, legacyHeaders: false });

// Relays a "new demo request" notification to the admin mailbox server-side,
// so the destination address is never present in the client bundle.
app.post('/api/demo-requests/notify-admin', publicLimiter, async (req, res) => {
  const ADMIN_NOTIFICATION_EMAIL = process.env.ADMIN_NOTIFICATION_EMAIL;
  if (!ADMIN_NOTIFICATION_EMAIL || !supabaseAdmin) {
    return res.status(202).json({ success: true }); // Non-critical; request is already persisted in Supabase.
  }
  try {
    const { requestId } = req.body || {};
    const { data: request } = await supabaseAdmin.from('demo_requests').select('*').eq('id', requestId).maybeSingle();
    if (!request) return res.status(202).json({ success: true });

    await fetch(`https://formsubmit.co/ajax/${encodeURIComponent(ADMIN_NOTIFICATION_EMAIL)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({
        _subject: `[Action Required] Demo Account Approval Request: ${request.full_name} - ${request.role_name}`,
        applicant_name: request.full_name,
        applicant_email: request.email,
        company_name: request.company_name,
        contact_phone: request.phone || 'Not provided',
        requested_role: request.role_name,
        request_reference: request.id,
        message: `A visitor has requested demo access.\n\nApplicant: ${request.full_name} (${request.email})\nCompany: ${request.company_name}\nRole Requested: ${request.role_name}\n\nReview and approve from the admin console.`,
      }),
    }).catch(() => {});

    return res.json({ success: true });
  } catch (err: any) {
    log('warn', 'Admin notification relay failed', { error: err?.message });
    return res.status(202).json({ success: true });
  }
});

// POST create a user with a real Supabase Auth account (service-role only operation)
app.post('/api/admin/users', requireAdmin('users.create'), async (req, res) => {
  const caller = (req as any).caller as CallerContext;
  try {
    const {
      email,
      password,
      fullName,
      username,
      mobile,
      roleCode,
      isAllProjects,
      assignedProjectIds,
      department,
      employeeId,
      status,
      remarks,
    } = req.body || {};

    if (!email || !password || !fullName || !roleCode) {
      return res.status(400).json({ success: false, error: 'email, password, fullName and roleCode are required.' });
    }
    if (String(password).length < 8) {
      return res.status(400).json({ success: false, error: 'Password must be at least 8 characters.' });
    }
    if (roleCode === 'super_admin' && caller.role?.code !== 'super_admin') {
      return res.status(403).json({ success: false, error: 'Only a Super Administrator can create another Super Administrator.' });
    }

    const { data: created, error: createError } = await supabaseAdmin!.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: fullName, role_code: roleCode },
    });
    if (createError || !created.user) {
      return res.status(409).json({ success: false, error: createError?.message || 'Failed to create auth user.' });
    }

    const newUserId = created.user.id;
    const { error: profileError } = await supabaseAdmin!
      .from('profiles')
      .update({
        username: username || null,
        mobile: mobile || null,
        role_code: roleCode,
        department: department || null,
        employee_id: employeeId || null,
        is_all_projects: Boolean(isAllProjects),
        remarks: remarks || null,
        status: status || 'active',
      })
      .eq('id', newUserId);
    if (profileError) {
      log('error', 'Failed to finalize profile after auth user creation', { error: profileError.message });
    }

    if (!isAllProjects && Array.isArray(assignedProjectIds) && assignedProjectIds.length) {
      await supabaseAdmin!
        .from('user_project_assignments')
        .insert(assignedProjectIds.map((pid: string) => ({ user_id: newUserId, project_id: pid })));
    }

    const { data: finalProfile } = await supabaseAdmin!.from('profiles').select('*').eq('id', newUserId).maybeSingle();

    log('info', 'Admin created user', { actor: caller.email, target: email });
    return res.status(201).json({ success: true, user: finalProfile });
  } catch (err: any) {
    log('error', 'Admin create user failed', { error: err?.message });
    return res.status(500).json({ success: false, error: 'Internal server error.' });
  }
});

// POST set another user's password (service-role only operation; super_admin only)
app.post('/api/admin/users/:id/set-password', requireAdmin('users.edit'), async (req, res) => {
  const caller = (req as any).caller as CallerContext;
  if (caller.role?.code !== 'super_admin') {
    return res.status(403).json({ success: false, error: 'Only a Super Administrator can reset another user’s password.' });
  }
  try {
    const { id } = req.params;
    const { password } = req.body || {};
    if (!password || String(password).length < 8) {
      return res.status(400).json({ success: false, error: 'Password must be at least 8 characters.' });
    }
    const { error } = await supabaseAdmin!.auth.admin.updateUserById(id, { password });
    if (error) return res.status(400).json({ success: false, error: error.message });

    await supabaseAdmin!.from('profiles').update({ force_password_reset: false }).eq('id', id);
    log('info', 'Admin reset user password', { actor: caller.email, target: id });
    return res.json({ success: true });
  } catch (err: any) {
    log('error', 'Admin set-password failed', { error: err?.message });
    return res.status(500).json({ success: false, error: 'Internal server error.' });
  }
});

// POST approve a demo request: provisions/links a real Supabase Auth account
// and returns a one-time sign-in link. No password is ever generated or stored.
app.post('/api/admin/demo-requests/:id/approve', requireAdmin('users.create'), async (req, res) => {
  const caller = (req as any).caller as CallerContext;
  try {
    const { id } = req.params;
    const { data: request } = await supabaseAdmin!.from('demo_requests').select('*').eq('id', id).maybeSingle();
    if (!request) return res.status(404).json({ success: false, error: 'Demo request not found.' });

    const email = String(request.email).trim().toLowerCase();
    const roleCode = request.role_code || 'viewer';

    let actionLink: string | null = null;
    let targetUserId: string | null = null;

    const invite = await supabaseAdmin!.auth.admin.generateLink({
      type: 'invite',
      email,
      options: { data: { full_name: request.full_name, role_code: roleCode } },
    });

    if (invite.error && /already.*registered/i.test(invite.error.message)) {
      const magic = await supabaseAdmin!.auth.admin.generateLink({ type: 'magiclink', email });
      if (magic.error) return res.status(400).json({ success: false, error: magic.error.message });
      actionLink = magic.data.properties?.action_link ?? null;
      targetUserId = magic.data.user?.id ?? null;
    } else if (invite.error) {
      return res.status(400).json({ success: false, error: invite.error.message });
    } else {
      actionLink = invite.data.properties?.action_link ?? null;
      targetUserId = invite.data.user?.id ?? null;
    }

    if (targetUserId) {
      await supabaseAdmin!
        .from('profiles')
        .update({
          role_code: roleCode,
          is_demo: true,
          status: 'active',
          department: request.company_name ? `${request.company_name} (Demo)` : 'Demo Evaluation Sandbox',
          remarks: `Authorized demo user for ${request.company_name || 'Corporate Evaluation'}`,
        })
        .eq('id', targetUserId);
    }

    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    await supabaseAdmin!
      .from('demo_requests')
      .update({
        status: 'approved',
        approved_at: new Date().toISOString(),
        one_time_secure_link: actionLink
          ? { link: actionLink, createdAt: new Date().toISOString(), expiresAt, used: false, dispatchedToEmail: email, dispatchedAt: new Date().toISOString() }
          : null,
      })
      .eq('id', id);

    log('info', 'Admin approved demo request', { actor: caller.email, target: email });
    return res.json({ success: true, link: actionLink });
  } catch (err: any) {
    log('error', 'Demo request approval failed', { error: err?.message });
    return res.status(500).json({ success: false, error: 'Internal server error.' });
  }
});

export default app;
