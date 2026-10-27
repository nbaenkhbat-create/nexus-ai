/**
 * NEXUS — Өгөгдлийн хадгалалтын давуу-түрүүлгэ (local + Supabase cloud).
 *
 * Дүрэм:
 *  - Бүртгэлгүй тестийн үр дүн зөвхөн төхөөрөмж дээр (localStorage) хадгалагдана.
 *  - Нэвтэрсэн хэрэглэгчийн өгөгдөл Supabase-д (RLS-тэй) хадгалагдана.
 *  - Бүртгэлгүй үеийн үр дүнг бүртгэлтэй холбохыг хэрэглэгч зөвшөөрсөн үед л хийнэ
 *    (uploadPending() нь тусгайлан баталгаажуулалт асуудаг).
 *  - Хуурамч, зохиомол өгөгдөл хэзээ ч үүсэхгүй: бичлэггүй бол хоосон жагсаалт.
 */
import { configured, getClient } from "../services/supabase.js";

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

/* ---------- Зошингийн хүлээж буй хадгалалт (бүртгэлтэй холболт) ---------- */
export function setPendingUpload(result) {
  write(K.pending, result);
}
export function getPendingUpload() {
  return read(K.pending, null);
}
export function clearPendingUpload() {
  write(K.pending, null);
}

/* ---------- Ахиц (дасгалын явц): локал ---------- */
export function localListExProgress() {
  return read(K.ex, []);
}
export function localSaveExProgress(item) {
  const list = localListExProgress().filter((x) => x.exercise_id !== item.exercise_id);
  list.unshift(item);
  write(K.ex, list);
  return item;
}

/* ---------- Session ---------- */
export async function currentSession() {
  if (!configured()) return null;
  try {
    const sb = await getClient();
    const { data } = await sb.auth.getSession();
    return data.session || null;
  } catch (_) {
    return null;
  }
}

/* ---------- Тестийн үр дүн: cloud ---------- */
async function cloudSaveTest(session, result) {
  const sb = await getClient();
  const uid = session.user.id;
  const { data: assessment, error } = await sb
    .from("assessments")
    .insert({
      user_id: uid,
      assessment_type: result.kind || "quick-15",
      total_score: result.overall,
      max_score: result.maxTotal,
      raw_score: result.rawTotal,
      completed_at: result.testedAt,
    })
    .select()
    .single();
  if (error) throw error;

  const skillRows = Object.entries(result.skills).map(([name, s]) => ({
    assessment_id: assessment.id,
    skill_name: name,
    score: s.pct,
    raw_score: s.raw,
    max_raw: s.max,
    feedback: s.level,
  }));
  const { error: e2 } = await sb.from("skill_results").insert(skillRows);
  if (e2) throw e2;

  const answerRows = (result.perQuestion || []).map((p) => ({
    assessment_id: assessment.id,
    question_id: p.id,
    answer: typeof p.given === "string" ? p.given.slice(0, 4000) : String(p.given ?? ""),
    score: p.pts,
    skill_name: p.skill,
  }));
  if (answerRows.length) {
    const { error: e3 } = await sb.from("assessment_answers").insert(answerRows);
    if (e3) throw e3;
  }
  return { ...result, id: assessment.id, cloud: true };
}

async function cloudListTests(session) {
  const sb = await getClient();
  const { data, error } = await sb
    .from("assessments")
    .select("id, assessment_type, total_score, max_score, raw_score, completed_at, skill_results(*)")
    .order("completed_at", { ascending: false })
    .limit(50);
  if (error) throw error;
  return (data || []).map((a) => ({
    id: a.id,
    kind: a.assessment_type,
    overall: a.total_score,
    maxTotal: a.max_score,
    rawTotal: a.raw_score,
    testedAt: a.completed_at,
    skills: Object.fromEntries(
      (a.skill_results || []).map((s) => [
        s.skill_name,
        { pct: s.score, raw: s.raw_score, max: s.max_raw, level: s.feedback, tip: null },
      ])
    ),
  }));
}

/**
 * Тест дууссаны дараа хадгалах.
 * - Нэвтэрсэн → cloud (тэр хэрэглэгчийн бүртгэлд).
 * - Бүртгэлгүй → локал + бүртгэлтэй холбох хүлээсийн тэмдэг.
 */
export async function saveTestResult(result) {
  const session = await currentSession();
  if (session) {
    try {
      return await cloudSaveTest(session, result);
    } catch (e) {
      // cloud амжилтгүй бол локалд хадгалж үлдэнэ (өгөгдөл алдахгүй)
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
      // cloud саатвал локал хуулбарыг харуулна
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
    const sb = await getClient();
    const { error } = await sb.from("exercise_progress").upsert({
      user_id: session.user.id,
      exercise_id: item.exercise_id,
      status: item.status,
      score: item.score ?? null,
      completed_at: item.completed_at || new Date().toISOString(),
    });
    if (error) throw error;
    return item;
  }
  return localSaveExProgress(item);
}

export async function listExerciseProgress() {
  const session = await currentSession();
  if (session) {
    try {
      const sb = await getClient();
      const { data, error } = await sb.from("exercise_progress").select("*");
      if (error) throw error;
      return data || [];
    } catch (_) {
      return localListExProgress();
    }
  }
  return localListExProgress();
}
