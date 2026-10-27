/** NEXUS Dashboard — Тестийн түүх ба Ахицын тайлан. */
import { icon } from "../../components/icons.js";
import { radarChart, lineChart } from "../../components/charts.js";
import { listTestResults, uploadPending, getPendingUpload, listExerciseProgress } from "../../lib/store.js";
import { SKILLS, SKILL_ORDER } from "../../lib/questions.js";
import { kindTitle, fmtDate } from "./home.js";

/* ================= ТЕСТИЙН ТҮҮХ ================= */
export async function renderHistory(ctx) {
  const { root, banner, toast, mode } = ctx;
  const tests = await listTestResults().catch(() => []);
  const pending = getPendingUpload();
  const canConsent = mode === "cloud" && pending;

  root.innerHTML = `
    ${banner}
    ${canConsent ? `
      <div class="card" style="margin-bottom: 20px; border-color: rgba(129,140,248,0.5);">
        <div class="card-title">${icon("info")} Бүртгэлгүй үеийн үр дүнгээ хадгалах уу?</div>
        <p class="small muted">Та бүртгэл үүсгэхээс өмнө энэ төхөөрөмж дээр тест өгсөн байна.
        Тэр үр дүнг бүртгэлтэйгээ холбохыг хүсвэл «Хадгалах»-ыг дарна уу (зөвхөн таны өгөгдөл).</p>
        <div style="display:flex; gap: 10px; flex-wrap: wrap; margin-top: 10px;">
          <button class="btn btn-primary btn-sm" id="consentYes">Хадгалах →</button>
          <button class="btn btn-ghost btn-sm" id="consentNo">Дараа</button>
        </div>
      </div>` : ""}

    <div class="page-head">
      <div>
        <h1>Тестийн түүх</h1>
        <p>Та өөрөө өгсөн бүх тестийн үр дүн — зөвхөн хэрэглэгчийн хувийн өгөгдөл (RLS).</p>
      </div>
      <a class="btn btn-primary" href="./test.html">Шинэ тест өгөх →</a>
    </div>

    <div id="historyList"></div>`;

  const yes = root.querySelector("#consentYes");
  if (yes) {
    yes.addEventListener("click", async () => {
      try {
        const r = await uploadPending({ confirmConsent: true });
        if (r.uploaded) { toast("Үр дүнг бүртгэлдээ хадгаллаа.", "ok"); ctx.refresh(); }
        else if (r.needLogin) toast("Эхлээд нэвтэрнэ үү.", "err");
        else toast("Хадгалахад асуудал гарлаа.", "err");
      } catch (_) { toast("Хадгалахад асуудал гарлаа (холболт/шигтхээмж).", "err"); }
    });
    root.querySelector("#consentNo").addEventListener("click", () => ctx.go("home"));
  }

  const list = root.querySelector("#historyList");
  if (!tests.length) {
    list.innerHTML = `
      <div class="empty-state">
        <div class="es-icon">${icon("history")}</div>
        <h3>Та хараахан тест өгөөгүй байна</h3>
        <p>15 асуулттай үнэгүй тест өгснөөр энд түүх үүснэ. Бүртгэлгүйгээр ч өгч болно.</p>
        <a class="btn btn-primary" href="./test.html">Тест эхлэх →</a>
      </div>`;
    return;
  }

  list.innerHTML = tests.map((t, i) => `
    <div class="list-row" data-idx="${i}" style="cursor:pointer;">
      <span class="icon-box" style="width:42px;height:42px;">${icon("file")}</span>
      <div class="lr-main">
        <div class="lr-title">${kindTitle(t.kind)}</div>
        <div class="lr-sub">${fmtDate(t.testedAt)}</div>
      </div>
      <span class="lr-score grad-text">${t.overall ?? 0}%</span>
      <span class="go">${icon("chevronRight")}</span>
    </div>`).join("");

  list.querySelectorAll("[data-idx]").forEach((row) =>
    row.addEventListener("click", () => openDetail(tests[+row.dataset.idx]))
  );
}

function openDetail(t) {
  const back = document.createElement("div");
  back.className = "modal-backdrop";
  const skillsHtml = SKILL_ORDER.map((k) => {
    const s = t.skills?.[k];
    const pct = s?.pct ?? 0;
    return `
      <div class="skill-bar" style="margin-bottom: 12px;">
        <div class="sb-top"><span>${SKILLS[k].name}</span><b>${pct}%${s?.raw != null ? ` <span class="muted small">(${s.raw}/${s.max})</span>` : ""}</b></div>
        <div class="track"><i style="width:${pct}%; background: linear-gradient(90deg, ${SKILLS[k].color}, #a855f7);"></i></div>
      </div>`;
  }).join("");
  back.innerHTML = `
    <div class="card modal" style="width: min(520px, 100%); text-align:left;">
      <h3>${kindTitle(t.kind)}</h3>
      <p class="small muted">${fmtDate(t.testedAt)} · нийт <b class="grad-text">${t.overall ?? 0}%</b></p>
      <div style="margin-top: 16px;">${skillsHtml}</div>
      <div class="modal-actions" style="justify-content: flex-end;">
        <button class="btn btn-outline" data-close>Хаах</button>
      </div>
    </div>`;
  document.body.appendChild(back);
  back.querySelector("[data-close]").addEventListener("click", () => back.remove());
  back.addEventListener("click", (e) => { if (e.target === back) back.remove(); });
}

