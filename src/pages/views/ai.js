/** NEXUS Dashboard — AI чиглүүлэгч (Socratic хэв маяг, Mongol хэл). */
import { icon } from "../../components/icons.js";
import { listTestResults } from "../../lib/store.js";
import { SKILLS, SKILL_ORDER } from "../../lib/questions.js";
import { askAI, aiStatus, describeAiError, FALLBACK_TIPS } from "../../services/ai.js";

const WELCOME = `Би таны NEXUS-ийн AI чиглүүлэгч.

• Тестийн үр дүнгээ ойлгохгүй байвал асуугаарай.
• Би шууд хариу бичихээс илүү асуултаар чиглүүлж, өөрөө олоход тусална уу.
• Монгол хэлээр хариулна.

Юунаас эхлэх вэ?`;

export async function renderAI(ctx) {
  const { root, banner, user, toast } = ctx;
  const status = aiStatus();
  const tests = await listTestResults().catch(() => []);
  const latest = tests[0] || null;

  const context = latest
    ? {
        displayName: user.displayName,
        overall: latest.overall,
        skills: SKILL_ORDER.map((k) => `${SKILLS[k].name}: ${latest.skills?.[k]?.pct ?? 0}%`).join(", "),
      }
    : { displayName: user.displayName, topic: "тест өгөөгүй" };

  const offline = !status.available;

  root.innerHTML = `
    ${banner}
    <div class="page-head">
      <div>
        <h1>AI чиглүүлэгч</h1>
        <p>Шууд хариу биш — бодоход чиглүүлдэг Сократ аргын ярилцлага.</p>
      </div>
    </div>

    ${
      offline
        ? `<div class="note warn" style="margin-bottom:16px;">${icon("alert")}
             <span><b>AI чиглүүлэгч одоогоор ажиллахгүй байна.</b> ${describeAiError(status.code)}
             Доорх бэлтгэсэн зөвлөмжүүдийг ашиглаж болно — тест, дасгал, ахицын бүх хэсэг хэвийн ажиллаж байна.</span>
           </div>`
        : ""
    }

    <div class="card chat-wrap">
      <div class="chat-log" id="chatLog">
        <div class="msg ai">${escapeText(WELCOME)}</div>
        ${
          offline
            ? `<div class="msg ai" style="border-style: dashed;">
                 <b>Бэлтгэсэн зөвлөмжүүд:</b>\n${FALLBACK_TIPS.map((t) => "• " + escapeText(t)).join("\n")}
               </div>`
            : ""
        }
      </div>
      ${
        offline
          ? `<div class="chat-input"><input id="chatInput" placeholder="AI түр ажиллахгүй байна..." disabled />
             <button class="btn btn-primary" disabled>Илгээх</button></div>`
          : `<div class="quick-prompts" id="quickPrompts">
               <button data-p="Миний сүүлийн тестийн үр дүнг тайлбарлаад өгөөч.">Үр дүнг тайлбарла</button>
               <button data-p="Хамгийн сул чадвартаа ямар дасгал хийх вэ?">Ямар дасгал хийх вэ?</button>
               <button data-p="Би яагаад алдаа гаргаж байгаагаа ойлгохгүй байна. Туслаач.">Алдаагаа ойлгох</button>
             </div>
             <div class="chat-input">
               <input id="chatInput" placeholder="Асуултаа бичнэ үү..." maxlength="2000" />
               <button class="btn btn-primary" id="sendBtn">Илгээх ${icon("send")}</button>
             </div>`
        }
    </div>`;

  if (offline) return;

  const log = root.querySelector("#chatLog");
  const input = root.querySelector("#chatInput");
  const sendBtn = root.querySelector("#sendBtn");
  const history = [{ role: "user", content: "Чи NEXUS-ийн монгол хэлний AI чиглүүлэгч. Шууд хариу биш, асуултаар чиглүүл." }];

  function addMsg(cls, text) {
    const d = document.createElement("div");
    d.className = "msg " + cls;
    d.textContent = text;
    log.appendChild(d);
    log.scrollTop = log.scrollHeight;
    return d;
  }

  async function send(text) {
    text = (text || "").trim();
    if (!text) return;
    input.value = "";
    addMsg("user", text);
    history.push({ role: "user", content: text });

    const typing = addMsg("ai typing", "Бодож байна...");
    sendBtn.disabled = true;
    try {
      const reply = await askAI({ messages: history, context });
      typing.remove();
      addMsg("ai", reply);
      history.push({ role: "assistant", content: reply });
    } catch (e) {
      typing.remove();
      const msg = describeAiError(e?.code || "unavailable");
      addMsg("ai", msg + "\n\nЗөвлөмж:\n" + FALLBACK_TIPS.slice(0, 2).map((t) => "• " + t).join("\n"));
      if (e?.code === "rate_limited") toast(msg, "err");
    } finally {
      sendBtn.disabled = false;
      input.focus();
    }
  }

  sendBtn.addEventListener("click", () => send(input.value));
  input.addEventListener("keydown", (e) => { if (e.key === "Enter") send(input.value); });
  root.querySelector("#quickPrompts").addEventListener("click", (e) => {
    const b = e.target.closest("[data-p]");
    if (b) send(b.dataset.p);
  });
}

function escapeText(s) {
  return String(s).replaceAll("<", "&" + "lt;").replaceAll(">", "&" + "gt;");
}
