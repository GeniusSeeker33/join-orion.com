-- Add the Collections Clerk and Order Validation Specialist postings to the
-- public careers page, and hide the Sales Trainer role.
--
-- We soft-delete the Sales Trainer posting (is_active = false) instead of a
-- hard delete so any existing candidate_applications rows that reference this
-- position_id are preserved with their full history intact.

update public.job_postings
  set is_active = false
  where title = 'Sales Trainer';

-- 1. Collections Clerk
insert into public.job_postings (title, department, location, employment_type, hours, pay, description)
values (
  'Collections Clerk',
  'Accounting',
  'Jeffersonville, IN',
  'Full-time',
  '1st Shift',
  '$22.00/hour',
$desc$About Orion Wholesale
Orion Wholesale is one of the nation's leading distributors in the shooting sports industry, supplying firearms, ammunition, accessories, and outdoor products to dealers across the United States.

Job Overview
The Collections Clerk is responsible for managing accounts receivable and ensuring timely collection of outstanding dealer balances. This role supports cash flow by monitoring aging accounts, maintaining accurate records, and communicating professionally with customers to resolve payment issues.

Key Responsibilities

Accounts Receivable & Collections
• Monitor accounts receivable aging and prioritize collection efforts
• Contact dealers regarding overdue balances via phone, email, and written correspondence
• Negotiate payment arrangements while maintaining positive dealer relationships
• Record and maintain detailed notes on all collection activity and communications
• Prepare and distribute account statements, invoices, and delinquency notices
• Manage credit insurance collection policies to insure seamless claims process

Reporting & Reconciliation
• Maintain accurate receivable records and reconcile customer accounts
• Generate aging reports, collection activity summaries, and cash forecasts
• Identify trends in late payments or disputes and recommend process improvements

Qualifications
• High school diploma required; Associate's degree in Accounting, Finance, or Business preferred
• 1–3 years of experience in collections, accounts receivable, or credit support
• Strong understanding of basic accounting and collection practices
• Proficiency with Microsoft Excel and accounting/ERP systems
• Excellent communication and negotiation skills
• High attention to detail and strong organizational ability

Preferred Experience
• Experience working with B2B collections (dealer or wholesale environment)
• Familiarity with credit risk evaluation and payment terms
• Experience in regulated industries (firearms, banking, or similar compliance-driven fields)$desc$
);

-- 2. Order Validation Specialist
insert into public.job_postings (title, department, location, employment_type, hours, pay, description)
values (
  'Order Validation Specialist',
  'Warehouse',
  'Jeffersonville, IN',
  'Full-time',
  '1st Shift',
  '$17.00/hour',
$desc$About Orion Wholesale
Orion Wholesale is a nationwide distributor serving the shooting sports industry with over 500 product lines. We are committed to exceptional customer service, operational excellence, and maintaining one of the most accurate inventory systems in the industry.

Position Overview
We are seeking a highly detail-oriented Order Validation Specialist to serve as the final quality checkpoint before customer orders are shipped.

This role is responsible for reviewing every outgoing order to ensure the correct products, quantities, serial numbers, and shipping information have been picked and packed accurately. The ideal candidate takes pride in precision, notices small details others miss, and understands that even a single mistake can impact the customer experience. If you're the type of person who double-checks everything, enjoys working with numbers and product information, and values accuracy over speed, this role may be a perfect fit.

What You'll Do

Order Verification & Quality Control
• Review all outgoing customer orders prior to shipment
• Verify products, quantities, item numbers, and order contents match the packing documentation
• Confirm serialized products contain the correct serial numbers
• Identify and correct order discrepancies before shipment
• Ensure packages meet company quality standards before sealing and shipping

Investigation & Problem Solving
• Research order discrepancies and inventory issues
• Work closely with warehouse team members to resolve picking and packing errors
• Escalate recurring issues and identify opportunities for process improvement
• Maintain a high level of accuracy while working efficiently

Documentation & Systems
• Utilize warehouse management software and computer systems to validate orders
• Review order reports and shipping documentation
• Maintain accurate records of discrepancies and corrections

What We're Looking For

Required Skills
• Exceptional attention to detail
• Ability to identify small differences in product numbers, SKUs, serial numbers, and quantities
• Comfortable working on a computer throughout the day
• Strong organizational and problem-solving skills
• Ability to remain focused while performing repetitive tasks
• Ability to follow established procedures consistently

Physical Requirements
• Ability to stand and walk for extended periods throughout the workday
• Ability to move throughout warehouse aisles and workstations
• Ability to lift up to 50 pounds occasionally

Preferred Qualifications
• Previous warehouse, quality control, inventory, auditing, or shipping experience
• Experience with warehouse management systems (WMS)
• Experience reviewing orders, inventory, or serialized products
• Basic computer and data-entry skills

Success in This Role
The ideal candidate:
• Notices mistakes others miss
• Takes pride in accuracy
• Works with urgency without sacrificing quality
• Can stay focused on detailed tasks for extended periods
• Understands that every order represents a customer's experience with Orion Wholesale

Why Join Orion Wholesale?
• Stable, growing company
• Advancement opportunities
• Team-oriented environment
• Employee discounts
• Paid time off
• Health, dental, and vision benefits
• 401(k) with company match

At Orion Wholesale, accuracy matters. If you enjoy finding errors before they become problems and take pride in delivering quality work, we'd love to hear from you.$desc$
);
