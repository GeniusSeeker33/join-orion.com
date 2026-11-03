import {useEffect,useState} from "react";
import {marketingDevClient as supabase} from "./lib/marketingDevClient";
export default function CandidateResumes({candidateId}){
 const [items,setItems]=useState([]),[error,setError]=useState(""),[busy,setBusy]=useState(false);
 useEffect(()=>{let live=true;setItems([]);setError("");supabase.rpc("ats_admin_resumes",{p_candidate_id:candidateId}).then(({data,error})=>{if(live){if(error)setError(error.message);else setItems(data||[]);}});return()=>{live=false;};},[candidateId]);
 async function open(path){setBusy(true);setError("");const {data,error}=await supabase.storage.from("ats-dev-resumes").createSignedUrl(path,60);if(error)setError(error.message);else window.open(data.signedUrl,"_blank","noopener,noreferrer");setBusy(false);}
 return <section className="mt-5"><h3 className="text-lg font-semibold mb-2">Resumes ({items.length})</h3>{items.length===0&&<p className="text-slate-400 text-sm">No resumes uploaded through this workspace yet.</p>}{items.map(r=><div key={r.id} className="py-2 border-t border-slate-700 flex justify-between gap-2"><span className="break-all">{r.original_name}</span><button disabled={busy} className="text-amber-300 underline" onClick={()=>open(r.storage_path)}>View</button></div>)}{error&&<p role="alert" className="text-amber-300">{error}</p>}</section>;
}