-- Add display-only columns needed by the notifications UI (project name badge,
-- actor attribution) so the client can render them without an extra join.
alter table notifications add column if not exists project_name varchar(255);
alter table notifications add column if not exists actor_name varchar(255);
