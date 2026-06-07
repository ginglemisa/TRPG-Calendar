const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") ?? "";
const RESEND_FROM_EMAIL = Deno.env.get("RESEND_FROM_EMAIL") ?? "";
const ADMIN_NOTIFY_EMAIL = Deno.env.get("ADMIN_NOTIFY_EMAIL") ?? "";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS"
};

type AccountRequestPayload = {
  hostName?: unknown;
  email?: unknown;
  intro?: unknown;
  pageUrl?: unknown;
  website?: unknown;
};

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return jsonResponse({ ok: true }, 200);
  }

  if (request.method !== "POST") {
    return jsonResponse({ ok: false, message: "method_not_allowed" }, 405);
  }

  const missingSecrets = [
    ["RESEND_API_KEY", RESEND_API_KEY],
    ["RESEND_FROM_EMAIL", RESEND_FROM_EMAIL],
    ["ADMIN_NOTIFY_EMAIL", ADMIN_NOTIFY_EMAIL]
  ].filter(([, value]) => !value).map(([name]) => name);

  if (missingSecrets.length) {
    console.error("gm-account-request missing secrets", missingSecrets);
    return jsonResponse({ ok: false, message: "server_not_configured" }, 500);
  }

  let payload: AccountRequestPayload;
  try {
    payload = await request.json();
  } catch {
    return jsonResponse({ ok: false, message: "invalid_json" }, 400);
  }

  const website = cleanText(payload.website, 200);
  if (website) {
    return jsonResponse({ ok: true }, 200);
  }

  const hostName = cleanText(payload.hostName, 40);
  const email = cleanText(payload.email, 120);
  const intro = cleanText(payload.intro, 1200);
  const pageUrl = cleanText(payload.pageUrl, 300);

  if (!hostName || !email || !intro) {
    return jsonResponse({ ok: false, message: "missing_required_fields" }, 400);
  }

  if (!isValidEmail(email)) {
    return jsonResponse({ ok: false, message: "invalid_email" }, 400);
  }

  const submittedAt = new Date().toISOString();
  const subject = `GM帳號申請：${hostName}`;
  const text = [
    "收到一筆 GM 帳號申請。",
    "",
    `主持名稱：${hostName}`,
    `E-mail：${email}`,
    `送出時間：${submittedAt}`,
    pageUrl ? `來源頁面：${pageUrl}` : "",
    "",
    "自我介紹：",
    intro
  ].filter(Boolean).join("\n");
  const html = `
    <h2>收到一筆 GM 帳號申請</h2>
    <p><strong>主持名稱：</strong>${escapeHtml(hostName)}</p>
    <p><strong>E-mail：</strong>${escapeHtml(email)}</p>
    <p><strong>送出時間：</strong>${escapeHtml(submittedAt)}</p>
    ${pageUrl ? `<p><strong>來源頁面：</strong>${escapeHtml(pageUrl)}</p>` : ""}
    <h3>自我介紹</h3>
    <p style="white-space: pre-line;">${escapeHtml(intro)}</p>
  `;

  const resendResponse = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${RESEND_API_KEY}`
    },
    body: JSON.stringify({
      from: RESEND_FROM_EMAIL,
      to: [ADMIN_NOTIFY_EMAIL],
      reply_to: email,
      subject,
      text,
      html
    })
  });

  if (!resendResponse.ok) {
    console.error("gm-account-request email delivery failed", {
      status: resendResponse.status,
      body: await resendResponse.text()
    });
    return jsonResponse({ ok: false, message: "email_delivery_failed" }, 502);
  }

  return jsonResponse({ ok: true }, 200);
});

function cleanText(value: unknown, maxLength: number) {
  const text = typeof value === "string" ? value.trim() : "";
  if (text.length > maxLength) return "";
  return text;
}

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (char) => {
    return {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#039;"
    }[char] ?? char;
  });
}

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...CORS_HEADERS,
      "Content-Type": "application/json"
    }
  });
}
