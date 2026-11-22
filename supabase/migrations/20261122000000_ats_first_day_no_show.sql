-- Orion ATS: First-Day No-Show and automatic hiring-seat release
-- Target: Marketing Command Center development Supabase project
--
-- Prerequisites:
--   ats_dev.employment
--   ats_dev.candidates
--   ats_dev.memberships
--   ats_dev.requisition_candidates
--
-- The ATS base schema is not currently represented in this
-- repository's earlier migrations.
--
-- This migration is idempotent for the existing ATS schema.
-- It does not change existing employment or candidate records.

BEGIN;

ALTER TABLE ats_dev.employment
  DROP CONSTRAINT IF EXISTS employment_employment_status_check;

ALTER TABLE ats_dev.employment
  ADD CONSTRAINT employment_employment_status_check
  CHECK (
    employment_status IN (
      'unknown',
      'not_started',
      'active',
      'terminated',
      'first_day_no_show'
    )
  );

CREATE OR REPLACE FUNCTION public.ats_admin_save_employment(
  p_candidate_id uuid,
  p_start_date date,
  p_status text,
  p_termination_date date,
  p_termination_reason text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_id uuid;
  v_occupied_count integer;
BEGIN
  IF auth.uid() IS NULL OR NOT EXISTS (
    SELECT 1
    FROM ats_dev.memberships m
    WHERE m.user_id = auth.uid()
      AND m.is_active
      AND m.role = 'recruiter_admin'
  ) THEN
    RAISE EXCEPTION 'Not authorized'
      USING errcode = '42501';
  END IF;

  -- Serialize employment changes for this candidate.
  PERFORM 1
  FROM ats_dev.candidates
  WHERE id = p_candidate_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Candidate not found';
  END IF;

  IF p_status NOT IN (
    'not_started',
    'active',
    'terminated',
    'first_day_no_show'
  ) THEN
    RAISE EXCEPTION 'Invalid employment status';
  END IF;

  IF p_status = 'active' AND p_start_date IS NULL THEN
    RAISE EXCEPTION 'Start date required for active employee';
  END IF;

  IF p_status = 'terminated' AND (
    p_start_date IS NULL
    OR p_termination_date IS NULL
    OR p_termination_date < p_start_date
  ) THEN
    RAISE EXCEPTION 'Valid start and termination dates required';
  END IF;

  IF p_status = 'first_day_no_show'
     AND p_start_date IS NULL THEN
    RAISE EXCEPTION 'Scheduled start date required for first-day no-show';
  END IF;

  IF p_status NOT IN ('terminated', 'first_day_no_show')
     AND (
       p_termination_date IS NOT NULL
       OR NULLIF(TRIM(COALESCE(p_termination_reason, '')), '') IS NOT NULL
     ) THEN
    RAISE EXCEPTION 'End-of-employment details require terminated or first-day no-show status';
  END IF;

  IF p_status = 'first_day_no_show'
     AND p_termination_date IS NOT NULL THEN
    RAISE EXCEPTION 'First-day no-show must not have a termination date';
  END IF;

  IF LENGTH(COALESCE(p_termination_reason, '')) > 2000 THEN
    RAISE EXCEPTION 'Reason is too long';
  END IF;

  -- Prevent ambiguous seat releases.
  SELECT COUNT(*)
  INTO v_occupied_count
  FROM ats_dev.requisition_candidates
  WHERE candidate_id = p_candidate_id
    AND stage = 'hired'
    AND counts_toward_openings = true;

  IF p_status IN ('terminated', 'first_day_no_show')
     AND v_occupied_count > 1 THEN
    RAISE EXCEPTION
      'Candidate occupies multiple hiring seats; review assignments before saving';
  END IF;

  SELECT id
  INTO v_id
  FROM ats_dev.employment
  WHERE candidate_id = p_candidate_id
  ORDER BY created_at DESC
  LIMIT 1
  FOR UPDATE;

  IF v_id IS NULL THEN
    INSERT INTO ats_dev.employment (
      candidate_id,
      start_date,
      employment_status,
      termination_date,
      termination_reason
    )
    VALUES (
      p_candidate_id,
      p_start_date,
      p_status,
      p_termination_date,
      NULLIF(TRIM(p_termination_reason), '')
    )
    RETURNING id INTO v_id;
  ELSE
    UPDATE ats_dev.employment
    SET
      start_date = p_start_date,
      employment_status = p_status,
      termination_date = p_termination_date,
      termination_reason = NULLIF(TRIM(p_termination_reason), '')
    WHERE id = v_id;
  END IF;

  -- Release the occupied hiring seat while retaining
  -- the candidate's historical 'hired' pipeline stage.
  IF p_status IN ('terminated', 'first_day_no_show') THEN
    UPDATE ats_dev.requisition_candidates
    SET
      counts_toward_openings = false,
      updated_at = NOW()
    WHERE candidate_id = p_candidate_id
      AND stage = 'hired'
      AND counts_toward_openings = true;
  END IF;

  RETURN v_id;
END;
$function$;

COMMIT;
