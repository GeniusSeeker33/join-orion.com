import { useEffect, useState } from "react";
import { marketingDevClient } from "../../lib/marketingDevClient";
import ATSResumeEvaluation from "../../ATSResumeEvaluation";
import { isReturnsRequisition } from "./returns";

export default function ReturnsCandidateEvaluation({ candidateId }) {
  const [assignment, setAssignment] = useState(null);
  useEffect(() => {
    let live = true;
    marketingDevClient.rpc("ats_admin_requisitions").then(({ data }) => {
      if (!live) return;
      const returns = data?.requisitions?.find(isReturnsRequisition);
      if (returns && data?.assignments?.some(item =>
        item.requisition_id === returns.id && item.candidate_id === candidateId)) {
        setAssignment(returns.id);
      }
    });
    return () => { live = false; };
  }, [candidateId]);
  return assignment && <ATSResumeEvaluation candidateId={candidateId} requisitionId={assignment} />;
}
