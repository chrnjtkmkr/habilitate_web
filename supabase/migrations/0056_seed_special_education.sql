-- 0056 part 1 of 2 — special education activities (SPE-ED-01 to SPE-ED-08)
-- Mixed measurement: table work at the camera is genuinely measured;
-- reading and writing accuracy is therapist-scored.
-- Framework: IEP (RPwD Act / NEP 2020) / general practice.

-- SPE-ED-01  Sorting by One Rule  (3-5, cam_face)
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
  'SPE-ED-01', 'Sorting by One Rule', 'IEP_FRAMEWORK'::framework_source, 'attention_executive'::activity_domain, '{global_developmental_delay}'::diagnostic_profile[],
  'emerging'::skill_level, 36, 71, 10,
  '["Objects that differ by one thing — colour, size, or shape"]'::jsonb, '["independent","gestural_cue","verbal_cue","hand_over_hand"]'::jsonb, 'The child sorts the whole pile correctly by the given rule without direction. This happens in at least 8 out of 10 tries in a session. It happens in 3 sessions in a row.', '["Put out two trays and a pile of objects at the table.","Show one sort — ''red here, blue there''.","Let the child continue on their own.","Check together at the end."]'::jsonb,
  '{"english":"We sort objects by one rule at a time. Sorting is the base of all later learning about letters, numbers, and categories.","hindi":""}'::jsonb, 'validated'::validation_status, 'v2-anant-approved',
  'Goal: help the child sort things by one rule.', 'how long the child stays with the task', 'A table sorting task where objects are grouped by a single property, done at the camera so attention can be tracked.', 'Sorting is the base of all later classifying — letters, numbers, categories. A child who can sort by one rule can learn to sort by two.', 'Single-rule sorting develops before multi-rule. Concrete objects come before pictures, and pictures before abstract symbols.',
  'Early on the child may put things anywhere or need each one directed. It is going well when they sort correctly on their own and finish the pile without reminders.', 'The camera records how long the child stays focused on the table task and their longest unbroken stretch of attention.', 'Attention duration during a thinking task shows whether the child can sustain focus long enough to actually learn from it.', 'The camera does NOT check whether the sorting was correct. It measures focus, not accuracy. You check the sorting.',
  'Pre-academic classification. Framework: IEP, RPwD Act / NEP 2020. Signal: stays_activity (duration). Accuracy is therapist-scored.', 'The child sorts the whole pile correctly by the given rule without direction.', 8, 10, 3, 'cam_face'
) on conflict (id) do nothing;
-- SPE-ED-02  Matching Pictures to Objects  (3-5, cam_face)
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
  'SPE-ED-02', 'Matching Pictures to Objects', 'IEP_FRAMEWORK'::framework_source, 'receptive_language'::activity_domain, '{global_developmental_delay}'::diagnostic_profile[],
  'emerging'::skill_level, 36, 71, 10,
  '["Everyday objects and their picture cards"]'::jsonb, '["independent","gestural_cue","verbal_cue","hand_over_hand"]'::jsonb, 'The child matches each picture to its object correctly without prompting. This happens in at least 8 out of 10 tries in a session. It happens in 3 sessions in a row.', '["Lay out three objects and their picture cards at the table.","Hold up one card and ask them to find the object.","Give time before helping.","Swap in new pairs as they succeed."]'::jsonb,
  '{"english":"We match pictures to real objects. Understanding that a picture stands for a real thing is what every schoolbook depends on.","hindi":""}'::jsonb, 'validated'::validation_status, 'v2-anant-approved',
  'Goal: help the child match a picture to the real thing.', 'how long the child stays with the task', 'The child matches picture cards to the real objects they represent, at the table.', 'Understanding that a picture stands for a real thing is a big cognitive step. Everything in a schoolbook depends on it.', 'Object-to-object matching comes first, then object-to-picture, then picture-to-picture. Each step is practised until secure.',
  'Early on the child may pick at random or hold the card without looking. It is going well when they scan the objects and choose correctly, with more pairs.', 'The camera records how long the child stays focused on the table and their longest unbroken stretch of attention.', 'Shows whether the child can hold focus through a matching task, alongside your record of how many they got right.', 'The camera does NOT check which object the child chose or whether it matched. You score accuracy. The camera measures focus only.',
  'Symbolic representation / pre-literacy. Framework: IEP, RPwD Act / NEP 2020. Signal: stays_activity. Accuracy is therapist-scored.', 'The child matches each picture to its object correctly without prompting.', 8, 10, 3, 'cam_face'
) on conflict (id) do nothing;
-- SPE-ED-03  Pincer Grip Practice  (3-5, cam_hands)
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
  'SPE-ED-03', 'Pincer Grip Practice', 'GENERAL_PRACTICE'::framework_source, 'fine_motor'::activity_domain, '{global_developmental_delay}'::diagnostic_profile[],
  'emerging'::skill_level, 36, 71, 10,
  '["Small objects — beads, pegs, dry pasta","A container"]'::jsonb, '["independent","gestural_cue","verbal_cue","hand_over_hand"]'::jsonb, 'The child picks up objects with finger and thumb rather than the whole hand, throughout the task. This happens in at least 8 out of 10 tries in a session. It happens in 3 sessions in a row.', '["Put small objects and a container on the table, near the camera.","Show picking one up with finger and thumb.","Let them fill the container their own way.","Encourage finger-thumb rather than a whole-hand grab."]'::jsonb,
  '{"english":"We practise picking up small things with finger and thumb. This grip is what holds a pencil, and handwriting depends on it.","hindi":""}'::jsonb, 'validated'::validation_status, 'v2-anant-approved',
  'Goal: help the child pick up small things with finger and thumb.', 'how the child picks things up', 'The child picks up small objects one at a time using finger and thumb, dropping them into a container.', 'The pincer grip is what holds a pencil. Without it, handwriting is slow and tiring no matter how much the child practises letters.', 'Grip strength and precision build through repetition with objects small enough to require the pincer. Larger objects allow a whole-hand grab and do not train it.',
  'Early on the child may rake objects with the whole hand. It is going well when finger and thumb are used consistently and the movement gets quicker.', 'The camera recognises hand shapes and counts pincer grasps as distinct from whole-hand grabs.', 'Counting the pincer grip specifically shows whether the mature grasp is developing, not just whether the task was completed.', 'The camera counts hand shapes. It cannot judge how much force the child used or how tired their hand became. You judge that.',
  'Fine motor / pincer grasp. Framework: general practice. Signal: grasps_objects (pincer count).', 'The child picks up objects with finger and thumb rather than the whole hand, throughout the task.', 8, 10, 3, 'cam_hands'
) on conflict (id) do nothing;
-- SPE-ED-04  Tracing Lines and Shapes  (3-5, cam_hands)
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
  'SPE-ED-04', 'Tracing Lines and Shapes', 'GENERAL_PRACTICE'::framework_source, 'fine_motor'::activity_domain, '{global_developmental_delay}'::diagnostic_profile[],
  'emerging'::skill_level, 36, 71, 10,
  '["Tracing sheets","Thick crayons or markers"]'::jsonb, '["independent","gestural_cue","verbal_cue","hand_over_hand"]'::jsonb, 'The child traces the shape staying on or close to the line, without hand-over-hand help. This happens in at least 8 out of 10 tries in a session. It happens in 3 sessions in a row.', '["Put a tracing sheet on the table, near the camera.","Show tracing one line slowly.","Let them trace, hand over hand only if needed.","Move from straight lines to curves to shapes."]'::jsonb,
  '{"english":"We trace lines and shapes. Every letter is made of these lines and curves, so tracing comes before writing.","hindi":""}'::jsonb, 'validated'::validation_status, 'v2-anant-approved',
  'Goal: help the child trace lines and simple shapes.', 'hand movement and how long they stay with it', 'The child traces printed lines and shapes with a crayon, progressing from straight lines to curves.', 'Tracing teaches the hand to follow a path under the eye''s direction. Every letter is a combination of the lines and curves practised here.', 'Pre-writing shapes develop in a known order — vertical, horizontal, circle, cross, square, triangle. Each is practised before the next.',
  'Early on the line may wander far off or the child may scribble. It is going well when the trace stays closer to the line and the hand moves more smoothly.', 'The camera counts hand and grip activity and records how long the child stays engaged with the task.', 'Hand activity plus attention time shows both how much work was done and whether the child could sustain it.', 'The camera does NOT see the paper or judge how accurate the tracing was. You judge the line quality. The camera measures hand movement and focus.',
  'Pre-writing / visual-motor. Framework: general practice. Signal: grasps_objects, stays_activity. Line quality is therapist-scored.', 'The child traces the shape staying on or close to the line, without hand-over-hand help.', 8, 10, 3, 'cam_hands'
) on conflict (id) do nothing;
-- SPE-ED-05  Following Two-Step Class Instructions  (3-5, therapist_scored)
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
  'SPE-ED-05', 'Following Two-Step Class Instructions', 'IEP_FRAMEWORK'::framework_source, 'receptive_language'::activity_domain, '{global_developmental_delay}'::diagnostic_profile[],
  'emerging'::skill_level, 36, 71, 10,
  '["Classroom-type objects — book, bag, pencil"]'::jsonb, '["independent","gestural_cue","verbal_cue","hand_over_hand"]'::jsonb, 'The child completes both parts in order after hearing the instruction once. This happens in at least 8 out of 10 tries in a session. It happens in 3 sessions in a row.', '["Give a two-part instruction — ''put the book away, then sit down''.","Say it once, at normal speed.","Wait and watch what they do.","Tap: both parts in order, part of it, or needed help."]'::jsonb,
  '{"english":"We practise following the kind of two-part instruction a teacher gives to the whole class. School runs on these.","hindi":""}'::jsonb, 'validated'::validation_status, 'v2-anant-approved',
  'Goal: help the child follow the kind of instruction a teacher gives.', 'you score each try · we record the time', 'Two-part instructions using classroom objects and routines, given once at normal pace as a teacher would.', 'School runs on instructions given once to a whole group. A child who cannot follow them misses the lesson regardless of ability.', 'Practising with real classroom language and objects transfers better than abstract tasks. Instructions are given once, as they would be in class.',
  'Early on the child may do only the first part or wait for repetition. It is going well when both parts are done in order after one telling.', 'You score each try by tapping — both parts, partial, or needed help. The platform records your scores and the activity time.', 'Prompt-level scoring across sessions shows whether the child is becoming able to manage classroom instructions independently.', 'The camera does NOT check whether the instruction was followed. You score it; the platform records what you tap.',
  'Receptive language / classroom readiness. Framework: IEP, RPwD Act / NEP 2020. Recorded: therapist-scored trials, prompt level.', 'The child completes both parts in order after hearing the instruction once.', 8, 10, 3, 'therapist_scored'
) on conflict (id) do nothing;
-- SPE-ED-06  Letter Sound Recognition  (6-8, cam_face)
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
  'SPE-ED-06', 'Letter Sound Recognition', 'IEP_FRAMEWORK'::framework_source, 'receptive_language'::activity_domain, '{specific_learning_disability}'::diagnostic_profile[],
  'established'::skill_level, 72, 107, 10,
  '["Letter cards"]'::jsonb, '["independent","gestural_cue","verbal_cue","hand_over_hand"]'::jsonb, 'The child identifies the correct letter for each sound in the current set, without prompting. This happens in at least 8 out of 10 tries in a session. It happens in 3 sessions in a row.', '["Lay out three or four letter cards at the table.","Say a sound and ask them to find the letter.","Give time — do not rush the answer.","Add letters as they become secure."]'::jsonb,
  '{"english":"We link letters to their sounds. This is the single most important skill in learning to read.","hindi":""}'::jsonb, 'validated'::validation_status, 'v2-anant-approved',
  'Goal: help the child link letters to their sounds.', 'how long the child stays with the task', 'The child matches spoken sounds to printed letters, working with a small set that grows as they succeed.', 'Linking sound to letter is the single most important skill in learning to read. Difficulty here is the core of dyslexia.', 'Sound-letter correspondence is taught with a small set at a time, mastered before adding more. Confusable letters are separated rather than taught together.',
  'Early on the child may guess or confuse similar letters. It is going well when they find the right letter more often, faster, and hold more letters at once.', 'The camera records how long the child stays focused on the letters and their longest unbroken stretch of attention.', 'Sustained attention during letter work matters — a child who cannot hold focus on the cards cannot build the associations, whatever their ability.', 'The camera does NOT check which letter the child chose or whether it was right. You score accuracy. The camera measures focus only.',
  'Phonics / reading foundation. Framework: IEP, RPwD Act / NEP 2020. Signal: stays_activity. Accuracy is therapist-scored.', 'The child identifies the correct letter for each sound in the current set, without prompting.', 8, 10, 3, 'cam_face'
) on conflict (id) do nothing;
-- SPE-ED-07  Blending Sounds Into Words  (6-8, voice)
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
  'SPE-ED-07', 'Blending Sounds Into Words', 'IEP_FRAMEWORK'::framework_source, 'expressive_language'::activity_domain, '{specific_learning_disability}'::diagnostic_profile[],
  'established'::skill_level, 72, 107, 10,
  '["Letter cards or a whiteboard"]'::jsonb, '["independent","gestural_cue","verbal_cue","hand_over_hand"]'::jsonb, 'The child blends the sounds into the correct word without you saying it first. This happens in at least 8 out of 10 tries in a session. It happens in 3 sessions in a row.', '["Say a short word slowly, sound by sound — ''c... a... t''.","Ask the child what the word is.","Let them say the sounds themselves, then blend.","Move to longer words as they succeed."]'::jsonb,
  '{"english":"We practise joining separate sounds into a whole word. Blending is what turns knowing letters into actually reading.","hindi":""}'::jsonb, 'validated'::validation_status, 'v2-anant-approved',
  'Goal: help the child blend separate sounds into a word.', 'the child''s sounds and attempts', 'The child hears or says separate sounds and blends them into a whole word, starting with three-sound words.', 'Blending is what turns letter knowledge into reading. A child can know every letter sound and still not read until they can blend.', 'Blending is taught with continuous sounds before stop sounds, and three-sound words before longer ones. Saying the sounds aloud helps the blend.',
  'Early on the child may repeat the separate sounds without blending. It is going well when the whole word comes out and longer words can be managed.', 'The microphone counts the child''s vocal attempts and records whether they came on their own or after your model.', 'Shows whether the child is attempting the blend independently rather than repeating what you said.', 'The microphone hears that a sound was made. It does not recognise words or check whether the blend was correct — that is your judgement.',
  'Phonological blending. Framework: IEP, RPwD Act / NEP 2020. Signal: makes_sounds (count, spontaneity). Accuracy is therapist-scored.', 'The child blends the sounds into the correct word without you saying it first.', 8, 10, 3, 'voice'
) on conflict (id) do nothing;
-- SPE-ED-08  Copying Letters and Words  (6-8, cam_hands)
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
  'SPE-ED-08', 'Copying Letters and Words', 'GENERAL_PRACTICE'::framework_source, 'fine_motor'::activity_domain, '{specific_learning_disability}'::diagnostic_profile[],
  'established'::skill_level, 72, 107, 15,
  '["Ruled paper","Pencil","A model to copy"]'::jsonb, '["independent","gestural_cue","verbal_cue","hand_over_hand"]'::jsonb, 'The child copies the full model with letters on the line and consistent size. This happens in at least 8 out of 10 tries in a session. It happens in 3 sessions in a row.', '["Put ruled paper and a model at the table, near the camera.","Ask them to copy what they see, taking their time.","Watch the pencil grip, not just the result.","Check the work together at the end."]'::jsonb,
  '{"english":"We practise copying letters and words onto lined paper. Copying accurately is what makes writing quicker and less tiring later.","hindi":""}'::jsonb, 'validated'::validation_status, 'v2-anant-approved',
  'Goal: help the child copy letters and short words neatly.', 'hand movement and how long they stay with it', 'The child copies letters and short words from a model onto ruled paper, working at the table.', 'Copying accurately needs the eye to hold a shape and the hand to reproduce it. Difficulty here shows up as slow, effortful writing throughout school.', 'Copying develops before writing from memory. Ruled lines give the size and placement feedback the child needs.',
  'Early on letters may be uneven, oversized, or drift off the line. It is going well when size becomes consistent, letters sit on the line, and the child tires less.', 'The camera counts hand and grip activity and records how long the child stays engaged with the writing task.', 'Attention duration matters here — handwriting difficulty often shows as a child stopping early rather than writing badly. The time record makes that visible.', 'The camera does NOT see the paper or judge the letters. It measures hand activity and focus. You judge the handwriting.',
  'Handwriting / visual-motor integration. Framework: general practice. Signal: grasps_objects, stays_activity. Letter quality is therapist-scored.', 'The child copies the full model with letters on the line and consistent size.', 8, 10, 3, 'cam_hands'
) on conflict (id) do nothing;
-- 0056 part 2 of 2 — special education activities (SPE-ED-09 to SPE-ED-15) + signal mappings

