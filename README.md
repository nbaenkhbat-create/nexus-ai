# NEXUS — сурагчийн сэтгэхүйн чадварыг таньж, хөгжүүлэх платформ

NEXUS нь уншиж ойлгох, асуудал шийдвэрлэх, мэдээлэл боловсруулах, бүтээлч сэтгэлгээ
гэсэн дөрвөн суурь чадварыг үнэлж, хөгжүүлэхэд зориулсан веб систем юм.

- **Нүүр хуудас** — системийн танилцуулга
- **15 асуулттай үнэгүй тест** — бүртгэлгүй, шууд үр дүн (албан ёсны Word файлаас авсан асуулт)
- **Сурагчийн dashboard** — тестийн түүх, дасгал, ахицын тайлан, тохиргоо
- **AI чиглүүлэгч** — Google Gemini (зөвхөн Cloud Function-оор дамжуулан)

> **Чухал:** Google Apps Script ашиглаагүй. `GEMINI_API_KEY` frontend-д хэзээ ч байхгүй.
> Firebase-ийн Web `apiKey` нь нууц түлхүүр биш, публик таних мэдээлэл юм.

---

## 1. Ашигласан технологи

| Хэсэг | Технологи |
|---|---|
| Frontend | Энгийн HTML + CSS + JavaScript (ES modules, build шаардахгүй) |
| Бүртгэл/нэвтрэлт | **Firebase Authentication** (Email/Password + Google) |
| Database | **Cloud Firestore** + security rules (зөвхөн өөрийн өгөгдөл) |
| Backend / AI | **Firebase Cloud Functions** (callable `gemini`) → Google Gemini API |
| Hosting | GitHub Pages (frontend) — `nbaenkhbat-create/nexus-ai` |
| График | Өөрийн бичсэн SVG компонент (гадаад номгүй) |

**Файлуудын бүтэц**

```
index.html            # нүүр хуудас
test.html             # 15 асуулттай тест + үр дүн
login.html / signup.html / reset.html
app.html              # сурагчийн dashboard (hash-роутер)
assets/               # лого, favicon, logo-loading.mp4
src/styles/           # дизайн систем
src/lib/              # config, асуулт, оноо, өгөгдөл(store), дасгал
src/services/         # firebase, auth, ai
src/components/       # icon, chart, neural canvas
src/pages/            # хуудас бүрийн логик + views/
functions/            # Gemini Cloud Function (server)
firestore.rules       # өгөгдлийн хамгаалалт (RLS-ийн эквивалент)
firestore.indexes.json
firebase.json         # Firestore / Functions / Auth / Hosting тохиргоо
docs/source/          # эх материалууд (Word/Excel)
README.md  .env.example  .gitignore
```

---

## 2. Local орчинд ажиллуулах

```bash
# аль нэгийг:
python -m http.server 8090
npx -y serve -l 8090
```

Дараа нь `http://localhost:8090` нээнэ үү.

- Тохиргоо (`src/lib/config.js`) байвал бүртгэл/нэвтрэлт Firebase-ээс ажиллана.
- Firebase-ийн **Authorized Domains**-д `localhost` байх ёстой (анхдагчаар байдаг).
- Бүртгэлгүй тест өгөх, dashboard-ын дизайн харах (`app.html?preview=1`) нь
  тохиргоогүй ч ажиллана.

---

## 3. Firebase project тохируулах

Танай project: **`perpx-df732`** (config `src/lib/config.js` дотор аль хэдийн байна).

