import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "./lib/supabaseClient";
import {
  CheckCircle2,
  Clock,
  FileText,
  LogOut,
  Mail,
  RefreshCw,
  Save,
  Search,
  ShieldCheck,
  UserCheck,
  XCircle
} from "lucide-react";

const STATUS_OPTIONS = [
  "new",
  "reviewing",
  "needs_documents",
  "ffl_pending",
  "approved",
  "denied"
];

const STATUS_STYLES = {
  new: "bg-blue-400/15 text-blue-200 border-blue-300/30",
  reviewing: "bg-amber-400/15 text-amber-200 border-amber-300/30",
  needs_documents: "bg-purple-400/15 text-purple-200 border-purple-300/30",
  ffl_pending: "bg-orange-400/15 text-orange-200 border-orange-300/30",
  approved: "bg-emerald-400/15 text-emerald-200 border-emerald-300/30",
  denied: "bg-red-400/15 text-red-200 border-red-300/30"
};

export default function AdminDashboard() {
  const [session, setSession] = useState(null);
  const [email, setEmail] = useState("");
  const [applications, setApplications] = useState([]);
  const [salesReps, setSalesReps] = useState([]);
  const [selectedApp, setSelectedApp] = useState(null);
  const [activity, setActivity] = useState([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => listener.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (session) {
      fetchApplications();
      fetchSalesReps();
    }
  }, [session]);

  useEffect(() => {
    if (selectedApp?.id) fetchActivity(selectedApp.id);
  }, [selectedApp?.id]);

  const stats = useMemo(() => {
    return applications.reduce(
      (acc, app) => {
        const status = app.status || "new";
        acc.total += 1;
        acc[status] = (acc[status] || 0) + 1;
        return acc;
      },
      { total: 0 }
    );
  }, [applications]);

  const filteredApplications = useMemo(() => {
    return applications.filter((app) => {
      const text = `${app.business_name || ""} ${app.first_name || ""} ${app.last_name || ""} ${app.business_email || ""} ${app.ffl_number || ""} ${app.state || ""}`.toLowerCase();
      const matchesSearch = text.includes(search.toLowerCase());
      const matchesStatus = statusFilter === "all" || (app.status || "new") === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [applications, search, statusFilter]);

  async function login(e) {
    e.preventDefault();

    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: window.location.origin + "/admin"
      }
    });

    if (error) alert(error.message);
    else alert("Check your email for the admin login link.");
  }

  async function logout() {
    await supabase.auth.signOut();
  }

  async function fetchApplications() {
    const { data, error } = await supabase
      .from("dealer_applications")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      console.error(error);
      alert("Could not load applications. Check admin permissions/RLS.");
      return;
    }

    setApplications(data || []);

    if (!selectedApp && data?.length) {
      setSelectedApp(data[0]);
    } else if (selectedApp) {
      const refreshed = data?.find((item) => item.id === selectedApp.id);
      if (refreshed) setSelectedApp(refreshed);
    }
  }

  async function fetchSalesReps() {
    const { data, error } = await supabase
      .from("sales_reps")
      .select("*")
      .eq("active", true)
      .order("name", { ascending: true });

    if (error) {
      console.error(error);
      return;
    }

    setSalesReps(data || []);
  }

  async function fetchActivity(applicationId) {
    const { data, error } = await supabase
      .from("application_activity")
      .select("*")
      .eq("application_id", applicationId)
      .order("created_at", { ascending: false });

    if (error) {
      console.error(error);
      return;
    }

    setActivity(data || []);
  }

  async function logActivity(applicationId, action, note = "") {
    await supabase.from("application_activity").insert([
      {
        application_id: applicationId,
        actor: session?.user?.email || "admin",
        action,
        note
      }
    ]);
  }

  async function saveApplication(updates, actionLabel = "Updated application") {
    if (!selectedApp?.id) return;

    setSaving(true);

    const { data, error } = await supabase
      .from("dealer_applications")
      .update(updates)
      .eq("id", selectedApp.id)
      .select()
      .single();

    if (error) {
      console.error(error);
      alert(error.message);
      setSaving(false);
      return;
    }

    await logActivity(selectedApp.id, actionLabel, JSON.stringify(updates));
    setSelectedApp(data);
    await fetchApplications();
    await fetchActivity(selectedApp.id);
    setSaving(false);
  }

  function updateSelectedField(field, value) {
    setSelectedApp((prev) => ({ ...prev, [field]: value }));
  }

  async function saveDetailChanges() {
    await saveApplication(
      {
        status: selectedApp.status || "new",
        assigned_rep: selectedApp.assigned_rep || null,
        admin_notes: selectedApp.admin_notes || null,
        ffl_verified: Boolean(selectedApp.ffl_verified),
        ffl_expiration_date: selectedApp.ffl_expiration_date || null,
        ffl_premise_address: selectedApp.ffl_premise_address || null,
        ffl_validation_status: selectedApp.ffl_validation_status || "not_checked",
        ffl_validation_notes: selectedApp.ffl_validation_notes || null
      },
      "Saved admin detail changes"
    );
  }

  if (loading) {
    return <div className="min-h-screen bg-black p-8 text-white">Loading...</div>;
  }

  if (!session) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-black p-6 text-white">
        <form onSubmit={login} className="w-full max-w-md rounded-2xl border border-amber-400/50 bg-black/80 p-8 shadow-2xl shadow-amber-500/10">
          <h1 className="text-3xl font-black text-amber-300">Orion Admin Login</h1>
          <p className="mt-3 text-white/70">Enter your approved admin email to receive a secure magic link.</p>

          <input
            className="mt-6 w-full rounded-lg border border-white/20 bg-white/10 px-4 py-3 text-white outline-none focus:border-amber-400"
            type="email"
            placeholder="admin@orion..."
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />

          <button className="mt-5 w-full rounded-lg bg-amber-400 px-5 py-3 font-black text-black transition hover:bg-amber-300">
            Send Magic Link
          </button>
        </form>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-950 p-5 text-white lg:p-8">
      <div className="mx-auto max-w-[1600px]">
        <header className="flex flex-col gap-5 border-b border-white/10 pb-6 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-sm font-bold uppercase tracking-[0.2em] text-amber-300">Orion Wholesale</p>
            <h1 className="mt-2 text-4xl font-black">Dealer Admin Dashboard</h1>
            <p className="mt-2 text-white/60">Review, approve, assign, and manage dealer applications.</p>
          </div>
          <div className="flex gap-3">
            <button onClick={fetchApplications} className="inline-flex items-center gap-2 rounded-lg border border-white/15 px-4 py-2 text-sm font-bold hover:bg-white/10">
              <RefreshCw className="h-4 w-4" /> Refresh
            </button>
            <button onClick={logout} className="inline-flex items-center gap-2 rounded-lg border border-white/15 px-4 py-2 text-sm font-bold hover:bg-white/10">
              <LogOut className="h-4 w-4" /> Log Out
            </button>
          </div>
        </header>

        <section className="mt-6 grid gap-4 md:grid-cols-3 xl:grid-cols-6">
          <StatCard label="Total" value={stats.total || 0} icon={FileText} />
          <StatCard label="New" value={stats.new || 0} icon={Clock} />
          <StatCard label="Reviewing" value={stats.reviewing || 0} icon={Search} />
          <StatCard label="FFL Pending" value={stats.ffl_pending || 0} icon={ShieldCheck} />
          <StatCard label="Approved" value={stats.approved || 0} icon={CheckCircle2} />
          <StatCard label="Denied" value={stats.denied || 0} icon={XCircle} />
        </section>

        <section className="mt-6 grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
          <div className="rounded-2xl border border-white/10 bg-black/35 shadow-2xl shadow-black/20">
            <div className="flex flex-col gap-3 border-b border-white/10 p-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-3 h-4 w-4 text-white/40" />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search business, contact, email, FFL, state..."
                  className="w-full rounded-lg border border-white/10 bg-white/5 py-2.5 pl-10 pr-4 text-sm outline-none focus:border-amber-400"
                />
              </div>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="rounded-lg border border-white/10 bg-slate-950 px-3 py-2.5 text-sm outline-none focus:border-amber-400"
              >
                <option value="all">All Statuses</option>
                {STATUS_OPTIONS.map((status) => (
                  <option key={status} value={status}>{formatStatus(status)}</option>
                ))}
              </select>
            </div>

            <div className="max-h-[760px] overflow-auto">
              <table className="w-full min-w-[980px] border-collapse text-left text-sm">
                <thead className="sticky top-0 bg-slate-900 text-amber-300">
                  <tr>
                    <th className="p-4">Date</th>
                    <th className="p-4">Business</th>
                    <th className="p-4">Contact</th>
                    <th className="p-4">Email</th>
                    <th className="p-4">FFL</th>
                    <th className="p-4">State</th>
                    <th className="p-4">Status</th>
                    <th className="p-4">Rep</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredApplications.map((app) => (
                    <tr
                      key={app.id}
                      onClick={() => setSelectedApp(app)}
                      className={`cursor-pointer border-t border-white/10 transition hover:bg-white/5 ${selectedApp?.id === app.id ? "bg-amber-400/10" : ""}`}
                    >
                      <td className="p-4 text-white/70">{new Date(app.created_at).toLocaleDateString()}</td>
                      <td className="p-4 font-black">{app.business_name}</td>
                      <td className="p-4">{app.first_name} {app.last_name}</td>
                      <td className="p-4 text-white/75">{app.business_email}</td>
                      <td className="p-4 font-mono text-xs">{app.ffl_number}</td>
                      <td className="p-4">{app.state}</td>
                      <td className="p-4"><StatusBadge status={app.status || "new"} /></td>
                      <td className="p-4 text-white/70">{app.assigned_rep || "Unassigned"}</td>
                    </tr>
                  ))}

                  {filteredApplications.length === 0 && (
                    <tr>
                      <td colSpan="8" className="p-10 text-center text-white/45">No matching applications.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <ApplicationDetail
            app={selectedApp}
            activity={activity}
            salesReps={salesReps}
            saving={saving}
            onChange={updateSelectedField}
            onSave={saveDetailChanges}
            onQuickStatus={(status) => saveApplication({ status }, `Changed status to ${status}`)}
          />
        </section>
      </div>
    </main>
  );
}

