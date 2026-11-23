import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { supabase } from "./lib/supabaseClient";

const questions = [
  { id: "returns", label: "Which best describes your hands-on product returns experience?", options: ["I manage returns end-to-end, from authorization through resolution.", "I process return authorizations and labels; other teams complete inspection or refunds.", "I handle customer return inquiries and coordinate with a returns team.", "My experience is primarily general customer service."] },
  { id: "labels", label: "How have you created return shipping labels?", options: ["Directly in UPS, FedEx, or USPS shipping portals.", "Through an integrated order-management or shipping platform.", "Occasionally, with assistance or an established template.", "I have not created return labels myself."] },
  { id: "deescalation", label: "A customer calls for the third time about a delayed refund. What would you do?", options: ["Review the history, acknowledge the frustration, establish the next action, and follow up personally.", "Review the status and explain the standard processing timeframe.", "Contact the refund team and ask them to follow up with the customer.", "Investigate the status and give an estimated resolution timeframe."] },
  { id: "ownership", label: "Tracking shows a return delivered, but the warehouse has not processed it. What is your approach?", options: ["Investigate with the warehouse, update the customer, and track the issue to resolution.", "Check the tracking and internal records, then request a warehouse investigation.", "Tell the customer the package arrived and processing may take longer.", "Escalate the tracking information to a supervisor for direction."] },
  { id: "accuracy", label: "A returned item's serial number differs from the order record. What would you do?", options: ["Verify source records and the physical item, document the discrepancy, and follow the resolution process.", "Ask the warehouse to recheck the item and update the record when confirmed.", "Place the return on hold and escalate to the appropriate manager.", "Contact the customer for clarification and document the response."] },
  { id: "written", label: "Write a brief response to this customer: 'I've waited two weeks for my refund and nobody can tell me what's happening.' Please use your own words and do not use AI to write your response.", type: "text" },
  { id: "schedule", label: "This job pays $21/hour and is full-time in-office in Jeffersonville. Which statement fits?", options: ["The compensation and schedule work for me.", "The schedule works; I would like to discuss compensation.", "The compensation works; I would like to discuss the schedule.", "I would like to discuss both."] }
];

export default function ReturnsAssessmentPage() {
  const [params] = useSearchParams();
  const token = params.get("token") || "";
  const [answers, setAnswers] = useState({});
  const [status, setStatus] = useState("idle");
  const [message, setMessage] = useState("");

  const submit = async (event) => {
    event.preventDefault();
    if (!token) return;
    setStatus("loading");
    setMessage("");
    try {
      // A server-side endpoint validates a one-time token and atomically locks the submission.
      // No candidate IDs or database update privileges are exposed to the browser.
      const { data, error } = await supabase.functions.invoke("submit-returns-assessment", {
        body: { token, answers }
      });
      if (error || !data?.success) {
        setStatus("error");
        setMessage(data?.message || "We couldn't save your answers. Please contact the recruiting team.");
        return;
      }
      setStatus("success");
    } catch {
      setStatus("error");
      setMessage("We couldn't save your answers. Please try again.");
    }
  };

  return <main className="min-h-screen bg-slate-950 px-4 py-10 text-white">
    <div className="mx-auto max-w-2xl">
      <Link to="/careers" className="text-sm text-amber-300">Orion Wholesale Careers</Link>
      <div className="mt-6 rounded-2xl border border-slate-700 bg-slate-900 p-6 shadow-xl sm:p-10">
        <p className="text-xs font-bold uppercase tracking-widest text-amber-300">Application next step</p>
        <h1 className="mt-3 text-3xl font-black">Customer Service & Returns Specialist</h1>
        <p className="mt-3 text-slate-300">Thank you for applying. Please complete these seven short questions. You do not need to reapply or upload your resume.</p>
        {!token ? <p role="alert" className="mt-8 rounded-lg border border-amber-500/40 p-4">Please open the personalized assessment link in your invitation email. This page does not accept general applications.</p> :
        status === "success" ? <div role="status" className="mt-8 rounded-lg border border-emerald-500/50 p-5"><h2 className="text-xl font-bold">Assessment received</h2><p className="mt-2 text-slate-300">Thank you. Your answers have been saved. This assessment can only be submitted once.</p></div> :
        <form onSubmit={submit} className="mt-8 space-y-8">
          {questions.map((q, i) => <fieldset key={q.id} className="space-y-3">
            <legend className="text-base font-semibold">{i + 1}. {q.label}</legend>
            {q.type === "text" ? <textarea required maxLength={3000} rows={5} value={answers[q.id] || ""} onChange={e => setAnswers(a => ({...a, [q.id]: e.target.value}))} className="w-full rounded-lg border border-slate-600 bg-slate-800 p-3 text-white" placeholder="Write your response here..." /> :
            <div className="space-y-2">{q.options.map(option => <label key={option} className="flex cursor-pointer gap-3 rounded-lg border border-slate-700 p-3 hover:border-amber-400"><input type="radio" required name={q.id} value={option} checked={answers[q.id] === option} onChange={() => setAnswers(a => ({...a, [q.id]: option}))} /><span>{option}</span></label>)}</div>}
          </fieldset>)}
          {message && <p role="alert" className="text-rose-300">{message}</p>}
          <button disabled={status === "loading"} className="w-full rounded-lg bg-amber-400 px-6 py-4 font-bold text-black disabled:opacity-50" type="submit">{status === "loading" ? "Submitting..." : "Submit assessment"}</button>
          <p className="text-xs text-slate-400">Only one submission is permitted. Please review your answers before submitting.</p>
        </form>}
      </div>
    </div>
  </main>;
}
