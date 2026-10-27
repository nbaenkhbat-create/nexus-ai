/**
 * NEXUS — Анхны ороход тоглох logo loading видео.
 * Нэг удаа (анхны нэвтрэлт) fullscreen-д яг хэмжээгээр нь тоглодог.
 * Дараагийн удаа localStorage тэмдэгээр алгасагдана.
 */
const SEEN_KEY = "nexus_intro_seen";

export function maybeShowIntro({ force = false } = {}) {
  let seen = false;
  try { seen = localStorage.getItem(SEEN_KEY) === "1"; } catch (_) {}
  if (seen && !force) return;

  const screen = document.createElement("div");
  screen.className = "intro-screen";
  screen.innerHTML = `
    <video muted playsinline preload="auto" src="./assets/logo-loading.mp4"></video>
    <button class="intro-skip" type="button">Алгасах ▸</button>`;
  document.body.appendChild(screen);

  const video = screen.querySelector("video");
  const skip = screen.querySelector(".intro-skip");
  let done = false;

  const finish = () => {
    if (done) return;
    done = true;
    try { localStorage.setItem(SEEN_KEY, "1"); } catch (_) {}
    screen.classList.add("fade");
    setTimeout(() => screen.remove(), 650);
  };

  skip.addEventListener("click", finish);
  video.addEventListener("ended", () => setTimeout(finish, 400));
  video.addEventListener("error", finish);
  // Тоглохгүй бол (жнь. файл дутуу) 5 сек-ийн дараа автоматаар гарна
  setTimeout(finish, 7000);

  const p = video.play();
  if (p && typeof p.catch === "function") p.catch(() => { /* autoplay блокирввол skip гарна */ });
}

// Шууд нээгдсэн тохиолдолд (эхлэл хуудас)
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => maybeShowIntro());
} else {
  maybeShowIntro();
}
