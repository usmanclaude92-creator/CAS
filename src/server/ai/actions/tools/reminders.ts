import type { ActionToolDefinition } from '../types.js';
import { asRecord, requireString } from '../../validation.js';

interface CreateReminderArgs {
  title: string;
  message: string;
}

/**
 * The LOW-risk reference action tool (Phase 5 directive §5's own example:
 * "create a note/task"). Always self-scoped — creates a personal
 * notification for the CALLING user only, never a broadcast (user_id: null)
 * and never targeting another user, even though the notifications table's
 * own insert RLS (`is_active_user()`) would technically permit either. No
 * confirmation required: the blast radius of a wrong reminder is "the user
 * sees an unwanted notification they can dismiss," not a data change.
 * Reuses the EXISTING notifications table/UI (src/services/notificationService.ts,
 * src/components/HeaderNotifications.tsx) rather than inventing a parallel
 * "AI tasks" system.
 */
export const createReminderTool: ActionToolDefinition<CreateReminderArgs, { id: string; title: string }> = {
  name: 'create_reminder',
  description: 'Creates a personal reminder/notification for the current user, visible in their notification bell. Never sent to any other user.',
  requiredPermission: 'ai_actions.use',
  category: 'notification',
  riskLevel: 'low',
  transactional: true,
  requiresConfirmation: false,

  validateArgs(raw) {
    const r = asRecord(raw);
    const title = requireString(r.title, 'title', 150);
    if (title.ok === false) return title;
    const message = requireString(r.message, 'message', 1000);
    if (message.ok === false) return message;
    return { ok: true, args: { title: title.value, message: message.value } };
  },

  async buildPreview(_ctx, args) {
    return {
      ok: true,
      summary: `Create a personal reminder: "${args.title}"`,
      entityType: 'notification',
      fields: [
        { label: 'Title', value: args.title },
        { label: 'Message', value: args.message },
        { label: 'Visible to', value: 'You only' },
      ],
      irreversible: false,
    };
  },

  async handler(ctx, args) {
    const { data, error } = await ctx.db
      .from('notifications')
      .insert({
        user_id: ctx.caller.userId,
        title: `AI Reminder: ${args.title}`,
        message: args.message,
        type: 'system_update',
        severity: 'info',
      })
      .select('id, title')
      .single();

    if (error || !data) {
      return { status: 'execution_failed', error: 'Failed to create the reminder.' };
    }
    return { status: 'executed', data: { id: data.id, title: data.title }, affectedResource: { table: 'notifications', id: data.id } };
  },
};