/* ================= АХИЦЫН ТАЙЛАН ================= */
export async function renderProgress(ctx) {
  const { root, banner } = ctx;
  const [tests, exProgress] = await Promise.all([
    listTestResults().catch(() => []),
    listExerciseProgress().catch(() => []),
  ]);

  if (!tests.length) {
    root.innerHTML = `
      ${banner}
      <div class="page-head"><div><h1>Ахицын тайлан</h1>
      <p>Цаг хугацааны хэв, чадвар бүрийн өөрчлөлт.</p></div></div>
      <div class="empty-state">
        <div class="es-icon">${icon("chart")}</div>
        <h3>Та хараахан тест өгөөгүй байна</h3>
        <p>Ахицын тайлангийн голд байх өгөгдөл одоогоор байхгүй байна. Эхний тестээ өгөөд ахицаа бүртгүүлээрэй —
        хоосон график, зохиомол оноо харуулахгүй.</p>
        <a class="btn btn-primary" href="./test.html">Тест эхлэх →</a>
      </div>`;
    return;
  }

  // Эхнээс эцэс рүү эрэмбэлэх (хуучин → шинэ) — графикт
  const chron = [...tests].reverse();
  const labels = chron.map((t) => {
    try { return new Date(t.testedAt).toLocaleDateString("mn-MN", { month: "2-digit", day: "2-digit" }); }
    catch (_) { return ""; }
  });

  const latest = tests[0];
  const best = tests.reduce((a, t) => ((t.overall ?? 0) > (a.overall ?? -1) ? t : a), tests[0]);
  const exDone = exProgress.filter((p) => p.status === "completed").length;

  const overallSeries = [{ name: "Нийт дүн", color: "#7dd3fc", values: chron.map((t, i) => ({ label: labels[i], value: t.overall ?? 0 })) }];
  const skillSeries = SKILL_ORDER.map((k) => ({
    name: SKILLS[k].name,
    color: SKILLS[k].color,
    values: chron.map((t, i) => ({ label: labels[i], value: t.skills?.[k]?.pct ?? 0 })),
  }));

  root.innerHTML = `
    ${banner}
    <div class="page-head">
      <div><h1>Ахицын тайлан</h1><p>Таны өгсөн тестүүдийн дүн болон чадвар бүрийн хандлага.</p></div>
      <a class="btn btn-primary" href="./test.html">Дахин тест өгөх →</a>
    </div>

    <div class="grid-4" style="margin-bottom: 20px;">
      <div class="card mini-stat"><span class="icon-box">${icon("file")}</span><div><div class="v">${tests.length}</div><div class="l">нийт тест</div></div></div>
      <div class="card mini-stat"><span class="icon-box">${icon("trophy")}</span><div><div class="v">${best.overall ?? 0}%</div><div class="l">шилдэг дүн</div></div></div>
      <div class="card mini-stat"><span class="icon-box">${icon("chart")}</span><div><div class="v">${latest.overall ?? 0}%</div><div class="l">сүүлийн дүн</div></div></div>
      <div class="card mini-stat"><span class="icon-box">${icon("target")}</span><div><div class="v">${exDone}</div><div class="l">хийсэн дасгал</div></div></div>
    </div>

    <div class="grid-2" style="margin-bottom: 20px;">
      <div class="card chart-card">
        <h3>Нийт дүнгийн хандлага</h3>
        ${tests.length >= 2
          ? `<div id="overallLine" style="margin-top: 12px;"></div>`
          : `<p class="small muted" style="margin-top: 10px;">График гаргахад дор хаяж 2 тест шаардлагатай (одоо ${tests.length}).</p>`}
      </div>
      <div class="card chart-card">
        <h3>Одоогийн чадварын зураглал</h3>
        <div id="progRadar" style="max-width: 320px; margin: 8px auto;"></div>
      </div>
    </div>

    <div class="card chart-card" style="margin-bottom: 20px;">
      <h3>Чадвар бүрийн хандлага</h3>
      ${tests.length >= 2
        ? `<div id="skillLines" style="margin-top: 12px;"></div>
           <div class="legend">${SKILL_ORDER.map((k) => `<span><i style="background:${SKILLS[k].color}"></i>${SKILLS[k].name}</span>`).join("")}</div>`
        : `<p class="small muted" style="margin-top: 10px;">Дахин нэг тест өгсний дараа чадвар бүрийн хугацааны хэв гарна.</p>`}
    </div>

    <div class="note">${icon("info")}<span>Дүнг «сул тал» биш «цааш хөгжүүлэх боломж» гэж уншина уу. Эхний загварын босго: 0–39% эхний суурь, 40–69% хөгжиж буй, 70–100% сайн эзэмшсэн шинжтэй.</span></div>`;

  radarChart(
    root.querySelector("#progRadar"),
    SKILL_ORDER.map((k) => ({ label: k, pct: latest.skills?.[k]?.pct ?? 0, color: SKILLS[k].color })),
    { size: 330 }
  );
  const ol = root.querySelector("#overallLine");
  if (ol) lineChart(ol, overallSeries, { height: 220 });
  const sl = root.querySelector("#skillLines");
  if (sl) lineChart(sl, skillSeries, { height: 260 });
}
