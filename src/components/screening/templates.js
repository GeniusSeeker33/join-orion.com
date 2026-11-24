const logistics = [
  ["availability", "Can you work the schedule listed in this posting? Describe any availability constraints you want us to consider."],
  ["compensation", "What compensation range are you seeking for this position?"],
  ["transportation", "Can you reliably report to the work location for scheduled shifts?"]
];

function template(title, questions, functions) {
  return {
    title,
    questions: [...questions, ...logistics, [
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
    ["written", "In your own words, write a brief reply to a customer who has waited two weeks for a refund and has received no update."]
  ], "Handle customer inquiries, maintain accurate records, and coordinate returned orders with warehouse and inventory staff."),
  template("Warehouse Middle (Hybrid Maintenance)", [
    ["experience", "Which warehouse and routine maintenance responsibilities described in this posting have you handled? Give an example."],
    ["priorities", "A warehouse task is due when equipment starts operating abnormally. How would you prioritize, communicate and document your next steps?"],
    ["handoff", "Describe a shift handoff where you had to communicate an unresolved warehouse or maintenance issue."]
  ], "Carry out the warehouse and maintenance duties listed in the posting and follow site safety procedures."),
  template("Warehouse Picker/Packer", [
    ["experience", "Describe your order picking, packing, labeling or inventory experience and the tools you have used."],
    ["accuracy", "The item in a bin looks similar to the order item but has a different SKU. What would you do before packing it?"],
    ["quality", "How would you verify an order before sealing and labeling it for shipment?"]
  ], "Pick and pack orders accurately, follow warehouse safety procedures and lift up to 60 pounds."),
  template("Production Assistant", [
    ["experience", "Describe production or shop work where you followed written instructions and performed quality checks."],
    ["quality", "You find a mislabeled workpiece and the written work order is unclear. What would you do before proceeding?"],
    ["safety", "Describe how you maintained an organized workstation and followed PPE and routine equipment-maintenance procedures."]
  ], "Follow shop instructions, perform assigned production support and equipment upkeep, stand most of the workday and lift up to 50 pounds."),
  template("Cerakote Applicator", [
    ["experience", "Describe coating, surface preparation or finish inspection experience, training or transferable shop experience."],
    ["quality", "During inspection you notice uneven finish on a workpiece. How would you document it and decide whom to notify before it moves forward?"],
    ["safety", "Describe how you maintain a coating workstation and follow written specifications and PPE procedures."]
  ], "Prepare and inspect coated parts, follow shop safety procedures, stand most of the workday and lift up to 50 pounds."),
  template("Sales Executive", [
    ["experience", "Describe your inside-sales or outbound outreach experience, including the systems you used to track follow-ups."],
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
  ["written", "Write a brief response to this customer: 'I've waited two weeks for my refund and nobody can tell me what's happening.'"],
  ["schedule", "This job pays $21/hour and is full-time in office in Jeffersonville. Which statement fits?"]
].map(([id, prompt]) => ({ id, prompt }));
