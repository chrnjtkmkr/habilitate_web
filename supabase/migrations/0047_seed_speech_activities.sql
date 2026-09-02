-- 0047 part 1 of 2 — speech delay activities (SPE-01 to SPE-08)

-- SPE-01  Copy My Sound  (3-5, voice)
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
  'SPE-01', 'Copy My Sound', 'HANEN'::framework_source, 'expressive_language'::activity_domain, '{speech_delay}'::diagnostic_profile[],
  'emerging'::skill_level, 36, 71, 5,
  '[]'::jsonb, '["independent","gestural_cue","verbal_cue","hand_over_hand"]'::jsonb, 'The child makes a sound back after you model one, without extra prompting. This happens in at least 8 out of 10 tries in a session. It happens in 3 sessions in a row.', '["Sit facing the child, close and playful.","Make a big, fun sound — ''wheee'', ''uh-oh'', ''boom''.","Pause and look expectant. Wait.","Celebrate any sound they make back."]'::jsonb,
  '{"english":"We make fun sounds and wait for your child to copy. Copying sounds is the first step towards copying words.","hindi":""}'::jsonb, 'validated'::validation_status, 'v1-anant-approved',
  'Goal: help the child copy sounds you make.', 'the child''s sounds, and if they came on their own', 'A playful sound game where you make an exaggerated noise and wait for the child to copy it.', 'Copying sounds is the first step towards copying words. Children who copy sounds more often start talking sooner.', 'Vocal imitation is a foundation of expressive language. Making the sound fun and exaggerated, then waiting, is the standard way to draw it out.',
  'At first the child may just watch or smile. It is going well when they start making sounds back, and when the sounds get closer to yours.', 'The microphone counts the child''s sounds and records how long each one lasted. It also notes whether the sound came after yours or on their own.', 'Shows whether the child is vocalising more over time, which is the earliest sign that speech is coming.', 'The microphone hears that a sound happened. It does not recognise which sound it was or how accurate the copy was — you judge that.',
  'Vocal imitation. Framework: Hanen. Signal: makes_sounds (count, duration, prompted vs spontaneous).', 'The child makes a sound back after you model one, without extra prompting.', 8, 10, 3, 'voice'
) on conflict (id) do nothing;
-- SPE-02  Asking With Their Voice  (3-5, voice)
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
  'SPE-02', 'Asking With Their Voice', 'HANEN'::framework_source, 'expressive_language'::activity_domain, '{speech_delay}'::diagnostic_profile[],
  'emerging'::skill_level, 36, 71, 5,
  '["2 or 3 items the child really likes"]'::jsonb, '["independent","gestural_cue","verbal_cue","hand_over_hand"]'::jsonb, 'The child makes a sound to ask, on their own, before you say the word. This happens in at least 8 out of 10 tries in a session. It happens in 3 sessions in a row.', '["Hold something the child really likes where they can see it.","Wait for any sound at all — not a perfect word.","The moment they make a sound, give it to them and smile.","Repeat with different things they like."]'::jsonb,
  '{"english":"We hold something your child wants and wait for them to use their voice. Learning that a sound gets you what you want is the foundation of speech.","hindi":""}'::jsonb, 'validated'::validation_status, 'v1-anant-approved',
  'Goal: teach the child that making a sound gets them what they want.', 'the child''s sounds — and if they came on their own', 'You hold something the child wants and wait for them to use their voice before giving it. Any sound counts.', 'Asking for something is the easiest and most motivating reason for a child to speak. When a sound instantly gets them what they want, they learn their voice works.', 'Asking for things is the first kind of communication most children learn, because the reward is built in. Rewarding any sound straight away is a well-proven way to start early speech.',
  'At first the child may just reach silently, or only make a sound after you say the word. It is going well when they start making a sound on their own before reaching.', 'The microphone counts the child''s sounds and separates the ones they made on their own from the ones that came after you spoke. It also times the gap between your words and their reply.', 'Shows the shift from prompted to spontaneous — the real sign that communication is developing.', 'The microphone hears that a sound happened and when. It does not recognise words or judge pronunciation — that is your judgement.',
  'Requesting / manding. Framework: Hanen, NDBI. Signal: asks_on_own (spontaneous count), makes_sounds.', 'The child makes a sound to ask, on their own, before you say the word.', 8, 10, 3, 'voice'
) on conflict (id) do nothing;
-- SPE-03  Animal Sound Game  (3-5, voice)
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
  'SPE-03', 'Animal Sound Game', 'HANEN'::framework_source, 'expressive_language'::activity_domain, '{speech_delay}'::diagnostic_profile[],
  'emerging'::skill_level, 36, 71, 5,
  '["Animal toys or picture cards"]'::jsonb, '["independent","gestural_cue","verbal_cue","hand_over_hand"]'::jsonb, 'The child makes an animal sound on their own when shown the animal. This happens in at least 8 out of 10 tries in a session. It happens in 3 sessions in a row.', '["Show an animal toy or picture.","Make its sound with lots of energy — ''moo!'', ''woof!''","Hold the animal out and wait.","Accept any sound and give them the toy."]'::jsonb,
  '{"english":"We play with animals and their sounds. Animal noises are simple and fun, giving your child lots of easy chances to use their voice.","hindi":""}'::jsonb, 'validated'::validation_status, 'v1-anant-approved',
  'Goal: get the child making more sounds through animal play.', 'how many sounds the child makes', 'An animal game where each animal has a sound, giving the child many easy, fun chances to vocalise.', 'Animal sounds are simple, repetitive, and enjoyable. They give a child far more chances to practise using their voice than conversation does.', 'Simple repeated sound patterns are easier to produce than words and build the vocal practice that speech needs. Fun and repetition are what make them stick.',
  'Early on the child may just take the toy silently. It is going well when they start making the sound before taking it, and try more animals.', 'The microphone counts each sound the child makes and how long each lasted.', 'Gives a simple count of how much the child vocalised in the session — a number you can watch grow.', 'The microphone counts sounds. It cannot tell whether the child made the right animal sound — you judge that.',
  'Expressive vocalisation. Framework: Hanen. Signal: makes_sounds (count, duration).', 'The child makes an animal sound on their own when shown the animal.', 8, 10, 3, 'voice'
) on conflict (id) do nothing;
-- SPE-04  First Words — Name It  (3-5, voice)
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
  'SPE-04', 'First Words — Name It', 'NDBI'::framework_source, 'expressive_language'::activity_domain, '{speech_delay}'::diagnostic_profile[],
  'emerging'::skill_level, 36, 71, 10,
  '["Familiar everyday objects"]'::jsonb, '["independent","gestural_cue","verbal_cue","hand_over_hand"]'::jsonb, 'The child attempts the word on their own after seeing the object, without you naming it first. This happens in at least 8 out of 10 tries in a session. It happens in 3 sessions in a row.', '["Hold up one familiar object.","Name it clearly and simply — ''ball''.","Pause and wait for any attempt.","Accept any approximation and celebrate it."]'::jsonb,
  '{"english":"We practise naming everyday things, accepting any attempt. Early words rarely sound perfect, and accepting attempts keeps children trying.","hindi":""}'::jsonb, 'validated'::validation_status, 'v1-anant-approved',
  'Goal: help the child say the name of familiar things.', 'the child''s sounds and attempts', 'Simple naming practice with everyday objects, accepting any attempt at the word rather than requiring it to be correct.', 'Naming things builds vocabulary. Accepting rough attempts keeps the child trying instead of giving up.', 'Early words rarely sound correct. Rewarding approximations rather than demanding accuracy is what keeps children attempting words.',
  'Early on the child may say nothing or make an unrelated sound. It is going well when attempts appear more often and start sounding closer to the word.', 'The microphone counts the child''s sounds and whether each came on their own or after you named the object.', 'Counts naming attempts objectively while you judge accuracy — a fair split between platform and therapist.', 'The microphone does not recognise words. Whether the child said the right word, and how clearly, is entirely your judgement.',
  'Expressive labeling / tacting. Framework: NDBI. Signal: makes_sounds (count, spontaneous vs prompted).', 'The child attempts the word on their own after seeing the object, without you naming it first.', 8, 10, 3, 'voice'
) on conflict (id) do nothing;
-- SPE-05  Sound Back and Forth  (3-5, voice)
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
  'SPE-05', 'Sound Back and Forth', 'HANEN'::framework_source, 'expressive_language'::activity_domain, '{speech_delay}'::diagnostic_profile[],
  'emerging'::skill_level, 36, 71, 5,
  '[]'::jsonb, '["independent","gestural_cue","verbal_cue","hand_over_hand"]'::jsonb, 'The child takes at least three turns in a row in the sound exchange. This happens in at least 8 out of 10 tries in a session. It happens in 3 sessions in a row.', '["Make a sound, then stop and wait.","When the child makes any sound, respond to it.","Copy their sound back to them.","Keep it going like a game of catch."]'::jsonb,
  '{"english":"We play a sound game of catch — we make a sound, your child responds, we respond back. This rhythm is what conversation is built on.","hindi":""}'::jsonb, 'validated'::validation_status, 'v1-anant-approved',
  'Goal: build a back-and-forth rhythm with sounds.', 'the back-and-forth between you and the child', 'A vocal game of catch — you make a sound, they respond, you respond back, building a rhythm of turns.', 'Conversation is a back-and-forth. Building that rhythm with sounds, before words exist, lays the groundwork for talking.', 'Turn-taking is the structure conversation is built on. Copying the child''s own sounds back to them is one of the most effective ways to extend the exchange.',
  'Early on the exchange may last one turn. It is going well when it goes back and forth several times without breaking down.', 'The microphone separates your voice from the child''s and records how the turns alternated, plus how quickly the child responded.', 'Shows how long the child can sustain a back-and-forth — hard to judge in the moment, and a good marker of progress.', 'The microphone records who made a sound and when. It does not interpret meaning — you judge the quality of the exchange.',
  'Vocal reciprocity / turn-taking. Framework: Hanen. Signal: makes_sounds (count, timing), adult-child alternation.', 'The child takes at least three turns in a row in the sound exchange.', 8, 10, 3, 'voice'
) on conflict (id) do nothing;
-- SPE-06  Fill in the Song  (3-5, voice)
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
  'SPE-06', 'Fill in the Song', 'HANEN'::framework_source, 'expressive_language'::activity_domain, '{speech_delay}'::diagnostic_profile[],
  'emerging'::skill_level, 36, 71, 5,
  '["Familiar songs or rhymes"]'::jsonb, '["independent","gestural_cue","verbal_cue","hand_over_hand"]'::jsonb, 'The child fills the pause with a sound or word, without you prompting. This happens in at least 8 out of 10 tries in a session. It happens in 3 sessions in a row.', '["Sing a song the child knows well.","Stop right before the last word and look expectant.","Wait. Give them time to fill the gap.","Celebrate any sound, then finish the line."]'::jsonb,
  '{"english":"We sing a familiar song and pause before the last word, leaving a gap for your child to fill. Familiar songs make first words easier.","hindi":""}'::jsonb, 'validated'::validation_status, 'v1-anant-approved',
  'Goal: get the child to fill in the missing word of a familiar song.', 'the child''s sounds at the pauses', 'You sing a familiar song and pause before a predictable word, leaving a gap for the child to fill.', 'Familiar songs are easy to predict, so the child knows what comes next. That makes filling the gap much easier than producing a word from scratch.', 'Predictable, repeated language gives children a scaffold. Pausing at a highly predictable point is a well-established way to draw out first words.',
  'Early on the child may just wait for you to finish. It is going well when they fill the gap with any sound, and later with the right word.', 'The microphone counts the child''s sounds and records whether they came in the pause you left.', 'Shows whether the child is starting to produce words in a supported context — usually the first place words appear.', 'The microphone hears a sound in the gap. It does not check whether it was the right word — you judge that.',
  'Expressive language / cloze completion. Framework: Hanen. Signal: makes_sounds (count, timing).', 'The child fills the pause with a sound or word, without you prompting.', 8, 10, 3, 'voice'
) on conflict (id) do nothing;
-- SPE-07  Name the Object  (6-8, voice)
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
  'SPE-07', 'Name the Object', 'NDBI'::framework_source, 'expressive_language'::activity_domain, '{speech_delay}'::diagnostic_profile[],
  'established'::skill_level, 72, 107, 10,
  '["Object or picture cards"]'::jsonb, '["independent","gestural_cue","verbal_cue","hand_over_hand"]'::jsonb, 'The child names the object on their own, before you say the word. This happens in at least 8 out of 10 tries in a session. It happens in 3 sessions in a row.', '["Show one object or card at a time.","Ask ''what is this?'' and wait.","Give plenty of time before helping.","Only name it yourself if they cannot."]'::jsonb,
  '{"english":"We show objects and give your child time to name them before helping. Waiting is what shifts a child from copying to producing words.","hindi":""}'::jsonb, 'validated'::validation_status, 'v1-anant-approved',
  'Goal: help the child name things without being prompted.', 'the child''s naming attempts', 'Structured naming practice, where the child is given time to produce the word before you supply it.', 'Being able to name things is the base of vocabulary. Waiting before helping is what shifts the child from copying to producing.', 'Waiting rather than immediately prompting increases independent word production. The pause is doing the teaching.',
  'Early on the child may only repeat your word. It is going well when they name things before you say anything, and their vocabulary widens.', 'The microphone counts the child''s sounds and separates independent naming from naming that followed your prompt.', 'The spontaneous-versus-prompted split shows whether vocabulary is becoming genuinely independent.', 'The microphone does not check the word was right. Accuracy is your call.',
  'Expressive labeling. Framework: NDBI. Signal: makes_sounds (count, spontaneous vs prompted).', 'The child names the object on their own, before you say the word.', 8, 10, 3, 'voice'
) on conflict (id) do nothing;
-- SPE-08  Putting Two Words Together  (6-8, voice)
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
  'SPE-08', 'Putting Two Words Together', 'HANEN'::framework_source, 'expressive_language'::activity_domain, '{speech_delay}'::diagnostic_profile[],
  'established'::skill_level, 72, 107, 10,
  '["Toys that allow action + object combinations"]'::jsonb, '["independent","gestural_cue","verbal_cue","hand_over_hand"]'::jsonb, 'The child puts two words together on their own during play. This happens in at least 8 out of 10 tries in a session. It happens in 3 sessions in a row.', '["Set up play where two words fit — ''push car'', ''more juice''.","Model the two words together, clearly.","Wait for the child to try.","Accept any two-part attempt and expand it."]'::jsonb,
  '{"english":"We set up play where two words fit naturally, model them, then wait. Going from one word to two is a major language milestone.","hindi":""}'::jsonb, 'validated'::validation_status, 'v1-anant-approved',
  'Goal: help the child join two words together.', 'how much and how long the child talks', 'Play arranged so that two-word combinations are the natural thing to say, with you modelling and then waiting.', 'Moving from single words to two words is a major language milestone. It is the start of building sentences.', 'Modelling slightly above the child''s current level, then waiting, is a core principle of language support. Two-word phrases follow naturally from single words.',
  'Early on the child uses single words only. It is going well when two words start appearing together, even if not perfectly.', 'The microphone records how many sounds the child made and how long each vocalisation lasted — longer utterances suggest more words.', 'Utterance length is a useful proxy for whether the child is building longer phrases over time.', 'The microphone cannot count words or check grammar. It measures how much and how long the child vocalised. You judge whether two words were actually used.',
  'Expressive syntax / two-word combinations. Framework: Hanen. Signal: makes_sounds (count, duration).', 'The child puts two words together on their own during play.', 8, 10, 3, 'voice'
) on conflict (id) do nothing;
-- 0047 part 2 of 2 — speech delay activities (SPE-09 to SPE-15) + signal mappings

