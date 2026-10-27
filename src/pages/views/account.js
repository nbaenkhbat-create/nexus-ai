/** NEXUS Dashboard — Миний профайл ба Тохиргоо. */
import { icon } from "../../components/icons.js";
import { radarChart } from "../../components/charts.js";
import { listTestResults, listExerciseProgress, guestProfile, setGuestProfile, localListTests, localClearTests } from "../../lib/store.js";
import { updateDisplayName } from "../../services/auth.js";
import { configured } from "../../services/supabase.js";
import { SKILLS, SKILL_ORDER } from "../../lib/questions.js";
import { EXERCISES } from "../../lib/exercises.js";
import { fmtDate, kindTitle } from "./home.js";

/* ================= МИНИЙ ПРОФАЙЛ ================= */
export async function renderProfile(ctx) {
  const { root, banner, user, mode, toast, refresh } = ctx;
  const [tests, exProgress] = await Promise.all([
    listTestResults().catch(() => []),
    listExerciseProgress().catch(() => []),
  ]);
  const latest = tests[0] || null;
  const exDone = exProgress.filter((p) => p.status === "completed").length;

  root.innerHTML = `
    ${banner}
    <div class="page-head">
      <div><h1>Миний профайл</h1><p>Зөвхөн таны хувийн мэдээлэл — бусад хэрэглэгч харах боломжгүй (RLS).</p></div>
    </div>

    <div class="grid-2">
      <div class="card">
        <div style="display:flex; align-items:center; gap:16px;">
          <span class="avatar" style="width:64px; height:64px; font-size:1.6rem;">${(user.displayName || "N").charAt(0).toUpperCase()}</span>
          <div>
            <h3 style="margin-bottom:4px;">${escapeText(user.displayName)}</h3>
            <div class="small muted">${user.email ? escapeText(user.email) : "Бүртгэлгүй (зоочин горим)"}</div>
            ${user.createdAt ? `<div class="small muted">Гишүүн болсон: ${fmtDate(user.createdAt)}</div>` : ""}
            <div style="margin-top:8px;">
              ${mode === "cloud" ? `<span class="badge ok">${icon("shield")} Бүртгэлтэй хэрэглэгч</span>` : `<span class="badge warn">${icon("info")} Зочин горим</span>`}
            </div>
          </div>
        </div>

        <div class="grid-3" style="margin-top:22px;">
          <div class="card mini-stat" style="padding:14px;"><div><div class="v">${tests.length}</div><div class="l">тест</div></div></div>
          <div class="card mini-stat" style="padding:14px;"><div><div class="v">${latest ? latest.overall + "%" : "—"}</div><div class="l">сүүлийн дүн</div></div></div>
          <div class="card mini-stat" style="padding:14px;"><div><div class="v">${exDone}/${EXERCISES.length}</div><div class="l">дасгал</div></div></div>
        </div>

        <div class="field" style="margin-top:22px;">
          <label for="dispName">Харуулах нэр</label>
          <div style="display:flex; gap:10px;">
            <input id="dispName" value="${escapeAttr(user.displayName)}" maxlength="60" />
            <button class="btn btn-primary" id="saveName" style="white-space:nowrap;">Хадгалах</button>
          </div>
          <p class="small muted" style="margin-top:8px;">
            ${mode === "cloud" ? "Нэр таны бүртгэлд шинэчлэгдэнэ." : "Нэр зөвхөн энэ төхөөрөмж дээр хадгалагдана (зочин горим)."}
          </p>
        </div>
      </div>

      <div class="card chart-card">
        <div class="card-title">Чадварын одоогийн зураглал</div>
        ${
          latest
            ? `<div id="profRadar" style="max-width: 330px; margin: 8px auto;"></div>
               <div class="skill-bars">${SKILL_ORDER.map((k) => {
                 const pct = latest.skills?.[k]?.pct ?? 0;
                 return `<div class="skill-bar"><div class="sb-top"><span>${SKILLS[k].name}</span><b>${pct}%</b></div>
                 <div class="track"><i style="width:${pct}%; background: linear-gradient(90deg, ${SKILLS[k].color}, #a855f7);"></i></div></div>`;
               }).join("")}</div>
               <p class="small muted center" style="margin-top:12px;">Сүүлийн тест: ${kindTitle(latest.kind)} · ${fmtDate(latest.testedAt)}</p>`
            : `<div class="empty-state" style="padding:30px 18px;">
                 <div class="es-icon">${icon("chart")}</div>
                 <h3>Тест өгөөгүй байна</h3>
                 <p>Чадварын зураглал тест дуусмагц үүснэ.</p>
                 <a class="btn btn-primary btn-sm" href="./test.html">Тест өгөх</a>
               </div>`
        }
      </div>
    </div>`;

  if (latest) {
    radarChart(root.querySelector("#profRadar"),
      SKILL_ORDER.map((k) => ({ label: k, pct: latest.skills?.[k]?.pct ?? 0, color: SKILLS[k].color })),
      { size: 330 });
  }

  root.querySelector("#saveName").addEventListener("click", async (e) => {
    const val = root.querySelector("#dispName").value.trim();
    if (!val) { toast("Нэр хоосон байж болохгүй.", "err"); return; }
    e.target.disabled = true;
    try {
      if (mode === "cloud") await updateDisplayName({ displayName: val });
      else setGuestProfile({ display_name: val });
      toast("Нэр шинэчлэгдлээ.", "ok");
      refresh();
    } catch (err) {
      toast(err?.message || "Шинэчлэхэд асуудал гарлаа.", "err");
      e.target.disabled = false;
    }
  });
}

