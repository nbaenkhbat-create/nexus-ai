/**
 * NEXUS — Өгөгдлийн хадгалалт (localStorage + Cloud Firestore).
 *
 * Дүрэм:
 *  - Бүртгэлгүй тестийн үр дүн зөвхөн төхөөрөмж дээр (localStorage).
 *  - Нэвтэрсэн хэрэглэгчийн өгөгдөл Firestore-д, security rules-ийн дагуу
 *    ЗӨВХӨН ӨӨРИЙНХ нь хадгалагдана (uid шалгалт).
 *  - Бүртгэлгүй үеийн үр дүнг бүртгэлтэй холбохыг хэрэглэгч ЗӨВШӨӨРСӨН ҮЕД Л
 *    uploadPending() дуудагдана.
 *  - Хуурамч, зохиомол өгөгдөл хэзээ ч үүсэхгүй: бичлэггүй бол хоосон жагсаалт.
 *
 * Бүтэц (Firestore):
 *  profiles/{uid}                 {display_name, email, created_at}
 *  assessments/{autoId}           {user_id, kind, overall, rawTotal, maxTotal,
 *                                  skills{}, perQuestion[], completed_at}
 *  exercise_progress/{uid_exId}   {user_id, exercise_id, status, score, completed_at}
 *  ai_usage_logs/{autoId}         {user_id, feature, created_at}  (Function бичнэ)
 */
import { configured, getFirebase } from "../services/firebase.js";

const K = {
  tests: "nexus_tests_v1",
  ex: "nexus_ex_progress_v1",
  guest: "nexus_guest_profile_v1",
  pending: "nexus_pending_upload_v1",
};

function read(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch (_) {
    return fallback;
  }
}
function write(key, val) {
  try {
    localStorage.setItem(key, JSON.stringify(val));
    return true;
  } catch (_) {
    return false;
  }
}

/* ---------- Бүртгэлгүй (зоочин) профайл ---------- */
export function guestProfile() {
  return read(K.guest, { display_name: "Зочин хэрэглэгч" });
}
export function setGuestProfile(p) {
  write(K.guest, { ...guestProfile(), ...p });
}

/* ---------- Тестийн үр дүн: локал ---------- */
export function localListTests() {
  return read(K.tests, []);
}
export function localSaveTest(result) {
  const list = localListTests();
  list.unshift(result);
  write(K.tests, list.slice(0, 100));
  return result;
}
export function localDeleteTest(id) {
  write(K.tests, localListTests().filter((t) => t.id !== id));
}
export function localClearTests() {
  write(K.tests, []);
}

/* ---------- Зошингийн хүлээж буй хадгалалт ---------- */
export function setPendingUpload(result) {
  write(K.pending, result);
}
export function getPendingUpload() {
  return read(K.pending, null);
}
export function clearPendingUpload() {
  write(K.pending, null);
}

/* ---------- Дасгалын явц: локал ---------- */
export function localListExProgress() {
  return read(K.ex, []);
}
export function localSaveExProgress(item) {
  const list = localListExProgress().filter((x) => x.exercise_id !== item.exercise_id);
  list.unshift(item);
  write(K.ex, list);
  return item;
}

/* ---------- Session (Firebase) ---------- */
export async function currentSession() {
  if (!configured()) return null;
  try {
    const fb = await getFirebase();
    return fb && fb.auth.currentUser ? { user: { uid: fb.auth.currentUser.uid } } : null;
  } catch (_) {
    return null;
  }
}

/* ---------- Тестийн үр дүн: Firestore ---------- */
async function cloudSaveTest(session, result) {
  const fb = await getFirebase();
  const uid = session.user.uid;
  const { collection, addDoc, serverTimestamp } = await import(
    "https://www.gstatic.com/firebasejs/13.1.0/firebase-firestore.js"
  );
  const ref = await addDoc(collection(fb.db, "assessments"), {
    user_id: uid,
    kind: result.kind || "quick-15",
    overall: result.overall ?? 0,
    rawTotal: result.rawTotal ?? 0,
    maxTotal: result.maxTotal ?? 0,
    skills: result.skills || {},
    perQuestion: (result.perQuestion || []).map((p) => ({
      id: p.id,
      skill: p.skill,
      pts: p.pts,
      max: p.max,
      given: typeof p.given === "string" ? p.given.slice(0, 4000) : p.given ?? null,
    })),
    completed_at: result.testedAt || new Date().toISOString(),
    created_at: serverTimestamp(),
  });
  return { ...result, id: ref.id, cloud: true };
}

