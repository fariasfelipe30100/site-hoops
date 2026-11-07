// Movimento da página: entrada na rolagem, pontos do radar e linha de "Como funciona".

function revealOnScroll() {
  const blocks = [...document.querySelectorAll('.rv')];
  const observer = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      entry.target.classList.remove('rv-espera');
      observer.unobserve(entry.target);
    }
  }, { threshold: 0.12, rootMargin: '0px 0px -4% 0px' });

  // Só esconde o que ainda está abaixo da tela: o que já aparece não pisca.
  // A seção de um link com âncora (#perguntas) chega pronta, sem esperar a entrada.
  let target = null;
  try {
    target = window.location.hash ? document.querySelector(decodeURIComponent(window.location.hash)) : null;
  } catch {
    target = null;
  }
  for (const block of blocks) {
    if (block.getBoundingClientRect().top < window.innerHeight) continue;
    if (target?.contains(block)) continue;
    block.classList.add('rv-espera');
    observer.observe(block);
  }
}

function radarDots() {
  const radar = document.getElementById('radar');
  if (!radar || radar.childElementCount) return;
  for (let i = 0; i < 12; i += 1) {
    const angle = i * 2.4;
    const radius = 16 + ((i * 37) % 32);
    const dot = document.createElement('b');
    dot.style.left = `${50 + radius * Math.cos(angle)}%`;
    dot.style.top = `${50 + radius * Math.sin(angle)}%`;
    dot.style.animationDelay = `${-i * 0.37}s`;
    radar.append(dot);
  }
}

function stepsLine(reducedMotion) {
  const wrap = document.querySelector('[data-linha-passos]');
  if (!wrap || reducedMotion) return;
  const list = wrap.querySelector('.passos');
  const items = [...wrap.querySelectorAll('.passos li')];
  list?.classList.add('passos--vivo');

  let pending = false;
  const update = () => {
    pending = false;
    const box = wrap.getBoundingClientRect();
    const reading = window.innerHeight * 0.6;
    const progress = Math.min(1, Math.max(0, (reading - box.top) / box.height));
    wrap.style.setProperty('--p', progress.toFixed(4));
    for (const item of items) {
      const dot = item.getBoundingClientRect().top + 30;
      item.classList.toggle('aceso', dot <= reading);
    }
  };
  const request = () => {
    if (pending) return;
    pending = true;
    requestAnimationFrame(update);
  };
  window.addEventListener('scroll', request, { passive: true });
  window.addEventListener('resize', request);
  update();
}

export function initMotion({ reducedMotion = false } = {}) {
  radarDots();
  if (!reducedMotion) revealOnScroll();
  stepsLine(reducedMotion);
}
