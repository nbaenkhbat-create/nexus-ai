/**
 * NEXUS — Оноо тооцох дүрэм.
 *
 * Зөвхөн тодорхой, урьдчилан тогтоогдсон JavaScript дүрмээр тооцоолно.
 * AI ашиглан зөв хариултыг дур мэдэн шийдүүлдэггүй.
 *
 * Эх сурвалж (Word файлын «ҮР ДҮНГ ТООЦОХ ЗААВАР» хэсэг):
 *  - Уншиж ойлгох        : 1–4   , дээд 4 , хувь = оноо ÷ 4 × 100
 *  - Асуудал шийдвэрлэх  : 5–8   , дээд 4 , хувь = оноо ÷ 4 × 100
 *  - Мэдээлэл боловсруулах: 9–12 , дээд 4 , хувь = оноо ÷ 4 × 100
 *  - Бүтээлч сэтгэлгээ    : 13–15 , дээд 6 , хувь = оноо ÷ 6 × 100
 *  - Зөв хариултын түлхүүр: 1-B, 2-B, 3-B, 4-B, 5-C, 6-C, 7-B, 8-C, 9-A, 10-B, 11-C, 12-C
 *  - Бүтээлч хариулт: 0–2 рубрик (0 = хариултгүй/холбоогүй, 1 = холбоотой санаа байгаа ч
 *    тайлбар/алхам дутуу, 2 = шууд холбоотой, хэрэгжүүлж болох + шалтгаан/алхам тайлбарласан)
 */
import { SKILLS, SKILL_ORDER } from "./questions.js";

export const LEVELS = [
  { max: 39, name: "Эхний сууриа бэхжүүлэх үе", tip: "Хялбар, алхамчилсан дасгал" },
  { max: 69, name: "Хөгжиж буй үе", tip: "Дунд түвшний дасгал, бодлоо тайлбарлах" },
  { max: 100, name: "Одоогоор сайн эзэмшсэн шинжтэй", tip: "Илүү сорилттой, олон алхамт даалгавар" },
];

export function levelFor(pct) {
  return LEVELS.find((l) => pct <= l.max) || LEVELS[LEVELS.length - 1];
}

/** Нэг асуултын оноо */
export function gradeQuestion(q, answer) {
  if (q.type === "mc") {
    if (!answer) return 0;
    return String(answer).trim().toUpperCase() === q.answer ? 1 : 0;
  }
  return gradeOpenAnswer(answer);
}

/**
 * Нээлттэй (бичсэн) хариултын рубрик → 0/1/2.
 * Дүрэм тодорхой, тогтмол: текстийн урт, өгүүлбэрийн тоо, тайлбарлагч нэр томъёо.
 */
export function gradeOpenAnswer(answer) {
  const text = (answer || "").trim();
  if (!text) return 0;
  const chars = text.replace(/\s+/g, " ").length;
  if (chars < 12) return 0; // хэт богино — асуудалтай холбоогүй гэж үзнэ

  const sentences = text.split(/[.!?]+/).map((s) => s.trim()).filter((s) => s.length > 3);
  // тайлбар/алхам илэрхийлэх нэр томъёо (рубрикийн "шалтгаан эсвэл алхмаа тайлбарласан")
  const explainSignals = [
    "яагаад", "учир", "учраас", "учир нь", "тэгээд", "дараа нь", "эхлээд", "алхам",
    "туршиж", "ажиллуулж", "хэрэгжүүл", "жишээ нь", "мөн ", "түүнээс", "түүнийг",
    "учраас", "гэвэл", "бол", "тэгэхээр", "үр дүнтэй", "учир шалтгаан", "байлгах",
  ];
  const lower = " " + text.toLowerCase() + " ";
  const hasSignal = explainSignals.some((s) => lower.includes(s));

  const longEnough = chars >= 90;
  const multiSentence = sentences.length >= 2;

  if (longEnough && (hasSignal || multiSentence)) return 2; // тайлбарласан, хэрэгжүүлэх боломжтой
  if (hasSignal && chars >= 45 && multiSentence) return 2;
  return 1; // холбоотой санаа байгаа ч тайлбар/алхам дутуу
}

/** Бүтэн тестийн үр дүн */
export function scoreTest(questions, answers) {
  const skills = {};
  for (const key of SKILL_ORDER) {
    skills[key] = { raw: 0, max: SKILLS[key].max, pct: 0, level: null, tip: null };
  }

  const perQuestion = [];
  for (const q of questions) {
    const ans = answers[q.id];
    const pts = gradeQuestion(q, ans);
    perQuestion.push({ id: q.id, skill: q.skill, pts, max: q.type === "mc" ? 1 : 2, given: ans ?? null });
    const s = skills[q.skill];
    if (s) s.raw += pts;
  }

  let rawTotal = 0, maxTotal = 0;
  for (const key of SKILL_ORDER) {
    const s = skills[key];
    s.pct = Math.round((s.raw / s.max) * 100);
    const lvl = levelFor(s.pct);
    s.level = lvl.name;
    s.tip = lvl.tip;
    rawTotal += s.raw;
    maxTotal += s.max;
  }

  // Нийт хувь = дөрвөн чадварын хувийн дундаж (тэгш жин)
  const overall = Math.round(SKILL_ORDER.reduce((a, k) => a + skills[k].pct, 0) / SKILL_ORDER.length);

  return {
    skills,
    perQuestion,
    rawTotal,
    maxTotal,
    overall,
    overallLevel: levelFor(overall),
    testedAt: new Date().toISOString(),
  };
}
