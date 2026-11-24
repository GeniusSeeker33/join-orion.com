-- Run against the operational ATS database with read-only authorization.
-- Output contains requisition metadata only. A similar title is a candidate match, not an automatic mapping.
begin read only;
select id,title,status
from ats_dev.requisitions
where status='open' and title ~* '(customer service|warehouse middle|warehouse picker|warehouse packer|production assistant|cerakote applicator|sales executive)'
order by title,id;
rollback;
