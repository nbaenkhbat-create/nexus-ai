/**
 * PostHog AI Observability — Gemini дуудлагын трайс ($ai_generation).
 *
 * POSTHOG_API_KEY functions/.env дээр байвал л илгээнэ (түлхүүр байхгүй бол
 * ямар ч үйлдэлгүй, AI-ийн зан төлөв хэвээр үлдэнэ). Гадагш нэг ч бусад
 * мэдээлэл явуулахгүй; payload зөвхөн энэ дуудлагын нэмэлт мэдээлэл.
 *
 * Ашиглах (сонголт):
 *   echo "POSTHOG_API_KEY=phc_..." > functions/.env   # git-д орохгүй (.env.*)
 *   echo "POSTHOG_HOST=https://eu.i.posthog.com" >> functions/.env  # EU байрлал
 */
const logger = require("firebase-functions/logger");

async function trackGeneration(evt) {
  const key = process.env.POSTHOG_API_KEY;
  if (!key) return; // түлхүүр байхгүй → трайс бичихгүй (анхдагч төлөв)

  const host = (process.env.POSTHOG_HOST || "https://us.i.posthog.com").replace(/\/$/, "");
  const props = {
    $ai_provider: "google",
    $ai_model: evt.model || "",
    $ai_trace_id: evt.traceId || "",
    $ai_latency: evt.latency,
    $ai_input: evt.input,
    $ai_is_error: Boolean(evt.error),
    ...(evt.output !== undefined ? { $ai_output: evt.output } : {}),
    ...(evt.usage ? { $ai_usage: evt.usage } : {}),
    ...(evt.httpStatus ? { $ai_http_status: evt.httpStatus } : {}),
    ...(evt.stopReason ? { $ai_stop_reason: evt.stopReason } : {}),
    ...(evt.error ? { $ai_error: String(evt.error).slice(0, 500) } : {}),
  };

  try {
    await fetch(`${host}/e/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        api_key: key,
        event: "$ai_generation",
        distinct_id: evt.uid || "anonymous",
        properties: props,
        timestamp: new Date().toISOString(),
      }),
      signal: AbortSignal.timeout(4000),
    });
  } catch (e) {
    logger.warn("posthog trace failed:", e.message); // трайс саатвал AI хэвээр ажиллана
  }
}

module.exports = { trackGeneration };
