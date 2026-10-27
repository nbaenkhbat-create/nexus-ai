/**
 * NEXUS — Firebase холболтын давуу-түрүүлгэ.
 * - Firebase JS SDK v13 (gstatic CDN — build шаардахгүй, GitHub Pages-д шууд ажиллана).
 * - Нэг удаа import хийгээд дараагийн бүх функц дахин ачаалахгүй.
 * - Тохируулаагүй бол null буцаана (хуудсууд шууд хугарахгүй).
 */
import { FIREBASE_CONFIG, isConfigured } from "../lib/config.js";

const V = "13.1.0";
const BASE = `https://www.gstatic.com/firebasejs/${V}`;
let p = null;

export function configured() {
  return isConfigured();
}

export async function getFirebase() {
  if (!isConfigured()) return null;
  if (!p) {
    p = (async () => {
      const [{ initializeApp, getApps }, { getAuth }, { getFirestore }, { getFunctions }] =
        await Promise.all([
          import(`${BASE}/firebase-app.js`),
          import(`${BASE}/firebase-auth.js`),
          import(`${BASE}/firebase-firestore.js`),
          import(`${BASE}/firebase-functions.js`),
        ]);
      const app = getApps().length ? getApps()[0] : initializeApp(FIREBASE_CONFIG);
      return { app, auth: getAuth(app), db: getFirestore(app), fns: getFunctions(app) };
    })().catch((e) => {
      p = null;
      throw e;
    });
  }
  return p;
}
