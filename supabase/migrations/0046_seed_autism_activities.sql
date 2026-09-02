-- 0046 part 1 of 4 — autism activity seed
-- Run parts 1,2,3 then part 4 (signal mappings), in order.

-- AUT-01  Face-to-Face Bubble Play  (3-5, cam_face)
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
  'AUT-01', 'Face-to-Face Bubble Play', 'ESDM'::framework_source, 'joint_attention'::activity_domain, '{autism}'::diagnostic_profile[],
  'emerging'::skill_level, 36, 71, 5,
  '["Bubble solution","Bubble wand"]'::jsonb, '["independent","gestural_cue","verbal_cue","hand_over_hand"]'::jsonb, 'The child looks at your face on their own, without prompting, before you blow. This happens in at least 8 out of 10 tries in a session. It happens in 3 sessions in a row.', '["Sit facing the child, at their eye level, near the camera.","Blow a few bubbles. Then stop, and hold the wand near your face.","Wait. Let the child look at your face before you blow again.","Every time they look at you, blow straight away."]'::jsonb,
  '{"english":"We play with bubbles and pause, so your child has a reason to look at our face. Looking at people is one of the first social skills, and everything social grows from it.","hindi":""}'::jsonb, 'validated'::validation_status, 'v1-anant-approved',
  'Goal: help the child look at your face during play.', 'how long the child looks at your face', 'A bubble game where you pause before each blow. The pause gives the child a reason to look at your face.', 'Looking at another person to share a moment is one of the first social skills a child learns. Almost all later social learning is built on it. Many children with autism do this less often on their own.', 'Children with autism often make less eye contact early on. Using something the child already loves gives them a real reason to look at you. Play-based teaching like this has the strongest evidence behind it.',
  'At the start, the child may only glance at you, or need the wand held right next to your face. It is going well when the child starts looking at your face on their own before each blow, and the looks get longer.', 'The camera watches which way the child''s head is turned. It records how long they look towards your face, how many times they look up at you, and their longest single look.', 'Across sessions you can see whether the child is looking at people more. The numbers show the trend, so you are not relying on memory of how a session felt.', 'The camera sees which way the head is turned. It does not track the eyes exactly, and it cannot tell what the child is feeling. You decide whether it was a real moment of connection.',
  'Joint attention / social gaze. Framework: ESDM, NDBI. Signal: looks_at_you (gaze duration, gaze-shift count, longest episode).', 'The child looks at your face on their own, without prompting, before you blow.', 8, 10, 3, 'cam_face'
) on conflict (id) do nothing;

-- AUT-02  Response to Name  (3-5, cam_face)
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
  'AUT-02', 'Response to Name', 'ESDM'::framework_source, 'joint_attention'::activity_domain, '{autism}'::diagnostic_profile[],
  'emerging'::skill_level, 36, 71, 5,
  '[]'::jsonb, '["independent","gestural_cue","verbal_cue","hand_over_hand"]'::jsonb, 'The child turns towards you within about 3 seconds of their name being said once. This happens in at least 8 out of 10 tries in a session. It happens in 3 sessions in a row.', '["Wait until the child is calm and busy with something.","Say their name once, clearly, from beside the camera.","Wait a few seconds. Do not repeat it straight away.","If they turn, respond warmly right away."]'::jsonb,
  '{"english":"We call your child''s name and see if they turn towards us. Turning to your own name is one of the earliest signs a child is tuning in to people.","hindi":""}'::jsonb, 'validated'::validation_status, 'v1-anant-approved',
  'Goal: help the child turn towards you when you say their name.', 'whether the child turns, and how fast', 'You say the child''s name once and wait to see if they turn towards you. Repeated a few times through the session.', 'Turning when someone says your name is one of the earliest signs that a child is tuned in to people. It is often delayed in autism, and it is something that can improve with practice.', 'Not turning to their own name is one of the most studied early signs of autism. How quickly a child turns is a sensitive measure — small improvements show up in the timing before they show up anywhere else.',
  'Early on the child may not turn at all, or only turn when you are very close or very loud. It is going well when they turn more often, faster, and from further away.', 'The camera records whether the child''s head turns towards you within a few seconds of the name, and how long they took. The timing is measured automatically.', 'Response time is very hard to judge by eye. Having it measured means you can see genuine improvement in seconds, not impressions.', 'The camera cannot tell whether the child heard you. You confirm they were in earshot and not deeply absorbed elsewhere, so the try counts as fair.',
  'Social orienting. Framework: ESDM. Signal: response_to_name (latency; 3s window, 30 degree valid angle).', 'The child turns towards you within about 3 seconds of their name being said once.', 8, 10, 3, 'cam_face'
) on conflict (id) do nothing;

