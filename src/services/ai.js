/**
 * NEXUS — AI чиглүүлэгчийн үйлчилгээ.
 *
 * Архитектур:
 *  - Gemini API-г ЗӨВХӨН Supabase Edge Function (`/functions/v1/gemini`) дамжуулан дуудна.
 *  - API түлхүүр зөвхөн сервер талд (Supabase Secret GEMINI_API_KEY) байна.
 *  - frontend рүү зөвхөн хариулт ирнэ; хувийн мэдээлэл илгээхгүй.
 *  - Алдаа/хязгаар: тодорхой кодуудаар буцаана → хуудас энгийн бэлтгэсэн
 *    зөвлөмжөөр хэвийн ажиллана (тест, дасгал, ахиц нөлөөлөхгүй).
 */
import { configured, getClient } from "./supabase.js";

export const AI_ERRORS = {
  not_configured: "not_configured",
  auth_required: "auth_required",
  rate_limited: "rate_limited",
  unavailable: "unavailable",
};

/** AI ажиллахгүй үед харуулах бэлтгэсэн энгийн зөвлөмжүүд (тохиргоо шаардахгүй). */
export const FALLBACK_TIPS = [
  "Тестийн үр дүнгээ харахдаа хамгийн бага оноотой чадвараа тэмдэглээд, тухайн чадварын дасгалаас эхлээрэй.",
  "Хариултаа бодохдоо «Яагаад ийм байна вэ?» гэж өөрөөсөө асуугаад, шалтгаанаа дуугаар тайлбарлахыг хичээ.",
  "Алдаа гаргавал бүү эвд — алдаанаасаа юу сурсан тохиолдолд чадвар хөгждөг.",
  "Нэг дасгал дууссаны дараа өөрийн хариугаа жишээ хариулттай тулгаж, ялгааг нь тэмдэглэ.",
];

export function aiStatus() {
  if (!configured()) return { available: false, code: AI_ERRORS.not_configured };
  return { available: true };
}

/**
 * AI-д асуулт асуух.
 * @param {{messages: Array<{role:'user'|'assistant', content:string}>, context?: object}} payload
 * @returns {Promise<string>} хариулт текст
 * throws {code: string}
 */
export async function askAI(payload) {
  if (!configured()) throw { code: AI_ERRORS.not_configured };

  const sb = await getClient();
  const { data: sessionData } = await sb.auth.getSession();
  const session = sessionData.session;
  if (!session) throw { code: AI_ERRORS.auth_required };

  // Хувийн мэдээлэл илгээхгүй: зөвхөн шаардлагатай контекст (чадварын хувь, нэр)
  const body = {
    messages: (payload.messages || []).slice(-12),
    context: sanitizeContext(payload.context),
  };

  let res;
  try {
    res = await fetch(`${sb.supabaseUrl}/functions/v1/gemini`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session.access_token}`,
        apikey: sb.supabaseKey,
      },
      body: JSON.stringify(body),
    });
  } catch (_) {
    throw { code: AI_ERRORS.unavailable };
  }

  if (res.status === 429) throw { code: AI_ERRORS.rate_limited };
  if (!res.ok) throw { code: AI_ERRORS.unavailable };

  const data = await res.json().catch(() => null);
  const text = data && (data.text || data.reply);
  if (!text) throw { code: AI_ERRORS.unavailable };
  return text;
}

function sanitizeContext(ctx) {
  if (!ctx || typeof ctx !== "object") return undefined;
  const allowed = {};
  for (const k of ["displayName", "skills", "overall", "exerciseTitle", "topic"]) {
    if (ctx[k] !== undefined) allowed[k] = typeof ctx[k] === "string" ? ctx[k].slice(0, 200) : ctx[k];
  }
  return allowed;
}

export function describeAiError(code) {
  switch (code) {
    case AI_ERRORS.not_configured:
      return "AI чиглүүлэгч ажиллахгүй байна: Supabase тохируулаагүй. Техник тохиргоо хийгдсэний дараа нээгдэнэ.";
    case AI_ERRORS.auth_required:
      return "AI чиглүүлэгч ашиглахын тулд нэвтрэх шаардлагатай.";
    case AI_ERRORS.rate_limited:
      return "Өнөөдрийн AI хэрэглээний хязгаарт хүрлээ. Маргааш дахин оролдоно уу эсвэл одоорой дасгалаа үргэлжлүүлээрэй.";
    default:
      return "AI чиглүүлэгч түр ажиллахгүй байна. Тест, дасгал, ахицын бүх функц хэвийн ажиллаж байна.";
  }
}
