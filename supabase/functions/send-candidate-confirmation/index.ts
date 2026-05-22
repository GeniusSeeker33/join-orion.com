import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const FROM_ADDRESS = "Orion Careers <onboarding@join-orion.com>";
const STAFF_NOTIFY_TO = "hiring@orionwholesaleonline.com";

function escapeHtml(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

async function sendEmail(apiKey: string, payload: Record<string, unknown>) {
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
  const body = await res.json();
  return { ok: res.ok, status: res.status, body };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const {
      firstName,
      lastName,
      email,
      phone,
      positionTitle,
      coverLetter,
      resumePath,
    } = await req.json();

    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    if (!resendApiKey) throw new Error("Missing RESEND_API_KEY");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(supabaseUrl, serviceKey);

    let resumeUrl: string | null = null;
    if (resumePath) {
      const { data, error } = await admin.storage
        .from("resumes")
        .createSignedUrl(resumePath, 60 * 60 * 24 * 7); // 7-day link
      if (error) {
        console.error("Signed URL error:", error);
      } else {
        resumeUrl = data?.signedUrl ?? null;
      }
    }

    // 1. Confirmation email to candidate
    const confirmation = await sendEmail(resendApiKey, {
      from: FROM_ADDRESS,
      to: [email],
      subject: "We received your Orion Wholesale application",
      html: `
        <h2>Thanks, ${escapeHtml(firstName)}.</h2>
        <p>We received your application for <strong>${escapeHtml(positionTitle)}</strong> at Orion Wholesale.</p>
        <p>Our team will review your background and reach out if there's a strong fit.</p>
        <p>— Orion Wholesale Careers</p>
      `,
    });

    if (!confirmation.ok) {
      console.error("Candidate confirmation send failed:", confirmation.body);
    }

    // 2. Staff notification to hiring inbox
    const coverLetterBlock = coverLetter
      ? `<h3>Cover letter / note</h3><p style="white-space:pre-line">${escapeHtml(coverLetter)}</p>`
      : "";
    const resumeBlock = resumeUrl
      ? `<p><strong>Resume:</strong> <a href="${resumeUrl}">Download (link expires in 7 days)</a></p>`
      : `<p><em>No resume uploaded.</em></p>`;

    const notify = await sendEmail(resendApiKey, {
      from: FROM_ADDRESS,
      to: [STAFF_NOTIFY_TO],
      reply_to: email,
      subject: `New candidate application — ${positionTitle}`,
      html: `
        <h2>New candidate application</h2>
        <p><strong>Position:</strong> ${escapeHtml(positionTitle)}</p>
        <h3>Applicant</h3>
        <p>
          <strong>${escapeHtml(firstName)} ${escapeHtml(lastName)}</strong><br />
          Email: <a href="mailto:${escapeHtml(email)}">${escapeHtml(email)}</a><br />
          Phone: ${escapeHtml(phone)}
        </p>
        ${resumeBlock}
        ${coverLetterBlock}
      `,
    });

    if (!notify.ok) {
      console.error("Staff notify send failed:", notify.body);
    }

    return new Response(
      JSON.stringify({
        success: confirmation.ok && notify.ok,
        confirmationStatus: confirmation.status,
        notifyStatus: notify.status,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (error) {
    console.error("send-candidate-confirmation error:", error);
    return new Response(JSON.stringify({ error: String(error) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
