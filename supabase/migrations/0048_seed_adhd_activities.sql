-- 0048 part 1 of 2 — ADHD activities (ADH-01 to ADH-08)

-- ADH-01  Stay With the Task  (3-5, cam_face)
insert into activities (
  id, name, framework_source, developmental_domain, diagnostic_profile_applicability,
  skill_level, target_age_min_months, target_age_max_months, duration_minutes,
  materials_required, prompting_hierarchy, mastery_criteria, therapist_steps,
  parent_explanation, validation_status, source_version,
  goal_one_line, measuring_now, what_this_is, why_we_do_it, why_this_works,
  what_good_looks_like, what_we_measure_how, how_this_helps, what_we_dont_measure,
  clinical_reference, mastery_behaviour, mastery_frequency_num,
  mastery_frequency_denom, mastery_sessions, measurement_bucket_id
) values (
  'ADH-01', 'Stay With the Task', 'BARKLEY_ADHD'::framework_source, 'attention_executive'::activity_domain, '{adhd}'::diagnostic_profile[],
  'emerging'::skill_level, 36, 71, 10,
  '["A simple sorting or threading task"]'::jsonb, '["independent","gestural_cue","verbal_cue","hand_over_hand"]'::jsonb, 'The child stays with the task until it is finished, without needing reminders. This happens in at least 8 out of 10 tries in a session. It happens in 3 sessions in a row.', '["Set up one simple task at the table, near the camera.","Sit with the child and start together.","Give quiet encouragement, not constant talk.","Stop while they are still doing well, not after they lose interest."]'::jsonb,
  '{"english":"We give your child one simple task and help them stay with it a little longer each time. Staying focused is built up slowly, in short successful bursts.","hindi":""}'::jsonb, 'validated'::validation_status, 'v1-anant-approved',
  'Goal: help the child stay with one task a little longer.', 'how long the child stays focused', 'A short, achievable tabletop task done at the camera, with the aim of extending how long the child stays with it.', 'Staying with a task is hard for children with ADHD. Building it up slowly, in short successful bursts, works better than long sessions.', 'Sustained attention improves with graded practice — starting short and extending gradually. Ending on success keeps the child willing to try again.',
  'Early on the child may leave after a minute. It is going well when they stay longer, need fewer reminders, and finish the task.', 'The camera records how long the child stays facing and engaged with the task, and their longest unbroken stretch of focus.', 'On-task time is very hard to judge by eye. Having it timed means you can see real improvement instead of guessing.', 'Facing the task is not the same as thinking about it. The camera measures where the child is looking, not whether they are engaged. You confirm that.',
  'Sustained attention. Framework: Barkley. Signal: stays_activity (duration, longest episode).', 'The child stays with the task until it is finished, without needing reminders.', 8, 10, 3, 'cam_face'
) on conflict (id) do nothing;
-- ADH-02  Find It  (6-8, cam_face)
insert into activities (
  id, name, framework_source, developmental_domain, diagnostic_profile_applicability,
  skill_level, target_age_min_months, target_age_max_months, duration_minutes,
  materials_required, prompting_hierarchy, mastery_criteria, therapist_steps,
  parent_explanation, validation_status, source_version,
  goal_one_line, measuring_now, what_this_is, why_we_do_it, why_this_works,
  what_good_looks_like, what_we_measure_how, how_this_helps, what_we_dont_measure,
  clinical_reference, mastery_behaviour, mastery_frequency_num,
  mastery_frequency_denom, mastery_sessions, measurement_bucket_id
) values (
  'ADH-02', 'Find It', 'BARKLEY_ADHD'::framework_source, 'attention_executive'::activity_domain, '{adhd}'::diagnostic_profile[],
  'established'::skill_level, 72, 107, 10,
  '["A busy picture or a find-the-object book"]'::jsonb, '["independent","gestural_cue","verbal_cue","hand_over_hand"]'::jsonb, 'The child finds the named target without giving up or being redirected. This happens in at least 8 out of 10 tries in a session. It happens in 3 sessions in a row.', '["Show a busy picture with lots going on.","Name one thing to find.","Let them search without hurrying them.","Celebrate when they find it, then pick another."]'::jsonb,
  '{"english":"We play find-the-object in busy pictures. Filtering out distractions to focus on one thing is a core skill for children with ADHD.","hindi":""}'::jsonb, 'validated'::validation_status, 'v1-anant-approved',
  'Goal: help the child focus on one thing among many.', 'how long the child stays focused', 'A searching game where the child has to pick out one target from a lot of distracting detail.', 'Filtering out distractions is a core difficulty in ADHD. This gives focused practice at ignoring everything except the target.', 'Selective attention improves with practice at ignoring competing information. Search tasks are a clear, motivating way to train it.',
  'Early on the child may get distracted by other parts of the picture. It is going well when they find the target faster and stay with the search.', 'The camera records how long the child stays focused on the picture and their longest stretch of unbroken attention.', 'Shows whether the child can hold focus during a demanding visual task, timed rather than estimated.', 'The camera measures focus on the task, not whether they found the right thing. You score that.',
  'Selective attention. Framework: Barkley. Signal: stays_activity (duration).', 'The child finds the named target without giving up or being redirected.', 8, 10, 3, 'cam_face'
) on conflict (id) do nothing;
-- ADH-03  Build It All the Way  (6-8, cam_face)
insert into activities (
  id, name, framework_source, developmental_domain, diagnostic_profile_applicability,
  skill_level, target_age_min_months, target_age_max_months, duration_minutes,
  materials_required, prompting_hierarchy, mastery_criteria, therapist_steps,
  parent_explanation, validation_status, source_version,
  goal_one_line, measuring_now, what_this_is, why_we_do_it, why_this_works,
  what_good_looks_like, what_we_measure_how, how_this_helps, what_we_dont_measure,
  clinical_reference, mastery_behaviour, mastery_frequency_num,
  mastery_frequency_denom, mastery_sessions, measurement_bucket_id
) values (
  'ADH-03', 'Build It All the Way', 'BARKLEY_ADHD'::framework_source, 'attention_executive'::activity_domain, '{adhd}'::diagnostic_profile[],
  'established'::skill_level, 72, 107, 15,
  '["Building blocks or a construction set"]'::jsonb, '["independent","gestural_cue","verbal_cue","hand_over_hand"]'::jsonb, 'The child finishes the build without abandoning it partway. This happens in at least 8 out of 10 tries in a session. It happens in 3 sessions in a row.', '["Agree what you are building before you start.","Build together at the table, near the camera.","Redirect gently if they drift, without taking over.","Finish it — do not stop halfway."]'::jsonb,
  '{"english":"We build something with a clear ending and see it through. Starting is easy — finishing is the hard part, and it is worth practising.","hindi":""}'::jsonb, 'validated'::validation_status, 'v1-anant-approved',
  'Goal: help the child finish something they started.', 'how long the child stays with the build', 'A building task with a defined end point, so the child practises seeing something through to completion.', 'Starting things is easy; finishing them is the hard part in ADHD. Practising completion builds persistence.', 'Having a clear, visible end point helps children persist. Completing the task is the reward that reinforces sticking with it.',
  'Early on the child may abandon it partway. It is going well when they stay to the end, and need fewer redirections.', 'The camera records how long the child stayed engaged and counts their hand movements during the build.', 'Combines focus time with hand activity, showing both how long they stayed and how much they actually did.', 'The camera measures time and hand movement. It cannot tell productive building from fidgeting — you judge that.',
  'Sustained attention / task persistence. Framework: Barkley. Signal: stays_activity (duration), grasps_objects (count).', 'The child finishes the build without abandoning it partway.', 8, 10, 3, 'cam_face'
) on conflict (id) do nothing;
-- ADH-04  Stop and Go  (3-5, therapist_scored)
insert into activities (
  id, name, framework_source, developmental_domain, diagnostic_profile_applicability,
  skill_level, target_age_min_months, target_age_max_months, duration_minutes,
  materials_required, prompting_hierarchy, mastery_criteria, therapist_steps,
  parent_explanation, validation_status, source_version,
  goal_one_line, measuring_now, what_this_is, why_we_do_it, why_this_works,
  what_good_looks_like, what_we_measure_how, how_this_helps, what_we_dont_measure,
  clinical_reference, mastery_behaviour, mastery_frequency_num,
  mastery_frequency_denom, mastery_sessions, measurement_bucket_id
) values (
  'ADH-04', 'Stop and Go', 'BARKLEY_ADHD'::framework_source, 'self_regulation'::activity_domain, '{adhd}'::diagnostic_profile[],
  'emerging'::skill_level, 36, 71, 10,
  '[]'::jsonb, '["independent","gestural_cue","verbal_cue","hand_over_hand"]'::jsonb, 'The child freezes when you say stop, without needing a reminder. This happens in at least 8 out of 10 tries in a session. It happens in 3 sessions in a row.', '["Child moves or plays when you say ''go''.","Say ''stop'' and they must freeze.","After each round, tap: stopped correctly, or did not.","Speed it up as they get better."]'::jsonb,
  '{"english":"We play stop-and-go games. Stopping an action once it has started is one of the hardest things for children with ADHD, and it improves with practice.","hindi":""}'::jsonb, 'validated'::validation_status, 'v1-anant-approved',
  'Goal: help the child stop when told to.', 'you tap each round · we record the score and time', 'A simple movement game where the child acts on ''go'' and must freeze on ''stop''.', 'Stopping an action once it has started is one of the hardest things for children with ADHD. This is direct, playful practice.', 'Response inhibition improves with repeated practice under clear rules and immediate feedback. Making it a game keeps the child engaged.',
  'Early on the child will often keep going after ''stop''. It is going well when they stop more reliably, and can still stop as the pace speeds up.', 'You score each round by tapping. The platform records your scores, the count of successful stops, and how long the activity ran.', 'Your taps build an objective record over time, scored the same way every session, with no paperwork afterwards.', 'The camera does NOT see whether the child stopped or kept moving. A fixed camera cannot measure this. You score it — the platform records what you tap. This changes when we add sensor hardware.',
  'Response inhibition. Framework: Barkley. Recorded: therapist-scored trials, correct-stop count, activity duration.', 'The child freezes when you say stop, without needing a reminder.', 8, 10, 3, 'therapist_scored'
) on conflict (id) do nothing;
-- ADH-05  Simon Says  (6-8, therapist_scored)
insert into activities (
  id, name, framework_source, developmental_domain, diagnostic_profile_applicability,
  skill_level, target_age_min_months, target_age_max_months, duration_minutes,
  materials_required, prompting_hierarchy, mastery_criteria, therapist_steps,
  parent_explanation, validation_status, source_version,
  goal_one_line, measuring_now, what_this_is, why_we_do_it, why_this_works,
  what_good_looks_like, what_we_measure_how, how_this_helps, what_we_dont_measure,
  clinical_reference, mastery_behaviour, mastery_frequency_num,
  mastery_frequency_denom, mastery_sessions, measurement_bucket_id
) values (
  'ADH-05', 'Simon Says', 'BARKLEY_ADHD'::framework_source, 'self_regulation'::activity_domain, '{adhd}'::diagnostic_profile[],
  'established'::skill_level, 72, 107, 10,
  '[]'::jsonb, '["independent","gestural_cue","verbal_cue","hand_over_hand"]'::jsonb, 'The child stays still when you do NOT say ''Simon says''. This happens in at least 8 out of 10 tries in a session. It happens in 3 sessions in a row.', '["Give an action. The child does it ONLY if you said ''Simon says'' first.","If you did not say it, the child should stay still.","After each round, tap: did it right, stopped right, or made a mistake.","Keep it quick and fun. Speed up as they get better."]'::jsonb,
  '{"english":"We play Simon Says. It combines careful listening with stopping yourself — two things that are hard together for children with ADHD.","hindi":""}'::jsonb, 'validated'::validation_status, 'v1-anant-approved',
  'Goal: help the child stop and think before acting.', 'you tap each round · we record the score and time', 'The classic game. The child does the action only when you say ''Simon says'' first, and must hold still when you do not.', 'This combines listening carefully with stopping yourself — two things that are hard together for children with ADHD.', 'Games with clear rules and instant feedback give children a safe, motivating way to practise holding back an action.',
  'At first the child will often move when they should have stayed still. It is going well when they make fewer mistakes and you see them pause before acting.', 'You score each round by tapping. The platform records your scores, correct stops, mistakes, and how long the activity took.', 'Round-by-round scoring builds a real record over time, scored consistently, with no paperwork.', 'The camera does NOT see whether the child moved or stayed still. You score it — the platform records what you tap and times the activity. This changes when we add sensor hardware.',
  'Response inhibition / selective attention. Framework: Barkley. Recorded: therapist-scored trials, correct-inhibit count, error count, duration.', 'The child stays still when you do NOT say ''Simon says''.', 8, 10, 3, 'therapist_scored'
) on conflict (id) do nothing;
-- ADH-06  Red Light Green Light  (6-8, therapist_scored)
insert into activities (
  id, name, framework_source, developmental_domain, diagnostic_profile_applicability,
  skill_level, target_age_min_months, target_age_max_months, duration_minutes,
  materials_required, prompting_hierarchy, mastery_criteria, therapist_steps,
  parent_explanation, validation_status, source_version,
  goal_one_line, measuring_now, what_this_is, why_we_do_it, why_this_works,
  what_good_looks_like, what_we_measure_how, how_this_helps, what_we_dont_measure,
  clinical_reference, mastery_behaviour, mastery_frequency_num,
  mastery_frequency_denom, mastery_sessions, measurement_bucket_id
) values (
  'ADH-06', 'Red Light Green Light', 'BARKLEY_ADHD'::framework_source, 'self_regulation'::activity_domain, '{adhd}'::diagnostic_profile[],
  'established'::skill_level, 72, 107, 10,
  '[]'::jsonb, '["independent","gestural_cue","verbal_cue","hand_over_hand"]'::jsonb, 'The child stops on red without overshooting, even when the timing varies. This happens in at least 8 out of 10 tries in a session. It happens in 3 sessions in a row.', '["Green light: the child moves towards you.","Red light: they must stop immediately.","After each light, tap whether they stopped correctly.","Vary the timing so it stays unpredictable."]'::jsonb,
  '{"english":"We play red light, green light with unpredictable timing. Stopping when you cannot predict it takes real self-control.","hindi":""}'::jsonb, 'validated'::validation_status, 'v1-anant-approved',
  'Goal: help the child control movement on command.', 'you tap each round · we record the score and time', 'A movement game where the child moves on green and must stop on red, with unpredictable timing.', 'Unpredictable stopping is harder than predictable stopping — it forces genuine self-control rather than anticipation.', 'Varying the interval prevents the child from anticipating the stop, so they have to actually inhibit rather than time it.',
  'Early on the child may overshoot or stop late. It is going well when they stop promptly even when the timing is unpredictable.', 'You score each round by tapping. The platform records your scores and the activity duration.', 'Consistent scoring across sessions makes progress on self-control visible rather than remembered.', 'The camera does NOT see the child''s movement — they are away from the laptop. You score each round; the platform records it. This changes when we add sensor hardware.',
  'Response inhibition. Framework: Barkley. Recorded: therapist-scored trials, correct-stop count, duration.', 'The child stops on red without overshooting, even when the timing varies.', 8, 10, 3, 'therapist_scored'
) on conflict (id) do nothing;
-- ADH-07  Freeze Dance  (3-5, therapist_scored)
insert into activities (
  id, name, framework_source, developmental_domain, diagnostic_profile_applicability,
  skill_level, target_age_min_months, target_age_max_months, duration_minutes,
  materials_required, prompting_hierarchy, mastery_criteria, therapist_steps,
  parent_explanation, validation_status, source_version,
  goal_one_line, measuring_now, what_this_is, why_we_do_it, why_this_works,
  what_good_looks_like, what_we_measure_how, how_this_helps, what_we_dont_measure,
  clinical_reference, mastery_behaviour, mastery_frequency_num,
  mastery_frequency_denom, mastery_sessions, measurement_bucket_id
) values (
  'ADH-07', 'Freeze Dance', 'BARKLEY_ADHD'::framework_source, 'self_regulation'::activity_domain, '{adhd}'::diagnostic_profile[],
  'emerging'::skill_level, 36, 71, 10,
  '["Music"]'::jsonb, '["independent","gestural_cue","verbal_cue","hand_over_hand"]'::jsonb, 'The child freezes when the music stops and holds still until it restarts. This happens in at least 8 out of 10 tries in a session. It happens in 3 sessions in a row.', '["Play music and let the child dance freely.","Stop the music suddenly.","They must freeze until it starts again.","Tap whether they froze correctly each time."]'::jsonb,
  '{"english":"We dance and freeze when the music stops. Music makes practising self-control fun, and the sudden stop is a very clear signal.","hindi":""}'::jsonb, 'validated'::validation_status, 'v1-anant-approved',
  'Goal: help the child stop moving when the music stops.', 'you tap each round · we record the score and time', 'Dancing to music that stops without warning, requiring the child to freeze instantly.', 'Music makes the practice fun, and the sudden stop gives a very clear signal. It suits younger children who find sitting still hard.', 'Movement-based inhibition games work well for young children because they are enjoyable and the rule is obvious.',
  'Early on the child may keep dancing for several seconds. It is going well when they freeze quickly and hold it until the music returns.', 'You score each freeze by tapping. The platform records your scores and the activity duration, and picks up any sounds the child makes.', 'Gives a fun activity a real record, so progress on impulse control is tracked rather than just felt.', 'The camera does NOT see whether the child froze — they are moving around the room. You score it. The platform records your taps and any audible sounds. This changes when we add sensor hardware.',
  'Response inhibition / regulation. Framework: Barkley. Recorded: therapist-scored trials, correct-freeze count, duration.', 'The child freezes when the music stops and holds still until it restarts.', 8, 10, 3, 'therapist_scored'
) on conflict (id) do nothing;
-- ADH-08  Two Things in Order  (6-8, therapist_scored)
insert into activities (
  id, name, framework_source, developmental_domain, diagnostic_profile_applicability,
  skill_level, target_age_min_months, target_age_max_months, duration_minutes,
  materials_required, prompting_hierarchy, mastery_criteria, therapist_steps,
  parent_explanation, validation_status, source_version,
  goal_one_line, measuring_now, what_this_is, why_we_do_it, why_this_works,
  what_good_looks_like, what_we_measure_how, how_this_helps, what_we_dont_measure,
  clinical_reference, mastery_behaviour, mastery_frequency_num,
  mastery_frequency_denom, mastery_sessions, measurement_bucket_id
) values (
  'ADH-08', 'Two Things in Order', 'BARKLEY_ADHD'::framework_source, 'attention_executive'::activity_domain, '{adhd}'::diagnostic_profile[],
  'established'::skill_level, 72, 107, 10,
  '["Everyday objects"]'::jsonb, '["independent","gestural_cue","verbal_cue","hand_over_hand"]'::jsonb, 'The child does both steps in the right order after hearing the instruction once. This happens in at least 8 out of 10 tries in a session. It happens in 3 sessions in a row.', '["Give two instructions together — ''put the block in the box, then clap''.","Say it once, clearly.","Wait and watch what they do.","Tap: both steps in order, partly right, or needed help."]'::jsonb,
  '{"english":"We give two instructions at once and see if your child can hold both in mind. This is working memory, and it matters at home and school every day.","hindi":""}'::jsonb, 'validated'::validation_status, 'v1-anant-approved',
  'Goal: help the child hold two instructions in mind.', 'you score each try · we record the time', 'Two-part instructions given in one go, so the child has to hold both in mind and do them in order.', 'Holding instructions in mind while acting is working memory, and it is commonly weak in ADHD. It matters at home and at school every day.', 'Multi-step instructions load working memory directly. Practising with a small, fixed number of steps builds capacity gradually.',
  'Early on the child may do only the first step, or reverse the order. It is going well when both steps are done in order, without repeating the instruction.', 'You score each try by tapping. The platform records your scores, the prompt level needed, and the activity duration.', 'Consistent prompt-level scoring shows whether the child is becoming more independent, session by session.', 'The camera does NOT check whether the instruction was followed. You score completion and prompt level; the platform records it.',
  'Working memory / instruction following. Framework: Barkley. Recorded: therapist-scored trials, prompt level, duration.', 'The child does both steps in the right order after hearing the instruction once.', 8, 10, 3, 'therapist_scored'
) on conflict (id) do nothing;
-- 0048 part 2 of 2 — ADHD activities (ADH-09 to ADH-15) + signal mappings

