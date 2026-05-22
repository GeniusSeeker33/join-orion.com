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
      email,
      businessName,
      phone,
      locationType,
      multipleLocations,
    } = body as {
      firstName: string;
      email: string;
      businessName: string;
      phone?: string;
      locationType?: string;
      multipleLocations?: string;
    };

    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    if (!resendApiKey) throw new Error("Missing RESEND_API_KEY");

    // 1. Confirmation email to applicant
    const confirmation = await sendEmail(resendApiKey, {
      from: FROM_ADDRESS,
      to: [email],
      subject: "Your Orion Wholesale Dealer Application Was Received",
      html: `
        <h2>Thank you, ${escapeHtml(firstName)}.</h2>
        <p>We received your Orion Wholesale dealer application for <strong>${escapeHtml(businessName)}</strong>.</p>
        <p>Our team will review your information and follow up with next steps.</p>
        <p>— Orion Wholesale</p>
      `,
    });

    if (!confirmation.ok) {
      console.error("Dealer confirmation send failed:", confirmation.body);
    }

    // 2. Staff notification
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
          Location type: ${escapeHtml(locationType ?? "—")}<br />
          Multiple locations: ${escapeHtml(multipleLocations ?? "—")}
        </p>
        <h3>Contact</h3>
        <p>
          ${escapeHtml(firstName)}<br />
          Email: <a href="mailto:${escapeHtml(email)}">${escapeHtml(email)}</a><br />
          Phone: ${escapeHtml(phone ?? "—")}
        </p>
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
