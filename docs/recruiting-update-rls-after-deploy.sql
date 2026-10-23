-- APPLY ONLY AFTER the updated CareersPage has been deployed and tested.
-- Removes unrestricted public UPDATE access to candidate applications.
-- Current production CareersPage updates resume_path after INSERT, so executing
-- this before deploying the revised form will break resume-path persistence.
BEGIN;
DROP POLICY IF EXISTS "public update candidate resume path" ON public.candidate_applications;
DROP POLICY IF EXISTS "Authenticated can update candidates" ON public.candidate_applications;
CREATE POLICY "Orion recruiting admin update candidates"
ON public.candidate_applications FOR UPDATE TO authenticated
USING ((select auth.uid()) = '7d7f4f82-5a36-4649-a640-fbcfbfc23c1a'::uuid)
WITH CHECK ((select auth.uid()) = '7d7f4f82-5a36-4649-a640-fbcfbfc23c1a'::uuid);
COMMIT;

-- Verify: there should be exactly one UPDATE policy, restricted to Orion admin.
SELECT policyname, cmd, roles, qual, with_check
FROM pg_policies WHERE schemaname='public'
AND tablename='candidate_applications' AND cmd='UPDATE';
