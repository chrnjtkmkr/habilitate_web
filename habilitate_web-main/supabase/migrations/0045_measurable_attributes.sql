-- 0045_measurable_attributes.sql
-- Add attributes for signals the live CV+audio pipeline actually computes.
-- Each row maps to a specific field in the tracker code; the source is noted.
-- Uses on conflict (id) do nothing so this cannot disturb the existing 6 rows.

insert into attributes (id, parent_label, capture_method, scale_type, config, sort_order)
values
  -- AutoHandTracker.pointing_events (count, incremented on gesture transition to 'pointing')
  -- AutoHandTracker.pointing_direction ({horizontal, vertical} computed when gesture === 'pointing')
  ('points_at_things', 'Points at Things', 'system', 'count',
   '{}'::jsonb,
   10),

  -- AutoHandTracker.reaching_events (count, incremented when wrist moves upward > 0.08 normalized)
  ('reaches_for_things', 'Reaches for Things', 'system', 'count',
   '{}'::jsonb,
   11),

  -- AutoHandTracker.grasp_events (count, sum of pincer_grasp_events + power_grasp_events on grip transition)
  ('grasps_objects', 'Grasps Objects', 'system', 'count',
   '{}'::jsonb,
   12),

  -- AutoHandTracker.clap_events (count, two-hand palm distance: apart > 0.2 then close < 0.1, debounced 800ms)
  ('claps_hands', 'Claps Hands', 'system', 'count',
   '{"debounce_ms":800}'::jsonb,
   13),

  -- AutoHandTracker.wave_events (count, incremented on gesture transition to 'waving';
  -- waving detected via >= 3 wrist X direction changes in last 12 frames)
  ('waves', 'Waves', 'system', 'count',
   '{}'::jsonb,
   14),

  -- ChildVoiceTracker.total_child_sounds (count of completed child vocalization episodes;
  -- episode = child_voice > 200ms, ends after 500ms silence gap)
  ('makes_sounds', 'Makes Sounds', 'system', 'count',
   '{"min_episode_ms":200,"silence_gap_ms":500}'::jsonb,
   15),

  -- ChildVoiceTracker.spontaneous_sounds (count of child episodes NOT preceded by adult voice within 5s)
  ('asks_on_own', 'Asks on Their Own', 'system', 'count',
   '{"prompt_window_ms":5000}'::jsonb,
   16)

on conflict (id) do nothing;
