const defaults = {
  "Warehouse Middle (Hybrid Maintenance)": [
    ["equipment", "Tape machine operation and maintenance", 35], ["maintenance", "Preventive maintenance and troubleshooting", 25],
    ["safety", "Equipment safety and escalation", 25], ["accuracy", "Warehouse accuracy and documentation", 15]
  ],
  "Warehouse Picker": [
    ["picking", "Order picking and location verification", 35], ["accuracy", "SKU and count accuracy", 30],
    ["systems", "Scanner and inventory workflows", 20], ["safety", "Safe material handling", 15]
  ],
  "Warehouse Packer": [
    ["packing", "Packaging methods and product protection", 35], ["accuracy", "Final count and order verification", 30],
    ["shipping", "Labels and shipping documentation", 20], ["safety", "Safe packing station practices", 15]
  ],
  "Production Assistant": [
    ["work_orders", "Work orders and assembly", 35], ["quality", "Quality checks and escalation", 30],
    ["records", "Production records and handoffs", 20], ["safety", "Safe tooling and work practices", 15]
  ],
  "Cerakote Applicator": [
    ["preparation", "Surface preparation and masking", 30], ["application", "Coating application and process controls", 35],
    ["quality", "Finish inspection and rework", 20], ["safety", "Ventilation and safe material handling", 15]
  ],
  "Sales Executive": [
    ["discovery", "Customer discovery and qualification", 30], ["sales", "Sales process and follow-through", 30],
    ["systems", "Pipeline documentation and CRM", 20], ["communication", "Product communication and account support", 20]
  ]
};

export function defaultRubric(title) {
  const rows = Object.hasOwn(defaults, title) ? defaults[title] : null;
  return rows ? { version: 1, categories: rows.map(([id, label, weight]) => ({ id, label, weight })) } : null;
}

export const personalCriterion = /\b(?:age|race|ethnicity|religion|national origin|citizenship|immigration status|pregnan\w*|disabilit\w*|gender|sexual orientation|date of birth|marital status|medical condition)\b/i;

export function validCategories(categories) {
  return Array.isArray(categories) && categories.length >= 2 && categories.length <= 12 &&
    new Set(categories.map(category => category?.id)).size === categories.length &&
    categories.every(category => category && /^[a-z][a-z0-9_]{0,39}$/.test(category.id) &&
      typeof category.label === "string" && category.label.trim().length >= 4 && category.label.length <= 160 &&
      !personalCriterion.test(category.label) &&
      Number.isInteger(category.weight) && category.weight > 0 && category.weight <= 100) &&
    categories.reduce((sum, category) => sum + category.weight, 0) === 100;
}

export function scoreSummary(rubric, scores) {
  let points = 0;
  let covered = 0;
  for (const category of rubric?.categories ?? []) {
    const score = scores?.[category.id];
    if (!Number.isInteger(score) || score < 0 || score > category.weight) continue;
    points += score;
    covered += category.weight;
  }
  return { points, covered, total: covered === 100 ? points : null };
}

export function scoreLabel(rubric, scores) {
  const { points, covered, total } = scoreSummary(rubric, scores);
  if (total !== null) return `${total} / 100`;
  return covered ? `${points} / ${covered} assessed · incomplete` : "Unverified";
}

export const decisionLabels = {
  pending: "Review further", contact: "Call candidate", interview: "Schedule interview",
  hold: "Hold", closed: "Not a fit"
};
