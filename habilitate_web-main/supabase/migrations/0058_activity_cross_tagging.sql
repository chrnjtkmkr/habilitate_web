-- 0058_activity_cross_tagging.sql
-- Cross-tag validated activities so children with overlapping conditions
-- see all clinically appropriate activities, not only those originally
-- tagged to their single primary diagnosis.
--
-- diagnostic_profile_applicability is an array precisely for this purpose.
-- Each UPDATE appends a value only if not already present.
--
-- DELIBERATELY LEFT for Dr. Anant to review:
-- - Gross motor → autism. Motor differences are common in autism, but whether
--   a physiotherapy gross-motor programme is appropriate for an autistic child
--   without motor delay is a clinical judgement.
-- - Anything → specific_learning_disability beyond what it already has. SLD is
--   a specific diagnosis and broad cross-tagging would dilute it.
-- - ADHD activities → anything else. Executive function work for ADHD is
--   targeted; applying it broadly would fill other children's libraries with
--   inappropriate content.

do $$
declare
  v_count bigint;
begin

  -- Rule 1: Speech/language activities (speech_delay, expressive/receptive_language)
  --         also serve AUTISM.
  update activities
     set diagnostic_profile_applicability = array_append(diagnostic_profile_applicability, 'autism'::diagnostic_profile)
   where validation_status = 'validated'
     and 'speech_delay' = any(diagnostic_profile_applicability)
     and developmental_domain in ('expressive_language', 'receptive_language')
     and not ('autism' = any(diagnostic_profile_applicability));
  get diagnostics v_count = row_count;
  raise notice 'Rule 1 (speech → autism): % rows', v_count;

  -- Rule 2: Speech/language activities also serve GLOBAL_DEVELOPMENTAL_DELAY.
  update activities
     set diagnostic_profile_applicability = array_append(diagnostic_profile_applicability, 'global_developmental_delay'::diagnostic_profile)
   where validation_status = 'validated'
     and 'speech_delay' = any(diagnostic_profile_applicability)
     and developmental_domain in ('expressive_language', 'receptive_language')
     and not ('global_developmental_delay' = any(diagnostic_profile_applicability));
  get diagnostics v_count = row_count;
  raise notice 'Rule 2 (speech → gdd): % rows', v_count;

  -- Rule 3: Joint attention and social reciprocity activities (autism)
  --         also serve GLOBAL_DEVELOPMENTAL_DELAY.
  update activities
     set diagnostic_profile_applicability = array_append(diagnostic_profile_applicability, 'global_developmental_delay'::diagnostic_profile)
   where validation_status = 'validated'
     and 'autism' = any(diagnostic_profile_applicability)
     and developmental_domain in ('joint_attention', 'social_reciprocity')
     and not ('global_developmental_delay' = any(diagnostic_profile_applicability));
  get diagnostics v_count = row_count;
  raise notice 'Rule 3 (joint_attention/social → gdd): % rows', v_count;

  -- Rule 4: Attention/executive function activities (adhd or sld)
  --         also serve AUTISM.
  update activities
     set diagnostic_profile_applicability = array_append(diagnostic_profile_applicability, 'autism'::diagnostic_profile)
   where validation_status = 'validated'
     and developmental_domain = 'attention_executive'
     and ('adhd' = any(diagnostic_profile_applicability) or 'specific_learning_disability' = any(diagnostic_profile_applicability))
     and not ('autism' = any(diagnostic_profile_applicability));
  get diagnostics v_count = row_count;
  raise notice 'Rule 4 (attention_executive → autism): % rows', v_count;

  -- Rule 5: Fine motor activities also serve AUTISM.
  update activities
     set diagnostic_profile_applicability = array_append(diagnostic_profile_applicability, 'autism'::diagnostic_profile)
   where validation_status = 'validated'
     and developmental_domain = 'fine_motor'
     and not ('autism' = any(diagnostic_profile_applicability));
  get diagnostics v_count = row_count;
  raise notice 'Rule 5 (fine_motor → autism): % rows', v_count;

  -- Rule 6: Motor imitation activities (autism) also serve GLOBAL_DEVELOPMENTAL_DELAY.
  update activities
     set diagnostic_profile_applicability = array_append(diagnostic_profile_applicability, 'global_developmental_delay'::diagnostic_profile)
   where validation_status = 'validated'
     and 'autism' = any(diagnostic_profile_applicability)
     and developmental_domain = 'motor_imitation'
     and not ('global_developmental_delay' = any(diagnostic_profile_applicability));
  get diagnostics v_count = row_count;
  raise notice 'Rule 6 (motor_imitation → gdd): % rows', v_count;

end;
$$;
