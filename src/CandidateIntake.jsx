import {useEffect,useState} from "react";
import {marketingDevClient as supabase} from "./lib/marketingDevClient";
const field="w-full rounded-lg border border-slate-600 bg-slate-800 px-3 py-2";
export default function CandidateIntake({onCreated,onOpenCandidate}){
 const [name,setName]=useState(""),[email,setEmail]=useState(""),[phone,setPhone]=useState(""),[req,setReq]=useState(""),[source,setSource]=useState("Indeed"),[file,setFile]=useState(null),[reqs,setReqs]=useState([]),[busy,setBusy]=useState(false),[message,setMessage]=useState(""),[error,setError]=useState("");
 useEffect(()=>{supabase.rpc("ats_admin_requisitions").then(({data})=>setReqs((data?.requisitions||[]).filter(r=>r.status==="open")));},[]);
 async function submit(e){e.preventDefault();setBusy(true);setError("");setMessage("");
 try{
 const {data,error:err}=await supabase.rpc("ats_admin_add_candidate",{p_full_name:name,p_email:email,p_phone:phone,p_requisition_id:req||null,p_source:source});
 if(err)throw err;
 const id=data.candidate_id;
 if(data.existing){setMessage("Existing candidate found. Open their profile to review before linking a new application or uploading a resume.");onOpenCandidate(id);return;}
 if(file){const ext=file.name.split(".").pop().toLowerCase();if(!["pdf","doc","docx"].includes(ext)||file.size>10485760)throw new Error("Resume must be PDF, DOC, or DOCX, under 10 MB.");
 const path=id+"/"+crypto.randomUUID()+"."+ext;
 const {error:uploadErr}=await supabase.storage.from("ats-dev-resumes").upload(path,file,{contentType:file.type||({"pdf":"application/pdf","doc":"application/msword","docx":"application/vnd.openxmlformats-officedocument.wordprocessingml.document"}[ext]),upsert:false});if(uploadErr)throw uploadErr;
 const {error:recordErr}=await supabase.rpc("ats_admin_record_resume",{p_candidate_id:id,p_path:path,p_name:file.name});if(recordErr)throw recordErr;
 }
 await onCreated(id);setName("");setEmail("");setPhone("");setFile(null);setReq("");setMessage("Candidate saved and linked to the selected position.");
 }catch(e){setError(e.message||"Unable to save candidate.");}finally{setBusy(false);}}
 return <section className="rounded-xl border border-slate-700 bg-slate-900 p-5 max-w-3xl"><h2 className="text-xl font-semibold mb-2">Add candidate manually</h2><p className="text-sm text-slate-400 mb-5">Enter Indeed applicants here. We check for matching email or phone before creating a profile.</p>
 <form onSubmit={submit} className="grid sm:grid-cols-2 gap-4"><label className="sm:col-span-2">Full name<input className={field} required maxLength={200} value={name} onChange={e=>setName(e.target.value)}/></label>
 <label>Email<input className={field} type="email" maxLength={254} value={email} onChange={e=>setEmail(e.target.value)}/></label><label>Phone<input className={field} type="tel" maxLength={50} value={phone} onChange={e=>setPhone(e.target.value)}/></label>
 <label>Application source<select className={field} value={source} onChange={e=>setSource(e.target.value)}>{["Indeed","Join-Orion.com","Referral","Other"].map(v=><option key={v}>{v}</option>)}</select></label>
 <label>Position<select className={field} value={req} onChange={e=>setReq(e.target.value)}><option value="">Select a position (optional)</option>{reqs.map(r=><option key={r.id} value={r.id}>{r.title} — {r.department}</option>)}</select></label>
 <label className="sm:col-span-2">Resume (PDF, DOC, DOCX; 10 MB max)<input className={field} type="file" accept=".pdf,.doc,.docx" onChange={e=>setFile(e.target.files?.[0]||null)}/></label>
 <p className="sm:col-span-2 text-sm text-slate-400">At least an email or phone is required. Uploaded resumes are stored privately.</p>
 <button disabled={busy||(!email.trim()&&!phone.trim())} className="sm:col-span-2 rounded bg-amber-300 text-slate-950 p-3 font-semibold disabled:opacity-50">{busy?"Saving…":"Save candidate"}</button></form>
 {error&&<p role="alert" className="text-amber-300 mt-3">{error}</p>}{message&&<p role="status" className="text-emerald-300 mt-3">{message}</p>}</section>;
}