/**
 * Supabase холболтын давуу-түрүүлгэ.
 * - Анхны импорт нь зөвхөн хэрэглэгч бүртгүүлэх/нууц үг гэх мэт функцээр дамждаг.
 * - supabase-js CDN-ээс авч байна (GitHub Pages дээр ажиллахын тулд build шаардахгүй).
 * - Тохируулаагүй үед бүх функц null/ false буцаана — хуудсууд шууд алдаа гаргахгүй.
 */
import { CONFIG, isSupabaseConfigured } from "../lib/config.js";

const CDN = "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";
let clientPromise = null;

export function configured() {
  return isSupabaseConfigured();
}

export async function getClient() {
  if (!isSupabaseConfigured()) return null;
  if (!clientPromise) {
    clientPromise = import(CDN)
      .then(({ createClient }) =>
        createClient(CONFIG.supabaseUrl, CONFIG.supabaseAnonKey, {
          auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
        })
      )
      .catch((e) => {
        clientPromise = null;
        throw e;
      });
  }
  return clientPromise;
}
