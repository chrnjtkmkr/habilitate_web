-- Pulse view: operational metrics per center
create or replace view v_pulse_operational as
select
  c.id as center_id,
  c.name as center_name,
  (select count(*) from children ch where ch.center_id = c.id and ch.deleted_at is null)
    as active_children,
  (select count(*) from sessions s
   where s.center_id = c.id
     and s.scheduled_date >= current_date - interval '7 days'
     and s.status = 'completed')
    as sessions_this_week,
  -- attendance rate over last 30 days
  (select case
    when count(*) = 0 then 0
    else round(
      count(*) filter (where s.status = 'completed')::numeric
      / count(*)::numeric * 100, 1)
    end
   from sessions s
   where s.center_id = c.id
     and s.scheduled_date >= current_date - interval '30 days')
    as attendance_rate_30d,
  -- children with no session in 14 days (retention alerts)
  (select count(*) from children ch
   where ch.center_id = c.id
     and ch.deleted_at is null
     and not exists (
       select 1 from sessions s
       where s.child_id = ch.id
         and s.scheduled_date >= current_date - interval '14 days'
     ))
    as retention_alerts_14d
from centers c;

-- Pulse view: clinical metrics per child
create or replace view v_pulse_clinical as
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
  -- trajectory: compare success rate of last 5 sessions vs prior 5
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
          count(*) filter (where t.response = 'correct')::numeric
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
          count(*) filter (where t.response = 'correct')::numeric
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

-- Pulse view: parent engagement per center
create or replace view v_pulse_parent_engagement as
select
  c.id as center_id,
  c.name as center_name,
  (select count(*) from parent_reports pr
   where pr.center_id = c.id
     and pr.status = 'sent'
     and pr.sent_at >= now() - interval '30 days')
    as reports_sent_30d,
  (select count(*) from parent_reports pr
   where pr.center_id = c.id
     and pr.status = 'sent'
     and pr.sent_at >= now() - interval '30 days'
     and pr.whatsapp_status = 'read')
    as reports_opened_30d,
  -- parents with no report sent in 30 days
  (select count(distinct p.id) from parents p
   join children ch on ch.id = p.child_id
   where ch.center_id = c.id
     and ch.deleted_at is null
     and p.deleted_at is null
     and p.is_primary_contact = true
     and not exists (
       select 1 from parent_reports pr
       where pr.child_id = ch.id
         and pr.status = 'sent'
         and pr.sent_at >= now() - interval '30 days'
     ))
    as parents_silent_30d
from centers c;
