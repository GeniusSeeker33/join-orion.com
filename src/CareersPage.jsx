import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { track } from "@vercel/analytics";
import { supabase } from "./lib/supabaseClient";
import {
  ArrowLeft,
  ArrowRight,
  Briefcase,
  CheckCircle2,
  Clock,
  DollarSign,
  Heart,
  Loader2,
  MapPin,
  Rocket,
  Upload,
  Users,
  X
} from "lucide-react";

const backgroundImage = "/taylor-customs-hero.jpg";
const logoImage = "/orion-logo-white.png";

const cultureValues = [
  {
    icon: Rocket,
    title: "Move Fast",
    text: "We ship, learn, and iterate. We trust our team to make calls and run with them."
  },
  {
    icon: Users,
    title: "Customer Obsessed",
    text: "Every role at Orion connects to a dealer or shooter. We win when they win."
  },
  {
    icon: Heart,
    title: "Built On Craft",
    text: "From the custom shop to the warehouse floor, quality is the standard, not the goal."
  }
];

const initialForm = {
  firstName: "",
  lastName: "",
  email: "",
  phone: "",
  positionId: "",
  positionTitle: "",
  coverLetter: "",
  resumeFile: null
};

export default function CareersPage() {
  const [jobs, setJobs] = useState([]);
  const [jobsStatus, setJobsStatus] = useState("loading");
  const [form, setForm] = useState(initialForm);
  const [submitStatus, setSubmitStatus] = useState("idle");
  const [submitMessage, setSubmitMessage] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase
        .from("job_postings")
        .select("id, title, location, employment_type, department, hours, pay, description")
        .eq("is_active", true)
        .order("created_at", { ascending: false });

      if (cancelled) return;

      if (error) {
        console.error("Job fetch error:", error);
        setJobsStatus("error");
        setJobs([]);
        return;
      }

      setJobs(data || []);
      setJobsStatus("ready");
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const completion = useMemo(() => {
    const required = ["firstName", "lastName", "email", "phone", "positionTitle"];
    const filled = required.filter((key) => form[key]?.trim?.()).length;
    return Math.round((filled / required.length) * 100);
  }, [form]);

  const updateField = (event) => {
    const { name, value, type, files } = event.target;
    setForm((prev) => ({
      ...prev,
      [name]: type === "file" ? files?.[0] || null : value
    }));
  };

  const selectJob = (job) => {
    setForm((prev) => ({
      ...prev,
      positionId: job.id,
      positionTitle: job.title
    }));
    track("candidate_position_select", { position: job.title });
    const formEl = document.getElementById("candidate-form");
    if (formEl) {
      formEl.scrollIntoView({ behavior: "smooth", block: "start" });
      setTimeout(() => {
        document.querySelector('input[name="firstName"]')?.focus();
      }, 500);
    }
  };

  const clearJobSelection = () => {
    setForm((prev) => ({ ...prev, positionId: "", positionTitle: "" }));
    document.getElementById("open-roles")?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const uploadResume = async (applicationId) => {
    if (!form.resumeFile) return null;
    const safeFileName = form.resumeFile.name.replace(/[^a-zA-Z0-9._-]/g, "-");
    const filePath = `${applicationId}/${Date.now()}-${safeFileName}`;
    const { error } = await supabase.storage
      .from("resumes")
      .upload(filePath, form.resumeFile, { cacheControl: "3600", upsert: false });
    if (error) {
      console.error("Resume upload error:", error);
      return null;
    }
    return filePath;
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setSubmitStatus("loading");
    setSubmitMessage("");

    const applicationId = crypto.randomUUID();

    const payload = {
      id: applicationId,
      first_name: form.firstName.trim(),
      last_name: form.lastName.trim(),
      email: form.email.trim(),
      phone: form.phone.trim(),
      position_id: form.positionId || null,
      position_title: form.positionTitle.trim(),
      cover_letter: form.coverLetter.trim() || null,
      status: "new"
    };

    const { error } = await supabase.from("candidate_applications").insert([payload]);

    if (error) {
      console.error("Candidate insert error:", error);
      track("candidate_form_submit_error", { reason: "insert_failed" });
      setSubmitStatus("error");
      setSubmitMessage("Something went wrong submitting your application. Please try again or email careers@join-orion.com.");
      return;
    }

    const resumePath = await uploadResume(applicationId);
    if (resumePath) {
      const { error: updateError } = await supabase
        .from("candidate_applications")
        .update({ resume_path: resumePath })
        .eq("id", applicationId);
      if (updateError) console.error("Resume path update error:", updateError);
    }

    const { error: emailError } = await supabase.functions.invoke("send-candidate-confirmation", {
      body: {
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
        email: form.email.trim(),
        phone: form.phone.trim(),
        positionTitle: form.positionTitle.trim(),
        coverLetter: form.coverLetter.trim() || null,
        resumePath
      }
    });
    if (emailError) console.error("Candidate confirmation email error:", emailError);

    track("candidate_form_submit_success", { position: form.positionTitle });
    setSubmitStatus("success");
    setForm(initialForm);
    const fileInputs = document.querySelectorAll('input[type="file"]');
    fileInputs.forEach((input) => {
      input.value = "";
    });
  };

  const resetForm = () => {
    setSubmitStatus("idle");
    setSubmitMessage("");
  };

  return (
    <main className="relative min-h-screen overflow-hidden bg-black text-white">
      <div
        className="fixed inset-0 z-0 bg-cover bg-[center_top] bg-no-repeat"
        style={{ backgroundImage: `url(${backgroundImage})` }}
        aria-hidden="true"
      />
      <div className="fixed inset-0 z-0 bg-black/55" aria-hidden="true" />
      <div className="fixed inset-0 z-0 bg-gradient-to-b from-black/70 via-black/55 to-black/80" aria-hidden="true" />

      <div className="relative z-10 mx-auto max-w-7xl px-4 py-5 sm:px-8 sm:py-6 lg:px-10">
        <header className="flex items-center justify-between gap-4">
          <Link to="/" className="inline-flex items-center">
            <img src={logoImage} alt="Orion Wholesale" className="h-11 w-auto object-contain sm:h-16" />
          </Link>
          <Link
            to="/"
            className="inline-flex items-center gap-2 rounded-md border border-white/20 px-4 py-2 text-xs font-bold text-white/85 transition hover:border-amber-400 hover:text-amber-300 sm:text-sm"
          >
            <ArrowLeft className="h-4 w-4" /> Back to dealers
          </Link>
        </header>

        <section className="pt-8 pb-10 sm:pt-12 sm:pb-14">
          <p className="mb-3 text-xs font-bold uppercase tracking-[0.18em] text-amber-300 sm:text-sm">Careers at Orion</p>
          <h1 className="max-w-3xl text-3xl font-black leading-[1.05] tracking-tight sm:text-6xl">
            Build the future of firearms wholesale.
          </h1>
          <p className="mt-5 max-w-2xl text-base leading-7 text-white/85 sm:text-xl sm:leading-8">
            Orion is a small, growing team building the tools, products, and service that dealers rely on. If you take pride in your craft, we&apos;d love to talk.
          </p>
          <a
            href="#open-roles"
            className="mt-7 inline-flex items-center gap-2 rounded-md bg-gradient-to-r from-amber-300 to-amber-500 px-6 py-3 font-black uppercase tracking-wide text-black shadow-lg shadow-amber-500/20 transition hover:from-amber-200 hover:to-amber-400"
          >
            See open roles <ArrowRight className="h-5 w-5" />
          </a>
        </section>

        <section className="border-t border-white/15 py-12">
          <h2 className="text-3xl font-black">What it&apos;s like to work here</h2>
          <div className="mt-4 h-0.5 w-16 bg-amber-400" />
          <div className="mt-8 grid gap-6 md:grid-cols-3">
            {cultureValues.map((value) => (
              <div key={value.title} className="rounded-xl border border-white/15 bg-black/45 p-6 backdrop-blur-md">
                <value.icon className="h-9 w-9 text-amber-300" />
                <h3 className="mt-4 font-black">{value.title}</h3>
                <p className="mt-2 text-sm leading-6 text-white/75">{value.text}</p>
              </div>
            ))}
          </div>
        </section>

        <section id="open-roles" className="py-12">
          <h2 className="text-3xl font-black">Open roles</h2>
          <div className="mt-4 h-0.5 w-16 bg-amber-400" />

          <div className="mt-8 space-y-4">
            {jobsStatus === "loading" && (
              <div className="flex items-center gap-3 rounded-xl border border-white/10 bg-black/40 p-6 text-white/70">
                <Loader2 className="h-5 w-5 animate-spin text-amber-300" /> Loading positions...
              </div>
            )}

            {jobsStatus === "error" && (
              <div className="rounded-xl border border-red-400/40 bg-red-500/10 p-6 text-red-200">
                We couldn&apos;t load open roles right now. Email <a className="underline" href="mailto:careers@join-orion.com">careers@join-orion.com</a> and we&apos;ll get back to you.
              </div>
            )}

            {jobsStatus === "ready" && jobs.length === 0 && (
              <div className="rounded-xl border border-white/10 bg-black/40 p-6 text-white/75">
                No open positions at the moment — but we&apos;re always interested in great people. Submit your info below and we&apos;ll reach out when a fit opens up.
              </div>
            )}

            {jobs.map((job) => (
              <JobCard key={job.id} job={job} onApply={() => selectJob(job)} />
            ))}
          </div>
        </section>

        <section id="candidate-form" className="pb-16 pt-4">
          <div className="rounded-xl border border-amber-400/60 bg-black/68 p-5 shadow-2xl shadow-black/50 backdrop-blur-xl sm:p-8">
            {submitStatus === "success" ? (
              <div className="flex flex-col items-center text-center">
                <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-full border border-emerald-400 bg-emerald-500/10 text-emerald-300">
                  <CheckCircle2 className="h-9 w-9" />
                </div>
                <h2 className="text-2xl font-black sm:text-3xl">Application Received</h2>
                <p className="mt-3 max-w-md text-white/80">
                  Thanks for applying. We&apos;ll review your background and reach out if there&apos;s a strong fit.
                </p>
                <button
                  type="button"
                  onClick={resetForm}
                  className="mt-7 inline-flex items-center gap-2 rounded-md border border-amber-400 px-5 py-3 text-sm font-black uppercase tracking-wide text-amber-300 transition hover:bg-amber-400 hover:text-black"
                >
                  Apply to another role
                </button>
              </div>
            ) : (
              <form onSubmit={handleSubmit}>
                <div className="mb-6 flex items-start justify-between gap-4">
                  <div>
                    <h2 className="text-2xl font-black sm:text-3xl">Apply to Orion</h2>
                    {!form.positionId && (
                      <p className="mt-3 text-sm text-white/78 sm:text-base">
                        Don&apos;t see your role? Submit a general application and we&apos;ll keep it on file.
                      </p>
                    )}
                  </div>
                  <div className="shrink-0 rounded-md border border-white/15 bg-white/5 px-3 py-2 text-center">
                    <p className="text-lg font-black text-amber-300 sm:text-xl">{completion}%</p>
                    <p className="text-[10px] uppercase tracking-wide text-white/50 sm:text-[11px]">complete</p>
                  </div>
                </div>

                {form.positionId && (
                  <div className="mb-2 flex items-start justify-between gap-4 rounded-lg border border-amber-400/60 bg-amber-400/10 px-4 py-3">
                    <div>
                      <p className="text-[11px] font-bold uppercase tracking-wide text-amber-300">Applying for</p>
                      <p className="mt-0.5 text-base font-black text-white sm:text-lg">{form.positionTitle}</p>
                    </div>
                    <button
                      type="button"
                      onClick={clearJobSelection}
                      className="inline-flex items-center gap-1 rounded-md border border-white/20 px-2.5 py-1.5 text-xs font-bold text-white/80 transition hover:border-amber-400 hover:text-amber-300"
                      aria-label="Change role"
                    >
                      <X className="h-3.5 w-3.5" /> Change role
                    </button>
                  </div>
                )}

                <div className="grid gap-4 sm:grid-cols-2">
                  <Input label="First Name" name="firstName" value={form.firstName} onChange={updateField} required />
                  <Input label="Last Name" name="lastName" value={form.lastName} onChange={updateField} required />
                </div>
                <Input label="Email" name="email" type="email" value={form.email} onChange={updateField} placeholder="you@email.com" required />
                <Input label="Phone Number" name="phone" type="tel" value={form.phone} onChange={updateField} placeholder="(000) 000-0000" required />
                {!form.positionId && (
                  <Input
                    label="Position of Interest"
                    name="positionTitle"
                    value={form.positionTitle}
                    onChange={updateField}
                    placeholder="e.g. Warehouse Associate, Custom Shop, or General Interest"
                    required
                  />
                )}

                <label className="mt-4 block">
                  <span className="mb-2 block text-sm font-bold text-white">Tell us about yourself (optional)</span>
                  <textarea
                    name="coverLetter"
                    value={form.coverLetter}
                    onChange={updateField}
                    rows={5}
                    placeholder="A short note on why you'd be a great fit at Orion."
                    className="w-full rounded-sm border border-white/14 bg-white/[0.075] px-4 py-3 text-white outline-none transition placeholder:text-white/38 focus:border-amber-400 focus:bg-white/[0.10]"
                  />
                </label>

                <div className="mt-6 rounded-lg border border-white/10 bg-white/[0.03] p-4">
                  <div className="flex items-start gap-3">
                    <Upload className="mt-1 h-6 w-6 shrink-0 text-amber-300" />
                    <div>
                      <h3 className="font-black text-amber-300">Upload Resume</h3>
                      <p className="mt-1 text-sm leading-6 text-white/60">
                        PDF, DOC, or DOCX. Up to 10MB.
                      </p>
                    </div>
                  </div>
                  <label className="mt-4 block">
                    <span className="sr-only">Resume</span>
                    <input
                      type="file"
                      name="resumeFile"
                      onChange={updateField}
                      accept=".pdf,.doc,.docx"
                      className="w-full rounded-sm border border-white/14 bg-white/[0.075] px-4 py-3 text-sm text-white file:mr-4 file:rounded file:border-0 file:bg-amber-400 file:px-4 file:py-2 file:font-bold file:text-black"
                    />
                  </label>
                </div>

                {submitMessage && submitStatus === "error" && (
                  <div className="mt-5 rounded-md border border-red-400/50 bg-red-500/10 px-4 py-3 text-sm font-semibold text-red-200">
                    {submitMessage}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={submitStatus === "loading"}
                  className="mt-5 flex w-full items-center justify-center gap-2 rounded-md bg-gradient-to-r from-amber-300 to-amber-500 px-6 py-4 font-black uppercase tracking-wide text-black shadow-lg shadow-amber-500/20 transition hover:from-amber-200 hover:to-amber-400 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {submitStatus === "loading" ? (
                    <>
                      <Loader2 className="h-5 w-5 animate-spin" /> Submitting...
                    </>
                  ) : (
                    <>
                      {form.positionId ? `Apply for ${form.positionTitle}` : "Submit Application"} <ArrowRight className="h-5 w-5" />
                    </>
                  )}
                </button>
              </form>
            )}
          </div>
        </section>

        <footer className="border-t border-white/10 py-6 text-center text-xs text-white/50">
          <p>&copy; {new Date().getFullYear()} Orion Wholesale. All rights reserved.</p>
        </footer>
      </div>
    </main>
  );
}

function JobCard({ job, onApply }) {
  const [expanded, setExpanded] = useState(false);
  const isLong = (job.description?.length ?? 0) > 280;
  return (
    <article className="rounded-xl border border-white/15 bg-black/50 p-6 shadow-lg shadow-black/30 backdrop-blur-md sm:p-7">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-xl font-black">{job.title}</h3>
            {job.department && (
              <span className="rounded-full border border-amber-400/40 px-2.5 py-0.5 text-xs font-bold text-amber-300">
                {job.department}
              </span>
            )}
          </div>
          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1.5 text-sm text-white/70">
            {job.location && (
              <span className="inline-flex items-center gap-1.5"><MapPin className="h-4 w-4" /> {job.location}</span>
            )}
            {job.employment_type && (
              <span className="inline-flex items-center gap-1.5"><Briefcase className="h-4 w-4" /> {job.employment_type}</span>
            )}
            {job.hours && (
              <span className="inline-flex items-center gap-1.5"><Clock className="h-4 w-4" /> {job.hours}</span>
            )}
            {job.pay && (
              <span className="inline-flex items-center gap-1.5 font-semibold text-amber-300"><DollarSign className="h-4 w-4" /> {job.pay}</span>
            )}
          </div>
          {job.description && (
            <div className="mt-4">
              <p className={`whitespace-pre-line text-sm leading-6 text-white/80 ${expanded || !isLong ? "" : "line-clamp-6"}`}>
                {job.description}
              </p>
              {isLong && (
                <button
                  type="button"
                  onClick={() => setExpanded((v) => !v)}
                  className="mt-3 text-xs font-bold uppercase tracking-wide text-amber-300 transition hover:text-amber-200"
                >
                  {expanded ? "Show less" : "Show full description"}
                </button>
              )}
            </div>
          )}
        </div>
        <button
          type="button"
          onClick={onApply}
          className="inline-flex items-center justify-center gap-2 rounded-md border border-amber-400 px-5 py-3 text-sm font-black uppercase tracking-wide text-amber-300 transition hover:bg-amber-400 hover:text-black sm:self-start"
        >
          Apply <ArrowRight className="h-4 w-4" />
        </button>
      </div>
    </article>
  );
}

function Input({ label, name, value, onChange, type = "text", placeholder = "", required = false }) {
  return (
    <label className="mt-4 block">
      <span className="mb-2 block text-sm font-bold text-white">
        {label} {required && <span className="text-red-500">*</span>}
      </span>
      <input
        name={name}
        type={type}
        value={value}
        onChange={onChange}
        placeholder={placeholder || label}
        required={required}
        className="w-full rounded-sm border border-white/14 bg-white/[0.075] px-4 py-3 text-white outline-none transition placeholder:text-white/38 focus:border-amber-400 focus:bg-white/[0.10]"
      />
    </label>
  );
}
