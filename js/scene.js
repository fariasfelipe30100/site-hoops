// Cena 3D da primeira tela: corredor de racks com luzes, pulsos nas faixas e reação ao mouse.
import * as THREE from '../vendor/three.module.min.js?v=8';

function hasWebGL() {
  try {
    const probe = document.createElement('canvas');
    return Boolean(probe.getContext('webgl2'));
  } catch {
    return false;
  }
}

function glowTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 64;
  const context = canvas.getContext('2d');
  const gradient = context.createRadialGradient(32, 32, 0, 32, 32, 32);
  gradient.addColorStop(0, '#fff');
  gradient.addColorStop(0.25, 'rgba(255,255,255,.55)');
  gradient.addColorStop(1, 'rgba(255,255,255,0)');
  context.fillStyle = gradient;
  context.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(canvas);
}

/**
 * Desenha a cena no canvas. Lança erro se não houver WebGL.
 * @returns {() => void} função que para a cena e libera a GPU
 */
export function initScene(canvas, { reducedMotion = false, compact = false } = {}) {
  if (!hasWebGL()) throw new Error('WebGL indisponível');

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: !compact, powerPreference: 'high-performance' });
  renderer.setPixelRatio(compact ? 1 : Math.min(window.devicePixelRatio, 1.75));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.25;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x010e22);
  scene.fog = new THREE.FogExp2(0x03234a, 0.05);
  const camera = new THREE.PerspectiveCamera(46, 1, 0.1, 120);
  scene.add(new THREE.HemisphereLight(0x6fd0ff, 0x01101f, 0.55));

  const RACKS = compact ? 10 : 22;
  const STEP = 1.5;
  const X = 2.3;
  const UNITS = 13;
  const LEDS = 5;
  const HEIGHT = 3.7;
  const disposables = [];
  const track = (item) => { disposables.push(item); return item; };

  const body = new THREE.InstancedMesh(
    track(new THREE.BoxGeometry(0.9, HEIGHT, 1.42)),
    track(new THREE.MeshStandardMaterial({ color: 0x06182f, metalness: 0.75, roughness: 0.38 })),
    RACKS * 2,
  );
  const plate = new THREE.InstancedMesh(
    track(new THREE.BoxGeometry(0.02, 0.21, 1.25)),
    track(new THREE.MeshStandardMaterial({ color: 0x0d2c52, metalness: 0.7, roughness: 0.3 })),
    RACKS * 2 * UNITS,
  );
  const ledPositions = [];
  const ledColors = [];
  const dummy = new THREE.Object3D();
  let plateIndex = 0;
  let bodyIndex = 0;
  for (let i = 0; i < RACKS; i += 1) {
    for (const side of [-1, 1]) {
      const z = -i * STEP;
      dummy.position.set(side * (X + 0.45), HEIGHT / 2, z);
      dummy.updateMatrix();
      body.setMatrixAt(bodyIndex++, dummy.matrix);
      for (let u = 0; u < UNITS; u += 1) {
        const y = 0.3 + u * 0.25;
        dummy.position.set(side * X - side * 0.012, y, z);
        dummy.updateMatrix();
        plate.setMatrixAt(plateIndex++, dummy.matrix);
        for (let l = 0; l < LEDS; l += 1) {
          ledPositions.push(side * X - side * 0.03, y, z - 0.5 + l * 0.16 + (u % 2) * 0.05);
          const color = new THREE.Color(Math.random() < 0.08 ? 0x4dff9e : 0x35f2f9);
          ledColors.push(color.r, color.g, color.b);
        }
      }
    }
  }
  scene.add(body, plate);

  const glow = track(glowTexture());
  const ledGeometry = track(new THREE.BufferGeometry());
  ledGeometry.setAttribute('position', new THREE.Float32BufferAttribute(ledPositions, 3));
  const baseColors = Float32Array.from(ledColors);
  const colorAttribute = new THREE.BufferAttribute(new Float32Array(ledColors), 3);
  ledGeometry.setAttribute('color', colorAttribute);
  scene.add(new THREE.Points(ledGeometry, track(new THREE.PointsMaterial({
    size: 0.16, map: glow, vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  }))));

  const stripMaterial = track(new THREE.MeshBasicMaterial({ color: 0x35f2f9 }));
  const stripGeometry = track(new THREE.BoxGeometry(0.035, 0.02, 60));
  for (const [x, y] of [[-1.15, 0.01], [1.15, 0.01], [-1.5, 3.9], [1.5, 3.9]]) {
    const strip = new THREE.Mesh(stripGeometry, stripMaterial);
    strip.position.set(x, y, -22);
    scene.add(strip);
  }
  const floor = new THREE.Mesh(
    track(new THREE.PlaneGeometry(14, 80)),
    track(new THREE.MeshStandardMaterial({ color: 0x041a36, metalness: 0.92, roughness: 0.22 })),
  );
  floor.rotation.x = -Math.PI / 2;
  floor.position.z = -24;
  scene.add(floor);
  for (let i = 0; i < 4; i += 1) {
    const light = new THREE.PointLight(0x35f2f9, 26, 16, 1.5);
    light.position.set(0, 3.1, -3 - i * 8);
    scene.add(light);
  }

  const PULSES = compact ? 24 : 46;
  const pulseGeometry = track(new THREE.BufferGeometry());
  const pulses = new Float32Array(PULSES * 3);
  const speeds = [];
  for (let i = 0; i < PULSES; i += 1) {
    pulses[i * 3] = (i % 2 ? 1 : -1) * (i % 4 < 2 ? 1.15 : 1.5);
    pulses[i * 3 + 1] = i % 4 < 2 ? 0.03 : 3.9;
    pulses[i * 3 + 2] = -Math.random() * 44;
    speeds.push(3 + Math.random() * 5);
  }
  pulseGeometry.setAttribute('position', new THREE.BufferAttribute(pulses, 3));
  scene.add(new THREE.Points(pulseGeometry, track(new THREE.PointsMaterial({
    size: 0.5, map: glow, color: 0xbafcff, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  }))));

  let pointerX = 0;
  let pointerY = 0;
  let smoothX = 0;
  let smoothY = 0;
  let frame = 0;
  let last = 0;
  let count = 0;
  let visible = true;
  let stopped = false;

  const placeCamera = (ms) => {
    smoothX += (pointerX - smoothX) * 0.05;
    smoothY += (pointerY - smoothY) * 0.05;
    const advance = reducedMotion ? 0 : (ms * 0.00035) % STEP;
    camera.position.set(0.62 + smoothX * 0.9, 1.75 - smoothY * 0.5, 7.5 - advance - window.scrollY * 0.004);
    camera.lookAt(-0.55 + smoothX * 1.6, 1.8 - smoothY * 0.6, -16);
  };

  const render = (ms = 0) => {
    placeCamera(ms);
    renderer.render(scene, camera);
  };

  const resize = () => {
    const box = canvas.parentElement.getBoundingClientRect();
    if (!box.width || !box.height) return;
    renderer.setSize(box.width, box.height, false);
    camera.aspect = box.width / box.height;
    camera.updateProjectionMatrix();
    if (reducedMotion) render(last);
  };

  const tick = (ms) => {
    frame = 0;
    if (stopped || !visible) return;
    const dt = Math.min((ms - last) / 1000, 0.05);
    last = ms;
    for (let i = 0; i < PULSES; i += 1) {
      pulses[i * 3 + 2] += speeds[i] * dt;
      if (pulses[i * 3 + 2] > 9) pulses[i * 3 + 2] = -44;
    }
    pulseGeometry.attributes.position.needsUpdate = true;
    count += 1;
    if (count % 5 === 0) {
      for (let n = 0; n < 340; n += 1) {
        const i = (Math.random() * baseColors.length / 3) | 0;
        const factor = Math.random() < 0.3 ? 0.12 : 1;
        for (let c = 0; c < 3; c += 1) colorAttribute.array[i * 3 + c] = baseColors[i * 3 + c] * factor;
      }
      colorAttribute.needsUpdate = true;
    }
    render(ms);
    frame = requestAnimationFrame(tick);
  };

  const start = () => {
    if (!reducedMotion && !stopped && !frame) {
      last = performance.now();
      frame = requestAnimationFrame(tick);
    }
  };

  const onPointer = (event) => {
    pointerX = event.clientX / window.innerWidth - 0.5;
    pointerY = event.clientY / window.innerHeight - 0.5;
  };

  const observer = new IntersectionObserver(([entry]) => {
    visible = entry.isIntersecting;
    if (visible) start();
  });
  const resizeObserver = new ResizeObserver(resize);

  resize();
  render(0);
  observer.observe(canvas);
  resizeObserver.observe(canvas.parentElement);
  if (!reducedMotion) {
    window.addEventListener('pointermove', onPointer, { passive: true });
    start();
  }

  return () => {
    stopped = true;
    cancelAnimationFrame(frame);
    observer.disconnect();
    resizeObserver.disconnect();
    window.removeEventListener('pointermove', onPointer);
    body.dispose();
    plate.dispose();
    for (const item of disposables) item.dispose();
    renderer.dispose();
  };
}