-- AUT-03  Pop-Up Toy Anticipation  (3-5, cam_face)
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
  'AUT-03', 'Pop-Up Toy Anticipation', 'NDBI'::framework_source, 'joint_attention'::activity_domain, '{autism}'::diagnostic_profile[],
  'emerging'::skill_level, 36, 71, 5,
  '["Pop-up toy or jack-in-the-box"]'::jsonb, '["independent","gestural_cue","verbal_cue","hand_over_hand"]'::jsonb, 'The child looks up at your face during the pause, without you prompting. This happens in at least 8 out of 10 tries in a session. It happens in 3 sessions in a row.', '["Use a pop-up or surprise toy the child enjoys.","Make it pop once, with lots of excitement.","Hold the toy still and wait, near your face.","When the child looks at you, make it pop again."]'::jsonb,
  '{"english":"We pause a fun toy so your child looks at us to ask for more. Looking from a toy to a person is a key social step.","hindi":""}'::jsonb, 'validated'::validation_status, 'v1-anant-approved',
  'Goal: get the child to look at you to ask for the toy again.', 'how often the child looks up at you', 'A surprise toy is used, then paused. The child has to look at you to make it happen again.', 'This builds the skill of looking from the thing to the person — the heart of shared attention. It teaches the child that people make good things happen.', 'Coordinating attention between an object and a person predicts later language and social skills. Pausing a fun toy creates a natural, motivating reason to do it.',
  'Early on the child may stare only at the toy. It is going well when they start glancing up at your face during the pause, and do it faster each round.', 'The camera records how many times the child shifts their gaze up towards your face, and how long each look lasts.', 'Counting look-ups objectively shows whether the child is starting to include you in their play, rather than only focusing on objects.', 'The camera records that the child faced you. It cannot tell whether they meant it as a request — you judge that.',
  'Triadic / coordinated joint attention. Framework: NDBI. Signal: looks_at_you (gaze-shift count).', 'The child looks up at your face during the pause, without you prompting.', 8, 10, 3, 'cam_face'
) on conflict (id) do nothing;

-- AUT-04  Pointing to Ask  (3-5, cam_hands)
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
  'AUT-04', 'Pointing to Ask', 'NDBI'::framework_source, 'joint_attention'::activity_domain, '{autism}'::diagnostic_profile[],
  'emerging'::skill_level, 36, 71, 5,
  '["2 or 3 preferred items"]'::jsonb, '["independent","gestural_cue","verbal_cue","hand_over_hand"]'::jsonb, 'The child points with one finger to ask, without you shaping their hand. This happens in at least 8 out of 10 tries in a session. It happens in 3 sessions in a row.', '["Put a favourite item in sight but out of reach, near the camera.","Wait for the child to point or reach towards it.","If they point, give it straight away.","If they only reach, gently shape the hand into a point, then give it."]'::jsonb,
  '{"english":"We place something your child wants just out of reach, so pointing becomes the natural way to ask. Pointing comes before words.","hindi":""}'::jsonb, 'validated'::validation_status, 'v1-anant-approved',
  'Goal: teach the child to point at what they want.', 'how many times the child points', 'Something the child wants is placed just out of reach, so pointing becomes the natural way to ask for it.', 'Pointing to ask for something is an early and important way children communicate before they have words. It is often delayed in autism.', 'Pointing to request is one of the first communicative gestures children develop. Teaching it in a moment when the child genuinely wants something makes it stick.',
  'At first the child may only reach or take your hand. It is going well when a clear one-finger point appears on its own, and happens more often.', 'The camera recognises hand shapes and counts each time the child points. It also records which direction they pointed.', 'Pointing is quick and easy to miss while you are managing the session. Counting it automatically shows whether the gesture is really emerging.', 'The camera counts the hand shape. It cannot tell a communicative point from a general gesture — you judge whether it was really a request.',
  'Proto-imperative pointing / requesting. Framework: NDBI. Signal: points_at_things (count, direction).', 'The child points with one finger to ask, without you shaping their hand.', 8, 10, 3, 'cam_hands'
) on conflict (id) do nothing;

-- AUT-05  Showing Things to You  (3-5, cam_hands)
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
  'AUT-05', 'Showing Things to You', 'ESDM'::framework_source, 'joint_attention'::activity_domain, '{autism}'::diagnostic_profile[],
  'established'::skill_level, 36, 71, 5,
  '["Interesting toys"]'::jsonb, '["independent","gestural_cue","verbal_cue","hand_over_hand"]'::jsonb, 'The child holds a toy up towards you to share it, and looks at your face. This happens in at least 8 out of 10 tries in a session. It happens in 3 sessions in a row.', '["Give the child an interesting toy to explore.","When they enjoy it, hold your hand out and look interested.","Wait for them to lift or hold it towards you.","React with delight — do not take the toy away."]'::jsonb,
  '{"english":"We encourage your child to hold a toy up and show us — just to share it. Sharing enjoyment with someone is a big social step.","hindi":""}'::jsonb, 'validated'::validation_status, 'v1-anant-approved',
  'Goal: help the child hold something up to share it with you.', 'how often the child holds things towards you', 'The child is encouraged to lift or hold out a toy to show you — sharing it, not giving it away.', 'Showing something just to share the enjoyment, with nothing to gain, is a big social step. It is one of the clearest signs a child wants to connect.', 'Sharing an object purely to share the experience develops later than asking for things, and is often reduced in autism. It responds well to warm, exaggerated adult interest.',
  'Early on the child may ignore you or hand the toy over to get rid of it. It is going well when they hold it up and look at you, expecting a reaction.', 'The camera counts hand-raise and reach-towards movements, and records whether the child looked at you around the same time.', 'Showing is easy to miss in a busy session. Counting it gives you an objective record of whether social sharing is appearing.', 'The camera counts arm and hand movement. It cannot tell showing from handing over — you judge the intent.',
  'Proto-declarative showing. Framework: ESDM. Signal: reaches_for_things (count), looks_at_you.', 'The child holds a toy up towards you to share it, and looks at your face.', 8, 10, 3, 'cam_hands'
) on conflict (id) do nothing;

