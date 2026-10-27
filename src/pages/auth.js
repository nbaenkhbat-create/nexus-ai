/**
 * NEXUS — Бүртгэл/нэвтрэлт хуудсуудын логик (login, signup, reset).
 * Supabase тохируулаагүй үед хуудас "хугарах" биш, тодорхой заавар харуулна.
 */
import {
  configured,
  signUp,
  signInWithEmail,
  signInWithGoogle,
  sendPasswordReset,
  updatePassword,
  getSession,
} from "../services/auth.js";

const page = document.body.dataset.page;
const $ = (id) => document.getElementById(id);

function showError(id, msg) {
  const el = $(id);
  if (!el) return;
  el.textContent = msg;
  el.classList.remove("hidden");
}
function clearError(id) {
  const el = $(id);
  if (el) el.classList.add("hidden");
}
function setLoading(btn, loading, text) {
  btn.disabled = loading;
  btn.innerHTML = loading ? `<span class="spinner"></span> Уншиж байна...` : text;
}

function translateError(e) {
  const m = (e && e.message ? e.message : String(e)).toLowerCase();
  if (m.includes("invalid login")) return "Имэйл эсвэл нууц үг буруу байна.";
  if (m.includes("already registered") || m.includes("already been registered"))
    return "Энэ имэйл бүртгэлтэй байна — нэвтрэхийг оролдоно уу.";
  if (m.includes("email not confirmed")) return "Имэйлээ баталгаажуулаагүй байна. Имэйлээ шалгана уу.";
  if (m.includes("password")) return "Нууц үгийн шаардлага хангахгүй байна (доод хэмжээ 8).";
  if (m.includes("rate limit") || m.includes("too many")) return "Олон удаа оролдлоо. Түр хүлээгээд дахин оролдоно уу.";
  if (m.includes("signup is disabled")) return "Бүртгэл одоогоор хаалттай байна — админд хандана уу.";
  if (m.includes("provider is not enabled") || m.includes("oauth") || m.includes("social"))
    return "Google нэвтрэлт одоогоор идэвхгүй байна — Supabase дээр Google Provider-ийг идэвхжүүлнэ үү (README харна уу).";
  if (m.includes("failed to fetch") || m.includes("network"))
    return "Интернэт холболт эсвэл Supabase тохиргоог шалгана уу.";
  return e && e.message ? e.message : "Алдаа гарлаа. Дахин оролдоно уу.";
}

function renderSetupNotice() {
  const box = $("setupNotice");
  if (!box || configured()) return;
  box.className = "note warn";
  box.style.marginBottom = "18px";
  box.innerHTML = `
    <span>
      <b>Supabase тохируулаагүй байна.</b><br/>
      Бүртгэл, нэвтрэлт ажиллахын тулд:<br/>
      1) <a href="https://supabase.com" target="_blank" rel="noopener">supabase.com</a> дээр төсөл үүсгээд<br/>
      2) <code>src/lib/config.js</code> доторх <code>supabaseUrl</code>,
      <code>supabaseAnonKey</code> утгыг солиорой (README-д алхам бүрээр байна).<br/>
      <a class="btn btn-sm btn-outline" style="margin-top:10px;" href="./app.html?preview=1">Дизайн урьдчилж үзэх →</a>
    </span>`;
  box.classList.remove("hidden");
}

/* ---------------- Хуудас тус бүрийн холболт ---------------- */
if (page === "login") {
  renderSetupNotice();
  const form = $("loginForm");
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    clearError("formError");
    const email = $("email").value.trim();
    const password = $("password").value;
    if (!email || !password) return showError("formError", "Имэйл болон нууц үгээ оруулна уу.");
    setLoading($("submitBtn"), true);
    try {
      await signInWithEmail({ email, password });
      location.href = "./app.html";
    } catch (err) {
      showError("formError", translateError(err));
      setLoading($("submitBtn"), false, "Нэвтрэх →");
    }
  });
  $("googleBtn").addEventListener("click", async () => {
    clearError("formError");
    try { await signInWithGoogle(); }
    catch (err) { showError("formError", translateError(err)); }
  });
}

if (page === "signup") {
  renderSetupNotice();
  const form = $("signupForm");
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    clearError("formError");
    $("successBox").classList.add("hidden");
    const displayName = $("displayName").value.trim();
    const email = $("email").value.trim();
    const password = $("password").value;
    const password2 = $("password2").value;
    if (!displayName) return showError("formError", "Хэрэглэгчийн нэрээ оруулна уу.");
    if (!email) return showError("formError", "Имэйлээ оруулна уу.");
    if (password.length < 8) return showError("formError", "Нууц үг доод хэмжээгээр 8 тэмдэгт байх ёстой.");
    if (password !== password2) return showError("formError", "Нууц үг хоёр тэгш байхгүй байна.");
    setLoading($("submitBtn"), true);
    try {
      const data = await signUp({ email, password, displayName });
      setLoading($("submitBtn"), false, "Бүртгүүлэх →");
      if (data && data.session) {
        // имэйл баталгаажуулалт шаардахгүй тохирготой үед шууд нэвтэрнэ
        location.href = "./app.html";
      } else {
        form.classList.add("hidden");
        const box = $("successBox");
        box.classList.remove("hidden");
        box.innerHTML = `<b>Бүртгэл үүсгэлээ!</b><br/> <b>${email}</b> хаяг руу баталгаажуулах имэйл илгээлээ. Имэйлээ баталгаажуулсны дараа нэвтэрнэ үү.`;
      }
    } catch (err) {
      showError("formError", translateError(err));
      setLoading($("submitBtn"), false, "Бүртгүүлэх →");
    }
  });
  $("googleBtn").addEventListener("click", async () => {
    clearError("formError");
    try { await signInWithGoogle(); }
    catch (err) { showError("formError", translateError(err)); }
  });
}

if (page === "reset") {
  renderSetupNotice();
  const form = $("resetForm");
  const newForm = $("newPassForm");

  // Сэргээх холболтоор ирсэн үед шинэ нууц үгийн хэлбэр
  getSession().then((session) => {
    if (session) {
      form.classList.add("hidden");
      newForm.classList.remove("hidden");
      $("resetSub").textContent = "Шинэ нууц үгээ шинэчлэнэ үү";
    }
  }).catch(() => {});

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    clearError("formError");
    const email = $("email").value.trim();
    if (!email) return showError("formError", "Имэйлээ оруулна уу.");
    setLoading($("submitBtn"), true);
    try {
      await sendPasswordReset({ email });
      form.classList.add("hidden");
      const box = $("successBox");
      box.classList.remove("hidden");
      box.innerHTML = `<b>Сэргээх холболт илгээлээ.</b><br/>${email} хаягаа шалгана уу. Холболт хүчинтэй хугацаа дуусвал дахин илгээнэ үү.`;
    } catch (err) {
      showError("formError", translateError(err));
      setLoading($("submitBtn"), false, "Сэргээх холболт илгээх");
    }
  });

  newForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    clearError("formError2");
    const p1 = $("newPassword").value;
    const p2 = $("newPassword2").value;
    if (p1.length < 8) return showError("formError2", "Нууц үг доод хэмжээгээр 8 тэмдэгт байх ёстой.");
    if (p1 !== p2) return showError("formError2", "Нууц үг хоёр тэгш байхгүй байна.");
    setLoading($("savePassBtn"), true);
    try {
      await updatePassword({ password: p1 });
      location.href = "./app.html";
    } catch (err) {
      showError("formError2", translateError(err));
      setLoading($("savePassBtn"), false, "Шинэчлэх →");
    }
  });
}
