import { createRoot } from "react-dom/client";
import ATSWorkspace from "../../src/ATSWorkspace.jsx";
import "./styles.css";
import { readQuestionnaire } from "./store.js";

const assessment = window.location.pathname.match(/^\/assessment\/([^/]+)$/);
const questionnaire = assessment && readQuestionnaire(assessment[1]);

export default function Demo() {
  return <>
    <header className="sticky top-0 z-50 border-b border-amber-400 bg-amber-300 px-5 py-3 text-slate-950">
      <strong>DEMONSTRATION — SYNTHETIC DATA ONLY</strong>
      <p className="text-sm">Changes stay in this browser. Use synthetic notes and review the sample resumes. Evidence drafts use preset excerpts.</p>
    </header>
    {assessment ? <main className="min-h-screen space-y-4 bg-slate-950 p-6 text-slate-100">
      <a className="underline" href="/ats">Back to ATS</a>
      <h1 className="text-2xl font-bold">{questionnaire?.title ?? "Assessment unavailable"}</h1>
      {questionnaire && <>
        <p>Published preview · Version {questionnaire.version}</p>
        <ol className="list-decimal space-y-2 pl-6">
          {questionnaire.questions.map(question => <li key={question.id}>{question.prompt}</li>)}
        </ol>
      </>}
    </main> : <ATSWorkspace />}
  </>;
}
createRoot(document.getElementById("root")).render(<Demo />);
