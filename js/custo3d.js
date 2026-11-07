// O custo de parar: duas faixas 3D, uma em cada painel, desenhadas por um único canvas (um só contexto WebGL).
// TI reativa: superfície vermelha irregular, com picos. TI proativa: superfície ciano estável.
// Cada fileira é um instante anterior da mesma linha, recuando em profundidade. Ilustração, sem eixos nem valores.
import * as THREE from '../vendor/three.module.min.js?v=9';
import { criarRenderer, laco, liberar, vigiarContexto } from './palco.js?v=9';

const VERMELHO = 0xff4d4f;
const CIANO = 0x35f2f9;

const FORMAS = {
  ruim: (u) => {
    const pico = Math.max(0, Math.sin(u * 0.9) - 0.7) / 0.3;
    return 0.2 * Math.sin(u * 2.3) + 0.14 * Math.sin(u * 5.1 + 1) + 0.07 * Math.sin(u * 13.7) + 0.035 * Math.sin(u * 31) + 1.05 * pico ** 0.7;
  },
  bom: (u) => 0.55 + 0.045 * Math.sin(u * 1.7) + 0.02 * Math.sin(u * 4.3),
};

const VERTICE = /* glsl */ `
  attribute vec2 grade;
  varying vec2 vGrade;
  varying float vAltura;
  void main() {
    vGrade = grade;
    vAltura = position.y;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

// Linhas nas fileiras (grade.y inteiro) e linhas finas a cada coluna; a frente brilha mais e o fundo some.
const FRAGMENTO = /* glsl */ `
  uniform vec3 cor;
  uniform float fileiras;
  uniform float colunas;
  varying vec2 vGrade;
  varying float vAltura;
  float linha(float valor, float espessura) {
    float d = abs(fract(valor - 0.5) - 0.5);
    return 1.0 - smoothstep(0.0, fwidth(valor) * espessura, d);
  }
  void main() {
    float frente = 1.0 - vGrade.y / fileiras;
    float bordas = smoothstep(0.0, 0.08, vGrade.x) * smoothstep(1.0, 0.92, vGrade.x);
    float l = linha(vGrade.y, 1.3) * (0.35 + 0.65 * frente * frente);
    float c = linha(vGrade.x * colunas, 1.0) * 0.12;
    float preenchimento = 0.06 + 0.16 * clamp(vAltura, 0.0, 1.0);
    float alfa = (preenchimento + l + c) * bordas * (0.15 + 0.85 * frente);
    gl_FragColor = vec4(cor * (0.7 + 0.6 * l), alfa);
  }
