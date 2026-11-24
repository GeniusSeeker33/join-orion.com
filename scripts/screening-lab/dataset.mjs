import { screeningTemplates } from "../../src/components/screening/templates.js";

const fixtureId = number => `4ab00000-0000-4000-8000-${String(number).padStart(12, "0")}`;
export const postings = screeningTemplates.map(({ title, questions }, index) => ({
  id: fixtureId(index + 1), title, questions,
  requisition: fixtureId(index + 21),
  alternate: index === 2 ? fixtureId(27) : undefined,
  application: fixtureId(index + 41),
  email: `applicant-${index + 1}@example.test`,
  phone: `812-555-01${String(index + 1).padStart(2, "0")}`
}));

export const requisitions = postings.flatMap(posting => posting.alternate
  ? [{ id: posting.requisition, title: "Warehouse Picker" }, { id: posting.alternate, title: "Warehouse Packer" }]
  : [{ id: posting.requisition, title: posting.title }]);
