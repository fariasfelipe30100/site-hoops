// Peças comuns dos palcos 3D da principal, sem Three.js: carga perto da tela, contexto WebGL
// aberto no próprio canvas, laço que pausa fora da tela e os rastreadores de rolagem, que
// funcionam também na reserva sem WebGL (o número do palco acompanha a leitura).

export const compactoAgora = () => window.matchMedia('(max-width: 900px)').matches;

/** Chama fn uma vez, quando o elemento chega perto da tela. */
export function quandoPerto(elemento, fn, margem = '450px 0px') {
  if (!('IntersectionObserver' in window)) {
    fn();
    return;
  }
  const observer = new IntersectionObserver((entries) => {
    if (!entries.some((entry) => entry.isIntersecting)) return;
    observer.disconnect();
    fn();
  }, { rootMargin: margem });
  observer.observe(elemento);
}

/**
 * Cria o renderer no próprio canvas. Pede o contexto antes, para não abrir um canvas de teste
 * (seria um contexto a mais) e para falhar sem erro no console quando não há WebGL.
 */
export function criarRenderer(THREE, canvas, { compact = false } = {}) {
  const context = canvas.getContext('webgl2', { antialias: !compact, alpha: true, premultipliedAlpha: true, powerPreference: 'high-performance' });
  if (!context) throw new Error('WebGL indisponível');
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, context, antialias: !compact, alpha: true });
  } catch (error) {
    context.getExtension('WEBGL_lose_context')?.loseContext();
    throw error;
  }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, compact ? 1.25 : 1.75));
  renderer.setClearColor(0x000000, 0);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  return renderer;
}

/**
 * Laço de desenho. Só roda com o alvo na tela; com movimento reduzido desenha um quadro fixo
 * a cada pedido (troca de estado, mudança de tamanho) e nunca anima.
 */
export function laco(alvo, desenhar, { reducedMotion = false, tempoFixo = 2 } = {}) {
  let visivel = false;
  let frame = 0;
  let parado = false;
  const inicio = performance.now();
  const passo = (ms) => {
    frame = 0;
    if (parado) return;
    if (reducedMotion) {
      desenhar(tempoFixo, true);
      return;
    }
    if (!visivel) return;
    desenhar((ms - inicio) / 1000, false);
    frame = requestAnimationFrame(passo);
  };
  const pedir = () => {
    if (!frame && !parado) frame = requestAnimationFrame(passo);
  };
  const observer = new IntersectionObserver(([entry]) => {
    visivel = entry.isIntersecting;
    if (visivel) pedir();
  });
  observer.observe(alvo);
  pedir();
  return {
    pedir,
    parar() {
      parado = true;
      cancelAnimationFrame(frame);
      observer.disconnect();
    },
  };
}

/**
 * Contexto WebGL perdido (GPU reiniciada, falta de memória no celular): para o laço e volta
 * ao painel estático (número do palco ou gráficos 2D do custo).
 */
export function vigiarContexto(canvas, raiz, ciclo) {
  const perdido = () => {
    ciclo.parar();
    raiz.classList.remove('palco--3d', 'compara--3d');
    raiz.classList.add('palco--reserva');
  };
  canvas.addEventListener('webglcontextlost', perdido, { once: true });
  return () => canvas.removeEventListener('webglcontextlost', perdido);
}

/** Avisa se a seção está perto da tela, para os rastreadores não medirem nada quando ela está longe. */
function perto(raiz, aoChegar) {
  const estado = { perto: true };
  if (!('IntersectionObserver' in window)) return estado;
  new IntersectionObserver(([entry]) => {
    estado.perto = entry.isIntersecting;
    if (estado.perto) aoChegar();
  }, { rootMargin: '300px 0px' }).observe(raiz);
  return estado;
}

/** Libera geometrias, materiais e texturas de uma cena. */
export function liberar(raiz) {
  raiz.traverse((objeto) => {
    objeto.geometry?.dispose();
    const materiais = Array.isArray(objeto.material) ? objeto.material : [objeto.material];
    for (const material of materiais) {
      if (!material) continue;
      material.map?.dispose();
      material.dispose();
    }
  });
}

const doisDigitos = (n) => String(n).padStart(2, '0');

/**
 * Serviços: qual item está na faixa de leitura. Atualiza o número do palco e a classe .ativo.
 * No celular a faixa fica abaixo do palco fixo no topo.
 */
