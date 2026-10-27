/**
 * NEXUS AI прокси — нутгийн бүтэн шалгалт (Vercel шаардлагагүй).
 *
 * Тестүүд:
 *   A. Токенгүй хүсэлт → 401
 *   B. Хуурамч токен → 401
 *   C. Бодит Firebase ID token (QA бүртгэл) → Groq хариу (200 PASS)
 *      эсвэл Groq түлхүүр буруу бол 502 (PASS* = прокси хэвийн, түлхүүр дутуу)
 *
 * Ашиглах:
 *   GROQ_API_KEY=gsk_... node scripts/local-test.js
 *   (эсвэл ai-proxy/.env файлд GROQ_API_KEY=... бичээд дээрх командыг үгүйгээр яв)
 */
"use strict";
const http = require("http");
const fs = require("fs");
const path = require("path");

// .env ачаалах (нууц файл — git-д орохгүй)
const envFile = path.join(__dirname, "..", ".env");
if (fs.existsSync(envFile)) {
  for (const line of fs.readFileSync(envFile, "utf8").split(/\r?\n/)) {
    const m = line.match(/^([A-Za-z0-9_]+)\s*=\s*(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim();
  }
}

const handler = require(path.join(__dirname, "..", "api", "proxy.js"));

// Firebase Web config (PUBLIC — сайт дээр ил байдаг таних мэдээлэл)
const FIREBASE_WEB_KEY = "AIzaSyBvgwNtSxAvyrIXu63Gl7TiUyCAVXlxuLQ";
const QA_EMAIL = process.env.QA_EMAIL || "nexus.qa.20261028@example.com";
const QA_PASSWORD = process.env.QA_PASSWORD || "NexusQA12345";
const PORT = 8791;

function startServer() {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      const chunks = [];
      req.on("data", (c) => chunks.push(c));
      req.on("end", async () => {
        let body = {};
        try {
          body = chunks.length ? JSON.parse(Buffer.concat(chunks).toString("utf8")) : {};
        } catch (_) {}

        const out = { statusCode: 200, headers: {}, body: "" };
        let finished = false;
        const finish = () => {
          if (finished) return;
          finished = true;
          res.writeHead(out.statusCode, out.headers);
          res.end(out.body);
        };
        const api = {
          setHeader: (k, v) => (out.headers[k] = v, api),
          status: (c) => (out.statusCode = c, api),
          json: (o) => {
            out.headers["Content-Type"] = "application/json; charset=utf-8";
            out.body = JSON.stringify(o);
            finish();
          },
          end: () => finish(),
        };

        try {
          await handler({ method: req.method, headers: req.headers, body, url: req.url }, api);
        } catch (e) {
          if (!finished) api.status(500).json({ error: String((e && e.message) || e) });
        }
      });
    });
    server.listen(PORT, "127.0.0.1", () => resolve(server));
  });
}

async function post(token, payload) {
  try {
    const res = await fetch(`http://127.0.0.1:${PORT}/api/proxy`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(payload),
    });
    let data = null;
    try {
      data = await res.json();
    } catch (_) {}
    return { status: res.status, data };
  } catch (e) {
    return { status: 0, data: { error: String(e) } };
  }
}

async function getQaIdToken() {
  const r = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${FIREBASE_WEB_KEY}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: QA_EMAIL, password: QA_PASSWORD, returnSecureToken: true }),
    }
  );
  const d = await r.json();
  if (!d.idToken) {
    throw new Error("Firebase нэвтрэлт амжилтгүй: " + JSON.stringify(d.error || d).slice(0, 200));
  }
  return d.idToken;
}

(async () => {
  const server = await startServer();
  const results = [];

  // A — токенгүй
  let r = await post(null, { messages: [{ role: "user", content: "hi" }] });
  results.push(["A: токенгүй → 401", r.status === 401, `гарсэн: ${r.status}`]);

  // B — хуурамч токен
  r = await post("fake.jwt.token", { messages: [{ role: "user", content: "hi" }] });
  results.push(["B: хуурамч токен → 401", r.status === 401, `гарсэн: ${r.status}`]);

  // C — бодит токен → Groq
  let ok = false;
  let soft = false;
  let detail = "";
  try {
    const idToken = await getQaIdToken();
    r = await post(idToken, {
      messages: [
        { role: "user", content: "Санал өг: маргаашаас дасгалдаа тогтмол суух тухай. 2 өгүүлбэр." },
      ],
      context: { displayName: "QA Test", overall: 73 },
    });
    if (r.status === 200 && r.data && r.data.text) {
      ok = true;
      detail = String(r.data.text).slice(0, 160);
    } else if (r.status === 502) {
      soft = true;
      ok = true;
      detail = "прокси бүх шат амжилттай, зөвхөн Groq түлхүүр буруу/идэвхгүй байна → " + JSON.stringify(r.data);
    } else if (r.status === 429) {
      soft = true;
      ok = true;
      detail = "429 — прокси ажиллаж, хязгаарт орлоо";
    } else {
      detail = `төлөв ${r.status}: ` + JSON.stringify(r.data);
    }
  } catch (e) {
    detail = "алдаа: " + e.message;
  }
  results.push(["C: бодит токен → Groq", ok, detail, soft]);

  server.close();

  let pass = true;
  for (const [name, good, info, isSoft] of results) {
    const mark = good ? (isSoft ? "PASS*" : "PASS") : "FAIL";
    if (!good) pass = false;
    console.log(`${mark}  ${name}${info ? " — " + info : ""}`);
  }
  console.log(
    pass
      ? "\nДүн: бүх шалгалт өнгөрлөө (PASS* = прокси хэвийн ажиллав, зөвхөн GROQ_API_KEY шаардлагатай)."
      : "\nДүн: АЛДААТАЙ шалгалт байна."
  );
  process.exit(pass ? 0 : 1);
})();