-- AUT-06  Following Your Point  (3-5, cam_face)
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
  'AUT-06', 'Following Your Point', 'ESDM'::framework_source, 'joint_attention'::activity_domain, '{autism}'::diagnostic_profile[],
  'established'::skill_level, 36, 71, 5,
  '["Interesting objects placed around the room"]'::jsonb, '["independent","gestural_cue","verbal_cue","hand_over_hand"]'::jsonb, 'The child turns their head towards the thing you pointed at. This happens in at least 8 out of 10 tries in a session. It happens in 3 sessions in a row.', '["Get the child''s attention first.","Point clearly at something interesting to one side.","Say ''look!'' once, and hold the point.","When they turn to look, react with delight."]'::jsonb,
  '{"english":"We point at something and see if your child looks where we are pointing. This shows they understand we are trying to show them something.","hindi":""}'::jsonb, 'validated'::validation_status, 'v1-anant-approved',
  'Goal: help the child look where you are pointing.', 'whether the child turns to look', 'You point at something and see whether the child follows your point with their eyes and head.', 'Following someone''s point means the child understands that you are trying to show them something. It is a key step towards learning language from other people.', 'Responding to another person''s pointing is a well-established early social milestone and is commonly delayed in autism. It is a strong predictor of later language.',
  'Early on the child may look at your hand rather than the object, or not turn at all. It is going well when they turn their head in the right direction and find the object.', 'The camera records the direction the child''s head turns and whether it matches the side you pointed to.', 'Shows objectively whether the child is beginning to follow your lead — a skill that unlocks a lot of later learning.', 'The camera records head direction only. It cannot confirm the child actually saw the object — you judge that.',
  'Responding to joint attention. Framework: ESDM. Signal: looks_at_you (head direction / yaw).', 'The child turns their head towards the thing you pointed at.', 8, 10, 3, 'cam_face'
) on conflict (id) do nothing;

-- AUT-07  Copy Me — Clap and Wave  (3-5, cam_hands)
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
  'AUT-07', 'Copy Me — Clap and Wave', 'ESDM'::framework_source, 'motor_imitation'::activity_domain, '{autism}'::diagnostic_profile[],
  'emerging'::skill_level, 36, 71, 5,
  '[]'::jsonb, '["independent","gestural_cue","verbal_cue","hand_over_hand"]'::jsonb, 'The child claps or waves on their own after you model it, without hand-over-hand help. This happens in at least 8 out of 10 tries in a session. It happens in 3 sessions in a row.', '["Sit facing the child, hands visible to the camera.","Clap slowly and clearly, then wait.","If they do not copy, gently guide their hands once.","Praise every attempt, even a partial one."]'::jsonb,
  '{"english":"We play a copying game with clapping and waving. Copying is how children learn most new skills, so building it helps everything else.","hindi":""}'::jsonb, 'validated'::validation_status, 'v1-anant-approved',
  'Goal: help the child copy simple hand actions.', 'how many times the child claps or waves', 'A simple copying game using clapping and waving — actions that are easy to see and easy to reward.', 'Copying is how children learn most new skills. Children who copy more, learn faster. It is often reduced in autism and can be taught directly.', 'Imitation is a pivotal skill — improving it tends to improve many other areas at once. It is a core target in early autism intervention.',
  'Early on the child may need their hands guided every time. It is going well when they clap or wave on their own after seeing you do it, and need less help.', 'The camera recognises clapping and waving and counts each one.', 'Gives a clear count of copying attempts, so you can see whether imitation is emerging without having to tally by hand.', 'The camera counts the action. It cannot judge how closely the child copied you — you rate the accuracy.',
  'Motor imitation. Framework: ESDM, NDBI. Signal: claps_hands, waves (count).', 'The child claps or waves on their own after you model it, without hand-over-hand help.', 8, 10, 3, 'cam_hands'
) on conflict (id) do nothing;

-- 0046 part 2 of 4 — autism activity seed
-- Run parts 1,2,3 then part 4 (signal mappings), in order.

-- AUT-08  Mirror Face Play  (3-5, cam_face)
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
  'AUT-08', 'Mirror Face Play', 'ESDM'::framework_source, 'joint_attention'::activity_domain, '{autism}'::diagnostic_profile[],
  'emerging'::skill_level, 36, 71, 5,
  '["A mirror (optional)"]'::jsonb, '["independent","gestural_cue","verbal_cue","hand_over_hand"]'::jsonb, 'The child looks at your face for a sustained moment, without you prompting. This happens in at least 8 out of 10 tries in a session. It happens in 3 sessions in a row.', '["Sit beside the child facing the camera or a mirror.","Make big, playful faces — surprise, silly, happy.","Pause and wait for the child to look.","When they look, react with a big reaction."]'::jsonb,
  '{"english":"We make big playful faces so looking at faces becomes fun. Some children need help finding faces interesting, and this builds that comfort.","hindi":""}'::jsonb, 'validated'::validation_status, 'v1-anant-approved',
  'Goal: make looking at faces fun and rewarding.', 'how long the child looks at faces', 'A playful face-making game that makes looking at a face rewarding in itself.', 'Some children with autism find faces less interesting. Making faces fun and exaggerated helps build comfort with looking at people.', 'Exaggerated, playful facial expressions increase how much young children attend to faces. Building comfort with face-looking supports later social learning.',
  'Early on the child may look away quickly. It is going well when they look for longer, look back on their own, and start to enjoy the game.', 'The camera records how long the child spends looking towards the face, and their longest single look.', 'Shows whether comfort with face-looking is increasing, which is often the first thing to change.', 'The camera measures head direction, not eye position or enjoyment. You judge whether the child was engaged.',
  'Social gaze / face attention. Framework: ESDM. Signal: looks_at_you (duration, longest episode).', 'The child looks at your face for a sustained moment, without you prompting.', 8, 10, 3, 'cam_face'
) on conflict (id) do nothing;

