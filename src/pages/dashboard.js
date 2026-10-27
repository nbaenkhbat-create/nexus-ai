/**
 * NEXUS — Dashboard-ын үндсэн хуудас: хамгаалалт, горим, роутер.
 *
 * Горимууд:
 *  - cloud : Firebase тохируулагдсан + нэвтэрсэн → бодит өгөгдөл (Firestore RLS).
 *  - preview : Firebase тохируулаагүй + ?preview=1 → ЗӨВХӨН дизайн харах горим.
 *              Энд бодит хэрэглэгчийн өгөгдөл, хуурамч оноо байхгүй (хоосон төлөв).
 *  - энгийн: тохируулаагүй → login руу (тэнд тохиргооны заавар байна).
 */
import { configured, getSession, signOut } from "../services/auth.js";
import { guestProfile, currentSession } from "../lib/store.js";
import { icon } from "../components/icons.js";
import { renderHome } from "./views/home.js";
import { renderHistory, renderProgress } from "./views/history.js";
import { renderExercises, renderExercise } from "./views/exercises.js";
import { renderAI } from "./views/ai.js";
import { renderProfile, renderSettings } from "./views/account.js";

const $ = (id) => document.getElementById(id);
const root = $("viewRoot");

export const ctx = {
  mode: "guest-preview",
  session: null,
  user: { displayName: "Зочин хэрэглэгч", email: "", isGuest: true },
  go(route, arg) {
    location.hash = arg ? `#/${route}/${arg}` : `#/${route}`;
  },
  refresh: () => route(),
  toast,
};

export function toast(msg, kind = "") {
  const wrap = $("toasts");
  const t = document.createElement("div");
  t.className = "toast " + kind;
  t.textContent = msg;
  wrap.appendChild(t);
  setTimeout(() => t.remove(), 4200);
}

const preview = new URLSearchParams(location.search).get("preview") === "1";

async function boot() {
  const isConfigured = configured();

  if (!isConfigured && !preview) {
    location.replace("./login.html");
    return;
  }

  if (isConfigured) {
    let session = null;
    try { session = await getSession(); } catch (_) {}
    if (!session) {
      location.replace("./login.html");
      return;
    }
    ctx.mode = "cloud";
    ctx.session = session;
    const meta = session.user.user_metadata || {};
    ctx.user = {
      displayName: meta.display_name || session.user.email?.split("@")[0] || "Сурагч",
      email: session.user.email || "",
      isGuest: false,
      createdAt: session.user.created_at,
    };
  } else {
    ctx.mode = "preview";
    const gp = guestProfile();
    ctx.user = { displayName: gp.display_name || "Зочин хэрэглэгч", email: "", isGuest: true, createdAt: null };
  }

  // толгой хэсгийн нэр / аватар
  $("userName").textContent = ctx.user.displayName;
  $("userAvatar").textContent = (ctx.user.displayName || "N").trim().charAt(0).toUpperCase();

  setupShell();
  window.addEventListener("hashchange", route);
  route();
}

function setupShell() {
  document.querySelectorAll("[data-route]").forEach((el) => {
    el.addEventListener("click", () => {
      ctx.go(el.dataset.route);
      closeSidebar();
    });
  });
  $("menuBtn").addEventListener("click", () => {
    $("sidebar").classList.toggle("open");
    $("sideBackdrop").classList.toggle("show");
  });
  $("sideBackdrop").addEventListener("click", closeSidebar);
}
function closeSidebar() {
  $("sidebar").classList.remove("open");
  $("sideBackdrop").classList.remove("show");
}

function setActive(routeName) {
  document.querySelectorAll(".side-link, .top-link").forEach((el) => {
    el.classList.toggle("active", el.dataset.route === routeName);
  });
}

function previewBanner() {
  if (ctx.mode !== "preview") return "";
  return `
    <div class="note warn" style="margin-bottom: 20px;">
      ${icon("alert")}
      <span><b>Дизайн харах горим (preview).</b> Firebase тохируулаагүй тул энд бодит өгөгдөл, хуурамч оноо байхгүй —
      бүх хэсэг хоосон төлөвөөр харагдаж байна. Нэвтрэлт, бүртгэл, AI ажиллахын тулд
      <code>src/lib/config.js</code> дээрх <code>FIREBASE_CONFIG</code> утгуудыг оруулна уу.</span>
    </div>`;
}

const ROUTES = {
  home: renderHome,
  history: renderHistory,
  progress: renderProgress,
  exercises: renderExercises,
  exercise: renderExercise,
  ai: renderAI,
  profile: renderProfile,
  settings: renderSettings,
};

async function route() {
  const hash = location.hash.replace(/^#\//, "");
  const [name, arg] = hash.split("/");
  const key = ROUTES[name] ? name : "home";
  setActive(key === "exercise" ? "exercises" : key);
  root.innerHTML = `<div class="center" style="padding: 60px;"><span class="spinner"></span></div>`;
  try {
    await ROUTES[key]({ ...ctx, root, arg, banner: previewBanner() });
  } catch (e) {
    root.innerHTML = `
      <div class="empty-state">
        <div class="es-icon">${icon("alert")}</div>
        <h3>Хуудас ачаалахад асуудал гарлаа</h3>
        <p>${e?.message || "Түр зуурын алдаа. Хуудсыг дахин ачаална уу."}</p>
        <button class="btn btn-primary" onclick="location.reload()">Дахин ачаалах</button>
      </div>`;
  }
}

// Гарах (тохиргооноос дууддаг)
window.NEXUS_signOut = async () => {
  try { await signOut(); } catch (_) {}
  location.href = "./index.html";
};

boot();
