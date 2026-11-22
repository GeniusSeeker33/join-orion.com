import {useEffect,useMemo,useState} from "react";
import {marketingDevClient as supabase} from "./lib/marketingDevClient";
const input="w-full rounded-lg border border-slate-600 bg-slate-800 px-3 py-2";
const empty={title:"",department:"Warehouse",status:"draft",openings:1,location:"Jeffersonville, IN",hiring_manager:"",notes:""};
const stages=["new","screening","interview","offer","hired","rejected","withdrawn"];
const statuses=["draft","open","on_hold","filled","closed"];
export default function RequisitionsManager({candidates,onSelectCandidate}){
 const [data,setData]=useState({requisitions:[],assignments:[]}),[selected,setSelected]=useState(null),[form,setForm]=useState(empty),[creating,setCreating]=useState(false),[candidateId,setCandidateId]=useState(""),[candidateQuery,setCandidateQuery]=useState(""),[busy,setBusy]=useState(false),[error,setError]=useState(""),[notice,setNotice]=useState("");
 async function load(){const {data:next,error:err}=await supabase.rpc("ats_admin_requisitions");if(err)setError(err.message);else setData(next||{requisitions:[],assignments:[]});}
 useEffect(()=>{load();},[]);
 const requisitions=data.requisitions||[],assignments=data.assignments||[];
 const chosen=requisitions.find(r=>r.id===selected);
 const linked=assignments.filter(a=>a.requisition_id===selected);
 const filtered=useMemo(()=>candidates.filter(c=>[c.full_name,c.email].some(v=>String(v||"").toLowerCase().includes(candidateQuery.toLowerCase()))).slice(0,100),[candidates,candidateQuery]);
 const set=(k,v)=>setForm(old=>({...old,[k]:v}));
 function edit(r){setSelected(r.id);setCreating(false);setForm({title:r.title,department:r.department,status:r.status,openings:r.openings,location:r.location||"",hiring_manager:r.hiring_manager||"",notes:r.notes||""});setError("");setNotice("");}
 async function save(e){e.preventDefault();setBusy(true);setError("");setNotice("");const {data:id,error:err}=await supabase.rpc("ats_admin_save_requisition",{p_id:creating?null:selected,p_title:form.title,p_department:form.department,p_status:form.status,p_openings:Number(form.openings),p_location:form.location,p_hiring_manager:form.hiring_manager,p_notes:form.notes});if(err)setError(err.message);else{await load();setSelected(id);setCreating(false);setNotice("Requisition saved.");}setBusy(false);}
 async function assign(id,stage="new"){setBusy(true);setError("");setNotice("");const {error:err}=await supabase.rpc("ats_admin_assign_requisition",{p_requisition_id:selected,p_candidate_id:id,p_stage:stage});if(err)setError(err.message);else{await load();setCandidateId("");setNotice("Candidate assignment saved.");}setBusy(false);}
 return <div className="grid lg:grid-cols-[minmax(280px,1fr)_minmax(400px,2fr)] gap-5">
 <section className="rounded-xl border border-slate-700 bg-slate-900 p-5"><div className="flex justify-between items-center gap-2"><h2 className="font-bold text-xl">Requisitions</h2><button className="bg-amber-300 text-slate-950 rounded px-3 py-2 font-semibold" onClick={()=>{setCreating(true);setSelected(null);setForm(empty);setError("");}}>New</button></div>
 <p className="text-sm text-slate-400 my-3">{requisitions.length} requisitions · {requisitions.filter(r=>r.status==="open").reduce((sum,r)=>sum+r.openings,0)} open seats (planned)</p>
 <div className="space-y-2">{requisitions.map(r=><button key={r.id} className={"block text-left w-full rounded border p-3 "+(selected===r.id?"border-amber-300":"border-slate-700")} onClick={()=>edit(r)}><strong>{r.title}</strong><p className="text-sm text-slate-400">{r.department} · {r.status.replace("_"," ")} · {r.openings} target seat(s)</p><p className="text-xs text-emerald-300">{new Set(assignments.filter(a=>a.requisition_id===r.id&&a.stage==="hired"&&a.counts_toward_openings!==false).map(a=>a.candidate_id)).size} filled · {Math.max(0,Number(r.openings)-new Set(assignments.filter(a=>a.requisition_id===r.id&&a.stage==="hired"&&a.counts_toward_openings!==false).map(a=>a.candidate_id)).size)} remaining</p><p className="text-xs text-slate-400">{assignments.filter(a=>a.requisition_id===r.id).length} linked candidates</p></button>)}</div>
 {requisitions.length===0&&<p className="text-slate-400 mt-4">No requisitions yet. Create your first opening to get started.</p>}</section>
 <section className="rounded-xl border border-slate-700 bg-slate-900 p-5">{!creating&&!chosen?<p className="text-slate-400">Select a requisition or create a new one.</p>:<>
 <h2 className="text-xl font-semibold mb-4">{creating?"New requisition":"Edit requisition"}</h2>
 <form onSubmit={save} className="grid sm:grid-cols-2 gap-3">
 <label className="sm:col-span-2">Job title<input className={input} required maxLength={150} value={form.title} onChange={e=>set("title",e.target.value)}/></label>
 <label>Department<select className={input} value={form.department} onChange={e=>set("department",e.target.value)}>{["Sales","Warehouse","Taylor Customs","Leadership","Operations","Other"].map(d=><option key={d}>{d}</option>)}</select></label>
 <label>Status<select className={input} value={form.status} onChange={e=>set("status",e.target.value)}>{statuses.map(v=><option key={v} value={v}>{v.replace("_"," ")}</option>)}</select></label>
 <label>Target seats (including hires)<input className={input} type="number" min={1} max={100} required value={form.openings} onChange={e=>set("openings",e.target.value)}/></label>
 <p className="sm:col-span-2 text-xs text-slate-400">Enter the total number of positions to fill, including anyone already hired against this requisition. Remaining vacancies are calculated automatically.</p><label>Location<input className={input} maxLength={200} value={form.location} onChange={e=>set("location",e.target.value)}/></label>
 <label className="sm:col-span-2">Hiring manager<input className={input} maxLength={150} value={form.hiring_manager} onChange={e=>set("hiring_manager",e.target.value)}/></label>
 <label className="sm:col-span-2">Internal notes<textarea className={input} maxLength={5000} rows={3} value={form.notes} onChange={e=>set("notes",e.target.value)}/></label>
 <button disabled={busy} className="sm:col-span-2 rounded bg-amber-300 p-2 font-semibold text-slate-950">Save requisition</button></form>
 {!creating&&chosen&&<div className="mt-7 border-t border-slate-700 pt-5"><h3 className="text-lg font-semibold">Candidate pipeline ({linked.length})</h3><p className="text-sm text-slate-400 mb-3">Stage changes apply only to this requisition.</p>
 <label>Find a candidate<input className={input} placeholder="Search by name or email" value={candidateQuery} onChange={e=>{setCandidateQuery(e.target.value);setCandidateId("");}}/></label>
 <div className="flex gap-2 mt-2"><select className={input} value={candidateId} onChange={e=>setCandidateId(e.target.value)}><option value="">Select candidate</option>{filtered.map(c=><option key={c.id} value={c.id}>{c.full_name} — {c.email||"No email"}</option>)}</select><button type="button" disabled={!candidateId||busy} className="bg-amber-300 text-slate-950 rounded px-3 disabled:opacity-50" onClick={()=>assign(candidateId)}>Link</button></div>
 <div className="mt-4 space-y-3">{linked.map(a=>{const c=candidates.find(c=>c.id===a.candidate_id);return <div key={a.candidate_id} className="border border-slate-700 rounded p-3"><div className="flex flex-wrap justify-between gap-2"><button className="text-amber-300 underline text-left" onClick={()=>onSelectCandidate(a.candidate_id)}>{c?.full_name||"Unknown candidate"}</button><select className={input+" max-w-40"} disabled={busy} value={a.stage} onChange={e=>assign(a.candidate_id,e.target.value)}>{stages.map(v=><option key={v}>{v}</option>)}</select></div></div>})}</div></div>}
 </>}
 {error&&<p role="alert" className="text-amber-300 mt-3">{error}</p>}{notice&&<p role="status" className="text-emerald-300 mt-3">{notice}</p>}</section></div>;
}