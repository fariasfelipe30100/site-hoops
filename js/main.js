import { applyWhatsappLinks } from './whatsapp.js?v=8';
import { WHATSAPP_NUMBER, MESSAGES } from './config.js?v=8';
import { initCharts } from './charts.js?v=8';
import { initMotion } from './motion.js?v=8';
import { quandoPerto, acompanharServicos, acompanharPassos } from './palco.js?v=8';

// Cada módulo falha sozinho, sem derrubar os outros. Aceita funções síncronas e promessas.
function run(name, fn) {
  const report = (error) => console.error(`[hoops] ${name} falhou`, error);
  try {
    const result = fn();
    if (result && typeof result.catch === 'function') result.catch(report);
  } catch (error) {
    report(error);
  }
}

const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const compact = window.matchMedia('(max-width: 900px)').matches;

run('whatsapp', () => applyWhatsappLinks(document, WHATSAPP_NUMBER, MESSAGES));

run('menu', () => {
  const menu = document.querySelector('.site-header details.nav-mobile');
  if (!menu) return;
  menu.addEventListener('click', (event) => {
    if (event.target.closest('a')) menu.removeAttribute('open');
  });
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && menu.open) {
      menu.removeAttribute('open');
      menu.querySelector('summary')?.focus();
    }
  });
});

// O botão fixo do WhatsApp some enquanto o botão principal da primeira tela está inteiro à vista,
// para não cobri-lo em celulares baixos. Sem JavaScript ele fica sempre visível.
run('botao-fixo', () => {
  const float = document.querySelector('.wa-float');
  const primary = document.querySelector('.hero__cta .btn');
  if (!float || !primary) return;
  new IntersectionObserver(([entry]) => {
    float.classList.toggle('wa-float--oculto', entry.intersectionRatio >= 1);
  }, { threshold: 1 }).observe(primary);
});

run('movimento', () => initMotion({ reducedMotion }));

run('graficos', () => initCharts(document, { reducedMotion }));

// A cena carrega por import dinâmico: se o Three.js ou o WebGL faltar, a primeira tela usa o fundo em CSS.
const canvas = document.getElementById('cena');
if (canvas) {
  const hero = canvas.closest('.hero');
  import('./scene.js?v=8')
    .then(({ initScene }) => initScene(canvas, { reducedMotion, compact }))
    .catch((error) => {
      hero?.classList.add('no-webgl');
      console.info('[hoops] cena 3D indisponível, usando o fundo em CSS', error?.message ?? error);
    });
}

// Palcos 3D da principal: cada um carrega por import dinâmico só quando chega perto da tela.
// Sem Three.js ou sem WebGL, o palco fica no painel estático (gradiente e número da etapa) e o texto não muda.
function palco3d(nome, raiz, carregar) {
  quandoPerto(raiz, () => carregar().catch((error) => {
    raiz.classList.add('palco--reserva');
    console.info(`[hoops] ${nome}: 3D indisponível, usando o painel estático`, error?.message ?? error);
  }));
}

run('servicos-3d', () => {
  const raiz = document.querySelector('[data-servicos3d]');
  if (!raiz) return;
  const estado = acompanharServicos(raiz, { compact });
  palco3d('serviços', raiz, () => import('./servicos3d.js?v=8')
    .then(({ initServicos3D }) => initServicos3D(raiz, { reducedMotion, compact, estado })));
});

run('passos-3d', () => {
  const raiz = document.querySelector('[data-passos3d]');
  if (!raiz) return;
  const estado = acompanharPassos(raiz, { reducedMotion });
  palco3d('como funciona', raiz, () => import('./passos3d.js?v=8')
    .then(({ initPassos3D }) => initPassos3D(raiz, { reducedMotion, compact, estado })));
});

run('custo-3d', () => {
  const raiz = document.querySelector('[data-custo3d]');
  if (!raiz) return;
  palco3d('custo', raiz, () => import('./custo3d.js?v=8')
    .then(({ initCusto3D }) => initCusto3D(raiz, { reducedMotion, compact })));
});
