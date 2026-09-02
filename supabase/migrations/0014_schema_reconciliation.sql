-- 0014_schema_reconciliation.sql
-- Close schema gaps identified during pre-Week-3 audit.
-- All columns nullable. All statements idempotent.

-- ============================================================
-- CENTERS
-- ============================================================
alter table centers add column if not exists pincode text;
alter table centers add column if not exists contact_phone text;
alter table centers add column if not exists contact_email text;

alter table centers drop constraint if exists chk_centers_contact_phone;
alter table centers add constraint chk_centers_contact_phone
  check (contact_phone is null or contact_phone ~ '^\+[1-9][0-9]{6,14}$');

alter table centers drop constraint if exists chk_centers_contact_email;
alter table centers add constraint chk_centers_contact_email
  check (contact_email is null or contact_email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$');

-- ============================================================
-- PROFILES
-- ============================================================
alter table profiles add column if not exists phone_e164 text;
alter table profiles add column if not exists rci_registration_number text;
alter table profiles add column if not exists qualifications text;
alter table profiles add column if not exists credential_class text;

alter table profiles drop constraint if exists chk_profiles_phone_e164;
alter table profiles add constraint chk_profiles_phone_e164
  check (phone_e164 is null or phone_e164 ~ '^\+[1-9][0-9]{6,14}$');

-- ============================================================
-- PARENTS
-- ============================================================
alter table parents add column if not exists whatsapp_number_e164 text;
alter table parents add column if not exists email text;

alter table parents drop constraint if exists chk_parents_whatsapp_e164;
alter table parents add constraint chk_parents_whatsapp_e164
  check (whatsapp_number_e164 is null or whatsapp_number_e164 ~ '^\+[1-9][0-9]{6,14}$');

alter table parents drop constraint if exists chk_parents_email;
alter table parents add constraint chk_parents_email
  check (email is null or email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$');
