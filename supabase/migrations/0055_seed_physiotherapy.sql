-- 0055 part 1 of 2 — physiotherapy activities (PHY-01 to PHY-08)
-- Gross motor. Therapist-scored: a fixed camera cannot see the body.
-- Framework: ICF-CY (WHO functional classification) / general practice.

-- PHY-01  Sitting Without Support  (3-5, therapist_scored)
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
  'PHY-01', 'Sitting Without Support', 'ICF_CY'::framework_source, 'gross_motor'::activity_domain, '{global_developmental_delay}'::diagnostic_profile[],
  'emerging'::skill_level, 36, 71, 10,
  '["Floor mat","A favourite toy"]'::jsonb, '["independent","gestural_cue","verbal_cue","hand_over_hand"]'::jsonb, 'The child sits unsupported and reaches for a toy without losing balance. This happens in at least 8 out of 10 tries in a session. It happens in 3 sessions in a row.', '["Sit the child on a mat with legs comfortably apart.","Place a favourite toy just in front, within easy reach.","Stay close but let go — hands ready, not holding.","After each try, tap how long they held it and how much support was needed."]'::jsonb,
  '{"english":"We help your child sit steadily on their own. Sitting is the base for everything else — playing, using hands, and later standing.","hindi":""}'::jsonb, 'validated'::validation_status, 'v2-anant-approved',
  'Goal: help the child sit steadily on their own.', 'you score each try · we record the time', 'The child sits unsupported on the floor while reaching for something they want, with you close enough to steady them if needed.', 'Sitting steadily is the base for everything else — using hands, playing, later standing. A child who cannot hold sitting cannot free their hands to explore.', 'Trunk control builds with graded practice: short holds first, then longer, with support withdrawn a little at a time. Reaching for a wanted object gives a reason to hold the position.',
  'Early on the child may topple within a second or two, or need a hand at the back. It is going well when they hold longer, catch themselves when they wobble, and can reach without falling.', 'You score each attempt by tapping — how long they held and how much help they needed. The platform records your scores and the activity time.', 'Your scores build a record of how long sitting is held and how support is fading, session by session, without any paperwork.', 'The camera does NOT see the child''s body or posture. A fixed camera cannot measure sitting. You score it — the platform records what you tap and times the activity. This changes when we add sensor hardware.',
  'Gross motor / trunk control. Framework: ICF-CY. Recorded: therapist-scored trials, hold duration, support level, activity duration.', 'The child sits unsupported and reaches for a toy without losing balance.', 8, 10, 3, 'therapist_scored'
) on conflict (id) do nothing;
-- PHY-02  Crawling to a Target  (3-5, therapist_scored)
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
  'PHY-02', 'Crawling to a Target', 'ICF_CY'::framework_source, 'gross_motor'::activity_domain, '{global_developmental_delay}'::diagnostic_profile[],
  'emerging'::skill_level, 36, 71, 10,
  '["Floor mat","A favourite toy"]'::jsonb, '["independent","gestural_cue","verbal_cue","hand_over_hand"]'::jsonb, 'The child crawls the full set distance to reach the toy without help. This happens in at least 8 out of 10 tries in a session. It happens in 3 sessions in a row.', '["Place the child on hands and knees on the mat.","Put a favourite toy a short distance ahead.","Encourage them towards it without lifting them.","Tap how far they crawled and how much help they needed."]'::jsonb,
  '{"english":"We encourage your child to crawl towards a favourite toy. Crawling builds strength and teaches both sides of the body to work together.","hindi":""}'::jsonb, 'validated'::validation_status, 'v2-anant-approved',
  'Goal: help the child crawl towards something they want.', 'you score each try · we record the time', 'The child crawls a short distance to reach something they want, with the distance increased as they manage it.', 'Crawling builds arm and leg strength, and teaches the two sides of the body to work together. It comes before walking and supports it.', 'Motivation matters more than instruction here. A child crawls further towards something they want than towards a request. Distance is increased gradually as strength builds.',
  'Early on the child may move a few inches or drag rather than crawl. It is going well when they cover more distance, alternate arms and legs, and go without much prompting.', 'You score each attempt by tapping — roughly how far and how much help. The platform records your scores and the activity time.', 'A consistent record of distance and support level, so progress in strength and coordination is visible rather than remembered.', 'The camera does NOT see crawling — the child is on the floor, away from the laptop. You score it; the platform records what you tap. This changes when we add sensor hardware.',
  'Gross motor / locomotion. Framework: ICF-CY. Recorded: therapist-scored trials, distance, support level, duration.', 'The child crawls the full set distance to reach the toy without help.', 8, 10, 3, 'therapist_scored'
) on conflict (id) do nothing;
-- PHY-03  Pulling Up to Stand  (3-5, therapist_scored)
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
  'PHY-03', 'Pulling Up to Stand', 'ICF_CY'::framework_source, 'gross_motor'::activity_domain, '{global_developmental_delay}'::diagnostic_profile[],
  'emerging'::skill_level, 36, 71, 10,
  '["A low sturdy table or bench","A favourite toy"]'::jsonb, '["independent","gestural_cue","verbal_cue","hand_over_hand"]'::jsonb, 'The child pulls up to standing on their own and holds it briefly. This happens in at least 8 out of 10 tries in a session. It happens in 3 sessions in a row.', '["Sit the child near a low, steady surface.","Place a toy on top, in their sight.","Let them reach and pull — steady them, do not lift them.","Tap whether they pulled up on their own and how long they stood."]'::jsonb,
  '{"english":"We help your child pull themselves up to standing using a low table. This builds leg strength and teaches them to get upright on their own.","hindi":""}'::jsonb, 'validated'::validation_status, 'v2-anant-approved',
  'Goal: help the child pull themselves up to standing.', 'you score each try · we record the time', 'The child uses a low steady surface to pull themselves from sitting to standing, reaching for something placed on top.', 'Pulling to stand builds leg strength and teaches the child how to get upright by themselves — the step before cruising and walking.', 'Letting the child do the pulling, rather than lifting them, is what builds the strength. The toy gives the reason; the surface gives the support.',
  'Early on the child may need you to take most of their weight. It is going well when they pull up mostly on their own and stay standing longer before sitting down.', 'You score each attempt by tapping — pulled up independently or with help, and roughly how long they stood. The platform records your scores and the time.', 'Shows whether the child is getting themselves upright with less help over time, recorded consistently across sessions.', 'The camera does NOT see the child standing or how they moved. You score it; the platform records your taps. This changes when we add sensor hardware.',
  'Gross motor / transitions. Framework: ICF-CY. Recorded: therapist-scored trials, independence level, stand duration.', 'The child pulls up to standing on their own and holds it briefly.', 8, 10, 3, 'therapist_scored'
) on conflict (id) do nothing;
-- PHY-04  Cruising Along Furniture  (3-5, therapist_scored)
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
  'PHY-04', 'Cruising Along Furniture', 'ICF_CY'::framework_source, 'gross_motor'::activity_domain, '{global_developmental_delay}'::diagnostic_profile[],
  'emerging'::skill_level, 36, 71, 10,
  '["A low sturdy bench or sofa","Toys to place along it"]'::jsonb, '["independent","gestural_cue","verbal_cue","hand_over_hand"]'::jsonb, 'The child cruises the full length to reach the toy without lowering to the floor. This happens in at least 8 out of 10 tries in a session. It happens in 3 sessions in a row.', '["Stand the child holding a low steady surface.","Place a toy a little along it, out of reach.","Let them step sideways to get it.","Tap how many steps and how steady they were."]'::jsonb,
  '{"english":"We help your child step sideways along furniture while holding on. This is the bridge between standing and walking.","hindi":""}'::jsonb, 'validated'::validation_status, 'v2-anant-approved',
  'Goal: help the child take steps sideways while holding on.', 'you score each try · we record the time', 'The child moves sideways along a low surface, holding on, to reach a toy placed further along.', 'Cruising is the bridge between standing and walking. It teaches shifting weight from one leg to the other while the arms still help.', 'Weight shifting is the skill, and it develops through practice with support available. Placing the toy just beyond reach creates the need to step.',
  'Early on the child may take one small step or lower to the floor instead. It is going well when they take more steps, need less grip, and shift weight more smoothly.', 'You score each attempt by tapping — roughly how many steps and how steady. The platform records your scores and the time.', 'Step counts and steadiness ratings across sessions show whether weight shifting is improving, which is what walking depends on.', 'The camera does NOT see the child''s steps or balance — they are away from the laptop, moving sideways. You score it; the platform records your taps. This changes when we add sensor hardware.',
  'Gross motor / weight shift. Framework: ICF-CY. Recorded: therapist-scored trials, step count, steadiness, duration.', 'The child cruises the full length to reach the toy without lowering to the floor.', 8, 10, 3, 'therapist_scored'
) on conflict (id) do nothing;
-- PHY-05  Walking With Support  (3-5, therapist_scored)
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
  'PHY-05', 'Walking With Support', 'ICF_CY'::framework_source, 'gross_motor'::activity_domain, '{global_developmental_delay}'::diagnostic_profile[],
  'emerging'::skill_level, 36, 71, 10,
  '["A push toy or your hands"]'::jsonb, '["independent","gestural_cue","verbal_cue","hand_over_hand"]'::jsonb, 'The child walks the set distance with one hand held. This happens in at least 8 out of 10 tries in a session. It happens in 3 sessions in a row.', '["Stand the child holding your hands or a push toy.","Walk forward slowly at their pace.","Reduce your grip gradually — two hands, then one.","Tap how many steps and how much support was needed."]'::jsonb,
  '{"english":"We help your child walk while holding on, reducing the support bit by bit. This builds the strength and balance walking alone needs.","hindi":""}'::jsonb, 'validated'::validation_status, 'v2-anant-approved',
  'Goal: help the child take walking steps with support.', 'you score each try · we record the time', 'The child walks forward while holding your hands or pushing a stable toy, with support reduced as they steady.', 'Walking is the goal most families are waiting for. Practising with support builds the strength and balance that independent walking needs.', 'Support is faded in stages — two hands, one hand, fingertips, none. Each stage is practised until steady before the next is tried.',
  'Early on the child may need both your hands and take small stiff steps. It is going well when steps get longer and smoother, and one hand is enough.', 'You score each attempt by tapping — step count and support level. The platform records your scores and the time.', 'Tracks the fading of support session by session, which is the real measure of progress towards walking alone.', 'The camera does NOT see walking, steps, or balance. A fixed camera cannot measure this. You score it; the platform records your taps. This changes when we add sensor hardware.',
  'Gross motor / gait. Framework: ICF-CY. Recorded: therapist-scored trials, step count, support level, duration.', 'The child walks the set distance with one hand held.', 8, 10, 3, 'therapist_scored'
) on conflict (id) do nothing;
-- PHY-06  Standing on One Leg  (6-8, therapist_scored)
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
  'PHY-06', 'Standing on One Leg', 'ICF_CY'::framework_source, 'gross_motor'::activity_domain, '{global_developmental_delay}'::diagnostic_profile[],
  'established'::skill_level, 72, 107, 10,
  '[]'::jsonb, '["independent","gestural_cue","verbal_cue","hand_over_hand"]'::jsonb, 'The child holds one-leg balance for the target time on both legs. This happens in at least 8 out of 10 tries in a session. It happens in 3 sessions in a row.', '["Stand facing the child, close enough to steady them.","Ask them to lift one foot and hold.","Count aloud together — make it a game.","Tap how many seconds they held on each side."]'::jsonb,
  '{"english":"We practise standing on one leg. This balance is needed for stairs, kicking a ball, and steady walking.","hindi":""}'::jsonb, 'validated'::validation_status, 'v2-anant-approved',
  'Goal: help the child balance on one leg.', 'you score each try · we record the time', 'The child stands on one leg for as long as they can, with you close by, practising both sides.', 'Single-leg balance is needed for stairs, kicking, and steady walking. It also shows how well the child controls their body in space.', 'Balance improves through repeated short holds rather than long ones. Counting aloud turns it into a game and gives the child something to beat.',
  'Early on the child may hold for a second or need to touch something. It is going well when they hold longer, manage both legs, and need no hand nearby.', 'You score each attempt by tapping the seconds held, per side. The platform records your scores and the activity time.', 'Second-by-second records on each leg show improvement and reveal whether one side is weaker than the other.', 'The camera does NOT see the child standing or balancing. You score it; the platform records what you tap. This changes when we add sensor hardware.',
  'Gross motor / static balance. Framework: ICF-CY. Recorded: therapist-scored trials, hold duration per side.', 'The child holds one-leg balance for the target time on both legs.', 8, 10, 3, 'therapist_scored'
) on conflict (id) do nothing;
-- PHY-07  Walking the Line  (6-8, therapist_scored)
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
  'PHY-07', 'Walking the Line', 'ICF_CY'::framework_source, 'gross_motor'::activity_domain, '{global_developmental_delay}'::diagnostic_profile[],
  'established'::skill_level, 72, 107, 10,
  '["Tape or a rope on the floor"]'::jsonb, '["independent","gestural_cue","verbal_cue","hand_over_hand"]'::jsonb, 'The child walks the full line heel to toe with no more than one step off. This happens in at least 8 out of 10 tries in a session. It happens in 3 sessions in a row.', '["Lay a straight line of tape on the floor.","Ask the child to walk along it, heel to toe.","Walk beside them, ready to steady but not holding.","Tap how far they got and how many times they stepped off."]'::jsonb,
  '{"english":"We practise walking heel to toe along a line. This builds the balance needed to move safely in busy places.","hindi":""}'::jsonb, 'validated'::validation_status, 'v2-anant-approved',
  'Goal: help the child walk in a straight line, heel to toe.', 'you score each try · we record the time', 'The child walks heel to toe along a line marked on the floor, with you alongside.', 'Walking a narrow line demands controlled balance while moving, which is harder than standing still. It carries over into walking safely in busy places.', 'Narrowing the base of support makes balance work harder. A visible line gives clear feedback the child can see for themselves.',
  'Early on the child may step off repeatedly or walk with feet wide. It is going well when they stay on the line further, place heel to toe, and step off less.', 'You score each attempt by tapping — distance covered and number of steps off the line. The platform records your scores and the time.', 'Step-off counts falling over sessions is a clear, honest measure of improving dynamic balance.', 'The camera does NOT see the child walking or whether they stayed on the line. You score it; the platform records your taps. This changes when we add sensor hardware.',
  'Gross motor / dynamic balance. Framework: ICF-CY. Recorded: therapist-scored trials, distance, step-off count.', 'The child walks the full line heel to toe with no more than one step off.', 8, 10, 3, 'therapist_scored'
) on conflict (id) do nothing;
-- PHY-08  Jumping With Both Feet  (6-8, therapist_scored)
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
  'PHY-08', 'Jumping With Both Feet', 'ICF_CY'::framework_source, 'gross_motor'::activity_domain, '{global_developmental_delay}'::diagnostic_profile[],
  'established'::skill_level, 72, 107, 10,
  '["Floor markers or a low line"]'::jsonb, '["independent","gestural_cue","verbal_cue","hand_over_hand"]'::jsonb, 'The child jumps with both feet leaving and landing together, over the marker. This happens in at least 8 out of 10 tries in a session. It happens in 3 sessions in a row.', '["Mark a spot on the floor to jump over or into.","Show the jump once — both feet together, land together.","Let them try, staying close.","Tap whether both feet left and landed together."]'::jsonb,
  '{"english":"We practise jumping with both feet together. Jumping needs leg power and opens up playground play with other children.","hindi":""}'::jsonb, 'validated'::validation_status, 'v2-anant-approved',
  'Goal: help the child jump with both feet together.', 'you score each try · we record the time', 'The child jumps forward or in place with both feet leaving and landing together, over a marked spot.', 'Jumping needs leg power and both sides working at once. It is a milestone that opens up playground play with other children.', 'Two-footed jumping develops before hopping. A visible target gives the child something to aim at and makes success obvious.',
  'Early on one foot may leave first, or the child may step rather than jump. It is going well when both feet leave and land together and the jump gets further.', 'You score each attempt by tapping — both feet together or not, and roughly how far. The platform records your scores and the time.', 'A clean count of successful two-footed jumps across sessions, showing when the pattern is properly established.', 'The camera does NOT see the jump, the feet, or the landing. You score it; the platform records what you tap. This changes when we add sensor hardware.',
  'Gross motor / power and coordination. Framework: ICF-CY. Recorded: therapist-scored trials, success count, distance.', 'The child jumps with both feet leaving and landing together, over the marker.', 8, 10, 3, 'therapist_scored'
) on conflict (id) do nothing;
-- 0055 part 2 of 2 — physiotherapy activities (PHY-09 to PHY-15) + signal mappings

