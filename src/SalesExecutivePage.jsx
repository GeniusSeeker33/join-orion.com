
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { track } from "@vercel/analytics";
import {
  ArrowRight,
  MapPin,
  Users,
  TrendingUp,
  GraduationCap,
  Phone,
  Clock,
  DollarSign,
  Target,
  PlayCircle,
  Briefcase
} from "lucide-react";
import { supabase } from "./lib/supabaseClient";
import VisitorCounter from "./VisitorCounter.jsx";

const CAMPAIGN = "orion_sales_executive";

const benefits = [
  {
    Icon: TrendingUp,
    title: "Huge Opportunity",
    text: "More than 70,000 FFL dealers nationwide and thousands of potential new customers."
  },
  {
    Icon: Users,
    title: "Career Growth",
    text: "Build lasting dealer relationships and a book of business that grows over time."
  },
  {
    Icon: GraduationCap,
    title: "Training & Support",
    text: "4–6 weeks of onboarding, ongoing coaching, product education, and sales development."
  },
  {
    Icon: Clock,
    title: "Work-Life Balance",
    text: "Monday–Friday schedule, no nights or weekends, and a business casual environment."
  }
];

const responsibilities = [
  "Make 80–100 outbound calls daily to develop and grow dealer accounts.",
  "Build lasting customer relationships and identify sales opportunities.",
  "Manage your book of business, process orders, and stay informed on products.",
  "Participate in daily coaching and work toward measurable performance goals."
];

