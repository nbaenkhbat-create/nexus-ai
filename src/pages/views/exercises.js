/** NEXUS Dashboard — Дасгалууд (жагсаалт + дэлгэрэнгүй). */
import { icon } from "../../components/icons.js";
import { EXERCISES, getExercise, gradeChoiceExercise } from "../../lib/exercises.js";
import { listExerciseProgress, saveExerciseProgress } from "../../lib/store.js";
import { SKILLS, SKILL_ORDER } from "../../lib/questions.js";

const filterState = { skill: "all" };

export async function renderExercises(ctx) {
  const { root, banner } = ctx;
  const progress = await listExerciseProgress().catch(() => []);
  const byId = Object.fromEntries(progress.map((p) => [p.exercise_id, p]));

  const filters = [
    ["all", "Бүгд"],
    ...SKILL_ORDER.map((k) => [k, SKILLS[k].name]),
  ];

  root.innerHTML = `
    ${banner}
    <div class="page-head">
      <div>
        <h1>Дасгалууд</h1>
        <p>Дөрвөн суурь чадвараар ангилагдсан бодит дасгалууд. Хийсэн дасгал ахицын тайлангаас харагдана.</p>
      </div>
    </div>

    <div class="chip-row" id="exFilters" style="margin-bottom: 20px;">
      ${filters.map(([k, label]) => `
        <button class="chip" data-skill="${k}" style="cursor:pointer; ${filterState.skill === k ? "border-color: var(--blue-2); color:#fff; background: rgba(56,189,248,0.14);" : ""}">${label}</button>
      `).join("")}
    </div>

    <div class="grid-3" id="exGrid"></div>`;

  const grid = root.querySelector("#exGrid");

  function paint() {
    const list = EXERCISES.filter((e) => filterState.skill === "all" || e.skill === filterState.skill);
    if (!list.length) {
      grid.innerHTML = `
        <div class="empty-state" style="grid-column: 1 / -1;">
          <div class="es-icon">${icon("target")}</div>
          <h3>Энэ чадварт одоогоор дасгал байхгүй</h3>
          <p>Бодит агуулга нэмэгдсэний дараа энд харагдана. Хуурамч дасгал ачаалж үзүүлэхгүй.</p>
        </div>`;
      return;
    }
    grid.innerHTML = list.map((e) => {
      const p = byId[e.id];
      const done = p?.status === "completed";
      const s = SKILLS[e.skill];
      return `
        <article class="card exercise-card hoverable" data-open="${e.id}" style="cursor:pointer;">
          <div class="ec-top">
            <span class="badge ${e.skill === "creative" ? "pink" : e.skill === "info" ? "ok" : "cyan"}">${s.name}</span>
            ${done ? `<span class="badge ok">${icon("check")} Хийсэн${p.score != null ? ` · ${p.score}%` : ""}</span>` : ""}
          </div>
          <h3>${e.title}</h3>
          <p>${e.desc}</p>
          <div class="chip-row" style="font-size: 0.78rem;">
            <span class="chip">${icon("zap")} ${e.difficulty}</span>
            <span class="chip">${icon("clock")} ${e.minutes} мин</span>
            <span class="chip">${e.mode === "choice" ? "Сонголт" : "Бичвэр"}</span>
          </div>
          <div class="ec-foot">
            <span class="small muted">${done ? "Дахин хийх боломжтой" : "Эхлэхэд бэлэн"}</span>
            <span class="go">${icon("arrowRight")}</span>
          </div>
        </article>`;
    }).join("");

    grid.querySelectorAll("[data-open]").forEach((el) =>
      el.addEventListener("click", () => ctx.go("exercise", el.dataset.open))
    );
  }

  root.querySelector("#exFilters").addEventListener("click", (e) => {
    const btn = e.target.closest("[data-skill]");
    if (!btn) return;
    filterState.skill = btn.dataset.skill;
    root.querySelectorAll("#exFilters .chip").forEach((c) => {
      const on = c.dataset.skill === filterState.skill;
      c.style.cssText = on
        ? "cursor:pointer; border-color: var(--blue-2); color:#fff; background: rgba(56,189,248,0.14);"
        : "cursor:pointer;";
    });
    paint();
  });

  paint();
}

