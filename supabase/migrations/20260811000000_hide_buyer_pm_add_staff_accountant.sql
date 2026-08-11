-- Careers page updates:
--   1. Hide the Senior Buyer posting.
--   2. Hide the Production Manager posting.
--   3. Add a new Staff Accountant posting (onsite, Jeffersonville, IN).
-- Hides are soft-deletes (is_active = false) so the rows and any linked
-- candidate_applications are preserved and the postings can be reopened later.

-- 1. Hide Senior Buyer
update public.job_postings
  set is_active = false
  where title = 'Senior Buyer';

-- 2. Hide Production Manager
update public.job_postings
  set is_active = false
  where title = 'Production Manager';

-- 3. Add Staff Accountant
insert into public.job_postings (title, department, location, employment_type, hours, pay, description)
values (
  'Staff Accountant',
  'Accounting',
  'Jeffersonville, IN',
  'Full-time',
  '1st Shift',
  'From $60,000.00 per year',
$desc$Orion Wholesale is a nationwide distributor carrying over 120 product lines in the shooting sports industry. With a commitment to customer service, competitive pricing, and timely deliveries, Orion is geared for success now and far into the future. Our company is hiring a Staff Accountant to join the team. Reporting directly to the Controller, the Staff Accountant will perform various duties and play an integral part in the accounting and business operations of the company.

ROLE AND RESPONSIBILITIES
• Work closely with the Controller, CFO, and the management team to support business growth and company goals.
• Lead month-end financial closing for multiple companies in compliance with US GAAP.
• Participate in frequent financial reviews and provide meaningful analysis.
• Prepare journal entries and bank reconciliations including but not limited to cash and inventory.
• Assist with cost accounting for inventory items.
• Assist with analyzing shipping costs for the national transportation company.
• Recommend and implement process improvements that drive efficiency in the accounting department.
• Become a transactional expert in Microsoft Business Central (ERP).
• Project based work that includes data analysis in Microsoft Business Central (ERP).
• Understand operational flows and related transactions in the sales department and the warehouse.
• Prepare monthly financial statements with insightful analysis to explain financial results.
• Work directly with the public accounting firm to support financial statement reviews and tax planning.
• Assist with treasury management for the company including bank activities.
• Perform balance sheet account reconciliations monthly.
• Cross-train with accounts receivable and accounts payable staff to perform daily processing.
• Ad hoc tasks assigned by the Controller and CFO.

QUALIFICATIONS AND EDUCATION REQUIREMENTS
• Bachelor's Degree in Accounting or relevant education or experience.
• Educational understanding of US GAAP.
• Strong IT acumen and willing to become subject matter expert in the ERP system.
• Self-starter with efficient time management and organizational skills.
• Strong expertise with Microsoft Office software (i.e. Excel, Outlook).
• Good communication skills in an office environment.
• Continuous improvement mindset.$desc$
);