-- AUT-09  Looking at a Book Together  (3-5, cam_face)
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
  'AUT-09', 'Looking at a Book Together', 'HANEN'::framework_source, 'joint_attention'::activity_domain, '{autism}'::diagnostic_profile[],
  'emerging'::skill_level, 36, 71, 10,
  '["A simple picture book with clear images"]'::jsonb, '["independent","gestural_cue","verbal_cue","hand_over_hand"]'::jsonb, 'The child looks up at your face during the book activity, without prompting. This happens in at least 8 out of 10 tries in a session. It happens in 3 sessions in a row.', '["Sit side by side with the book between you, near the camera.","Point at one picture and name it.","Pause, and wait for the child to look at you.","Follow whatever the child shows interest in."]'::jsonb,
  '{"english":"We look at a picture book together and pause, so your child looks up at us. Sharing a book is one of the best ways to build early language.","hindi":""}'::jsonb, 'validated'::validation_status, 'v1-anant-approved',
  'Goal: build shared attention using a picture book.', 'how often the child looks between the book and you', 'A shared book activity where you pause so the child looks from the page to you and back.', 'Books create many natural chances to share attention. Looking between the page and you is exactly the skill that supports learning words.', 'Shared book reading with pausing and following the child''s interest is a well-established way to build joint attention and early language.',
  'Early on the child may only look at the book or try to turn pages fast. It is going well when they start looking up at you after each picture, as if checking in.', 'The camera records the child''s gaze shifts up towards your face and how long each look lasts.', 'Shows whether the child is beginning to share the activity with you rather than doing it alone.', 'The camera cannot tell whether the child was looking at the picture or the page in general. It records looks towards you.',
  'Joint attention with books. Framework: Hanen, ESDM. Signal: looks_at_you (gaze-shift count).', 'The child looks up at your face during the book activity, without prompting.', 8, 10, 3, 'cam_face'
) on conflict (id) do nothing;

-- AUT-10  Asking for Another Turn  (3-5, cam_face)
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
  'AUT-10', 'Asking for Another Turn', 'NDBI'::framework_source, 'joint_attention'::activity_domain, '{autism}'::diagnostic_profile[],
  'emerging'::skill_level, 36, 71, 5,
  '["A wind-up toy or spinning top"]'::jsonb, '["independent","gestural_cue","verbal_cue","hand_over_hand"]'::jsonb, 'The child looks at your face to ask for another turn, without prompting. This happens in at least 8 out of 10 tries in a session. It happens in 3 sessions in a row.', '["Use a toy the child loves that you control.","Give one turn, then stop and hold the toy.","Wait for the child to look at your face.","The moment they look, give another turn."]'::jsonb,
  '{"english":"We control a fun toy and pause, so your child looks at us to ask for more. This teaches that people are the route to good things.","hindi":""}'::jsonb, 'validated'::validation_status, 'v1-anant-approved',
  'Goal: teach the child to look at you to ask for more.', 'how often the child looks at you to ask', 'You control a fun toy and pause, so the child must look at you to get another turn.', 'This teaches that people, not just objects, are the route to good things. Looking at someone to ask is an early and important communication step.', 'Building requesting around something the child is already motivated by is the most effective way to teach early communication. The reward is immediate and built in.',
  'Early on the child may grab at the toy or get frustrated. It is going well when they look at your face first, and do it more quickly each time.', 'The camera records each time the child looks towards your face and how long the look lasts.', 'Shows objectively whether the child is learning that looking at a person gets results.', 'The camera records the look, not the intention behind it. You judge whether it was a genuine request.',
  'Requesting via gaze / triadic attention. Framework: NDBI. Signal: looks_at_you (gaze-shift count).', 'The child looks at your face to ask for another turn, without prompting.', 8, 10, 3, 'cam_face'
) on conflict (id) do nothing;