/* ---------------- Дасгалын дэлгэрэнгүй ---------------- */
export async function renderExercise(ctx) {
  const { root, banner, arg, go, toast } = ctx;
  const ex = getExercise(arg);
  if (!ex) {
    root.innerHTML = `
      ${banner}
      <div class="empty-state">
        <div class="es-icon">${icon("alert")}</div>
        <h3>Дасгал олдоогүй</h3>
        <p>Холбоос буруу эсвэл дасгал устгагдсан байж магадгүй.</p>
        <button class="btn btn-primary" id="backBtn">Дасгалууд руу буцах</button>
      </div>`;
    root.querySelector("#backBtn").addEventListener("click", () => go("exercises"));
    return;
  }

  const progress = await listExerciseProgress().catch(() => []);
  const prev = progress.find((p) => p.exercise_id === ex.id);
  const s = SKILLS[ex.skill];

  let answers = ex.mode === "choice" ? (ex.questions || []).map(() => null) : [""];
  let submitted = false;

  root.innerHTML = `
    ${banner}
    <div class="page-head">
      <div>
        <button class="btn btn-ghost btn-sm" id="backBtn" style="margin-bottom:10px;">← Дасгалууд</button>
        <div class="chip-row" style="margin-bottom:8px;">
          <span class="badge ${ex.skill === "creative" ? "pink" : ex.skill === "info" ? "ok" : "cyan"}">${s.name}</span>
          <span class="chip">${icon("zap")} ${ex.difficulty}</span>
          <span class="chip">${icon("clock")} ${ex.minutes} мин</span>
          ${prev?.status === "completed" ? `<span class="badge ok">${icon("check")} Өмнө хийсэн${prev.score != null ? ` · ${prev.score}%` : ""}</span>` : ""}
        </div>
        <h1>${ex.title}</h1>
        <p>${ex.desc}</p>
      </div>
    </div>

    <div class="card" style="margin-bottom: 18px;">
      <div class="note">${icon("info")}<span>${ex.instructions}</span></div>
      <div class="exercise-body" style="margin-top: 16px;">${escapeHtml(ex.content)}</div>
    </div>

    <div class="card" id="answerCard">
      <div class="card-title">${icon("edit")} ${ex.mode === "choice" ? "Хариултаа сонгоно уу" : "Хариултаа бичнэ үү"}</div>
      <div id="answerArea"></div>
      <div id="resultArea"></div>
      <div style="display:flex; gap:12px; margin-top: 18px; flex-wrap: wrap;">
        <button class="btn btn-primary" id="submitBtn">${ex.mode === "choice" ? "Шалгах →" : "Дуусгах →"}</button>
        <button class="btn btn-ghost" id="cancelBtn">Буцах</button>
      </div>
    </div>`;

  const area = root.querySelector("#answerArea");
  const resultArea = root.querySelector("#resultArea");
  const submitBtn = root.querySelector("#submitBtn");

  function paintAnswerArea() {
    if (ex.mode === "choice") {
      area.innerHTML = (ex.questions || []).map((q, qi) => `
        <div style="margin-bottom: 22px;">
          <div class="q-text" style="font-size:1rem; margin-bottom: 12px;">${qi + 1}. ${escapeHtml(q.text)}</div>
          <div class="options">
            ${q.options.map((o, oi) => `
              <button class="option ${answers[qi] === oi ? "selected" : ""}" data-q="${qi}" data-o="${oi}" type="button">
                <span class="key">${String.fromCharCode(65 + oi)}</span><span>${escapeHtml(o)}</span>
              </button>`).join("")}
          </div>
        </div>`).join("");
      area.querySelectorAll(".option").forEach((b) =>
        b.addEventListener("click", () => {
          if (submitted) return;
          answers[+b.dataset.q] = +b.dataset.o;
          paintAnswerArea();
        })
      );
    } else {
      area.innerHTML = `
        <div class="field">
          <textarea id="textAnswer" placeholder="${ex.placeholder || "Хариултаа бичнэ үү..."}">${escapeHtml(answers[0] || "")}</textarea>
        </div>`;
      area.querySelector("#textAnswer").addEventListener("input", (e) => { answers[0] = e.target.value; });
    }
  }

  async function submit() {
    if (ex.mode === "choice") {
      if (submitted) {
        // «Дахин оролдох»
        submitted = false;
        answers = (ex.questions || []).map(() => null);
        resultArea.innerHTML = "";
        submitBtn.textContent = "Шалгах →";
        paintAnswerArea();
        return;
      }
      const missing = answers.findIndex((a) => a === null);
      if (missing >= 0) { toast("Бүх асуултад хариулна уу.", "err"); return; }

      const g = gradeChoiceExercise(ex, answers);
      submitted = true;
      resultArea.innerHTML = `
        <div class="note ${g.score >= 60 ? "" : "warn"}" style="margin-top: 16px;">
          ${g.score >= 60 ? icon("checkCircle") : icon("info")}
          <span><b>Таны оноо: ${g.score}% (${g.right}/${g.total})</b><br/>
          ${g.score === 100 ? "Бүх хариулт зөв — гайхалтай!" : g.score >= 60 ? "Ихэнх нь зөв. Буруу хариултын тайлбарыг доороос харна уу." : "Дахин оролдоод тайлбартайгаар тулгаарай."}</span>
        </div>
        ${(ex.questions || []).map((q, qi) => {
          const ok = answers[qi] === q.answer;
          return `
            <div class="ex-item" style="margin-top: 10px;">
              <span class="icon-box" style="width:36px;height:36px; color:${ok ? "var(--ok)" : "var(--danger)"};">${icon(ok ? "check" : "x")}</span>
              <div>
                <div class="lvl">${qi + 1}. ${ok ? "Зөв" : `Буруу — зөв: ${String.fromCharCode(65 + q.answer)}`}</div>
                <p>${escapeHtml(q.explanation || "")}</p>
              </div>
            </div>`;
        }).join("")}`;
      submitBtn.textContent = "Дахин оролдох ↻";
      paintAnswerArea();

      try {
        await saveExerciseProgress({
          exercise_id: ex.id, status: "completed", score: g.score,
          completed_at: new Date().toISOString(),
        });
        toast("Дасгалын үр дүн ахицын тайлангаас хамаарч хадгалагдлаа.", "ok");
      } catch (_) {
        toast("Үр дүнг бүртгэлд хадгалахад асуудал гарлаа.", "err");
      }
    } else {
      const text = (answers[0] || "").trim();
      if (text.length < 12) { toast("Хариултаа илүү дэлгэрэнгүй бичнэ үү (доод хэмжээ 12 тэмдэгт).", "err"); return; }
      submitted = true;
      resultArea.innerHTML = `
        <div class="note" style="margin-top: 16px;">${icon("info")}
          <span>Хариултыг жишээ хариулттай тулгаж <b>өөрөө</b> үнэлнэ үү — энд нэгтгэсэн «зөв хариулт» байхгүй.</span>
        </div>
        <div class="model-answer"><b>Жишээ хариулт:</b>

${escapeHtml(ex.modelAnswer || "")}</div>
        <div class="model-answer" style="background: rgba(99,102,241,0.08); border-color: rgba(129,140,248,0.4); color:#c7d2fe;">
          <b>Өөрийгөө үнэлэх рубрик:</b>

${escapeHtml(ex.selfCheck || "")}
        </div>`;
      submitBtn.textContent = "Дахин бичих ↻";
      area.querySelector("#textAnswer")?.setAttribute("disabled", "true");
      try {
        await saveExerciseProgress({
          exercise_id: ex.id, status: "completed", score: null,
          completed_at: new Date().toISOString(),
        });
        toast("Дасгалыг хийсэн тэмдэглэл болгон хадгаллаа.", "ok");
      } catch (_) {
        toast("Хадгалахад асуудал гарлаа.", "err");
      }
    }
  }

  paintAnswerArea();
  submitBtn.addEventListener("click", submit);
  root.querySelector("#cancelBtn").addEventListener("click", () => go("exercises"));
  root.querySelector("#backBtn").addEventListener("click", () => go("exercises"));
}function escapeHtml(str) {
  const AMP = "&" + "amp;";
  const LT = "&" + "lt;";
  const GT = "&" + "gt;";
  const QUOT = "&" + "quot;";
  const APOS = "&#" + "39;";
  return String(str ?? "")
    .replaceAll("&", AMP)
    .replaceAll("<", LT)
    .replaceAll(">", GT)
    .replaceAll('"', QUOT)
    .replaceAll("'", APOS);
}
