import express from 'express';
import path from 'path';
import fs from 'fs';
import { createServer as createViteServer } from 'vite';

const app = express();
const PORT = 3000;

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Server-side persistent storage paths
const DATA_DIR = path.join(process.cwd(), 'data');
const USERS_FILE = path.join(DATA_DIR, 'users.json');
const DEMO_REQUESTS_FILE = path.join(DATA_DIR, 'demo_requests.json');

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

// Initial pre-seeded users
const SEED_USERS = [
  {
    id: 'usr-real-superadmin-artify',
    email: 'admin@artifysols.com',
    username: 'artify.admin',
    fullName: 'Super Administrator',
    mobile: '+968 9000 0001',
    roleId: 'role-super-admin',
    roleCode: 'super_admin',
    roleName: 'Super Administrator',
    status: 'active',
    department: 'Executive Board',
    employeeId: 'ARTIFY-001',
    assignedProjectIds: [],
    isAllProjects: true,
    remarks: 'Primary Real Production Super Administrator for Artify Solutions. Full enterprise governance and isolated blank production database.',
    isDemo: false,
    lastLogin: '2026-09-17T11:00:00Z',
    createdAt: '2026-01-01T00:00:00Z',
  },
  {
    id: 'usr-super-admin',
    email: 'superadmin@construction.om',
    username: 'superadmin',
    fullName: 'Eng. Tariq Al Busaidi',
    mobile: '+968 9911 2233',
    roleId: 'role-super-admin',
    roleCode: 'super_admin',
    roleName: 'Super Administrator',
    status: 'active',
    department: 'Executive Board',
    employeeId: 'EMP-001',
    assignedProjectIds: [],
    isAllProjects: true,
    remarks: 'Chief Executive & System Super Administrator with unrestricted governance',
    isDemo: true,
    lastLogin: '2026-09-14T08:00:00Z',
    createdAt: '2026-01-01T00:00:00Z',
  },
  {
    id: 'usr-accounts-manager',
    email: 'accounts.mgr@construction.om',
    username: 'accounts.mgr',
    fullName: 'Muna Al Rahbi',
    mobile: '+968 9822 3344',
    roleId: 'role-accounts-manager',
    roleCode: 'accounts_manager',
    roleName: 'Accounts Manager',
    status: 'active',
    department: 'Accounting & Finance',
    employeeId: 'EMP-002',
    assignedProjectIds: [],
    isAllProjects: true,
    remarks: 'Head of Accounting Operations; manages workflows, approvals, and day-to-day accounts',
    isDemo: true,
    lastLogin: '2026-09-13T14:30:00Z',
    createdAt: '2026-01-05T00:00:00Z',
  },
  {
    id: 'usr-finance-manager',
    email: 'finance.mgr@construction.om',
    username: 'finance.mgr',
    fullName: 'Rashid Al Balushi',
    mobile: '+968 9733 4455',
    roleId: 'role-finance-manager',
    roleCode: 'finance_manager',
    roleName: 'Finance Manager',
    status: 'active',
    department: 'Financial Control',
    employeeId: 'EMP-003',
    assignedProjectIds: [],
    isAllProjects: true,
    remarks: 'Financial controller overseeing budgets, audits, and approvals up to OMR 10,000',
    isDemo: true,
    lastLogin: '2026-09-12T11:20:00Z',
    createdAt: '2026-01-10T00:00:00Z',
  },
  {
    id: 'usr-accountant',
    email: 'accountant@construction.om',
    username: 'fatima.acc',
    fullName: 'Fatima Al Lawati',
    mobile: '+968 9644 5566',
    roleId: 'role-accountant',
    roleCode: 'accountant',
    roleName: 'Accountant',
    status: 'active',
    department: 'Accounting',
    employeeId: 'EMP-004',
    assignedProjectIds: [],
    isAllProjects: true,
    remarks: 'Senior site & transaction accountant handling vouchers, IPCs, and bills',
    isDemo: true,
    lastLogin: '2026-09-14T07:15:00Z',
    createdAt: '2026-01-15T00:00:00Z',
  },
  {
    id: 'usr-project-accountant',
    email: 'project.acc@construction.om',
    username: 'said.site',
    fullName: 'Said Al Habsi',
    mobile: '+968 9555 6677',
    roleId: 'role-project-accountant',
    roleCode: 'project_accountant',
    roleName: 'Project Accountant',
    status: 'active',
    department: 'Site Operations',
    employeeId: 'EMP-005',
    assignedProjectIds: ['prj-akv-001'],
    isAllProjects: false,
    remarks: 'Assigned solely to PRJ-AKV-001 (Al Khoudh Villa Project). Cannot access Bausher Plaza.',
    isDemo: true,
    lastLogin: '2026-09-11T09:00:00Z',
    createdAt: '2026-02-01T00:00:00Z',
  },
  {
    id: 'usr-treasury',
    email: 'treasury@construction.om',
    username: 'zayed.cash',
    fullName: 'Zayed Al Hinai',
    mobile: '+968 9466 7788',
    roleId: 'role-treasury-user',
    roleCode: 'treasury_user',
    roleName: 'Treasury / Cashier User',
    status: 'active',
    department: 'Treasury',
    employeeId: 'EMP-006',
    assignedProjectIds: [],
    isAllProjects: true,
    remarks: 'Disburses cash, manages petty cash envelopes and commercial bank transfers',
    isDemo: true,
    lastLogin: '2026-09-10T16:45:00Z',
    createdAt: '2026-02-10T00:00:00Z',
  },
  {
    id: 'usr-viewer',
    email: 'viewer@construction.om',
    username: 'auditor.view',
    fullName: 'Auditor External Reviewer',
    mobile: '+968 9377 8899',
    roleId: 'role-viewer',
    roleCode: 'viewer',
    roleName: 'Viewer',
    status: 'active',
    department: 'External Audit',
    employeeId: 'AUD-001',
    assignedProjectIds: [],
    isAllProjects: true,
    remarks: 'Read-only compliance auditor with strictly no write, edit, reverse, or approve permissions',
    isDemo: true,
    lastLogin: '2026-09-08T10:00:00Z',
    createdAt: '2026-03-01T00:00:00Z',
  },
  {
    id: 'usr-inactive-user',
    email: 'inactive@construction.om',
    username: 'former.staff',
    fullName: 'Former Staff Member',
    mobile: '+968 9288 9900',
    roleId: 'role-accountant',
    roleCode: 'accountant',
    roleName: 'Accountant',
    status: 'inactive',
    department: 'Accounting',
    employeeId: 'EMP-999',
    assignedProjectIds: [],
    isAllProjects: true,
    remarks: 'Deactivated account for testing access blocking and inactive login prevention',
    isDemo: true,
    lastLogin: '2026-05-01T12:00:00Z',
    createdAt: '2026-01-01T00:00:00Z',
  },
];

