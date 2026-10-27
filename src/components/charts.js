/**
 * NEXUS — SVG график компонентууд (гадаад номгүй).
 *  - radarChart : дөрвөн суурь чадварын сүлжээ график (сургалтын screenshot загвар)
 *  - donutChart : нийт хувийн тойм дарагдсан хэсэг
 *  - lineChart  : ахицын цаг хугацааны хэв
 *  - barsHTML   : энгийн хүснэгтэд бар
 */

const NS = "http://www.w3.org/2000/svg";

function el(name, attrs = {}) {
  const n = document.createElementNS(NS, name);
  for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, v);
  return n;
}

/** items: [{label, pct, color}] — n хэмжээст radar */
export function radarChart(container, items, { size = 320 } = {}) {
  container.innerHTML = "";
  const c = size / 2;
  const R = size * 0.32;
  const n = items.length;
  const svg = el("svg", { viewBox: `0 0 ${size} ${size}`, width: "100%", height: "100%" });

  const angle = (i) => (Math.PI * 2 * i) / n - Math.PI / 2;
  const pt = (i, r) => [c + Math.cos(angle(i)) * r, c + Math.sin(angle(i)) * r];

  // түвшлийн тоймууд (25/50/75/100)
  for (const f of [0.25, 0.5, 0.75, 1]) {
    const pts = items.map((_, i) => pt(i, R * f).join(",")).join(" ");
    svg.appendChild(el("polygon", {
      points: pts, fill: "none",
      stroke: f === 1 ? "rgba(120,160,255,0.4)" : "rgba(120,160,255,0.16)",
      "stroke-width": 1,
    }));
  }
  // тэнхэрлүүд
  items.forEach((_, i) => {
    const [x, y] = pt(i, R);
    svg.appendChild(el("line", { x1: c, y1: c, x2: x, y2: y, stroke: "rgba(120,160,255,0.2)", "stroke-width": 1 }));
  });

  // утгын олон өнцөг
  const dataPts = items.map((it, i) => pt(i, R * Math.max(0.04, (it.pct || 0) / 100)));
  const gradId = "rg" + Math.random().toString(36).slice(2, 8);
  const defs = el("defs");
  const lg = el("linearGradient", { id: gradId, x1: "0%", y1: "0%", x2: "100%", y2: "100%" });
  lg.appendChild(el("stop", { offset: "0%", "stop-color": "#38bdf8" }));
  lg.appendChild(el("stop", { offset: "100%", "stop-color": "#a855f7" }));
  defs.appendChild(lg);
  svg.appendChild(defs);

  svg.appendChild(el("polygon", {
    points: dataPts.map((p) => p.join(",")).join(" "),
    fill: `url(#${gradId})`, "fill-opacity": 0.45,
    stroke: "#7dd3fc", "stroke-width": 2,
  }));
  dataPts.forEach(([x, y], i) => {
    svg.appendChild(el("circle", { cx: x, cy: y, r: 4, fill: items[i].color || "#7dd3fc", stroke: "#04102e", "stroke-width": 1.5 }));
  });

  // гарчиг + утга
  items.forEach((it, i) => {
    const [lx, ly] = pt(i, R + 30);
    const t1 = el("text", {
      x: lx, y: ly - 4, "text-anchor": "middle", class: "radar-label",
    });
    t1.textContent = shortLabel(it.label);
    const t2 = el("text", { x: lx, y: ly + 12, "text-anchor": "middle", class: "radar-value" });
    t2.textContent = (it.pct ?? 0) + "%";
    svg.appendChild(t1);
    svg.appendChild(t2);
  });

  container.appendChild(svg);
}

function shortLabel(label) {
  const map = {
    reading: "Уншиж ойлгох",
    problem: "Асуудал шийдвэрлэх",
    info: "Мэдээ боловсруулах",
    creative: "Бүтээлч сэтгэлгээ",
  };
  return map[label] || label;
}

/** donut: 0..100 */
export function donutChart(container, pct, { size = 190, stroke = 14 } = {}) {
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const val = Math.max(0, Math.min(100, pct || 0));
  container.innerHTML = `
    <svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
      <defs>
        <linearGradient id="dg${size}" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#22d3ee"/>
          <stop offset="55%" stop-color="#6366f1"/>
          <stop offset="100%" stop-color="#a855f7"/>
        </linearGradient>
      </defs>
      <circle cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none"
        stroke="rgba(255,255,255,0.08)" stroke-width="${stroke}"/>
      <circle cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none"
        stroke="url(#dg${size})" stroke-width="${stroke}" stroke-linecap="round"
        stroke-dasharray="${circ}" stroke-dashoffset="${circ * (1 - val / 100)}"
        transform="rotate(-90 ${size / 2} ${size / 2})"
        style="transition: stroke-dashoffset 1s ease;"/>
    </svg>`;
}

/** series: [{name, color, values:[{label, value}]}] — энгийн олон шугамт график */
export function lineChart(container, series, { height = 220 } = {}) {
  const width = 640;
  const padL = 36, padB = 28, padT = 16, padR = 12;
  const all = series.flatMap((s) => s.values.map((v) => v.value));
  const maxV = Math.max(100, ...all);
  const labels = series[0]?.values.map((v) => v.label) || [];
  const nPts = labels.length;

  const x = (i) => padL + (i * (width - padL - padR)) / Math.max(1, nPts - 1);
  const y = (v) => padT + (1 - v / maxV) * (height - padT - padB);

  let svg = `<svg viewBox="0 0 ${width} ${height}" width="100%" height="${height}" preserveAspectRatio="none">`;
  for (let g = 0; g <= 4; g++) {
    const gv = (maxV / 4) * g;
    svg += `<line x1="${padL}" y1="${y(gv)}" x2="${width - padR}" y2="${y(gv)}" stroke="rgba(120,160,255,0.14)"/>`;
    svg += `<text x="${padL - 8}" y="${y(gv) + 4}" text-anchor="end" class="radar-label">${Math.round(gv)}</text>`;
  }
  labels.forEach((lb, i) => {
    if (nPts <= 8 || i % Math.ceil(nPts / 8) === 0) {
      svg += `<text x="${x(i)}" y="${height - 8}" text-anchor="middle" class="radar-label">${lb}</text>`;
    }
  });
  for (const s of series) {
    const pts = s.values.map((v, i) => `${x(i)},${y(v.value)}`).join(" ");
    svg += `<polyline points="${pts}" fill="none" stroke="${s.color}" stroke-width="2.4" stroke-linejoin="round" stroke-linecap="round"/>`;
    s.values.forEach((v, i) => {
      svg += `<circle cx="${x(i)}" cy="${y(v.value)}" r="3.6" fill="${s.color}" stroke="#04102e" stroke-width="1.4"><title>${s.name}: ${v.value}%</title></circle>`;
    });
  }
  svg += "</svg>";
  container.innerHTML = svg;
}