export default function SalesExecutivePage() {
  const [job, setJob] = useState(null);
  const [status, setStatus] = useState("loading");

  useEffect(() => {
    let active = true;

    async function loadJob() {
      try {
        const { data, error } = await supabase
          .from("job_postings")
          .select("id, title, location, employment_type")
          .eq("is_active", true)
          .ilike("title", "%Sales Executive%")
          .limit(1);

        if (!active) return;
        if (error) throw error;

        setJob(data?.[0] || null);
        setStatus("ready");
      } catch (error) {
        console.error("Job lookup failed:", error);
        if (active) setStatus("error");
      }
    }

    loadJob();
    return () => { active = false; };
  }, []);

  const applicationUrl = (() => {
    if (!job) return null;

    const params = new URLSearchParams(window.location.search);
    params.set("job", job.id);
    params.set("utm_source", params.get("utm_source") || "join_orion");
    params.set("utm_medium", params.get("utm_medium") || "landing_page");
    params.set("utm_campaign", params.get("utm_campaign") || CAMPAIGN);

    return `/careers?${params.toString()}`;
  })();

  function ApplyButton({ secondary = false }) {
    if (!applicationUrl) return null;

    return (
      <a
        href={applicationUrl}
        onClick={() =>
          track("sales_executive_apply_click", {
            campaign: CAMPAIGN,
            source:
              new URLSearchParams(window.location.search).get("utm_source") ||
              "direct"
          })
        }
        className={
          "inline-flex items-center justify-center gap-3 rounded-lg px-8 py-4 " +
          "text-sm font-black uppercase tracking-wide transition hover:-translate-y-0.5 " +
          (secondary
            ? "border border-amber-400 text-amber-300 hover:bg-amber-400 hover:text-black"
            : "bg-amber-400 text-black shadow-lg shadow-amber-500/20 hover:bg-amber-300")
        }
      >
        Apply Now <ArrowRight size={19} />
      </a>
    );
  }

  return (
    <main className="min-h-screen bg-[#0b1018] text-white">
      {/* HEADER */}
      <header className="border-b border-white/10">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-5">
          <Link to="/">
            <img
              src="/orion-logo-white.png"
              alt="Orion Wholesale"
              className="h-12 w-auto object-contain sm:h-14"
            />
          </Link>

          <nav className="flex items-center gap-6">
            <Link
              to="/careers"
              className="text-sm text-white/70 hover:text-amber-300"
            >
              All Careers
            </Link>
            {applicationUrl && (
              <a
                href={applicationUrl}
                className="hidden rounded-md border border-amber-400 px-5 py-2 text-sm font-bold text-amber-300 hover:bg-amber-400 hover:text-black sm:inline-flex"
              >
                Apply Now
              </a>
            )}
          </nav>
        </div>
      </header>

      {/* HERO */}
      <section className="mx-auto grid max-w-7xl items-center gap-10 px-6 py-12 lg:grid-cols-2 lg:py-16">
        <div>
          <p className="mb-5 text-xs font-black uppercase tracking-[0.2em] text-amber-300">
            Orion Wholesale · We're Hiring
          </p>

          <h1 className="text-4xl font-black leading-tight sm:text-5xl xl:text-6xl">
            Build Your Career in Sales.
            <span className="mt-2 block text-amber-300">
              Grow With Orion.
            </span>
          </h1>

          <p className="mt-6 max-w-xl text-lg leading-8 text-white/75">
            Join a growing wholesale distribution team where relationships,
            determination, and performance matter. Build your own book of
            business and create long-term earning potential.
          </p>

          <div className="mt-6 flex flex-wrap gap-5 text-sm text-white/70">
            <span className="flex items-center gap-2">
              <MapPin size={18} className="text-amber-300" />
              Jeffersonville, Indiana
            </span>
            <span className="flex items-center gap-2">
              <Briefcase size={18} className="text-amber-300" />
              Inside Sales Executive
            </span>
          </div>

          <div className="mt-8"><ApplyButton /></div>

          {status === "loading" && (
            <p className="mt-3 text-sm text-white/50">
              Checking position availability...
            </p>
          )}
          {status === "error" && (
            <p className="mt-3 text-sm text-white/60">
              Unable to load this position.{" "}
              <Link to="/careers" className="underline">View careers.</Link>
            </p>
          )}
          {status === "ready" && !job && (
            <p className="mt-3 text-sm text-white/60">
              This position is not currently listed.{" "}
              <Link to="/careers" className="underline">See open roles.</Link>
            </p>
          )}
        </div>

        <div className="relative overflow-hidden rounded-2xl border border-white/15 shadow-2xl">
          <img
            src="/orion-sales-team.png"
            alt="Orion Wholesale sales team in Jeffersonville"
            className="aspect-[4/3] w-full object-cover"
          />
          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 to-transparent px-6 pb-6 pt-20">
            <p className="text-sm font-bold uppercase tracking-widest text-amber-300">
              Inside Orion Wholesale
            </p>
            <p className="mt-1 font-semibold">
              Real People. Real Relationships. Real Opportunity.
            </p>
          </div>
        </div>
      </section>

      {/* COMPENSATION */}
      <section className="border-y border-white/10 bg-[#121923] py-14">
        <div className="mx-auto max-w-6xl px-6">
          <div className="text-center">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-amber-300">
              Your Earning Potential
            </p>
            <h2 className="mt-3 text-3xl font-black sm:text-4xl">
              Compensation & Opportunity
            </h2>
          </div>
          
          <div className="mt-9 grid gap-5 md:grid-cols-3">
            <div className="rounded-xl border border-amber-400/30 bg-amber-400/[0.06] p-7">
              <DollarSign className="h-8 w-8 text-amber-300" />

              <h3 className="mt-4 text-xl font-bold">Year 1</h3>

              <p className="mt-3 text-2xl font-black text-amber-300">
                $41,200 First-Year Compensation Opportunity
              </p>

              <p className="mt-3 text-sm leading-7 text-white/70">
                $31,200 annual base salary plus up to $10,000 in
                retention bonuses ($2,500 every 90 days).
                PLUS uncapped commissions, performance bonuses,
                and SPIFFs!
              </p>
            </div>

            <div className="rounded-xl border border-white/10 bg-white/[0.04] p-7">
              <TrendingUp className="h-8 w-8 text-amber-300" />
              <h3 className="mt-4 text-xl font-bold">Earning Potential</h3>
              <p className="mt-3 text-2xl font-black text-amber-300">
                $50K–$70K+
              </p>
              <p className="mt-3 text-sm leading-7 text-white/70">
                Typical first-year earnings: $50K–$60K.
                High performers: $65K–$70K+.
                Top producers may reach $100K+ by Year 2.
              </p>
            </div>

            <div className="rounded-xl border border-white/10 bg-white/[0.04] p-7">
              <Target className="h-8 w-8 text-amber-300" />
              <h3 className="mt-4 text-xl font-bold">Year 2 & Beyond</h3>
              <p className="mt-3 text-2xl font-black text-amber-300">
                Uncapped Commissions
              </p>
              <p className="mt-3 text-sm leading-7 text-white/70">
                $25,000 annual base salary plus uncapped commissions,
                performance bonuses, and SPIFF incentives.
              </p>
            </div>
          </div>

          <p className="mx-auto mt-6 max-w-4xl text-center text-xs leading-6 text-white/55">
            Quarterly retention bonuses are subject to meeting individual
            performance goals and averaging at least 2.5 hours of daily talk
            time. Earnings vary based on individual performance and are not guaranteed.
          </p>
        </div>
      </section>

      {/* WHY ORION */}
      <section className="mx-auto max-w-7xl px-6 py-16">
        <div className="text-center">
          <h2 className="text-3xl font-black sm:text-4xl">
            Why Join Orion?
          </h2>
        </div>

        <div className="mt-9 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {benefits.map(({ Icon, title, text }) => (
            <div
              key={title}
              className="rounded-xl border border-white/10 bg-[#121923] p-6"
            >
              <Icon className="h-9 w-9 text-amber-300" />
              <h3 className="mt-4 text-lg font-bold">{title}</h3>
              <p className="mt-3 text-sm leading-7 text-white/65">
                {text}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* RESPONSIBILITIES */}
      <section className="border-y border-white/10 bg-[#121923] py-16">
        <div className="mx-auto grid max-w-6xl gap-12 px-6 lg:grid-cols-2">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-amber-300">
              The Role
            </p>
            <h2 className="mt-3 text-3xl font-black">
              What You'll Do
            </h2>
            <ul className="mt-7 space-y-4">
              {responsibilities.map((item) => (
                <li key={item} className="flex items-start gap-3 text-white/75">
                  <ArrowRight className="mt-1 h-5 w-5 shrink-0 text-amber-300" />
                  <span className="leading-7">{item}</span>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-amber-300">
              The Right Fit
            </p>
            <h2 className="mt-3 text-3xl font-black">
              Who Thrives at Orion?
            </h2>
            <p className="mt-7 text-lg leading-8 text-white/75">
              We're looking for competitive, coachable, resilient,
              relationship-driven people who are motivated by results.
            </p>
            <p className="mt-5 leading-8 text-white/65">
              Sales experience is helpful, but attitude, work ethic,
              and willingness to learn matter just as much.
            </p>
            <p className="mt-5 leading-8 text-white/65">
              Success requires consistency, accountability, and a
              commitment to developing your skills every day.
            </p>
          </div>
        </div>

        <div className="mt-12 text-center">
          <ApplyButton secondary />
        </div>
      </section>

      {/* VIDEO */}
      <section className="px-6 py-16 sm:py-20">
        <div className="mx-auto max-w-5xl text-center">
          <PlayCircle className="mx-auto h-11 w-11 text-amber-300" />

          <p className="mt-5 text-xs font-bold uppercase tracking-[0.2em] text-amber-300">
            Inside Orion Wholesale
          </p>

          <h2 className="mt-4 text-3xl font-black sm:text-4xl">
            A Day in the Life of a Sales Executive
          </h2>

          <p className="mx-auto mt-5 max-w-2xl leading-8 text-white/70">
            Take a look inside Orion and get a glimpse of what
            it's like to be part of our sales team.
          </p>

          <div className="mx-auto mt-10 w-full max-w-[330px] overflow-hidden rounded-2xl border border-white/15 bg-black shadow-2xl">
            <iframe
              className="aspect-[9/16] w-full"
              src="https://www.youtube-nocookie.com/embed/kRoyTbkqxYQ"
              title="A Day in the Life of a Sales Executive at Orion Wholesale"
              loading="lazy"
              referrerPolicy="strict-origin-when-cross-origin"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              allowFullScreen
            />
          </div>
        </div>
      </section>

      {/* FINAL CTA */}
      <section className="border-t border-white/10 bg-[#121923] px-6 py-16 text-center">
        <h2 className="text-3xl font-black sm:text-5xl">
          Ready to Build Your Future?
        </h2>
        <p className="mx-auto mt-5 max-w-xl text-lg leading-8 text-white/70">
          Take the next step toward a career where your effort,
          relationships, and results make a difference.
        </p>
        <div className="mt-8"><ApplyButton /></div>
      </section>

      <footer className="border-t border-white/10 px-6 py-8 text-center text-sm text-white/45">
        <div>© {new Date().getFullYear()} Orion Wholesale · Jeffersonville, Indiana</div>
        <div className="mt-3 flex justify-center"><VisitorCounter page="sales_executive" /></div>
      </footer>
    </main>
  );
}

