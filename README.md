# NEXUS — сурагчийн сэтгэхүйн чадварыг таньж, хөгжүүлэх платформ

NEXUS нь уншиж ойлгох, асуудал шийдвэрлэх, мэдээлэл боловсруулах, бүтээлч сэтгэлгээ
гэсэн дөрвөн суурь чадварыг үнэлж, хөгжүүлэхэд зориулсан веб систем юм.

- **Нүүр хуудас** — системийн танилцуулга
- **15 асуулттай үнэгүй тест** — бүртгэлгүй, шууд үр дүн (албан ёсны Word файлаас авсан асуулт)
- **Сурагчийн dashboard** — тестийн түүх, дасгал, ахицын тайлан, тохиргоо
- **AI чиглүүлэгч** — Google Gemini (зөвхөн серверээр дамжуулан)

> **Чухал:** Google Apps Script ашиглаагүй. API түлхүүр frontend-д ил байхгүй.

---

## 1. Ашигласан технологи

| Хэсэг | Технологи |
|---|---|
| Frontend | Энгийн HTML + CSS + JavaScript (ES modules, build шаардахгүй) |
| Бүртгэл/нэвтрэлт | Supabase Auth (Email + Google OAuth) |
| Database | Supabase PostgreSQL + **Row Level Security (RLS)** |
| Backend / AI | Supabase Edge Function → Google Gemini API |
| Hosting | GitHub Pages (frontend), Supabase (backend + database) |
| График | Өөрийн бичсэн SVG компонент (гадаад номгүй) |

**Файлуудын бүтэц**

```
index.html            # нүүр хуудас
test.html             # 15 асуулттай тест + үр дүн
login.html / signup.html / reset.html
app.html              # сурагчийн dashboard (hash-роутер)
assets/               # лого, favicon, logo-loading.mp4
src/styles/           # дизайн систем
src/lib/              # config, асуулт, оноо, өгөгдөл, дасгал
src/services/         # supabase, auth, ai
src/components/       # icon, chart, neural canvas
src/pages/            # хуудас бүрийн логик + views/
supabase/migrations/  # database бүтэц + RLS
supabase/functions/gemini/  # Gemini Edge Function
docs/source/          # эх материалууд (Word/Excel)
README.md  .env.example  .gitignore
```

---

## 2. Local орчинд ажиллуулах

Эхлээд ямар нэг static server ашиглана уу (ES modules-д шаардлагатай):

```bash
# аль нэгийг:
python -m http.server 8080
npx -y serve -l 8080
```

Дараа нь `http://localhost:8080` нээнэ үү.

- **Бүртгэл/тохиргоо хийхээс өмнө** ч тест өгөх, үр дүн харах, dashboard-ын
  дизайн харах (`app.html?preview=1`) боломжтой.
- Supabase тохируулсны дараа бүрэн урсгал (бүртгэл → тест → түүх → дасгал → AI) ажиллана.

---

## 3. Supabase project үүсгэх

