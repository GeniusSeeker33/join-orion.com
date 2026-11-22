import {useEffect,useState} from "react";
import {marketingDevClient as supabase} from "./lib/marketingDevClient";

const field="block w-full rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 mt-1";

export default function EmploymentLifecycle({candidateId,onRefresh}){
  const [record,setRecord]=useState(null);
  const [status,setStatus]=useState("not_started");
  const [start,setStart]=useState("");
  const [end,setEnd]=useState("");
  const [reason,setReason]=useState("");
  const [busy,setBusy]=useState(false);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState("");
  const [notice,setNotice]=useState("");

  useEffect(()=>{
    let active=true;
    setLoading(true);
    setError("");
    setNotice("");

    supabase.rpc("ats_admin_employment",{p_candidate_id:candidateId})
      .then(({data,error:e})=>{
        if(!active)return;
        if(e)setError(e.message);

        const row=data?.[0]||null;
        setRecord(row);

        const allowed=["not_started","active","terminated","first_day_no_show"];
        setStatus(allowed.includes(row?.employment_status)
          ? row.employment_status
          : "not_started");

        setStart(row?.start_date||"");
        setEnd(row?.termination_date||"");
        setReason(row?.termination_reason||"");
        setLoading(false);
      });

    return()=>{active=false};
  },[candidateId]);

  async function save(e){
    e.preventDefault();
    if(busy)return;

    setError("");
    setNotice("");

    if(status==="terminated" &&
       !window.confirm("Confirm employment termination? This will release the candidate's occupied hiring seat.")){
      return;
    }

    if(status==="first_day_no_show" &&
       !window.confirm("Confirm First-Day No-Show? This will release the candidate's occupied hiring seat.")){
      return;
    }

    setBusy(true);

    try{
      const {error:e2}=await supabase.rpc("ats_admin_save_employment",{
        p_candidate_id:candidateId,
        p_start_date:start||null,
        p_status:status,
        p_termination_date:status==="terminated"?end||null:null,
        p_termination_reason:
          ["terminated","first_day_no_show"].includes(status)
            ?reason||null
            :null
      });

      if(e2)throw e2;

      setNotice("Employment record saved. Hiring-seat availability has been updated.");
      setRecord(true);

      if(onRefresh)await onRefresh();
    }catch(err){
      setError(err.message||"Unable to save employment record.");
    }finally{
      setBusy(false);
    }
  }

  const ended=["terminated","first_day_no_show"].includes(status);

  return (
    <section className="mt-5 rounded-xl border border-slate-700 p-4">
      <h3 className="text-lg font-semibold">Employment lifecycle</h3>

      <p className="text-sm text-slate-400 mb-3">
        Track actual employment status separately from recruiting history.
      </p>

      {loading?(
        <p className="text-slate-400">Loading employment record…</p>
      ):(
        <form onSubmit={save} className="grid sm:grid-cols-2 gap-3">
          <label>
            Employment status
            <select
              className={field}
              value={status}
              onChange={e=>setStatus(e.target.value)}
            >
              <option value="not_started">Not Started</option>
              <option value="active">Active</option>
              <option value="terminated">Terminated</option>
              <option value="first_day_no_show">First-Day No-Show</option>
            </select>
          </label>

          <label>
            {status==="first_day_no_show"
              ?"Scheduled start date"
              :"Actual start date"}
            <input
              className={field}
              type="date"
              value={start}
              onChange={e=>setStart(e.target.value)}
              required={status!=="not_started"}
            />
          </label>

          {status==="terminated"&&(
            <label>
              Termination date
              <input
                className={field}
                type="date"
                value={end}
                min={start||undefined}
                onChange={e=>setEnd(e.target.value)}
                required
              />
            </label>
          )}

          {ended&&(
            <label className="sm:col-span-2">
              {status==="first_day_no_show"
                ?"No-show notes / documented facts"
                :"Termination reason / factual notes"}
              <textarea
                className={field}
                maxLength={2000}
                rows={3}
                value={reason}
                onChange={e=>setReason(e.target.value)}
                placeholder="Record documented facts and source; avoid speculation."
              />
            </label>
          )}

          {ended&&(
            <p className="sm:col-span-2 text-sm text-amber-300">
              Saving this status will automatically release the candidate's
              occupied hiring seat. Their historical hiring record will remain.
            </p>
          )}

          <button
            className="sm:col-span-2 rounded bg-amber-300 text-slate-950 font-semibold p-2 disabled:opacity-50"
            disabled={busy}
          >
            {busy?"Saving…":record?"Update employment record":"Save employment record"}
          </button>
        </form>
      )}

      {error&&(
        <p role="alert" className="text-amber-300 mt-2">{error}</p>
      )}

      {notice&&(
        <p role="status" className="text-emerald-300 mt-2">{notice}</p>
      )}
    </section>
  );
}
