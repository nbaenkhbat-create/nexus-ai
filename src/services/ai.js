/**
 * NEXUS — AI чиглүүлэгч (Groq → Vercel прокси /api/proxy).
 *
 * Архитектур:
 *  - GROQ_API_KEY frontend рүү ХЭЗЭЭЧ гарахгүй — зөвхөн прокси серверт байна.
 *  - Firebase ID token-оор прокси дээр баталгаажуулна (прокси Google-оор шалгана).
 *  - Өдрийн/хурдны хязгаарыг Groq free tier (өдөрт ~1000 дуудлага) хянана —
 *    хязгаарт орвол 429 → доорх тодорхой мэдэгдэл гарна.
 *  - Алдаа/хязгаар: тодорхой кодуудаар буцна → хуудас бэлтгэсэн энгийн
 *    зөвлөмжөөр хэвийн үргэлжилнэ (тест, дасгал, ахиц нөлөөлөхгүй).
 */
import { configured, getFirebase } from "./firebase.js";
import { AI_PROXY_URL } from "../lib/config.js";

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
  if (!configured() || !AI_PROXY_URL) return { available: false, code: AI_ERRORS.not_configured };
  return { available: true };
}

/**
 * AI-д асуулт асуух.
 * @param {{messages: Array<{role:'user'|'assistant', content:string}>, context?: object}} payload
 * @returns {Promise<string>} хариулт текст
 * throws {code: string}
 */
export async function askAI(payload) {
  if (!configured() || !AI_PROXY_URL) throw { code: AI_ERRORS.not_configured };

  const fb = await getFirebase();
  if (!fb || !fb.auth.currentUser) throw { code: AI_ERRORS.auth_required };

  let token;
  try {
    token = await fb.auth.currentUser.getIdToken();
  } catch (_) {
    throw { code: AI_ERRORS.auth_required };
  }

  const body = {
    messages: (payload.messages || []).slice(-12),
    context: sanitizeContext(payload.context),
  };

  let res;
  try {
    res = await fetch(AI_PROXY_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(60000),
    });
  } catch (_) {
    throw { code: AI_ERRORS.unavailable }; // интернэт/сүлжээ/хугацаа дуусалт
  }

  if (res.status === 401) throw { code: AI_ERRORS.auth_required };
  if (res.status === 429) throw { code: AI_ERRORS.rate_limited };
  if (!res.ok) throw { code: AI_ERRORS.unavailable };

  let data = null;
  try {
    data = await res.json();
  } catch (_) {
    throw { code: AI_ERRORS.unavailable };
  }

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
      return "AI чиглүүлэгч ажиллахгүй байна: прокси тохируулаагүй (src/lib/config.js → AI_PROXY_URL) эсвэл Firebase тохируулаагүй. Тохиргоо хийгдсэний дараа нээгдэнэ.";
    case AI_ERRORS.auth_required:
      return "AI чиглүүлэгч ашиглахын тулд нэвтрэх шаардлагатай.";
    case AI_ERRORS.rate_limited:
      return "Одоогоор AI-ийн хязгаардалтад хүрлээ (Groq free tier). Түр хүлээгээд дахин оролдоно уу эсвэл одоорой дасгалаа үргэлжлүүлээрэй.";
    default:
      return "AI чиглүүлэгч түр ажиллахгүй байна (прокси түр саатав). Тест, дасгал, ахицын бүх функц хэвийн ажиллаж байна.";
  }
}
