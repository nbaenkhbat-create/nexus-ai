/**
 * NEXUS — AI чиглүүлэгч (Firebase Cloud Function `gemini` дамжуулан Gemini API).
 *
 * Архитектур:
 *  - Зөвхөн Cloud Function (server) Gemini-г дуудна → GEMINI_API_KEY frontend-д үгүй.
 *  - Callable function нь Firebase Auth-ийн ID token-оор хэрэглэгчийг баталгаажуулна.
 *  - Өдрийн хязгаарлалт function талд Firestore-оор тооцогдоно.
 *  - Алдаа/хязгаар: тодорхой кодуудаар буцна → хуудас бэлтгэсэн энгийн зөвлөмжөөр
 *    хэвийн үргэлжилнэ (тест, дасгал, ахиц нөлөөлөхгүй).
 */
import { configured, getFirebase } from "./firebase.js";

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

  const fb = await getFirebase();
  if (!fb || !fb.auth.currentUser) throw { code: AI_ERRORS.auth_required };

  const { httpsCallable } = await import(
    "https://www.gstatic.com/firebasejs/13.1.0/firebase-functions.js"
  );

  const body = {
    messages: (payload.messages || []).slice(-12),
    context: sanitizeContext(payload.context),
  };

  let result;
  try {
    const fn = httpsCallable(fb.fns, "gemini");
    const res = await fn(body);
    result = res.data;
  } catch (e) {
    throw { code: mapFunctionError(e) };
  }

  const text = result && (result.text || result.reply);
  if (!text) throw { code: AI_ERRORS.unavailable };
  return text;
}

function mapFunctionError(e) {
  const code = e?.code || "";
  if (code === "functions/unauthenticated" || code === "unauthenticated")
    return AI_ERRORS.auth_required;
  if (code === "functions/resource-exhausted" || code.includes("rate") || code === "resource-exhausted")
    return AI_ERRORS.rate_limited;
  // function deploy хийгээгүй: functions/not-found
  return AI_ERRORS.unavailable;
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
      return "AI чиглүүлэгч ажиллахгүй байна: Firebase тохируулаагүй. Тохиргоо хийгдсэний дараа нээгдэнэ.";
    case AI_ERRORS.auth_required:
      return "AI чиглүүлэгч ашиглахын тулд нэвтрэх шаардлагатай.";
    case AI_ERRORS.rate_limited:
      return "Өнөөдрийн AI хэрэглээний хязгаарт хүрлээ. Маргааш дахин оролдоно уу эсвэл одоорой дасгалаа үргэлжлүүлээрэй.";
    default:
      return "AI чиглүүлэгч түр ажиллахгүй байна (Cloud Function deploy хийгээгүй эсвэл түлхүүр байхгүй). Тест, дасгал, ахицын бүх функц хэвийн ажиллаж байна.";
  }
}