async function cloudListTests(session) {
  const fb = await getFirebase();
  const uid = session.user.uid;
  const { collection, query, where, orderBy, limit, getDocs } = await import(
    "https://www.gstatic.com/firebasejs/13.1.0/firebase-firestore.js"
  );
  // Анхны ачаалалтад composite index бэлэн биш байж магадгүй тул
  // эхлээд зөвхөн user_id-гаар авч, дараа нь төхөөрөмж дээр эрэмбэлнэ.
  let snap;
  try {
    const q = query(
      collection(fb.db, "assessments"),
      where("user_id", "==", uid),
      orderBy("completed_at", "desc"),
      limit(50)
    );
    snap = await getDocs(q);
  } catch (indexErr) {
    // Composite index хараахан үүсээгүй үед: энгийн query + төхөөрөмж дээр эрэмбэлэх
    const q = query(collection(fb.db, "assessments"), where("user_id", "==", uid), limit(50));
    snap = await getDocs(q);
  }
  const rows = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  rows.sort((a, b) => String(b.completed_at || "").localeCompare(String(a.completed_at || "")));
  return rows.map((a) => ({
    id: a.id,
    kind: a.kind,
    overall: a.overall,
    maxTotal: a.maxTotal,
    rawTotal: a.rawTotal,
    testedAt: a.completed_at,
    skills: a.skills || {},
  }));
}

/**
 * Тест дууссаны дараа хадгалах.
 * - Нэвтэрсэн → Firestore (тэр хэрэглэгчийн өгөгдөл).
 * - Бүртгэлгүй → локал + бүртгэлтэй холбох хүлээсийн тэмдэг.
 */
export async function saveTestResult(result) {
  const session = await currentSession();
  if (session) {
    try {
      return await cloudSaveTest(session, result);
    } catch (e) {
      localSaveTest(result);
      throw e;
    }
  }
  localSaveTest(result);
  setPendingUpload(result);
  return result;
}

export async function listTestResults() {
  const session = await currentSession();
  if (session) {
    try {
      return await cloudListTests(session);
    } catch (_) {
      return localListTests();
    }
  }
  return localListTests();
}

/** Бүртгэлгүй үеийн үр дүнг баталгаажуулалттайгаар бүртгэлдээ оруулах */
export async function uploadPending({ confirmConsent }) {
  const pending = getPendingUpload();
  if (!pending) return { uploaded: 0 };
  const session = await currentSession();
  if (!session) return { uploaded: 0, needLogin: true };
  if (!confirmConsent) return { uploaded: 0, needConsent: true };
  await cloudSaveTest(session, pending);
  clearPendingUpload();
  return { uploaded: 1 };
}

/* ---------- Дасгалын явц ---------- */
export async function saveExerciseProgress(item) {
  const session = await currentSession();
  if (session) {
    const fb = await getFirebase();
    const { doc, setDoc, serverTimestamp } = await import(
      "https://www.gstatic.com/firebasejs/13.1.0/firebase-firestore.js"
    );
    const uid = session.user.uid;
    const ref = doc(fb.db, "exercise_progress", `${uid}_${item.exercise_id}`);
    await setDoc(
      ref,
      {
        user_id: uid,
        exercise_id: item.exercise_id,
        status: item.status,
        score: item.score ?? null,
        completed_at: item.completed_at || new Date().toISOString(),
        updated_at: serverTimestamp(),
      },
      { merge: true }
    );
    return item;
  }
  return localSaveExProgress(item);
}

export async function listExerciseProgress() {
  const session = await currentSession();
  if (session) {
    try {
      const fb = await getFirebase();
      const { collection, query, where, getDocs } = await import(
        "https://www.gstatic.com/firebasejs/13.1.0/firebase-firestore.js"
      );
      const q = query(
        collection(fb.db, "exercise_progress"),
        where("user_id", "==", session.user.uid)
      );
      const snap = await getDocs(q);
      return snap.docs.map((d) => d.data());
    } catch (_) {
      return localListExProgress();
    }
  }
  return localListExProgress();
}
