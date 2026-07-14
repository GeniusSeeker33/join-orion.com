-- Hide four postings from the public careers page. We soft-delete
-- (is_active = false) rather than hard delete so the rows — and any
-- candidate_applications that reference their position_id — are preserved
-- and the roles can be reopened in the future by flipping is_active back on.

update public.job_postings
  set is_active = false
  where title in (
    'Collections Clerk',
    'Order Validation Specialist',
    'Warehouse Picker/Packer',
    'Warehouse Receiver'
  );
