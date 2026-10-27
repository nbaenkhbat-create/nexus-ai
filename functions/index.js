/**
 * NEXUS — Gemini Cloud Function (`gemini`, callable).
 *
 * Үүрэг: Google Gemini API-г ЗӨВХӨН энд (server) дуудна.
 *  - GEMINI_API_KEY зөвхөн Functions Secret — frontend рүү гарахгүй.
 *  - Нэвтэрсэн хэрэглэгчийн ID token шалгана.
 *  - Өдрийн хязгаар (AI_DAILY_LIMIT) + ai_usage_logs бичлэг (admin SDK).
 *
 * Тоноглолоо хийх:
 *   cd functions && npm install
 *   npx -y firebase-tools@latest functions:secrets:set GEMINI_API_KEY
 *   (сонголт) npx -y firebase-tools@latest functions:secrets:set GEMINI_MODEL
 * Деплой:
 *   npx -y firebase-tools@latest deploy --only functions
 *
 * Model нэрийг https://ai.google.dev/gemini-api/docs/models дээр шалгана уу.
 */
const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { defineSecret } = require("firebase-functions/params");
const logger = require("firebase-functions/logger");
const admin = require("firebase-admin");

admin.initializeApp();
const GEMINI_KEY = defineSecret("GEMINI_API_KEY");

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

exports.gemini = onCall({ secrets: [GEMINI_KEY], region: "us-central1", cors: true }, async (request) => {
  // 1) Нэвтрэлт шалгах
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Нэвтрэх шаардлагатай.");
  }
  const uid = request.auth.uid;

  const apiKey = GEMINI_KEY.value();
  if (!apiKey) {
    throw new HttpsError("failed-precondition", "GEMINI_API_KEY тохируулаагүй байна.");
  }

  const db = admin.firestore();

  // 2) Өдрийн хязгаарлалт
  const dailyLimit = Number(process.env.AI_DAILY_LIMIT || "30");
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  try {
    const snap = await db
      .collection("ai_usage_logs")
      .where("user_id", "==", uid)
      .where("created_at", ">=", admin.firestore.Timestamp.fromDate(startOfDay))
      .count()
      .get();
    if (snap.data().count >= dailyLimit) {
      throw new HttpsError("resource-exhausted", "Өдрийн AI хэрэглээний хязгаарт хүрлээ.");
    }
  } catch (e) {
    if (e instanceof HttpsError) throw e;
    logger.warn("usage count failed:", e.message); // тооцоо саатвал дуудлагыг зүгээр үргэлжлүүлнэ
  }

  // 3) Биеийг шалгах
  const payload = request.data || {};
  const rawMessages = Array.isArray(payload.messages) ? payload.messages.slice(0, 12) : [];
  const contents = [];
  for (const m of rawMessages) {
    if (!m || typeof m !== "object") continue;
    const role = m.role;
    const content = m.content;
    if ((role === "user" || role === "assistant") && typeof content === "string" && content.trim()) {
      contents.push({
        role: role === "assistant" ? "model" : "user",
        parts: [{ text: content.slice(0, 4000) }],
      });
    }
  }
  if (!contents.length) {
    throw new HttpsError("invalid-argument", "Мессеж шаардлагагүй байна.");
  }

  // Контекст: зөвхөн цэвэрлэсэн тодорхой талбарууд
  let contextLine = "";
  const c = payload.context && typeof payload.context === "object" ? payload.context : {};
  const parts = [];
  if (typeof c.displayName === "string") parts.push(`Нэр: ${c.displayName.slice(0, 60)}`);
  if (typeof c.skills === "string") parts.push(`Сүүлийн чадварын дүн: ${c.skills.slice(0, 300)}`);
  if (typeof c.overall === "number") parts.push(`Нийт дүн: ${c.overall}%`);
  if (typeof c.topic === "string") parts.push(`Сэдэв: ${c.topic.slice(0, 120)}`);
  if (parts.length) contextLine = `\n\nСурагчийн контекст (зөвхөн энэ):\n- ` + parts.join("\n- ");

  // 4) Gemini дуудлага
  const model = process.env.GEMINI_MODEL || "gemini-2.5-flash";
  const maxTokens = Number(process.env.AI_MAX_TOKENS || "900");
  let geminiRes;
  try {
    geminiRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: SYSTEM_PROMPT + contextLine }] },
          contents,
          generationConfig: { temperature: 0.6, topP: 0.9, maxOutputTokens: maxTokens },
        }),
      }
    );
  } catch (e) {
    logger.error("gemini fetch failed:", e.message);
    throw new HttpsError("unavailable", "AI үйлчилгээнд холбогдож чадсангүй.");
  }

  if (!geminiRes.ok) {
    const errText = await geminiRes.text().catch(() => "");
    logger.error(`gemini http ${geminiRes.status}:`, errText.slice(0, 300));
    throw new HttpsError("unavailable", "AI үйлчилгээ алдаа гаргалаа.");
  }

  const data = await geminiRes.json();
  const text = (data?.candidates?.[0]?.content?.parts || [])
    .map((p) => p.text || "")
    .filter(Boolean)
    .join("");
  if (!text) {
    throw new HttpsError("unavailable", "AI хоосон хариу ирлээ.");
  }

  // 5) Хэрэглээ бүртгэх
  try {
    await db.collection("ai_usage_logs").add({
      user_id: uid,
      feature: "guide",
      created_at: admin.firestore.FieldValue.serverTimestamp(),
    });
  } catch (e) {
    logger.warn("usage log failed:", e.message);
  }

  return { text };
});