function ApplicationDetail({ app, activity, salesReps, saving, onChange, onSave, onQuickStatus }) {
  if (!app) {
    return (
      <div className="rounded-2xl border border-white/10 bg-black/35 p-8 text-white/50">
        Select an application to view details.
      </div>
    );
  }

  return (
    <aside className="rounded-2xl border border-white/10 bg-black/35 shadow-2xl shadow-black/20">
      <div className="border-b border-white/10 p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm font-bold uppercase tracking-[0.18em] text-amber-300">Application Detail</p>
            <h2 className="mt-2 text-2xl font-black">{app.business_name}</h2>
            <p className="mt-1 text-white/60">{app.first_name} {app.last_name} • {app.state}</p>
          </div>
          <StatusBadge status={app.status || "new"} />
        </div>
      </div>

      <div className="max-h-[760px] overflow-auto p-5">
        <div className="grid gap-3 sm:grid-cols-2">
          <Info label="Email" value={app.business_email} icon={Mail} />
          <Info label="Phone" value={app.phone_number} />
          <Info label="FFL" value={app.ffl_number} />
          <Info label="Business Type" value={app.business_type} />
          <Info label="Referral" value={app.referral_source} />
          <Info label="Submitted" value={new Date(app.created_at).toLocaleString()} />
        </div>

        <div className="mt-5 rounded-xl border border-white/10 bg-white/[0.03] p-4">
          <h3 className="font-black text-amber-300">Address</h3>
          <p className="mt-2 text-sm leading-6 text-white/75">
            {app.street_address}<br />
            {app.city}, {app.state} {app.zip_code}
          </p>
        </div>

        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <Field label="Status">
            <select value={app.status || "new"} onChange={(e) => onChange("status", e.target.value)} className="admin-input">
              {STATUS_OPTIONS.map((status) => <option key={status} value={status}>{formatStatus(status)}</option>)}
            </select>
          </Field>

          <Field label="Assigned Sales Rep">
            <select value={app.assigned_rep || ""} onChange={(e) => onChange("assigned_rep", e.target.value)} className="admin-input">
              <option value="">Unassigned</option>
              {salesReps.map((rep) => <option key={rep.id} value={rep.name}>{rep.name}</option>)}
            </select>
          </Field>
        </div>

        <div className="mt-5 rounded-xl border border-white/10 bg-white/[0.03] p-4">
          <div className="mb-4 flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-amber-300" />
            <h3 className="font-black text-amber-300">FFL Validation</h3>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Validation Status">
              <select value={app.ffl_validation_status || "not_checked"} onChange={(e) => onChange("ffl_validation_status", e.target.value)} className="admin-input">
                <option value="not_checked">Not Checked</option>
                <option value="valid">Valid</option>
                <option value="expired">Expired</option>
                <option value="mismatch">Address Mismatch</option>
                <option value="invalid">Invalid</option>
              </select>
            </Field>

            <Field label="Expiration Date">
              <input type="date" value={app.ffl_expiration_date || ""} onChange={(e) => onChange("ffl_expiration_date", e.target.value)} className="admin-input" />
            </Field>
          </div>

          <label className="mt-4 flex items-center gap-3 text-sm font-bold text-white/80">
            <input type="checkbox" checked={Boolean(app.ffl_verified)} onChange={(e) => onChange("ffl_verified", e.target.checked)} className="h-4 w-4 accent-amber-400" />
            FFL Verified
          </label>

          <Field label="FFL Premise Address">
            <input value={app.ffl_premise_address || ""} onChange={(e) => onChange("ffl_premise_address", e.target.value)} className="admin-input" placeholder="Address returned from FFL validation" />
          </Field>

          <Field label="FFL Validation Notes">
            <textarea value={app.ffl_validation_notes || ""} onChange={(e) => onChange("ffl_validation_notes", e.target.value)} className="admin-input min-h-24" placeholder="Notes from validation check..." />
          </Field>
        </div>

        <Field label="Internal Admin Notes">
          <textarea value={app.admin_notes || ""} onChange={(e) => onChange("admin_notes", e.target.value)} className="admin-input min-h-28" placeholder="Add internal notes, sales context, missing documents, etc." />
        </Field>

        <div className="mt-5 flex flex-wrap gap-3">
          <button onClick={onSave} disabled={saving} className="inline-flex items-center gap-2 rounded-lg bg-amber-400 px-5 py-3 font-black text-black transition hover:bg-amber-300 disabled:opacity-50">
            <Save className="h-4 w-4" /> {saving ? "Saving..." : "Save Changes"}
          </button>
          <button onClick={() => onQuickStatus("approved")} className="inline-flex items-center gap-2 rounded-lg bg-emerald-500 px-4 py-3 font-black text-black">
            <CheckCircle2 className="h-4 w-4" /> Approve
          </button>
          <button onClick={() => onQuickStatus("denied")} className="inline-flex items-center gap-2 rounded-lg bg-red-500 px-4 py-3 font-black text-white">
            <XCircle className="h-4 w-4" /> Deny
          </button>
        </div>

        <div className="mt-7 rounded-xl border border-white/10 bg-white/[0.03] p-4">
          <h3 className="mb-4 flex items-center gap-2 font-black text-amber-300">
            <UserCheck className="h-5 w-5" /> Activity History
          </h3>
          <div className="space-y-3">
            {activity.map((item) => (
              <div key={item.id} className="rounded-lg border border-white/10 bg-black/35 p-3">
                <div className="flex items-center justify-between gap-3">
                  <p className="font-bold">{item.action}</p>
                  <p className="text-xs text-white/45">{new Date(item.created_at).toLocaleString()}</p>
                </div>
                <p className="mt-1 text-xs text-white/50">{item.actor}</p>
                {item.note && <p className="mt-2 text-xs leading-5 text-white/60">{item.note}</p>}
              </div>
            ))}
            {activity.length === 0 && <p className="text-sm text-white/45">No activity yet.</p>}
          </div>
        </div>
      </div>
    </aside>
  );
}

function StatCard({ label, value, icon: Icon }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-black/35 p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm text-white/50">{label}</p>
          <p className="mt-1 text-3xl font-black">{value}</p>
        </div>
        <Icon className="h-8 w-8 text-amber-300" />
      </div>
    </div>
  );
}

function StatusBadge({ status }) {
  return (
    <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-black uppercase tracking-wide ${STATUS_STYLES[status] || STATUS_STYLES.new}`}>
      {formatStatus(status)}
    </span>
  );
}

function Info({ label, value, icon: Icon }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
      <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-white/45">
        {Icon && <Icon className="h-3.5 w-3.5" />} {label}
      </p>
      <p className="mt-2 break-words text-sm font-semibold text-white/85">{value || "—"}</p>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <label className="mt-4 block">
      <span className="mb-2 block text-sm font-black text-white/80">{label}</span>
      {children}
    </label>
  );
}

function formatStatus(status = "new") {
  return status.replaceAll("_", " ").replace(/\b\w/g, (char) => char.toUpperCase());
}