-- SPE-09  Answering Questions  (6-8, voice)
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
  'SPE-09', 'Answering Questions', 'NDBI'::framework_source, 'expressive_language'::activity_domain, '{speech_delay}'::diagnostic_profile[],
  'established'::skill_level, 72, 107, 10,
  '["Picture books or familiar objects"]'::jsonb, '["independent","gestural_cue","verbal_cue","hand_over_hand"]'::jsonb, 'The child answers a simple question on their own, without being offered choices. This happens in at least 8 out of 10 tries in a session. It happens in 3 sessions in a row.', '["Ask a simple ''what'' or ''where'' question.","Wait. Count silently to five.","If no answer, offer two choices instead.","Praise any attempt to answer."]'::jsonb,
  '{"english":"We practise answering simple questions with plenty of waiting time. Answering questions is needed at home, at school, and with other people.","hindi":""}'::jsonb, 'validated'::validation_status, 'v1-anant-approved',
  'Goal: help the child answer simple questions.', 'the child''s replies and how fast they come', 'Simple question practice using ''what'' and ''where'', with generous waiting and choices as a fallback.', 'Answering questions is needed everywhere — at home, at school, with other people. It is a practical, high-value skill.', 'Waiting is the most effective prompt. Offering a choice when a child cannot answer keeps them participating rather than shutting down.',
  'Early on the child may not respond or repeat the question. It is going well when answers come more often and more quickly, and need fewer choices offered.', 'The microphone records the child''s replies and how long they took to respond after your question.', 'Response time is a good marker of growing confidence — children answer faster as questions get easier for them.', 'The microphone does not know if the answer was correct. Accuracy is your judgement.',
  'Expressive language / responding. Framework: NDBI. Signal: makes_sounds (count, response latency).', 'The child answers a simple question on their own, without being offered choices.', 8, 10, 3, 'voice'
) on conflict (id) do nothing;
-- SPE-10  Asking for Help  (6-8, voice)
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
  'SPE-10', 'Asking for Help', 'HANEN'::framework_source, 'expressive_language'::activity_domain, '{speech_delay}'::diagnostic_profile[],
  'established'::skill_level, 72, 107, 10,
  '["A container that is hard to open, or a toy needing help"]'::jsonb, '["independent","gestural_cue","verbal_cue","hand_over_hand"]'::jsonb, 'The child asks for help using their voice, without you prompting them to. This happens in at least 8 out of 10 tries in a session. It happens in 3 sessions in a row.', '["Give the child something they need help with.","Stay nearby but do not step in.","Wait for them to ask in any way.","Help immediately when they do."]'::jsonb,
  '{"english":"We set up something your child needs help with, then wait for them to ask. Asking for help prevents frustration and gives your child control.","hindi":""}'::jsonb, 'validated'::validation_status, 'v1-anant-approved',
  'Goal: teach the child to ask for help instead of giving up.', 'whether the child speaks up on their own', 'You create a situation where the child needs help, then wait for them to ask rather than solving it for them.', 'Asking for help prevents frustration and gives the child control. It is one of the most useful phrases a child can learn.', 'Setting up a genuine need, then waiting, is the standard way to teach functional communication. The need itself is the motivation.',
  'Early on the child may give up, get frustrated, or just hand you the object. It is going well when they use their voice to ask, and do it sooner.', 'The microphone counts the child''s sounds and identifies which came on their own rather than after you spoke.', 'Shows whether the child is learning to use their voice when they need something, rather than shutting down.', 'The microphone hears the sound, not the word. Whether they actually asked for help is your judgement.',
  'Functional communication / requesting help. Framework: Hanen. Signal: asks_on_own (spontaneous count).', 'The child asks for help using their voice, without you prompting them to.', 8, 10, 3, 'voice'
) on conflict (id) do nothing;
-- SPE-11  Describing a Picture  (6-8, voice)
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
  'SPE-11', 'Describing a Picture', 'HANEN'::framework_source, 'expressive_language'::activity_domain, '{speech_delay}'::diagnostic_profile[],
  'established'::skill_level, 72, 107, 10,
  '["Busy, interesting pictures"]'::jsonb, '["independent","gestural_cue","verbal_cue","hand_over_hand"]'::jsonb, 'The child describes at least two things in the picture, on their own. This happens in at least 8 out of 10 tries in a session. It happens in 3 sessions in a row.', '["Show a busy, interesting picture.","Ask ''what do you see?'' and wait.","Respond to what they say and add one word.","Keep going as long as they are interested."]'::jsonb,
  '{"english":"We look at busy pictures and your child tells us what they see, while we add one word to whatever they say. This builds longer sentences naturally.","hindi":""}'::jsonb, 'validated'::validation_status, 'v1-anant-approved',
  'Goal: help the child say more than one word about what they see.', 'how much the child talks', 'Open-ended picture description, where you extend whatever the child offers rather than correcting it.', 'Describing builds longer sentences and richer vocabulary. Busy pictures give the child plenty to talk about.', 'Extending what a child says by adding one word is a core language-building technique. It models the next step without correcting them.',
  'Early on the child may name one thing. It is going well when they offer more items and start using longer phrases.', 'The microphone records how much the child talked in total and how long their vocalisations lasted.', 'Total talk time is a simple, honest measure of whether the child is producing more language over time.', 'The microphone measures how much was said, not what. Vocabulary and grammar are your judgement.',
  'Expressive description. Framework: Hanen. Signal: makes_sounds (count, total duration).', 'The child describes at least two things in the picture, on their own.', 8, 10, 3, 'voice'
) on conflict (id) do nothing;
-- SPE-12  Category Naming Game  (9-12, voice)
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
  'SPE-12', 'Category Naming Game', 'NDBI'::framework_source, 'expressive_language'::activity_domain, '{speech_delay}'::diagnostic_profile[],
  'established'::skill_level, 108, 155, 10,
  '[]'::jsonb, '["independent","gestural_cue","verbal_cue","hand_over_hand"]'::jsonb, 'The child names at least four items in a category without help. This happens in at least 8 out of 10 tries in a session. It happens in 3 sessions in a row.', '["Name a category — animals, food, things at school.","Ask them to name as many as they can.","Take turns adding to the list.","Keep it light and fast-paced."]'::jsonb,
  '{"english":"We take turns naming things in a category, like animals or foods. Grouping words this way makes them easier to find when your child needs them.","hindi":""}'::jsonb, 'validated'::validation_status, 'v1-anant-approved',
  'Goal: help the child find words within a category.', 'how many words the child produces', 'A naming game where you take turns listing things that belong to a category.', 'Grouping words into categories is how vocabulary gets organised in memory. It makes words easier to find when needed.', 'Category-based practice strengthens word retrieval — the ability to find the word you want when you want it, which is a common difficulty.',
  'Early on the child may manage one or two items. It is going well when the lists get longer and come more quickly.', 'The microphone counts the child''s vocalisations, giving a rough count of how many items they produced.', 'A simple count of output per category, showing whether word retrieval is getting faster and richer.', 'The microphone counts sounds, not words, and cannot check whether the item fitted the category. You score correctness.',
  'Vocabulary / word retrieval. Framework: NDBI. Signal: makes_sounds (count).', 'The child names at least four items in a category without help.', 8, 10, 3, 'voice'
) on conflict (id) do nothing;
-- SPE-13  Tell Me the Story Again  (9-12, voice)
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
  'SPE-13', 'Tell Me the Story Again', 'HANEN'::framework_source, 'expressive_language'::activity_domain, '{speech_delay}'::diagnostic_profile[],
  'mastery'::skill_level, 108, 155, 15,
  '["A short, simple story or picture sequence"]'::jsonb, '["independent","gestural_cue","verbal_cue","hand_over_hand"]'::jsonb, 'The child retells the main events in order, with no more than one prompt. This happens in at least 8 out of 10 tries in a session. It happens in 3 sessions in a row.', '["Tell or read a short, simple story.","Ask the child to tell it back to you.","Prompt only if they get stuck — ''what happened next?''","Let them tell it their own way."]'::jsonb,
  '{"english":"Your child retells a short story in their own words. Retelling uses memory, order, and language all at once, and it supports later reading.","hindi":""}'::jsonb, 'validated'::validation_status, 'v1-anant-approved',
  'Goal: help the child retell a short story in order.', 'how much the child talks', 'The child retells a story they have just heard, in their own words and in the right order.', 'Retelling needs memory, sequencing, and connected language all at once. It is a big step beyond single sentences.', 'Narrative skill predicts later reading and school success. Retelling a familiar story is the standard way to build it.',
  'Early on the child may give one or two disconnected details. It is going well when the retelling covers more events, in the right order, with less prompting.', 'The microphone records how much the child spoke in total, and the balance between your talking and theirs.', 'Total talk time shows whether the child is producing more connected language and needing fewer prompts.', 'The microphone does not understand the story or check the order. Whether the retelling was accurate is your judgement.',
  'Narrative language. Framework: Hanen. Signal: makes_sounds (total duration), adult-child balance.', 'The child retells the main events in order, with no more than one prompt.', 8, 10, 3, 'voice'
) on conflict (id) do nothing;
-- SPE-14  Staying on Topic  (9-12, voice)
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
  'SPE-14', 'Staying on Topic', 'HANEN'::framework_source, 'expressive_language'::activity_domain, '{speech_delay}'::diagnostic_profile[],
  'mastery'::skill_level, 108, 155, 10,
  '[]'::jsonb, '["independent","gestural_cue","verbal_cue","hand_over_hand"]'::jsonb, 'The child stays on the same topic for at least four turns. This happens in at least 8 out of 10 tries in a session. It happens in 3 sessions in a row.', '["Pick one topic and say you will stay on it.","Ask an open question and let them lead.","Gently guide back if they drift.","Aim for several turns on the same topic."]'::jsonb,
  '{"english":"We practise keeping one topic going across several turns. Staying on topic is what makes conversation feel connected to the other person.","hindi":""}'::jsonb, 'validated'::validation_status, 'v1-anant-approved',
  'Goal: help the child stay on one topic in conversation.', 'the balance of talking between you both', 'A conversation where the goal is to keep one topic going across several turns, rather than jumping around.', 'Staying on topic is what makes conversation feel connected. Drifting makes it hard for others to follow.', 'Topic maintenance is a distinct skill from vocabulary or grammar, and it needs its own practice. Gentle redirection works better than correction.',
  'Early on the child may change topic every turn. It is going well when they stay on one topic for several turns and build on what you said.', 'The microphone records how much each of you spoke and how the turns alternated.', 'Shows whether the conversation is balanced and sustained — genuinely difficult to judge while you are in it.', 'The microphone measures who spoke and when, not what was said. Whether they stayed on topic is entirely your judgement.',
  'Pragmatic language / topic maintenance. Framework: Hanen. Signal: makes_sounds (count, timing), adult-child balance.', 'The child stays on the same topic for at least four turns.', 8, 10, 3, 'voice'
) on conflict (id) do nothing;
-- SPE-15  Your Turn to Ask  (9-12, voice)
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
  'SPE-15', 'Your Turn to Ask', 'NDBI'::framework_source, 'expressive_language'::activity_domain, '{speech_delay}'::diagnostic_profile[],
  'mastery'::skill_level, 108, 155, 10,
  '["A hidden object or a mystery bag"]'::jsonb, '["independent","gestural_cue","verbal_cue","hand_over_hand"]'::jsonb, 'The child asks at least three questions on their own during the game. This happens in at least 8 out of 10 tries in a session. It happens in 3 sessions in a row.', '["Hide something and tell them to guess by asking.","Only answer questions they ask.","Wait. Do not offer clues unprompted.","Celebrate every question they come up with."]'::jsonb,
  '{"english":"We hide something and your child has to ask questions to guess it. Asking questions is how children find out about the world.","hindi":""}'::jsonb, 'validated'::validation_status, 'v1-anant-approved',
  'Goal: help the child ask questions, not just answer them.', 'how often the child speaks up on their own', 'A guessing game where the only way forward is for the child to ask questions.', 'Asking questions is how children find out about the world. It is much harder than answering, and often needs teaching.', 'Creating a situation where questions are the only route to the answer makes asking necessary rather than optional.',
  'Early on the child may guess randomly or wait for hints. It is going well when they ask real questions, and ask more of them.', 'The microphone counts the child''s vocalisations and identifies which came on their own rather than after you spoke.', 'Shows whether the child is initiating rather than only responding — the marker of independent communication.', 'The microphone hears that the child spoke on their own. It does not know whether it was a question — you judge that.',
  'Expressive questioning / initiation. Framework: NDBI. Signal: asks_on_own (spontaneous count).', 'The child asks at least three questions on their own during the game.', 8, 10, 3, 'voice'
) on conflict (id) do nothing;

-- speech signal mappings
insert into activity_signals (activity_id, attribute_id, is_primary) values
  ('SPE-01', 'makes_sounds', true),
  ('SPE-02', 'asks_on_own', true),
  ('SPE-02', 'makes_sounds', false),
  ('SPE-03', 'makes_sounds', true),
  ('SPE-04', 'makes_sounds', true),
  ('SPE-05', 'makes_sounds', true),
  ('SPE-06', 'makes_sounds', true),
  ('SPE-07', 'makes_sounds', true),
  ('SPE-08', 'makes_sounds', true),
  ('SPE-09', 'makes_sounds', true),
  ('SPE-10', 'asks_on_own', true),
  ('SPE-11', 'makes_sounds', true),
  ('SPE-12', 'makes_sounds', true),
  ('SPE-13', 'makes_sounds', true),
  ('SPE-14', 'makes_sounds', true),
  ('SPE-15', 'asks_on_own', true)
on conflict (activity_id, attribute_id) do nothing;