-- AUT-11  Finger Play Copying  (6-8, cam_hands)
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
  'AUT-11', 'Finger Play Copying', 'ESDM'::framework_source, 'motor_imitation'::activity_domain, '{autism}'::diagnostic_profile[],
  'established'::skill_level, 72, 107, 5,
  '[]'::jsonb, '["independent","gestural_cue","verbal_cue","hand_over_hand"]'::jsonb, 'The child copies a finger shape on their own, without hand-over-hand help. This happens in at least 8 out of 10 tries in a session. It happens in 3 sessions in a row.', '["Sit facing the child with hands clearly in view.","Show a simple finger action — one finger up, thumbs up.","Wait for them to copy.","Praise every attempt, even if not exact."]'::jsonb,
  '{"english":"We play copying games with small finger movements. These build both copying skills and the hand control needed for pointing and writing.","hindi":""}'::jsonb, 'validated'::validation_status, 'v1-anant-approved',
  'Goal: help the child copy small finger movements.', 'the child''s finger and hand shapes', 'A copying game using small finger movements rather than whole-arm actions.', 'Small finger movements are harder than big ones. Copying them builds both imitation and the fine hand control needed for pointing and later writing.', 'Fine motor imitation develops after gross motor imitation and supports gesture use and hand skills. It is a natural next step once clapping and waving are established.',
  'Early on the child may use their whole hand instead of one finger. It is going well when the finger shapes get closer to yours and need less help.', 'The camera recognises hand shapes — pointing, open hand, closed fist — and counts them.', 'Gives a record of which hand shapes the child can produce, showing fine motor progress over time.', 'The camera recognises broad hand shapes, not precise finger positions. You judge how accurate the copy was.',
  'Fine motor imitation. Framework: ESDM. Signal: points_at_things, grasps_objects (hand-shape count).', 'The child copies a finger shape on their own, without hand-over-hand help.', 8, 10, 3, 'cam_hands'
) on conflict (id) do nothing;

-- AUT-12  Passing Things Back and Forth  (6-8, cam_hands)
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
  'AUT-12', 'Passing Things Back and Forth', 'NDBI'::framework_source, 'social_reciprocity'::activity_domain, '{autism}'::diagnostic_profile[],
  'emerging'::skill_level, 72, 107, 5,
  '["One object the child likes — a ball, car, or soft toy"]'::jsonb, '["independent","gestural_cue","verbal_cue","hand_over_hand"]'::jsonb, 'The child hands the object back to you when asked, without you taking it. This happens in at least 8 out of 10 tries in a session. It happens in 3 sessions in a row.', '["Sit facing the child with one interesting object.","Hand it to them, then hold your hand out to get it back.","Wait. Do not grab it.","Make each exchange fun with a sound or reaction."]'::jsonb,
  '{"english":"We pass a toy back and forth. This ''my turn, your turn'' rhythm is the foundation of all social interaction and later conversation.","hindi":""}'::jsonb, 'validated'::validation_status, 'v1-anant-approved',
  'Goal: build back-and-forth turn taking with objects.', 'how many times the child takes and gives objects', 'A simple giving-and-taking game that builds the rhythm of taking turns.', 'Back-and-forth exchange is the foundation of all social interaction and, later, conversation. It teaches the rhythm of ''my turn, your turn''.', 'Object exchange is one of the earliest forms of social reciprocity and is a standard early target because it is concrete and easy for a child to understand.',
  'Early on the child may hold on and not give it back. It is going well when the exchanges flow, they hand it back more readily, and the back-and-forth lasts longer.', 'The camera counts grasping and releasing movements, showing how many exchanges happened.', 'Counting exchanges gives you a simple measure of how long the child can sustain a back-and-forth interaction.', 'The camera counts hand actions, not social quality. You judge whether the exchange felt genuinely shared.',
  'Social reciprocity / turn-taking. Framework: NDBI. Signal: grasps_objects (grasp and release count).', 'The child hands the object back to you when asked, without you taking it.', 8, 10, 3, 'cam_hands'
) on conflict (id) do nothing;

-- AUT-13  Point and Say It  (6-8, cam_hands)
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
  'AUT-13', 'Point and Say It', 'NDBI'::framework_source, 'joint_attention'::activity_domain, '{autism}'::diagnostic_profile[],
  'established'::skill_level, 72, 107, 5,
  '["Items the child really wants"]'::jsonb, '["independent","gestural_cue","verbal_cue","hand_over_hand"]'::jsonb, 'The child points and makes a sound at the same time to ask for something. This happens in at least 8 out of 10 tries in a session. It happens in 3 sessions in a row.', '["Put a wanted item in sight, out of reach.","Wait for a point.","When they point, model the word once.","Give the item for any point, and celebrate any sound."]'::jsonb,
  '{"english":"We help your child point and make a sound at the same time. Combining a gesture with a sound is the bridge from pointing to speaking.","hindi":""}'::jsonb, 'validated'::validation_status, 'v1-anant-approved',
  'Goal: help the child point and make a sound at the same time.', 'pointing, and any sounds made', 'Building on pointing by adding a sound or word, so the child combines gesture and voice to ask.', 'Combining a gesture with a sound is the bridge from pointing to speaking. It makes the child''s message clearer and stronger.', 'Pairing gesture with vocalisation is a well-established step towards spoken words. Children usually point before they speak, and adding sound to a point is the natural next stage.',
  'Early on the child points silently. It is going well when sounds start appearing alongside the point, even if they are not clear words.', 'The camera counts pointing, and the microphone counts the child''s sounds — so you can see whether the two are starting to happen together.', 'Shows whether gesture and voice are beginning to combine, which is the key step towards speech.', 'The platform counts points and counts sounds. It does not check whether the sound was the right word — that is your judgement.',
  'Coordinated gesture + vocalisation. Framework: NDBI. Signal: points_at_things + makes_sounds (count).', 'The child points and makes a sound at the same time to ask for something.', 8, 10, 3, 'cam_hands'
) on conflict (id) do nothing;