-- PHY-09  Climbing Stairs  (6-8, therapist_scored)
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
  'PHY-09', 'Climbing Stairs', 'ICF_CY'::framework_source, 'gross_motor'::activity_domain, '{global_developmental_delay}'::diagnostic_profile[],
  'established'::skill_level, 72, 107, 10,
  '["A short flight of steps with a rail"]'::jsonb, '["independent","gestural_cue","verbal_cue","hand_over_hand"]'::jsonb, 'The child climbs the full flight alternating feet, using the rail lightly or not at all. This happens in at least 8 out of 10 tries in a session. It happens in 3 sessions in a row.', '["Stand beside the child at the bottom of the steps.","Ask them to climb, one foot on each step.","Stay level with them, ready to steady.","Tap how many steps and whether they alternated feet."]'::jsonb,
  '{"english":"We practise climbing stairs with one foot on each step. Stairs are everywhere, and managing them safely is a real daily skill.","hindi":""}'::jsonb, 'validated'::validation_status, 'v2-anant-approved',
  'Goal: help the child climb stairs one foot per step.', 'you score each try · we record the time', 'The child climbs a short flight of stairs placing one foot on each step rather than bringing both feet to the same step.', 'Stairs are everywhere — at home, at school, in the clinic. Climbing them safely and independently is a genuine daily-living skill.', 'Alternating feet requires single-leg support on each step, so it builds directly on one-leg balance. It develops after step-together climbing.',
  'Early on the child may bring both feet to each step and hold the rail tightly. It is going well when they alternate feet, use the rail less, and manage more steps.', 'You score each attempt by tapping — step count, whether feet alternated, and rail use. The platform records your scores and the time.', 'Records the shift from step-together to alternating feet, which is the clinical milestone here.', 'The camera does NOT see the stairs or the child''s feet. You score it; the platform records your taps. This changes when we add sensor hardware.',
  'Gross motor / stair negotiation. Framework: ICF-CY. Recorded: therapist-scored trials, step count, foot pattern, rail use.', 'The child climbs the full flight alternating feet, using the rail lightly or not at all.', 8, 10, 3, 'therapist_scored'
) on conflict (id) do nothing;
-- PHY-10  Kicking a Ball  (6-8, therapist_scored)
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
  'PHY-10', 'Kicking a Ball', 'ICF_CY'::framework_source, 'gross_motor'::activity_domain, '{global_developmental_delay}'::diagnostic_profile[],
  'established'::skill_level, 72, 107, 10,
  '["A soft ball"]'::jsonb, '["independent","gestural_cue","verbal_cue","hand_over_hand"]'::jsonb, 'The child kicks the ball forward and stays standing, on most attempts. This happens in at least 8 out of 10 tries in a session. It happens in 3 sessions in a row.', '["Place a soft ball still, in front of the child.","Ask them to kick it towards you.","Let them find their own balance — do not hold them.","Tap whether they kicked it and stayed standing."]'::jsonb,
  '{"english":"We practise kicking a ball. Kicking needs balancing on one leg while the other swings, and children enjoy it.","hindi":""}'::jsonb, 'validated'::validation_status, 'v2-anant-approved',
  'Goal: help the child kick a ball while staying balanced.', 'you score each try · we record the time', 'The child kicks a stationary ball forward while standing, without losing balance.', 'Kicking needs the child to balance on one leg while swinging the other. It combines balance and coordination in something children enjoy.', 'A stationary ball is practised before a rolling one. The skill is standing on one leg momentarily while the other leg moves with force.',
  'Early on the child may walk into the ball or fall after kicking. It is going well when they kick with a clear swing, stay standing, and the ball goes further.', 'You score each attempt by tapping — contacted the ball, stayed balanced, and roughly how far it went. The platform records your scores and the time.', 'Combines contact success with balance retention, showing both parts of the skill developing.', 'The camera does NOT see the kick, the ball, or the child''s balance. You score it; the platform records your taps. This changes when we add sensor hardware.',
  'Gross motor / coordination. Framework: ICF-CY. Recorded: therapist-scored trials, contact success, balance retained.', 'The child kicks the ball forward and stays standing, on most attempts.', 8, 10, 3, 'therapist_scored'
) on conflict (id) do nothing;
-- PHY-11  Catching a Large Ball  (6-8, therapist_scored)
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
  'PHY-11', 'Catching a Large Ball', 'ICF_CY'::framework_source, 'gross_motor'::activity_domain, '{global_developmental_delay}'::diagnostic_profile[],
  'established'::skill_level, 72, 107, 10,
  '["A large soft ball"]'::jsonb, '["independent","gestural_cue","verbal_cue","hand_over_hand"]'::jsonb, 'The child catches the ball with hands rather than trapping it, on most throws. This happens in at least 8 out of 10 tries in a session. It happens in 3 sessions in a row.', '["Stand a short distance from the child.","Throw a large soft ball gently towards their chest.","Say ''ready'' before each throw.","Tap whether they caught it, trapped it, or missed."]'::jsonb,
  '{"english":"We practise catching a large soft ball. Catching builds hand-eye coordination and the timing to react to something moving.","hindi":""}'::jsonb, 'validated'::validation_status, 'v2-anant-approved',
  'Goal: help the child catch a ball thrown gently.', 'you score each try · we record the time', 'The child catches a large soft ball thrown gently to their chest from a short distance.', 'Catching needs the child to watch a moving object and move their arms to meet it. It builds hand-eye coordination and reaction timing.', 'Large slow balls are caught before small fast ones, and chest-height throws before high or low ones. Distance is increased as success grows.',
  'Early on the child may close their arms too late or turn away. It is going well when they get their arms in place in time and trap or catch more often.', 'You score each throw by tapping — caught, trapped against the body, or missed. The platform records your scores and the time.', 'A clean per-throw record showing the shift from trapping to true catching over sessions.', 'The camera does NOT see the ball or the catch. You score it; the platform records what you tap. This changes when we add sensor hardware.',
  'Gross motor / hand-eye coordination. Framework: ICF-CY. Recorded: therapist-scored trials, catch outcome per throw.', 'The child catches the ball with hands rather than trapping it, on most throws.', 8, 10, 3, 'therapist_scored'
) on conflict (id) do nothing;
-- PHY-12  Obstacle Course  (9-12, therapist_scored)
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
  'PHY-12', 'Obstacle Course', 'ICF_CY'::framework_source, 'gross_motor'::activity_domain, '{global_developmental_delay}'::diagnostic_profile[],
  'mastery'::skill_level, 108, 155, 15,
  '["Cones, cushions, a low beam, a tunnel — whatever is available"]'::jsonb, '["independent","gestural_cue","verbal_cue","hand_over_hand"]'::jsonb, 'The child completes the full course in order without reminders. This happens in at least 8 out of 10 tries in a session. It happens in 3 sessions in a row.', '["Set out three or four simple obstacles in a line.","Walk the child through it once, showing each part.","Let them do the whole course themselves.","Tap how many parts they completed and how much help was needed."]'::jsonb,
  '{"english":"We set up a short obstacle course. Real movement is never one skill at a time, and a course is closer to how your child moves in daily life.","hindi":""}'::jsonb, 'validated'::validation_status, 'v2-anant-approved',
  'Goal: help the child move through several challenges in order.', 'you score each try · we record the time', 'The child moves through a short course combining several movements — stepping over, going under, walking along, going around.', 'Real movement is never one skill at a time. A course asks the child to switch between movements and remember the sequence, which is closer to daily life.', 'Combining skills into a sequence tests whether each one is genuinely established, and adds a memory demand. Difficulty is easily graded by adding parts.',
  'Early on the child may need reminding at each obstacle or skip parts. It is going well when they complete the whole course in order with fewer reminders and more speed.', 'You score each run by tapping — parts completed, help needed, and the platform times the run. Your scores and the timing are recorded.', 'Run time and parts-completed across sessions give a combined picture of motor skill and sequencing, which single exercises do not show.', 'The camera does NOT see the course or the child moving through it. You score it; the platform records your taps and the run time. This changes when we add sensor hardware.',
  'Gross motor / motor planning. Framework: ICF-CY. Recorded: therapist-scored trials, parts completed, prompt level, run duration.', 'The child completes the full course in order without reminders.', 8, 10, 3, 'therapist_scored'
) on conflict (id) do nothing;
-- PHY-13  Hopping on One Foot  (9-12, therapist_scored)
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
  'PHY-13', 'Hopping on One Foot', 'ICF_CY'::framework_source, 'gross_motor'::activity_domain, '{global_developmental_delay}'::diagnostic_profile[],
  'mastery'::skill_level, 108, 155, 10,
  '["Floor markers"]'::jsonb, '["independent","gestural_cue","verbal_cue","hand_over_hand"]'::jsonb, 'The child hops the target number of times on each foot without putting the other down. This happens in at least 8 out of 10 tries in a session. It happens in 3 sessions in a row.', '["Mark a short distance on the floor.","Ask the child to hop along it on one foot.","Stay close, ready to steady.","Tap how many hops on each foot."]'::jsonb,
  '{"english":"We practise hopping on one foot. Hopping needs power and balance on one leg, and it comes up in playground games and school PE.","hindi":""}'::jsonb, 'validated'::validation_status, 'v2-anant-approved',
  'Goal: help the child hop forward on one foot.', 'you score each try · we record the time', 'The child hops forward on one foot along a short marked distance, practising both feet.', 'Hopping is harder than jumping — it needs power and balance on a single leg. It appears in playground games and PE at school.', 'Hopping develops after two-footed jumping and single-leg standing are both secure. Practising both sides reveals whether one leg lags.',
  'Early on the child may manage one hop or put the other foot down. It is going well when they chain several hops, on both feet, and cover more ground.', 'You score each attempt by tapping the number of consecutive hops per foot. The platform records your scores and the time.', 'Hop counts per side show progress and expose asymmetry between legs, which single-side practice would hide.', 'The camera does NOT see hopping or which foot was used. You score it; the platform records your taps. This changes when we add sensor hardware.',
  'Gross motor / single-leg power. Framework: ICF-CY. Recorded: therapist-scored trials, hop count per foot.', 'The child hops the target number of times on each foot without putting the other down.', 8, 10, 3, 'therapist_scored'
) on conflict (id) do nothing;
-- PHY-14  Throwing at a Target  (9-12, therapist_scored)
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
  'PHY-14', 'Throwing at a Target', 'ICF_CY'::framework_source, 'gross_motor'::activity_domain, '{global_developmental_delay}'::diagnostic_profile[],
  'mastery'::skill_level, 108, 155, 10,
  '["A soft ball or beanbag","A basket or marked target"]'::jsonb, '["independent","gestural_cue","verbal_cue","hand_over_hand"]'::jsonb, 'The child hits the target on the majority of throws at the set distance. This happens in at least 8 out of 10 tries in a session. It happens in 3 sessions in a row.', '["Place a basket or target a short distance away.","Give the child a beanbag or soft ball.","Ask them to throw it into the target.","Tap hit or miss for each throw."]'::jsonb,
  '{"english":"We practise throwing at a target. Aiming combines strength, coordination, and judging distance — all used constantly in play.","hindi":""}'::jsonb, 'validated'::validation_status, 'v2-anant-approved',
  'Goal: help the child throw accurately at a target.', 'you score each try · we record the time', 'The child throws a beanbag or ball at a target from a set distance, with the distance increased as accuracy improves.', 'Throwing with aim combines arm strength, coordination, and judging distance. It is a skill children use constantly in play.', 'Accuracy improves with immediate visible feedback — the beanbag lands in or out. Distance is increased only once accuracy is consistent.',
  'Early on throws may go wide or fall short. It is going well when more land on target, the throwing action becomes smoother, and distance can be increased.', 'You score each throw by tapping hit or miss. The platform records your scores and the activity time.', 'A simple hit rate across sessions, which makes accuracy improvement obvious without any tallying by hand.', 'The camera does NOT see the throw or where it landed. You score it; the platform records your taps. This changes when we add sensor hardware.',
  'Gross motor / aim and coordination. Framework: ICF-CY. Recorded: therapist-scored trials, hit rate, distance.', 'The child hits the target on the majority of throws at the set distance.', 8, 10, 3, 'therapist_scored'
) on conflict (id) do nothing;
-- PHY-15  Sit-Ups and Core Holds  (9-12, therapist_scored)
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
  'PHY-15', 'Sit-Ups and Core Holds', 'GENERAL_PRACTICE'::framework_source, 'gross_motor'::activity_domain, '{global_developmental_delay}'::diagnostic_profile[],
  'mastery'::skill_level, 108, 155, 10,
  '["Floor mat"]'::jsonb, '["independent","gestural_cue","verbal_cue","hand_over_hand"]'::jsonb, 'The child holds the position for the target time across the full set of repetitions. This happens in at least 8 out of 10 tries in a session. It happens in 3 sessions in a row.', '["Lie the child on a mat, knees bent.","Ask them to hold a position or come up part-way.","Count aloud together while they hold.","Tap how long they held and how many repetitions."]'::jsonb,
  '{"english":"We do simple trunk exercises. A strong middle supports sitting upright at a desk, handwriting, and every big movement.","hindi":""}'::jsonb, 'validated'::validation_status, 'v2-anant-approved',
  'Goal: help the child build trunk strength.', 'you score each try · we record the time', 'Simple trunk exercises — partial sit-ups and holds — done on a mat with counting to make it a game.', 'A strong trunk supports sitting upright at a desk, handwriting, and every large movement. Weak core strength shows up as slumping and fatigue at school.', 'Trunk strength builds with short repeated holds rather than long ones. Counting aloud gives the child a number to beat.',
  'Early on the child may hold for a second or arch their back. It is going well when holds get longer, the position stays clean, and more repetitions are managed.', 'You score each set by tapping hold duration and repetition count. The platform records your scores and the activity time.', 'Duration and repetition records show strength building session by session — a number the child can also see improving.', 'The camera does NOT see the child''s position, posture, or effort. You score it; the platform records your taps. This changes when we add sensor hardware.',
  'Gross motor / core strength. Framework: general practice. Recorded: therapist-scored trials, hold duration, repetitions.', 'The child holds the position for the target time across the full set of repetitions.', 8, 10, 3, 'therapist_scored'
) on conflict (id) do nothing;

-- physiotherapy signal mappings
insert into activity_signals (activity_id, attribute_id, is_primary) values
  ('PHY-01', 'follows_instruction', true),
  ('PHY-02', 'follows_instruction', true),
  ('PHY-03', 'follows_instruction', true),
  ('PHY-04', 'follows_instruction', true),
  ('PHY-05', 'follows_instruction', true),
  ('PHY-06', 'follows_instruction', true),
  ('PHY-07', 'follows_instruction', true),
  ('PHY-08', 'follows_instruction', true),
  ('PHY-09', 'follows_instruction', true),
  ('PHY-10', 'follows_instruction', true),
  ('PHY-11', 'follows_instruction', true),
  ('PHY-12', 'follows_instruction', true),
  ('PHY-13', 'follows_instruction', true),
  ('PHY-14', 'follows_instruction', true),
  ('PHY-15', 'follows_instruction', true)
on conflict (activity_id, attribute_id) do nothing;
