-- Draft careers repost. Apply only after reviewing in staging.
-- Preserve historical applications and existing posting IDs.
begin;
update public.job_postings set is_active=false
where title in ('Customer Service & Compliance Specialist','Customer Service and Compliance Specialist');
insert into public.job_postings (title,department,location,employment_type,hours,pay,description,is_active)
select 'Customer Service & Returns Specialist — Compliance Support',
       'Operations','Jeffersonville, IN','Full-time','40 hours/week, in office','$21.00/hour',
$desc$Orion Wholesale is a nationwide distributor serving the shooting sports industry. We are seeking a proactive customer service professional with hands-on experience managing product returns, creating return shipping labels, resolving customer issues, and coordinating with warehouse and inventory teams.

WHAT YOU WILL DO
• Own customer inquiries and return requests through resolution, including proactive status updates.
• Create and manage UPS, FedEx, USPS, or comparable return shipping labels and track shipments.
• Coordinate return authorizations, receiving, inspections, exchanges, restocking, and inventory discrepancies.
• De-escalate frustrated customers with professionalism, empathy, and clear next steps.
• Maintain accurate records of customer communications, return reasons, shipping details, and outcomes.
• Identify recurring issues and recommend improvements.
• After training, prepare, verify, submit, and track NFA Form 3 documentation in accordance with company procedures.

WHAT WE ARE LOOKING FOR
• Practical experience with product returns, exchanges, shipping labels, or order resolution.
• Excellent written and verbal communication and demonstrated customer de-escalation skills.
• Proactive follow-through, careful documentation, organization, and attention to detail.
• Confidence using order-management, shipping, office, and tracking software.
• Ability to collaborate with warehouse, inventory, and compliance colleagues.
• NFA or firearms-industry experience is NOT required; training is provided.

PAY AND SCHEDULE
$21.00 per hour; full-time, 40 hours per week, in office in Jeffersonville, Indiana.

BENEFITS
Health, dental, and vision insurance; 401(k) with company match; employee discounts on firearms and accessories.

All offers are conditional upon applicable pre-employment drug screening and background checks. Orion Wholesale is an equal opportunity employer.$desc$,true
where not exists (select 1 from public.job_postings where title='Customer Service & Returns Specialist — Compliance Support');
update public.job_postings set is_active=true where title='Customer Service & Returns Specialist — Compliance Support';
commit;