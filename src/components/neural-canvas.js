/**
 * NEXUS — neural network canvas visual.
 * Жинхэнэ canvas дээр ажилладаг анимаци (screenshot зураг ашиглаагүй).
 */
export function mountNeural(canvas, opts = {}) {
  const cfg = { density: opts.density ?? 1, glow: opts.glow ?? 1, speed: opts.speed ?? 0.28 };
  const ctx = canvas.getContext("2d");
  if (!ctx) return () => {};

  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  let w = 0, h = 0, raf = 0, running = true;
  let nodes = [];

  function resize() {
    const rect = canvas.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    w = Math.max(1, rect.width);
    h = Math.max(1, rect.height);
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const count = Math.round(((w * h) / 12000) * cfg.density);
    nodes = Array.from({ length: Math.min(Math.max(count, 18), 90) }, () => ({
      x: Math.random() * w,
      y: Math.random() * h,
      vx: (Math.random() - 0.5) * cfg.speed,
      vy: (Math.random() - 0.5) * cfg.speed,
      r: 1 + Math.random() * 1.8,
      hue: Math.random() < 0.5 ? 195 + Math.random() * 20 : 265 + Math.random() * 30,
    }));
  }

  function draw() {
    ctx.clearRect(0, 0, w, h);

    // төв гэрэлтэлт
    const g = ctx.createRadialGradient(w * 0.55, h * 0.5, 10, w * 0.55, h * 0.5, Math.max(w, h) * 0.55);
    g.addColorStop(0, `rgba(99, 102, 241, ${0.16 * cfg.glow})`);
    g.addColorStop(0.5, `rgba(56, 189, 248, ${0.06 * cfg.glow})`);
    g.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);

    const LINK = 118;
    for (let i = 0; i < nodes.length; i++) {
      const a = nodes[i];
      for (let j = i + 1; j < nodes.length; j++) {
        const b = nodes[j];
        const dx = a.x - b.x, dy = a.y - b.y;
        const d = Math.hypot(dx, dy);
        if (d < LINK) {
          const alpha = (1 - d / LINK) * 0.5;
          ctx.strokeStyle = `rgba(120, 170, 255, ${alpha})`;
          ctx.lineWidth = 0.8;
          ctx.beginPath();
          ctx.moveTo(a.x, a.y);
          ctx.lineTo(b.x, b.y);
          ctx.stroke();
        }
      }
    }

    for (const n of nodes) {
      if (!reduce) {
        n.x += n.vx; n.y += n.vy;
        if (n.x < 0 || n.x > w) n.vx *= -1;
        if (n.y < 0 || n.y > h) n.vy *= -1;
      }
      ctx.beginPath();
      ctx.arc(n.x, n.y, n.r, 0, Math.PI * 2);
      ctx.fillStyle = `hsla(${n.hue}, 95%, 70%, ${0.9 * cfg.glow})`;
      ctx.shadowColor = `hsla(${n.hue}, 95%, 65%, 0.9)`;
      ctx.shadowBlur = 8 * cfg.glow;
      ctx.fill();
      ctx.shadowBlur = 0;
    }

    if (running && !reduce) raf = requestAnimationFrame(draw);
  }

  resize();
  draw();
  const ro = new ResizeObserver(() => { resize(); if (reduce) draw(); });
  ro.observe(canvas);

  return () => {
    running = false;
    cancelAnimationFrame(raf);
    ro.disconnect();
  };
}
