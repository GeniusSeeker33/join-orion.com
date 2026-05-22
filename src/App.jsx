import React, { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { track } from "@vercel/analytics";
import { supabase } from "./lib/supabaseClient";
import {
  ArrowRight,
  Box,
  Boxes,
  Briefcase,
  CheckCircle2,
  CircleDollarSign,
  Headphones,
  Loader2,
  Lock,
  Paintbrush,
  Palette,
  ShieldCheck,
  ShoppingCart,
  Sparkles,
  Star,
  Truck,
  Zap
} from "lucide-react";

const backgroundImage = "/taylor-customs-hero.jpg";
const logoImage = "/orion-logo-white.png";

const dealerBenefits = [
  {
    icon: ShieldCheck,
    title: "Trusted Quality",
    text: "Premium products built to perform."
  },
  {
    icon: CircleDollarSign,
    title: "Dealer Pricing",
    text: "Competitive pricing that drives profit."
  },
  {
    icon: Headphones,
    title: "Dedicated Support",
    text: "A team that’s here to help you win."
  }
];

const whyChoose = [
  {
    icon: Box,
    title: "Massive Inventory",
    text: "Thousands of in-stock items ready to ship when you need them."
  },
  {
    icon: Boxes,
    title: "Drop Shipping",
    text: "Connect your store to our inventory for seamless fulfillment."
  },
  {
    icon: ShoppingCart,
    title: "Easy Ordering",
    text: "Talk with a Rep or order online. Simple, and efficient."
  },
  {
    icon: Truck,
    title: "Fast & Reliable Shipping",
    text: "Quick processing and dependable shipping you can count on."
  }
];

const customShop = [
  {
    icon: Paintbrush,
    title: "Exclusive Colors",
    text: "Unique color batches you won’t find anywhere else."
  },
  {
    icon: Palette,
    title: "Custom Designs",
    text: "Special finishes and designs built to your specs."
  },
  {
    icon: Zap,
    title: "Laser Engraving",
    text: "Precision laser engraving for logos, text, and custom art."
  },
  {
    icon: Star,
    title: "Custom Sights",
    text: "Upgraded sights for performance and presentation."
  },
  {
    icon: Sparkles,
    title: "Custom Grips",
    text: "High quality grips built for comfort and control."
  }
];

const howItWorks = [
  {
    title: "Apply Online",
    text: "Complete the application form with your business and FFL information."
  },
  {
    title: "We Review",
    text: "Our team verifies your account details and reviews your application."
  },
  {
    title: "Get Approved",
    text: "Once approved, you’ll get access to Orion dealer support and pricing."
  },
  {
    title: "Start Ordering",
    text: "Browse inventory, place orders, and grow your business with Orion."
  }
];

const initialForm = {
  firstName: "",
  businessName: "",
  email: "",
  phone: "",
  locationType: "",
  multipleLocations: "",
  certified: false
};

export default function OrionDealerLandingPage() {
  const [form, setForm] = useState(initialForm);
  const [submitStatus, setSubmitStatus] = useState("idle");
  const [submitMessage, setSubmitMessage] = useState("");

  const completion = useMemo(() => {
    const required = ["firstName", "businessName", "email", "phone", "locationType", "multipleLocations"];
    const filled = required.filter((key) => form[key]?.trim()).length;
    return Math.round((filled / required.length) * 100);
  }, [form]);

  const updateField = (event) => {
    const { name, value, type, checked } = event.target;

    setForm((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value
    }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setSubmitStatus("loading");
    setSubmitMessage("");

    const payload = {
      first_name: form.firstName.trim(),
      business_name: form.businessName.trim(),
      business_email: form.email.trim(),
      phone_number: form.phone.trim(),
      location_type: form.locationType,
      multiple_locations: form.multipleLocations === "Yes",
      certified_ffl: form.certified,
      status: "new"
    };

    const applicationId = crypto.randomUUID();

    const { error } = await supabase
      .from("dealer_applications")
      .insert([{ id: applicationId, ...payload }]);

    if (error) {
      console.error("Supabase insert error:", error);
      track("dealer_form_submit_error", { reason: "insert_failed" });
      setSubmitStatus("error");
      setSubmitMessage("Something went wrong. Please check your connection or contact Orion directly.");
      return;
    }

    const { error: emailError } = await supabase.functions.invoke("send-dealer-confirmation", {
      body: {
        firstName: form.firstName.trim(),
        email: form.email.trim(),
        businessName: form.businessName.trim(),
        phone: form.phone.trim(),
        locationType: form.locationType,
        multipleLocations: form.multipleLocations
      }
    });

    if (emailError) {
      console.error("Confirmation email error:", emailError);
    }

    track("dealer_form_submit_success");
    setSubmitStatus("success");
    setSubmitMessage("");
    setForm(initialForm);
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
      <div className="fixed inset-0 z-0 bg-black/38" aria-hidden="true" />
      <div className="fixed inset-0 z-0 bg-gradient-to-r from-black/70 via-black/48 to-black/62" aria-hidden="true" />
      <div
        className="fixed inset-0 z-0 bg-[radial-gradient(circle_at_25%_20%,rgba(255,255,255,0.06),transparent_25%),radial-gradient(circle_at_70%_25%,rgba(245,190,72,0.08),transparent_28%)]"
        aria-hidden="true"
      />

      <div className="relative z-10 mx-auto max-w-7xl px-4 py-5 sm:px-8 sm:py-6 lg:px-10">
        <header className="flex items-center justify-between gap-4">
          <a href="#top" className="inline-flex items-center">
            <img src={logoImage} alt="Orion Wholesale" className="h-11 w-auto object-contain sm:h-16" />
          </a>
          <nav className="hidden items-center gap-9 text-sm font-medium text-white/85 md:flex">
            <a href="#benefits" className="transition hover:text-amber-300">Benefits</a>
            <a href="#custom-shop" className="transition hover:text-amber-300">Custom Shop</a>
            <a href="#how-it-works" className="transition hover:text-amber-300">How It Works</a>
            <Link to="/careers" className="transition hover:text-amber-300">Careers</Link>
            <a href="#apply" className="rounded-md border border-amber-400 px-5 py-3 font-bold text-amber-300 transition hover:bg-amber-400 hover:text-black">Apply Now</a>
          </nav>
          <a href="#apply" className="rounded-md border border-amber-400 px-3 py-2 text-xs font-bold text-amber-300 md:hidden">Apply</a>
        </header>

        <section id="top" className="grid items-center gap-10 pb-10 pt-6 sm:pt-8 lg:min-h-[calc(100vh-110px)] lg:grid-cols-[1.08fr_0.92fr] lg:gap-14 lg:pb-12 lg:pt-10">
          <div className="flex flex-col justify-center">
            <p className="mb-3 text-xs font-bold uppercase tracking-[0.18em] text-amber-300 sm:mb-5 sm:text-sm">Join the Orion Network</p>
            <h1 className="max-w-2xl text-3xl font-black leading-[1.05] tracking-tight sm:text-6xl lg:text-7xl">
              Become an Orion Wholesale Dealer
            </h1>
            <p className="mt-5 max-w-2xl text-base leading-7 text-white/85 sm:mt-7 sm:text-xl sm:leading-8">
              Exclusive pricing, custom solutions, and dedicated support to help qualified dealers grow their business.
            </p>

            <div className="mt-8 grid max-w-2xl gap-6 sm:mt-12 sm:grid-cols-3 sm:gap-7">
              {dealerBenefits.map((item) => (
                <div key={item.title} className="group">
                  <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-2xl border border-amber-400/70 text-amber-300 transition group-hover:bg-amber-400 group-hover:text-black sm:mb-4 sm:h-12 sm:w-12">
                    <item.icon className="h-6 w-6 sm:h-7 sm:w-7" />
                  </div>
                  <h3 className="font-bold">{item.title}</h3>
                  <p className="mt-2 text-sm leading-6 text-white/70">{item.text}</p>
                </div>
              ))}
            </div>
          </div>

          <ApplicationForm
            form={form}
            completion={completion}
            submitStatus={submitStatus}
            submitMessage={submitMessage}
            onChange={updateField}
            onSubmit={handleSubmit}
            onReset={resetForm}
          />
        </section>

        <section id="benefits" className="border-t border-white/15 py-10">
          <div className="mb-8">
            <h2 className="text-3xl font-black">Why Dealers Choose Orion</h2>
            <div className="mt-4 h-0.5 w-16 bg-amber-400" />
          </div>
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
            {whyChoose.map((item) => (
              <div key={item.title} className="border-white/15 lg:border-r lg:pr-8 last:border-r-0">
                <item.icon className="h-10 w-10 text-amber-300" />
                <h3 className="mt-4 font-black">{item.title}</h3>
                <p className="mt-2 text-sm leading-6 text-white/70">{item.text}</p>
              </div>
            ))}
          </div>
        </section>

        <section id="custom-shop" className="rounded-xl border border-white/15 bg-black/45 p-6 shadow-2xl shadow-black/30 backdrop-blur-md sm:p-8">
          <div className="grid gap-8 lg:grid-cols-[1.05fr_2fr]">
            <div>
              <h2 className="text-3xl font-black text-amber-300">Full Service Custom Shop</h2>
              <div className="mt-4 h-0.5 w-16 bg-amber-400" />
              <p className="mt-6 leading-7 text-white/82">
                We help you stand out. Our custom shop creates batches of exclusive products tailored to your brand and your customers.
              </p>
              <a href="#apply" className="mt-7 inline-flex rounded-md border border-amber-400 px-6 py-3 text-sm font-black uppercase tracking-wide text-amber-300 transition hover:bg-amber-400 hover:text-black">
                Learn More
              </a>
            </div>

            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-5">
              {customShop.map((item) => (
                <div key={item.title} className="border-white/15 lg:border-l lg:pl-6">
                  <item.icon className="h-10 w-10 text-amber-300" />
                  <h3 className="mt-4 text-sm font-black text-amber-300">{item.title}</h3>
                  <p className="mt-2 text-sm leading-6 text-white/70">{item.text}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section id="how-it-works" className="py-12 text-center">
          <h2 className="text-3xl font-black">How It Works</h2>
          <div className="mx-auto mt-4 h-0.5 w-14 bg-amber-400" />
          <div className="relative mt-10 grid gap-8 md:grid-cols-4">
            <div className="absolute left-[12%] right-[12%] top-7 hidden border-t border-dashed border-amber-400/40 md:block" />
            {howItWorks.map((item, index) => (
              <div key={item.title} className="relative">
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full border border-amber-400 bg-black text-2xl font-black text-amber-300">
                  {index + 1}
                </div>
                <h3 className="mt-5 font-black">{item.title}</h3>
                <p className="mx-auto mt-2 max-w-xs text-sm leading-6 text-white/70">{item.text}</p>
              </div>
            ))}
          </div>
        </section>

        <section id="careers-cta" className="mt-6 mb-12 rounded-xl border border-white/15 bg-gradient-to-br from-black/60 to-black/30 p-6 shadow-2xl shadow-black/30 backdrop-blur-md sm:p-10">
          <div className="grid items-center gap-6 sm:grid-cols-[auto_1fr_auto]">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-amber-400/70 text-amber-300">
              <Briefcase className="h-7 w-7" />
            </div>
            <div>
              <h2 className="text-2xl font-black sm:text-3xl">Looking for a career at Orion?</h2>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-white/75 sm:text-base sm:leading-7">
                We&apos;re hiring across sales, fulfillment, and the custom shop. Browse open roles and apply directly.
              </p>
            </div>
            <Link
              to="/careers"
              onClick={() => track("candidate_cta_click", { location: "landing_footer" })}
              className="inline-flex items-center justify-center gap-2 rounded-md bg-gradient-to-r from-amber-300 to-amber-500 px-6 py-4 font-black uppercase tracking-wide text-black shadow-lg shadow-amber-500/20 transition hover:from-amber-200 hover:to-amber-400 sm:py-3"
            >
              View Open Roles <ArrowRight className="h-5 w-5" />
            </Link>
          </div>
        </section>

        <footer className="border-t border-white/10 py-6 text-center text-xs text-white/50">
          <p>&copy; {new Date().getFullYear()} Orion Wholesale. All rights reserved.</p>
        </footer>
      </div>
    </main>
  );
}

function ApplicationForm({ form, completion, submitStatus, submitMessage, onChange, onSubmit, onReset }) {
  if (submitStatus === "success") {
    return (
      <div id="apply" className="rounded-xl border border-emerald-400/60 bg-black/70 p-6 shadow-2xl shadow-black/50 backdrop-blur-xl sm:p-10">
        <div className="flex flex-col items-center text-center">
          <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-full border border-emerald-400 bg-emerald-500/10 text-emerald-300">
            <CheckCircle2 className="h-9 w-9" />
          </div>
          <h2 className="text-2xl font-black sm:text-3xl">Application Received</h2>
          <p className="mt-3 max-w-md text-white/80">
            Thanks for applying to Orion Wholesale. We&apos;ve sent a confirmation to your email and our team will review your FFL details and follow up shortly.
          </p>
          <button
            type="button"
            onClick={onReset}
            className="mt-7 inline-flex items-center gap-2 rounded-md border border-amber-400 px-5 py-3 text-sm font-black uppercase tracking-wide text-amber-300 transition hover:bg-amber-400 hover:text-black"
          >
            Submit another application
          </button>
        </div>
      </div>
    );
  }

  return (
    <form id="apply" onSubmit={onSubmit} className="rounded-xl border border-amber-400/60 bg-black/68 p-5 shadow-2xl shadow-black/50 backdrop-blur-xl sm:p-8 lg:max-h-[calc(100vh-140px)] lg:overflow-y-auto">
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black sm:text-3xl">Dealer Account Application</h2>
          <p className="mt-3 text-sm text-white/78 sm:text-base">Please complete the form below to apply for an Orion Wholesale dealer account.</p>
        </div>
        <div className="shrink-0 rounded-md border border-white/15 bg-white/5 px-3 py-2 text-center">
          <p className="text-lg font-black text-amber-300 sm:text-xl">{completion}%</p>
          <p className="text-[10px] uppercase tracking-wide text-white/50 sm:text-[11px]">complete</p>
        </div>
      </div>

      <Input label="First Name" name="firstName" value={form.firstName} onChange={onChange} required />
      <Input label="Business Name" name="businessName" value={form.businessName} onChange={onChange} required />
      <Input label="Business Email" name="email" type="email" value={form.email} onChange={onChange} placeholder="you@business.com" required />
      <Input label="Phone Number" name="phone" type="tel" value={form.phone} onChange={onChange} placeholder="(000) 000-0000" required />

      <RadioGroup
        label="Is your business a storefront or home-based?"
        name="locationType"
        value={form.locationType}
        onChange={onChange}
        options={["Storefront", "Home-Based"]}
        required
      />

      <RadioGroup
        label="Do you have multiple locations?"
        name="multipleLocations"
        value={form.multipleLocations}
        onChange={onChange}
        options={["Yes", "No"]}
        required
      />

      <div className="mt-6 rounded-lg border border-white/10 bg-white/[0.03] p-4">
        <div className="flex gap-4">
          <Lock className="mt-1 h-8 w-8 shrink-0 text-amber-300" />
          <div>
            <h3 className="font-black text-amber-300">FFL Verification</h3>
            <p className="mt-1 text-sm leading-6 text-white/70">
              By checking this box, I certify that I am a Federal Firearms Licensee and all information provided is accurate. Orion Wholesale reserves the right to verify all FFL information before approving any account.
            </p>
          </div>
        </div>
        <label className="mt-4 flex items-start gap-3 text-sm text-white/82">
          <input
            type="checkbox"
            name="certified"
            checked={form.certified}
            onChange={onChange}
            required
            className="mt-1 h-4 w-4 accent-amber-400"
          />
          <span>I certify that I am an FFL holder.</span>
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
            Submit Application <ArrowRight className="h-5 w-5" />
          </>
        )}
      </button>
      <p className="mt-4 flex items-center justify-center gap-2 text-center text-xs text-white/55">
        <Lock className="h-3.5 w-3.5 text-amber-300" /> Your information is secure and will not be shared.
      </p>
    </form>
  );
}

function Input({ label, name, value, onChange, type = "text", placeholder = "", required = false, hideLabel = false }) {
  return (
    <label className="mt-4 block">
      {!hideLabel && <span className="mb-2 block text-sm font-bold text-white">{label} {required && <span className="text-red-500">*</span>}</span>}
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

function RadioGroup({ label, name, value, onChange, options, required = false }) {
  return (
    <fieldset className="mt-4">
      <legend className="mb-2 block text-sm font-bold text-white">
        {label} {required && <span className="text-red-500">*</span>}
      </legend>
      <div className="flex flex-wrap gap-3">
        {options.map((option) => {
          const checked = value === option;
          return (
            <label
              key={option}
              className={`flex flex-1 cursor-pointer items-center gap-3 rounded-sm border px-4 py-3 transition ${
                checked
                  ? "border-amber-400 bg-amber-400/10 text-amber-200"
                  : "border-white/14 bg-white/[0.075] text-white/80 hover:border-white/30"
              }`}
            >
              <input
                type="radio"
                name={name}
                value={option}
                checked={checked}
                onChange={onChange}
                required={required}
                className="h-4 w-4 accent-amber-400"
              />
              <span className="font-semibold">{option}</span>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}

function Select({ label, name, value, onChange, required = false, hideLabel = false, children }) {
  return (
    <label className="mt-4 block">
      {!hideLabel && <span className="mb-2 block text-sm font-bold text-white">{label} {required && <span className="text-red-500">*</span>}</span>}
      <select
        name={name}
        value={value}
        onChange={onChange}
        required={required}
        className="w-full rounded-sm border border-white/14 bg-white/[0.075] px-4 py-3 text-white outline-none transition focus:border-amber-400 focus:bg-white/[0.10] [&>option]:bg-slate-950"
      >
        {children}
      </select>
    </label>
  );
}


