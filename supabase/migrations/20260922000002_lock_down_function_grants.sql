-- Helper/authorization functions must only be reachable through RLS policy
-- evaluation (which runs as the table owner regardless of caller grants),
-- never called directly via the exposed PostgREST /rpc/ endpoint.
revoke all on function current_role_code() from public, anon, authenticated;
revoke all on function has_permission(text) from public, anon, authenticated;
revoke all on function can_access_project(uuid) from public, anon, authenticated;
revoke all on function is_active_user() from public, anon, authenticated;
revoke all on function handle_new_auth_user() from public, anon, authenticated;

grant execute on function current_role_code() to authenticated;
grant execute on function has_permission(text) to authenticated;
grant execute on function can_access_project(uuid) to authenticated;
grant execute on function is_active_user() to authenticated;
-- handle_new_auth_user is trigger-only; no direct caller needs it.
