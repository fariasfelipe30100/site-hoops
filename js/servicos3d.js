// Serviços: palco 3D fixo ao lado da lista; o objeto muda conforme o serviço lido.
// Globo (NOC), discos (backup), escudo (segurança), rede (infraestrutura) e nuvem (cloud), todos procedurais.
// Cada item da lista diz o seu modelo em data-s3d; as páginas de segmento usam quatro, em outra ordem.
import * as THREE from '../vendor/three.module.min.js?v=9';
import { criarRenderer, laco, liberar, vigiarContexto } from './palco.js?v=9';

const CIANO = 0x35f2f9;
const ACCENT = 0x00c4cc;
const ALERTA = 0xff4d4f;

function brilho() {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const x = c.getContext('2d');
  const g = x.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, '#fff');
  g.addColorStop(0.3, 'rgba(255,255,255,.5)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  x.fillStyle = g;
  x.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(c);
}

function pontos(arr, cor, tam, tex) {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(arr, 3));
  return new THREE.Points(g, new THREE.PointsMaterial({
    color: cor, size: tam, map: tex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  }));
}

function globo(tex) {
  const g = new THREE.Group();
  const n = 1400, arr = [];
  const phi = Math.PI * (3 - Math.sqrt(5));
  for (let i = 0; i < n; i++) {
    const y = 1 - (i / (n - 1)) * 2, r = Math.sqrt(1 - y * y), t = phi * i;
    arr.push(Math.cos(t) * r * 1.7, y * 1.7, Math.sin(t) * r * 1.7);
  }
  g.add(pontos(arr, CIANO, 0.07, tex));
  const nucleo = new THREE.Mesh(new THREE.SphereGeometry(1.6, 48, 48),
    new THREE.MeshStandardMaterial({ color: 0x03264d, metalness: 0.4, roughness: 0.5, transparent: true, opacity: 0.85 }));
  g.add(nucleo);
  const aneis = [];
  for (const [rx, ry, raio] of [[1.2, 0.3, 2.3], [0.4, 1.1, 2.6]]) {
    const a = new THREE.Mesh(new THREE.TorusGeometry(raio, 0.012, 8, 160), new THREE.MeshBasicMaterial({ color: ACCENT }));
    a.rotation.set(rx, ry, 0);
    const sat = new THREE.Mesh(new THREE.SphereGeometry(0.07, 16, 16), new THREE.MeshBasicMaterial({ color: 0xffffff }));
    sat.position.x = raio;
    a.add(sat);
    g.add(a);
    aneis.push(a);
  }
  g.userData.tick = (t) => { g.rotation.y = t * 0.15; aneis[0].rotation.z = t * 0.6; aneis[1].rotation.z = -t * 0.45; };
  return g;
}

function discos(tex) {
  const g = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({ color: 0x0a2e5a, metalness: 0.85, roughness: 0.25 });
  for (let i = 0; i < 3; i++) {
    const d = new THREE.Mesh(new THREE.CylinderGeometry(1.5, 1.5, 0.36, 64), mat);
    d.position.y = -0.75 + i * 0.6;
    g.add(d);
    const borda = new THREE.Mesh(new THREE.TorusGeometry(1.5, 0.018, 8, 120), new THREE.MeshBasicMaterial({ color: CIANO }));
    borda.rotation.x = Math.PI / 2;
    borda.position.y = d.position.y + 0.18;
    g.add(borda);
    for (let k = 0; k < 6; k++) {
      const led = new THREE.Mesh(new THREE.SphereGeometry(0.035, 8, 8), new THREE.MeshBasicMaterial({ color: k % 3 ? CIANO : 0x4dff9e }));
      const ang = -0.5 + k * 0.12;
      led.position.set(Math.sin(ang) * 1.51, d.position.y, Math.cos(ang) * 1.51);
      g.add(led);
    }
  }
  const N = 160, arr = new Float32Array(N * 3), fase = [];
  for (let i = 0; i < N; i++) fase.push(Math.random());
  const p = pontos(arr, CIANO, 0.09, tex);
  g.add(p);
  g.userData.tick = (t) => {
    g.rotation.y = t * 0.25;
    for (let i = 0; i < N; i++) {
      const f = (fase[i] + t * 0.12) % 1, ang = fase[i] * 40 + f * 6;
      const raio = 2.4 * (1 - f) + 0.3;
      arr[i * 3] = Math.cos(ang) * raio;
      arr[i * 3 + 1] = 2.6 - f * 2.4;
      arr[i * 3 + 2] = Math.sin(ang) * raio;
    }
    p.geometry.attributes.position.needsUpdate = true;
  };
  return g;
}

