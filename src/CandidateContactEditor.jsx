import {useEffect,useState} from "react";
import {marketingDevClient as supabase} from "./lib/marketingDevClient";
const field="w-full rounded border border-slate-600 bg-slate-800 p-2";
export default function CandidateContactEditor({candidate,onRefresh}){
 const [editing,setEditing]=useState(false),[email,setEmail]=useState(""),[phone,setPhone]=useState(""),[saving,setSaving]=useState(false),[error,setError]=useState(""),[message,setMessage]=useState("");
 useEffect(()=>{setEditing(false);setEmail(candidate.email||"");setPhone(candidate.phone||"");setError("");setMessage("");},[candidate.id,candidate.email,candidate.phone]);
 async function save(e){e.preventDefault();setSaving(true);setError("");setMessage("");
 const {error:err}=await supabase.rpc("ats_admin_update_contact",{p_candidate_id:candidate.id,p_email:email.trim()||null,p_phone:phone.trim()||null});
 if(err)setError(err.message);else{await onRefresh();setEditing(false);setMessage("Contact information saved.");}setSaving(false);}
 return <section className="mt-3">
 {!editing?<button type="button" className="rounded border border-amber-300 px-3 py-2 text-amber-300" onClick={()=>setEditing(true)}>Edit contact information</button>:
 <form onSubmit={save} className="grid gap-3 rounded border border-slate-700 p-4"><h3 className="font-semibold">Edit candidate contact information</h3>
 <label>Email<input className={field} type="email" maxLength={254} value={email} onChange={e=>setEmail(e.target.value)}/></label>
 <label>Phone<input className={field} type="tel" maxLength={40} value={phone} onChange={e=>setPhone(e.target.value)}/></label>
 <p className="text-xs text-slate-400">Saving replaces these contact fields only. Interview and employment history remain unchanged.</p>
 <div className="flex gap-2"><button disabled={saving} className="rounded bg-amber-300 text-slate-950 px-4 py-2 font-semibold">Save changes</button><button type="button" disabled={saving} className="rounded bg-slate-700 px-4 py-2" onClick={()=>{setEditing(false);setEmail(candidate.email||"");setPhone(candidate.phone||"");setError("");}}>Cancel</button></div></form>}
 {error&&<p role="alert" className="text-amber-300 mt-2">{error}</p>}{message&&<p role="status" className="text-emerald-300 mt-2">{message}</p>}</section>;
}