// Helper functions for reading/writing users
function readUsers(): any[] {
  try {
    if (fs.existsSync(USERS_FILE)) {
      const data = fs.readFileSync(USERS_FILE, 'utf-8');
      const users = JSON.parse(data);
      if (Array.isArray(users) && users.length > 0) {
        return users;
      }
    }
  } catch (err) {
    console.error('[Server] Error reading users file:', err);
  }
  // Initialize with seed users
  writeUsers(SEED_USERS);
  return SEED_USERS;
}

function writeUsers(users: any[]): boolean {
  try {
    fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2), 'utf-8');
    return true;
  } catch (err) {
    console.error('[Server] Error writing users file:', err);
    return false;
  }
}

// Helper functions for reading/writing demo requests
function readDemoRequests(): any[] {
  try {
    if (fs.existsSync(DEMO_REQUESTS_FILE)) {
      const data = fs.readFileSync(DEMO_REQUESTS_FILE, 'utf-8');
      const requests = JSON.parse(data);
      if (Array.isArray(requests)) {
        return requests;
      }
    }
  } catch (err) {
    console.error('[Server] Error reading demo requests file:', err);
  }
  return [];
}

function writeDemoRequests(requests: any[]): boolean {
  try {
    fs.writeFileSync(DEMO_REQUESTS_FILE, JSON.stringify(requests, null, 2), 'utf-8');
    return true;
  } catch (err) {
    console.error('[Server] Error writing demo requests file:', err);
    return false;
  }
}

// Initialize seed data on startup
readUsers();

// ==========================================
// API ROUTES
// ==========================================

// Health Check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// GET all centralized users (accessible by any device)
app.get('/api/auth/users', (req, res) => {
  const users = readUsers();
  res.json({ success: true, users });
});

