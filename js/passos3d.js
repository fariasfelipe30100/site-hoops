// Como funciona: caminho 3D com as quatro etapas (Diagnóstico, Plano, Implantação, Monitoramento).
// Uma luz percorre o caminho conforme a leitura desce pelas etapas; cada base acende ao ser alcançada.
// Ilustração: não representa o estado real de nenhuma rede.
import * as THREE from '../vendor/three.module.min.js?v=8';
import { criarRenderer, laco, liberar, vigiarContexto } from './palco.js?v=8';

const CIANO = 0x35f2f9;
const ACCENT = 0x00c4cc;
const APAGADO = new THREE.Color(0x24476e);
const ACESO = new THREE.Color(CIANO);

const BASES = [
  new THREE.Vector3(-2.35, 0, 1.25),
  new THREE.Vector3(-0.75, 0, -0.55),
  new THREE.Vector3(0.85, 0, 0.75),
  new THREE.Vector3(2.4, 0, -1.05),
];

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

// Trilha: parte percorrida acesa, com pulsos correndo; o resto fica apagado.
const TRILHA_VERTICE = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;
const TRILHA_FRAGMENTO = /* glsl */ `
  uniform float progresso;
  uniform float tempo;
  uniform vec3 acesa;
  uniform vec3 apagada;
  varying vec2 vUv;
  void main() {
    float dentro = 1.0 - smoothstep(progresso - 0.004, progresso + 0.004, vUv.x);
    float pulso = pow(0.5 + 0.5 * sin((vUv.x * 46.0) - tempo * 5.0), 6.0);
    vec3 cor = mix(apagada, acesa * (0.9 + 0.8 * pulso), dentro);
    gl_FragColor = vec4(cor, mix(0.55, 1.0, dentro));
  }
`;

// Feixe de luz sobre a base acesa, sumindo para o alto.
const FEIXE_VERTICE = /* glsl */ `
  varying float vAltura;
  void main() {
    vAltura = uv.y;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;
const FEIXE_FRAGMENTO = /* glsl */ `
  uniform vec3 cor;
  uniform float forca;
  varying float vAltura;
  void main() {
    gl_FragColor = vec4(cor, (1.0 - vAltura) * (1.0 - vAltura) * 0.42 * forca);
  }