`;

function brilho() {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 64;
  const context = canvas.getContext('2d');
  const gradient = context.createRadialGradient(32, 32, 0, 32, 32, 32);
  gradient.addColorStop(0, '#fff');
  gradient.addColorStop(0.3, 'rgba(255,255,255,.5)');
  gradient.addColorStop(1, 'rgba(255,255,255,0)');
  context.fillStyle = gradient;
  context.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(canvas);
}

function faixa(tipo, tex, compact) {
  const forma = FORMAS[tipo];
  const cor = tipo === 'ruim' ? VERMELHO : CIANO;
  const NX = compact ? 110 : 170;
  const NZ = compact ? 12 : 16;
  const LARGURA = 6;
  const FUNDO = 3.6;
  const ALTURA = tipo === 'ruim' ? 0.95 : 1;
  const grupo = new THREE.Group();

  const posicoes = new Float32Array(NX * NZ * 3);
  const grade = new Float32Array(NX * NZ * 2);
  const indices = [];
  for (let z = 0; z < NZ; z += 1) {
    for (let x = 0; x < NX; x += 1) {
      const i = z * NX + x;
      posicoes[i * 3] = (x / (NX - 1) - 0.5) * LARGURA;
      posicoes[i * 3 + 2] = -z * (FUNDO / (NZ - 1));
      grade[i * 2] = x / (NX - 1);
      grade[i * 2 + 1] = z;
      if (x < NX - 1 && z < NZ - 1) indices.push(i, i + 1, i + NX, i + 1, i + NX + 1, i + NX);
    }
  }
  const geometria = new THREE.BufferGeometry();
  geometria.setAttribute('position', new THREE.BufferAttribute(posicoes, 3));
  geometria.setAttribute('grade', new THREE.BufferAttribute(grade, 2));
  geometria.setIndex(indices);
  const superficie = new THREE.Mesh(geometria, new THREE.ShaderMaterial({
    vertexShader: VERTICE,
    fragmentShader: FRAGMENTO,
    uniforms: { cor: { value: new THREE.Color(cor) }, fileiras: { value: NZ - 1 }, colunas: { value: 24 } },
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
  }));
  superficie.frustumCulled = false;
  grupo.add(superficie);

  // Linha da frente com brilho: pontos luminosos ao longo dela e, na vermelha, marcas nos picos.
  const frente = new Float32Array(NX * 3);
  const pontos = new THREE.BufferGeometry();
  pontos.setAttribute('position', new THREE.BufferAttribute(frente, 3));
  const brilhoFrente = new THREE.Points(pontos, new THREE.PointsMaterial({
    color: cor, size: compact ? 0.11 : 0.09, map: tex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  }));
  brilhoFrente.frustumCulled = false;
  grupo.add(brilhoFrente);

  // Cortina sob a linha da frente: dá volume, como a área de um gráfico, apagando até o chão.
  const cortina = new Float32Array(NX * 2 * 3);
  const topo = new Float32Array(NX * 2);
  const cortinaIndices = [];
  for (let x = 0; x < NX; x += 1) {
    topo[x * 2] = 1;
    topo[x * 2 + 1] = 0;
    cortina[x * 6] = cortina[x * 6 + 3] = posicoes[x * 3];
    if (x < NX - 1) cortinaIndices.push(x * 2, x * 2 + 1, x * 2 + 2, x * 2 + 1, x * 2 + 3, x * 2 + 2);
  }
  const cortinaGeo = new THREE.BufferGeometry();
  cortinaGeo.setAttribute('position', new THREE.BufferAttribute(cortina, 3));
  cortinaGeo.setAttribute('topo', new THREE.BufferAttribute(topo, 1));
  cortinaGeo.setIndex(cortinaIndices);
  const parede = new THREE.Mesh(cortinaGeo, new THREE.ShaderMaterial({
    vertexShader: 'attribute float topo; varying float vTopo; varying float vX; void main() { vTopo = topo; vX = position.x; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: `uniform vec3 cor; varying float vTopo; varying float vX; void main() { float bordas = smoothstep(${(LARGURA / 2).toFixed(1)}, ${(LARGURA / 2 - 0.5).toFixed(1)}, abs(vX)); gl_FragColor = vec4(cor, vTopo * vTopo * 0.32 * bordas); }`,
    uniforms: { cor: { value: new THREE.Color(cor) } },
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
  }));
  parede.frustumCulled = false;
  grupo.add(parede);

  const PICOS = 4;
  const marcas = new Float32Array(PICOS * 3);
  const marcasGeo = new THREE.BufferGeometry();
  marcasGeo.setAttribute('position', new THREE.BufferAttribute(marcas, 3));
  const alertas = new THREE.Points(marcasGeo, new THREE.PointsMaterial({
    color: 0xffb3b4, size: 0.55, map: tex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  }));
  alertas.frustumCulled = false;
  alertas.visible = tipo === 'ruim';
  grupo.add(alertas);

  // Chão: pontos discretos, só para dar profundidade (não é eixo e não tem valores).
  const chao = [];
  for (let z = 0; z <= 8; z += 1) for (let x = 0; x <= 24; x += 1) chao.push((x / 24 - 0.5) * LARGURA, -0.02, -z * (FUNDO / 8));
  const chaoGeo = new THREE.BufferGeometry();
  chaoGeo.setAttribute('position', new THREE.Float32BufferAttribute(chao, 3));
  grupo.add(new THREE.Points(chaoGeo, new THREE.PointsMaterial({ color: cor, size: 0.035, transparent: true, opacity: 0.35, depthWrite: false })));

  const VELOCIDADE = tipo === 'ruim' ? 0.9 : 0.6;
  const ATRASO = 0.55;
  grupo.userData.tick = (t) => {
    for (let z = 0; z < NZ; z += 1) {
      for (let x = 0; x < NX; x += 1) {
        const u = (x / (NX - 1)) * 9 + t * VELOCIDADE - z * ATRASO;
        posicoes[(z * NX + x) * 3 + 1] = Math.max(0, forma(u)) * ALTURA;
      }
    }
    geometria.attributes.position.needsUpdate = true;
    for (let x = 0; x < NX; x += 1) {
      frente[x * 3] = posicoes[x * 3];
      frente[x * 3 + 1] = posicoes[x * 3 + 1] + 0.01;
      frente[x * 3 + 2] = 0.01;
    }
    pontos.attributes.position.needsUpdate = true;
    for (let x = 0; x < NX; x += 1) cortina[x * 6 + 1] = posicoes[x * 3 + 1];
    cortinaGeo.attributes.position.needsUpdate = true;
    if (alertas.visible) {
      let n = 0;
      for (let x = 2; x < NX - 2 && n < PICOS; x += 1) {
        const y = posicoes[x * 3 + 1];
        if (y > 0.75 && y >= posicoes[(x - 1) * 3 + 1] && y > posicoes[(x + 1) * 3 + 1]) {
          marcas[n * 3] = posicoes[x * 3];
          marcas[n * 3 + 1] = y + 0.02;
          marcas[n * 3 + 2] = 0.02;
          n += 1;
        }
      }
      for (; n < PICOS; n += 1) {
        marcas[n * 3] = 0;
        marcas[n * 3 + 1] = -50;
        marcas[n * 3 + 2] = 0;
      }
      marcasGeo.attributes.position.needsUpdate = true;
    }
  };
  return grupo;
}

/**
 * Liga as duas faixas. O canvas cobre a área dos dois painéis; cada faixa é desenhada só dentro
 * da parte de baixo do seu painel (viewport + scissor). Lança erro sem WebGL.
 * @returns {() => void} para o laço e libera a GPU
 */
export function initCusto3D(raiz, { reducedMotion = false, compact = false } = {}) {
  const canvas = raiz.querySelector('canvas.compara__3d');
  const paineis = ['ruim', 'bom'].map((tipo) => raiz.querySelector(`.lado.${tipo}`));
  if (!canvas || paineis.some((painel) => !painel)) throw new Error('custo: marcação incompleta');
  const renderer = criarRenderer(THREE, canvas, { compact });
  renderer.setScissorTest(true);
  const tex = brilho();
  const lados = ['ruim', 'bom'].map((tipo, i) => {
    const cena = new THREE.Scene();
    const grupo = faixa(tipo, tex, compact);
    cena.add(grupo);
    const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 40);
    return { cena, grupo, camera, painel: paineis[i], area: null };
  });

  // Medidas por offset (relativas a .compara, onde o canvas ocupa tudo): ignoram o deslocamento
  // da entrada na rolagem (.rv), que é transform.
  let tamanho = { w: 0, h: 0 };
  const enquadrar = () => {
    const largura = raiz.clientWidth;
    const alturaTotal = raiz.clientHeight;
    if (!largura || !alturaTotal) return;
    renderer.setSize(largura, alturaTotal, false);
    tamanho = { w: largura, h: alturaTotal };
    for (const lado of lados) {
      const painel = lado.painel;
      const margem = 16;
      // A faixa ocupa o espaço abaixo do texto do painel (no mínimo 44% da altura dele).
      const texto = painel.firstElementChild;
      const livre = painel.offsetHeight - (texto.offsetTop + texto.offsetHeight) - 4;
      const altura = Math.round(Math.max(livre, painel.offsetHeight * 0.44));
      const area = {
        x: painel.offsetLeft + margem,
        y: alturaTotal - (painel.offsetTop + painel.offsetHeight) + margem,
        w: painel.offsetWidth - margem * 2,
        h: altura - margem,
      };
      lado.area = area;
      const aspecto = area.w / area.h;
      lado.camera.aspect = aspecto;
      // Distância que faz a largura da faixa caber na área, em qualquer proporção.
      const meiaLargura = Math.tan(THREE.MathUtils.degToRad(lado.camera.fov / 2)) * aspecto;
      const distancia = Math.max(5.2, 3.25 / meiaLargura);
      lado.camera.position.set(0, distancia * 0.42, distancia);
      lado.camera.lookAt(0, 0.35, -1.5);
      lado.camera.updateProjectionMatrix();
    }
    ciclo?.pedir();
  };

  let mx = 0;
  const aoMover = (event) => { mx = event.clientX / window.innerWidth - 0.5; };
  if (!reducedMotion) raiz.addEventListener('pointermove', aoMover, { passive: true });

  const desenhar = (t) => {
    renderer.setViewport(0, 0, tamanho.w, tamanho.h);
    renderer.setScissor(0, 0, tamanho.w, tamanho.h);
    renderer.clear();
    for (const lado of lados) {
      if (!lado.area || lado.area.w <= 0 || lado.area.h <= 0) continue;
      const { x, y, w, h } = lado.area;
      renderer.setViewport(x, y, w, h);
      renderer.setScissor(x, y, w, h);
      lado.grupo.userData.tick(t);
      lado.grupo.rotation.y += (mx * 0.35 - 0.12 - lado.grupo.rotation.y) * 0.05;
      if (reducedMotion) lado.grupo.rotation.y = -0.12;
      renderer.render(lado.cena, lado.camera);
    }
  };

  renderer.autoClear = false;
  const ciclo = laco(canvas, desenhar, { reducedMotion, tempoFixo: 3.1 });
  const soltarContexto = vigiarContexto(canvas, raiz, ciclo);
  const redimensionar = new ResizeObserver(enquadrar);
  raiz.classList.add('compara--3d');
  redimensionar.observe(raiz);
  enquadrar();

  return () => {
    ciclo.parar();
    soltarContexto();
    redimensionar.disconnect();
    raiz.removeEventListener('pointermove', aoMover);
    raiz.classList.remove('compara--3d');
    for (const lado of lados) liberar(lado.cena);
    renderer.dispose();
  };
}