-- ADH-09  Three Things in Order  (9-12, therapist_scored)
insert into activities (
  id, name, framework_source, developmental_domain, diagnostic_profile_applicability,
  skill_level, target_age_min_months, target_age_max_months, duration_minutes,
  materials_required, prompting_hierarchy, mastery_criteria, therapist_steps,
  parent_explanation, validation_status, source_version,
  goal_one_line, measuring_now, what_this_is, why_we_do_it, why_this_works,
  what_good_looks_like, what_we_measure_how, how_this_helps, what_we_dont_measure,
  clinical_reference, mastery_behaviour, mastery_frequency_num,
  mastery_frequency_denom, mastery_sessions, measurement_bucket_id
) values (
  'ADH-09', 'Three Things in Order', 'BARKLEY_ADHD'::framework_source, 'attention_executive'::activity_domain, '{adhd}'::diagnostic_profile[],
  'mastery'::skill_level, 108, 155, 10,
  '["Everyday objects"]'::jsonb, '["independent","gestural_cue","verbal_cue","hand_over_hand"]'::jsonb, 'The child does all three steps in the right order after hearing them once. This happens in at least 8 out of 10 tries in a session. It happens in 3 sessions in a row.', '["Give three instructions in one go.","Say it once, at a normal pace.","Do not repeat unless they ask.","Tap: all three in order, partly right, or needed help."]'::jsonb,
  '{"english":"We give three instructions at once. Three steps is close to what school and home actually demand of your child every day.","hindi":""}'::jsonb, 'validated'::validation_status, 'v1-anant-approved',
  'Goal: help the child hold three instructions in mind.', 'you score each try · we record the time', 'Three-part instructions given once, requiring the child to hold and sequence all three.', 'Three steps is close to what school and home actually demand. It is a realistic test of whether working memory is holding up.', 'Increasing the number of steps gradually extends working memory capacity. Three steps is a meaningful real-world target.',
  'Early on the child may manage the first and last but lose the middle. It is going well when all three are done in the right order after one telling.', 'You score each try by tapping. The platform records your scores, prompt level, and duration.', 'Tracks whether the child can handle real-world instruction loads, with consistent scoring.', 'The camera does NOT verify the instructions were followed. You score it; the platform records it.',
  'Working memory. Framework: Barkley. Recorded: therapist-scored trials, prompt level, duration.', 'The child does all three steps in the right order after hearing them once.', 8, 10, 3, 'therapist_scored'
) on conflict (id) do nothing;
-- ADH-10  Remember Where It Is  (6-8, therapist_scored)
insert into activities (
  id, name, framework_source, developmental_domain, diagnostic_profile_applicability,
  skill_level, target_age_min_months, target_age_max_months, duration_minutes,
  materials_required, prompting_hierarchy, mastery_criteria, therapist_steps,
  parent_explanation, validation_status, source_version,
  goal_one_line, measuring_now, what_this_is, why_we_do_it, why_this_works,
  what_good_looks_like, what_we_measure_how, how_this_helps, what_we_dont_measure,
  clinical_reference, mastery_behaviour, mastery_frequency_num,
  mastery_frequency_denom, mastery_sessions, measurement_bucket_id
) values (
  'ADH-10', 'Remember Where It Is', 'BARKLEY_ADHD'::framework_source, 'attention_executive'::activity_domain, '{adhd}'::diagnostic_profile[],
  'established'::skill_level, 72, 107, 10,
  '["Small objects and cups or containers"]'::jsonb, '["independent","gestural_cue","verbal_cue","hand_over_hand"]'::jsonb, 'The child finds the object first time after a delay with distraction. This happens in at least 8 out of 10 tries in a session. It happens in 3 sessions in a row.', '["Hide an object under one of three cups while they watch.","Wait a few seconds, chatting to distract them.","Ask them to find it.","Tap whether they found it first time."]'::jsonb,
  '{"english":"We hide an object and distract your child briefly before asking them to find it. Holding something in mind while other things happen is the skill that fails in daily life.","hindi":""}'::jsonb, 'validated'::validation_status, 'v1-anant-approved',
  'Goal: help the child hold information in mind briefly.', 'you score each try · we record the time', 'A hiding game where the child must remember a location across a short delay filled with distraction.', 'Holding something in mind while other things are happening is exactly the skill that fails in daily life — forgetting what you were about to do.', 'Adding a filled delay makes the task genuinely test working memory rather than just immediate recall.',
  'Early on the child may guess or forget after the delay. It is going well when they find it first time, and can handle longer delays.', 'You score each try by tapping. The platform records your scores and the activity duration.', 'Gives a clean record of memory performance across sessions, scored the same way each time.', 'The camera does NOT track which cup the child chose. You score it; the platform records your scores.',
  'Working memory. Framework: Barkley. Recorded: therapist-scored trials, correct count, duration.', 'The child finds the object first time after a delay with distraction.', 8, 10, 3, 'therapist_scored'
) on conflict (id) do nothing;
-- ADH-11  Finish the Pattern  (6-8, cam_face)
insert into activities (
  id, name, framework_source, developmental_domain, diagnostic_profile_applicability,
  skill_level, target_age_min_months, target_age_max_months, duration_minutes,
  materials_required, prompting_hierarchy, mastery_criteria, therapist_steps,
  parent_explanation, validation_status, source_version,
  goal_one_line, measuring_now, what_this_is, why_we_do_it, why_this_works,
  what_good_looks_like, what_we_measure_how, how_this_helps, what_we_dont_measure,
  clinical_reference, mastery_behaviour, mastery_frequency_num,
  mastery_frequency_denom, mastery_sessions, measurement_bucket_id
) values (
  'ADH-11', 'Finish the Pattern', 'BARKLEY_ADHD'::framework_source, 'attention_executive'::activity_domain, '{adhd}'::diagnostic_profile[],
  'established'::skill_level, 72, 107, 10,
  '["Coloured blocks, beads, or pattern cards"]'::jsonb, '["independent","gestural_cue","verbal_cue","hand_over_hand"]'::jsonb, 'The child works out the correct next item without guessing. This happens in at least 8 out of 10 tries in a session. It happens in 3 sessions in a row.', '["Lay out a simple repeating pattern at the table.","Ask what comes next.","Give them time to work it out.","Build up to longer, harder patterns."]'::jsonb,
  '{"english":"We work out repeating patterns together. Solving a pattern needs real concentration — you cannot do it while distracted.","hindi":""}'::jsonb, 'validated'::validation_status, 'v1-anant-approved',
  'Goal: help the child concentrate on working out what comes next.', 'how long the child stays focused', 'Pattern completion at the table, requiring focused attention and reasoning about a sequence.', 'Working out a pattern needs sustained concentration — you cannot do it while distracted. It trains focus and thinking together.', 'Pattern tasks require holding a rule in mind while scanning, combining attention and reasoning. Difficulty can be graded easily.',
  'Early on the child may guess without looking properly. It is going well when they study the pattern before answering, and manage longer sequences.', 'The camera records how long the child stays focused on the table task and their longest unbroken stretch of attention.', 'Timed focus during a thinking task shows whether concentration is improving under real cognitive demand.', 'The camera measures focus, not correctness. Whether they got the pattern right is your judgement.',
  'Attention and sequencing. Framework: Barkley. Signal: stays_activity (duration). Accuracy is therapist-scored.', 'The child works out the correct next item without guessing.', 8, 10, 3, 'cam_face'
) on conflict (id) do nothing;
-- ADH-12  Waiting for Your Turn  (3-5, therapist_scored)
insert into activities (
  id, name, framework_source, developmental_domain, diagnostic_profile_applicability,
  skill_level, target_age_min_months, target_age_max_months, duration_minutes,
  materials_required, prompting_hierarchy, mastery_criteria, therapist_steps,
  parent_explanation, validation_status, source_version,
  goal_one_line, measuring_now, what_this_is, why_we_do_it, why_this_works,
  what_good_looks_like, what_we_measure_how, how_this_helps, what_we_dont_measure,
  clinical_reference, mastery_behaviour, mastery_frequency_num,
  mastery_frequency_denom, mastery_sessions, measurement_bucket_id
) values (
  'ADH-12', 'Waiting for Your Turn', 'BARKLEY_ADHD'::framework_source, 'self_regulation'::activity_domain, '{adhd}'::diagnostic_profile[],
  'emerging'::skill_level, 36, 71, 10,
  '["A turn-taking game or shared toy"]'::jsonb, '["independent","gestural_cue","verbal_cue","hand_over_hand"]'::jsonb, 'The child waits for their turn without grabbing or being reminded. This happens in at least 8 out of 10 tries in a session. It happens in 3 sessions in a row.', '["Play a simple turn-taking game.","Make the child wait a few seconds for their turn.","Tap whether they waited or grabbed.","Slowly make the waits a little longer."]'::jsonb,
  '{"english":"We practise waiting for turns, starting short and building up. Waiting is one of the hardest things for children with ADHD, and it causes real trouble at school.","hindi":""}'::jsonb, 'validated'::validation_status, 'v1-anant-approved',
  'Goal: help the child wait without grabbing.', 'you score each wait · we record the time', 'A turn-taking game with deliberate short waits, gradually extended as the child manages them.', 'Waiting is one of the hardest things for children with ADHD, and it causes real trouble at school and with other children.', 'Waiting tolerance builds through graded practice — starting with waits short enough to succeed, then extending.',
  'Early on the child may grab immediately. It is going well when they can wait several seconds calmly, and the waits can get longer.', 'You score each wait by tapping. The platform records your scores and the activity duration.', 'Tracks whether waiting tolerance is genuinely extending, with a consistent record across sessions.', 'The camera does NOT detect grabbing or waiting. You score each one; the platform records it.',
  'Impulse control / waiting. Framework: Barkley. Recorded: therapist-scored trials, successful waits, duration.', 'The child waits for their turn without grabbing or being reminded.', 8, 10, 3, 'therapist_scored'
) on conflict (id) do nothing;
-- ADH-13  Sort It Fast  (9-12, cam_hands)
insert into activities (
  id, name, framework_source, developmental_domain, diagnostic_profile_applicability,
  skill_level, target_age_min_months, target_age_max_months, duration_minutes,
  materials_required, prompting_hierarchy, mastery_criteria, therapist_steps,
  parent_explanation, validation_status, source_version,
  goal_one_line, measuring_now, what_this_is, why_we_do_it, why_this_works,
  what_good_looks_like, what_we_measure_how, how_this_helps, what_we_dont_measure,
  clinical_reference, mastery_behaviour, mastery_frequency_num,
  mastery_frequency_denom, mastery_sessions, measurement_bucket_id
) values (
  'ADH-13', 'Sort It Fast', 'BARKLEY_ADHD'::framework_source, 'attention_executive'::activity_domain, '{adhd}'::diagnostic_profile[],
  'established'::skill_level, 108, 155, 10,
  '["Objects to sort by colour, shape, or size"]'::jsonb, '["independent","gestural_cue","verbal_cue","hand_over_hand"]'::jsonb, 'The child sorts everything correctly within the time, without rushing into errors. This happens in at least 8 out of 10 tries in a session. It happens in 3 sessions in a row.', '["Set out objects to sort into groups, at the table.","Give a gentle time challenge — ''before the timer''.","Let them work without hurrying them verbally.","Check accuracy together at the end."]'::jsonb,
  '{"english":"We sort objects with a gentle time challenge. Working quickly without becoming careless is a real difficulty worth practising.","hindi":""}'::jsonb, 'validated'::validation_status, 'v1-anant-approved',
  'Goal: help the child work accurately when there is time pressure.', 'the child''s hand movements and focus', 'A sorting task with a light time challenge, done at the table so hands are visible.', 'Working quickly without becoming careless is a real difficulty in ADHD. This practises speed and accuracy together.', 'Adding mild time pressure to a structured task trains the balance between going fast and staying accurate.',
  'Early on the child may rush and make errors, or slow right down. It is going well when speed and accuracy improve together.', 'The camera counts the child''s hand movements and grasping actions, and records how long they stayed focused.', 'Hand activity plus focus time shows how much work was actually done, alongside your accuracy check.', 'The camera counts hand movements. It cannot tell whether items were sorted correctly — you check accuracy.',
  'Sustained attention with speed. Framework: Barkley. Signal: grasps_objects (count), stays_activity (duration). Accuracy is therapist-scored.', 'The child sorts everything correctly within the time, without rushing into errors.', 8, 10, 3, 'cam_hands'
) on conflict (id) do nothing;
-- ADH-14  Change the Rule  (9-12, therapist_scored)
insert into activities (
  id, name, framework_source, developmental_domain, diagnostic_profile_applicability,
  skill_level, target_age_min_months, target_age_max_months, duration_minutes,
  materials_required, prompting_hierarchy, mastery_criteria, therapist_steps,
  parent_explanation, validation_status, source_version,
  goal_one_line, measuring_now, what_this_is, why_we_do_it, why_this_works,
  what_good_looks_like, what_we_measure_how, how_this_helps, what_we_dont_measure,
  clinical_reference, mastery_behaviour, mastery_frequency_num,
  mastery_frequency_denom, mastery_sessions, measurement_bucket_id
) values (
  'ADH-14', 'Change the Rule', 'BARKLEY_ADHD'::framework_source, 'attention_executive'::activity_domain, '{adhd}'::diagnostic_profile[],
  'mastery'::skill_level, 108, 155, 10,
  '["Cards that can be sorted by more than one rule"]'::jsonb, '["independent","gestural_cue","verbal_cue","hand_over_hand"]'::jsonb, 'The child switches to the new rule within one card of the change. This happens in at least 8 out of 10 tries in a session. It happens in 3 sessions in a row.', '["Sort cards by one rule — say, colour.","After a few, change the rule to shape.","Watch whether they switch or keep going the old way.","Tap: switched correctly, or stuck to the old rule."]'::jsonb,
  '{"english":"We sort cards, then change the rule partway. Getting stuck on the old way is common in ADHD, and switching flexibly is needed constantly at school.","hindi":""}'::jsonb, 'validated'::validation_status, 'v1-anant-approved',
  'Goal: help the child switch when the rule changes.', 'you score each switch · we record the time', 'A card-sorting game where the rule changes partway, requiring the child to drop the old rule and adopt the new one.', 'Getting stuck on the old way of doing something is common in ADHD. Switching flexibly is needed constantly at school.', 'Rule-switching tasks are a standard measure and training method for cognitive flexibility. The difficulty is in letting go of the previous rule.',
  'Early on the child may keep sorting the old way after the change. It is going well when they switch quickly, with fewer errors after each change.', 'You score each switch by tapping. The platform records your scores, the error count, and the duration.', 'Error counts after each switch give a clear picture of whether flexibility is improving.', 'The camera does NOT check which rule the child used. You score each switch; the platform records it.',
  'Cognitive flexibility / set shifting. Framework: Barkley. Recorded: therapist-scored trials, switch errors, duration.', 'The child switches to the new rule within one card of the change.', 8, 10, 3, 'therapist_scored'
) on conflict (id) do nothing;
-- ADH-15  Getting Started  (9-12, therapist_scored)
insert into activities (
  id, name, framework_source, developmental_domain, diagnostic_profile_applicability,
  skill_level, target_age_min_months, target_age_max_months, duration_minutes,
  materials_required, prompting_hierarchy, mastery_criteria, therapist_steps,
  parent_explanation, validation_status, source_version,
  goal_one_line, measuring_now, what_this_is, why_we_do_it, why_this_works,
  what_good_looks_like, what_we_measure_how, how_this_helps, what_we_dont_measure,
  clinical_reference, mastery_behaviour, mastery_frequency_num,
  mastery_frequency_denom, mastery_sessions, measurement_bucket_id
) values (
  'ADH-15', 'Getting Started', 'BARKLEY_ADHD'::framework_source, 'attention_executive'::activity_domain, '{adhd}'::diagnostic_profile[],
  'mastery'::skill_level, 108, 155, 10,
  '["A task the child can do but may avoid"]'::jsonb, '["independent","gestural_cue","verbal_cue","hand_over_hand"]'::jsonb, 'The child starts the task on their own, without a second reminder. This happens in at least 8 out of 10 tries in a session. It happens in 3 sessions in a row.', '["Set out a task and explain it once.","Say ''you can start when you are ready'', then stop talking.","Wait. Do not prompt again.","Tap whether they started on their own."]'::jsonb,
  '{"english":"We set up a task and then wait, without pushing. Many children can do a task but cannot get themselves started — starting is its own skill.","hindi":""}'::jsonb, 'validated'::validation_status, 'v1-anant-approved',
  'Goal: help the child begin a task without being pushed.', 'you score each try · we record how long they took to start', 'A task is set up and explained, then you deliberately stop prompting and wait to see if the child begins on their own.', 'Many children with ADHD can do a task but cannot get themselves started. Starting is its own separate skill.', 'Task initiation is distinct from ability. Removing repeated adult prompting is what reveals and builds independent starting.',
  'Early on the child may wait indefinitely or need several reminders. It is going well when they start sooner, with fewer prompts.', 'You score each try by tapping. The platform records your scores and how long the activity took, including the delay before starting.', 'Time-to-start is a concrete number that shows whether independence is genuinely improving.', 'The camera does NOT detect when the child started. You score it; the platform records your taps and the timing.',
  'Task initiation / executive function. Framework: Barkley. Recorded: therapist-scored trials, initiation latency, duration.', 'The child starts the task on their own, without a second reminder.', 8, 10, 3, 'therapist_scored'
) on conflict (id) do nothing;

-- adhd signal mappings
insert into activity_signals (activity_id, attribute_id, is_primary) values
  ('ADH-01', 'stays_activity', true),
  ('ADH-02', 'stays_activity', true),
  ('ADH-03', 'stays_activity', true),
  ('ADH-03', 'grasps_objects', false),
  ('ADH-04', 'follows_instruction', true),
  ('ADH-05', 'follows_instruction', true),
  ('ADH-06', 'follows_instruction', true),
  ('ADH-07', 'follows_instruction', true),
  ('ADH-08', 'follows_instruction', true),
  ('ADH-09', 'follows_instruction', true),
  ('ADH-10', 'follows_instruction', true),
  ('ADH-11', 'stays_activity', true),
  ('ADH-12', 'follows_instruction', true),
  ('ADH-13', 'grasps_objects', true),
  ('ADH-13', 'stays_activity', false),
  ('ADH-14', 'follows_instruction', true),
  ('ADH-15', 'follows_instruction', true)
on conflict (activity_id, attribute_id) do nothing;
