/**
 * NEXUS — Тестийн хөдөлгүүр (15 асуулт).
 * - Нэг асуулт нэг дор, progress bar, дугаар, сонголт
 * - Өмнөх/Дараагийн, сонгосон хариулт хадгалагдана
 * - Хоосон хариултын шалгалт, дуусгах баталгаажуулалт, дахин эхлүүлэх
 * - SessionStorage: refresh дээр сэргээнэ
 * - Оноо: scoring.js-ийн тодорхой дүрмээр (AI биш)
 */
import { getBank, SKILLS, SKILL_ORDER } from "../lib/questions.js";
import { scoreTest } from "../lib/scoring.js";
import { saveTestResult, currentSession, localSaveTest, setPendingUpload } from "../lib/store.js";
import { radarChart, donutChart } from "../components/charts.js";
import { icon } from "../components/icons.js";

const params = new URLSearchParams(location.search);
const bank = getBank(params.get("bank") || "quick");
const STATE_KEY = `nexus_test_${bank.id}_v1`;

const $ = (id) => document.getElementById(id);
const views = { start: $("startView"), test: $("testView"), result: $("resultView") };

let state = loadState();

function loadState() {
  try {
    const raw = sessionStorage.getItem(STATE_KEY);
    if (raw) {
      const s = JSON.parse(raw);
      if (s && typeof s.idx === "number") return s;
    }
  } catch (_) {}
  return { idx: 0, answers: {}, finished: false };
}
function persist() {
  try { sessionStorage.setItem(STATE_KEY, JSON.stringify(state)); } catch (_) {}
}
function resetState() {
  state = { idx: 0, answers: {}, finished: false };
  try { sessionStorage.removeItem(STATE_KEY); } catch (_) {}
}

