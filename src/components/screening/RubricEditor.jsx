import { useEffect, useState } from "react";
import { screeningRequest } from "./client";
import { defaultRubric, validCategories } from "./rubrics";

export default function RubricEditor({ requisition }) {
  const [history, setHistory] = useState([]);
  const [categories, setCategories] = useState([]);
  const [version, setVersion] = useState(1);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const requisitionId = requisition.id;
  useEffect(() => {
    if (!defaultRubric(requisition.title)) return;
    let live = true;
    screeningRequest("rubric", { requisitionId }).then(({ history }) => {
      if (!live) return;
      setHistory(history);
      setCategories(history[0]?.categories ?? []);
      setVersion(history[0]?.version ?? 1);
    }).catch(error => { if (live) setMessage(error.message); });
    return () => { live = false; };
  }, [requisitionId, requisition.title]);

  function choose(item) {
    setVersion(item.version);
    setCategories(item.categories);
    setMessage("");
  }

  async function publish(event) {
    event.preventDefault();
    setBusy(true);
    try {
      const result = await screeningRequest("publishRubric", { requisitionId, version, categories });
      setHistory(result.history);
      choose(result.history[0]);
      setMessage("New rubric version published.");
    } catch (error) {
      setMessage(error.message);
    } finally {
      setBusy(false);
    }
  }

  if (!defaultRubric(requisition.title)) return null;
  const editable = history[0]?.version === version;
  const change = (id, field, value) =>
    setCategories(items => items.map(item => item.id === id ? { ...item, [field]: value } : item));
  const total = categories.reduce((sum, item) => sum + (Number(item.weight) || 0), 0);

  return <section className="mt-7 space-y-3 border-t border-slate-700 pt-5">
    <h3 className="text-lg font-semibold">Resume evaluation rubric</h3>
    <p className="text-sm text-slate-300">Use job-related criteria only. Published versions and verified evaluations retain their original weights.</p>
    {message && <p role="status">{message}</p>}
    {history.length > 0 && <form className="space-y-3" onSubmit={publish}>
      <label>Rubric version <select className="rounded bg-slate-800 p-2" value={version}
        onChange={event => choose(history.find(item => item.version === Number(event.target.value)))}>
        {history.map(item => <option key={item.version} value={item.version}>Version {item.version}</option>)}
      </select></label>
      {categories.map((category, index) => <div key={category.id} className="grid gap-2 sm:grid-cols-[1fr_8rem_auto]">
        <label>Criterion {index + 1}<input className="block w-full rounded bg-slate-800 p-2" value={category.label}
          disabled={!editable || busy} onChange={event => change(category.id, "label", event.target.value)} /></label>
        <label>Points {index + 1}<input className="block w-full rounded bg-slate-800 p-2" type="number" min="1" max="100"
          value={category.weight} disabled={!editable || busy}
          onChange={event => change(category.id, "weight", Number(event.target.value))} /></label>
        <button type="button" className="self-end rounded bg-slate-700 p-2" disabled={!editable || busy || categories.length <= 2}
          aria-label={`Remove criterion ${index + 1}`} onClick={() => setCategories(items => items.filter(item => item.id !== category.id))}>Remove</button>
      </div>)}
      <p>Total weight {total} / 100</p>
      <div className="flex flex-wrap gap-2">
        <button type="button" className="rounded bg-slate-700 p-2" disabled={!editable || busy || categories.length >= 12}
          onClick={() => setCategories(items => [...items, { id: "criterion_" + crypto.randomUUID().replaceAll("-", "").slice(0, 24), label: "", weight: 1 }])}>Add criterion</button>
        <button className="rounded bg-amber-300 p-2 font-semibold text-slate-950 disabled:opacity-50"
          disabled={!editable || busy || !validCategories(categories)}>Publish rubric version</button>
      </div>
    </form>}
  </section>;
}
