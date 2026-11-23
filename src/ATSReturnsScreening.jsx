import {useEffect,useState} from "react";
import {supabase} from "./lib/supabaseClient";

const ADMIN_EMAIL="desiree@orionwholesaleonline.com";
const TITLE="Customer Service & Returns Specialist — Compliance Support";
const labels={returns:"Returns experience",labels:"Shipping label experience",deescalation:"Customer de-escalation",ownership:"Proactive follow-through",accuracy:"Documentation accuracy",written:"Written customer response",schedule:"Schedule and compensation"};

export default function ATSReturnsScreening(){
 const [session,setSession]=useState(null),[checking,setChecking]=useState(true);
 const [records,setRecords]=useState([]),[loading,setLoading]=useState(false),[error,setError]=useState("");
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
   .select("id,first_name,last_name,email,phone,resume_path,position_title,created_at,screening_answers")
   .eq("position_title",TITLE).order("created_at",{ascending:false})
   .then(({data,error:err})=>{if(active){setRecords(data||[]);setError(err?.message||"");setLoading(false);}});
  return()=>{active=false;};
 },[authorized]);
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
  <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-xl font-bold">Customer Service & Returns Screening</h2><p className="text-sm text-slate-400">{records.length} application(s) · Live recruiting records</p></div><button type="button" className="text-sm underline text-amber-300" onClick={()=>supabase.auth.signOut()}>Sign out of recruiting view</button></div>
  <p className="text-sm text-slate-400">Responses are for recruiter review, not automatic hiring decisions.</p>
  {error&&<p role="alert" className="text-rose-300">{error}</p>}
  {records.length===0&&<p>No applications for this role yet.</p>}
  {records.map(r=><article key={r.id} className="rounded-xl border border-slate-700 bg-slate-900 p-4">
   <h3 className="font-semibold">{r.first_name} {r.last_name}</h3>
   <p className="text-sm text-slate-300">{r.email} · {r.phone||"No phone"} · {new Date(r.created_at).toLocaleDateString()}</p>
   {r.resume_path&&<button type="button" className="mt-2 text-sm font-bold text-amber-300 underline" onClick={()=>openResume(r.resume_path)}>Open resume (secure link)</button>}
   {r.screening_answers&&Object.keys(r.screening_answers).length>0?<dl className="mt-4 grid gap-3">{Object.entries(labels).map(([key,label])=><div key={key}><dt className="text-xs font-semibold uppercase tracking-wide text-amber-300">{label}</dt><dd className="mt-1 whitespace-pre-wrap text-sm text-slate-100">{r.screening_answers[key]||"Not answered"}</dd></div>)}</dl>:<p className="mt-3 text-sm text-slate-400">No screening answers submitted.</p>}
  </article>)}
 </section>;
}