export function acompanharServicos(raiz, { compact = false } = {}) {
  const itens = [...raiz.querySelectorAll('[data-s3d]')];
  const numeros = raiz.querySelectorAll('[data-s3d-num]');
  const ouvintes = new Set();
  const estado = {
    ativo: 0,
    total: itens.length,
    aoMudar(fn) { ouvintes.add(fn); },
  };
  const marcar = (indice) => {
    estado.ativo = indice;
    itens.forEach((item, i) => item.classList.toggle('ativo', i === indice));
    numeros.forEach((numero) => { numero.textContent = doisDigitos(indice + 1); });
    ouvintes.forEach((fn) => fn(indice));
  };
  // Ativo = o item cujo centro está mais perto da linha de leitura. Conta pela posição a cada
  // rolagem, e não só por entrada e saída, para acertar também em saltos (âncoras, Home/End).
  // No celular a linha fica no espaço livre abaixo do palco fixo no topo, e só concorre o item
  // cujo título está inteiro abaixo do palco (o título nunca fica coberto pelo painel opaco).
  const palco = raiz.querySelector('.palco');
  const titulos = itens.map((item) => item.querySelector('h3') ?? item);
  let pendente = false;
  // A largura pode mudar depois do carregamento (tablet girado, janela redimensionada): o modo
  // compacto é lido a cada cálculo, igual à regra de CSS que empilha o palco.
  const telaEstreita = window.matchMedia('(max-width: 900px)');
  const calcular = () => {
    pendente = false;
    if (!vigia.perto) return;
    const compact = telaEstreita.matches;
    const base = compact && palco ? palco.getBoundingClientRect().bottom : 0;
    const leitura = compact ? base + (window.innerHeight - base) * 0.45 : window.innerHeight * 0.5;
    let indice = compact ? itens.length - 1 : 0;
    let menor = Infinity;
    itens.forEach((item, i) => {
      if (compact && titulos[i].getBoundingClientRect().top < base - 1) return;
      const caixa = item.getBoundingClientRect();
      const distancia = Math.abs(caixa.top + caixa.height / 2 - leitura);
      if (distancia < menor) { menor = distancia; indice = i; }
    });
    if (indice !== estado.ativo) marcar(indice);
  };
  const pedir = () => {
    if (pendente) return;
    pendente = true;
    requestAnimationFrame(calcular);
  };
  const vigia = perto(raiz, pedir);
  window.addEventListener('scroll', pedir, { passive: true });
  window.addEventListener('resize', pedir);
  if (palco && itens.length) {
    // O palco fixo só se solta quando o fim da lista chega a ele. Sem ajuste, o título do último item
    // passaria por baixo do palco ainda fixo. --cauda encurta a área do palco fixo (a lista sobra para
    // fora dela, e a margem devolve o espaço), para ele se soltar quando esse título chega à sua base.
    const ultimo = itens[itens.length - 1];
    const medirCauda = () => {
      const caixa = ultimo.getBoundingClientRect();
      const cauda = caixa.bottom - titulos[titulos.length - 1].getBoundingClientRect().top - 8;
      raiz.style.setProperty('--cauda', `${Math.max(0, Math.round(cauda))}px`);
    };
    if ('ResizeObserver' in window) new ResizeObserver(medirCauda).observe(ultimo);
    medirCauda();
  }
  marcar(0);
  calcular();
  return estado;
}

/**
 * Como funciona: posição contínua da leitura entre as etapas (0 = primeira, 3 = última),
 * com a mesma régua da linha que acende (60% da altura da tela). Movimento reduzido: tudo aceso.
 */
export function acompanharPassos(raiz, { reducedMotion = false } = {}) {
  const itens = [...raiz.querySelectorAll('.passos li')];
  const nomes = itens.map((item) => item.querySelector('h3')?.textContent.trim() ?? '');
  const numeros = raiz.querySelectorAll('[data-passo-num]');
  const rotulos = raiz.querySelectorAll('[data-passo-nome]');
  const ouvintes = new Set();
  const ultimo = Math.max(0, itens.length - 1);
  const estado = {
    posicao: reducedMotion ? ultimo : 0,
    total: itens.length,
    aoMudar(fn) { ouvintes.add(fn); },
  };
  let mostrado = -1;
  const calcular = () => {
    pendente = false;
    if (!vigia.perto) return;
    if (reducedMotion) {
      estado.posicao = ultimo;
    } else {
      const leitura = window.innerHeight * 0.6;
      const pontos = itens.map((item) => item.getBoundingClientRect().top + 30);
      let posicao = 0;
      for (let i = 0; i < pontos.length; i += 1) {
        if (pontos[i] > leitura) break;
        const proximo = pontos[i + 1];
        posicao = proximo === undefined ? i : i + Math.min(1, (leitura - pontos[i]) / (proximo - pontos[i]));
      }
      estado.posicao = Math.min(ultimo, Math.max(0, posicao));
    }
    const atual = Math.floor(estado.posicao + 0.001);
    if (atual !== mostrado) {
      mostrado = atual;
      numeros.forEach((numero) => { numero.textContent = doisDigitos(atual + 1); });
      rotulos.forEach((rotulo) => { rotulo.textContent = nomes[atual] ?? ''; });
    }
    ouvintes.forEach((fn) => fn(estado.posicao));
  };
  let pendente = false;
  const pedir = () => {
    if (pendente) return;
    pendente = true;
    requestAnimationFrame(calcular);
  };
  const vigia = reducedMotion ? { perto: true } : perto(raiz, pedir);
  if (!reducedMotion) {
    window.addEventListener('scroll', pedir, { passive: true });
    window.addEventListener('resize', pedir);
  }
  calcular();
  return estado;
}
