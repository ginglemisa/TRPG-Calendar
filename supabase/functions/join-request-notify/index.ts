import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") ?? "";
const RESEND_FROM_EMAIL = Deno.env.get("RESEND_FROM_EMAIL") ?? "";
const ADMIN_NOTIFY_EMAIL = Deno.env.get("ADMIN_NOTIFY_EMAIL") ?? "";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const { key: SUPABASE_SECRET_KEY, source: SUPABASE_SECRET_KEY_SOURCE } = getSupabaseSecretKey();

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS"
};

function getSupabaseSecretKey() {
  const secretKeysJson = Deno.env.get("SUPABASE_SECRET_KEYS") ?? "";

  if (!secretKeysJson) {
    console.warn("[join-request-notify] SUPABASE_SECRET_KEYS is not configured; falling back to SUPABASE_SERVICE_ROLE_KEY");
  } else {
    try {
      const secretKeys = JSON.parse(secretKeysJson) as Record<string, unknown>;
      const defaultSecretKey = secretKeys.default;
      if (typeof defaultSecretKey === "string" && defaultSecretKey.trim()) {
        return {
          key: defaultSecretKey,
          source: "SUPABASE_SECRET_KEYS.default"
        };
      }

      console.warn("[join-request-notify] SUPABASE_SECRET_KEYS.default is missing or invalid; falling back to SUPABASE_SERVICE_ROLE_KEY");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown JSON parse error";
      console.error("[join-request-notify] SUPABASE_SECRET_KEYS JSON parse failed; falling back to SUPABASE_SERVICE_ROLE_KEY", {
        message
      });
    }
  }

  return {
    key: Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    source: "SUPABASE_SERVICE_ROLE_KEY"
  };
}

