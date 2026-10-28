import { useState } from "react";

// Ported campaign-planning fields from the Sales Simulation Marketing Command Center.
// Drafts are intentionally browser-local until the shared marketing API is authorized.
const blank = { name: "", description: "", objectives: "", target_audiences: "", channels: "Organic social, Meta", budget_amount: "250", starts_on: "", ends_on: "", primary_cta: "Apply Now at Join-Orion.com" };
export default function MarketingCampaignPlanner() {
  const [form, setForm] = useState(() => {
    try { return { ...blank, ...JSON.parse(localStorage.getItem("join-orion-marketing-draft-v1") || "{}") }; }
    catch { return blank; }
  });
  const [saved, setSaved] = useState(false);
  const change = e => { setForm(v => ({ ...v, [e.target.name]: e.target.value })); setSaved(false); };
  const fields = [
    ["name", "Campaign name", "text"],
    ["description", "Description / offer", "textarea"],
    ["objectives", "Objectives (comma separated)", "text"],
    ["target_audiences", "Target audiences (comma separated)", "text"],
    ["channels", "Channels (comma separated)", "text"],
    ["primary_cta", "Primary call to action", "text"],
    ["budget_amount", "Planned budget (USD)", "number"],
    ["starts_on", "Start date", "date"],
    ["ends_on", "End date", "date"],
  ];
  return <section className="rounded-xl border border-slate-700 bg-slate-900 p-6 mt-6">
    <h2 className="text-xl font-semibold mb-2">Campaign planning</h2>
    <p className="text-slate-400 mb-5">Adapted from the existing Sales Simulation campaign form. Browser-local planning only: no database write, approval, or publication.</p>
    <form className="grid gap-4 md:grid-cols-2" onSubmit={e => {
      e.preventDefault();
      if (form.starts_on && form.ends_on && form.ends_on < form.starts_on) return;
      localStorage.setItem("join-orion-marketing-draft-v1", JSON.stringify(form));
      setSaved(true);
    }}>
      {fields.map(([name,label,type]) => <label key={name} className={type==="textarea"?"md:col-span-2 grid gap-2":"grid gap-2"}>
        <span className="text-sm text-slate-300">{label}</span>
        {type==="textarea" ? <textarea name={name} value={form[name]} onChange={change} maxLength={4000} rows={3} className="rounded bg-slate-800 border border-slate-600 p-3" /> :
        <input name={name} value={form[name]} onChange={change} type={type} required={name==="name"} min={type==="number"?"0":undefined} className="rounded bg-slate-800 border border-slate-600 p-3" />}
      </label>)}
      {form.starts_on && form.ends_on && form.ends_on < form.starts_on && <p role="alert" className="md:col-span-2 text-red-300">End date must not precede start date.</p>}
      <div className="md:col-span-2 flex flex-wrap gap-3 items-center">
        <button type="submit" disabled={!!(form.starts_on && form.ends_on && form.ends_on < form.starts_on)} className="rounded bg-amber-400 text-slate-950 font-semibold px-5 py-3 disabled:opacity-50">Save browser-local draft</button>
        <button type="button" className="rounded border border-slate-600 px-5 py-3" onClick={() => {
          localStorage.removeItem("join-orion-marketing-draft-v1"); setForm(blank); setSaved(false);
        }}>Clear draft</button>
        {saved && <span role="status" className="text-emerald-300">Saved in this browser only.</span>}
      </div>
    </form>
  </section>;
}
