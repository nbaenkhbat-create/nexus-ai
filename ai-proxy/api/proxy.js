/**
 * NEXUS — AI прокси (Vercel Serverless Function, Node runtime).
 *
 * Архитектур:
 *  - GROQ_API_KEY зөвхөн энд (сервер env) — frontend рүү ХЭЗЭЭЧ гарахгүй.
 *  - Firebase ID token-ийг Google-ийн tokeninfo endpoint-оор шалгана
 *    (aud / iss / exp) — service account шаардахгүй, нэмэлт хамааралгүй.
 *  - CORS: зөвхөн NEXUS Firebase Hosting origin + локал dev сервер.
 *
 * Деплой (Vercel Hobby — үнэгүй, карт шаардахгүй):
 *   cd ai-proxy
 *   npx vercel login              # нэг удаа (браузер)
 *   npx vercel link               # төсөлтэй холбох
 *   npx vercel env add GROQ_API_KEY   # түлхүүрээ шаардлагатай утгаар оруул
 *   npx vercel --prod             # → https://<project>.vercel.app/api/proxy
 * Дараа нь: уг URL-ийг src/lib/config.js → AI_PROXY_URL дээр бичээд
 * Firebase hosting-ийг дахин деплойлно уу.
 *
 * Нутгийн шалгалт (Vercel шаардлагагүй):
 *   GROQ_API_KEY=gsk_... node scripts/local-test.js
 *
 * Гаралтын төлөв: {text} | 401 unauthenticated | 429 rate_limited |
 * 400 invalid_argument | 502 unavailable | 403 origin_not_allowed
 */
"use strict";

const PROJECT_ID = process.env.FIREBASE_PROJECT_ID || "perpx-df732";
const ALLOWED_ORIGINS = new Set([
  process.env.APP_ORIGIN || "https://perpx-df732.web.app",
  "http://localhost:8090",
  "http://127.0.0.1:8090",
]);
const GROQ_MODEL = process.env.GROQ_MODEL || "llama-3.3-70b-versatile";
const MAX_TOKENS = Number(process.env.AI_MAX_TOKENS || "900");

const SYSTEM_PROMPT = `Та "NEXUS" боловсролын платформын AI чиглүүлэгч мөн.
Зорилго: Монгол сурагчдын (ихэвчлэн дунд/дээд ангийн) сэтгэхүйг хөгжүүлэхэд туслах.

Дүрэм:
1) Монгол хэлээр товч, ойлгомжтой хариулна (500 үг дотор).
2) Шууд хариу биш — асуултаар чиглүүлж, сурагч өөрөө олоход тусална (Сократ арга).
3) Хариулт буруу бол шууд буруу гэж хэлэлгүй, «Яагаад ийм байж болох вэ?» гэж асууна.
4) Эерэг, урамшуулсан хандлага. Хүүхдийг «ухаангүй» гэх мэтээр шошголохгүй.
5) Одоогийн үнэлгээ нь «туршилтын урьдчилсан үнэлгээ» гэдгийг шаардлагатай үед дурдана.
6) Хувийн мэдээлэл (овог нэр, регистр, утас, хаяг) асуухгүй, хадгалахгүй, дамжуулахгүй.
7) Эмнэлзүйн/сэтгэлзүйн онош тавихгүй.
8) Дасгал санал болгохдоо дөрвөн чадварын (уншиж ойлгох, асуудал шийдвэрлэх,
   мэдээлэл боловсруулах, бүтээлч сэтгэлгээ) нэрийг барина.`;

/** Google-ийн нийтэд түгээсэн JWK (securetoken signing key) + RS256 шалгалт */
const JWKS_URL =
  "https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com";
let jwksCache = null;
let jwksFetchedAt = 0;

async function getSigningJwk(kid) {
  if (!jwksCache || Date.now() - jwksFetchedAt > 10 * 60 * 1000) {
    const r = await fetch(JWKS_URL, { signal: AbortSignal.timeout(5000) });
    if (!r.ok) throw new Error("jwks fetch failed: " + r.status);
    const data = await r.json();
    jwksCache = (data && data.keys) || [];
    jwksFetchedAt = Date.now();
  }
  return jwksCache.find((k) => k.kid === kid) || null;
}

