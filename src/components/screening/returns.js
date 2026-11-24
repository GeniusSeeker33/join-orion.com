export const returnsRequisitionId = "a822e721-4d9e-439d-83c8-a1a0a41efbe6";
export const returnsTitle = "Customer Service & Returns Specialist — Compliance Support";
export const isReturnsRequisition = position => position?.id === returnsRequisitionId ||
  /^customer service\b.*\breturns\b/i.test(position?.title?.trim() ?? "");
