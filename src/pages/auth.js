/**
 * NEXUS — Бүртгэл/нэвтрэлт хуудсуудын логик (login, signup, reset).
 * Firebase тохируулаагүй үед хуудас "хугарах" биш, тодорхой заавар харуулна.
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
  const raw = e && e.message ? e.message : String(e);
  const m = raw.toLowerCase();
  // --- Firebase Auth кодууд ---
  if (m.includes("auth/invalid-credential") || m.includes("auth/wrong-password") || m.includes("auth/user-not-found") || m.includes("invalid login"))
    return "Имэйл эсвэл нууц үг буруу байна.";
  if (m.includes("auth/email-already-in-use") || m.includes("already registered"))
    return "Энэ имэйл бүртгэлтэй байна — нэвтрэхийг оролдоно уу.";
  if (m.includes("auth/invalid-email")) return "Имэйлийн хэлбэр буруу байна.";
  if (m.includes("auth/weak-password") || m.includes("password"))
    return "Нууц үгийн шаардлага хангахгүй байна (доод хэмжээ 8).";
  if (m.includes("auth/too-many-requests") || m.includes("rate limit") || m.includes("too many"))
    return "Олон удаа оролдлоо. Түр хүлээгээд дахин оролдоно уу.";
  if (m.includes("auth/operation-not-allowed") || m.includes("auth/configuration-not-identified") || m.includes("auth/configuration-not-found"))
    return "Firebase Authentication тохируулаагүй байна — Firebase Console → Authentication → Providers дээр Email/Password (болон Google) provider-ийг идэвхжүүлнэ үү.";
  if (m.includes("auth/unauthorized-domain"))
    return "Энэ вэб хаяг зөвшөөрөгдөөгүй — Firebase Console → Authentication → Settings → Authorized Domains-д нэмнэ үү.";
  if (m.includes("auth/popup-closed-by-user") || m.includes("popup"))
    return "Нэвтрэх цонх хаагдлаа. Дахин оролдоно уу.";
  if (m.includes("auth/requires-recent-login"))
    return "Аюулгүй байдлын шалтгаанаар дахин нэвтэрсний дараа нууц үгээ шинэчилнэ үү.";
  if (m.includes("auth/user-disabled")) return "Энэ бүртгэл идэвхгүй болсон байна.";
  if (m.includes("auth/network-request-failed") || m.includes("failed to fetch") || m.includes("network"))
    return "Интернэт холболт эсвэл Firebase тохиргоог шалгана уу.";
  if (m.includes("email not confirmed")) return "Имэйлээ баталгаажуулаагүй байна. Имэйлээ шалгана уу.";
  return raw || "Алдаа гарлаа. Дахин оролдоно уу.";
}

function renderSetupNotice() {
  const box = $("setupNotice");
  if (!box || configured()) return;
  box.className = "note warn";
  box.style.marginBottom = "18px";
  box.innerHTML = `
    <span>
      <b>Firebase тохируулаагүй байна.</b><br/>
      Бүртгэл, нэвтрэлт ажиллахын тулд:
      <code>src/lib/config.js</code> дээрх <code>FIREBASE_CONFIG</code>
      утгуудыг Firebase Console → Project settings → Your apps-аас авч оруулна уу (README-д алхам бүрээр байна).<br/>
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
      // Firebase бүртгэл үүсгээд шууд нэвтрэх боловч имэйл баталгаажуулалтыг
      // ил тод харуулна (баталгаажуулалтгүй оруулж болох эсэхийг Firebase тохиргоо хянана).
      form.classList.add("hidden");
      const box = $("successBox");
      box.classList.remove("hidden");
      box.innerHTML = `<b>Бүртгэл үүсгэлээ!</b><br/> <b>${email}</b> хаяг руу баталгаажуулах имэйл илгээлээ.
        Имэйлээ баталгаажуулаад нэвтэрнэ үү (баталгаажуулалт шаардаагүй тохиргоо бол доорх товчоор шууд орно).<br/><br/>
        <a class="btn btn-primary" href="./app.html">Dashboard руу үргэлжлүүлэх →</a>`;
      return;
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
