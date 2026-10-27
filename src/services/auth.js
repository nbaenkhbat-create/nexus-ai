/**
 * NEXUS — Бүртгэл / нэвтрэлт (Firebase Authentication).
 *  - Имэйл бүртгэл + баталгаажуулах имэйл
 *  - Google OAuth (Firebase Console дээр Provider идэвх шаардана — README)
 *  - Нууц үг сэргээх / шинэчлэх, нэр шинэчлэх
 * Нууц үгийг өөрийн database-д хэзээ ч plaintext байдлаар хадгалдаггүй —
 * бүх нэвтрэлтийг Firebase Auth хариуцна.
 */
import { configured, getFirebase } from "./firebase.js";

export { configured };

/** Firebase User-ийг хуучин хэвийн хэлбэртэй тааруулсан дүрээр буцаана */
function shape(user) {
  if (!user) return null;
  return {
    user: {
      uid: user.uid,
      email: user.email || "",
      emailVerified: !!user.emailVerified,
      user_metadata: { display_name: user.displayName || "" },
      created_at: user.metadata?.creationTime || null,
    },
  };
}

export async function getSession() {
  const fb = await getFirebase();
  if (!fb) return null;
  return shape(fb.auth.currentUser);
}

export async function getUser() {
  const s = await getSession();
  return s ? s.user : null;
}

export async function signUp({ email, password, displayName }) {
  const fb = await getFirebase();
  if (!fb) throw new Error("Firebase тохируулаагүй байна.");
  const { createUserWithEmailAndPassword, updateProfile, sendEmailVerification } = await import(
    "https://www.gstatic.com/firebasejs/13.1.0/firebase-auth.js"
  );
  const { doc, setDoc, serverTimestamp } = await import(
    "https://www.gstatic.com/firebasejs/13.1.0/firebase-firestore.js"
  );

  const cred = await createUserWithEmailAndPassword(fb.auth, email, password);
  await updateProfile(cred.user, { displayName });
  // Firestore дээрх хэрэглэгчийн профайл
  await setDoc(
    doc(fb.db, "profiles", cred.user.uid),
    { display_name: displayName, email, created_at: serverTimestamp() },
    { merge: true }
  );
  try { await sendEmailVerification(cred.user); } catch (_) { /* имэйл илгээх боломжгүй үед ч бүртгэл үүснэ */ }
  return { session: shape(cred.user) };
}

export async function signInWithEmail({ email, password }) {
  const fb = await getFirebase();
  if (!fb) throw new Error("Firebase тохируулаагүй байна.");
  const { signInWithEmailAndPassword } = await import(
    "https://www.gstatic.com/firebasejs/13.1.0/firebase-auth.js"
  );
  const cred = await signInWithEmailAndPassword(fb.auth, email, password);
  ensureProfile(cred.user);
  return { session: shape(cred.user) };
}

export async function signInWithGoogle() {
  const fb = await getFirebase();
  if (!fb) throw new Error("Firebase тохируулаагүй байна.");
  const { signInWithPopup, GoogleAuthProvider } = await import(
    "https://www.gstatic.com/firebasejs/13.1.0/firebase-auth.js"
  );
  const cred = await signInWithPopup(fb.auth, new GoogleAuthProvider());
  ensureProfile(cred.user);
}

export async function signOut() {
  const fb = await getFirebase();
  if (!fb) return;
  const { signOut: fbSignOut } = await import(
    "https://www.gstatic.com/firebasejs/13.1.0/firebase-auth.js"
  );
  await fbSignOut(fb.auth);
}

export async function sendPasswordReset({ email }) {
  const fb = await getFirebase();
  if (!fb) throw new Error("Firebase тохируулаагүй байна.");
  const { sendPasswordResetEmail } = await import(
    "https://www.gstatic.com/firebasejs/13.1.0/firebase-auth.js"
  );
  await sendPasswordResetEmail(fb.auth, email);
}

export async function updatePassword({ password }) {
  const fb = await getFirebase();
  if (!fb) throw new Error("Firebase тохируулаагүй байна.");
  const { updatePassword: fbUpdate, currentUser } = await import(
    "https://www.gstatic.com/firebasejs/13.1.0/firebase-auth.js"
  );
  if (!currentUser) throw new Error("Нэвтрээгүй байна.");
  await fbUpdate(currentUser, password);
}

export async function updateDisplayName({ displayName }) {
  const fb = await getFirebase();
  if (!fb) throw new Error("Firebase тохируулаагүй байна.");
  const { updateProfile, currentUser } = await import(
    "https://www.gstatic.com/firebasejs/13.1.0/firebase-auth.js"
  );
  const { doc, setDoc } = await import(
    "https://www.gstatic.com/firebasejs/13.1.0/firebase-firestore.js"
  );
  if (!currentUser) throw new Error("Нэвтрээгүй байна.");
  await updateProfile(currentUser, { displayName });
  await setDoc(doc(fb.db, "profiles", currentUser.uid), { display_name: displayName }, { merge: true });
}

export async function onAuthChange(cb) {
  try {
    const fb = await getFirebase();
    if (!fb) return cb(null);
    const { onAuthStateChanged } = await import(
      "https://www.gstatic.com/firebasejs/13.1.0/firebase-auth.js"
    );
    onAuthStateChanged(fb.auth, (user) => cb(shape(user)));
  } catch (_) {
    cb(null);
  }
}

/** Анхны нэвтрэлт/бүртгэл дээр профайл байхгүй бол үүсгэх (fire-and-forget) */
async function ensureProfile(user) {
  try {
    if (!user) return;
    const fb = await getFirebase();
    const { doc, getDoc, setDoc, serverTimestamp } = await import(
      "https://www.gstatic.com/firebasejs/13.1.0/firebase-firestore.js"
    );
    const ref = doc(fb.db, "profiles", user.uid);
    const snap = await getDoc(ref);
    if (!snap.exists()) {
      await setDoc(ref, {
        display_name: user.displayName || user.email?.split("@")[0] || "Сурагч",
        email: user.email || "",
        created_at: serverTimestamp(),
      });
    }
  } catch (_) {
    /* профайл үүсэхгүй ч нэвтрэлт саатахгүй */
  }
}
