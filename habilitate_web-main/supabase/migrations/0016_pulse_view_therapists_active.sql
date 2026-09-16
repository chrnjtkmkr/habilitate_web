-- 0016_pulse_view_therapists_active.sql
-- Part 2: Extend v_pulse_operational with therapists_active.
-- Uses 'no_show' enum value added in 0015 (must be a separate transaction).
-- Must DROP + CREATE (not CREATE OR REPLACE) because we're adding a column.

drop view if exists v_pulse_operational;

create view v_pulse_operational as
select
  c.id   as center_id,
  c.name as center_name,
  (
    select count(*)
    from children ch
    where ch.center_id = c.id
      and ch.deleted_at is null
  ) as active_children,
  (
    select count(*)
    from sessions s
    where s.center_id = c.id
      and s.scheduled_date >= date_trunc('week', current_date)::date
      and s.scheduled_date < (date_trunc('week', current_date) + interval '7 days')::date
  ) as sessions_this_week,
  (
    select
      case when count(*) = 0 then null
           else round(100.0 * sum(case when s.status in ('completed','in_progress') then 1 else 0 end) / count(*), 1)
      end
    from sessions s
    where s.center_id = c.id
      and s.scheduled_date >= current_date - 30
      and s.status in ('completed','in_progress','no_show','cancelled')
  ) as attendance_rate_30d,
  (
    select count(*)
    from children ch
    where ch.center_id = c.id
      and ch.deleted_at is null
      and not exists (
        select 1 from sessions s
        where s.child_id = ch.id
          and s.status in ('completed','in_progress')
          and s.scheduled_date >= current_date - 14
      )
  ) as retention_alerts_14d,
  (
    select count(*)
    from memberships m
    where m.center_id = c.id
      and m.is_active = true
  ) as therapists_active
from centers c
where c.is_active = true;