// POST create a new user (persisted centrally on server)
app.post('/api/auth/users', (req, res) => {
  try {
    const newUser = req.body;
    if (!newUser || !newUser.email || !newUser.fullName) {
      return res.status(400).json({ success: false, error: 'Missing required user fields (email, fullName).' });
    }

    const normalizedEmail = newUser.email.trim().toLowerCase();
    const users = readUsers();

    const existingIndex = users.findIndex((u: any) => u.email.toLowerCase() === normalizedEmail);
    if (existingIndex !== -1) {
      return res.status(409).json({ success: false, error: 'A user with this email address already exists.' });
    }

    if (newUser.username) {
      const cleanUsername = newUser.username.trim().toLowerCase();
      if (users.some((u: any) => u.username?.toLowerCase() === cleanUsername)) {
        return res.status(409).json({ success: false, error: `Username "${newUser.username}" is already assigned to another user.` });
      }
    }

    const createdUser = {
      ...newUser,
      id: newUser.id || `usr-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      email: normalizedEmail,
      createdAt: newUser.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    users.push(createdUser);
    writeUsers(users);

    console.log(`[Server] User created and synced centrally: ${createdUser.email} (${createdUser.fullName})`);
    return res.status(201).json({ success: true, user: createdUser });
  } catch (err: any) {
    console.error('[Server] Failed to create user:', err);
    return res.status(500).json({ success: false, error: err.message || 'Internal server error' });
  }
});

// PUT update an existing user
app.put('/api/auth/users/:id', (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;
    const users = readUsers();

    const index = users.findIndex((u: any) => u.id === id);
    if (index === -1) {
      return res.status(404).json({ success: false, error: 'User not found.' });
    }

    const existingUser = users[index];
    const updatedUser = {
      ...existingUser,
      ...updates,
      id: existingUser.id, // Immutable ID
      updatedAt: new Date().toISOString(),
    };

    users[index] = updatedUser;
    writeUsers(users);

    console.log(`[Server] User updated and synced centrally: ${updatedUser.email}`);
    return res.json({ success: true, user: updatedUser });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message || 'Internal server error' });
  }
});

// POST deactivate an existing user
app.post('/api/auth/users/:id/deactivate', (req, res) => {
  try {
    const { id } = req.params;
    const users = readUsers();

    const user = users.find((u: any) => u.id === id);
    if (!user) {
      return res.status(404).json({ success: false, error: 'User not found.' });
    }

    user.status = 'inactive';
    user.updatedAt = new Date().toISOString();
    writeUsers(users);

    return res.json({ success: true, user });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message || 'Internal server error' });
  }
});

// POST verify credentials / login
app.post('/api/auth/login', (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email) {
      return res.status(400).json({ success: false, error: 'Email or username is required.' });
    }

    const normalized = email.trim().toLowerCase();
    const users = readUsers();

    const user = users.find(
      (u: any) =>
        u.email.toLowerCase() === normalized ||
        (u.username && u.username.toLowerCase() === normalized)
    );

    if (!user) {
      return res.status(401).json({ success: false, error: 'Invalid credentials or user not registered in system.' });
    }

    if (user.status !== 'active') {
      return res.status(403).json({ success: false, error: `Account is ${user.status}. Access denied. Please contact your system administrator.` });
    }

    // If a custom password was saved, verify it
    if (user.password && password && user.password !== password) {
      return res.status(401).json({ success: false, error: 'Incorrect password.' });
    }

    user.lastLogin = new Date().toISOString();
    writeUsers(users);

    // Return user profile (exclude plaintext password)
    const { password: _, ...safeUser } = user;
    return res.json({ success: true, user: safeUser });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message || 'Internal server error' });
  }
});

// ==========================================
// DEMO REQUESTS CENTRALIZED API
// ==========================================

// GET all demo requests
app.get('/api/demo-requests', (req, res) => {
  const requests = readDemoRequests();
  res.json({ success: true, requests });
});

// POST create/submit a new demo request
app.post('/api/demo-requests', (req, res) => {
  try {
    const newRequest = req.body;
    if (!newRequest || !newRequest.email || !newRequest.fullName) {
      return res.status(400).json({ success: false, error: 'Missing required request fields.' });
    }

    const requests = readDemoRequests();
    // Prepend or update
    const existingIndex = requests.findIndex((r: any) => r.id === newRequest.id);
    if (existingIndex !== -1) {
      requests[existingIndex] = { ...requests[existingIndex], ...newRequest };
    } else {
      requests.unshift(newRequest);
    }

    writeDemoRequests(requests);
    return res.status(201).json({ success: true, request: newRequest });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message || 'Internal server error' });
  }
});

// POST approve a demo request and dispatch activation
app.post('/api/demo-requests/:id/approve', (req, res) => {
  try {
    const { id } = req.params;
    const { oneTimeSecureLink, roleCode, roleName } = req.body;
    const requests = readDemoRequests();

    const request = requests.find((r: any) => r.id === id);
    if (!request) {
      return res.status(404).json({ success: false, error: 'Demo request not found.' });
    }

    request.status = 'approved';
    request.approvedAt = new Date().toISOString();
    if (oneTimeSecureLink) {
      request.oneTimeSecureLink = oneTimeSecureLink;
    }

    writeDemoRequests(requests);

    // Ensure authorized demo user exists in centralized users list
    const users = readUsers();
    const normalizedEmail = request.email.trim().toLowerCase();
    let existingUser = users.find((u: any) => u.email.toLowerCase() === normalizedEmail);

    if (!existingUser) {
      const demoUser = {
        id: `usr-demo-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        email: normalizedEmail,
        username: normalizedEmail.split('@')[0],
        fullName: request.fullName,
        roleId: `role-${request.roleCode || 'accountant'}`,
        roleCode: request.roleCode || 'accountant',
        roleName: request.roleName || 'Accountant',
        status: 'active',
        department: 'Demo Evaluation Sandbox',
        employeeId: `DEMO-${Math.floor(100 + Math.random() * 900)}`,
        assignedProjectIds: [],
        isAllProjects: true,
        remarks: `Authorized demo user for ${request.companyName || 'Enterprise'}`,
        isDemo: true,
        createdAt: new Date().toISOString(),
        lastLogin: new Date().toISOString(),
      };
      users.push(demoUser);
      writeUsers(users);
    } else {
      existingUser.status = 'active';
      existingUser.roleCode = request.roleCode || existingUser.roleCode;
      existingUser.roleName = request.roleName || existingUser.roleName;
      existingUser.roleId = `role-${existingUser.roleCode}`;
      writeUsers(users);
    }

    return res.json({ success: true, request });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message || 'Internal server error' });
  }
});