/** Firebase ID token-ийг шалгана: гарын үсэг (RS256) + aud + iss + exp */
async function verifyIdToken(token) {
  const parts = String(token || "").split(".");
  if (parts.length !== 3) return null;

  let header;
  let payload;
  try {
    header = JSON.parse(Buffer.from(parts[0], "base64url").toString("utf8"));
    payload = JSON.parse(Buffer.from(parts[1], "base64url").toString("utf8"));
  } catch (_) {
    return null;
  }
  if (!header || header.alg !== "RS256" || !header.kid) return null;

  const jwk = await getSigningJwk(header.kid).catch(() => null);
  if (!jwk) return null;

  const key = await crypto.subtle.importKey(
    "jwk",
    jwk,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["verify"]
  );
  const signedData = new TextEncoder().encode(`${parts[0]}.${parts[1]}`);
  const signature = Buffer.from(parts[2], "base64url");
  const signatureOk = await crypto.subtle.verify(
    { name: "RSASSA-PKCS1-v1_5" },
    key,
    signature,
    signedData
  );
  if (!signatureOk) return null;

  if (payload.aud !== PROJECT_ID) return null;
  if (payload.iss !== `https://securetoken.google.com/${PROJECT_ID}`) return null;
  if (!payload.sub) return null;
  if (Number(payload.exp) * 1000 < Date.now()) return null;
  return { uid: payload.sub, email: payload.email || "" };
}

function sanitizeMessages(raw) {
  const list = Array.isArray(raw) ? raw.slice(0, 12) : [];
  const messages = [];
  for (const m of list) {
    if (!m || typeof m !== "object") continue;
    if ((m.role === "user" || m.role === "assistant") && typeof m.content === "string" && m.content.trim()) {
      messages.push({ role: m.role, content: m.content.slice(0, 4000) });
    }
  }
  return messages;
}

function contextLine(ctx) {
  if (!ctx || typeof ctx !== "object") return "";
  const parts = [];
  if (typeof ctx.displayName === "string") parts.push(`Нэр: ${ctx.displayName.slice(0, 60)}`);
  if (typeof ctx.skills === "string") parts.push(`Сүүлийн чадварын дүн: ${ctx.skills.slice(0, 300)}`);
  if (typeof ctx.overall === "number") parts.push(`Нийт дүн: ${ctx.overall}%`);
  if (typeof ctx.topic === "string") parts.push(`Сэдэв: ${ctx.topic.slice(0, 120)}`);
  if (typeof ctx.exerciseTitle === "string") parts.push(`Дасгал: ${ctx.exerciseTitle.slice(0, 120)}`);
  return parts.length ? `\n\nСурагчийн контекст (зөвхөн энэ):\n- ` + parts.join("\n- ") : "";
}

module.exports = async function handler(req, res) {
  // ---- CORS ----
  const origin = req.headers.origin;
  if (origin) {
    if (!ALLOWED_ORIGINS.has(origin)) {
      return res.status(403).json({ error: "origin_not_allowed" });
    }
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Vary", "Origin");
  }
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") return res.status(405).json({ error: "method_not_allowed" });

  // ---- Нэвтрэлт (Firebase ID token) ----
  const authHeader = req.headers.authorization || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
  if (!token) return res.status(401).json({ error: "unauthenticated" });
  const user = await verifyIdToken(token).catch(() => null);
  if (!user) return res.status(401).json({ error: "unauthenticated" });

  // ---- Серверийн түлхүүр (хэзээ ч хариултанд орохгүй) ----
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    console.error("GROQ_API_KEY тохируулагдаагүй (Vercel env)");
    return res.status(500).json({ error: "server_key_missing" });
  }

  // ---- Биеийг бэлтгэх ----
  const body = req.body || {};
  const chat = sanitizeMessages(body.messages);
  if (!chat.length) return res.status(400).json({ error: "invalid_argument" });

  const messages = [
    { role: "system", content: SYSTEM_PROMPT + contextLine(body.context) },
    ...chat,
  ];

  // ---- Groq дуудлага ----
  let gr;
  try {
    gr = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: GROQ_MODEL,
        messages,
        temperature: 0.6,
        top_p: 0.9,
        max_tokens: MAX_TOKENS,
      }),
      signal: AbortSignal.timeout(45000),
    });
  } catch (e) {
    console.error("groq fetch failed:", e && e.message);
    return res.status(502).json({ error: "unavailable" });
  }

  if (gr.status === 429) return res.status(429).json({ error: "rate_limited" });
  if (!gr.ok) {
    const t = await gr.text().catch(() => "");
    console.error(`groq http ${gr.status}:`, t.slice(0, 200)); // түлхүүр log-д орохгүй
    return res.status(502).json({ error: "unavailable" });
  }

  const data = await gr.json().catch(() => null);
  const text =
    data && data.choices && data.choices[0] && data.choices[0].message
      ? String(data.choices[0].message.content || "").trim()
      : "";
  if (!text) return res.status(502).json({ error: "unavailable" });

  return res.status(200).json({ text });
};
