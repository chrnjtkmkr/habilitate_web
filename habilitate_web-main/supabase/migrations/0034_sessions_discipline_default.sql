-- Captures the manual fix applied to prod (dashboard) and local (direct query).
-- Without this, db reset drops the default and scheduling breaks again.
alter table sessions alter column discipline_id set default 'unspecified';