-- AUT-14  Noticing When You Show Something  (6-8, cam_face)
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
  'AUT-14', 'Noticing When You Show Something', 'ESDM'::framework_source, 'joint_attention'::activity_domain, '{autism}'::diagnostic_profile[],
  'established'::skill_level, 72, 107, 5,
  '["Interesting objects to show"]'::jsonb, '["independent","gestural_cue","verbal_cue","hand_over_hand"]'::jsonb, 'The child looks up at you and then towards what you are showing. This happens in at least 8 out of 10 tries in a session. It happens in 3 sessions in a row.', '["While the child is busy, say their name and point at something.","Wait for them to look at you, then at the thing.","Reward with an interesting reaction.","Keep tries short and spaced out."]'::jsonb,
  '{"english":"We gently interrupt your child to show them something, and see if they turn to look. Responding to others is how children learn from people.","hindi":""}'::jsonb, 'validated'::validation_status, 'v1-anant-approved',
  'Goal: help the child notice and respond when you draw their attention.', 'whether the child turns towards you', 'You interrupt the child gently to show them something, and see whether they shift attention to you and then to the object.', 'Responding when someone tries to share something is how children learn from the people around them. It is often reduced in autism.', 'Responding to another person''s bid for attention is a distinct skill from starting one, and it strongly predicts later language learning.',
  'Early on the child may not shift attention at all. It is going well when they look up more readily and then follow your point to the object.', 'The camera records whether and how quickly the child''s head turns towards you, and their gaze direction after.', 'Distinguishes whether the child can respond to your lead — separate from whether they start interactions themselves.', 'The camera records head movement, not understanding. You judge whether the child really engaged with what you showed.',
  'Responding to joint attention bids. Framework: ESDM. Signal: looks_at_you (gaze shift, direction).', 'The child looks up at you and then towards what you are showing.', 8, 10, 3, 'cam_face'
) on conflict (id) do nothing;

-- 0046 part 3 of 4 — autism activity seed
-- Run parts 1,2,3 then part 4 (signal mappings), in order.

-- AUT-15  Hello and Goodbye Waving  (6-8, cam_hands)
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
  'AUT-15', 'Hello and Goodbye Waving', 'ESDM'::framework_source, 'social_reciprocity'::activity_domain, '{autism}'::diagnostic_profile[],
  'emerging'::skill_level, 72, 107, 5,
  '[]'::jsonb, '["independent","gestural_cue","verbal_cue","hand_over_hand"]'::jsonb, 'The child waves back on their own when you wave and say hello. This happens in at least 8 out of 10 tries in a session. It happens in 3 sessions in a row.', '["At the start and end of the session, wave clearly.","Say ''hello'' or ''bye'' at the same time.","Wait for the child to wave back.","Help their hand once if needed, then praise."]'::jsonb,
  '{"english":"We wave hello and goodbye the same way every session. Greetings are a small social skill that transfers straight into daily life.","hindi":""}'::jsonb, 'validated'::validation_status, 'v1-anant-approved',
  'Goal: build a simple greeting routine.', 'how many times the child waves', 'A short, predictable greeting routine at the start and end of every session.', 'Greetings are a small, repeatable social skill that transfers directly to daily life — at home, at school, with visitors.', 'Predictable social routines are easier to learn because they repeat in the same way every time. Greetings are a common early social target.',
  'Early on the child may need their hand moved for them. It is going well when they wave on their own as soon as they see you wave, and eventually start it themselves.', 'The camera recognises waving and counts each one.', 'A simple count that shows whether the greeting routine is being learned and becoming independent.', 'The camera counts the wave motion. It cannot tell whether the child understood it as a greeting.',
  'Social routines / greetings. Framework: ESDM. Signal: waves (count).', 'The child waves back on their own when you wave and say hello.', 8, 10, 3, 'cam_hands'
) on conflict (id) do nothing;

-- AUT-16  Playing With Toys the Right Way  (6-8, cam_hands)
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
  'AUT-16', 'Playing With Toys the Right Way', 'NDBI'::framework_source, 'play_skills'::activity_domain, '{autism}'::diagnostic_profile[],
  'emerging'::skill_level, 72, 107, 10,
  '["Toys with an obvious purpose — toy car, cup, hairbrush, spoon"]'::jsonb, '["independent","gestural_cue","verbal_cue","hand_over_hand"]'::jsonb, 'The child uses the toy for its intended purpose after you model it once. This happens in at least 8 out of 10 tries in a session. It happens in 3 sessions in a row.', '["Offer a simple toy with an obvious use — a car, a cup, a brush.","Show the action once, simply.","Hand it over and wait.","Praise any attempt at the right action."]'::jsonb,
  '{"english":"We help your child use toys the way they are meant to be used. This is an early step towards pretend play and playing with other children.","hindi":""}'::jsonb, 'validated'::validation_status, 'v1-anant-approved',
  'Goal: help the child use toys the way they are meant to be used.', 'how the child handles the toys', 'Teaching the child to use toys for their real purpose — rolling a car, brushing a doll''s hair — rather than only spinning or lining them up.', 'Using toys the way they are meant to be used is an early step towards pretend play, and it opens the door to playing with other children.', 'Functional play develops before pretend play and is often delayed in autism. Modelling the action simply and letting the child try is the standard approach.',
  'Early on the child may spin, tap, or line up the toys. It is going well when the intended action starts appearing, and lasts a bit longer each time.', 'The camera counts grasping and hand movements and records how long the child stays engaged with the activity.', 'Combines a count of hand actions with how long the child stayed with the task — showing both skill and engagement.', 'The camera cannot tell appropriate play from repetitive play. It counts hand actions and engagement time. You judge the quality of the play.',
  'Functional play. Framework: NDBI. Signal: grasps_objects (count), stays_activity (duration).', 'The child uses the toy for its intended purpose after you model it once.', 8, 10, 3, 'cam_hands'
) on conflict (id) do nothing;

