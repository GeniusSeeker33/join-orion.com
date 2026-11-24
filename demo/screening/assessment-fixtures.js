const warehouse = {
  experience: "I picked from numbered bins with a handheld scanner and packed small hardware orders using the station’s carton guide.",
  accuracy: "I would stop the order, compare the SKU and bin label with the pick ticket, and ask the inventory lead to verify the bin.",
  quality: "I check the count and SKU against the pick ticket, add the specified padding, then match the shipping label to the order.",
  workload: "I would leave the item in place, tell the lead what equipment is missing, and ask them to reassign or reschedule the lift."
};

const responses = {
  "Warehouse Middle (Hybrid Maintenance)": {
    maintenance: "I replaced worn tape-machine rollers and cleared routine jams after isolation. I logged electrical faults for qualified maintenance.",
    warehouse: "I picked hardware from numbered bins, checked carton labels against pick lists, and cleaned the tape-machine guides at shift end.",
    priorities: "I would block off the wet walkway and alert the lead, then isolate the jamming machine and move urgent orders to the approved backup station.",
    accuracy: "I would hold the carton, compare its SKU and count with the pick list, and record the discrepancy before asking the lead to release it.",
    handoff: "I tracked the sprinkler calibration date in the maintenance log and handed over the next due check and any open repairs at shift change."
  },
  "Warehouse Picker": warehouse,
  "Warehouse Packer": warehouse,
  "Production Assistant": {
    experience: "I assembled small batches from printed work orders and checked the first unit against the sample before continuing.",
    quality: "I would set the workpiece aside, compare the label with the current work order revision, and ask the lead to resolve the mismatch.",
    safety: "I cleared the bench at shift change, checked the guards and tools, and wore the PPE listed at the station.",
    handoff: "I would record the order number, last completed unit, rejected parts, and any open checks for the next operator."
  },
  "Cerakote Applicator": {
    experience: "I degreased test panels, masked contact surfaces, and inspected coated samples under the shop light after curing.",
    quality: "I would hold the part, mark the affected area on the inspection record, and notify the coating lead before scheduling rework.",
    safety: "I checked ventilation before starting, used the specified PPE, and kept cleaning solvent in the labeled cabinet.",
    documentation: "I would match the part and revision to the work order, verify the finish code, and record the batch and inspection results."
  },
  "Sales Executive": {
    experience: "I built a list of regional dealers, checked their product mix before outreach, and entered call outcomes and next steps in the CRM.",
    relationships: "I sent a buyer a concise weekly stock update and recorded delivery commitments in the account notes for the support team.",
    coachability: "My lead suggested asking about the buyer’s current assortment before pitching. I practiced the opener and brought call notes to our next coaching session.",
    training: "I can attend the onboarding sessions and would practice one technique from each session before reviewing calls with my coach.",
    prospecting: "I would record the reason for declining, confirm whether follow-up is welcome, and schedule it only if we agreed on a next step.",
    orders: "I would confirm the order number and discrepancy, route the case to fulfillment, and set a specific time to update the dealer."
  }
};

const logistics = {
  availability: "I can work the posted on-site schedule.",
  compensation: "The posted range works for me. I would confirm the details during the recruiter call.",
  transportation: "I can reliably get to the work location for scheduled shifts.",
  essential_functions: "I can perform the listed duties. I would confirm site procedures during onboarding."
};

export function assessmentResponse(title, question, applicationId) {
  if (!applicationId.endsWith("-A") && ["experience", "maintenance", "warehouse"].includes(question)) {
    const training = {
      experience: "Most of my experience is from supervised practice. I followed the checklist and asked the lead to verify my work.",
      maintenance: "I helped with daily cleaning and inspections. The lead handled repairs and showed me how to record faults.",
      warehouse: "I verified counts and labels at a packing station. I observed the lead operating the tape machine during training."
    };
    return training[question];
  }
  return responses[title]?.[question] ?? logistics[question];
}