function escudo(tex, compact) {
  const g = new THREE.Group();
  const s = new THREE.Shape();
  s.moveTo(0, 1.9);
  s.lineTo(1.5, 1.35);
  s.lineTo(1.5, 0.1);
  s.bezierCurveTo(1.5, -1.1, 0.7, -1.7, 0, -2);
  s.bezierCurveTo(-0.7, -1.7, -1.5, -1.1, -1.5, 0.1);
  s.lineTo(-1.5, 1.35);
  s.lineTo(0, 1.9);
  const geo = new THREE.ExtrudeGeometry(s, { depth: 0.35, bevelEnabled: true, bevelThickness: 0.12, bevelSize: 0.1, bevelSegments: 6 });
  geo.center();
  // No celular, sem transmissão: ela custa um passe de desenho a mais e um shader pesado de compilar.
  const corpo = new THREE.Mesh(geo, compact
    ? new THREE.MeshStandardMaterial({ color: 0x0b5c8c, metalness: 0.3, roughness: 0.2, transparent: true, opacity: 0.82, emissive: 0x003b52 })
    : new THREE.MeshPhysicalMaterial({ color: 0x0b5c8c, metalness: 0.3, roughness: 0.15, transmission: 0.35, transparent: true, opacity: 0.92, emissive: 0x003b52 }));
  g.add(corpo);
  g.add(new THREE.LineSegments(new THREE.EdgesGeometry(geo, 30), new THREE.LineBasicMaterial({ color: CIANO })));
  const ok = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([
    new THREE.Vector3(-0.6, 0, 0.35), new THREE.Vector3(-0.15, -0.45, 0.35), new THREE.Vector3(0.7, 0.55, 0.35),
  ], false, 'catmullrom', 0), 40, 0.09, 12), new THREE.MeshBasicMaterial({ color: CIANO }));
  g.add(ok);
  const N = 26, arr = new Float32Array(N * 3), dados = [];
  for (let i = 0; i < N; i++) dados.push({ f: Math.random(), y: (Math.random() - 0.5) * 3, a: Math.random() * Math.PI * 2 });
  const p = pontos(arr, ALERTA, 0.22, tex);
  g.add(p);
  g.userData.tick = (t) => {
    g.rotation.y = Math.sin(t * 0.5) * 0.45;
    for (let i = 0; i < N; i++) {
      const d = dados[i], f = (d.f + t * 0.18) % 1, r = 4.2 - f * 2.6;
      arr[i * 3] = Math.cos(d.a) * r;
      arr[i * 3 + 1] = d.y;
      arr[i * 3 + 2] = Math.sin(d.a) * r * 0.4 + 0.6;
    }
    p.geometry.attributes.position.needsUpdate = true;
    p.material.opacity = 0.9;
  };
  return g;
}

