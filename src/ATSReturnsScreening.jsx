import {useEffect,useState} from "react";
import {marketingDevClient as supabase} from "./lib/marketingDevClient";

const INTERVIEW_STAGES=[["assessment_completed","Assessment completed"],["interview_invited","Interview invited"],["scheduling","Scheduling Teams interview"],["scheduled","Teams interview scheduled"],["completed","Interview completed"],["not_moving_forward","Not moving forward"]];
const labels={returns:"Returns experience",labels:"Shipping label experience",deescalation:"Customer de-escalation",ownership:"Proactive follow-through",accuracy:"Documentation accuracy",written:"Written customer response",schedule:"Schedule and compensation"};


const RUBRIC={
 returns:[["I manage returns end-to-end",15],["I process return authorizations",12],["I handle customer return inquiries",8],["My experience is primarily",4]],
 labels:[["Directly in UPS",10],["Through an integrated",8],["Occasionally",4],["I have not",0]],
 deescalation:[["Review the history, acknowledge",20],["Investigate the status",14],["Review the status",10],["Contact the refund team",8]],
 ownership:[["Investigate with the warehouse",20],["Check the tracking",15],["Tell the customer",7],["Escalate the tracking",6]],
 accuracy:[["Verify source records and the physical item",15]]
};
function objectiveScore(a){
 const details=Object.entries(RUBRIC).map(([key,choices])=>({key,points:choices.find(([prefix])=>String(a?.[key]||"").startsWith(prefix))?.[1]??null}));
 return {details,total:details.reduce((n,d)=>n+(d.points||0),0),complete:details.every(d=>d.points!==null)};
}

