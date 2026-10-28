import { useMemo, useState } from "react";

const STORAGE = "join-orion-marketing-assets-v1";
const TYPES = ["Facebook post", "LinkedIn post", "Recruiting email", "Ad copy", "Landing page copy"];
const starter = { id: "", title: "", type: TYPES[0], campaign: "Sales Executive recruiting", headline: "", body: "", cta: "Apply Now at Join-Orion.com", status: "draft", notes: "" };
function readDrafts() { try { const data = JSON.parse(localStorage.getItem(STORAGE) || "[]"); return Array.isArray(data) ? data : []; } catch { return []; } }
export default function MarketingContentStudio() {
  const [assets, setAssets] = useState(readDrafts);
  const [form, setForm] = useState(starter);
  const [message, setMessage] = useState("");
  const [filter, setFilter] = useState("all");
  const shown = useMemo(() => assets.filter(a => filter === "all" || a.status === filter), [assets,filter]);
  function save(e) {
    e.preventDefault();
    if (!form.title.trim() || !form.body.trim()) { setMessage("Add a title and content before saving."); return; }
    const item = { ...form, id: form.id || crypto.randomUUID(), updated_at: new Date().toISOString() };
    const next = [item, ...assets.filter(a => a.id !== item.id)];
    try { localStorage.setItem(STORAGE, JSON.stringify(next)); setAssets(next); setForm(starter); setMessage("Draft saved in this browser only. No publishing or approval occurred."); }
    catch { setMessage("Could not save to this browser. Check storage permissions or available space."); }
  }
  function edit(asset) { setForm(asset); setMessage("Editing existing draft."); window.scrollTo({top:0,behavior:"smooth"}); }
  function remove(id) {
    const next = assets.filter(a => a.id !== id);
    try { localStorage.setItem(STORAGE,JSON.stringify(next)); setAssets(next); setMessage("Local draft deleted."); }
    catch { setMessage("Could not delete the local draft."); }
  }
  return <div className="grid gap-6">
    <section className="rounded-xl border border-slate-700 bg-slate-900 p-6">
      <h2 className="text-xl font-semibold">Content Studio</h2>
      <p className="text-slate-400 mt-2 mb-5">Create and revise recruiting copy. Saved locally in this browser, not in Supabase. Review requests, publication and agent generation are disabled until the shared backend is connected.</p>
      <form onSubmit={save} className="grid md:grid-cols-2 gap-4">
        <label className="grid gap-2"><span>Asset title</span><input required maxLength={160} className="rounded bg-slate-800 border border-slate-600 p-3" value={form.title} onChange={e=>setForm({...form,title:e.target.value})} /></label>
        <label className="grid gap-2"><span>Format</span><select className="rounded bg-slate-800 border border-slate-600 p-3" value={form.type} onChange={e=>setForm({...form,type:e.target.value})}>{TYPES.map(t=><option key={t}>{t}</option>)}</select></label>
        <label className="grid gap-2"><span>Campaign</span><input maxLength={160} className="rounded bg-slate-800 border border-slate-600 p-3" value={form.campaign} onChange={e=>setForm({...form,campaign:e.target.value})}/></label>
        <label className="grid gap-2"><span>Headline</span><input maxLength={200} className="rounded bg-slate-800 border border-slate-600 p-3" value={form.headline} onChange={e=>setForm({...form,headline:e.target.value})}/></label>
        <label className="grid gap-2 md:col-span-2"><span>Copy</span><textarea required rows={8} maxLength={12000} className="rounded bg-slate-800 border border-slate-600 p-3" value={form.body} onChange={e=>setForm({...form,body:e.target.value})}/></label>
        <label className="grid gap-2"><span>Call to action</span><input maxLength={200} className="rounded bg-slate-800 border border-slate-600 p-3" value={form.cta} onChange={e=>setForm({...form,cta:e.target.value})}/></label>
        <label className="grid gap-2"><span>Internal review notes</span><input maxLength={2000} className="rounded bg-slate-800 border border-slate-600 p-3" value={form.notes} onChange={e=>setForm({...form,notes:e.target.value})}/></label>
        <div className="md:col-span-2 flex gap-3 flex-wrap"><button className="bg-amber-400 text-slate-950 rounded px-5 py-3 font-semibold">Save local draft</button><button type="button" className="border border-slate-600 rounded px-5 py-3" onClick={()=>{setForm(starter);setMessage("");}}>New draft</button></div>
      </form>
      {message && <p role="status" className="text-amber-200 mt-4">{message}</p>}
    </section>
    <section className="rounded-xl border border-slate-700 bg-slate-900 p-6">
      <div className="flex justify-between gap-3 flex-wrap"><h2 className="text-xl font-semibold">Saved local assets ({assets.length})</h2><label className="flex gap-2 items-center">Show <select value={filter} onChange={e=>setFilter(e.target.value)} className="bg-slate-800 rounded p-2"><option value="all">All</option><option value="draft">Drafts</option></select></label></div>
      {!shown.length && <p className="text-slate-400 mt-4">No local content drafts yet.</p>}
      {shown.map(a=><article key={a.id} className="border-t border-slate-700 mt-4 pt-4"><div className="flex justify-between gap-3 flex-wrap"><div><h3 className="font-semibold">{a.title}</h3><p className="text-slate-400 text-sm">{a.type} · {a.campaign} · Draft (not approved)</p></div><div className="flex gap-3"><button type="button" className="text-amber-300 underline" onClick={()=>edit(a)}>Edit</button><button type="button" className="text-red-300 underline" onClick={()=>remove(a.id)}>Delete</button></div></div><p className="whitespace-pre-wrap mt-3 text-slate-300">{a.headline ? a.headline+"\n" : ""}{a.body}</p><p className="text-amber-200 mt-2">{a.cta}</p></article>)}
    </section>
  </div>;
}
