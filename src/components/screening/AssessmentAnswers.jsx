import { legacyReturnsQuestions } from "./templates";

export default function AssessmentAnswers({ application, questionnaire, open = false }) {
  if (!application.screening_answers) return <p className="text-sm text-slate-400">Assessment pending</p>;
  const questions = application.screening_version_id ? questionnaire?.questions : legacyReturnsQuestions;
  const labels = new Map(questions?.map(({ id, prompt }) => [id, prompt]));

  return <details open={open}>
    <summary className="cursor-pointer font-semibold">Assessment answers{application.screening_version_id && questionnaire ? ` · Version ${questionnaire.version}` : ""}</summary>
    <dl className="mt-3 grid gap-3">
      {Object.entries(application.screening_answers).map(([id, answer]) => <div key={id}>
        <dt className="text-sm font-semibold text-amber-200">{labels.get(id) ?? id}</dt>
        <dd className="whitespace-pre-wrap break-words">{String(answer)}</dd>
      </div>)}
    </dl>
  </details>;
}
