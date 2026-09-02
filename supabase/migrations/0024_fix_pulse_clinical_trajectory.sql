-- Fix v_pulse_clinical trajectory to use ESDM-style 'responded' instead of
-- legacy 'correct'. The trial_response enum was renamed in 0020 but this view
-- was never updated, so trajectory_indicator was always 'steady'.

drop view if exists v_pulse_clinical;

create view v_pulse_clinical as
select
  ch.id as child_id,
  ch.center_id,
  ch.full_name,
  (select count(*) from goals g where g.child_id = ch.id and g.status = 'active')
    as active_goal_count,
  (select count(*) from sessions s where s.child_id = ch.id and s.status = 'completed')
    as sessions_completed,
  (select max(s.scheduled_date) from sessions s where s.child_id = ch.id and s.status = 'completed')
    as last_session_date,
  (select case
    when recent.rate is null or prior.rate is null then 'steady'
    when recent.rate > prior.rate + 5 then 'improving'
    when recent.rate < prior.rate - 5 then 'needs_attention'
    else 'steady'
  end
  from (
    select avg(sub.success_rate) as rate from (
      select s.id,
        coalesce(
          count(*) filter (where t.response in ('responded','partial'))::numeric
          / nullif(count(t.id), 0)::numeric * 100, 0
        ) as success_rate
      from sessions s
      join session_activities sa on sa.session_id = s.id
      left join trials t on t.session_activity_id = sa.id
      where s.child_id = ch.id and s.status = 'completed'
      group by s.id
      order by s.scheduled_date desc
      limit 5
    ) sub
  ) recent,
  (
    select avg(sub.success_rate) as rate from (
      select s.id,
        coalesce(
          count(*) filter (where t.response in ('responded','partial'))::numeric
          / nullif(count(t.id), 0)::numeric * 100, 0
        ) as success_rate
      from sessions s
      join session_activities sa on sa.session_id = s.id
      left join trials t on t.session_activity_id = sa.id
      where s.child_id = ch.id and s.status = 'completed'
      group by s.id
      order by s.scheduled_date desc
      limit 5 offset 5
    ) sub
  ) prior)
    as trajectory
from children ch
where ch.deleted_at is null;
