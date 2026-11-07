// Gráficos ilustrativos do "custo de parar": linha instável na TI reativa e estável na proativa. Sem números.

const STYLES = {
  ruim: {
    color: '#FF4D4F',
    level: (t) => 0.46 + 0.12 * Math.sin(t * 2.3) + 0.1 * Math.sin(t * 5.1) + (Math.sin(t * 0.9) > 0.72 ? 0.4 : 0),
  },
  bom: {
    color: '#35F2F9',
    level: (t) => 0.5 + 0.022 * Math.sin(t * 1.7) + 0.012 * Math.sin(t * 4.3),
  },
};

function drawChart(canvas, context, style, ms) {
  const width = canvas.width;
  const height = canvas.height;
  if (!width || !height) return;
  const scale = canvas.dataset.escala ? Number(canvas.dataset.escala) : 1;
  const offset = ms / 1100;
  context.clearRect(0, 0, width, height);
  context.lineWidth = 2 * scale;
  context.lineJoin = 'round';
  context.strokeStyle = style.color;
  context.shadowColor = style.color;
  context.shadowBlur = 13 * scale;
  context.beginPath();
  const points = 150;
  for (let i = 0; i <= points; i += 1) {
    const p = i / points;
    const y = height * Math.min(0.96, style.level(p * 8 + offset));
    if (i) context.lineTo(p * width, y);
    else context.moveTo(p * width, y);
  }
  context.stroke();
  context.shadowBlur = 0;
  context.lineTo(width, height);
  context.lineTo(0, height);
  context.closePath();
  const fill = context.createLinearGradient(0, 0, 0, height);
  fill.addColorStop(0, `${style.color}33`);
  fill.addColorStop(1, `${style.color}00`);
  context.fillStyle = fill;
  context.fill();
}

export function initCharts(root, { reducedMotion = false } = {}) {
  for (const canvas of root.querySelectorAll('canvas[data-linha]')) {
    const style = STYLES[canvas.dataset.linha];
    const context = canvas.getContext('2d');
    if (!style || !context) continue;

    let frame = 0;
    let visible = false;
    let lastMs = 0;

    const fit = () => {
      const scale = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.round(canvas.clientWidth * scale);
      canvas.height = Math.round(canvas.clientHeight * scale);
      canvas.dataset.escala = String(scale);
      drawChart(canvas, context, style, lastMs);
    };

    const tick = (ms) => {
      frame = 0;
      if (!visible) return;
      lastMs = ms;
      drawChart(canvas, context, style, ms);
      frame = requestAnimationFrame(tick);
    };

    new ResizeObserver(fit).observe(canvas);
    if (reducedMotion) continue;

    new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      if (visible && !frame) frame = requestAnimationFrame(tick);
    }).observe(canvas);
  }
}
