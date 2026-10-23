
import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "./lib/supabaseClient";

const ADMIN_EMAIL = "desiree@orionwholesaleonline.com";

const STATUSES = [
  "new",
  "screened",
  "interviewing",
  "offer",
  "hired",
  "rejected",
];

const CANDIDATE_FIELDS = [
  "id",
  "first_name",
  "last_name",
  "email",
  "phone",
  "position_title",
  "status",
  "source",
  "created_at",
  "cover_letter",
  "resume_path",
  "admin_notes",
  "recruiter",
].join(",");

export default function RecruitingDashboard() {
  const [session, setSession] = useState(null);
  const [checking, setChecking] = useState(true);
  const [email, setEmail] = useState(ADMIN_EMAIL);
  const [message, setMessage] = useState("");

  const [applications, setApplications] = useState([]);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState("all");
  const [sourceFilter, setSourceFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState(null);
  const [savingId, setSavingId] = useState(null);
  const [openingResume, setOpeningResume] = useState(false);
  const [notesDraft, setNotesDraft] = useState("");
  const [savingNotes, setSavingNotes] = useState(false);

  useEffect(() => {
    let active = true;

    supabase.auth.getSession().then(({ data, error }) => {
      if (!active) return;
      if (error) setMessage(error.message);
      setSession(data?.session ?? null);
      setChecking(false);
    });

    const { data } = supabase.auth.onAuthStateChange(
      (_event, nextSession) => {
        if (active) {
          setSession(nextSession);
          setChecking(false);
        }
      }
    );

    return () => {
      active = false;
      data.subscription.unsubscribe();
    };
  }, []);

  const authorized =
    session?.user?.email?.toLowerCase() === ADMIN_EMAIL;

  useEffect(() => {
    if (!authorized) {
      setApplications([]);
      setSelectedId(null);
      return;
    }

    let active = true;
    setLoading(true);

    supabase
      .from("candidate_applications")
      .select(CANDIDATE_FIELDS)
      .order("created_at", { ascending: false })
      .then(({ data, error }) => {
        if (!active) return;

        setLoading(false);

        if (error) {
          setMessage("Unable to load applications: " + error.message);
        } else {
          setApplications(data || []);
        }
      });

    return () => {
      active = false;
    };
  }, [authorized]);

  const sources = useMemo(
    () =>
      [
        ...new Set(
          applications.map(
            (a) => a.source?.trim() || "Unattributed"
          )
        ),
      ].sort(),
    [applications]
  );

  const visible = useMemo(() => {
    const query = search.trim().toLowerCase();

    return applications.filter((a) => {
      const matchesStatus =
        filter === "all" || a.status === filter;

      const matchesSource =
        sourceFilter === "all" ||
        (a.source?.trim() || "Unattributed") === sourceFilter;

      const searchableText = [
        a.first_name,
        a.last_name,
        a.email,
        a.position_title,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return (
        matchesStatus &&
        matchesSource &&
        searchableText.includes(query)
      );
    });
  }, [applications, filter, sourceFilter, search]);

  const selectedCandidate =
    applications.find((a) => a.id === selectedId) || null;

  const total = applications.length;

  const hired = applications.filter(
    (a) => a.status === "hired"
  ).length;

  const hireRate =
    total > 0 ? `${((hired / total) * 100).toFixed(1)}%` : "—";

  async function sendLink(event) {
    event.preventDefault();
    setMessage("");

    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: {
        emailRedirectTo:
          window.location.origin + "/admin/recruiting",
      },
    });

    setMessage(
      error
        ? error.message
        : "Check your inbox for the secure sign-in link."
    );
  }

  async function changeStatus(id, status) {
    setSavingId(id);
    setMessage("");

    const { data, error } = await supabase
      .from("candidate_applications")
      .update({ status })
      .eq("id", id)
      .select("id,status");

    setSavingId(null);

    if (error) {
      setMessage("Status update failed: " + error.message);
      return;
    }

    if (!data?.length) {
      setMessage(
        "Status was not saved. Please check administrator update permissions."
      );
      return;
    }

    setApplications((previous) =>
      previous.map((a) =>
        a.id === id ? { ...a, status } : a
      )
    );
  }

  function selectCandidate(candidate) {
    setSelectedId(candidate.id);
    setNotesDraft(candidate.admin_notes || "");
    setMessage("");
  }

  async function saveNotes() {
    if (!authorized || !selectedCandidate || savingNotes) return;
    setSavingNotes(true);
    setMessage("");

    const { data, error } = await supabase
      .from("candidate_applications")
      .update({ admin_notes: notesDraft })
      .eq("id", selectedCandidate.id)
      .select("id,admin_notes");

    setSavingNotes(false);

    if (error) {
      setMessage("Could not save recruiter notes: " + error.message);
      return;
    }
    if (!data?.length) {
      setMessage("Notes were not saved. Check administrator update permissions.");
      return;
    }
    setApplications((previous) =>
      previous.map((candidate) =>
        candidate.id === selectedCandidate.id
          ? { ...candidate, admin_notes: data[0].admin_notes }
          : candidate
      )
    );
    setMessage("Recruiter notes saved.");
  }

  async function openResume(candidate) {
    if (!authorized || !candidate?.resume_path || openingResume) return;

    setOpeningResume(true);
    setMessage("");

    try {
      const { data, error } = await supabase.storage
        .from("resumes")
        .createSignedUrl(candidate.resume_path, 60);

      if (error) throw error;
      if (!data?.signedUrl) throw new Error("No secure resume link was returned.");

      window.open(data.signedUrl, "_blank", "noopener,noreferrer");
    } catch (error) {
      setMessage("Unable to open resume: " + error.message);
    } finally {
      setOpeningResume(false);
    }
  }

  if (checking) {
    return (
      <main className="min-h-screen bg-slate-950 p-10 text-white">
        Checking sign-in…
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-950 px-5 py-10 text-white">
      <div className="mx-auto max-w-6xl">
        <header className="mb-8 flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-sm font-bold uppercase tracking-widest text-amber-400">
              Orion Wholesale · Private Administration
            </p>
            <h1 className="mt-2 text-3xl font-black">
              Recruiting Dashboard
            </h1>
          </div>

          <nav className="flex gap-4 text-sm">
            <Link
              className="text-amber-300 underline"
              to="/admin"
            >
              Dealer Admin
            </Link>

            {session && (
              <button
                type="button"
                className="underline"
                onClick={() => supabase.auth.signOut()}
              >
                Sign out
              </button>
            )}
          </nav>
        </header>

        {!session ? (
          <form
            onSubmit={sendLink}
            className="max-w-md space-y-4 rounded-xl border border-white/20 bg-white/5 p-6"
          >
            <h2 className="text-xl font-bold">
              Administrator sign-in
            </h2>

            <p className="text-sm text-white/70">
              We'll email you a secure sign-in link.
            </p>

            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              aria-label="Administrator email"
              className="w-full rounded bg-white p-3 text-black"
            />

            <button
              type="submit"
              className="rounded bg-amber-400 px-5 py-3 font-bold text-black"
            >
              Send sign-in link
            </button>
          </form>
        ) : !authorized ? (
          <div className="rounded-xl border border-red-400/40 p-6">
            This account is not authorized to access Orion
            recruiting data.
          </div>
        ) : (
          <>
            <section className="mb-6 grid gap-4 sm:grid-cols-3">
              {[
                ["Applications", total],
                ["Hired", hired],
                ["Hire rate", hireRate],
              ].map(([label, value]) => (
                <div
                  key={label}
                  className="rounded-xl border border-white/15 bg-white/5 p-5"
                >
                  <div className="text-sm text-white/60">
                    {label}
                  </div>
                  <div className="mt-2 text-3xl font-black">
                    {value}
                  </div>
                </div>
              ))}
            </section>

            <section className="mb-5 space-y-4">
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search candidates, email, or position..."
                aria-label="Search candidates"
                className="w-full rounded-lg border border-white/20 bg-slate-800 p-3 text-white placeholder:text-white/50"
              />

              <div className="flex flex-wrap gap-3">
                <label className="text-sm">
                  Status
                  <select
                    className="ml-2 rounded bg-slate-800 p-2"
                    value={filter}
                    onChange={(e) => setFilter(e.target.value)}
                  >
                    <option value="all">All</option>
                    {STATUSES.map((status) => (
                      <option key={status} value={status}>
                        {status}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="text-sm">
                  Source
                  <select
                    className="ml-2 rounded bg-slate-800 p-2"
                    value={sourceFilter}
                    onChange={(e) =>
                      setSourceFilter(e.target.value)
                    }
                  >
                    <option value="all">All</option>
                    {sources.map((source) => (
                      <option key={source} value={source}>
                        {source}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <p className="text-sm text-white/60">
                Showing {visible.length} of {total} applications
              </p>
            </section>

            {loading ? (
              <p>Loading applications…</p>
            ) : (
              <div className="overflow-x-auto rounded-xl border border-white/15">
                <table className="w-full text-left text-sm">
                  <thead className="bg-white/10">
                    <tr>
                      {[
                        "Applied",
                        "Candidate",
                        "Position",
                        "Source",
                        "Status",
                      ].map((heading) => (
                        <th key={heading} className="p-3">
                          {heading}
                        </th>
                      ))}
                    </tr>
                  </thead>

                  <tbody>
                    {visible.map((candidate) => (
                      <tr
                        key={candidate.id}
                        className="border-t border-white/10"
                      >
                        <td className="whitespace-nowrap p-3">
                          {new Date(
                            candidate.created_at
                          ).toLocaleDateString()}
                        </td>

                        <td className="p-3">
                          <button
                            type="button"
                            onClick={() =>
                              selectCandidate(candidate)
                            }
                            className="text-left font-semibold text-amber-300 hover:underline"
                          >
                            {candidate.first_name}{" "}
                            {candidate.last_name}
                          </button>
                        </td>

                        <td className="p-3">
                          {candidate.position_title}
                        </td>

                        <td className="p-3">
                          {candidate.source || "Unattributed"}
                        </td>

                        <td className="p-3">
                          <select
                            aria-label={`Status for ${candidate.first_name} ${candidate.last_name}`}
                            disabled={
                              savingId === candidate.id
                            }
                            className="rounded bg-slate-800 p-2"
                            value={candidate.status || "new"}
                            onChange={(e) =>
                              changeStatus(
                                candidate.id,
                                e.target.value
                              )
                            }
                          >
                            {[
                              ...new Set([
                                candidate.status || "new",
                                ...STATUSES,
                              ]),
                            ].map((status) => (
                              <option
                                key={status}
                                value={status}
                              >
                                {status}
                              </option>
                            ))}
                          </select>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                {!visible.length && (
                  <p className="p-5 text-white/60">
                    No applications match these filters.
                  </p>
                )}
              </div>
            )}

            {selectedCandidate && (
              <section
                className="mt-6 rounded-xl border border-amber-400/30 bg-white/5 p-6"
                aria-label="Candidate details"
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-widest text-amber-400">
                      Candidate Profile
                    </p>

                    <h2 className="mt-2 text-2xl font-bold">
                      {selectedCandidate.first_name}{" "}
                      {selectedCandidate.last_name}
                    </h2>

                    <p className="mt-1 text-white/70">
                      {selectedCandidate.position_title}
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => setSelectedId(null)}
                    className="rounded border border-white/30 px-3 py-2"
                  >
                    Close
                  </button>
                </div>

                <div className="mt-6 grid gap-4 sm:grid-cols-2">
                  <div>
                    <p className="text-xs text-white/50">
                      Email
                    </p>
                    <p>
                      {selectedCandidate.email ||
                        "Not provided"}
                    </p>
                  </div>

                  <div>
                    <p className="text-xs text-white/50">
                      Phone
                    </p>
                    <p>
                      {selectedCandidate.phone ||
                        "Not provided"}
                    </p>
                  </div>

                  <div>
                    <p className="text-xs text-white/50">
                      Applied
                    </p>
                    <p>
                      {new Date(
                        selectedCandidate.created_at
                      ).toLocaleDateString()}
                    </p>
                  </div>

                  <div>
                    <p className="text-xs text-white/50">
                      Source
                    </p>
                    <p>
                      {selectedCandidate.source ||
                        "Unattributed"}
                    </p>
                  </div>

                  <div>
                    <p className="text-xs text-white/50">
                      Status
                    </p>
                    <p className="capitalize">
                      {selectedCandidate.status || "new"}
                    </p>
                  </div>

                  <div>
                    <p className="text-xs text-white/50">
                      Recruiter
                    </p>
                    <p>
                      {selectedCandidate.recruiter ||
                        "Not assigned"}
                    </p>
                  </div>
                </div>

                <div className="mt-6">
                  <h3 className="font-semibold text-amber-300">
                    Cover Letter
                  </h3>
                  <p className="mt-2 whitespace-pre-wrap text-sm text-white/80">
                    {selectedCandidate.cover_letter ||
                      "No cover letter submitted."}
                  </p>
                </div>

                <div className="mt-6">
                  <h3 className="font-semibold text-amber-300">
                    Recruiter Notes
                  </h3>
                  <textarea
                    aria-label="Recruiter notes"
                    value={notesDraft}
                    onChange={(event) => setNotesDraft(event.target.value)}
                    rows={5}
                    className="mt-2 w-full rounded border border-white/20 bg-slate-800 p-3 text-white"
                    placeholder="Screening feedback, interview observations, next steps..."
                  />
                  <div className="mt-2 flex items-center gap-3">
                    <button
                      type="button"
                      disabled={savingNotes || notesDraft === (selectedCandidate.admin_notes || "")}
                      onClick={saveNotes}
                      className="rounded bg-amber-400 px-4 py-2 font-semibold text-black disabled:opacity-50"
                    >
                      {savingNotes ? "Saving…" : "Save notes"}
                    </button>
                    {notesDraft !== (selectedCandidate.admin_notes || "") && (
                      <span className="text-xs text-amber-200">Unsaved changes</span>
                    )}
                  </div>
                </div>

                <div className="mt-6">
                  <h3 className="font-semibold text-amber-300">
                    Resume
                  </h3>
                  {selectedCandidate.resume_path ? (
                    <button
                      type="button"
                      disabled={openingResume}
                      onClick={() => openResume(selectedCandidate)}
                      className="mt-2 rounded bg-amber-400 px-4 py-2 font-semibold text-black disabled:opacity-50"
                    >
                      {openingResume ? "Opening resume…" : "Open resume securely"}
                    </button>
                  ) : (
                    <p className="mt-2 text-sm text-white/70">
                      No resume attached.
                    </p>
                  )}
                </div>
              </section>
            )}

            <p className="mt-4 text-xs text-white/50">
              Historical records may not include a recruiting
              source. Hire rate is hires divided by recorded
              applications, not campaign conversion.
            </p>
          </>
        )}

        {message && (
          <p
            role="status"
            className="mt-5 rounded border border-amber-400/30 p-3 text-amber-200"
          >
            {message}
          </p>
        )}
      </div>
    </main>
  );
}