`;

function material(cor = 0x0a2e5a) {
  return new THREE.MeshStandardMaterial({ color: cor, metalness: 0.7, roughness: 0.3, emissive: 0x000000 });
}

function contorno(geometria, opacidade = 0.8) {
  return new THREE.LineSegments(new THREE.EdgesGeometry(geometria, 25), new THREE.LineBasicMaterial({ color: CIANO, transparent: true, opacity: opacidade }));
}

// Símbolos de cada etapa, flutuando sobre a base.
function lupa() {
  const g = new THREE.Group();
  const aro = new THREE.Mesh(new THREE.TorusGeometry(0.3, 0.06, 16, 48), material());
  g.add(aro);
  const lente = new THREE.Mesh(new THREE.CircleGeometry(0.3, 40), new THREE.MeshBasicMaterial({ color: CIANO, transparent: true, opacity: 0.18, side: THREE.DoubleSide }));
  g.add(lente);
  const cabo = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.07, 0.42, 16), material());
  cabo.position.set(0.33, -0.33, 0);
  cabo.rotation.z = Math.PI / 4;
  g.add(cabo);
  return g;
}

function plano() {
  const g = new THREE.Group();
  for (let i = 0; i < 3; i += 1) {
    const geo = new THREE.BoxGeometry(0.78, 0.035, 0.56);
    const folha = new THREE.Mesh(geo, material(i === 2 ? 0x0d3a6b : 0x0a2e5a));
    folha.position.set(i * 0.06, i * 0.15 - 0.15, -i * 0.05);
    folha.add(contorno(geo, 0.6));
    g.add(folha);
  }
  for (let i = 0; i < 3; i += 1) {
    const traco = new THREE.Mesh(new THREE.BoxGeometry(0.42 - i * 0.1, 0.01, 0.035), new THREE.MeshBasicMaterial({ color: CIANO }));
    traco.position.set(0.04 + 0.12, 0.17, -0.12 + i * 0.1);
    g.add(traco);
  }
  g.rotation.x = 0.35;
  return g;
}

function rack() {
  const g = new THREE.Group();
  const geo = new THREE.BoxGeometry(0.5, 0.72, 0.42);
  const corpo = new THREE.Mesh(geo, material(0x081f3f));
  corpo.add(contorno(geo, 0.7));
  g.add(corpo);
  for (let i = 0; i < 4; i += 1) {
    const led = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.03, 0.01), new THREE.MeshBasicMaterial({ color: i === 3 ? 0x4dff9e : CIANO }));
    led.position.set(0, -0.24 + i * 0.16, 0.215);
    g.add(led);
  }
  return g;
}

function radar() {
  const g = new THREE.Group();
  const nucleo = new THREE.Mesh(new THREE.SphereGeometry(0.17, 32, 32), new THREE.MeshStandardMaterial({ color: CIANO, emissive: ACCENT, emissiveIntensity: 0.6 }));
  g.add(nucleo);
  const aneis = [];
  for (const [rx, raio] of [[1.2, 0.36], [0.3, 0.46]]) {
    const anel = new THREE.Mesh(new THREE.TorusGeometry(raio, 0.012, 8, 80), new THREE.MeshBasicMaterial({ color: CIANO, transparent: true, opacity: 0.8 }));
    anel.rotation.x = rx;
    const satelite = new THREE.Mesh(new THREE.SphereGeometry(0.035, 12, 12), new THREE.MeshBasicMaterial({ color: 0xffffff }));
    satelite.position.x = raio;
    anel.add(satelite);
    g.add(anel);
    aneis.push(anel);
  }
  g.userData.tick = (t) => {
    aneis[0].rotation.z = t * 1.1;
    aneis[1].rotation.z = -t * 0.8;
  };
  return g;
}

function base(simbolo, tex) {
  const g = new THREE.Group();
  const placa = new THREE.Mesh(new THREE.CylinderGeometry(0.62, 0.72, 0.16, 6), material(0x06203f));
  placa.position.y = 0.08;
  g.add(placa);
  const anel = new THREE.Mesh(new THREE.TorusGeometry(0.6, 0.022, 8, 6), new THREE.MeshBasicMaterial({ color: APAGADO.clone() }));
  anel.rotation.x = Math.PI / 2;
  anel.rotation.z = Math.PI / 6;
  anel.position.y = 0.165;
  g.add(anel);
  const onda = new THREE.Mesh(new THREE.RingGeometry(0.6, 0.66, 6), new THREE.MeshBasicMaterial({ color: CIANO, transparent: true, opacity: 0, side: THREE.DoubleSide, depthWrite: false }));
  onda.rotation.x = -Math.PI / 2;
  onda.rotation.z = Math.PI / 6;
  onda.position.y = 0.17;
  g.add(onda);
  const feixe = new THREE.Mesh(
    new THREE.CylinderGeometry(0.42, 0.56, 2.6, 6, 1, true),
    new THREE.ShaderMaterial({
      vertexShader: FEIXE_VERTICE,
      fragmentShader: FEIXE_FRAGMENTO,
      uniforms: { cor: { value: new THREE.Color(CIANO) }, forca: { value: 0 } },
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
    }),
  );
  feixe.position.y = 1.45;
  g.add(feixe);
  simbolo.position.y = 1.15;
  g.add(simbolo);
  const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, color: CIANO, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending }));
  halo.scale.setScalar(1.6);
  halo.position.y = 1.15;
  g.add(halo);

  const materiais = [];
  simbolo.traverse((objeto) => { if (objeto.material?.emissive) materiais.push(objeto.material); });
  const linhas = [];
  simbolo.traverse((objeto) => { if (objeto.isLineSegments) linhas.push(objeto.material); });

  let luz = 0;
  g.userData.atualizar = (alvo, t, fixo, fase) => {
    luz = fixo ? alvo : luz + (alvo - luz) * 0.08;
    anel.material.color.copy(APAGADO).lerp(ACESO, luz);
    feixe.material.uniforms.forca.value = luz;
    halo.material.opacity = 0.55 * luz;
    for (const m of materiais) m.emissive.setHex(ACCENT).multiplyScalar(0.05 + 0.55 * luz);
    for (const m of linhas) m.opacity = 0.25 + 0.65 * luz;
    simbolo.position.y = 1.15 + (fixo ? 0 : Math.sin(t * 1.4 + fase) * 0.07);
    simbolo.rotation.y = fixo ? 0.5 : t * 0.5 + fase;
    simbolo.userData.tick?.(t);
    const ciclo = fixo ? 0.5 : (t * 0.6 + fase) % 1;
    onda.scale.setScalar(1 + ciclo * 0.9);
    onda.material.opacity = luz * (1 - ciclo) * 0.7;
  };
  return g;
}

/**
 * Liga o caminho 3D. Lança erro sem WebGL (quem chama mostra a reserva).
 * @param estado rastreador de acompanharPassos (posição contínua de 0 a 3)
 * @returns {() => void} para o laço e libera a GPU
 */
export function initPassos3D(raiz, { reducedMotion = false, compact = false, estado } = {}) {
  const canvas = raiz.querySelector('.palco canvas');
  const palco = canvas.parentElement;
  const renderer = criarRenderer(THREE, canvas, { compact });
  renderer.toneMappingExposure = 1.15;
  const cena = new THREE.Scene();
  cena.fog = new THREE.Fog(0x021a3a, 9, 17);
  const camera = new THREE.PerspectiveCamera(36, 1, 0.1, 40);
  cena.add(new THREE.HemisphereLight(0x9fe8ff, 0x021a3a, 1.0));
  const sol = new THREE.DirectionalLight(0xffffff, 1.8);
  sol.position.set(2, 6, 4);
  cena.add(sol);
  const tex = brilho();

  const grade = new THREE.GridHelper(16, 32, 0x1d6f9a, 0x0f3b63);
  grade.material.transparent = true;
  grade.material.opacity = 0.35;
  cena.add(grade);

  const curva = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-3.4, 0.03, 2.2),
    ...BASES.map((v) => v.clone().setY(0.2)),
    new THREE.Vector3(3.5, 0.03, -2.1),
  ], false, 'centripetal');
  // Posição de cada base ao longo do comprimento da trilha (o uv.x do tubo segue o comprimento).
  const amostras = 600;
  const marcos = BASES.map((alvo) => {
    let melhor = 0;
    let menor = Infinity;
    for (let i = 0; i <= amostras; i += 1) {
      const d = curva.getPointAt(i / amostras).distanceToSquared(alvo.clone().setY(0.2));
      if (d < menor) { menor = d; melhor = i / amostras; }
    }
    return melhor;
  });
  const trilha = new THREE.Mesh(
    new THREE.TubeGeometry(curva, compact ? 180 : 320, 0.045, 10, false),
    new THREE.ShaderMaterial({
      vertexShader: TRILHA_VERTICE,
      fragmentShader: TRILHA_FRAGMENTO,
      uniforms: {
        progresso: { value: marcos[0] },
        tempo: { value: 0 },
        acesa: { value: new THREE.Color(CIANO) },
        apagada: { value: new THREE.Color(0x1d4a74) },
      },
      transparent: true,
    }),
  );
  cena.add(trilha);

  const simbolos = [lupa(), plano(), rack(), radar()];
  const bases = BASES.map((posicao, i) => {
    const b = base(simbolos[i], tex);
    b.position.copy(posicao);
    cena.add(b);
    return b;
  });

  // Luz que caminha na trilha.
  const cabeca = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, color: 0xbafcff, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
  cabeca.scale.setScalar(0.9);
  cena.add(cabeca);
  const luzCabeca = new THREE.PointLight(CIANO, 8, 4);
  cena.add(luzCabeca);

  // Partículas subindo devagar.
  const N = compact ? 50 : 90;
  const particulas = new Float32Array(N * 3);
  const sementes = Array.from({ length: N }, (_, i) => [((i * 97) % 100) / 100, ((i * 57) % 100) / 100, ((i * 31) % 100) / 100]);
  const particulasGeo = new THREE.BufferGeometry();
  particulasGeo.setAttribute('position', new THREE.BufferAttribute(particulas, 3));
  const nuvem = new THREE.Points(particulasGeo, new THREE.PointsMaterial({ color: CIANO, size: 0.07, map: tex, transparent: true, opacity: 0.7, depthWrite: false, blending: THREE.AdditiveBlending }));
  nuvem.frustumCulled = false;
  cena.add(nuvem);

  const ajustar = () => {
    const caixa = palco.getBoundingClientRect();
    if (!caixa.width || !caixa.height) return;
    renderer.setSize(caixa.width, caixa.height, false);
    camera.aspect = caixa.width / caixa.height;
    const meiaLargura = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * camera.aspect;
    distancia = Math.max(7.4, 3.6 / meiaLargura);
    camera.updateProjectionMatrix();
    ciclo?.pedir();
  };
  let distancia = 8;

  let mx = 0;
  let my = 0;
  const aoMover = (event) => { mx = event.clientX / window.innerWidth - 0.5; my = event.clientY / window.innerHeight - 0.5; };
  if (!reducedMotion) window.addEventListener('pointermove', aoMover, { passive: true });

  let caminho = reducedMotion ? marcos[marcos.length - 1] : marcos[0];
  const ultimo = BASES.length - 1;
  const desenhar = (t, fixo) => {
    const posicao = Math.min(ultimo, Math.max(0, estado?.posicao ?? ultimo));
    const i = Math.min(ultimo - 1, Math.floor(posicao));
    const alvo = marcos[i] + (marcos[i + 1] - marcos[i]) * (posicao - i);
    caminho = fixo ? alvo : caminho + (alvo - caminho) * 0.08;
    trilha.material.uniforms.progresso.value = caminho;
    trilha.material.uniforms.tempo.value = t;
    const ponto = curva.getPointAt(Math.min(1, Math.max(0, caminho)));
    cabeca.position.copy(ponto);
    cabeca.scale.setScalar(0.8 + (fixo ? 0 : Math.sin(t * 4) * 0.12));
    luzCabeca.position.copy(ponto).setY(0.6);
    bases.forEach((b, n) => b.userData.atualizar(caminho >= marcos[n] - 0.004 ? 1 : 0.12, t, fixo, n * 1.7));
    for (let n = 0; n < N; n += 1) {
      const [a, b, c] = sementes[n];
      const subida = fixo ? b : (b + t * 0.05) % 1;
      particulas[n * 3] = (a - 0.5) * 9;
      particulas[n * 3 + 1] = subida * 3.2;
      particulas[n * 3 + 2] = (c - 0.5) * 6;
    }
    particulasGeo.attributes.position.needsUpdate = true;
    const balanco = fixo ? 0 : Math.sin(t * 0.25) * 0.35;
    camera.position.set(balanco + mx * 1.2, distancia * 0.62 - my * 0.8, distancia * 0.82);
    camera.lookAt(0, 0.45, 0);
    renderer.render(cena, camera);
  };

  const ciclo = laco(canvas, desenhar, { reducedMotion });
  const soltarContexto = vigiarContexto(canvas, raiz, ciclo);
  const redimensionar = new ResizeObserver(ajustar);
  redimensionar.observe(palco);
  ajustar();
  estado?.aoMudar(() => { if (reducedMotion) ciclo.pedir(); });
  raiz.classList.add('palco--3d');

  return () => {
    ciclo.parar();
    soltarContexto();
    redimensionar.disconnect();
    window.removeEventListener('pointermove', aoMover);
    raiz.classList.remove('palco--3d');
    liberar(cena);
    renderer.dispose();
  };
}
