-- 0057 — ten activities for ages 9-12 across autism, ADHD, and speech delay.
-- The existing library skews young: 20 for ages 3-5, 18 for 6-8, only 12 for 9-12.
-- These use interests, peers, and real school situations rather than
-- younger games with larger objects.

-- AUT-21  Talking About Their Interest  (9-12, voice)
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
  'AUT-21', 'Talking About Their Interest', 'ESDM'::framework_source, 'social_reciprocity'::activity_domain, '{autism}'::diagnostic_profile[],
  'mastery'::skill_level, 108, 155, 15,
  '[]'::jsonb, '["independent","gestural_cue","verbal_cue","hand_over_hand"]'::jsonb, 'The child asks you a question about your topic and listens to the answer. This happens in at least 8 out of 10 tries in a session. It happens in 3 sessions in a row.', '["Ask about something they care deeply about.","Let them talk without interrupting for a while.","Then share something of yours and see if they ask about it.","Aim for the exchange to go both ways."]'::jsonb,
  '{"english":"Your child talks about something they love, then we turn it around so they listen too. Both halves are needed for friendship.","hindi":""}'::jsonb, 'validated'::validation_status, 'v2-anant-approved',
  'Goal: help the child talk about their interest and then listen back.', 'how much each of you talks', 'The child talks about a strong interest, and then the conversation is turned so they have to listen and ask about yours.', 'Many autistic children can talk at length about an interest but find the listening half harder. Both halves are needed for friendship.', 'Starting with the child''s own interest gets them talking freely. The skill being built is the turn where the conversation moves to someone else.',
  'Early on the child may talk without pause and show no interest in your turn. It is going well when they pause, ask you something, and stay with your topic briefly.', 'The microphone separates your voice from theirs and records how much each of you spoke and how the turns alternated.', 'The talk balance shows objectively whether the conversation went both ways — which is very hard to judge while you are in it.', 'The microphone measures who spoke and when, not what was said or whether they were genuinely interested. You judge that.',
  'Conversational reciprocity. Framework: ESDM. Signal: makes_sounds (count, adult-child balance).', 'The child asks you a question about your topic and listens to the answer.', 8, 10, 3, 'voice'
) on conflict (id) do nothing;
-- AUT-22  Reading the Room  (9-12, cam_face)
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
  'AUT-22', 'Reading the Room', 'ESDM'::framework_source, 'social_reciprocity'::activity_domain, '{autism}'::diagnostic_profile[],
  'mastery'::skill_level, 108, 155, 10,
  '["Photos or short clips of everyday social situations"]'::jsonb, '["independent","gestural_cue","verbal_cue","hand_over_hand"]'::jsonb, 'The child explains what is happening and names the clue that told them. This happens in at least 8 out of 10 tries in a session. It happens in 3 sessions in a row.', '["Show a picture of a real social situation.","Ask what is going on between the people.","Ask how they can tell — what is the clue.","Talk through the clues they missed."]'::jsonb,
  '{"english":"We look at pictures of everyday situations and work out what is happening between people. Reading the room makes school easier to navigate.","hindi":""}'::jsonb, 'validated'::validation_status, 'v2-anant-approved',
  'Goal: help the child work out what is happening between people.', 'how long the child stays with the task', 'The child looks at pictures of everyday social situations and works out what is happening between the people and how they can tell.', 'Older autistic children often understand single emotions but miss the situation as a whole. Reading the room is what makes school and friendships navigable.', 'Moving from labelling a single face to interpreting a whole scene is the developmental step. Asking ''how can you tell'' makes the clues explicit rather than intuitive.',
  'Early on the child may describe what they see literally without interpreting it. It is going well when they name what is happening and can point to the clue.', 'The camera records how long the child stays focused on the pictures and their longest unbroken stretch of attention.', 'Shows whether the child can sustain attention on a socially demanding task, which is different from whether they know the answer.', 'The camera does NOT check their interpretation or whether it was right. You judge that. The camera measures focus only.',
  'Social cognition. Framework: ESDM. Signal: stays_activity. Interpretation is therapist-scored.', 'The child explains what is happening and names the clue that told them.', 8, 10, 3, 'cam_face'
) on conflict (id) do nothing;
-- AUT-23  Planning an Outing Together  (9-12, voice)
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
  'AUT-23', 'Planning an Outing Together', 'NDBI'::framework_source, 'social_reciprocity'::activity_domain, '{autism}'::diagnostic_profile[],
  'mastery'::skill_level, 108, 155, 15,
  '["Paper or a whiteboard"]'::jsonb, '["independent","gestural_cue","verbal_cue","hand_over_hand"]'::jsonb, 'The child offers ideas of their own and accepts at least one of yours. This happens in at least 8 out of 10 tries in a session. It happens in 3 sessions in a row.', '["Pick something to plan together — a trip, a party, a meal.","Take turns suggesting parts of it.","Let some of your ideas be chosen and some of theirs.","Keep it collaborative, not a quiz."]'::jsonb,
  '{"english":"We plan something together, taking turns to suggest ideas. Giving and taking in a plan is close to how friendships work.","hindi":""}'::jsonb, 'validated'::validation_status, 'v2-anant-approved',
  'Goal: help the child plan something jointly, giving and taking.', 'how often the child speaks up on their own', 'You and the child plan a real or imagined outing together, taking turns to suggest and agree on parts of it.', 'Joint planning needs the child to offer ideas, accept someone else''s, and reach agreement. It is close to how friendships actually work.', 'A shared goal creates genuine reason to negotiate. Letting some of the adult''s ideas be rejected keeps it real rather than a compliance exercise.',
  'Early on the child may insist on their own plan or agree to everything without engaging. It is going well when they offer ideas, accept some of yours, and build on them.', 'The microphone counts the child''s contributions and separates the ones they offered on their own from responses to your prompts.', 'Spontaneous contribution counts show whether the child is genuinely co-planning or just answering questions.', 'The microphone hears when the child spoke on their own. It does not know what they suggested or whether it was reasonable — you judge that.',
  'Social negotiation. Framework: NDBI. Signal: asks_on_own (spontaneous count).', 'The child offers ideas of their own and accepts at least one of yours.', 8, 10, 3, 'voice'
) on conflict (id) do nothing;
-- ADH-16  Organising a School Bag  (9-12, therapist_scored)
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
  'ADH-16', 'Organising a School Bag', 'BARKLEY_ADHD'::framework_source, 'attention_executive'::activity_domain, '{adhd}'::diagnostic_profile[],
  'mastery'::skill_level, 108, 155, 15,
  '["A school bag and its usual contents"]'::jsonb, '["independent","gestural_cue","verbal_cue","hand_over_hand"]'::jsonb, 'The child packs the bag using their own system without prompting. This happens in at least 8 out of 10 tries in a session. It happens in 3 sessions in a row.', '["Empty the bag out on the table.","Agree where each kind of thing should live.","Let them pack it themselves.","Tap whether they used the system and how much help was needed."]'::jsonb,
  '{"english":"We set up a system for the school bag and practise using it. Lost homework causes real trouble, and organising is a skill that can be taught.","hindi":""}'::jsonb, 'validated'::validation_status, 'v2-anant-approved',
  'Goal: help the child organise their things so they can find them.', 'you score each try · we record the time', 'The child empties and repacks a school bag using a system they helped design, so things can be found again.', 'Lost homework and forgotten books cause real trouble at school and at home. Organisation is a teachable skill, not a character trait.', 'A system the child designs is more likely to be used than one imposed on them. Repeated practice with the same system is what makes it automatic.',
  'Early on the child may pile things in or need each item directed. It is going well when they place things by the system without prompting and can find things afterwards.', 'You score each attempt by tapping — used the system, partially, or needed help. The platform records your scores and the time.', 'Prompt-level scoring shows whether organisation is becoming independent rather than something an adult drives.', 'The camera does NOT see the bag or where things went. You score it; the platform records your taps.',
  'Executive function / organisation. Framework: Barkley. Recorded: therapist-scored trials, prompt level.', 'The child packs the bag using their own system without prompting.', 8, 10, 3, 'therapist_scored'
) on conflict (id) do nothing;
-- ADH-17  Estimating How Long Things Take  (9-12, therapist_scored)
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
  'ADH-17', 'Estimating How Long Things Take', 'BARKLEY_ADHD'::framework_source, 'attention_executive'::activity_domain, '{adhd}'::diagnostic_profile[],
  'mastery'::skill_level, 108, 155, 15,
  '["Several short tasks","A timer"]'::jsonb, '["independent","gestural_cue","verbal_cue","hand_over_hand"]'::jsonb, 'The child''s estimate is within a close margin of the actual time, across several tasks. This happens in at least 8 out of 10 tries in a session. It happens in 3 sessions in a row.', '["Before a task, ask how many minutes they think it will take.","Write the guess down.","Time the task without commenting.","Compare guess and actual together afterwards."]'::jsonb,
  '{"english":"We guess how long a task will take, then time it and compare. Misjudging time is behind a lot of homework avoidance.","hindi":""}'::jsonb, 'validated'::validation_status, 'v2-anant-approved',
  'Goal: help the child judge how long a task will take.', 'you score each try · we record the time', 'The child estimates how long a task will take, then times it and compares the estimate with reality.', 'Children with ADHD often misjudge time badly — homework they think will take ten minutes takes an hour. Poor time estimation is behind a lot of avoidance.', 'Repeated guess-then-check builds an internal sense of duration. Comparing without criticism is what makes the child willing to keep guessing.',
  'Early on estimates may be wildly off in either direction. It is going well when guesses land closer to actual times across different tasks.', 'You score each attempt by tapping the estimate and the actual time. The platform records both and the activity duration.', 'Tracking estimate against actual over sessions shows whether time sense is genuinely improving — a number neither of you could hold otherwise.', 'The camera does NOT see the task. You record the estimate and the outcome; the platform stores them and times the work.',
  'Executive function / time estimation. Framework: Barkley. Recorded: therapist-scored trials, estimate versus actual.', 'The child''s estimate is within a close margin of the actual time, across several tasks.', 8, 10, 3, 'therapist_scored'
) on conflict (id) do nothing;
-- ADH-18  Working Through Distraction  (9-12, cam_face)
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
  'ADH-18', 'Working Through Distraction', 'BARKLEY_ADHD'::framework_source, 'attention_executive'::activity_domain, '{adhd}'::diagnostic_profile[],
  'mastery'::skill_level, 108, 155, 15,
  '["A task the child can do","A mild controlled distraction"]'::jsonb, '["independent","gestural_cue","verbal_cue","hand_over_hand"]'::jsonb, 'The child returns to the task on their own after each distraction without being reminded. This happens in at least 8 out of 10 tries in a session. It happens in 3 sessions in a row.', '["Set a task the child can manage at the table.","Introduce a mild distraction — background sound, movement nearby.","Let them work without reminding them to focus.","Talk afterwards about what pulled them away."]'::jsonb,
  '{"english":"We practise working with a mild distraction present. Classrooms are noisy, and working only in silence does not prepare your child for that.","hindi":""}'::jsonb, 'validated'::validation_status, 'v2-anant-approved',
  'Goal: help the child keep working when something else is happening.', 'how long the child stays with the task', 'The child works on a task while a controlled, mild distraction is present, and reflects afterwards on what drew their attention.', 'Classrooms are noisy and full of movement. Working only in silence does not prepare a child for where they actually have to concentrate.', 'Distraction is introduced gradually and kept mild. Reflecting afterwards builds awareness of their own triggers, which is what allows self-management later.',
  'Early on the child may stop entirely when distracted. It is going well when they return to the task themselves, and stay longer before being pulled away.', 'The camera records how long the child stays focused at the table and their longest unbroken stretch despite the distraction.', 'On-task duration under distraction is a much more realistic measure than focus in a silent room, and it is directly comparable across sessions.', 'The camera measures where the child is looking, not whether they were thinking about the work. You confirm real engagement.',
  'Sustained attention under load. Framework: Barkley. Signal: stays_activity (duration).', 'The child returns to the task on their own after each distraction without being reminded.', 8, 10, 3, 'cam_face'
) on conflict (id) do nothing;
-- ADH-19  Finishing What You Start  (9-12, therapist_scored)
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
  'ADH-19', 'Finishing What You Start', 'BARKLEY_ADHD'::framework_source, 'attention_executive'::activity_domain, '{adhd}'::diagnostic_profile[],
  'mastery'::skill_level, 108, 155, 15,
  '["A multi-session project"]'::jsonb, '["independent","gestural_cue","verbal_cue","hand_over_hand"]'::jsonb, 'The child resumes the project at the right point without being reminded what it was. This happens in at least 8 out of 10 tries in a session. It happens in 3 sessions in a row.', '["Start a project that cannot be finished in one session.","At the end, agree where to pick up next time.","Next session, ask them to continue without re-explaining.","Tap whether they remembered and resumed on their own."]'::jsonb,
  '{"english":"We work on a project across several sessions so your child practises returning to it. Real schoolwork needs coming back to things across days.","hindi":""}'::jsonb, 'validated'::validation_status, 'v2-anant-approved',
  'Goal: help the child return to and finish something started earlier.', 'you score each try · we record the time', 'A project spanning several sessions, where the child must remember where they were and pick it up again.', 'Starting is easy and finishing is hard. Real school work — projects, assignments, reading a book — needs returning to something across days.', 'Multi-session tasks test whether the child can hold a goal over time, which single-session tasks never reveal. Agreeing the resume point makes returning possible.',
  'Early on the child may not remember the project or want to start something new. It is going well when they recall it, resume at the right point, and see it through.', 'You score each session by tapping — remembered independently, needed a reminder, or needed re-explaining. The platform records your scores and the time.', 'Session-to-session records show whether the child is holding a goal across days, which is the actual skill being built.', 'The camera does NOT see the project or what was done. You score it; the platform records what you tap.',
  'Executive function / goal persistence. Framework: Barkley. Recorded: therapist-scored trials across sessions.', 'The child resumes the project at the right point without being reminded what it was.', 8, 10, 3, 'therapist_scored'
) on conflict (id) do nothing;
-- SPE-16  Explaining How to Do Something  (9-12, voice)
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
  'SPE-16', 'Explaining How to Do Something', 'HANEN'::framework_source, 'expressive_language'::activity_domain, '{speech_delay}'::diagnostic_profile[],
  'mastery'::skill_level, 108, 155, 15,
  '["Something the child knows how to do"]'::jsonb, '["independent","gestural_cue","verbal_cue","hand_over_hand"]'::jsonb, 'The child explains the process completely enough that you can follow it without getting stuck. This happens in at least 8 out of 10 tries in a session. It happens in 3 sessions in a row.', '["Ask them to teach you something they know how to do.","Follow their instructions exactly as given.","When it goes wrong, let them notice and correct.","Do not fill in the steps they miss."]'::jsonb,
  '{"english":"Your child teaches us something they know while we follow exactly what they say. Missing steps become obvious to them, which teaches better than being told.","hindi":""}'::jsonb, 'validated'::validation_status, 'v2-anant-approved',
  'Goal: help the child explain a process clearly, in order.', 'how much the child talks', 'The child explains how to do something they know, while you follow their instructions literally so gaps become obvious.', 'Explaining a process needs clear sequencing and enough detail for a listener. It is a demanding use of language and it shows up in every subject at school.', 'Following instructions literally makes missing steps visible to the child themselves, which teaches better than being told they were unclear.',
  'Early on the child may skip steps or assume you know things. It is going well when their instructions get complete enough for you to follow without failing.', 'The microphone records how much the child spoke in total and the balance between your voice and theirs.', 'Total talk time shows whether the child is producing extended connected language rather than short answers.', 'The microphone measures how much was said, not whether the explanation was clear or complete. That is your judgement.',
  'Expository language. Framework: Hanen. Signal: makes_sounds (duration, adult-child balance).', 'The child explains the process completely enough that you can follow it without getting stuck.', 8, 10, 3, 'voice'
) on conflict (id) do nothing;
-- SPE-17  Disagreeing Politely  (9-12, voice)
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
  'SPE-17', 'Disagreeing Politely', 'HANEN'::framework_source, 'expressive_language'::activity_domain, '{speech_delay}'::diagnostic_profile[],
  'mastery'::skill_level, 108, 155, 10,
  '[]'::jsonb, '["independent","gestural_cue","verbal_cue","hand_over_hand"]'::jsonb, 'The child says they disagree and gives a reason, without the exchange breaking down. This happens in at least 8 out of 10 tries in a session. It happens in 3 sessions in a row.', '["Say something you know they will disagree with.","Wait for their response.","Model a polite disagreement if needed — ''I see it differently because...''","Practise a few rounds on light topics."]'::jsonb,
  '{"english":"We practise disagreeing politely on light topics. This language is usually picked up incidentally, and without it children either agree with everything or fall out.","hindi":""}'::jsonb, 'validated'::validation_status, 'v2-anant-approved',
  'Goal: help the child say they disagree without conflict.', 'the back-and-forth between you', 'Light-hearted disagreements are set up deliberately so the child can practise saying they think differently, and giving a reason.', 'Disagreeing without conflict needs specific language most children pick up incidentally. Without it a child either goes along with everything or falls out.', 'Practising on genuinely trivial topics removes the emotional stakes, so the child can focus on the phrasing rather than the argument.',
  'Early on the child may agree regardless, or object flatly with no reason. It is going well when they state a different view and give a reason for it.', 'The microphone records how the turns alternated between you and how quickly the child responded.', 'Turn alternation shows whether the exchange stayed a conversation rather than becoming one-sided.', 'The microphone measures who spoke and when, not what was said or how politely. You judge the phrasing.',
  'Pragmatic language / assertion. Framework: Hanen. Signal: makes_sounds (turn alternation, latency).', 'The child says they disagree and gives a reason, without the exchange breaking down.', 8, 10, 3, 'voice'
) on conflict (id) do nothing;
-- SPE-18  Asking for What You Need at School  (9-12, voice)
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
  'SPE-18', 'Asking for What You Need at School', 'HANEN'::framework_source, 'expressive_language'::activity_domain, '{speech_delay}'::diagnostic_profile[],
  'mastery'::skill_level, 108, 155, 10,
  '[]'::jsonb, '["independent","gestural_cue","verbal_cue","hand_over_hand"]'::jsonb, 'The child asks for what they need without prompting, in each practised situation. This happens in at least 8 out of 10 tries in a session. It happens in 3 sessions in a row.', '["Set up a school situation — not understanding, missing a book, needing the toilet.","Play the teacher and wait.","Let them find the words rather than supplying them.","Practise the same situations until the words come easily."]'::jsonb,
  '{"english":"We role-play school situations so your child practises asking a teacher for help. Not being able to ask holds children back for reasons unrelated to ability.","hindi":""}'::jsonb, 'validated'::validation_status, 'v2-anant-approved',
  'Goal: help the child ask for help in a school situation.', 'how often the child speaks up on their own', 'Common school situations are role-played so the child practises asking for what they need from a teacher.', 'A child who cannot ask a teacher for help falls behind for reasons that have nothing to do with ability. These are a small number of high-value phrases.', 'Role-play with a familiar adult lowers the stakes enough to practise. Repeating the same situations makes the phrases automatic rather than composed each time.',
  'Early on the child may say nothing or wait to be noticed. It is going well when they ask clearly and without long hesitation, in more situations.', 'The microphone counts the child''s vocalisations and separates the ones they initiated from responses to your prompts.', 'Spontaneous asking counts show whether the child is initiating rather than waiting to be asked — the whole point of this skill.', 'The microphone hears that the child spoke on their own. It does not know whether they asked appropriately — you judge that.',
  'Functional communication / self-advocacy. Framework: Hanen. Signal: asks_on_own (spontaneous count).', 'The child asks for what they need without prompting, in each practised situation.', 8, 10, 3, 'voice'
) on conflict (id) do nothing;

-- signal mappings
insert into activity_signals (activity_id, attribute_id, is_primary) values
  ('AUT-21', 'makes_sounds', true),
  ('AUT-22', 'stays_activity', true),
  ('AUT-23', 'asks_on_own', true),
  ('ADH-16', 'follows_instruction', true),
  ('ADH-17', 'follows_instruction', true),
  ('ADH-18', 'stays_activity', true),
  ('ADH-19', 'follows_instruction', true),
  ('SPE-16', 'makes_sounds', true),
  ('SPE-17', 'makes_sounds', true),
  ('SPE-18', 'asks_on_own', true)
on conflict (activity_id, attribute_id) do nothing;
