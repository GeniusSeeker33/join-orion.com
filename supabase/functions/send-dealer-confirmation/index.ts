import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const FROM_ADDRESS = "Orion Wholesale <onboarding@join-orion.com>";
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
    const body = await req.json();
    const {
      firstName,
      lastName,
      email,
      businessName,
      phone,
      ffl,
      street,
      city,
      state,
      zip,
      businessType,
      documents,
    } = body as {
      firstName: string;
      lastName?: string;
      email: string;
      businessName: string;
      phone?: string;
      ffl?: string;
      street?: string;
      city?: string;
      state?: string;
      zip?: string;
      businessType?: string;
      documents?: { type: string; path: string }[];
    };

    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    if (!resendApiKey) throw new Error("Missing RESEND_API_KEY");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(supabaseUrl, serviceKey);

    // Build signed URLs for any documents passed in
    const docLinks: { type: string; url: string }[] = [];
    for (const doc of documents ?? []) {
      if (!doc?.path) continue;
      const { data, error } = await admin.storage
        .from("dealer-documents")
        .createSignedUrl(doc.path, 60 * 60 * 24 * 7);
      if (error) {
        console.error(`Signed URL error for ${doc.type}:`, error);
        continue;
      }
      if (data?.signedUrl) {
        docLinks.push({ type: doc.type, url: data.signedUrl });
      }
    }

    // 1. Confirmation email to applicant
    const confirmation = await sendEmail(resendApiKey, {
      from: FROM_ADDRESS,
      to: [email],
      subject: "Your Orion Wholesale Dealer Application Was Received",
      html: `
        <h2>Thank you, ${escapeHtml(firstName)}.</h2>
        <p>We received your Orion Wholesale dealer application for <strong>${escapeHtml(businessName)}</strong>.</p>
        <p>Our team will review your FFL information and follow up with next steps.</p>
        <p>— Orion Wholesale</p>
      `,
    });

    if (!confirmation.ok) {
      console.error("Dealer confirmation send failed:", confirmation.body);
    }

    // 2. Staff notification
    const docListHtml = docLinks.length
      ? `<ul>${docLinks
          .map(
            (d) =>
              `<li><strong>${escapeHtml(d.type)}</strong>: <a href="${d.url}">Download (expires in 7 days)</a></li>`,
          )
          .join("")}</ul>`
      : "<p><em>No documents uploaded.</em></p>";

    const addressLine = [street, city, state, zip].filter(Boolean).join(", ");

    const notify = await sendEmail(resendApiKey, {
      from: FROM_ADDRESS,
      to: [STAFF_NOTIFY_TO],
      reply_to: email,
      subject: `New dealer application — ${businessName}`,
      html: `
        <h2>New dealer application</h2>
        <h3>Business</h3>
        <p>
          <strong>${escapeHtml(businessName)}</strong><br />
          ${escapeHtml(businessType ?? "")}${businessType ? "<br />" : ""}
          FFL: ${escapeHtml(ffl ?? "—")}<br />
          ${addressLine ? escapeHtml(addressLine) : ""}
        </p>
        <h3>Contact</h3>
        <p>
          ${escapeHtml(firstName)} ${escapeHtml(lastName ?? "")}<br />
          Email: <a href="mailto:${escapeHtml(email)}">${escapeHtml(email)}</a><br />
          Phone: ${escapeHtml(phone ?? "—")}
        </p>
        <h3>Documents</h3>
        ${docListHtml}
      `,
    });

    if (!notify.ok) {
      console.error("Dealer staff notify send failed:", notify.body);
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
    console.error("send-dealer-confirmation error:", error);
    return new Response(JSON.stringify({ error: String(error) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
