/** NEXUS Dashboard — Нүүр хуудас (burgtel.png загварын дагуу). */
import { icon } from "../../components/icons.js";
import { mountNeural } from "../../components/neural-canvas.js";
import { radarChart, donutChart } from "../../components/charts.js";
import { listTestResults, listExerciseProgress } from "../../lib/store.js";
import { SKILLS, SKILL_ORDER } from "../../lib/questions.js";
import { EXERCISES, exercisesBySkill } from "../../lib/exercises.js";

export async function renderHome(ctx) {
  const { root, banner, user } = ctx;

  const [tests, exProgress] = await Promise.all([
    listTestResults().catch(() => []),
    listExerciseProgress().catch(() => []),
  ]);
  const latest = tests[0] || null;
  const doneIds = new Set(exProgress.filter((p) => p.status === "completed").map((p) => p.exercise_id));

  const greeting = greetingText();
  root.innerHTML = `
    ${banner}
    <div class="dash-grid">
      <!-- Мэндчлэл -->
      <div class="card greeting-card">
        <canvas id="greetCanvas"></canvas>
        <div class="gc-body">
          <h2>${greeting}, <span class="grad-text">${user.displayName}!</span></h2>
          <p>NEXUS бол таны сэтгэхүйг хөгжүүлж, чадвараа өсгөх платформ. Өнөөдөр ч бага зэргийн ахиц гаргаарай.</p>
          <a class="btn btn-primary" href="./test.html" style="margin-top: 8px;">Өнөөдрийн даалгавар →</a>
        </div>
      </div>

      <div class="grid-2" style="gap: 20px;">
        <!-- Дөрвөн суурь чадвар -->
        <div class="card chart-card">
          <div class="card-title">Таны дөрвөн суурь чадвар</div>
          ${
            latest
              ? `<div style="display: grid; grid-template-columns: 1.1fr 1fr; gap: 14px; align-items: center;">
                   <div id="homeRadar" style="max-width: 280px;"></div>
                   <div class="skill-bars" id="homeBars"></div>
                 </div>`
              : emptyInline("Хараахан тест өгөөгүй байна", "Дөрвөн чадварын дүн харагдахын тулд эхлээд 15 асуулттай тест өгнө үү.", "./test.html", "Тест өгөх")
          }
        </div>

        <!-- Туршилтын тест -->
        <div class="card" style="display:flex; flex-direction:column; justify-content: space-between;">
          <div>
            <div class="card-title">
              <span class="icon-box">${icon("file")}</span> Туршилтын тест
            </div>
            <p class="small muted">Үнэгүй өнөөдөр түвшин тогтоох: 15 асуулттай тест.</p>
            <div class="chip-row" style="margin: 12px 0 16px;">
              <span class="chip">${icon("list")} 15 асуулт</span>
              <span class="chip">${icon("layers")} 4 чадвар</span>
              <span class="chip">${icon("clock")} 10–15 мин</span>
            </div>
          </div>
          <a class="btn btn-primary btn-block" href="./test.html">Тест өгөх →</a>
        </div>
      </div>

      <div class="grid-3">
        <!-- Сүүлийн дүн -->
        <div class="card chart-card center">
          <div class="card-title" style="justify-content:center;">Сүүлийн дүн</div>
          ${
            latest
              ? `<div class="donut-wrap"><div id="homeDonut"></div>
                   <div class="donut-center"><span class="val grad-text">${latest.overall ?? 0}%</span><span class="lbl">нийт</span></div>
                 </div>
                 <div class="skill-bars" id="homeLatestBars" style="text-align:left; margin-top: 8px;"></div>`
              : emptyInline("Тест өгөөгүй", "Тест дуусмагц сүүлийн дүн энд гарна.", "./test.html", "Эхлэх")
          }
        </div>

        <!-- Өнөөдрийн дасгалууд -->
        <div class="card">
          <div class="card-title" style="justify-content: space-between;">
            <span>Өнөөдрийн дасгалууд</span>
            <button class="btn btn-ghost btn-sm" data-go="exercises">Бүгдийг харах →</button>
          </div>
          <div id="dailyEx"></div>
        </div>

        <!-- Сүүд хийсэн тестүүд -->
        <div class="card">
          <div class="card-title" style="justify-content: space-between;">
            <span>Сүүд хийсэн тестүүд</span>
            <button class="btn btn-ghost btn-sm" data-go="history">Бүгдийг харах →</button>
          </div>
          <div id="recentTests"></div>
        </div>
      </div>

      <div class="grid-3">
        <!-- Ахицын тэмдэглэл -->
        <div class="card quote-card">
          <blockquote>«Өнөөдөр хийж буй ахиц маргаашын чамын хувьд том амжилт.»</blockquote>
          <cite>— NEXUS</cite>
          <div style="margin-top: 16px;">
            <button class="btn btn-outline btn-sm" data-go="progress">Дэлгэрэнгүй харах →</button>
          </div>
        </div>

        <!-- AI чиглүүлэгч -->
        <div class="card">
          <div class="card-title"><span class="icon-box">${icon("message")}</span> AI чиглүүлэгч</div>
          <p class="small muted">Тестийн үр дүнгээ ойлгохгүй байна уу? Чиглүүлэгчээс асуугаарай — шууд хариу биш, бодоход чиглүүлнэ.</p>
          <button class="btn btn-outline btn-block" data-go="ai">Ярилцлага эхлэх →</button>
        </div>

        <!-- Системийн онцлог -->
        <div class="card">
          <div class="card-title"><span class="icon-box">${icon("spark")}</span> Системийн онцлог</div>
          <div class="list-row" style="margin-bottom: 8px;"><span class="icon-box" style="width:36px;height:36px;">${icon("brain")}</span><div class="lr-main"><div class="lr-title">AI чиглүүлэгч</div><div class="lr-sub">Хэзээ ч асуулт асууж, бодоход тусална</div></div></div>
          <div class="list-row" style="margin-bottom: 8px;"><span class="icon-box" style="width:36px;height:36px;">${icon("target")}</span><div class="lr-main"><div class="lr-title">Дасан зохицох сургалт</div><div class="lr-sub">Таны түвшинд тохирсон дасгал</div></div></div>
          <div class="list-row" style="margin-bottom: 0;"><span class="icon-box" style="width:36px;height:36px;">${icon("shield")}</span><div class="lr-main"><div class="lr-title">Аюулгүй орчин</div><div class="lr-sub">Зөвхөн таны өгөгдөл — RLS хамгаалалт</div></div></div>
        </div>
      </div>
    </div>`;

  // neural canvas
  const gc = document.getElementById("greetCanvas");
  if (gc) mountNeural(gc, { density: 0.7, glow: 0.8, speed: 0.2 });

  // чадварын график
  if (latest && latest.skills && Object.keys(latest.skills).length) {
    const items = SKILL_ORDER.map((k) => ({
      label: k,
      pct: latest.skills[k]?.pct ?? 0,
      color: SKILLS[k].color,
    }));
    const radarEl = document.getElementById("homeRadar");
    if (radarEl) radarChart(radarEl, items, { size: 300 });

    const barsHTML = SKILL_ORDER.map((k) => skillBar(k, latest.skills[k]?.pct ?? 0)).join("");
    const hb = document.getElementById("homeBars");
    if (hb) hb.innerHTML = barsHTML;
    const lb = document.getElementById("homeLatestBars");
    if (lb) lb.innerHTML = barsHTML;

    const dn = document.getElementById("homeDonut");
    if (dn) donutChart(dn, latest.overall ?? 0, { size: 170, stroke: 13 });
  }

  // өнөөдрийн дасгалууд (чадвар тус бүрийн явц)
  const dailyEl = document.getElementById("dailyEx");
  dailyEl.innerHTML = SKILL_ORDER.map((k) => {
    const all = exercisesBySkill(k);
    const done = all.filter((e) => doneIds.has(e.id)).length;
    const s = SKILLS[k];
    return `
      <div class="list-row">
        <span class="icon-box" style="width:38px;height:38px;">${icon(s.icon)}</span>
        <div class="lr-main">
          <div class="lr-title">${s.name}</div>
          <div class="lr-sub">${all.length ? `${done}/${all.length} дасгал хийсэн` : "дасгал байхгүй"}</div>
        </div>
        <span class="lr-score" style="color:${done === all.length && all.length ? "var(--ok)" : "var(--muted)"};">${all.length ? `${done}/${all.length}` : "—"}</span>
      </div>`;
  }).join("");

  // сүүлийн тестүүд
  const rt = document.getElementById("recentTests");
  if (!tests.length) {
    rt.innerHTML = `
      <div class="empty-state" style="padding: 26px 16px;">
        <h3 style="font-size:0.98rem;">Та хараахан тест өгөөгүй байна</h3>
        <p class="small">Эхний тестээ өгөөд ахицаа бүртгүүлээрэй.</p>
        <a class="btn btn-primary btn-sm" href="./test.html">Тест эхлэх</a>
      </div>`;
  } else {
    rt.innerHTML = tests.slice(0, 3).map((t) => `
      <div class="list-row">
        <span class="icon-box" style="width:38px;height:38px;">${icon("file")}</span>
        <div class="lr-main">
          <div class="lr-title">${kindTitle(t.kind)}</div>
          <div class="lr-sub">${fmtDate(t.testedAt)}</div>
        </div>
        <span class="lr-score grad-text">${t.overall ?? 0}%</span>
      </div>`).join("");
  }

  root.querySelectorAll("[data-go]").forEach((b) =>
    b.addEventListener("click", () => ctx.go(b.dataset.go))
  );
}

function skillBar(key, pct) {
  const s = SKILLS[key];
  return `
    <div class="skill-bar">
      <div class="sb-top"><span>${s.name}</span><b>${pct}%</b></div>
      <div class="track"><i style="width:${pct}%; background: linear-gradient(90deg, ${s.color}, #a855f7);"></i></div>
    </div>`;
}

function emptyInline(title, text, href, btn) {
  return `
    <div class="empty-state" style="padding: 30px 18px;">
      <div class="es-icon">${icon("chart")}</div>
      <h3>${title}</h3>
      <p>${text}</p>
      <a class="btn btn-primary btn-sm" href="${href}">${btn}</a>
    </div>`;
}

function greetingText() {
  const h = new Date().getHours();
  if (h < 11) return "Өглөөний мэнд";
  if (h < 18) return "Сайн байна уу";
  return "Оройн мэнд";
}

export function kindTitle(kind) {
  if (kind === "detailed") return "Нарийвчилсан тест";
  return "Туршилтын тест (бүртгэлгүй)";
}

export function fmtDate(iso) {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleString("mn-MN", {
      year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit",
    });
  } catch (_) {
    return iso;
  }
}