-- AUT-17  Matching Faces and Feelings  (9-12, cam_face)
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
  'AUT-17', 'Matching Faces and Feelings', 'ESDM'::framework_source, 'social_reciprocity'::activity_domain, '{autism}'::diagnostic_profile[],
  'established'::skill_level, 108, 155, 10,
  '["Emotion cards or photos with clear expressions"]'::jsonb, '["independent","gestural_cue","verbal_cue","hand_over_hand"]'::jsonb, 'The child correctly identifies the named feeling from the cards. This happens in at least 8 out of 10 tries in a session. It happens in 3 sessions in a row.', '["Lay out 3 or 4 cards showing clear emotions.","Name one feeling and ask the child to find it.","Talk about when we feel that way.","Keep the pace calm and unhurried."]'::jsonb,
  '{"english":"We practise recognising feelings on faces using cards. Understanding how others feel is the basis of getting along with people.","hindi":""}'::jsonb, 'validated'::validation_status, 'v1-anant-approved',
  'Goal: help the child recognise simple emotions on faces.', 'how long the child stays focused on the task', 'A card-matching activity where the child identifies simple emotions — happy, sad, angry, surprised.', 'Recognising how other people feel is the basis of getting along with others. Many children with autism find this harder and benefit from direct teaching.', 'Emotion recognition can be taught explicitly, and improvement transfers to real social situations. Older children benefit from clear, structured practice.',
  'Early on the child may guess or pick at random. It is going well when they choose correctly more often, and can start naming feelings without options in front of them.', 'The camera records how long the child stays focused on the task and their longest stretch of sustained attention.', 'Shows whether the child can sustain attention on a structured task — useful alongside your own record of how many they got right.', 'The camera does NOT check which card the child chose or whether it was correct. You score accuracy. The camera measures focus, not understanding.',
  'Emotion recognition / social cognition. Framework: ESDM. Signal: stays_activity (duration). Accuracy is therapist-scored.', 'The child correctly identifies the named feeling from the cards.', 8, 10, 3, 'cam_face'
) on conflict (id) do nothing;

-- AUT-18  Taking Turns in Conversation  (9-12, voice)
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
  'AUT-18', 'Taking Turns in Conversation', 'HANEN'::framework_source, 'social_reciprocity'::activity_domain, '{autism}'::diagnostic_profile[],
  'established'::skill_level, 108, 155, 10,
  '[]'::jsonb, '["independent","gestural_cue","verbal_cue","hand_over_hand"]'::jsonb, 'The child responds within a few seconds when you pause, and the conversation alternates rather than one person dominating. This happens in at least 8 out of 10 tries in a session. It happens in 3 sessions in a row.', '["Choose a topic the child likes.","Say something short, then stop and wait.","Let them fill the gap before you speak again.","Keep your turns as short as theirs."]'::jsonb,
  '{"english":"We practise back-and-forth conversation, keeping our turns short so your child has room to take theirs. Conversation is a rhythm, not a monologue.","hindi":""}'::jsonb, 'validated'::validation_status, 'v1-anant-approved',
  'Goal: help the child take turns talking, not just talk at you.', 'how much the child talks, and the back-and-forth', 'A structured conversation where you deliberately keep your turns short so the child has room to take theirs.', 'Conversation is a back-and-forth, not a monologue. Many children with autism either talk at length or say very little — both need the rhythm of turn-taking.', 'Balanced adult-child exchange, rather than adult-led talking, is a core principle of effective language support. Waiting is the most powerful tool.',
  'Early on the child may not respond, or may talk without stopping. It is going well when the exchange starts to alternate evenly and neither of you dominates.', 'The microphone separates the child''s voice from yours and records how much each of you spoke, and how quickly the child responded after you.', 'Shows the actual balance of the conversation — which is genuinely hard to judge in the moment, and often surprising.', 'The microphone measures who spoke and when, not what was said. It cannot tell whether the child stayed on topic — you judge the content.',
  'Conversational reciprocity. Framework: Hanen. Signal: makes_sounds (count, timing), adult-child balance.', 'The child responds within a few seconds when you pause, and the conversation alternates rather than one person dominating.', 8, 10, 3, 'voice'
) on conflict (id) do nothing;

