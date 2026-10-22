import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "./lib/supabaseClient";

const ADMIN_EMAIL = "desiree@orionwholesaleonline.com";
const STATUSES = ["new", "screened", "interviewing", "offer", "hired", "rejected"];

export default function RecruitingDashboard() {
  const [session, setSession] = useState(null);
  const [checking, setChecking] = useState(true);
  const [email, setEmail] = useState(ADMIN_EMAIL);
  const [message, setMessage] = useState("");
  const [applications, setApplications] = useState([]);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState("all");
  const [sourceFilter, setSourceFilter] = useState("all");
  const [savingId, setSavingId] = useState(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => { setSession(data.session); setChecking(false); });
    const { data } = supabase.auth.onAuthStateChange((_event, next) => setSession(next));
    return () => data.subscription.unsubscribe();
  }, []);

  const authorized = session?.user?.email?.toLowerCase() === ADMIN_EMAIL;
  useEffect(() => {
    if (!authorized) { setApplications([]); return; }
    let active = true;
    setLoading(true);
    supabase.from("candidate_applications")
      .select("id,first_name,last_name,position_title,status,source,created_at")
      .order("created_at", { ascending: false })
      .then(({ data, error }) => {
        if (!active) return;
        setLoading(false);
        if (error) setMessage("Unable to load applications: " + error.message);
        else setApplications(data || []);
      });
    return () => { active = false; };
  }, [authorized]);

  const sources = useMemo(() => [...new Set(applications.map(a => a.source?.trim() || "Unattributed"))].sort(), [applications]);
  const visible = useMemo(() => applications.filter(a =>
    (filter === "all" || a.status === filter) &&
    (sourceFilter === "all" || (a.source?.trim() || "Unattributed") === sourceFilter)
  ), [applications, filter, sourceFilter]);
  const total = applications.length;
  const hired = applications.filter(a => a.status === "hired").length;

  async function sendLink(e) {
    e.preventDefault();
    setMessage("");
    const { error } = await supabase.auth.signInWithOtp({
      email, options: { emailRedirectTo: window.location.origin + "/admin/recruiting" }
    });
    setMessage(error ? error.message : "Check your inbox for the secure sign-in link.");
  }

  async function changeStatus(id, status) {
    setSavingId(id);
    const { error } = await supabase.from("candidate_applications").update({ status }).eq("id", id);
    setSavingId(null);
    if (error) setMessage("Status update failed: " + error.message);
    else setApplications(previous => previous.map(a => a.id === id ? { ...a, status } : a));
  }

  if (checking) return <main className="min-h-screen bg-slate-950 p-10 text-white">Checking sign-in…</main>;
  return <main className="min-h-screen bg-slate-950 px-5 py-10 text-white">
    <div className="mx-auto max-w-6xl">
      <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <div><p className="text-sm font-bold uppercase tracking-widest text-amber-400">Orion Wholesale · Private Administration</p>
          <h1 className="mt-2 text-3xl font-black">Recruiting Dashboard</h1></div>
        <div className="flex gap-4 text-sm"><Link className="text-amber-300 underline" to="/admin">Dealer Admin</Link>
          {session && <button className="underline" onClick={() => supabase.auth.signOut()}>Sign out</button>}</div>
      </div>
      {!session ? <form onSubmit={sendLink} className="max-w-md space-y-4 rounded-xl border border-white/20 bg-white/5 p-6">
        <h2 className="text-xl font-bold">Administrator sign-in</h2>
        <p className="text-sm text-white/70">We'll email you a secure sign-in link.</p>
        <input type="email" required value={email} onChange={e => setEmail(e.target.value)}
          className="w-full rounded bg-white p-3 text-black" aria-label="Administrator email" />
        <button className="rounded bg-amber-400 px-5 py-3 font-bold text-black">Send sign-in link</button>
      </form> : !authorized ? <div className="rounded-xl border border-red-400/40 p-6">This account is not authorized to access Orion recruiting data.</div> :
      <>
        <div className="mb-6 grid gap-4 sm:grid-cols-3">
          {[["Applications",total],["Hired",hired],["Hire rate",total ? (100*hired/total).toFixed(1)+"%" : "—"]].map(([label,value]) =>
            <div key={label} className="rounded-xl border border-white/15 bg-white/5 p-5"><div className="text-sm text-white/60">{label}</div><div className="mt-2 text-3xl font-black">{value}</div></div>)}
        </div>
        <div className="mb-5 flex flex-wrap gap-3">
          <label className="text-sm">Status <select className="ml-2 rounded bg-slate-800 p-2" value={filter} onChange={e => setFilter(e.target.value)}>
            <option value="all">All</option>{STATUSES.map(s => <option key={s} value={s}>{s}</option>)}</select></label>
          <label className="text-sm">Source <select className="ml-2 rounded bg-slate-800 p-2" value={sourceFilter} onChange={e => setSourceFilter(e.target.value)}>
            <option value="all">All</option>{sources.map(s => <option key={s} value={s}>{s}</option>)}</select></label>
        </div>
        {loading ? <p>Loading applications…</p> : <div className="overflow-x-auto rounded-xl border border-white/15">
          <table className="w-full text-left text-sm"><thead className="bg-white/10"><tr>{["Applied","Candidate","Position","Source","Status"].map(h => <th key={h} className="p-3">{h}</th>)}</tr></thead>
            <tbody>{visible.map(a => <tr key={a.id} className="border-t border-white/10">
              <td className="whitespace-nowrap p-3">{new Date(a.created_at).toLocaleDateString()}</td>
              <td className="p-3">{a.first_name} {a.last_name}</td><td className="p-3">{a.position_title}</td>
              <td className="p-3">{a.source || "Unattributed"}</td>
              <td className="p-3"><select aria-label={`Status for ${a.first_name} ${a.last_name}`} disabled={savingId===a.id}
                className="rounded bg-slate-800 p-2" value={a.status || "new"} onChange={e => changeStatus(a.id,e.target.value)}>
                {[...new Set([a.status || "new",...STATUSES])].map(s => <option key={s} value={s}>{s}</option>)}</select></td>
            </tr>)}</tbody></table>
          {!visible.length && <p className="p-5 text-white/60">No applications match these filters.</p>}
        </div>}
        <p className="mt-4 text-xs text-white/50">Historical records may not include a recruiting source. Hire rate is hires divided by recorded applications, not campaign conversion.</p>
      </>}
      {message && <p role="status" className="mt-5 rounded border border-amber-400/30 p-3 text-amber-200">{message}</p>}
    </div>
  </main>;
}