1. [Firebase Console](https://console.firebase.google.com) → төсөлөө сонгоно уу.
2. **Project settings → Your apps → Web app (`</>`)** → SDK config-ийг авч
   `src/lib/config.js` дээрх `FIREBASE_CONFIG`-тэй тулгана (одоогоор таарч байвал юу ч өөрчлөхгүй).
3. **Authentication → Get started** → Provider-үүдээ идэвхжүүлнэ:
   - **Email/Password** → Enable → Save
   - **Google** → Enable → дэмжих имэйлээ сонгоод Save
4. **Authentication → Settings → Authorized domains** хэсэгт нэмнэ:
   - `localhost` (мэдээж байх ёстой)
   - `nbaenkhbat-create.github.io` (GitHub Pages хувилбар)
5. **Firestore Database → Create database** → Production mode
   (сүүлийн үе: `Enterprise` edition санал болгодог; хаана байрлахаа сонгоно —
   жишээ нь `nam5` (US)).

> CLI-аар auth тохируулах бол: `firebase.json` дэх `auth` блок ашиглана:
> `npx -y firebase-tools@latest deploy --only auth`

---

## 4. Database бүтэц, rules, индекс

**Firestore collection-ууд:**

| Collection | Баримт | Агуулга |
|---|---|---|
| `profiles` | `{uid}` | display_name, email, created_at |
| `assessments` | auto-id | user_id, kind, overall, rawTotal, maxTotal, skills{}, perQuestion[] |
| `exercise_progress` | `{uid}_{exerciseId}` | user_id, exercise_id, status, score, completed_at |
| `ai_usage_logs` | auto-id | user_id, feature, created_at (зөвхөн function бичнэ) |

**Хамгаалалт** ([firestore.rules](firestore.rules)): хэрэглэгч **зөвхөн өөрийн**
бүх өгөгдлийг унших/бичих боломжтой; `assessments` өөрчлөгдөхгүй (түүх тогтмол);
ID сольж бусдын өгөгдөл харах боломжгүй; бусад бүх зам default-deny.

**Deploy:**

```bash
npx -y firebase-tools@latest login            # анхны удаа
npx -y firebase-tools@latest use perpx-df732
npx -y firebase-tools@latest deploy --only firestore:rules,firestore:indexes
```

Индексүүд ([firestore.indexes.json](firestore.indexes.json)):
`assessments(user_id ASC, completed_at DESC)` ба `ai_usage_logs(user_id ASC, created_at ASC)`.
Индекс боловсруулах хугацаа: хэдэн минут.

---

## 5. Authentication: Google OAuth

1. Firebase Console → **Authentication → Google → Enable** (анхдагч web client
   автоматаар үүснэ).
2. **Authorized domain**-д `nbaenkhbat-create.github.io` нэмсэн байх (§3.4).
3. `firebase.json` дэх `googleSignIn.authorizedRedirectUris`-д нэмэлт хаяг байвал
   `npx -y firebase-tools@latest deploy --only auth` ажиллуулна.

**Нууц үг сэргээх холболт**: Firebase өөрөө `reset.html` руу чиглүүлэхийн тулд
**Authentication → Templates → Password reset → Custom action URL** дээр
`https://nbaenkhbat-create.github.io/nexus-ai/reset.html` бичнэ үү
(local тест: `http://localhost:8090/reset.html`).

---

## 6. Gemini API key — хамгаалалттай тохируулах

1. [Google AI Studio](https://aistudio.google.com/apikey) → API key үүсгэнэ үү.
2. **Хэзээ ч** дараах газарт бичихгүй:
   - `index.html` / ямар ч frontend JS / `src/lib/config.js`
   - localStorage / console
3. Зөвхөн **Cloud Functions Secret** болгон тавина (Cloud Functions **Blaze
   (pay-as-you-go) төлөв** шаардана — нэг удаа upgrade):

```bash
cd functions && npm install && cd ..
npx -y firebase-tools@latest functions:secrets:set GEMINI_API_KEY
# сонголт:
npx -y firebase-tools@latest functions:secrets:set GEMINI_MODEL
npx -y firebase-tools@latest functions:secrets:set AI_DAILY_LIMIT   # анхдагч 30
```

**Environment variables:**

| Нэр | Хаана | Утга |
|---|---|---|
| `GEMINI_API_KEY` | Functions Secret | **нууц** — зөвхөн сервер |
| `GEMINI_MODEL` | Functions Secret (сонголт) | анхдагч `gemini-2.5-flash` |
| `AI_DAILY_LIMIT` | Functions Secret (сонголт) | хэрэглэгч бүрийн өдрийн хязгаар |
| `AI_MAX_TOKENS` | Functions Secret (сонголт) | хариултын урт (анхдагч 900) |

`.env.example`-д эдгээр нэрүүд байна; `.env` файл Git-д орохгүй (`.gitignore`).

---

## 7. Gemini model солих

Анхдагч: `gemini-2.5-flash`. Боломжтой model нэрүүд:
https://ai.google.dev/gemini-api/docs/models

```bash
npx -y firebase-tools@latest functions:secrets:set GEMINI_MODEL=gemini-2.5-pro
npx -y firebase-tools@latest deploy --only functions
```

Model нэрийг кодын олон хэсэгт бичээгүй — зөвхөн нэгэн газар (`GEMINI_MODEL`).

---

## 8. Backend (Cloud Function) deploy

```bash
cd functions && npm install && cd ..
npx -y firebase-tools@latest deploy --only functions
```

Деплой хийсний дараа `app.html` → **AI чиглүүлэгч** хэсгээс шалгана уу.
Function deploy хийгээгүй/алдаатай бол хуудас ойлгомжтой мэдэгдэл + бэлтгэсэн
зөвлөмжөөр хэвийн үргэлжлэнэ — тест/дасгал/хиц нөлөөлөхгүй.

---

## 9. GitHub руу push, GitHub Pages тохируулах

Таны токен бэлэн байгаа тул (`gh` нэвтэрсэн):

```bash
git remote add origin https://github.com/nbaenkhbat-create/nexus-ai.git
git push -u origin main
```

(Эсвэл: `gh repo create nexus-ai --public --source . --push`)

GitHub Pages:
1. Repository → **Settings → Pages**
2. Source: `Deploy from a branch` → branch `main`, folder `/ (root)` → Save.
3. Хэдэн минутын дараа `https://nbaenkhbat-create.github.io/nexus-ai/` ажиллана.
4. Firebase **Authorized domains**-д `nbaenkhbat-create.github.io` нэмсэн байхыг
   дахин шалгана уу (§3.4).

**Санамж:** бүх зам **харьцангуй** (`./src/...`) байх тул repo-н нэрний доор ажиллана.
Эмх замбараагүй зүйл Git-д орохгүй: `.env`, `functions/node_modules`, `.firebase/`
(`.gitignore`-д байна). **Нууц түлхүүр файлд байхгүй.**

---

## 10. Тест ажиллуулах (шийдвэрлэх бүрт шалгах зүйлс)

1. Нүүр хуудас нээгдэж, анхны ороход `logo-loading.mp4` дэлгэцийн хэмжээгээр тоглоно (нэг удаа).
2. Mobile/desktop layout зөв.
3. «Үнэгүй тест эхлэх» → заавар → 15 асуулт → хоосон хариултын шалгалт → refresh дээр сэргээх.
4. Үр дүн: нийт хувь, дөрвөн чадвар, график, тайлбар, «Туршилтын үнэлгээ» шошго.
5. Бүртгэл/нэвтрэлт (имэйл + Google), нууц үг сэргээх.
6. Dashboard: хоосон төлөв («Та хараахан тест өгөөгүй байна»), дараа нь бодит өгөгдөл.
7. Тестийн түүх → дэлгэрэнгүй; бүртгэлгүй үеийн үр дүнг холбох баталгаажуулалт.
8. Дасгал → шалгах → жишээ хариулт → ахицын тайлангаас харагдах.
9. AI чиглүүлэгч: хариулт авах; function байхгүй бол ойлгомжтой мэдэгдэл.
10. Browser console дээр улаан алдаа байхгүй.
11. Network дээр `GEMINI_API_KEY` харагдахгүй (зөвхөн Firebase/Gemini дуудлагууд).
12. Хоёр хэрэглэгчээр ороод бүрэн өөр өөрийн өгөгдөл харах (Firestore rules).

`docs/source/` доторх албан ёсны тестийн Word файл: асуулт, зөв хариулын түлхүүр
(`1-B, 2-B, 3-B, 4-B, 5-C, 6-C, 7-B, 8-C, 9-A, 10-B, 11-C, 12-C`), онооны дүрэм,
рубрик — **бүгд тэндээс шууд хуулагдсан**, солигдоогүй.

---

## 11. Түгээмэл алдаа засах

| Алдаа | Шалтгаан / Засвар |
|---|---|
| `auth/operation-not-allowed` | Firebase Console → Authentication → Providers дээр Email/Google идэвхгүй. |
| `auth/unauthorized-domain` | Authorized domains-д уг домэйн байхгүй (§3.4). |
| `auth/invalid-credential` | Имэйл/нууц үг буруу. |
| `auth/popup-closed-by-user` | Google цонх хаагдсан — дахин оролдоно уу. |
| Rules `permission-denied` буцааж байна | `firestore.rules` deploy хийгээгүй → §4. |
| `failed-precondition` (function) | `GEMINI_API_KEY` secret идэвхгүй → §6. |
| Function байхгүй (`not-found`) | `deploy --only functions` → §8. Blaze төлөв шаардлагатай. |
| `resource-exhausted` (429) | өдрийн AI хязгаар (`AI_DAILY_LIMIT`). |
| Индекс боловсруулах гэж байна | Хэдэн минут хүлээнэ үү; дараа нь дахин ачаална. |
| Шинэчлэл харагдахгүй | Ctrl+F5 (hard reload). |

---

## 12. Хүүхдийн аюулгүй байдал, нууцлал

- Минимал дата: зөвхөн хэрэглэгчийн нэр, имэйл. Овог нэр, регистр, сургууль биш.
- Gemini руу зөвхөн ярилцлага + чадварын хувь дамжина; хувийн мэдээлэл биш.
- Нууц үгийг Firebase Auth хариуцна — өөр database-д plaintext байдлаар хадгалагдахгүй.
- Үнэлгээ «туршилтын урьдчилсан үнэлгээ» — эмнэлзүйн онош биш гэдгийг ил тод дурддаг.
- Бүртгэл устгах: Firebase Console → Authentication → Users (профайл,
  тестүүд, дасгалын явц `on delete` устгалгүй тул тусад нь rules-ийн дагуу устгана —
  шаардлагатай бол Cloud Function-оор багц устгал нэмж болно).

---

NEXUS Баг © 2026 — «Бод. Холбоосыг ол. Ахиц гарга.»