function show(name) {
  Object.entries(views).forEach(([k, v]) => v.classList.toggle("hidden", k !== name));
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function toast(msg, kind = "") {
  const wrap = $("toasts");
  const t = document.createElement("div");
  t.className = "toast " + kind;
  t.textContent = msg;
  wrap.appendChild(t);
  setTimeout(() => t.remove(), 4200);
}

function confirmModal({ title, text, okText = "Тийм", cancelText = "Болих", danger = false }) {
  return new Promise((resolve) => {
    const back = document.createElement("div");
    back.className = "modal-backdrop";
    back.innerHTML = `
      <div class="card modal">
        <h3>${title}</h3>
        <p class="muted">${text}</p>
        <div class="modal-actions">
          <button class="btn btn-outline" data-cancel>${cancelText}</button>
          <button class="btn ${danger ? "btn-danger" : "btn-primary"}" data-ok>${okText}</button>
        </div>
      </div>`;
    document.body.appendChild(back);
    const done = (v) => { back.remove(); resolve(v); };
    back.querySelector("[data-ok]").addEventListener("click", () => done(true));
    back.querySelector("[data-cancel]").addEventListener("click", () => done(false));
    back.addEventListener("click", (e) => { if (e.target === back) done(false); });
  });
}

/* ---------------- Эхлэл ---------------- */
async function renderStart() {
  const qs = bank.questions;
  if (!qs || qs.length === 0) {
    // Дэлгэрэнгүй тестийн материал бэлэн болоогүй — шуд мэдэгдэл
    $("bankBadge").textContent = "ДЭЛГЭРЭНГҮЙ ТЕСТ";
    $("introTitle").textContent = bank.title;
    $("introSubtitle").textContent = bank.subtitle;
    $("introGoal").textContent = bank.goal;
    $("introMeta").innerHTML = "";
    $("introInstructions").innerHTML = bank.instructions.map((i) => `<li>${i}</li>`).join("");
    $("startExtra").innerHTML = `
      <div class="note warn" style="margin-top: 6px;">
        ${icon("alert")}
        <span>
          <b>Дэлгэрэнгүй тестийн асуултын сан одоогоор бэлэн болоогүй байна.</b><br/>
          40 асуултыг дур мэдэн зохиож, албан ёсны үнэлгээ мэт харуулахгүйн тулд
          санг агуулга бэлэн болтол нь хаалттай байлгаж байна.
          Асуултын санг <code>src/lib/questions.js</code> файлын <code>DETAILED_BANK</code>
          жагсаалтад нэмнэ үү.
        </span>
      </div>`;
    $("startBtn").textContent = "15 асуулттай тест руу очих →";
    $("startBtn").onclick = () => (location.href = "./test.html");
    show("start");
    return;
  }

  $("introTitle").textContent = bank.title;
  $("introSubtitle").textContent = bank.subtitle;
  $("introGoal").textContent = bank.goal;
  $("introInstructions").innerHTML = (bank.instructions || []).map((i) => `<li>${i}</li>`).join("");

  const minutes = bank.kind === "quick" ? "10–15 мин" : "20–40 мин";
  $("introMeta").innerHTML = `
    <span class="chip">${icon("list")} ${qs.length} асуулт</span>
    <span class="chip">${icon("layers")} 4 чадвар</span>
    <span class="chip">${icon("clock")} ${minutes}</span>
    <span class="chip">${icon("shield")} Бүртгэл шаардахгүй</span>`;

  // үргэлжлүүлэх боломж
  const answered = Object.keys(state.answers).length;
  if (answered > 0 && !state.finished) {
    $("startExtra").innerHTML = `
      <div class="note">
        ${icon("info")}
        <span>Танд <b>${answered}</b> асуултад хариулсан явц байна. Үргэлжлүүлэх үү?</span>
      </div>`;
    $("startBtn").textContent = "Үргэлжлүүлэх →";
  } else {
    $("startExtra").innerHTML = "";
    $("startBtn").textContent = "Тест эхлэх →";
  }

  $("startBtn").onclick = () => {
    if (state.finished) resetState();
    show("test");
    renderQuestion();
  };
  show("start");
}

/* ---------------- Асуулт ---------------- */
function currentQ() { return bank.questions[state.idx]; }

function renderQuestion() {
  const q = currentQ();
  const total = bank.questions.length;
  $("qCount").textContent = `Асуулт ${state.idx + 1} / ${total}`;
  $("qProgress").style.width = `${(state.idx / total) * 100}%`;

  const sk = SKILLS[q.skill];
  const skillEl = $("qSkill");
  skillEl.textContent = sk ? sk.name : q.skill;
  skillEl.className = "badge q-skill";

  const passage = $("qPassage");
  if (q.passage) { passage.textContent = q.passage; passage.classList.remove("hidden"); }
  else passage.classList.add("hidden");

  $("qText").textContent = `${state.idx + 1}. ${q.text}`;
  $("qWarn").classList.remove("show");

  const opts = $("qOptions");
  const ta = $("qTextAnswer");
  opts.innerHTML = "";

  if (q.type === "mc") {
    ta.classList.add("hidden");
    opts.classList.remove("hidden");
    opts.innerHTML = q.options
      .map(
        (o) => `
      <button class="option ${state.answers[q.id] === o.k ? "selected" : ""}" data-key="${o.k}" type="button">
        <span class="key">${o.k}</span><span>${o.t}</span>
      </button>`
      )
      .join("");
    opts.querySelectorAll(".option").forEach((btn) => {
      btn.addEventListener("click", () => {
        state.answers[q.id] = btn.dataset.key;
        persist();
        opts.querySelectorAll(".option").forEach((b) => b.classList.toggle("selected", b === btn));
        // жижиг завсарлагаар дараагийн руу шилжнэ
        setTimeout(() => { state.idx < total - 1 ? next() : askFinish(); }, 320);
      });
    });
  } else {
    opts.classList.add("hidden");
    ta.classList.remove("hidden");
    ta.placeholder = q.placeholder || "Хариултаа бичнэ үү...";
    ta.value = state.answers[q.id] || "";
    ta.oninput = () => { state.answers[q.id] = ta.value; persist(); };
  }

  $("prevBtn").disabled = state.idx === 0;
  $("nextBtn").textContent = state.idx === total - 1 ? "Тестийг дуусгах ✓" : "Дараагийн →";
  show("test");
}

function warn(msg) {
  const w = $("qWarn");
  w.textContent = msg;
  w.classList.add("show");
}

function next() {
  const q = currentQ();
  const a = state.answers[q.id];
  if (q.type === "mc" && !a) { warn("Хариултаа сонгоно уу."); return; }
  if (q.type === "text" && !(a || "").trim()) { warn("Хоосон хариулт байж болохгүй — санаагаа бичнэ үү."); return; }
  if (state.idx === bank.questions.length - 1) { askFinish(); return; }
  state.idx += 1;
  persist();
  renderQuestion();
}

function prev() {
  if (state.idx === 0) return;
  state.idx -= 1;
  persist();
  renderQuestion();
}

async function askFinish() {
  const answered = bank.questions.filter((q) => (state.answers[q.id] || "").toString().trim()).length;
  const empty = bank.questions.length - answered;
  const ok = await confirmModal({
    title: "Тестээ дуусгах уу?",
    text:
      empty > 0
        ? `Асуулт: ${bank.questions.length}. Одоогоор <b>${answered}</b> хариулт бичсэн, <b>${empty}</b> асуулт хоосон байна. Хоосон асуултад 0 оноо тооцогдоно.`
        : `Бүх ${bank.questions.length} асуултад хариуллаа. Үр дүнгээ шууд харна уу.`,
    okText: "Дуусгаж үр дүн харах",
    cancelText: "Буцах засах",
  });
  if (!ok) return;
  finish();
}

async function finish() {
  const result = scoreTest(bank.questions, state.answers);
  result.kind = bank.id;
  state.finished = true;
  persist();

  // Хадгалах: нэвтэрсэн → cloud, үгүй → локал (+ бүртгэлтэй холбох хүлээс)
  let saveNote;
  try {
    const session = await currentSession();
    await saveTestResult(result);
    saveNote = session
      ? "Үр дүн таны бүртгэлд хадгалагдлаа — «Тестийн түүх»-ээс харна уу."
      : "Үр дүн энэ төхөөрөмж дээр хадгалагдлаа. Бүртгэл үүсгэвэл дэлгэрэнгүй тайлан нээгдэнэ.";
  } catch (e) {
    saveNote = "Үр дүнг бүртгэлд хадгалахад асуудал гарлаа (холболт/эрх). Энэ хуудсан дээр үр дүн харагдана.";
    try { localSaveTest(result); setPendingUpload(result); } catch (_) {}
  }

  renderResults(result, saveNote);
}

/* ---------------- Үр дүн ---------------- */
function renderResults(result, saveNote) {
  const view = views.result;
  const lowest = SKILL_ORDER.slice().sort((a, b) => result.skills[a].pct - result.skills[b].pct)[0];
  const session = currentSessionCached;

  view.innerHTML = `
    <div class="card result-hero">
      <span class="badge warn">ТУРШИЛТЫН ҮНЭЛГЭЭ</span>
      <div class="donut-wrap">
        <div id="donut"></div>
        <div class="donut-center">
          <span class="val grad-text">${result.overall}%</span>
          <span class="lbl">нийт дүн</span>
        </div>
      </div>
      <h2 style="font-size: 1.35rem;">${result.overallLevel.name}</h2>
      <p class="muted" style="max-width: 560px; margin: 0 auto;">
        Дөрвөн суурь чадварын эхний баримжаа. Энэ нь туршилтын урьдчилсан үнэлгээ бөгөөд
        эмнэлзүйн эсвэл сэтгэлзүйн онош биш юм.
      </p>
      <div class="chip-row" style="justify-content: center; margin-top: 14px;">
        <span class="chip">${icon("checkCircle")} Нийт ${result.rawTotal} / ${result.maxTotal} оноо</span>
        <span class="chip">${icon("clock")} ${new Date(result.testedAt).toLocaleString("mn-MN")}</span>
      </div>
    </div>

    <div class="results-grid">
      <div class="card chart-card">
        <h3>Дөрвөн чадварын график</h3>
        <div id="radar" style="max-width: 360px; margin: 10px auto;"></div>
      </div>
      <div class="card chart-card">
        <h3>Чадвар тус бүрийн үр дүн</h3>
        <div class="skill-bars" id="bars" style="margin-top: 16px;"></div>
        <div class="note" style="margin-top: 18px;">
          ${icon("info")}
          <span>13–15-р асуултын бичсэн хариулт рубрикийн дагуу автомат урьдчилж үнэлэгдлээ
          (0–2 оноо). Дэлгэрэнгүй ярилцахыг хүсвэл AI чиглүүлэгч ашиглана уу.</span>
        </div>
      </div>
    </div>

    <div class="card" style="margin-bottom: 22px;">
      <div class="card-title">${icon("message")} Тайлбар болон зөвлөмж</div>
      <div class="result-explain" id="explain"></div>
    </div>

    <div class="card cta-band" style="margin-bottom: 22px;">
      <div class="cb-text">
        <span class="badge pink">ДАРААГИЙН АЛХАМ</span>
        <h3 style="margin-top: 10px;">Өөрийн ахицаа хадгалж, илүү дэлгэрэнгүй дасгал ашиглахыг хүсвэл бүртгүүлээрэй.</h3>
        <p>${saveNote || ""}</p>
      </div>
      <div style="display: flex; gap: 12px; flex-wrap: wrap;">
        ${
          session
            ? `<a class="btn btn-primary btn-lg" href="./app.html">Миний dashboard →</a>`
            : `<a class="btn btn-primary btn-lg" href="./signup.html">Бүртгүүлэх →</a>
               <a class="btn btn-outline btn-lg" href="./login.html">Нэвтрэх</a>`
        }
      </div>
    </div>

    <div style="display: flex; gap: 12px; justify-content: center; flex-wrap: wrap; padding-bottom: 30px;">
      <button class="btn btn-outline" id="againBtn">${icon("refresh")} Тестийг дахин эхлүүлэх</button>
      <a class="btn btn-ghost" href="./index.html">Нүүр хуудас</a>
    </div>`;

  donutChart(view.querySelector("#donut"), result.overall, { size: 190, stroke: 14 });
  radarChart(
    view.querySelector("#radar"),
    SKILL_ORDER.map((k) => ({ label: k, pct: result.skills[k].pct, color: SKILLS[k].color })),
    { size: 340 }
  );

  view.querySelector("#bars").innerHTML = SKILL_ORDER.map((k) => {
    const s = result.skills[k];
    return `
      <div class="skill-bar">
        <div class="sb-top"><span>${SKILLS[k].name}</span><b>${s.pct}% <span class="muted small">(${s.raw}/${s.max})</span></b></div>
        <div class="track"><i style="width: 0%; background: linear-gradient(90deg, ${SKILLS[k].color}, #a855f7);" data-w="${s.pct}"></i></div>
      </div>`;
  }).join("");
  requestAnimationFrame(() => {
    view.querySelectorAll(".track > i").forEach((i) => (i.style.width = i.dataset.w + "%"));
  });

  view.querySelector("#explain").innerHTML = SKILL_ORDER.map((k) => {
    const s = result.skills[k];
    const isLow = k === lowest;
    return `
      <div class="ex-item">
        <span class="icon-box" style="width:40px;height:40px;">${icon(SKILLS[k].icon)}</span>
        <div>
          <div class="lvl">${SKILLS[k].name} — ${s.pct}% <span class="muted small">(${s.raw}/${s.max})</span></div>
          <p><b style="color:#cbd5f7;">${s.level}.</b> Зөвлөмж: ${s.tip}.${isLow ? " Энэ чадвар дээрээ эхлээд анхаарна уу." : ""}</p>
        </div>
      </div>`;
  }).join("");

  view.querySelector("#againBtn").addEventListener("click", async () => {
    const ok = await confirmModal({
      title: "Тестийг дахин эхлэх үү?",
      text: "Одоогийн хариултууд устаж, эхнээсээ шинээр эхлэнэ.",
      okText: "Тийм, эхлэх",
      danger: true,
    });
    if (ok) { resetState(); renderStart(); }
  });

  show("result");
  window.scrollTo({ top: 0, behavior: "smooth" });
}

/* ---------------- Эхлүүлэх ---------------- */
let currentSessionCached = null;
currentSession().then((s) => { currentSessionCached = s; }).catch(() => {});

$("nextBtn").addEventListener("click", next);
$("prevBtn").addEventListener("click", prev);
$("restartBtn").addEventListener("click", async () => {
  const ok = await confirmModal({
    title: "Тестийг дахин эхлэх үү?",
    text: "Одоогийн хариултууд устна.",
    okText: "Тийм",
    danger: true,
  });
  if (ok) { resetState(); renderStart(); }
});

(async () => {
  try { currentSessionCached = await currentSession(); } catch (_) {}
  if (state.finished && bank.questions.length) {
    // refresh дээр үр дүнгээ дахин харуулах
    const result = scoreTest(bank.questions, state.answers);
    result.kind = bank.id;
    renderResults(result, "Өмнөх үр дүнээ сэргээлээ.");
  } else {
    renderStart();
  }
})();
