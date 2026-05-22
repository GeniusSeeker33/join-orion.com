-- Replace seeded placeholder + smoketest data with real job postings.

-- Remove placeholder/test data
delete from public.job_postings where title = 'Warehouse Associate';
delete from public.dealer_applications    where last_name = 'Smoketest';
delete from public.candidate_applications where last_name = 'Smoketest';

-- 1. Inventory Management & Compliance Specialist
insert into public.job_postings (title, department, location, employment_type, hours, pay, description)
values (
  'Inventory Management & Compliance Specialist',
  'Warehouse',
  'Jeffersonville, IN',
  'Full-time',
  '1st Shift',
  '$19/hour',
$desc$About Orion Wholesale
Orion Wholesale is a leading distributor of firearms, ammunition, and shooting sports accessories. Our team operates from a modern, clean, and climate-controlled distribution center focused on delivering exceptional service and quality products across the United States.

This role is ideal for someone who is organized, detail-oriented, and looking to grow with a fast-paced company where their work has a direct impact on daily operations and customer success.

Position Summary
The Inventory Management & Compliance Specialist supports day-to-day warehouse operations through a combination of inventory management, administrative coordination, purchasing support, and firearms compliance activities.

The ideal candidate is dependable, adaptable, comfortable working with data and documentation, and able to thrive in a firearms manufacturing and logistics environment.

Key Responsibilities

Inventory Management & Administrative Support
• Assist with accounting and inventory management tasks
• Utilize Microsoft Business Central and Excel to process and track inventory movement
• Support the Warehouse Manager with daily operational priorities
• Prepare, organize, and maintain operational documentation and records
• Generate inventory, productivity, and workflow reports as needed
• Track job statuses and help ensure work orders move efficiently from start to finish

Firearms Receiving & Compliance
• Receive incoming firearms, parts, and components
• Accurately complete required paperwork for firearm intake, transfers, and internal tracking
• Maintain organized and compliant records in accordance with ATF regulations and company policies
• Coordinate with leadership to ensure compliance standards are consistently met

Inventory & Purchasing Support
• Monitor inventory levels of supplies, consumables, and workflow materials
• Assist with ordering tools, parts, and operational supplies as directed by the Warehouse Manager

What We're Looking For
• Strong organizational and multitasking skills
• High attention to detail and accuracy
• Comfortable working with spreadsheets, reports, and inventory systems
• Positive attitude and willingness to support a team environment
• Prior warehouse, inventory, logistics, or compliance experience is a plus
• Experience with Microsoft Business Central is helpful, but not required$desc$
);

-- 2. Sales Trainer
insert into public.job_postings (title, department, location, employment_type, hours, pay, description)
values (
  'Sales Trainer',
  'Sales',
  'Jeffersonville, IN',
  'Full-time',
  '1st Shift',
  '$65,000–$75,000/year',
$desc$About Orion Wholesale
Orion Wholesale is a nationwide distributor carrying over 120 product lines in the shooting sports industry. With a commitment to customer service, competitive pricing, and timely deliveries, Orion Wholesale is focused on growth, innovation, and building a first class sales team.

Role Overview
We are seeking an experienced and dynamic Sales Trainer to join our growing team. This role is critical to the success of our Sales Executive team, ensuring new hires and existing sales reps are equipped with the skills, knowledge, and confidence to exceed sales targets and represent Orion Wholesale at the highest level. The Sales Trainer will work closely with the Sales Director and Sales Manager, helping to scale and standardize training for a rapidly expanding team.

Relocation reimbursement offered depending on circumstances.

Key Responsibilities
• Develop, implement, and maintain comprehensive sales training programs for new and existing Sales Executives.
• Conduct onboarding sessions, product training, and ongoing skill development workshops.
• Collaborate with management and the existing trainer to identify training needs, improve sales processes, and scale programs for team growth.
• Coach and mentor Sales Executives to enhance performance, close rates, and customer engagement.
• Monitor training effectiveness through performance metrics, feedback, and ongoing assessments.
• Stay up-to-date on industry trends, competitor practices, and product knowledge to continuously improve training content.
• Foster a positive, motivational, and performance-driven learning environment.

Qualifications
• Proven experience in sales, preferably in wholesale distribution, B2B, or related industries.
• Prior experience in training, coaching, and sales enablement is required.
• Strong presentation, communication, and interpersonal skills.
• Ability to develop engaging training materials and deliver them effectively to a diverse sales team.
• Highly organized with the ability to manage multiple projects and priorities.
• Passionate about mentoring others and driving team success.

Why Join Orion Wholesale
• Opportunity to make a direct impact on the growth and performance of a nationwide sales team.
• Collaborative, team-oriented environment with a focus on professional development.
• Competitive salary and benefits package.
• Be part of a company that values culture, growth, and innovation in the shooting sports industry.$desc$
);

