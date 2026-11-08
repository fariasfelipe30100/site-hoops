// Hoops v2: entradas na rolagem, cabeçalho de vidro, luz que segue o mouse nos cards,
// linha do tempo que acende, paralaxe leve e botão do WhatsApp depois da primeira tela.
(() => {
  const reduzido = matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Entradas escalonadas: irmãos .rv ganham atraso crescente.
  document.querySelectorAll('.rv').forEach((el) => {
    const irmaos = [...el.parentElement.children].filter((c) => c.classList.contains('rv'));
    el.style.setProperty('--atraso', `${Math.min(irmaos.indexOf(el), 5) * 0.08}s`);
  });
  const observa = new IntersectionObserver((entradas) => {
    entradas.forEach((e) => {
      if (!e.isIntersecting) return;
      e.target.classList.add('visto');
      observa.unobserve(e.target);
    });
  }, { rootMargin: '0px 0px -10% 0px', threshold: 0.12 });
  document.querySelectorAll('.rv').forEach((el) => (reduzido ? el.classList.add('visto') : observa.observe(el)));

  // Cabeçalho, botão flutuante, linha do tempo e paralaxe, tudo num só quadro por rolagem.
  const topo = document.querySelector('[data-topo]');
  const flutuante = document.querySelector('.wa-flutuante');
  const hero = document.querySelector('.hero');
  const etapas = document.querySelector('[data-etapas]');
  const itens = etapas ? [...etapas.children] : [];
  const foto = document.querySelector('[data-paralaxe-foto]');
  const cena = document.querySelector('[data-paralaxe]');
  const links = [...document.querySelectorAll('.topo__nav a')];
  const secoes = links.map((a) => document.querySelector(a.getAttribute('href')));
  let pendente = false;

  const quadro = () => {
    pendente = false;
    const y = scrollY;
    const h = innerHeight;
    topo.classList.toggle('topo--rolado', y > 30);
    flutuante.classList.toggle('visivel', y > hero.offsetHeight * 0.75);

    if (etapas) {
      const caixa = etapas.getBoundingClientRect();
      const linha = h * 0.62;
      const vertical = innerWidth <= 680;
      const p = reduzido ? 1 : Math.max(0, Math.min(1, (linha - caixa.top) / (vertical ? caixa.height : caixa.height + h * 0.25)));
      etapas.style.setProperty('--p', p.toFixed(3));
      itens.forEach((li, i) => li.classList.toggle('aceso', reduzido || p >= i / itens.length + 0.02));
    }
    if (!reduzido && foto) {
      const c = foto.getBoundingClientRect();
      if (c.bottom > 0 && c.top < h) foto.style.setProperty('--desloca', `${((c.top + c.height / 2 - h / 2) * -0.12).toFixed(1)}px`);
    }
    if (!reduzido && cena && y < h) cena.style.transform = `translateY(${(y * 0.12).toFixed(1)}px)`;

    let atual = -1;
    secoes.forEach((s, i) => { if (s && s.getBoundingClientRect().top < h * 0.4) atual = i; });
    links.forEach((a, i) => a.classList.toggle('ativo', i === atual));
  };
  const pedir = () => { if (!pendente) { pendente = true; requestAnimationFrame(quadro); } };
  addEventListener('scroll', pedir, { passive: true });
  addEventListener('resize', pedir);
  quadro();

  // Linha da comparação desenha quando aparece.
  const duelo = document.querySelector('.duelo');
  if (duelo) new IntersectionObserver(([e], o) => { if (e.isIntersecting) { duelo.classList.add('visto'); o.disconnect(); } }, { threshold: 0.3 }).observe(duelo);

  // Luz que segue o ponteiro nos cards.
  if (!reduzido && matchMedia('(hover: hover)').matches) {
    document.querySelectorAll('[data-luz]').forEach((card) => {
      card.addEventListener('pointermove', (ev) => {
        const r = card.getBoundingClientRect();
        card.style.setProperty('--x', `${ev.clientX - r.left}px`);
        card.style.setProperty('--y', `${ev.clientY - r.top}px`);
      });
    });
  }

  // Menu do celular fecha ao escolher um link.
  document.querySelectorAll('.topo__menu a').forEach((a) => a.addEventListener('click', () => a.closest('details').removeAttribute('open')));
})();