export default function ATSReturnsScreening({filterEmail=null,expectedName=null,directoryCandidates=[],onSelectCandidate}){
 const [session,setSession]=useState(null),[checking,setChecking]=useState(true);
 const [records,setRecords]=useState(null),[error,setError]=useState("");
 const [showTest,setShowTest]=useState(false),[sortByScore,setSortByScore]=useState(true);
 const [saving,setSaving]=useState({}),[drafts,setDrafts]=useState({});
 const [batch,setBatch]=useState({running:false,done:0,total:0,results:{},errors:{}});
 const [reviewChoices,setReviewChoices]=useState({});
 useEffect(()=>{
  if(!supabase)return;
  let active=true;
  supabase.auth.getSession().then(({data,error:err})=>{if(active){setSession(data?.session||null);setChecking(false);if(err)setError(err.message);}});
  const {data:sub}=supabase.auth.onAuthStateChange((_event,next)=>{if(active){setSession(next);setChecking(false);}});
  return()=>{active=false;sub.subscription.unsubscribe();};
 },[]);
 const authorized=!!session?.access_token;
 useEffect(()=>{if(!authorized)return;let active=true;
  supabase.functions.invoke("ats-returns-access",{body:{action:"list"}}).then(({data,error:err})=>{if(active){setRecords(data?.records||[]);setError(data?.error||err?.message||"");}});
  return()=>{active=false;};
 },[authorized]);
 async function analyzeAllResumes(){
  if(batch.running||!window.confirm("Analyze the attached PDF resumes for the Customer Service applicants? AI drafts are for your review only and will not change pipeline stages or hiring decisions."))return;
  const applicants=records.filter(r=>r.screening_answers&&!/^test/i.test(r.first_name||"")&&r.email);
  const results={},errors={};setBatch({running:true,done:0,total:applicants.length,results:{},errors:{}});
  for(let i=0;i<applicants.length;i++){
   const r=applicants[i];try{
    const matches=directoryCandidates.filter(c=>c.email?.trim().toLowerCase()===r.email.trim().toLowerCase()&&c.full_name?.trim().toLowerCase()===[r.first_name,r.last_name].join(" ").trim().toLowerCase());
    if(matches.length!==1)throw Error("Candidate identity needs review");
    const candidateId=matches[0].id;
    const {data:files,error:fileError}=await supabase.rpc("ats_admin_resumes",{p_candidate_id:candidateId});
    if(fileError)throw Error("Could not retrieve candidate attachments");
    const pdfs=(files||[]).filter(f=>/\.pdf$/i.test(f.original_name||f.storage_path||""));
    if(!pdfs.length)throw Error("No attached PDF resume");
    const {data,error:analysisError}=await supabase.functions.invoke("analyze-candidate-resume",{body:{candidateId,resumeId:pdfs[0].id}});
    if(analysisError||data?.error||!data?.draft)throw Error(data?.error||analysisError?.message||"AI analysis unavailable");
    results[r.id]={...data.draft,candidateId,resumeName:data.resume_name};
   }catch(e){errors[r.id]=e.message||"Review needed";}
   setBatch({running:true,done:i+1,total:applicants.length,results:{...results},errors:{...errors}});
  }
  setBatch({running:false,done:applicants.length,total:applicants.length,results:{...results},errors:{...errors}});
 }
 async function saveInterview(r){const d=drafts[r.id]||{};const update={interview_status:d.interview_status??r.interview_status??"assessment_completed",interview_at:d.interview_at===undefined?r.interview_at:(d.interview_at?new Date(d.interview_at).toISOString():null),interview_teams_url:d.interview_teams_url??r.interview_teams_url??null,interview_notes:d.interview_notes??r.interview_notes??null};setSaving(v=>({...v,[r.id]:"Saving…"}));const {data,error:err}=await supabase.functions.invoke("ats-returns-access",{body:{action:"update",id:r.id,update}});if(err||data?.error||!data?.record){setSaving(v=>({...v,[r.id]:data?.error||err?.message||"Unable to save"}));return;}setRecords(v=>v.map(item=>item.id===r.id?{...item,...data.record}:item));setDrafts(v=>{const next={...v};delete next[r.id];return next});setSaving(v=>({...v,[r.id]:"Saved"}));}
 async function openResume(path){setError("");const {data,error:err}=await supabase.functions.invoke("ats-returns-access",{body:{action:"resume",path}});if(err||data?.error||!data?.url){setError(data?.error||err?.message||"Unable to open resume");return;}window.open(data.url,"_blank","noopener,noreferrer");}
 if(!supabase)return <p role="alert">Recruiting connection is not configured.</p>;
 if(checking)return <p className="text-slate-400">Checking recruiting access…</p>;
 if(!authorized)return <p className="text-amber-300">Sign in to the ATS to review live screening records.</p>;
 if(records===null)return <p className="text-slate-400">Loading screening responses…</p>;
 return <section className="space-y-4">
  <p className="text-xs text-slate-400">Returns applications are synchronized by the existing Returns scheduler.</p>
  <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-xl font-bold">Customer Service & Returns Screening</h2><p className="text-sm text-slate-400">{records.filter(r=>r.screening_answers&&r.first_name!=="TestDes"&&(filterEmail===null||Boolean(filterEmail.trim())&&r.email?.trim().toLowerCase()===filterEmail.trim().toLowerCase())).length} candidate assessment(s)</p></div><button type="button" className="text-sm underline text-amber-300" onClick={()=>supabase.auth.signOut()}>Sign out of recruiting view</button></div>
  {filterEmail!==null&&<p className="text-sm text-amber-200">Exact-email candidate lookup ({filterEmail}). Records remain in separate databases. Verify the person before relying on this association.</p>}
  <p className="text-sm text-slate-400">Objective screening subtotal: up to 80 points. Written customer response: 20 points, requires recruiter evaluation. No automated hiring decision or final score is assigned.</p>
  <div className="flex flex-wrap gap-4 text-sm"><label><input type="checkbox" checked={sortByScore} onChange={e=>setSortByScore(e.target.checked)} className="mr-2"/>Sort by objective subtotal</label><label><input type="checkbox" checked={showTest} onChange={e=>setShowTest(e.target.checked)} className="mr-2"/>Include test submissions</label></div>
  {filterEmail===null&&<div className="rounded-xl border border-amber-500/40 p-4 space-y-3"><div className="flex flex-wrap items-center justify-between gap-2"><div><h3 className="font-semibold">Batch resume evidence review</h3><p className="text-sm text-slate-400">Analyze attached PDFs, inspect supporting evidence and gaps, and decide whom to contact yourself. AI does not make or rank hiring decisions.</p></div><button type="button" onClick={analyzeAllResumes} disabled={batch.running} className="rounded-lg bg-amber-300 px-4 py-2 text-slate-950 font-semibold disabled:opacity-50">{batch.running?"Analyzing resumes…":"Review all resumes"}</button></div>{batch.total>0&&<p role="status" className="text-sm">Processed {batch.done} of {batch.total} · {Object.keys(batch.results).length} drafts · {Object.keys(batch.errors).length} need attention</p>}{batch.done>0&&<div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead><tr><th className="p-2">Applicant</th><th className="p-2">Questionnaire</th><th className="p-2">Resume evidence</th><th className="p-2">Recruiter follow-up</th></tr></thead><tbody>{records.filter(r=>batch.results[r.id]||batch.errors[r.id]).map(r=>{const d=batch.results[r.id];const s=d?.scores||{};const sum=Object.values(s).reduce((a,b)=>a+Number(b||0),0);return <tr key={r.id} className="border-t border-slate-700"><td className="p-2">{r.first_name} {r.last_name}</td><td className="p-2">{objectiveScore(r.screening_answers).total}/80</td><td className="p-2">{d?<details><summary className="cursor-pointer underline text-amber-300">Review evidence ({sum}/100)</summary><p className="whitespace-pre-wrap mt-2">Experience: {d.evidence}</p><p className="whitespace-pre-wrap mt-2">Unverified: {d.gaps}</p><p className="whitespace-pre-wrap mt-2">Interview questions: {d.questions}</p></details>:<span className="text-amber-200">{batch.errors[r.id]}</span>}</td><td className="p-2"><select className="rounded bg-slate-800 p-2" value={reviewChoices[r.id]||"review"} onChange={e=>setReviewChoices(v=>({...v,[r.id]:e.target.value}))}><option value="review">Review further</option><option value="call">Call</option><option value="hold">Hold</option></select></td></tr>})}</tbody></table></div>}{batch.done>0&&<p className="text-xs text-slate-400">Drafts and follow-up selections are temporary in this first version; they are not saved to candidate profiles. Save individual evaluations in Candidate Directory after review.</p>}</div>}
  {error&&<p role="alert" className="text-rose-300">{error}</p>}
  {records.filter(r=>filterEmail===null||Boolean(filterEmail.trim())&&r.email?.trim().toLowerCase()===filterEmail.trim().toLowerCase()).length===0&&<p>{filterEmail?"No exact-email assessment match. Do not assume these records belong to the same person; review identity before linking.":"No applications for this role yet."}</p>}
  {records.filter(r=>(showTest||r.first_name!=="TestDes")&&(filterEmail===null||(Boolean(filterEmail.trim())&&r.email?.trim().toLowerCase()===filterEmail.trim().toLowerCase()))).sort((a,b)=>sortByScore?(objectiveScore(b.screening_answers).total-objectiveScore(a.screening_answers).total):new Date(b.created_at)-new Date(a.created_at)).map(r=><article key={r.id} className="rounded-xl border border-slate-700 bg-slate-900 p-4">
   <div className="flex flex-wrap items-center justify-between gap-3"><h3 className="font-semibold">{r.first_name} {r.last_name}</h3>{r.screening_answers&&<span className="rounded-lg bg-slate-800 border border-slate-600 px-3 py-1 text-sm font-semibold">Objective: {objectiveScore(r.screening_answers).total}/80 · Written: pending review</span>}</div>
   {expectedName&&r.first_name&&r.last_name&&expectedName.trim().toLowerCase()!==[r.first_name,r.last_name].join(" ").trim().toLowerCase()&&<p role="alert" className="rounded border border-rose-500 bg-rose-950/50 p-2 text-sm text-rose-200">Identity review required: directory name ({expectedName}) differs from assessment name ({r.first_name} {r.last_name}). Do not treat this as a confirmed match.</p>}
   <p className="text-sm text-slate-300">{r.email} · {r.phone||"No phone"} · {new Date(r.created_at).toLocaleDateString()}</p>
   <div className="mt-4 rounded-lg border border-slate-600 p-3 space-y-3"><h4 className="font-semibold text-amber-300">Teams interview tracking · linked to this application</h4><div className="grid gap-3 md:grid-cols-2"><label className="text-sm">Interview status<select className="mt-1 block w-full rounded bg-slate-800 p-2" value={drafts[r.id]?.interview_status??r.interview_status??"assessment_completed"} onChange={e=>setDrafts(v=>({...v,[r.id]:{...v[r.id],interview_status:e.target.value}}))}>{INTERVIEW_STAGES.map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></label><label className="text-sm">Interview date and time<input type="datetime-local" className="mt-1 block w-full rounded bg-slate-800 p-2" value={drafts[r.id]?.interview_at??(r.interview_at?new Date(new Date(r.interview_at).getTime()-new Date(r.interview_at).getTimezoneOffset()*60000).toISOString().slice(0,16):"")} onChange={e=>setDrafts(v=>({...v,[r.id]:{...v[r.id],interview_at:e.target.value}}))}/></label></div><label className="block text-sm">Teams meeting link<input type="url" placeholder="https://teams.microsoft.com/..." className="mt-1 block w-full rounded bg-slate-800 p-2" value={drafts[r.id]?.interview_teams_url??r.interview_teams_url??""} onChange={e=>setDrafts(v=>({...v,[r.id]:{...v[r.id],interview_teams_url:e.target.value}}))}/></label><label className="block text-sm">Recruiter notes<textarea rows={2} className="mt-1 block w-full rounded bg-slate-800 p-2" value={drafts[r.id]?.interview_notes??r.interview_notes??""} onChange={e=>setDrafts(v=>({...v,[r.id]:{...v[r.id],interview_notes:e.target.value}}))}/></label><div className="flex items-center gap-3"><button type="button" className="rounded bg-amber-300 px-3 py-2 font-bold text-slate-950" onClick={()=>saveInterview(r)}>Save interview details</button><span role="status" className="text-sm text-slate-300">{saving[r.id]||""}</span></div></div>
   {onSelectCandidate&&(()=>{
    const matches=directoryCandidates.filter(candidate=>r.email&&candidate.email?.trim().toLowerCase()===r.email.trim().toLowerCase()
      &&candidate.full_name?.trim().toLowerCase()===[r.first_name,r.last_name].join(" ").trim().toLowerCase());
    return matches.length===1&&<button type="button" className="mt-2 block text-sm text-amber-300 underline"
      onClick={()=>onSelectCandidate(matches[0].id)}>Open matched candidate profile</button>;
   })()}
   {r.resume_path&&<button type="button" className="mt-2 text-sm font-bold text-amber-300 underline" onClick={()=>openResume(r.resume_path)}>Open resume (secure link)</button>}
   {r.screening_answers&&<div className="mt-3 text-xs text-slate-400">Rubric breakdown: {objectiveScore(r.screening_answers).details.map(d=>`${labels[d.key]} ${d.points===null?"unmapped":d.points}`).join(" · ")}. Self-reported answers require verification.</div>}
   {r.screening_answers&&Object.keys(r.screening_answers).length>0?<dl className="mt-4 grid gap-3">{Object.entries(labels).map(([key,label])=><div key={key}><dt className="text-xs font-semibold uppercase tracking-wide text-amber-300">{label}</dt><dd className="mt-1 whitespace-pre-wrap text-sm text-slate-100">{r.screening_answers[key]||"Not answered"}</dd></div>)}</dl>:<p className="mt-3 text-sm text-slate-400">No screening answers submitted.</p>}
  </article>)}
 </section>;
}
