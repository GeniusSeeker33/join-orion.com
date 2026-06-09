-- Remove the Junior Marketing Specialist posting from the public careers
-- page and add the Warehouse Picker/Packer role.
--
-- We soft-delete the marketing posting (is_active = false) instead of a
-- hard delete so any existing candidate_applications rows that reference
-- this position_id are preserved with their full history intact.

update public.job_postings
  set is_active = false
  where title = 'Junior Marketing Specialist (Growth & Creative)';

insert into public.job_postings (title, department, location, employment_type, hours, pay, description)
values (
  'Warehouse Picker/Packer',
  'Warehouse',
  'Jeffersonville, IN 47130',
  'Full-time',
  'M-F, 8:00 AM – 4:30 PM',
  '$16.00/hour (+$1.00/hr after 90 days)',
$desc$About Us
Orion Wholesale is a leading distributor of firearms, ammunition, and shooting sports accessories. Our warehouse team plays a critical role in ensuring orders are shipped accurately and efficiently to dealers across the United States.

We pride ourselves on maintaining a clean, organized, and team-oriented work environment where hard work is recognized and opportunities for growth exist.

Role Overview
We are hiring Warehouse Pickers and Packers to support efficient and accurate order fulfillment. This role requires attention to detail, organizational skills, the ability to lift up to 60 pounds, and a commitment to safety.

Compensation
• $16.00/hour
• $1.00/hour increase after 90 days, contingent on good performance

Work Environment
• Active warehouse environment with frequent walking, lifting, bending, and standing
• Employees are on their feet for most of the workday
• Warehouse is equipped with large industrial fans
• While clean and well-maintained, the warehouse is not air-conditioned, and temperatures may occasionally reach 80°F or higher during summer months
• Team members should be comfortable performing physical work in a warm environment

Picker Responsibilities
• Pick products according to order slips and place them on carts for packaging
• Maintain a clean and organized work area
• Assist with other warehouse tasks as needed

Packer Responsibilities
• Receive picked merchandise for packing and prepare products for shipment
• Tape, seal, and label packages to meet quality standards
• Maintain a clean and organized work area
• Assist with incoming shipments as needed

Qualifications
• High school diploma or equivalent
• Ability to repeatedly lift up to 60 pounds throughout the workday
• Ability to stand and walk for the duration of the shift
• Strong attention to detail and accuracy
• Team-oriented with a reliable and positive attitude
• Forklift experience preferred (training available)
• Must pass a background check and drug screen
• Reliable transportation

Why Orion?
• Monday–Friday schedule
• No nights or weekends
• Attendance bonus
• Stable, growing company
• Opportunities for advancement and career growth$desc$
);
