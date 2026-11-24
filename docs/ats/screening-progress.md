# Universal Applicant Screening Engine

1. Inspect production-based ATS, referral policies, careers postings and the Returns reference.
2. Add versioned public questionnaires and wire Careers, individual links and the existing Returns URL.
3. Add recruiter publishing, identity-aware synchronization and screening review.
4. Add private resume handling, human-approved evidence and regression validation.

The Careers and ATS clients use separate Supabase projects. Keep their existing sessions and policies. Apply the Careers migration and the ATS overlay to their respective staging projects before enabling live use. The existing ATS base schema is maintained outside the production-based repository.
