-- Fix notifications_update_own: broadcast notifications (user_id is null,
-- see notificationService.ts's addNotification) could never actually be
-- marked read. The policy only allowed updating rows where
-- user_id = auth.uid(), but every notification is inserted with
-- user_id = null, so that predicate never matched any row. markAsRead /
-- markAllAsRead's UPDATE therefore silently affected zero rows every time
-- (Postgres/PostgREST does not error on an RLS-filtered update matching
-- nothing) — the UI showed the item as read optimistically, but the
-- database was never actually updated, so it reverted to unread on the
-- next reload or realtime resync. Align the UPDATE policy with the
-- existing notifications_select policy, which already treats user_id is
-- null as visible/actionable by any authenticated user.

alter policy "notifications_update_own" on notifications
  using (user_id = auth.uid() or user_id is null)
  with check (user_id = auth.uid() or user_id is null);
