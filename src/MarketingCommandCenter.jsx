import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { marketingDevClient as supabase } from "./lib/marketingDevClient";
import MarketingCampaignPlanner from "./MarketingCampaignPlanner";
import MarketingContentStudio from "./MarketingContentStudio";

const ADMIN_EMAIL = "desiree@orionwholesaleonline.com";
const tabs = [["overview", "Overview"], ["campaigns", "Campaigns"], ["content", "Content"], ["approvals", "Approvals"], ["agents", "Agents"], ["settings", "Settings"]];
const campaigns = [
  { title: "Sales Executive recruiting", objective: "Qualified applications", channel: "Organic social + Meta", budget: "$250 proposed", status: "Planning" },
];
export default function MarketingCommandCenter() {
  const { pathname } = useLocation();
  const active = pathname.split("/")[2] || "overview";
  const [session, setSession] = useState(null);
  const [checking, setChecking] = useState(true);
  const [email, setEmail] = useState(ADMIN_EMAIL);
  const [password, setPassword] = useState("");

  const [message, setMessage] = useState("");
  useEffect(() => {
    let mounted = true;
    if (!supabase) { setMessage("Marketing development connection is not configured."); setChecking(false); return; }
    supabase.auth.getSession().then(({ data, error }) => {
      if (mounted) { setSession(data?.session || null); setChecking(false); if (error) setMessage(error.message); }
    });
    const { data } = supabase.auth.onAuthStateChange((_event, value) => { if (mounted) { setSession(value); setChecking(false); } });
    return () => { mounted = false; data.subscription.unsubscribe(); };
  }, []);
  const authorized = session?.user?.email?.toLowerCase() === ADMIN_EMAIL;
  async function signIn(e) {
    e.preventDefault(); setMessage("");
    if (!supabase) { setMessage("Development database configuration is missing."); return; }
    if (email.trim().toLowerCase() !== ADMIN_EMAIL) { setMessage("This preview is restricted to the marketing administrator."); return; }
    const { error } = await supabase.auth.signInWithPassword({ email: ADMIN_EMAIL, password });
    setMessage(error?.message || "Signed in."); if (!error) setPassword("");
  }
  return <main className="min-h-screen bg-slate-950 text-slate-100 px-5 py-10">
    <div className="mx-auto max-w-6xl">
      <header className="flex flex-wrap items-center justify-between gap-4 mb-8">
        <div><p className="text-amber-300 text-xs font-bold uppercase tracking-widest">Orion / GeniusSeeker</p><h1 className="text-3xl font-bold">Marketing Command Center</h1><p className="text-slate-400 mt-2">Join-Orion recruiting marketing • development integration</p></div>
        <Link to="/admin/recruiting" className="text-amber-300 underline">Recruiting dashboard</Link>
      </header>
      {checking ? <p>Checking administrator session…</p> : !authorized ? <section className="max-w-md rounded-xl border border-slate-700 bg-slate-900 p-6">
        <h2 className="text-xl font-semibold mb-3">Administrator sign-in</h2>
        <p className="text-slate-400 mb-4">Uses your dedicated Marketing development account. No live Join-Orion credentials are used.</p>
        <form onSubmit={signIn} className="grid gap-3"><label htmlFor="marketing-email">Email</label><input id="marketing-email" className="p-3 rounded bg-slate-800" type="email" value={email} onChange={e=>setEmail(e.target.value)} required /><label htmlFor="marketing-password">Development password</label><input id="marketing-password" type="password" autoComplete="current-password" className="p-3 rounded bg-slate-800" value={password} onChange={e=>setPassword(e.target.value)} required /><button className="rounded bg-emerald-400 text-slate-950 font-semibold p-3">Sign in</button></form>
        {message && <p role="status" className="mt-4">{message}</p>}
      </section> : <>
        <div className="flex justify-end mb-3"><button className="text-amber-300 underline" onClick={() => supabase.auth.signOut()}>Sign out of Marketing</button></div>
        <nav aria-label="Marketing sections" className="flex gap-2 flex-wrap mb-8">{tabs.map(([key,label])=><Link key={key} to={key==="overview"?"/marketing":`/marketing/${key}`} className={`px-4 py-2 rounded-lg border ${active===key?"border-amber-400 bg-slate-800":"border-slate-700"}`}>{label}</Link>)}</nav>
        {active==="overview" ? <section className="grid md:grid-cols-3 gap-4"><Summary label="Campaigns planned" value="1" /><Summary label="Proposed budget" value="$250" /><Summary label="Campaigns approved" value="0" /></section> : null}
        {["overview","campaigns"].includes(active) ? <section className="mt-6 rounded-xl border border-slate-700 bg-slate-900 p-6"><h2 className="text-xl font-semibold mb-4">Recruiting campaigns</h2>{campaigns.map(c=><article key={c.title} className="border-t border-slate-700 py-4"><h3 className="font-semibold">{c.title}</h3><p className="text-slate-400">{c.objective} · {c.channel} · {c.budget} · {c.status}</p></article>)}<p className="text-amber-200 text-sm">Planning reference only; not an approved campaign. The shared marketing API will be connected after authorization.</p></section> : null}
        {["overview","campaigns"].includes(active) && <MarketingCampaignPlanner />}
        {active==="content" && <MarketingContentStudio />}
        {!["overview","campaigns","content"].includes(active) && <section className="rounded-xl border border-slate-700 bg-slate-900 p-6"><h2 className="text-xl font-semibold">{tabs.find(t=>t[0]===active)?.[1] || "Marketing"}</h2><p className="text-slate-400 mt-2">Integration pending. No simulated metrics, approval actions, or agent execution.</p></section>}
      </>}
    </div>
  </main>;
}
function Summary({label,value}) { return <div className="rounded-xl border border-slate-700 bg-slate-900 p-6"><p className="text-slate-400">{label}</p><p className="text-3xl font-bold mt-2">{value}</p></div>; }
