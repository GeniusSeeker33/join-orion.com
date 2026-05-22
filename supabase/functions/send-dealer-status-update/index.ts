const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const FROM_ADDRESS = "Orion Wholesale <onboarding@join-orion.com>";
const REPLY_TO = "hiring@orionwholesaleonline.com";

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

function approvedTemplate(firstName: string, businessName: string): { subject: string; html: string } {
  return {
    subject: "Your Orion Wholesale Dealer Account Has Been Approved",
    html: `
      <h2>Welcome aboard, ${escapeHtml(firstName)}.</h2>
      <p>Great news — your dealer account for <strong>${escapeHtml(businessName)}</strong> has been approved.</p>
      <p>A member of our team will reach out shortly with your dealer pricing, ordering details, and onboarding next steps.</p>
      <p>If you have questions in the meantime, just reply to this email or reach us at <a href="mailto:${REPLY_TO}">${REPLY_TO}</a>.</p>
      <p>— Orion Wholesale</p>
    `,
  };
}

function deniedTemplate(firstName: string, businessName: string): { subject: string; html: string } {
  return {
    subject: "Update on Your Orion Wholesale Dealer Application",
    html: `
      <h2>Hi ${escapeHtml(firstName)},</h2>
      <p>Thank you for your interest in Orion Wholesale. After reviewing your application for <strong>${escapeHtml(businessName)}</strong>, we're unable to approve a dealer account at this time.</p>
      <p>If you'd like to discuss your application or believe this was in error, please reply to this email or reach us at <a href="mailto:${REPLY_TO}">${REPLY_TO}</a>.</p>
      <p>— Orion Wholesale</p>
    `,
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { firstName, businessName, businessEmail, status } = (await req.json()) as {
      firstName?: string;
      businessName?: string;
      businessEmail?: string;
      status?: string;
    };

    if (!businessEmail) throw new Error("Missing businessEmail");
    if (status !== "approved" && status !== "denied") {
      throw new Error(`Unsupported status: ${status}`);
    }

    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    if (!resendApiKey) throw new Error("Missing RESEND_API_KEY");

    const template =
      status === "approved"
        ? approvedTemplate(firstName ?? "there", businessName ?? "your business")
        : deniedTemplate(firstName ?? "there", businessName ?? "your business");

    const result = await sendEmail(resendApiKey, {
      from: FROM_ADDRESS,
      to: [businessEmail],
      reply_to: REPLY_TO,
      subject: template.subject,
      html: template.html,
    });

    if (!result.ok) {
      console.error("Dealer status email send failed:", result.body);
    }

    return new Response(
      JSON.stringify({ success: result.ok, status: result.status }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (error) {
    console.error("send-dealer-status-update error:", error);
    return new Response(JSON.stringify({ error: String(error) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
