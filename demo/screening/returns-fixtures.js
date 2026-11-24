import { requisitions } from "../../scripts/screening-lab/dataset.mjs";

export const demoReturnsRequisition = { ...requisitions[0], status: "open", department: "Operations", openings: 2 };
const exampleScores = { customer_service: 21, returns: 23, logistics: 16, documentation: 12, systems: 10 };
const evidence = "Managed returns from authorization to refund and recorded carrier tracking in the order system.";

export function seedReturns(state) {
  if (state.legacyReturns) return state;
  const records = [
    {
      id: "demo-returns-jules", first_name: "Synthetic Jules", last_name: "Mercer",
      email: "returns-jules@example.test", phone: "202-555-0129", created_at: "2027-01-18T15:00:00Z",
      resume_path: "demo/returns-jules.pdf", interview_status: "scheduled", interview_at: "2027-01-24T16:00:00Z",
      interview_notes: "Bring a sample reconciliation example.",
      screening_answers: {
        returns: "I manage returns end-to-end, from authorization through receiving and refund reconciliation.",
        labels: "Directly in UPS and FedEx portals, recording tracking in the ticket.",
        deescalation: "Review the history, acknowledge the delay, and agree on a time for the next update.",
        ownership: "Investigate with the warehouse and confirm the receiving scan before updating the customer.",
        accuracy: "Verify source records and the physical item before holding the discrepancy for review.",
        written: "I can see why the delay is frustrating. I’ll confirm the receiving scan today and update you by 3 p.m.",
        schedule: "I can work the posted in-office schedule."
      }
    },
    {
      id: "demo-returns-avery", first_name: "Synthetic Avery", last_name: "Chen",
      email: "returns-avery@example.test", phone: "202-555-0130", created_at: "2027-01-19T15:00:00Z",
      resume_path: "demo/returns-avery.pdf", interview_status: "assessment_completed",
      screening_answers: {
        returns: "I handle customer return inquiries and forward refund exceptions to the team lead.",
        labels: "Through an integrated shipping tool after a lead approved the return.",
        deescalation: "Investigate the status and tell the customer when I’ll follow up.",
        ownership: "Check the tracking and ask receiving to confirm the package location.",
        accuracy: "Verify source records and the physical item before updating the ticket.",
        written: "I’ll check where the return is in receiving and send an update before the end of my shift.",
        schedule: "The posted hours and pay work for me."
      }
    }
  ];
  state.legacyReturns = { records, evaluations: {} };
  for (const record of records) {
    const id = record.id + "-candidate";
    state.candidates.push({ id, full_name: record.first_name + " " + record.last_name, email: record.email, phone: record.phone });
    state.assignments.push({ candidate_id: id, requisition_id: demoReturnsRequisition.id,
      stage: record.interview_at ? "interview" : "screening" });
  }
  state.legacyReturns.evaluations["demo-returns-jules-candidate"] = {
    scores: exampleScores, evidence, gaps: "Volume of escalations is unverified.",
    questions: "Describe one refund discrepancy you resolved.", recruiter_score: 86,
    recruiter_notes: "Historical synthetic recruiter evaluation.", decision: "advance"
  };
  state.interviews.push({ id: "demo-returns-interview", candidate_id: "demo-returns-jules-candidate",
    position_title: demoReturnsRequisition.title, interview_date: "2027-01-24",
    start_time: "11:00", end_time: "11:30", attendance_status: "unverified", interview_format: "Video" });
  return state;
}

export function legacyResume(state, candidateId) {
  const record = state.legacyReturns.records.find(item => item.id + "-candidate" === candidateId);
  return record ? [{ id: record.id + "-resume", storage_path: record.resume_path, original_name: "Synthetic Returns resume.pdf" }] : [];
}

export function legacyDraft(state, candidateId, resumeId) {
  if (!legacyResume(state, candidateId).some(item => item.id === resumeId)) return null;
  const experienced = candidateId === "demo-returns-jules-candidate";
  return {
    scores: experienced ? exampleScores : { customer_service: 16, returns: 12, logistics: 10, documentation: 10, systems: 7 },
    evidence: experienced ? evidence : "Logged return inquiries and forwarded refund exceptions to the lead.",
    gaps: "Independent reconciliation is not established by the sample.",
    questions: "How would you resolve a missing receiving scan?"
  };
}