// POST redeem one-time secure link token
app.post('/api/demo-requests/redeem', (req, res) => {
  try {
    const { token, requestId } = req.body;
    if (!token) {
      return res.status(400).json({ success: false, error: 'Token is required.' });
    }

    const requests = readDemoRequests();
    let request: any = null;

    if (requestId) {
      request = requests.find((r: any) => r.id === requestId);
    }
    if (!request) {
      request = requests.find((r: any) => r.oneTimeSecureLink?.token === token);
    }

    if (!request || !request.oneTimeSecureLink) {
      return res.status(404).json({ success: false, error: 'One-time access link is invalid or expired.' });
    }

    const link = request.oneTimeSecureLink;
    if (link.token !== token) {
      return res.status(401).json({ success: false, error: 'Invalid access token.' });
    }

    if (link.used) {
      return res.status(410).json({
        success: false,
        error: `This single-use access link has already been used on ${new Date(link.usedAt || Date.now()).toLocaleString()}. Single-use access links cannot be reused.`,
      });
    }

    const now = new Date();
    const expiresAt = new Date(link.expiresAt);
    if (now > expiresAt) {
      return res.status(410).json({ success: false, error: 'This demo access link has expired.' });
    }

    // Mark as used
    link.used = true;
    link.usedAt = now.toISOString();
    writeDemoRequests(requests);

    // Retrieve or activate user profile
    const users = readUsers();
    const normalizedEmail = request.email.trim().toLowerCase();
    let user = users.find((u: any) => u.email.toLowerCase() === normalizedEmail);

    if (!user) {
      user = {
        id: `usr-demo-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        email: normalizedEmail,
        username: normalizedEmail.split('@')[0],
        fullName: request.fullName,
        roleId: `role-${request.roleCode || 'accountant'}`,
        roleCode: request.roleCode || 'accountant',
        roleName: request.roleName || 'Accountant',
        status: 'active',
        department: 'Demo Evaluation Sandbox',
        employeeId: `DEMO-${Math.floor(100 + Math.random() * 900)}`,
        assignedProjectIds: [],
        isAllProjects: true,
        remarks: `Authorized demo user for ${request.companyName || 'Enterprise'}`,
        isDemo: true,
        createdAt: new Date().toISOString(),
        lastLogin: new Date().toISOString(),
      };
      users.push(user);
      writeUsers(users);
    } else {
      user.status = 'active';
      user.lastLogin = new Date().toISOString();
      writeUsers(users);
    }

    const { password: _, ...safeUser } = user;
    return res.json({ success: true, request, user: safeUser });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message || 'Internal server error' });
  }
});

// ==========================================
// VITE MIDDLEWARE (Development) & STATIC SERVING (Production)
// ==========================================
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[Server] Express + Vite backend listening on http://0.0.0.0:${PORT}`);
  });
}

startServer();