function rede(tex) {
  const g = new THREE.Group();
  const nos = [];
  for (let i = 0; i < 16; i++) {
    const v = new THREE.Vector3().randomDirection().multiplyScalar(1 + Math.random() * 1.2);
    nos.push(v);
    const m = new THREE.Mesh(new THREE.SphereGeometry(i === 0 ? 0.26 : 0.11, 24, 24),
      new THREE.MeshStandardMaterial({ color: i === 0 ? CIANO : 0x7fe9ff, emissive: i === 0 ? ACCENT : 0x0a6f88, emissiveIntensity: 0.8 }));
    if (i === 0) v.set(0, 0, 0);
    m.position.copy(v);
    g.add(m);
  }
  const lig = [], seg = [];
  nos.forEach((a, i) => nos.forEach((b, j) => { if (j > i && a.distanceTo(b) < 1.6) { lig.push([a, b]); seg.push(a.x, a.y, a.z, b.x, b.y, b.z); } }));
  const lg = new THREE.BufferGeometry();
  lg.setAttribute('position', new THREE.Float32BufferAttribute(seg, 3));
  g.add(new THREE.LineSegments(lg, new THREE.LineBasicMaterial({ color: ACCENT, transparent: true, opacity: 0.55 })));
  const arr = new Float32Array(lig.length * 3);
  const p = pontos(arr, 0xffffff, 0.16, tex);
  g.add(p);
  g.userData.tick = (t) => {
    g.rotation.y = t * 0.2;
    g.rotation.x = Math.sin(t * 0.3) * 0.2;
    lig.forEach(([a, b], i) => {
      const f = (t * 0.5 + i * 0.37) % 1;
      arr[i * 3] = a.x + (b.x - a.x) * f;
      arr[i * 3 + 1] = a.y + (b.y - a.y) * f;
      arr[i * 3 + 2] = a.z + (b.z - a.z) * f;
    });
    p.geometry.attributes.position.needsUpdate = true;
  };
  return g;
}

function nuvem(tex) {
  const g = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({ color: 0xdff8ff, emissive: 0x0b4a6e, emissiveIntensity: 0.6, roughness: 0.35, metalness: 0.1 });
  for (const [x, y, r] of [[0, 0.35, 0.95], [-0.95, 0, 0.7], [0.95, 0.05, 0.75], [-0.45, -0.25, 0.65], [0.45, -0.3, 0.65], [1.6, -0.3, 0.45], [-1.6, -0.32, 0.45]]) {
    const b = new THREE.Mesh(new THREE.SphereGeometry(r, 40, 40), mat);
    b.position.set(x, y + 0.5, 0);
    g.add(b);
  }
  const base = new THREE.Mesh(new THREE.TorusGeometry(1.9, 0.015, 8, 120), new THREE.MeshBasicMaterial({ color: CIANO }));
  base.rotation.x = Math.PI / 2;
  base.position.y = -1.6;
  g.add(base);
  const N = 90, arr = new Float32Array(N * 3), d = [];
  for (let i = 0; i < N; i++) d.push({ x: (Math.random() - 0.5) * 3.4, z: (Math.random() - 0.5) * 1.2, f: Math.random() });
  const p = pontos(arr, CIANO, 0.1, tex);
  g.add(p);
  g.userData.tick = (t) => {
    g.rotation.y = Math.sin(t * 0.4) * 0.5;
    g.position.y = Math.sin(t * 1.2) * 0.08;
    d.forEach((o, i) => {
      const f = (o.f + t * 0.25) % 1;
      arr[i * 3] = o.x;
      arr[i * 3 + 1] = -1.6 + f * 1.9;
      arr[i * 3 + 2] = o.z;
    });
    p.geometry.attributes.position.needsUpdate = true;
  };
  return g;
}

const MODELOS = { globo, discos, escudo, rede, nuvem };
const ORDEM = ['globo', 'discos', 'escudo', 'rede', 'nuvem'];

/**
 * Liga o palco 3D. Lança erro sem WebGL (quem chama mostra a reserva).
 * @param estado rastreador de acompanharServicos (qual serviço está na leitura)
 * @returns {() => void} para o laço e libera a GPU
 */