-- 3. Sales Executive – Inside Sales
insert into public.job_postings (title, department, location, employment_type, hours, pay, description)
values (
  'Sales Executive – Inside Sales',
  'Sales',
  'Jeffersonville, IN',
  'Full-time',
  '1st Shift',
  'Year 1: $31,200 base + commissions + bonuses + SPIFFs',
$desc$This is a sales-forward, outbound inside sales role where you will build a residual book of business from scratch.

At Orion Wholesale, we're building winners. Over the next two years, we plan to double in size — creating real opportunity, upward mobility, and long-term earning potential for those who get in early and commit to the work.

If you're hungry, coachable, competitive, and willing to push yourself now to earn big later, this role can change your career trajectory.

Our Sales Executives are hunters. We thrive in a fast-paced, high-energy environment and take pride in mastering our craft. The pressure is real — and so are the rewards.

Why This Role Is Different
• Uncapped commissions — your effort directly drives your income
• No cold start — 70,000+ FFLs nationwide, ~2,000 dealers served monthly
• Thousands have never been contacted by Orion — they're buying, just not from us yet
• High-performance culture — daily coaching, clear expectations, real accountability
• Clear growth path — build a book of business that compounds over time
• No nights. No weekends. Just focused work and measurable results

Compensation & Perks

Base Pay
• Year 1: $31,200 annual base + commissions + bonuses + SPIFFs
• Year 2: $25,000 annual base + commissions + bonuses + SPIFFs

Earning Potential
• $50K–$60K: Average first year
• $65K–$70K+: High achievers in year one
• $100K+: Top producers by year two

Training & Support
• 8 weeks of hands-on onboarding
• Ongoing coaching, feedback, and skill development

Tools Provided
• Orion Sales Playbook (built by Grant Cardone fans)
• CRM: Microsoft Business Central
• Leads, product knowledge, and sales support

Schedule & Environment
• Monday–Friday | 9:00 AM – 5:30 PM
• In-person only (Jeffersonville, IN)
• Business casual

What You'll Do
• Win new dealer accounts and grow existing relationships
• Make 80–100 outbound calls per day
• Build trust quickly and close consistently
• Process orders accurately and efficiently
• Stay sharp on products, pricing, industry trends, and compliance
• Participate in daily huddles, coaching, and team development

Who We're Looking For
• Hungry — you want more and are willing to earn it
• Coachable — feedback fuels you, it doesn't offend you
• Competitive — you love winning and pushing yourself
• Resilient — pressure doesn't break you
• Relationship-driven — you build loyalty, not just transactions

Experience in inside sales, B2B sales, or customer service is a huge plus, but attitude and work ethic matter more than a resume.

The Reality Check
This role is demanding. The first year will challenge you. You'll be measured, coached, and pushed. But if you stay consistent, commit to getting better every day, and put in the work, you'll build a strong book of business — and an income level fewer than 1% of people ever reach.

If you want to be surrounded by driven people and build something real, apply today.$desc$
);
