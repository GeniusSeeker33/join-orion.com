import {useEffect,useState} from "react";
import {supabase} from "./lib/supabaseClient";

const ADMIN_EMAIL="desiree@orionwholesaleonline.com";
const TITLE="Customer Service & Returns Specialist — Compliance Support";
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

export default function ATSReturnsScreening({filterEmail=null,expectedName=null,onImportCandidate=null,importResults={},directoryCandidates=[]}){
 const [session,setSession]=useState(null),[checking,setChecking]=useState(true);
 const [records,setRecords]=useState([]),[loading,setLoading]=useState(false),[error,setError]=useState("");
 const [showTest,setShowTest]=useState(false),[sortByScore,setSortByScore]=useState(true);
 const [saving,setSaving]=useState({}),[drafts,setDrafts]=useState({});
 const [otp,setOtp]=useState(""),[requested,setRequested]=useState(false),[busy,setBusy]=useState(false);
 useEffect(()=>{
  if(!supabase){setChecking(false);setError("Live recruiting connection is not configured.");return;}
  let active=true;
  supabase.auth.getSession().then(({data,error:err})=>{if(active){setSession(data?.session||null);setChecking(false);if(err)setError(err.message);}});
  const {data:sub}=supabase.auth.onAuthStateChange((_event,next)=>{if(active){setSession(next);setChecking(false);}});
  return()=>{active=false;sub.subscription.unsubscribe();};
 },[]);
 const authorized=session?.user?.email?.toLowerCase()===ADMIN_EMAIL;
 useEffect(()=>{if(!authorized)return;let active=true;setLoading(true);setError("");
  supabase.from("candidate_applications")
   .select("id,first_name,last_name,email,phone,resume_path,position_title,created_at,screening_answers,interview_status,interview_at,interview_teams_url,interview_notes")
   .eq("position_title",TITLE).order("created_at",{ascending:false})
   .then(({data,error:err})=>{if(active){setRecords(data||[]);setError(err?.message||"");setLoading(false);}});
  return()=>{active=false;};
 },[authorized]);
 async function saveInterview(r){const d=drafts[r.id]||{};const update={interview_status:d.interview_status??r.interview_status??"assessment_completed",interview_at:d.interview_at===undefined?r.interview_at:(d.interview_at?new Date(d.interview_at).toISOString():null),interview_teams_url:d.interview_teams_url??r.interview_teams_url??null,interview_notes:d.interview_notes??r.interview_notes??null};setSaving(v=>({...v,[r.id]:"Saving…"}));const {data,error:err}=await supabase.from("candidate_applications").update(update).eq("id",r.id).select("id,interview_status,interview_at,interview_teams_url,interview_notes").single();if(err){setSaving(v=>({...v,[r.id]:err.message}));return;}setRecords(v=>v.map(item=>item.id===r.id?{...item,...data}:item));setDrafts(v=>{const next={...v};delete next[r.id];return next});setSaving(v=>({...v,[r.id]:"Saved"}));}
 async function requestCode(e){e.preventDefault();setBusy(true);setError("");
  const {error:err}=await supabase.auth.signInWithOtp({email:ADMIN_EMAIL,options:{shouldCreateUser:false}});
  setBusy(false);if(err)setError(err.message);else setRequested(true);
 }
 async function verifyCode(e){e.preventDefault();setBusy(true);setError("");
  const {error:err}=await supabase.auth.verifyOtp({email:ADMIN_EMAIL,token:otp,type:"email"});
  setBusy(false);if(err)setError(err.message);else setOtp("");
 }
 async function openResume(path){setError("");
  const {data,error:err}=await supabase.storage.from("resumes").createSignedUrl(path,60);
  if(err||!data?.signedUrl){setError(err?.message||"Unable to open resume.");return;}
  window.open(data.signedUrl,"_blank","noopener,noreferrer");
 }
 if(checking)return <p className="text-slate-400">Checking recruiting access…</p>;
 if(!authorized)return <section className="max-w-lg space-y-4 rounded-xl border border-slate-700 bg-slate-900 p-5">
  <h2 className="text-xl font-bold">Returns Screening — secure recruiting access</h2>
  <p className="text-sm text-slate-300">These applications are stored in Orion's live recruiting database. Verify your recruiter email to review the responses. Your ATS workspace session stays signed in.</p>
  {session&&<p className="text-amber-300 text-sm">The current live recruiting session is not authorized for this view.</p>}
  <form onSubmit={requested?verifyCode:requestCode} className="space-y-3">
   <p className="text-sm">Recruiter: {ADMIN_EMAIL}</p>
   {requested&&<input aria-label="Eight-digit recruiting code" required inputMode="numeric" pattern="[0-9]{8}" maxLength={8} value={otp} onChange={e=>setOtp(e.target.value.replace(/\\D/g,"").slice(0,8))} className="w-full rounded bg-slate-800 p-3 text-white" placeholder="8-digit email code"/>}
   <button disabled={busy||(requested&&otp.length!==8)} className="rounded bg-amber-400 px-4 py-2 font-bold text-black disabled:opacity-50">{busy?"Please wait…":requested?"Verify code":"Send sign-in code"}</button>
  </form>
  {error&&<p role="alert" className="text-rose-300">{error}</p>}
 </section>;
 if(loading)return <p className="text-slate-400">Loading screening responses…</p>;
 return <section className="space-y-4">
  <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-xl font-bold">Customer Service & Returns Screening</h2><p className="text-sm text-slate-400">{records.filter(r=>r.screening_answers&&r.first_name!=="TestDes"&&(filterEmail===null||Boolean(filterEmail.trim())&&r.email?.trim().toLowerCase()===filterEmail.trim().toLowerCase())).length} candidate assessment(s) · Live recruiting records</p></div><button type="button" className="text-sm underline text-amber-300" onClick={()=>supabase.auth.signOut()}>Sign out of recruiting view</button></div>
  {filterEmail!==null&&<p className="text-sm text-amber-200">Exact-email candidate lookup ({filterEmail}). Records remain in separate databases. Verify the person before relying on this association.</p>}
  <p className="text-sm text-slate-400">Objective screening subtotal: up to 80 points. Written customer response: 20 points, requires recruiter evaluation. No automated hiring decision or final score is assigned.</p>
  <div className="flex flex-wrap gap-4 text-sm"><label><input type="checkbox" checked={sortByScore} onChange={e=>setSortByScore(e.target.checked)} className="mr-2"/>Sort by objective subtotal</label><label><input type="checkbox" checked={showTest} onChange={e=>setShowTest(e.target.checked)} className="mr-2"/>Include test submissions</label></div>
  {error&&<p role="alert" className="text-rose-300">{error}</p>}
  {records.filter(r=>filterEmail===null||Boolean(filterEmail.trim())&&r.email?.trim().toLowerCase()===filterEmail.trim().toLowerCase()).length===0&&<p>{filterEmail?"No exact-email assessment match. Do not assume these records belong to the same person; review identity before linking.":"No applications for this role yet."}</p>}
  {records.filter(r=>(showTest||r.first_name!=="TestDes")&&(filterEmail===null||(Boolean(filterEmail.trim())&&r.email?.trim().toLowerCase()===filterEmail.trim().toLowerCase()))).sort((a,b)=>sortByScore?(objectiveScore(b.screening_answers).total-objectiveScore(a.screening_answers).total):new Date(b.created_at)-new Date(a.created_at)).map(r=><article key={r.id} className="rounded-xl border border-slate-700 bg-slate-900 p-4">
   <div className="flex flex-wrap items-center justify-between gap-3"><h3 className="font-semibold">{r.first_name} {r.last_name}</h3>{r.screening_answers&&<span className="rounded-lg bg-slate-800 border border-slate-600 px-3 py-1 text-sm font-semibold">Objective: {objectiveScore(r.screening_answers).total}/80 · Written: pending review</span>}</div>
   {expectedName&&r.first_name&&r.last_name&&expectedName.trim().toLowerCase()!==[r.first_name,r.last_name].join(" ").trim().toLowerCase()&&<p role="alert" className="rounded border border-rose-500 bg-rose-950/50 p-2 text-sm text-rose-200">Identity review required: directory name ({expectedName}) differs from assessment name ({r.first_name} {r.last_name}). Do not treat this as a confirmed match.</p>}
   <p className="text-sm text-slate-300">{r.email} · {r.phone||"No phone"} · {new Date(r.created_at).toLocaleDateString()}</p>
   <div className="mt-4 rounded-lg border border-slate-600 p-3 space-y-3"><h4 className="font-semibold text-amber-300">Teams interview tracking · linked to this application</h4><div className="grid gap-3 md:grid-cols-2"><label className="text-sm">Interview status<select className="mt-1 block w-full rounded bg-slate-800 p-2" value={drafts[r.id]?.interview_status??r.interview_status??"assessment_completed"} onChange={e=>setDrafts(v=>({...v,[r.id]:{...v[r.id],interview_status:e.target.value}}))}>{INTERVIEW_STAGES.map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></label><label className="text-sm">Interview date and time<input type="datetime-local" className="mt-1 block w-full rounded bg-slate-800 p-2" value={drafts[r.id]?.interview_at??(r.interview_at?new Date(new Date(r.interview_at).getTime()-new Date(r.interview_at).getTimezoneOffset()*60000).toISOString().slice(0,16):"")} onChange={e=>setDrafts(v=>({...v,[r.id]:{...v[r.id],interview_at:e.target.value}}))}/></label></div><label className="block text-sm">Teams meeting link<input type="url" placeholder="https://teams.microsoft.com/..." className="mt-1 block w-full rounded bg-slate-800 p-2" value={drafts[r.id]?.interview_teams_url??r.interview_teams_url??""} onChange={e=>setDrafts(v=>({...v,[r.id]:{...v[r.id],interview_teams_url:e.target.value}}))}/></label><label className="block text-sm">Recruiter notes<textarea rows={2} className="mt-1 block w-full rounded bg-slate-800 p-2" value={drafts[r.id]?.interview_notes??r.interview_notes??""} onChange={e=>setDrafts(v=>({...v,[r.id]:{...v[r.id],interview_notes:e.target.value}}))}/></label><div className="flex items-center gap-3"><button type="button" className="rounded bg-amber-300 px-3 py-2 font-bold text-slate-950" onClick={()=>saveInterview(r)}>Save interview details</button><span role="status" className="text-sm text-slate-300">{saving[r.id]||""}</span></div></div>
   {onImportCandidate&&(()=>{const email=r.email?.trim().toLowerCase();const phone=r.phone?.replace(/[^0-9]/g,"");const matches=directoryCandidates.filter(c=>(email&&c.email?.trim().toLowerCase()===email)||(phone&&c.phone?.replace(/[^0-9]/g,"")===phone));return <div className="mt-3 rounded border border-slate-600 p-3 text-sm"><p className="mb-2">{matches.length?matches.length+" possible existing directory profile(s). Review the Candidate Directory before importing.":"No matching directory email or phone found."}</p><button type="button" disabled={matches.length>0||!r.email||!r.first_name||!r.last_name} className="rounded bg-amber-300 px-3 py-2 font-semibold text-slate-950 disabled:opacity-40" onClick={()=>onImportCandidate(r)}>Create Candidate Directory profile</button>{importResults[r.id]&&<p role="status" className="mt-2">{importResults[r.id]}</p>}</div>})()}
   {r.resume_path&&<button type="button" className="mt-2 text-sm font-bold text-amber-300 underline" onClick={()=>openResume(r.resume_path)}>Open resume (secure link)</button>}
   {r.screening_answers&&<div className="mt-3 text-xs text-slate-400">Rubric breakdown: {objectiveScore(r.screening_answers).details.map(d=>`${labels[d.key]} ${d.points===null?"unmapped":d.points}`).join(" · ")}. Self-reported answers require verification.</div>}
   {r.screening_answers&&Object.keys(r.screening_answers).length>0?<dl className="mt-4 grid gap-3">{Object.entries(labels).map(([key,label])=><div key={key}><dt className="text-xs font-semibold uppercase tracking-wide text-amber-300">{label}</dt><dd className="mt-1 whitespace-pre-wrap text-sm text-slate-100">{r.screening_answers[key]||"Not answered"}</dd></div>)}</dl>:<p className="mt-3 text-sm text-slate-400">No screening answers submitted.</p>}
  </article>)}
 </section>;
}