export function initServicos3D(raiz, { reducedMotion = false, compact = false, estado } = {}) {
  const canvas = raiz.querySelector('canvas');
  const palco = canvas.parentElement;
  const noc = palco.querySelector('.palco__noc');
  const cena = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 50);
  camera.position.set(0, 0.3, 8.5);
  cena.add(new THREE.HemisphereLight(0x9fe8ff, 0x021a3a, 1.1));
  const luz = new THREE.DirectionalLight(0xffffff, 2.2);
  luz.position.set(3, 5, 4);
  cena.add(luz);
  const ponto = new THREE.PointLight(CIANO, 30, 12);
  ponto.position.set(-3, -1, 3);
  cena.add(ponto);
  const tex = brilho();
  // Um modelo por item, na ordem da lista; sem nome válido, vale a ordem da principal.
  const nomes = [...raiz.querySelectorAll('[data-s3d]')].map((item, i) => (Object.prototype.hasOwnProperty.call(MODELOS, item.dataset.s3d) ? item.dataset.s3d : ORDEM[i % ORDEM.length]));
  const modelos = nomes.map((nome) => MODELOS[nome](tex, compact));
  modelos.forEach((modelo, i) => { modelo.scale.setScalar(i === (estado?.ativo ?? 0) ? 1 : 0.001); cena.add(modelo); });

  // O renderer nasce por último: se algo acima falhar, nenhum contexto WebGL fica aberto.
  let renderer;
  try {
    renderer = criarRenderer(THREE, canvas, { compact });
    // Compila os shaders de todos os modelos de uma vez, para a troca de serviço não travar.
    renderer.compile(cena, camera);
  } catch (error) {
    renderer?.forceContextLoss();
    renderer?.dispose();
    liberar(cena);
    throw error;
  }

  const ajustar = () => {
    const caixa = palco.getBoundingClientRect();
    if (!caixa.width || !caixa.height) return;
    renderer.setSize(caixa.width, caixa.height, false);
    camera.aspect = caixa.width / caixa.height;
    camera.position.z = caixa.width < 520 ? 10.5 : 8.5;
    // Nas páginas de segmento o cartão do NOC ocupa a base do palco: o objeto sobe para o espaço livre acima dele.
    const cartao = noc && noc.offsetParent ? noc.offsetHeight + 18 : 0;
    camera.setViewOffset(caixa.width, caixa.height, 0, cartao * 0.5, caixa.width, caixa.height);
    camera.updateProjectionMatrix();
    ciclo?.pedir();
  };

  let mx = 0;
  let my = 0;
  const aoMover = (event) => { mx = event.clientX / window.innerWidth - 0.5; my = event.clientY / window.innerHeight - 0.5; };
  if (!reducedMotion) raiz.addEventListener('pointermove', aoMover, { passive: true });

  const desenhar = (t, fixo) => {
    const ativo = estado?.ativo ?? 0;
    modelos.forEach((modelo, i) => {
      const alvo = i === ativo ? 1 : 0.001;
      modelo.scale.setScalar(fixo ? alvo : modelo.scale.x + (alvo - modelo.scale.x) * 0.09);
      modelo.visible = modelo.scale.x > 0.01;
      if (modelo.visible) modelo.userData.tick(t);
    });
    cena.rotation.y += (mx * 0.6 - cena.rotation.y) * 0.05;
    cena.rotation.x += (my * 0.3 - cena.rotation.x) * 0.05;
    renderer.render(cena, camera);
  };

  const ciclo = laco(canvas, desenhar, { reducedMotion });
  const soltarContexto = vigiarContexto(canvas, raiz, ciclo);
  const redimensionar = new ResizeObserver(ajustar);
  redimensionar.observe(palco);
  ajustar();
  estado?.aoMudar(() => ciclo.pedir());
  raiz.classList.add('palco--3d');

  return () => {
    ciclo.parar();
    soltarContexto();
    redimensionar.disconnect();
    raiz.removeEventListener('pointermove', aoMover);
    raiz.classList.remove('palco--3d');
    liberar(cena);
    renderer.dispose();
  };
}
