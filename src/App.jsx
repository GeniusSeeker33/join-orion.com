import React, { useMemo, useState } from "react";
import { supabase } from "./lib/supabaseClient";
import {
  ArrowRight,
  Box,
  CircleDollarSign,
  Headphones,
  Lock,
  Paintbrush,
  Palette,
  ShieldCheck,
  ShoppingCart,
  Sparkles,
  Star,
  Truck,
  Upload,
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
    icon: CircleDollarSign,
    title: "Unbeatable Pricing",
    text: "Volume discounts and tiered pricing designed for your bottom line."
  },
  {
    icon: ShoppingCart,
    title: "Easy Online Ordering",
    text: "Our portal makes ordering fast, simple, and efficient."
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
  lastName: "",
  businessName: "",
  ffl: "",
  email: "",
  phone: "",
  street: "",
  city: "",
  state: "",
  zip: "",
  businessType: "",
  referralSource: "",
  certified: false,
  fflFile: null,
  resaleCertificateFile: null,
  driversLicenseFile: null
};

export default function OrionDealerLandingPage() {
  const [form, setForm] = useState(initialForm);
  const [submitStatus, setSubmitStatus] = useState("idle");
  const [submitMessage, setSubmitMessage] = useState("");

  const completion = useMemo(() => {
    const required = [
      "firstName",
      "lastName",
      "businessName",
      "ffl",
      "email",
      "phone",
      "street",
      "city",
      "state",
      "zip",
      "businessType",
      "referralSource"
    ];
    const filled = required.filter((key) => form[key]?.trim()).length;
    return Math.round((filled / required.length) * 100);
  }, [form]);

  const updateField = (event) => {
    const { name, value, type, checked, files } = event.target;

    setForm((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : type === "file" ? files?.[0] || null : value
    }));
  };

  const uploadDealerDocuments = async (applicationId) => {
    const uploadedDocs = [
      { type: "ffl", file: form.fflFile },
      { type: "resale_certificate", file: form.resaleCertificateFile },
      { type: "drivers_license", file: form.driversLicenseFile }
    ];

    for (const doc of uploadedDocs) {
      if (!doc.file) continue;

      const safeFileName = doc.file.name.replace(/[^a-zA-Z0-9._-]/g, "-");
      const filePath = `${applicationId}/${doc.type}/${Date.now()}-${safeFileName}`;

      const { error: uploadError } = await supabase.storage
        .from("dealer-documents")
        .upload(filePath, doc.file, {
          cacheControl: "3600",
          upsert: false
        });

      if (uploadError) {
        console.error(`${doc.type} upload error:`, uploadError);
        continue;
      }

      const { error: documentRecordError } = await supabase.from("dealer_documents").insert([
        {
          application_id: applicationId,
          document_type: doc.type,
          file_path: filePath,
          file_name: doc.file.name,
          uploaded_by: form.email.trim()
        }
      ]);

      if (documentRecordError) {
        console.error(`${doc.type} document record error:`, documentRecordError);
      }
    }
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setSubmitStatus("loading");
    setSubmitMessage("");

    const payload = {
      first_name: form.firstName.trim(),
      last_name: form.lastName.trim(),
      business_name: form.businessName.trim(),
      ffl_number: form.ffl.trim(),
      business_email: form.email.trim(),
      phone_number: form.phone.trim(),
      street_address: form.street.trim(),
      city: form.city.trim(),
      state: form.state.trim(),
      zip_code: form.zip.trim(),
      business_type: form.businessType,
      referral_source: form.referralSource,
      certified_ffl: form.certified,
      status: "new"
    };

    const applicationId = crypto.randomUUID();

    const { error } = await supabase
      .from("dealer_applications")
      .insert([
        {
          id: applicationId,
          ...payload
        }
      ]);

    if (error) {
      console.error("Supabase insert error:", error);
      setSubmitStatus("error");
      setSubmitMessage("Something went wrong. Please check your connection or contact Orion directly.");
      return;
    }

    await uploadDealerDocuments(applicationId);

    const { error: emailError } = await supabase.functions.invoke("send-dealer-confirmation", {
      body: {
        firstName: form.firstName.trim(),
        email: form.email.trim(),
        businessName: form.businessName.trim()
      }
    });

    if (emailError) {
      console.error("Confirmation email error:", emailError);
    }

    setSubmitStatus("success");
    setSubmitMessage("Application submitted successfully. Orion Wholesale will review your dealer request and follow up soon.");
    setForm(initialForm);

    const fileInputs = document.querySelectorAll('input[type="file"]');
    fileInputs.forEach((input) => {
      input.value = "";
    });
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

      <div className="relative z-10 mx-auto max-w-7xl px-5 py-6 sm:px-8 lg:px-10">
        <header className="flex items-center justify-between gap-6">
          <a href="#top" className="inline-flex items-center">
            <img src={logoImage} alt="Orion Wholesale" className="h-14 w-auto object-contain sm:h-16" />
          </a>
          <nav className="hidden items-center gap-9 text-sm font-medium text-white/85 md:flex">
            <a href="#benefits" className="transition hover:text-amber-300">Benefits</a>
            <a href="#custom-shop" className="transition hover:text-amber-300">Custom Shop</a>
            <a href="#how-it-works" className="transition hover:text-amber-300">How It Works</a>
            <a href="#apply" className="rounded-md border border-amber-400 px-5 py-3 font-bold text-amber-300 transition hover:bg-amber-400 hover:text-black">Apply Now</a>
          </nav>
        </header>

        <section id="top" className="grid min-h-[calc(100vh-110px)] items-center gap-10 pb-10 pt-8 lg:grid-cols-[1.08fr_0.92fr] lg:gap-14 lg:pb-12 lg:pt-10">
          <div className="flex flex-col justify-center">
            <p className="mb-5 text-sm font-bold uppercase tracking-[0.18em] text-amber-300">Join the Orion Network</p>
            <h1 className="max-w-2xl text-4xl font-black leading-[0.98] tracking-tight sm:text-6xl lg:text-7xl">
              Become an Orion Wholesale Dealer
            </h1>
            <p className="mt-7 max-w-2xl text-xl leading-8 text-white/85">
              Exclusive pricing, custom solutions, and dedicated support to help qualified dealers grow their business.
            </p>

            <div className="mt-12 grid max-w-2xl gap-7 sm:grid-cols-3">
              {dealerBenefits.map((item) => (
                <div key={item.title} className="group">
                  <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl border border-amber-400/70 text-amber-300 transition group-hover:bg-amber-400 group-hover:text-black">
                    <item.icon className="h-7 w-7" />
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
      </div>
    </main>
  );
}

function ApplicationForm({ form, completion, submitStatus, submitMessage, onChange, onSubmit }) {
  return (
    <form id="apply" onSubmit={onSubmit} className="max-h-[calc(100vh-140px)] overflow-y-auto rounded-xl border border-amber-400/60 bg-black/68 p-6 shadow-2xl shadow-black/50 backdrop-blur-xl sm:p-8">
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h2 className="text-3xl font-black">Dealer Account Application</h2>
          <p className="mt-3 text-white/78">Please complete the form below to apply for an Orion Wholesale dealer account.</p>
        </div>
        <div className="hidden rounded-md border border-white/15 bg-white/5 px-3 py-2 text-center sm:block">
          <p className="text-xl font-black text-amber-300">{completion}%</p>
          <p className="text-[11px] uppercase tracking-wide text-white/50">complete</p>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Input label="First Name" name="firstName" value={form.firstName} onChange={onChange} required />
        <Input label="Last Name" name="lastName" value={form.lastName} onChange={onChange} required />
      </div>
      <Input label="Business Name" name="businessName" value={form.businessName} onChange={onChange} required />
      <Input label="FFL Number" name="ffl" value={form.ffl} onChange={onChange} placeholder="XX-XXX-XX-XX-XXXXX" required />
      <Input label="Business Email" name="email" type="email" value={form.email} onChange={onChange} placeholder="you@business.com" required />
      <Input label="Phone Number" name="phone" type="tel" value={form.phone} onChange={onChange} placeholder="(000) 000-0000" required />
      <Input label="Business Address" name="street" value={form.street} onChange={onChange} placeholder="Street Address" required />

      <div className="grid gap-3 sm:grid-cols-[1fr_0.7fr_0.7fr]">
        <Input hideLabel label="City" name="city" value={form.city} onChange={onChange} placeholder="City" required />
        <Select hideLabel label="State" name="state" value={form.state} onChange={onChange} required>
          <option value="">State</option>
          {[
            "AL", "AK", "AZ", "AR", "CA", "CO", "CT", "DE", "FL", "GA", "HI", "ID", "IL", "IN", "IA", "KS", "KY", "LA", "ME", "MD", "MA", "MI", "MN", "MS", "MO", "MT", "NE", "NV", "NH", "NJ", "NM", "NY", "NC", "ND", "OH", "OK", "OR", "PA", "RI", "SC", "SD", "TN", "TX", "UT", "VT", "VA", "WA", "WV", "WI", "WY"
          ].map((state) => <option key={state}>{state}</option>)}
        </Select>
        <Input hideLabel label="ZIP Code" name="zip" value={form.zip} onChange={onChange} placeholder="ZIP Code" required />
      </div>

      <Select label="Business Type" name="businessType" value={form.businessType} onChange={onChange} required>
        <option value="">Select Business Type</option>
        <option>Retail Gun Shop</option>
        <option>Range or Training Facility</option>
        <option>Online FFL Dealer</option>
        <option>Outdoor / Hunting Retailer</option>
        <option>Law Enforcement Supply</option>
        <option>Other</option>
      </Select>

      <Select label="How did you hear about Orion Wholesale?" name="referralSource" value={form.referralSource} onChange={onChange} required>
        <option value="">Select an option</option>
        <option>Sales Representative</option>
        <option>Referral</option>
        <option>Trade Show</option>
        <option>Search Engine</option>
        <option>Social Media</option>
        <option>Other</option>
      </Select>

      <div className="mt-6 rounded-lg border border-white/10 bg-white/[0.03] p-4">
        <div className="flex items-start gap-3">
          <Upload className="mt-1 h-6 w-6 shrink-0 text-amber-300" />
          <div>
            <h3 className="font-black text-amber-300">Upload Dealer Documents</h3>
            <p className="mt-1 text-sm leading-6 text-white/60">
              Upload your FFL, resale certificate, and driver’s license if available. PDF, JPG, and PNG files are accepted.
            </p>
          </div>
        </div>

        <FileInput label="FFL PDF or Image" name="fflFile" onChange={onChange} />
        <FileInput label="Resale Certificate" name="resaleCertificateFile" onChange={onChange} />
        <FileInput label="Driver’s License" name="driversLicenseFile" onChange={onChange} />
      </div>

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

      {submitMessage && (
        <div className={`mt-5 rounded-md border px-4 py-3 text-sm font-semibold ${submitStatus === "success" ? "border-emerald-400/50 bg-emerald-500/10 text-emerald-200" : "border-red-400/50 bg-red-500/10 text-red-200"}`}>
          {submitMessage}
        </div>
      )}

      <button
        type="submit"
        disabled={submitStatus === "loading"}
        className="mt-5 flex w-full items-center justify-center gap-2 rounded-md bg-gradient-to-r from-amber-300 to-amber-500 px-6 py-4 font-black uppercase tracking-wide text-black shadow-lg shadow-amber-500/20 transition hover:from-amber-200 hover:to-amber-400 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {submitStatus === "loading" ? "Submitting..." : "Submit Application"} <ArrowRight className="h-5 w-5" />
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

function FileInput({ label, name, onChange }) {
  return (
    <label className="mt-4 block">
      <span className="mb-2 block text-sm font-bold text-white">{label}</span>
      <input
        type="file"
        name={name}
        onChange={onChange}
        accept=".pdf,.jpg,.jpeg,.png"
        className="w-full rounded-sm border border-white/14 bg-white/[0.075] px-4 py-3 text-sm text-white file:mr-4 file:rounded file:border-0 file:bg-amber-400 file:px-4 file:py-2 file:font-bold file:text-black"
      />
    </label>
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