/* ================= ТОХИРГОО ================= */
export async function renderSettings(ctx) {
  const { root, banner, user, mode, toast, go } = ctx;
  const isConfigured = configured();

  root.innerHTML = `
    ${banner}
    <div class="page-head">
      <div><h1>Тохиргоо</h1><p>Бүртгэл, өгөгдөл, горимын тохиргоо.</p></div>
    </div>

    <div class="grid-2">
      <div class="card">
        <div class="card-title">${icon("user")} Бүртгэл</div>
        <div class="list-row"><div class="lr-main"><div class="lr-title">Нэр</div><div class="lr-sub">${escapeText(user.displayName)}</div></div>
          <button class="btn btn-outline btn-sm" data-go="profile">Засах</button></div>
        <div class="list-row"><div class="lr-main"><div class="lr-title">Имэйл</div><div class="lr-sub">${user.email ? escapeText(user.email) : "— (зочин горим)"}</div></div></div>
        <div class="list-row"><div class="lr-main"><div class="lr-title">Горим</div><div class="lr-sub">${
          mode === "cloud" ? "Supabase холбогдсон — өгөгдөл област хадгалагдана" : "Дизайн харах горим (тохируулаагүй)"
        }</div></div></div>
        ${
          mode !== "cloud"
            ? `<div class="note warn" style="margin-top:14px;">${icon("info")}<span>Нэвтрэлт, бүртгэл, AI ажиллахын тулд
               <code>src/lib/config.js</code> дээр Supabase URL/anon key тавина уу (README-г харна уу).</span></div>`
            : ""
        }
        <div style="display:flex; gap:10px; margin-top:16px; flex-wrap:wrap;">
          <button class="btn btn-outline btn-sm" data-go="profile">Профайл засах</button>
          <button class="btn btn-danger btn-sm" id="logoutBtn">${icon("logout")} Гарах</button>
        </div>
      </div>

      <div class="card">
        <div class="card-title">${icon("layers")} Миний өгөгдөл</div>
        <p class="small muted">Өөрийн тестийн түүх, дасгалын явцыг JSON файл болгон татаж авч болно.</p>
        <div style="display:flex; gap:10px; flex-wrap:wrap; margin-top: 6px;">
          <button class="btn btn-outline btn-sm" id="exportBtn">${icon("file")} Өгөгдөл татаж авах</button>
          ${
            mode !== "cloud"
              ? `<button class="btn btn-danger btn-sm" id="clearLocalBtn">Энэ төхөөрөмжийн өгөгдөл устгах</button>`
              : ""
          }
        </div>

        <div class="divider">ажиллагаа</div>

        <div class="list-row"><span class="icon-box" style="width:38px;height:38px;">${icon("target")}</span>
          <div class="lr-main"><div class="lr-title">Дасгалууд</div><div class="lr-sub">Чадвар тус бүрийн дасгалын жагсаалт</div></div>
          <button class="btn btn-ghost btn-sm" data-go="exercises">Нээх →</button></div>
        <div class="list-row"><span class="icon-box" style="width:38px;height:38px;">${icon("history")}</span>
          <div class="lr-main"><div class="lr-title">Тестийн түүх</div><div class="lr-sub">Бүх тестийн үр дүн</div></div>
          <button class="btn btn-ghost btn-sm" data-go="history">Нээх →</button></div>

        <div class="note" style="margin-top:14px;">${icon("shield")}<span>
          <b>Нууц үг сэргээх:</b> <a href="./reset.html" style="color:var(--blue);">reset.html</a><br/>
          <b>Бүртгэл устгах:</b> Supabase Dashboard → Authentication → Users дээр админ устгана
          (хүсэлтийг баталгаажуулсаны дараа).<br/>
          Хүүхдийн эмзэг мэдээлэл (овог нэр, регистр, сургууль) цуглуулаагүй.
        </span></div>
      </div>
    </div>`;

  root.querySelectorAll("[data-go]").forEach((b) =>
    b.addEventListener("click", () => go(b.dataset.go))
  );

  root.querySelector("#logoutBtn").addEventListener("click", async () => {
    if (mode !== "cloud") { location.href = "./index.html"; return; }
    const ok = confirm("Системээс гарах уу?");
    if (!ok) return;
    await window.NEXUS_signOut?.();
  });

  root.querySelector("#exportBtn").addEventListener("click", () => {
    try {
      const data = {
        exported_at: new Date().toISOString(),
        profile: { display_name: user.displayName, email: user.email || null },
        tests: localListTests(),
        exercise_progress: await0(),
      };
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `nexus-data-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(a.href);
      toast("Өгөгдөл татагдлаа.", "ok");
    } catch (_) {
      toast("Татаж авхад асуудал гарлаа.", "err");
    }
  });

  const clearBtn = root.querySelector("#clearLocalBtn");
  if (clearBtn) {
    clearBtn.addEventListener("click", async () => {
      const ok = confirm("Энэ төхөөрөмж дээрх бүх локал өгөгдөл (тестийн түүх, дасгалын явц) устгах уу? Энэ үйлдэг буцаах боломжгүй.");
      if (!ok) return;
      localClearTests();
      try { localStorage.removeItem("nexus_ex_progress_v1"); } catch (_) {}
      toast("Локал өгөгдөл устгалаа.", "ok");
      go("home");
    });
  }
}

function await0() {
  // export-д зориулж локал дасгалын явц (sync уншилт)
  try { return JSON.parse(localStorage.getItem("nexus_ex_progress_v1") || "[]"); } catch (_) { return []; }
}

function escapeText(s) {
  return String(s ?? "").replaceAll("<", "&" + "lt;").replaceAll(">", "&" + "gt;");
}
function escapeAttr(s) {
  return escapeText(s).replaceAll('"', "&" + "quot;");
}
