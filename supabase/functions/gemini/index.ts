// ============================================================
// NEXUS — Gemini Edge Function (`gemini`)
//
// Үүрэг: Google Gemini API-г ЗӨВХӨН сервер талаас дуудна.
//   - GEMINI_API_KEY зөвхөн Supabase Secret (энд), frontend рүү гарахгүй.
//   - Хэрэглэгчийн JWT шалгана (нээлттэй холболт хүлээн авахгүй).
//   - Өдрийн хэрэглээний хязгаар (AI_DAILY_LIMIT) + ai_usage_logs бичлэг.
//   - Хувийн мэдээлэл шаардахгүй; зөвхөн ярилцлага + контекст дамжина.
//
// Тоноглолоо хийх:
//   supabase secrets set GEMINI_API_KEY=... GEMINI_MODEL=gemini-2.5-flash
//   (боломжтой model нэрийг https://ai.google.dev/gemini-api/docs/models дээр шалгана уу)
// Деплой: supabase functions deploy gemini
// ============================================================

import { createClient } from "npm:@supabase/supabase-js@2";

const GEMINI_KEY = Deno.env.get("GEMINI_API_KEY") ?? "";
const MODEL = Deno.env.get("GEMINI_MODEL") ?? "gemini-2.5-flash";
const DAILY_LIMIT = Number(Deno.env.get("AI_DAILY_LIMIT") ?? "30");
const MAX_TOKENS = Number(Deno.env.get("AI_MAX_TOKENS") ?? "900");

const SYSTEM_PROMPT = `Та "NEXUS" боловсролын платформын AI чиглүүлэгч мөн.
Зорилго: Монгол сурагчдын (ихэвчлэн дунд/дээд ангийн) сэтгэхүйг хөгжүүлэхэд туслах.

Дүрэм:
1) Монгол хэлээр товч, ойлгомжтой хариулна (500 үг дотор).
2) Шууд хариу биш — асуултаар чиглүүлж, сурагч өөрөө олоход тусална (Сократ арга).
3) Хариулт буруу бол шууд буруу гэж хэлэлгүй, «Яагаад ийм байж болох вэ?» гэж асууна.
4) Эерэг, урамшуулсан хандлага. Хүүхдийг «ухаангүй», «зараад» гэх мэтээр шошголохгүй.
5) Одоогийн үнэлгээ нь «туршилтын урьдчилсан үнэлгээ» гэдгийг шаардлагатай үед дурдана.
6) Хувийн мэдээлэл (овог нэр, регистр, утас, хаяг) асуухгүй, хадгалахгүй, дамжуулахгүй.
7) Эмнэлзүйн/сэтгэлзүйн онош тавихгүй.
8) Дасгал санал болгохдоо дөрвөн чадварын (уншиж ойлгох, асуудал шийдвэрлэх,
   мэдээлэл боловсруулах, бүтээлч сэтгэлгээ) нэрийг барина.`;

const CORS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader) return json({ error: "unauthorized" }, 401);

    // Хэрэглэгчийн JWT-г шалгана (зөвхөн нэвтэрсэн хэрэглэгч ашиглана)
    const db = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userErr } = await db.auth.getUser();
    if (userErr || !userData?.user) return json({ error: "unauthorized" }, 401);
    const user = userData.user;

    if (!GEMINI_KEY) return json({ error: "not_configured" }, 503);

    // ---- Өдрийн хязгаарлалт ----
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const { count, error: countErr } = await db
      .from("ai_usage_logs")
      .select("id", { count: "exact", head: true })
      .gte("created_at", startOfDay.toISOString());
    if (countErr) console.error("usage count error:", countErr.message);
    if ((count ?? 0) >= DAILY_LIMIT) return json({ error: "rate_limited" }, 429);

    // ---- Биеийг баталгаажуулах ----
    let payload: { messages?: unknown; context?: unknown };
    try {
      payload = await req.json();
    } catch (_) {
      return json({ error: "bad_request" }, 400);
    }
    const rawMessages = Array.isArray(payload.messages) ? payload.messages.slice(0, 12) : [];
    const contents: Array<{ role: string; parts: Array<{ text: string }> }> = [];
    for (const m of rawMessages) {
      if (!m || typeof m !== "object") continue;
      const role = (m as Record<string, unknown>).role;
      const content = (m as Record<string, unknown>).content;
      if ((role === "user" || role === "assistant") && typeof content === "string" && content.trim()) {
        contents.push({
          role: role === "assistant" ? "model" : "user",
          parts: [{ text: content.slice(0, 4000) }],
        });
      }
    }
    if (!contents.length) return json({ error: "bad_request" }, 400);

    // Контекст: зөвхөн тусгайлан цэвэрлэсэн тодорхой талбарууд
    let contextLine = "";
    if (payload.context && typeof payload.context === "object") {
      const c = payload.context as Record<string, unknown>;
      const parts: string[] = [];
      if (typeof c.displayName === "string") parts.push(`Нэр: ${c.displayName.slice(0, 60)}`);
      if (typeof c.skills === "string") parts.push(`Сүүлийн чадварын дүн: ${c.skills.slice(0, 300)}`);
      if (typeof c.overall === "number") parts.push(`Нийт дүн: ${c.overall}%`);
      if (typeof c.topic === "string") parts.push(`Сэдэв: ${c.topic.slice(0, 120)}`);
      if (parts.length) contextLine = `\n\nСурагчийн контекст (зөвхөн энэ):\n- ` + parts.join("\n- ");
    }

    // ---- Gemini дуудлага ----
    const geminiRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(MODEL)}:generateContent`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": GEMINI_KEY },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
          contents,
          generationConfig: {
            temperature: 0.6,
            topP: 0.9,
            maxOutputTokens: MAX_TOKENS,
          },
        }),
      },
    );

    if (!geminiRes.ok) {
      // Дэлгэрийг лог луу, хариулт руу гаргахгүй (түлхүүр дамжуулахгүй)
      const errText = await geminiRes.text().catch(() => "");
      console.error(`gemini http ${geminiRes.status}:`, errText.slice(0, 500));
      return json({ error: "unavailable" }, 502);
    }

    const data = await geminiRes.json();
    const text: string =
      data?.candidates?.[0]?.content?.parts
        ?.map((p: { text?: string }) => p.text ?? "")
        .filter(Boolean)
        .join("") ?? "";
    if (!text) return json({ error: "unavailable" }, 502);

    // ---- Хэрэглээ бүртгэх (хэрэглэгчийн токен → RLS өөрөө нэмнэ) ----
    const { error: logErr } = await db.from("ai_usage_logs").insert({ user_id: user.id, feature: "guide" });
    if (logErr) console.error("usage log error:", logErr.message);

    return json({ text });
  } catch (e) {
    console.error("gemini function error:", e instanceof Error ? e.message : String(e));
    return json({ error: "unavailable" }, 502);
  }
});
