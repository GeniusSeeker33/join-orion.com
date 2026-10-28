import { useEffect, useMemo, useState } from "react";
import { marketingDevClient } from "./lib/marketingDevClient";
import { saveMarketingDraft } from "./lib/marketingDevStorage";

const STORAGE = "join-orion-marketing-assets-v1";
const TYPES = ["Facebook post", "LinkedIn post", "Recruiting email", "Ad copy", "Landing page copy"];
const starter = { id: "", title: "", type: TYPES[0], campaign: "Sales Executive recruiting", headline: "", body: "", cta: "Apply Now at Join-Orion.com", status: "draft", notes: "" };
function readDrafts() { try { const data = JSON.parse(localStorage.getItem(STORAGE) || "[]"); return Array.isArray(data) ? data : []; } catch { return []; } }
export default function MarketingContentStudio() {
  const [assets, setAssets] = useState([]);
  const [localAssets] = useState(readDrafts);
  useEffect(()=>{let alive=true;marketingDevClient.from("marketing_dev_assets").select("*").order("updated_at",{ascending:false}).then(({data,error})=>{if(alive){if(error)setMessage("Database load failed: "+error.message);else setAssets(data||[]);}});return()=>{alive=false};},[]);
  const [form, setForm] = useState(starter);
  const [message, setMessage] = useState("");
  const [filter, setFilter] = useState("all");
  const shown = useMemo(() => assets.filter(a => filter === "all" || a.status === filter), [assets,filter]);
  async function save(e) {
    e.preventDefault();
    if (!form.title.trim() || !form.body.trim()) { setMessage("Add a title and content before saving."); return; }
    try {
      const payload = {title:form.title,type:form.type,headline:form.headline,body:form.body,cta:form.cta,notes:form.notes || ""};
      if(form.id) payload.id=form.id;
      const item=await saveMarketingDraft("marketing_dev_assets",payload);
      setAssets(v=>[item,...v.filter(x=>x.id!==item.id)]);setForm(starter);
      setMessage("Saved to the Marketing development database. Draft only; no publishing occurred.");
    } catch(err) { setMessage("Database save failed: "+err.message); }
  }
  function edit(asset) { setForm(asset); setMessage("Editing existing draft."); window.scrollTo({top:0,behavior:"smooth"}); }
  async function remove(id) {
    const {error}=await marketingDevClient.from("marketing_dev_assets").delete().eq("id",id);
    if(error) {setMessage("Delete failed: "+error.message);return;}
    setAssets(v=>v.filter(a=>a.id!==id));setMessage("Database draft deleted.");
  }
  return <div className="grid gap-6">
    <section className="rounded-xl border border-slate-700 bg-slate-900 p-6">
      <h2 className="text-xl font-semibold">Content Studio</h2>
      <p className="text-slate-400 mt-2 mb-5">Create and revise recruiting copy. Drafts save to the dedicated Marketing development database. Review requests, publication and agent generation remain disabled.</p>
      <form onSubmit={save} className="grid md:grid-cols-2 gap-4">
        <label className="grid gap-2"><span>Asset title</span><input required maxLength={160} className="rounded bg-slate-800 border border-slate-600 p-3" value={form.title} onChange={e=>setForm({...form,title:e.target.value})} /></label>
        <label className="grid gap-2"><span>Format</span><select className="rounded bg-slate-800 border border-slate-600 p-3" value={form.type} onChange={e=>setForm({...form,type:e.target.value})}>{TYPES.map(t=><option key={t}>{t}</option>)}</select></label>
        <label className="grid gap-2"><span>Campaign</span><input maxLength={160} className="rounded bg-slate-800 border border-slate-600 p-3" value={form.campaign} onChange={e=>setForm({...form,campaign:e.target.value})}/></label>
        <label className="grid gap-2"><span>Headline</span><input maxLength={200} className="rounded bg-slate-800 border border-slate-600 p-3" value={form.headline} onChange={e=>setForm({...form,headline:e.target.value})}/></label>
        <label className="grid gap-2 md:col-span-2"><span>Copy</span><textarea required rows={8} maxLength={12000} className="rounded bg-slate-800 border border-slate-600 p-3" value={form.body} onChange={e=>setForm({...form,body:e.target.value})}/></label>
        <label className="grid gap-2"><span>Call to action</span><input maxLength={200} className="rounded bg-slate-800 border border-slate-600 p-3" value={form.cta} onChange={e=>setForm({...form,cta:e.target.value})}/></label>
        <label className="grid gap-2"><span>Internal review notes</span><input maxLength={2000} className="rounded bg-slate-800 border border-slate-600 p-3" value={form.notes} onChange={e=>setForm({...form,notes:e.target.value})}/></label>
        <div className="md:col-span-2 flex gap-3 flex-wrap"><button className="bg-amber-400 text-slate-950 rounded px-5 py-3 font-semibold">Save database draft</button><button type="button" className="border border-slate-600 rounded px-5 py-3" onClick={()=>{setForm(starter);setMessage("");}}>New draft</button></div>
      </form>
      {message && <p role="status" className="text-amber-200 mt-4">{message}</p>}
    </section>
    <section className="rounded-xl border border-slate-700 bg-slate-900 p-6">
      <div className="flex justify-between gap-3 flex-wrap"><h2 className="text-xl font-semibold">Saved database assets ({assets.length})</h2><label className="flex gap-2 items-center">Show <select value={filter} onChange={e=>setFilter(e.target.value)} className="bg-slate-800 rounded p-2"><option value="all">All</option><option value="draft">Drafts</option></select></label></div>
      {!shown.length && <p className="text-slate-400 mt-4">No database content drafts yet.</p>}
      {shown.map(a=><article key={a.id} className="border-t border-slate-700 mt-4 pt-4"><div className="flex justify-between gap-3 flex-wrap"><div><h3 className="font-semibold">{a.title}</h3><p className="text-slate-400 text-sm">{a.type} · Draft (not approved)</p></div><div className="flex gap-3"><button type="button" className="text-amber-300 underline" onClick={()=>edit(a)}>Edit</button><button type="button" className="text-red-300 underline" onClick={()=>remove(a.id)}>Delete</button></div></div><p className="whitespace-pre-wrap mt-3 text-slate-300">{a.headline ? a.headline+"\n" : ""}{a.body}</p><p className="text-amber-200 mt-2">{a.cta}</p></article>)}
      {localAssets.length>0 && <div className="mt-8 border-t border-slate-700 pt-4"><h3 className="font-semibold">Previous browser drafts ({localAssets.length})</h3><p className="text-slate-400 text-sm mt-2">Originals remain in this browser. Import deliberately.</p>{localAssets.map(a=><div key={a.id} className="flex justify-between gap-3 mt-3"><span>{a.title}</span><button type="button" className="text-amber-300 underline" onClick={()=>{setForm({...starter,...a,id:"",notes:[a.notes,a.campaign?"Original campaign: "+a.campaign:""].filter(Boolean).join("; ")});setMessage("Review imported draft, then save to database.");window.scrollTo({top:0,behavior:"smooth"});}}>Prepare import</button></div>)}</div>}
    </section>
  </div>;
}