1. [supabase.com](https://supabase.com) → **New project** үүсгэнэ үү.
2. **Project Settings → API** дээрээ дараах утгуудыг авна:
   - `Project URL`
   - `anon public` key
3. Үүнийг `src/lib/config.js` дотор бичнэ үү:

```js
export const CONFIG = {
  supabaseUrl: "https://xxxxxx.supabase.co",
  supabaseAnonKey: "eyJhbGciOi...",
  appName: "NEXUS",
};
```

> `anon key` нь **publication түлхүүр** бөгөөд RLS-тэй хамт frontend-д зориулж
> зөвхөн унших эрхээр хязгаарлагдана. Нууц үг, service role key-г хэзээ ч
> энд бичихгүй (`.env` ба Supabase Secret хадгална).

---

## 4. Database бүтэц болон migration

Сонголт А — **CLI**:

```bash
npx -y supabase login
npx -y supabase link --project-ref XXXXXXXX
npx -y supabase db push
```

Сонголт Б — **SQL Editor**: Supabase Dashboard → SQL Editor →
[`supabase/migrations/0001_init.sql`](supabase/migrations/0001_init.sql)-ийн агуулгыг
хуулаад **Run** дарна уу.

Үүсэх хүснэгтүүд: `profiles`, `assessments`, `assessment_answers`,
`skill_results`, `exercises`, `exercise_progress`, `ai_usage_logs`.

RLS бодитоор идэвхжсэн: хэрэглэгч **зөвхөн өөрийн** тест, хариулт, дасгалын
явцыг унших/засах боломжтой; ID сольж бусдын өгөгдөл харах боломжгүй.
`exercises` хүснэгтийг зөвхөн админ (SQL/сэрвис-рүү) бичнэ.

---

## 5. Authentication тохируулах

**Имэйл бүртгэл** — аль хэдийн идэвхтэй байна:
Authentication → Providers → **Email** → `Enable` + `Confirm email` сонголт.

**Google OAuth (сонголттой)** — бодит тохиргоо шаардлагатай:

1. [Google Cloud Console](https://console.cloud.google.com) → **OAuth consent screen** → **Credentials → Create OAuth client ID (Web application)**.
2. Authorized redirect URI рүү Supabase-ийн callback-ийг нэмнэ:
   `https://XXXX.supabase.co/auth/v1/callback`
3. Supabase → Authentication → Providers → **Google** → Enable →
   `Client ID`, `Client Secret`-ийг оруулна.
4. Authentication → URL Configuration → **Site URL** болон **Redirect URLs**-д
   хэрэглэх хаягаа нэмнэ (жишээ: `https://<user>.github.io/<repo>/app.html`,
   мөн local `http://localhost:8080/app.html`).

> Google тохируулаагүй байхад товч ажиллаж чадахгүй — тухайн үед систем
> «Google Provider идэвхгүй» гэсэн ойлгомжтой мэдэгдэл харуулна (хуурамч ажиллагаа үгүй).

**Нууц үг сэргээх холболт**: Authentication → URL Configuration →
Redirect URLs-д `https://<user>.github.io/<repo>/reset.html` нэмнэ үү.

---

## 6. Gemini API key авах, хамгаалалттай тохируулах

1. [Google AI Studio](https://aistudio.google.com/apikey) → API key үүсгэнэ үү.
2. **Хэзээ ч** энэ түлхүүрийг дараах газарт бичихгүй:
   - `index.html` / ямар ч frontend JS
   - GitHub repository
   - localStorage / console
3. Зөвхөн Supabase Secret болгон тавина:

```bash
npx -y supabase secrets set GEMINI_API_KEY=AIza...
```

(Dashboard-аар бол: Project Settings → Edge Functions → Secrets)

**Environment variables:**

| Нэр | хаана | Утга |
|---|---|---|
| `SUPABASE_URL` | `src/lib/config.js` | Project URL (public) |
| `SUPABASE_ANON_KEY` | `src/lib/config.js` | anon key (public, RLS-тэй) |
| `GEMINI_API_KEY` | Supabase Secret | **нууц** — зөвхөн сервер |
| `GEMINI_MODEL` | Supabase Secret (сонголт) | анхдагч `gemini-2.5-flash` |
| `AI_DAILY_LIMIT` | Supabase Secret (сонголт) | хэрэглэгч бүрийн өдрийн хязгаар (анхдагч 30) |
| `AI_MAX_TOKENS` | Supabase Secret (сонголт) | хариултын урт (анхдагч 900) |

`.env.example` файлд эдгээр нэрүүд байна. `.env` файл Git-д орохгүй (`.gitignore`).

---

## 7. Gemini model солих

Анхдагч model: `gemini-2.5-flash`.
Боломжтой model нэрүүдийг албан ёсноос шалгана уу:
https://ai.google.dev/gemini-api/docs/models

Солихдоо:

```bash
npx -y supabase secrets set GEMINI_MODEL=gemini-2.5-pro
```

Model нэрийг кодын олон хэсэгт бичээгүй — зөвхөн нэгэн газар (`GEMINI_MODEL`).

---

## 8. Backend function deploy хийх

```bash
npx -y supabase functions deploy gemini --no-verify-jwt=false
```

> Function өөрөө дахин JWT шалгадаг; холболтын токен шаардана.
> Деплой хийсний дараа `app.html` → **AI чиглүүлэгч** хэсгээс шалгана уу.

Ажиллахгүй бол (жнь. түлхүүр ороогүй) хуудас алдаагаа тодорхой харуулж,
бэлтгэсэн энгийн зөвлөмжөөр үргэлжлүүлнэ — тест/дасгал/хиц нөлөөлөхгүй.

---

## 9. GitHub руу push, GitHub Pages тохируулах

```bash
git init
git add .
git commit -m "NEXUS: нүүр хуудас, тест, dashboard, Supabase backend"
git branch -M main
git remote add origin https://github.com/<user>/<repo>.git
git push -u origin main
```

GitHub Pages:
1. Repository → **Settings → Pages**
2. Source: `Deploy from a branch` → branch `main`, folder `/ (root)` → Save.
3. Хэдэн минутын дараа `https://<user>.github.io/<repo>/` ажиллана.

**Санамж:**
- Бүх зам **харьцангуй** (`./src/...`) байсан тул repo-н нэрний доор ажиллана.
- Supabase Redirect URL-д энэ хаягаа заавал нэмнэ үү.
- Supabase-ийн хувьд хязгаарлалт байж магадгүй — шаардлагатай бол
  localhost болон GitHub Pages хаягийг хоёуланг нь Allow list-д нэмнэ.

---

## 10. Тест ажиллуулах (шийдвэрлэх бүрт шалгах зүйлс)

Эхлээд local server асаагаад дараахыг шалгана уу:

1. Нүүр хуудас нээгдэж, анхны ороход `logo-loading.mp4` fullscreen тоглоно (нэг удаа).
2. Mobile/desktop layout зөв (гэрийн хэмжээг өөрчлөх).
3. «Үнэгүй тест эхлэх» → заавар → 15 асуулт нэг нэгээрээ.
4. Хоосон хариулт → анхааруулга; refresh → явц сэргэнэ.
5. Үр дүн: нийт хувь, дөрвөн чадвар, график, тайлбар, «Туршилтын үнэлгээ» шошго.
6. Бүртгэл/нэвтрэлт (имэйл баталгаажуулалттай).
7. Dashboard: хоосон төлөв («Та хараахан тест өгөөгүй байна»), дараа нь бодит өгөгдөл.
8. Тестийн түүх → дэлгэрэнгүй; бүртгэлгүй үеийн үр дүнг холбох баталгаажуулалт.
9. Дасгал → шалгах → жишээ хариулт → ахицын тайлангаас харагдах.
10. AI чиглүүлэгч: хариулт; түлхүүр байхгүй бол ойлгомжтой мэдэгдэл.
11. Browser console дээр улаан алдаа байхгүй эсэх.
12. Network дээр `GEMINI_API_KEY` харагдахгүй (зөвхөн `/functions/v1/gemini` дуудлага).

`docs/source/` доторх албан ёсны тестийн Word файл: асуулт, зөв хариулын түлхүүр
(`1-B, 2-B, 3-B, 4-B, 5-C, 6-C, 7-B, 8-C, 9-A, 10-B, 11-C, 12-C`), онооны дүрэм,
рубрик — **бүгд тэндээс шууд хуулагдсан**, солигдоогүй.

---

## 11. Түгээмэл алдаа засах

| Алдаа | Шалтгаан / Засвар |
|---|---|
| «Supabase тохируулаагүй байна» | `src/lib/config.js` дээр URL/anon key оруулаагүй. |
| Нэвтрэлтэд «Invalid login credentials» | Имэйл/нууц үг буруу, эсвэл имэйл баталгаажаагүй. |
| Google товч ажиллахгүй | Provider байхгүй → README §5. |
| Сэргээх холболт ирэхгүй | Redirect URL-д `reset.html` нэмээгүй. |
| «429 / хязгаарт хүрлээ» | Өдрийн AI хязгаар (`AI_DAILY_LIMIT`). Маргааш дахин оролдоно. |
| AI «unavailable» | `GEMINI_API_KEY` Secret эсвэл model нэр шалгана уу. |
| Migration дараагийн удаа дахин ажиллавал алдаа | Бүгд `IF NOT EXISTS`/`DROP IF EXISTS` — аюулгүй. |
| GitHub Pages дээр шинэ хуудас 404 | Файлын нэр/зам тэгш байна эсэх; cache. |
| Шинэчлэл харагдахгүй | Ctrl+F5 (hard reload), browser cache. |

---

## 12. Хүүхдийн аюулгүй байдал, нууцлал

- Минимал дата: зөвхөн хэрэглэгчийн нэр, имэйл. Овог нэр, регистр, сургууль биш.
- Gemini руу зөвхөн ярилцлага + чадварын хувь чадвар дамжина; хувийн мэдээлэл биш.
- Үнэлгээ «туршилтын урьдчилсан үнэлгээ» — эмнэлзүйн онош биш гэдгийг дурддаг.
- Бүртгэл устгах: Supabase Dashboard → Authentication → Users (profiles,
  assessments, answers, progress бүгд цуг нь устна — `on delete cascade`).

---

NEXUS Баг © 2026 — «Бод. Холбоосыг ол. Ахиц гарга.»