-- SPE-ED-09  Counting Real Objects  (6-8, cam_face)
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
  'SPE-ED-09', 'Counting Real Objects', 'IEP_FRAMEWORK'::framework_source, 'attention_executive'::activity_domain, '{specific_learning_disability}'::diagnostic_profile[],
  'established'::skill_level, 72, 107, 10,
  '["Countable objects — blocks, buttons, counters"]'::jsonb, '["independent","gestural_cue","verbal_cue","hand_over_hand"]'::jsonb, 'The child counts the full set accurately, touching each object once. This happens in at least 8 out of 10 tries in a session. It happens in 3 sessions in a row.', '["Put a small group of objects at the table.","Ask the child to count them, touching each one.","Let them count without you counting along.","Increase the number as they become accurate."]'::jsonb,
  '{"english":"We count real objects, touching each one. Counting accurately is the base of all arithmetic.","hindi":""}'::jsonb, 'validated'::validation_status, 'v2-anant-approved',
  'Goal: help the child count objects accurately.', 'how long the child stays with the task', 'The child counts real objects by touching each one, with the quantity increased as accuracy grows.', 'Counting objects with one-to-one correspondence is the base of all arithmetic. Difficulty here is the core of dyscalculia.', 'One-to-one correspondence — one number word per object touched — is taught before counting on or counting in groups. Touching each object anchors it.',
  'Early on the child may skip objects, double-count, or recite numbers without matching. It is going well when each object is touched once and the total is right.', 'The camera records how long the child stays focused on the counting task and their longest unbroken stretch of attention.', 'Counting errors often come from losing focus mid-count. The attention record shows whether focus or number knowledge is the real difficulty.', 'The camera does NOT see the objects or check the count. You score accuracy. The camera measures focus only.',
  'Numeracy / one-to-one correspondence. Framework: IEP, RPwD Act / NEP 2020. Signal: stays_activity. Accuracy is therapist-scored.', 'The child counts the full set accurately, touching each object once.', 8, 10, 3, 'cam_face'
) on conflict (id) do nothing;
-- SPE-ED-10  Reading Simple Sentences  (6-8, voice)
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
  'SPE-ED-10', 'Reading Simple Sentences', 'IEP_FRAMEWORK'::framework_source, 'expressive_language'::activity_domain, '{specific_learning_disability}'::diagnostic_profile[],
  'established'::skill_level, 72, 107, 15,
  '["Short simple sentences on cards or in a book"]'::jsonb, '["independent","gestural_cue","verbal_cue","hand_over_hand"]'::jsonb, 'The child reads the sentence aloud without needing words supplied. This happens in at least 8 out of 10 tries in a session. It happens in 3 sessions in a row.', '["Show one short sentence at a time.","Ask the child to read it aloud at their own pace.","Wait rather than supplying the word.","Talk briefly about what it meant."]'::jsonb,
  '{"english":"Your child reads short sentences aloud while we wait rather than supplying words. Reading aloud shows exactly where the difficulty is.","hindi":""}'::jsonb, 'validated'::validation_status, 'v2-anant-approved',
  'Goal: help the child read a short sentence aloud.', 'how much the child reads aloud', 'The child reads short simple sentences aloud, with time given to work out words rather than being told them.', 'Reading aloud shows exactly where the difficulty is — decoding, fluency, or understanding. It also builds the confidence to try.', 'Waiting rather than supplying the word gives the child a chance to apply blending. Discussing the meaning afterwards keeps reading connected to sense.',
  'Early on the child may read word by word or stop at unfamiliar words. It is going well when reading flows more, fewer words stall them, and they can say what it meant.', 'The microphone records how much the child spoke and the balance between your voice and theirs.', 'Total reading time and the talk balance show whether the child is doing the reading or you are supplying most of it.', 'The microphone measures how much was said, not what. It cannot check whether words were read correctly — that is entirely your judgement.',
  'Reading fluency. Framework: IEP, RPwD Act / NEP 2020. Signal: makes_sounds (duration, adult-child balance). Accuracy is therapist-scored.', 'The child reads the sentence aloud without needing words supplied.', 8, 10, 3, 'voice'
) on conflict (id) do nothing;
-- SPE-ED-11  Sequencing a Story  (6-8, cam_face)
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
  'SPE-ED-11', 'Sequencing a Story', 'IEP_FRAMEWORK'::framework_source, 'attention_executive'::activity_domain, '{specific_learning_disability}'::diagnostic_profile[],
  'established'::skill_level, 72, 107, 10,
  '["Picture cards showing a simple sequence"]'::jsonb, '["independent","gestural_cue","verbal_cue","hand_over_hand"]'::jsonb, 'The child orders the full sequence correctly and can explain it. This happens in at least 8 out of 10 tries in a session. It happens in 3 sessions in a row.', '["Lay out three or four picture cards, shuffled.","Ask the child to put them in the order they happen.","Let them move the cards themselves.","Ask them to tell the story once ordered."]'::jsonb,
  '{"english":"We put picture cards in the order events happen. Understanding order underlies reading, writing, and explaining things.","hindi":""}'::jsonb, 'validated'::validation_status, 'v2-anant-approved',
  'Goal: help the child put events in the right order.', 'how long the child stays with the task', 'The child arranges shuffled picture cards into the correct sequence and then narrates the story.', 'Understanding that events have an order underlies reading comprehension, writing, and explaining what happened. It is needed across every subject.', 'Three-card sequences are mastered before four or five. Narrating afterwards checks that the order was understood rather than guessed.',
  'Early on the child may order randomly or focus on one card. It is going well when the sequence is right more often and they can explain why.', 'The camera records how long the child stays focused on the cards and their longest unbroken stretch of attention.', 'Shows whether the child can hold focus through a reasoning task, which is different from whether they know the answer.', 'The camera does NOT see the card order or check whether it was right. You score that. The camera measures focus only.',
  'Sequencing / comprehension. Framework: IEP, RPwD Act / NEP 2020. Signal: stays_activity. Accuracy is therapist-scored.', 'The child orders the full sequence correctly and can explain it.', 8, 10, 3, 'cam_face'
) on conflict (id) do nothing;
-- SPE-ED-12  Copying From the Board  (9-12, cam_face)
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
  'SPE-ED-12', 'Copying From the Board', 'IEP_FRAMEWORK'::framework_source, 'attention_executive'::activity_domain, '{specific_learning_disability}'::diagnostic_profile[],
  'mastery'::skill_level, 108, 155, 15,
  '["A whiteboard or chart at a distance","Paper and pencil"]'::jsonb, '["independent","gestural_cue","verbal_cue","hand_over_hand"]'::jsonb, 'The child copies the full text accurately without losing their place. This happens in at least 8 out of 10 tries in a session. It happens in 3 sessions in a row.', '["Write a few lines on a board across the room.","Ask the child to copy them onto paper at the table.","Do not repeat or read it aloud.","Check the copy together at the end."]'::jsonb,
  '{"english":"We practise copying from a board across the room. This is one of the most common school demands and one of the hardest.","hindi":""}'::jsonb, 'validated'::validation_status, 'v2-anant-approved',
  'Goal: help the child copy accurately from a distance.', 'how long the child stays with the task', 'The child copies text from a board at a distance onto paper, holding each chunk in mind while looking away.', 'Copying from the board is one of the most common school demands and one of the hardest for children with learning difficulties. It needs memory, tracking, and writing at once.', 'Near-point copying is mastered before far-point. The difficulty is holding the text in mind across the look away and back — a working memory demand, not just a writing one.',
  'Early on the child may copy letter by letter, lose their place, or leave words out. It is going well when they carry more per glance, keep their place, and finish faster.', 'The camera records how long the child stays engaged with the task and their longest unbroken stretch of focus at the table.', 'Board copying often fails through fatigue rather than inability. The attention record shows when the child stopped, not just what they produced.', 'The camera does NOT see the board or the paper and cannot check accuracy. You check the copy. The camera measures focus only.',
  'Far-point copying / working memory. Framework: IEP, RPwD Act / NEP 2020. Signal: stays_activity. Accuracy is therapist-scored.', 'The child copies the full text accurately without losing their place.', 8, 10, 3, 'cam_face'
) on conflict (id) do nothing;
-- SPE-ED-13  Breaking a Task Into Steps  (9-12, therapist_scored)
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
  'SPE-ED-13', 'Breaking a Task Into Steps', 'IEP_FRAMEWORK'::framework_source, 'attention_executive'::activity_domain, '{specific_learning_disability}'::diagnostic_profile[],
  'mastery'::skill_level, 108, 155, 15,
  '["A multi-part task — a worksheet, a craft, a tidy-up"]'::jsonb, '["independent","gestural_cue","verbal_cue","hand_over_hand"]'::jsonb, 'The child breaks the task into steps before starting and works through their own plan. This happens in at least 8 out of 10 tries in a session. It happens in 3 sessions in a row.', '["Give a task with several parts.","Before they start, ask what the steps are.","Let them plan it out loud or on paper.","Tap whether they planned, and whether they followed their plan."]'::jsonb,
  '{"english":"We practise breaking a task into steps before starting. Older children often struggle with schoolwork through planning, not ability.","hindi":""}'::jsonb, 'validated'::validation_status, 'v2-anant-approved',
  'Goal: help the child plan a task before starting it.', 'you score each try · we record the time', 'The child is given a multi-part task and asked to break it into steps before beginning, then to work through their own plan.', 'Older children fail at school work more often through poor planning than poor ability. Learning to break a task down is a skill that transfers everywhere.', 'Making the planning explicit and separate from the doing is what builds the habit. Writing the steps externalises what would otherwise have to be held in mind.',
  'Early on the child may start immediately without planning, or plan and then abandon it. It is going well when they plan first and work through their own steps.', 'You score each attempt by tapping — planned or not, followed the plan or not, and how much help was needed. The platform records your scores and the time.', 'Separating ''did they plan'' from ''did they follow it'' shows which half of the skill needs work, which a single score would hide.', 'The camera does NOT see the task or the plan. You score it; the platform records what you tap and times the work.',
  'Executive function / task planning. Framework: IEP, RPwD Act / NEP 2020. Recorded: therapist-scored trials, planning and follow-through.', 'The child breaks the task into steps before starting and works through their own plan.', 8, 10, 3, 'therapist_scored'
) on conflict (id) do nothing;
-- SPE-ED-14  Checking Your Own Work  (9-12, therapist_scored)
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
  'SPE-ED-14', 'Checking Your Own Work', 'IEP_FRAMEWORK'::framework_source, 'attention_executive'::activity_domain, '{specific_learning_disability}'::diagnostic_profile[],
  'mastery'::skill_level, 108, 155, 10,
  '["Completed work with a few deliberate errors"]'::jsonb, '["independent","gestural_cue","verbal_cue","hand_over_hand"]'::jsonb, 'The child finds the majority of the errors without being shown where they are. This happens in at least 8 out of 10 tries in a session. It happens in 3 sessions in a row.', '["Give the child a completed piece with a few errors in it.","Ask them to find and fix what is wrong.","Do not point to the errors.","Tap how many they found on their own."]'::jsonb,
  '{"english":"We practise finding mistakes in finished work. Checking your own work is rarely taught, and it turns a one-off slip into a lesson.","hindi":""}'::jsonb, 'validated'::validation_status, 'v2-anant-approved',
  'Goal: help the child find their own mistakes.', 'you score each try · we record the time', 'The child reviews completed work containing deliberate errors and finds them without being shown where they are.', 'Checking your own work is what separates a careless mistake from a repeated one. Most children with learning difficulties are never taught how.', 'Finding errors in someone else''s work is easier than in your own and is practised first. A known number of errors gives the child a target.',
  'Early on the child may declare it finished without looking or find only obvious errors. It is going well when they check systematically and find more.', 'You score each attempt by tapping how many errors were found. The platform records your scores and the activity time.', 'Error-found counts across sessions show whether self-checking is becoming a habit rather than something you have to ask for.', 'The camera does NOT see the work or the corrections. You score it; the platform records what you tap.',
  'Executive function / self-monitoring. Framework: IEP, RPwD Act / NEP 2020. Recorded: therapist-scored trials, errors found.', 'The child finds the majority of the errors without being shown where they are.', 8, 10, 3, 'therapist_scored'
) on conflict (id) do nothing;
-- SPE-ED-15  Working to a Time Limit  (9-12, cam_face)
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
  'SPE-ED-15', 'Working to a Time Limit', 'IEP_FRAMEWORK'::framework_source, 'attention_executive'::activity_domain, '{specific_learning_disability}'::diagnostic_profile[],
  'mastery'::skill_level, 108, 155, 15,
  '["A short task","A visible timer"]'::jsonb, '["independent","gestural_cue","verbal_cue","hand_over_hand"]'::jsonb, 'The child completes the agreed amount within the time without needing reminders. This happens in at least 8 out of 10 tries in a session. It happens in 3 sessions in a row.', '["Set a short task and a visible timer at the table.","Agree what should be finished before it ends.","Let them work — do not remind them of the time.","Review together what was managed."]'::jsonb,
  '{"english":"We practise working steadily against a visible timer. School work is timed, and pacing is a skill of its own.","hindi":""}'::jsonb, 'validated'::validation_status, 'v2-anant-approved',
  'Goal: help the child work steadily within a set time.', 'how long the child stays with the task', 'The child works on a task with a visible timer running, aiming to complete an agreed amount before it ends.', 'School work is timed — lessons, tests, homework. A child who cannot pace themselves runs out of time regardless of what they know.', 'A visible timer externalises time, which children with learning difficulties often judge poorly. Reviewing afterwards builds awareness of their own pace.',
  'Early on the child may rush and make errors, or work slowly and not finish. It is going well when the pace steadies and more is completed accurately in the time.', 'The camera records how long the child stays focused at the table and their longest unbroken stretch of work.', 'On-task time against the clock shows whether the child is actually working through the period or losing stretches of it.', 'The camera measures focus at the table, not what was produced or whether it was right. You judge the work.',
  'Executive function / time management. Framework: IEP, RPwD Act / NEP 2020. Signal: stays_activity (duration). Output is therapist-scored.', 'The child completes the agreed amount within the time without needing reminders.', 8, 10, 3, 'cam_face'
) on conflict (id) do nothing;

-- special education signal mappings
insert into activity_signals (activity_id, attribute_id, is_primary) values
  ('SPE-ED-01', 'stays_activity', true),
  ('SPE-ED-02', 'stays_activity', true),
  ('SPE-ED-03', 'grasps_objects', true),
  ('SPE-ED-04', 'grasps_objects', true),
  ('SPE-ED-04', 'stays_activity', false),
  ('SPE-ED-05', 'follows_instruction', true),
  ('SPE-ED-06', 'stays_activity', true),
  ('SPE-ED-07', 'makes_sounds', true),
  ('SPE-ED-08', 'grasps_objects', true),
  ('SPE-ED-08', 'stays_activity', false),
  ('SPE-ED-09', 'stays_activity', true),
  ('SPE-ED-10', 'makes_sounds', true),
  ('SPE-ED-11', 'stays_activity', true),
  ('SPE-ED-12', 'stays_activity', true),
  ('SPE-ED-13', 'follows_instruction', true),
  ('SPE-ED-14', 'follows_instruction', true),
  ('SPE-ED-15', 'stays_activity', true)
on conflict (activity_id, attribute_id) do nothing;
