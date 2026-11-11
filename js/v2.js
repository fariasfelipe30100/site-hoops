// Hoops v2: entradas na rolagem, cabeçalho de vidro, luz que segue o mouse nos cards,
// linha do tempo que acende, paralaxe leve e botão do WhatsApp depois da primeira tela.
(() => {
  const reduzido = matchMedia('(prefers-reduced-motion: reduce)').matches;
  document.querySelectorAll('[data-ano]').forEach((el) => (el.textContent = new Date().getFullYear()));

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
  const secoes = links.map((a) => (a.getAttribute('href').startsWith('#') ? document.querySelector(a.getAttribute('href')) : null));
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
      if (c.bottom > 0 && c.top < h) foto.style.setProperty('--desloca', `${Math.max(-40, Math.min(40, (c.top + c.height / 2 - h / 2) * -0.06)).toFixed(1)}px`);
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
  // Números contam de 0 até o valor quando aparecem na tela.
  const contas = document.querySelectorAll('[data-conta]');
  const calmo = matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (contas.length && !calmo) {
    const oc = new IntersectionObserver((es) => es.forEach((e) => {
      if (!e.isIntersecting) return;
      oc.unobserve(e.target);
      const el = e.target, fim = +el.dataset.conta, t0 = performance.now();
      const passo = (t) => { const p = Math.min(1, (t - t0) / 1400); el.textContent = Math.round(fim * (1 - Math.pow(1 - p, 3))); if (p < 1) requestAnimationFrame(passo); };
      el.textContent = '0'; requestAnimationFrame(passo);
    }), { threshold: 0.6 });
    contas.forEach((c) => oc.observe(c));
  }
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

  // Perguntas: no computador, passar o mouse (ou focar/clicar) mostra a resposta no painel ao lado;
  // no celular, o toque abre e fecha a resposta dentro do próprio cartão.
  const faq = document.querySelector('[data-faq]');
  if (faq) {
    const itens = [...faq.querySelectorAll('.faq__item')];
    const painel = faq.querySelector('[data-faq-painel]');
    const largo = matchMedia('(min-width: 901px)');
    const mouse = matchMedia('(hover: hover) and (pointer: fine)');
    let atual = -1;
    let espera;
    const mostrar = (i) => {
      if (i === atual) return;
      atual = i;
      itens.forEach((item, k) => {
        item.classList.toggle('ativo', k === i);
        item.querySelector('.faq__q').setAttribute('aria-expanded', String(k === i));
      });
      if (!largo.matches || i < 0) return;
      const item = itens[i];
      painel.classList.add('troca');
      clearTimeout(espera);
      espera = setTimeout(() => {
        painel.querySelector('[data-faq-n]').textContent = item.querySelector('.faq__n').textContent;
        painel.querySelector('[data-faq-q]').textContent = item.querySelector('.faq__texto').textContent;
        painel.querySelector('[data-faq-r]').textContent = item.querySelector('.faq__resp p').textContent;
        painel.classList.remove('troca');
      }, reduzido ? 0 : 180);
    };
    itens.forEach((item, i) => {
      const botao = item.querySelector('.faq__q');
      item.addEventListener('mouseenter', () => { if (mouse.matches && largo.matches) mostrar(i); });
      botao.addEventListener('focus', () => { if (largo.matches) mostrar(i); });
      botao.addEventListener('click', () => {
        if (largo.matches) mostrar(i);
        else mostrar(atual === i ? -1 : i);
      });
    });
    const ajustar = () => { const i = atual; atual = -1; mostrar(largo.matches ? Math.max(i, 0) : -1); };
    largo.addEventListener('change', ajustar);
    ajustar();
  }

  // Menu do celular fecha ao escolher um link.
  document.querySelectorAll('.topo__menu a').forEach((a) => a.addEventListener('click', () => a.closest('details').removeAttribute('open')));
})();