-- AUT-19  Sharing in a Game  (9-12, cam_hands)
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
  'AUT-19', 'Sharing in a Game', 'NDBI'::framework_source, 'social_reciprocity'::activity_domain, '{autism}'::diagnostic_profile[],
  'established'::skill_level, 108, 155, 10,
  '["Building blocks, craft pieces, or puzzle parts"]'::jsonb, '["independent","gestural_cue","verbal_cue","hand_over_hand"]'::jsonb, 'The child hands a piece over when asked, without needing it taken from them. This happens in at least 8 out of 10 tries in a session. It happens in 3 sessions in a row.', '["Set up an activity with limited shared materials.","Give the child some, and keep some yourself.","Ask for a piece, and wait.","Praise every share, and share back generously."]'::jsonb,
  '{"english":"We build something together with shared pieces, so your child practises giving and receiving. Sharing is needed for school and for playing with friends.","hindi":""}'::jsonb, 'validated'::validation_status, 'v1-anant-approved',
  'Goal: help the child share materials during a game.', 'how many times items are handed over', 'A building or craft activity where the pieces are shared, so the child has to give and receive.', 'Sharing materials is a practical skill needed for school and playing with other children. It is concrete and easy for a child to understand.', 'Sharing is easier to learn inside a structured, motivating activity than as an abstract rule. Adults modelling generous sharing helps it stick.',
  'Early on the child may refuse or hold on to everything. It is going well when they hand pieces over when asked, and eventually offer them on their own.', 'The camera counts grasping and handing-over movements between you and the child.', 'Gives a count of actual sharing moments, so progress is visible rather than remembered.', 'The camera counts hand movements. It cannot tell willing sharing from reluctant giving — you judge that.',
  'Social reciprocity / sharing. Framework: NDBI. Signal: grasps_objects (count).', 'The child hands a piece over when asked, without needing it taken from them.', 8, 10, 3, 'cam_hands'
) on conflict (id) do nothing;

-- AUT-20  Show and Tell  (9-12, voice)
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
  'AUT-20', 'Show and Tell', 'ESDM'::framework_source, 'joint_attention'::activity_domain, '{autism}'::diagnostic_profile[],
  'mastery'::skill_level, 108, 155, 10,
  '["Something the child brings — a toy, drawing, or photo"]'::jsonb, '["independent","gestural_cue","verbal_cue","hand_over_hand"]'::jsonb, 'The child starts talking about their item without you asking a question first. This happens in at least 8 out of 10 tries in a session. It happens in 3 sessions in a row.', '["Ask the child to bring something they like.","Sit back and let them lead.","Wait before asking anything — give them space to start.","Show real interest in whatever they say."]'::jsonb,
  '{"english":"Your child brings something they love and tells us about it, while we stay quiet and listen. Starting a conversation is much harder than answering one.","hindi":""}'::jsonb, 'validated'::validation_status, 'v1-anant-approved',
  'Goal: help the child start a conversation on their own.', 'how often the child speaks up on their own', 'The child brings something meaningful to them and tells you about it, with you deliberately staying quiet so they lead.', 'Starting a conversation is much harder than answering one. This gives the child a low-pressure reason to begin, about something they care about.', 'Children initiate more when the topic is their own choice and the adult holds back. Reducing adult prompting is what creates room for the child to start.',
  'Early on the child may wait for you to ask everything. It is going well when they start talking without a prompt, and offer more than one thing on their own.', 'The microphone records the child''s sounds and speech, and separates what they said on their own from what came after you spoke.', 'Shows the shift from responding to initiating — the clearest sign that communication is becoming independent.', 'The microphone measures when the child spoke and whether it followed your speech. It does not understand what was said — content is your judgement.',
  'Initiating joint attention / conversation. Framework: ESDM. Signal: asks_on_own (spontaneous count).', 'The child starts talking about their item without you asking a question first.', 8, 10, 3, 'voice'
) on conflict (id) do nothing;

-- 0046 part 4 of 4 — activity to signal mappings
-- Run AFTER parts 1-3.

-- Activity to signal mappings. This is the link that was previously absent:
-- it records which signal each activity genuinely exposes.
insert into activity_signals (activity_id, attribute_id, is_primary) values
  ('AUT-01', 'looks_at_you', true),
  ('AUT-02', 'response_to_name', true),
  ('AUT-03', 'looks_at_you', true),
  ('AUT-04', 'points_at_things', true),
  ('AUT-05', 'reaches_for_things', true),
  ('AUT-05', 'looks_at_you', false),
  ('AUT-06', 'looks_at_you', true),
  ('AUT-07', 'claps_hands', true),
  ('AUT-07', 'waves', false),
  ('AUT-08', 'looks_at_you', true),
  ('AUT-09', 'looks_at_you', true),
  ('AUT-10', 'looks_at_you', true),
  ('AUT-11', 'points_at_things', true),
  ('AUT-11', 'grasps_objects', false),
  ('AUT-12', 'grasps_objects', true),
  ('AUT-13', 'points_at_things', true),
  ('AUT-13', 'makes_sounds', false),
  ('AUT-14', 'looks_at_you', true),
  ('AUT-15', 'waves', true),
  ('AUT-16', 'grasps_objects', true),
  ('AUT-16', 'stays_activity', false),
  ('AUT-17', 'stays_activity', true),
  ('AUT-18', 'makes_sounds', true),
  ('AUT-19', 'grasps_objects', true),
  ('AUT-20', 'asks_on_own', true),
  ('AUT-20', 'makes_sounds', false)
on conflict (activity_id, attribute_id) do nothing;