type NotifyPayload = {
  requestId?: unknown;
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
    ["ADMIN_NOTIFY_EMAIL", ADMIN_NOTIFY_EMAIL],
    ["SUPABASE_URL", SUPABASE_URL],
    ["SUPABASE_SECRET_KEYS.default or SUPABASE_SERVICE_ROLE_KEY", SUPABASE_SECRET_KEY]
  ].filter(([, value]) => !value).map(([name]) => name);

  if (missingSecrets.length) {
    console.error("join-request-notify missing secrets", missingSecrets);
    return jsonResponse({ ok: false, message: "server_not_configured" }, 500);
  }

  let payload: NotifyPayload;
  try {
    payload = await request.json();
  } catch {
    return jsonResponse({ ok: false, message: "invalid_json" }, 400);
  }

  const requestId = typeof payload.requestId === "string" ? payload.requestId.trim() : "";
  if (!isUuid(requestId)) {
    return jsonResponse({ ok: false, message: "request_not_found" }, 400);
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SECRET_KEY, {
    auth: { persistSession: false }
  });

  console.log("[join-request-notify] admin key selected", {
    source: SUPABASE_SECRET_KEY_SOURCE
  });

  const { data: appSettings, error: settingsError } = await supabase
    .from("app_settings")
    .select("notify_join_requests")
    .eq("id", "global")
    .maybeSingle();

  if (settingsError) {
    console.error("[join-request-notify] admin key verification failed", {
      source: SUPABASE_SECRET_KEY_SOURCE,
      message: settingsError.message
    });
    console.error("join-request-notify settings lookup failed", settingsError);
    return jsonResponse({ ok: false, message: "notification_settings_unavailable" }, 500);
  }

  console.log("[join-request-notify] admin key verification succeeded", {
    source: SUPABASE_SECRET_KEY_SOURCE
  });

  if (appSettings?.notify_join_requests !== true) {
    return jsonResponse({ ok: true, skipped: true }, 200);
  }

  const { data: joinRequest, error } = await supabase
    .from("join_requests")
    .select(`
      id,
      applicant_name,
      contact_info,
      players_count,
      note,
      time_label,
      created_at,
      events (
        title,
        host_name,
        system_name,
        scenario_name,
        event_date,
        start_time,
        end_time,
        location_name
      )
    `)
    .eq("id", requestId)
    .maybeSingle();

  if (error) {
    console.error("join-request-notify request lookup failed", error);
    return jsonResponse({ ok: false, message: "request_not_found" }, 500);
  }

  if (!joinRequest) {
    return jsonResponse({ ok: false, message: "request_not_found" }, 404);
  }

  const eventInfo = Array.isArray(joinRequest.events) ? joinRequest.events[0] : joinRequest.events;
  const eventTitle = eventInfo?.title || "未命名團務";
  const eventWhen = formatEventWhen(eventInfo);
  const submittedAt = joinRequest.time_label || joinRequest.created_at || new Date().toISOString();
  const subject = `新的加團申請：${eventTitle}`;
  const text = [
    "收到一筆新的加團申請。",
    "",
    `團務：${eventTitle}`,
    eventWhen ? `時間：${eventWhen}` : "",
    eventInfo?.location_name ? `地點：${eventInfo.location_name}` : "",
    eventInfo?.host_name ? `主持人：${eventInfo.host_name}` : "",
    eventInfo?.system_name ? `系統：${eventInfo.system_name}` : "",
    eventInfo?.scenario_name ? `劇本：${eventInfo.scenario_name}` : "",
    "",
    `申請人：${joinRequest.applicant_name}`,
    `聯絡方式：${joinRequest.contact_info}`,
    `人數：${joinRequest.players_count}`,
    `提出時間：${submittedAt}`,
    "",
    "備註：",
    joinRequest.note || "無"
  ].filter(Boolean).join("\n");
  const html = `
    <h2>新的加團申請</h2>
    <h3>${escapeHtml(eventTitle)}</h3>
    <p><strong>時間：</strong>${escapeHtml(eventWhen || "未提供")}</p>
    <p><strong>地點：</strong>${escapeHtml(eventInfo?.location_name || "未提供")}</p>
    <p><strong>主持人：</strong>${escapeHtml(eventInfo?.host_name || "未提供")}</p>
    <p><strong>系統：</strong>${escapeHtml(eventInfo?.system_name || "未提供")}</p>
    ${eventInfo?.scenario_name ? `<p><strong>劇本：</strong>${escapeHtml(eventInfo.scenario_name)}</p>` : ""}
    <hr>
    <p><strong>申請人：</strong>${escapeHtml(joinRequest.applicant_name)}</p>
    <p><strong>聯絡方式：</strong>${escapeHtml(joinRequest.contact_info)}</p>
    <p><strong>人數：</strong>${Number(joinRequest.players_count || 1)}</p>
    <p><strong>提出時間：</strong>${escapeHtml(submittedAt)}</p>
    <h3>備註</h3>
    <p style="white-space: pre-line;">${escapeHtml(joinRequest.note || "無")}</p>
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
      subject,
      text,
      html
    })
  });

  if (!resendResponse.ok) {
    console.error("join-request-notify email delivery failed", {
      status: resendResponse.status,
      body: await resendResponse.text()
    });
    return jsonResponse({ ok: false, message: "email_delivery_failed" }, 502);
  }

  return jsonResponse({ ok: true }, 200);
});

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function formatEventWhen(eventInfo: Record<string, unknown> | null | undefined) {
  if (!eventInfo) return "";
  const date = typeof eventInfo.event_date === "string" ? eventInfo.event_date : "";
  const start = formatTime(eventInfo.start_time);
  const end = formatTime(eventInfo.end_time);
  const time = [start, end].filter(Boolean).join(" - ");
  return [date, time].filter(Boolean).join(" ");
}

function formatTime(value: unknown) {
  return typeof value === "string" && value ? value.slice(0, 5) : "";
}

function escapeHtml(value: string) {
  return String(value).replace(/[&<>"']/g, (char) => {
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
