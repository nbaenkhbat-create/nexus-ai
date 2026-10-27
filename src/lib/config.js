/**
 * NEXUS — Төслийн тохиргоо.
 * Энэ файлд Supabase-ийн ОЛДСОН (public) мэдээлэл л бичигдэнэ:
 *  - Supabase URL болон anon key нь frontend-д ил байх зориулалттай (RLS хамгаалсан).
 *  - GEMINI API key ЭНД ХЭЗЭЭ Ч бичигдэхгүй. Тэр нь зөвхөн Supabase
 *    Edge Function-ийн нууц түлхүүр (GEMINI_API_KEY) дотор байна.
 *
 * Өөрийн утгаа оруулах: дараах хоёр утгыг `src/lib/config.js` дотор солионо уу.
 */
export const CONFIG = {
  supabaseUrl: "YOUR_SUPABASE_URL",
  supabaseAnonKey: "YOUR_SUPABASE_ANON_KEY",
  appName: "NEXUS",
};

export function isSupabaseConfigured() {
  return (
    typeof CONFIG.supabaseUrl === "string" &&
    /^https:\/\/[^\s]+/.test(CONFIG.supabaseUrl) &&
    typeof CONFIG.supabaseAnonKey === "string" &&
    CONFIG.supabaseAnonKey.length > 40 &&
    !CONFIG.supabaseAnonKey.startsWith("YOUR_")
  );
}
