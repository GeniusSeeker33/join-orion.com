const logistics = [
  ["availability", "Can you work the schedule listed in this posting? Describe any availability constraints you want us to consider."],
  ["compensation", "What compensation range are you seeking for this position?"],
  ["transportation", "Can you reliably report to the work location for scheduled shifts?"]
];

function template(title, questions, functions, logisticsQuestions = logistics) {
  return {
    title,
    questions: [...questions, ...logisticsQuestions, [
      "essential_functions",
      `Can you perform the following essential functions, with or without reasonable accommodation? ${functions} Please do not disclose medical information.`
    ]].map(([id, prompt]) => ({ id, prompt }))
  };
}

export const screeningTemplates = [
  template("Customer Service & Returns Specialist — Compliance Support", [
    ["returns", "Describe your hands-on experience with returns, exchanges or order resolution. Which steps did you own?"],
    ["labels", "Which carrier portals or order-management tools have you used to create and track return labels?"],
    ["deescalation", "A customer calls a third time about a delayed refund. How would you respond and set expectations?"],
    ["ownership", "Tracking shows a return was delivered but receiving has no record. What would you do and how would you follow up?"],
    ["accuracy", "A returned item's serial number differs from the order record. How would you verify and record the discrepancy?"],
    ["compliance_support", "After training, you notice required information is missing from a compliance-support record. What would you document and when would you escalate it?"],
    ["written", "In your own words, write a brief reply to a customer who has waited two weeks for a refund and has received no update."]
  ], "Handle customer inquiries, maintain accurate records, and coordinate returned orders with warehouse and inventory staff."),
  template("Warehouse Middle (Hybrid Maintenance)", [
    ["maintenance", "Describe your previous building or equipment maintenance work. Which tasks did you handle yourself, and which required escalation? Examples could include facility repairs, minor plumbing, landscaping or routine checks."],
    ["warehouse", "Describe experience picking from bins, verifying labels and sealing packages. What experience do you have operating and performing routine maintenance on a tape machine or similar packing equipment?"],
    ["priorities", "A tape machine begins jamming while orders are due, and a coworker reports a wet walkway. How would you keep people safe, prioritize the work and communicate with your team?"],
    ["accuracy", "Before shipment, you find that a carton label and the pick list disagree. What would you check, document and communicate?"],
    ["handoff", "Describe how you keep track of recurring maintenance work, such as monthly sprinkler calibration, and hand off unfinished items when you are reassigned to the warehouse."]
  ], "Split time between assigned maintenance and warehouse duties, work safely with teammates, and lift and carry up to 70 pounds repetitively.", [
    ["availability", "This on-site role in Jeffersonville, Indiana runs Monday–Friday, 8:00 AM–4:30 PM Eastern. Can you work that schedule?"],
    ["compensation", "The posted pay is $19–$20 per hour. Is this range consistent with your compensation expectations?"],
    logistics[2]
  ]),
  template("Warehouse Picker/Packer", [
    ["experience", "Describe your order picking, packing, labeling or inventory experience and the tools you have used."],
    ["accuracy", "The item in a bin looks similar to the order item but has a different SKU. What would you do before packing it?"],
    ["quality", "How would you verify an order before sealing and labeling it for shipment?"],
    ["workload", "A rush order contains an item that cannot be moved safely with the equipment at your station. How would you protect safety and keep the team informed?"]
  ], "Pick and pack orders accurately, follow warehouse safety procedures and lift up to 60 pounds."),
  template("Production Assistant", [
    ["experience", "Describe production or shop work where you followed written instructions and performed quality checks."],
    ["quality", "You find a mislabeled workpiece and the written work order is unclear. What would you do before proceeding?"],
    ["safety", "Describe how you maintained an organized workstation and followed PPE and routine equipment-maintenance procedures."],
    ["handoff", "You are reassigned to another production station while a batch is in progress. What would you record and communicate so the next person can pick up safely?"]
  ], "Follow shop instructions, perform assigned production support and equipment upkeep, stand most of the workday and lift up to 50 pounds."),
  template("Cerakote Applicator", [
    ["experience", "Describe coating, surface preparation or finish inspection experience, training or transferable shop experience."],
    ["quality", "During inspection you notice uneven finish on a workpiece. How would you document it and decide whom to notify before it moves forward?"],
    ["safety", "Describe how you maintain a coating workstation and follow written specifications and PPE procedures."],
    ["documentation", "Two work orders call for similar finishes but have different specifications. How would you verify the correct work order and document your quality check?"]
  ], "Prepare and inspect coated parts, follow shop safety procedures, stand most of the workday and lift up to 50 pounds."),
  template("Sales Executive", [
    ["experience", "Describe your outbound prospecting experience. How did you identify business prospects, prepare for outreach and track next steps in a CRM?"],
    ["relationships", "Describe a B2B customer relationship you developed over time. How did you adapt your communication to the customer and keep commitments visible in the CRM?"],
    ["coachability", "Tell us about feedback that changed your sales approach. How did you practice the change and respond when early outreach did not go as planned?"],
    ["training", "This role includes eight weeks of structured onboarding and ongoing coaching. Are you willing to participate, and how would you apply what you learn to your calls?"],
    ["prospecting", "A prospective dealer declines after an initial call. How would you record the conversation and decide on an appropriate next step?"],
    ["orders", "A dealer reports an order discrepancy while you are handling outbound calls. How would you coordinate a resolution and keep your commitments?"]
  ], "Make outbound calls, manage dealer relationships, record activity in the CRM and process orders accurately.")
];

// Labels for answers captured before versioned questionnaires were introduced.
export const legacyReturnsQuestions = [
  ["returns", "Which best describes your hands-on product returns experience?"],
  ["labels", "How have you created return shipping labels?"],
  ["deescalation", "A customer calls for the third time about a delayed refund. What would you do?"],
  ["ownership", "Tracking shows a return delivered, but the warehouse has not processed it. What is your approach?"],
  ["accuracy", "A returned item's serial number differs from the order record. What would you do?"],
  ["written", "Write a brief response to this customer: 'I've waited two weeks for my refund and nobody can tell me what's happening.' Please use your own words and do not use AI to write your response."],
  ["schedule", "This job pays $21/hour and is full-time in-office in Jeffersonville. Which statement fits?"]
].map(([id, prompt]) => ({ id, prompt }));
