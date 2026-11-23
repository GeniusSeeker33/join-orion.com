import {useEffect,useState} from "react";
import {marketingDevClient as supabase} from "./lib/marketingDevClient";

const labels={
  returns:"Returns experience",labels:"Shipping label experience",
  deescalation:"Customer de-escalation",ownership:"Proactive follow-through",
  accuracy:"Documentation accuracy",written:"Written customer response",
  schedule:"Schedule and compensation"
};
export default function ATSReturnsScreening(){
 const [records,setRecords]=useState([]),[loading,setLoading]=useState(true),[error,setError]=useState("");
 useEffect(()=>{let active=true;(async()=>{
  const {data,error:err}=await supabase.from("candidate_applications")
   .select("id,first_name,last_name,email,position_title,created_at,screening_answers")
   .eq("position_title","Customer Service & Returns Specialist — Compliance Support")
   .order("created_at",{ascending:false});
  if(!active)return;
  setRecords(data||[]);setError(err?.message||"");setLoading(false);
 })();return()=>{active=false};},[]);
 if(loading)return <p className="text-slate-400">Loading screening responses…</p>;
 if(error)return <p role="alert" className="text-rose-300">Unable to load screening responses: {error}</p>;
 return <section className="space-y-4">
  <h2 className="text-xl font-bold">Customer Service & Returns Screening</h2>
  <p className="text-sm text-slate-400">Responses are candidate-provided evidence for recruiter review, not automatic interview decisions.</p>
  {records.length===0&&<p>No applications for this role yet.</p>}
  {records.map(r=><article key={r.id} className="rounded-xl border border-slate-700 bg-slate-900 p-4">
   <h3 className="font-semibold">{r.first_name} {r.last_name}</h3>
   <p className="text-sm text-slate-400">{r.email} · {new Date(r.created_at).toLocaleDateString()}</p>
   {r.screening_answers&&Object.keys(r.screening_answers).length>0?
    <dl className="mt-4 grid gap-3">{Object.entries(labels).map(([key,label])=>
      <div key={key}><dt className="text-xs font-semibold uppercase tracking-wide text-amber-300">{label}</dt>
       <dd className="mt-1 whitespace-pre-wrap text-sm text-slate-100">{r.screening_answers[key]||"Not answered"}</dd></div>
    )}</dl>:
    <p className="mt-3 text-sm text-slate-400">No screening answers submitted with this application.</p>}
  </article>)}
 </section>;
}
