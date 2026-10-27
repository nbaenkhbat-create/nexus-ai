/**
 * NEXUS — Төслийн тохиргоо (Firebase).
 *
 * ЭНД бичигддэг зүйлс (Firebase Web Config) нь ПУБЛИК таних мэдээлэл —
 * Firebase-ийн `apiKey` нь нууц түлхүүр биш, зөвхөн төслийг таних утга юм.
 * Харин GEMINI API түлхүүр хэзээ ч энд/явцаас кодонд орохгүй —
 * зөвхөн Cloud Functions-ийн Secret (`GEMINI_API_KEY`) дотор хадгалагдана.
 *
 * Firebase Console → Project settings → Your apps → SDK setup and configuration
 * дээрх утгуудаар солино уу.
 */
export const FIREBASE_CONFIG = {
  apiKey: "AIzaSyBvgwNtSxAvyrIXu63Gl7TiUyCAVXlxuLQ",
  authDomain: "perpx-df732.firebaseapp.com",
  projectId: "perpx-df732",
  storageBucket: "perpx-df732.firebasestorage.app",
  messagingSenderId: "90851784593",
  appId: "1:90851784593:web:4516fa24f71b784e14cc30",
};

export const APP_NAME = "NEXUS";

/** Gemini-г дууддаг Cloud Function-ийн байршил */
export const FUNCTIONS_REGION = "us-central1";
export const FUNCTIONS_PROJECT = "perpx-df732";

/**
 * Groq AI прокси (Vercel serverless) — AI чиглүүлэгчийн зам.
 * Деплой хийсний дараа URL-ийг бичнэ:
 *   https://<vercel-project>.vercel.app/api/proxy
 * Хоосон байвал AI хэсэг "ажиллахгүй" тодорхой мэдэгдэл харуулна (бусад функц хэвийн).
 */
export const AI_PROXY_URL = "";

export function isConfigured() {
  return (
    typeof FIREBASE_CONFIG.apiKey === "string" &&
    FIREBASE_CONFIG.apiKey.length > 20 &&
    !FIREBASE_CONFIG.apiKey.startsWith("YOUR_") &&
    typeof FIREBASE_CONFIG.projectId === "string" &&
    FIREBASE_CONFIG.projectId.length > 0
  );
}
