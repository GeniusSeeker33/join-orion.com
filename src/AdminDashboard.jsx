import React, { useEffect, useState } from "react";
import { supabase } from "./lib/supabaseClient";

export default function AdminDashboard() {
  const [session, setSession] = useState(null);
  const [email, setEmail] = useState("");
  const [applications, setApplications] = useState([]);
  const [loading, setLoading] = useState(true);

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
    if (session) fetchApplications();
  }, [session]);

  async function login(e) {
    e.preventDefault();

    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: window.location.origin + "/admin",
      },
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
      alert("Could not load applications.");
      return;
    }

    setApplications(data || []);
  }

  async function updateStatus(id, status) {
    const { error } = await supabase
      .from("dealer_applications")
      .update({ status })
      .eq("id", id);

    if (error) alert(error.message);
    else fetchApplications();
  }

  if (loading) return <div className="min-h-screen bg-black text-white p-8">Loading...</div>;

  if (!session) {
    return (
      <main className="min-h-screen bg-black text-white flex items-center justify-center p-6">
        <form onSubmit={login} className="w-full max-w-md rounded-xl border border-amber-400/50 bg-black/80 p-8">
          <h1 className="text-3xl font-black text-amber-300">Orion Admin Login</h1>
          <p className="mt-3 text-white/70">Enter your approved admin email.</p>

          <input
            className="mt-6 w-full rounded border border-white/20 bg-white/10 px-4 py-3 text-white"
            type="email"
            placeholder="admin@orion..."
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />

          <button className="mt-5 w-full rounded bg-amber-400 px-5 py-3 font-black text-black">
            Send Magic Link
          </button>
        </form>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-950 text-white p-6">
      <div className="mx-auto max-w-7xl">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-4xl font-black">Dealer Admin Dashboard</h1>
            <p className="mt-2 text-white/60">Review, approve, assign, and manage dealer applications.</p>
          </div>
          <button onClick={logout} className="rounded border border-white/20 px-4 py-2 text-sm">
            Log Out
          </button>
        </div>

        <div className="mt-8 overflow-x-auto rounded-xl border border-white/10">
          <table className="w-full min-w-[1100px] border-collapse bg-black/40 text-sm">
            <thead className="bg-white/10 text-left text-amber-300">
              <tr>
                <th className="p-4">Date</th>
                <th className="p-4">Business</th>
                <th className="p-4">Contact</th>
                <th className="p-4">Email</th>
                <th className="p-4">Phone</th>
                <th className="p-4">FFL</th>
                <th className="p-4">State</th>
                <th className="p-4">Status</th>
                <th className="p-4">Actions</th>
              </tr>
            </thead>
            <tbody>
              {applications.map((app) => (
                <tr key={app.id} className="border-t border-white/10">
                  <td className="p-4">{new Date(app.created_at).toLocaleDateString()}</td>
                  <td className="p-4 font-bold">{app.business_name}</td>
                  <td className="p-4">{app.first_name} {app.last_name}</td>
                  <td className="p-4">{app.business_email}</td>
                  <td className="p-4">{app.phone_number}</td>
                  <td className="p-4">{app.ffl_number}</td>
                  <td className="p-4">{app.state}</td>
                  <td className="p-4">
                    <span className="rounded-full bg-amber-400/15 px-3 py-1 text-amber-200">
                      {app.status || "new"}
                    </span>
                  </td>
                  <td className="p-4">
                    <div className="flex gap-2">
                      <button onClick={() => updateStatus(app.id, "approved")} className="rounded bg-emerald-500 px-3 py-1 font-bold text-black">
                        Approve
                      </button>
                      <button onClick={() => updateStatus(app.id, "denied")} className="rounded bg-red-500 px-3 py-1 font-bold text-white">
                        Deny
                      </button>
                      <button onClick={() => updateStatus(app.id, "reviewing")} className="rounded bg-white/15 px-3 py-1 font-bold text-white">
                        Review
                      </button>
                    </div>
                  </td>
                </tr>
              ))}

              {applications.length === 0 && (
                <tr>
                  <td colSpan="9" className="p-8 text-center text-white/50">
                    No dealer applications yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </main>
  );
}