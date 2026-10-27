import { icon } from "../components/icons.js";
import { mountNeural } from "../components/neural-canvas.js";
import "../lib/intro.js";

const SKILLS = [
  {
    icon: "book",
    title: "Уншиж ойлгох",
    text: "Уншсан мэдээллээ ойлгох, гол санааг ялгах, дүгнэлт хийх чадвараа танина.",
  },
  {
    icon: "puzzle",
    title: "Асуудал шийдвэрлэх",
    text: "Асуудлыг задлан шинжилж, логик сэтгэлгээгээр шийдэл олох чадвараа хөгжүүлнэ.",
  },
  {
    icon: "filter",
    title: "Мэдээлэл боловсруулах",
    text: "Мэдээллийг харьцуулах, шүүх, үнэн зөвийг ялган ойлгох чадвараа хөгжүүлнэ.",
  },
  {
    icon: "bulb",
    title: "Бүтээлч сэтгэлгээ",
    text: "Шинэ санаа гаргах, асуудлыг өөр өнцгөөс харах, олон шийдэл бодох чадвараа хөгжүүлнэ.",
  },
];

const STEPS = [
  { icon: "file", t: "15 асуултад хариулна", d: "Бүртгэл шаардахгүй, 10–15 минут." },
  { icon: "chart", t: "Дөрвөн чадварынхаа үр дүнг харна", d: "График болон ойлгомжтой тайлбар." },
  { icon: "target", t: "Хүчтэй/хөгжүүлэх чиглэлээ ойлгоно", d: "Ямар чадвар дээр анхаарахаа мэднэ." },
  { icon: "zap", t: "Бүртгүүлж ахицаа хадгална", d: "Дасгал, AI чиглүүлэгч ашиглана." },
];

const FEATURES = [
  { icon: "brain", t: "AI чиглүүлэгч", d: "Хэзээ ч асуулт асууж, бодоход чиглүүлнэ." },
  { icon: "target", t: "Дасган зохицуулсан сургалт", d: "Таны түвшинд тохирсон дасгалууд." },
  { icon: "chart", t: "Ахиц хэмжих", d: "Дөрвөн чадвар тус бүрээр тайлан." },
  { icon: "shield", t: "Аюулгүй орчин", d: "Хүүхдийн мэдээллийн хамгаалалт (RLS)." },
];

const EX_SUMMARY = [
  ["Уншиж ойлгох", "Эх уншиж, гол санаа, баримтыг ялгах дасгал"],
  ["Асуудал шийдвэрлэх", "Дараалал, логик бодлого, алхамчилсан шийдэл"],
  ["Мэдээлэл боловсруулах", "Мэдээллийг шүүж, эх сурвалжийг шалгах"],
  ["Бүтээлч сэтгэлгээ", "Шинэ санаа, олон талын шийдэл бодох"],
];

function render() {
  const skills = document.getElementById("skillsGrid");
  skills.innerHTML = SKILLS.map(
    (s) => `
    <article class="card skill-card hoverable">
      <span class="icon-box">${icon(s.icon)}</span>
      <h3>${s.title}</h3>
      <p>${s.text}</p>
      <a class="go" href="./test.html" aria-label="Тест өгөх">${icon("arrowRight")}</a>
    </article>`
  ).join("");

  document.getElementById("stepsWrap").innerHTML = STEPS.map(
    (s) => `
    <div class="step">
      <div class="num">${icon(s.icon)}</div>
      <h4>${s.t}</h4>
      <p>${s.d}</p>
    </div>`
  ).join("");

  document.getElementById("featuresGrid").innerHTML = FEATURES.map(
    (f) => `
    <div class="feature">
      <span class="icon-box">${icon(f.icon)}</span>
      <h4>${f.t}</h4>
      <p>${f.d}</p>
    </div>`
  ).join("");

  document.getElementById("exList").innerHTML = EX_SUMMARY.map(
    ([t, d]) => `
    <li class="list-row"><span class="icon-box" style="width:38px;height:38px;">${icon("check")}</span>
      <div class="lr-main"><div class="lr-title">${t}</div><div class="lr-sub">${d}</div></div>
    </li>`
  ).join("");

  document.getElementById("exPreview").innerHTML = EX_SUMMARY.slice(0, 3)
    .map(
      ([t, d]) => `
    <div class="list-row">
      <div class="lr-main"><div class="lr-title">${t}</div><div class="lr-sub">${d}</div></div>
      <span class="badge">шаардлагатай</span>
    </div>`
    )
    .join("");
}

function setupNav() {
  const toggle = document.getElementById("navToggle");
  const nav = document.getElementById("mainNav");
  toggle.addEventListener("click", () => nav.classList.toggle("open"));
  nav.addEventListener("click", (e) => {
    if (e.target.tagName === "A") nav.classList.remove("open");
  });

  // идэвхтэй холбоог scroll-аар шинэчлэх
  const links = [...nav.querySelectorAll("a[href^='#']")];
  const sections = links
    .map((a) => document.getElementById(a.getAttribute("href").slice(1)))
    .filter(Boolean);
  const io = new IntersectionObserver(
    (entries) => {
      entries.forEach((en) => {
        if (en.isIntersecting) {
          links.forEach((l) => l.classList.toggle("active", l.getAttribute("href") === "#" + en.target.id));
        }
      });
    },
    { rootMargin: "-40% 0px -55% 0px" }
  );
  sections.forEach((s) => io.observe(s));
}

async function updateAuthButton() {
  try {
    const { getSession } = await import("../services/auth.js");
    const session = await getSession();
    const btn = document.getElementById("loginBtn");
    if (session?.user) {
      btn.textContent = "Миний хуудас →";
      btn.href = "./app.html";
      btn.classList.add("btn-primary");
    }
  } catch (_) {
    /* Firebase тохируулаагүй үед нэвтрэх товч хэвийн үлдэнэ */
  }
}

render();
setupNav();
updateAuthButton();
mountNeural(document.getElementById("heroCanvas"), { density: 1.1, glow: 1 });
