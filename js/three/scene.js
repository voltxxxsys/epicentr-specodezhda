/* ==========================================================================
   ЭПИЦЕНТР — 3D-сцена главного экрана.
   Манекен на реальном скелете (rig.js), 9 слоёв экипировки, фон «жидкий металл».
   Два режима движения:
     • spin    — горизонтальный турн: манекен вращается, одежда садится слоями;
     • vertical — вертикальный: фото-карточки товаров поднимаются снизу и
                  «превращаются» в надетую экипировку (удобно для телефона).
   ========================================================================== */
import * as THREE from '../../vendor/three/three.module.js';
import { createRig, clamp, smooth, damp, LAYERS } from './rig.js';

export { clamp, smooth, damp };

/* ------------------------------------------------------------ материалы */
const SPRITE_KEYS = LAYERS.map((l) => l.key);

function studioEquirect(w = 1024, h = 512) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const g = c.getContext('2d');
  const bg = g.createLinearGradient(0, 0, 0, h);
  bg.addColorStop(0, '#6d7683');
  bg.addColorStop(0.3, '#262b32');
  bg.addColorStop(0.55, '#14171b');
  bg.addColorStop(1, '#0a0b0d');
  g.fillStyle = bg; g.fillRect(0, 0, w, h);
  for (const [x, y, r, a] of [[0.22, 0.06, 0.1, 0.95], [0.58, 0.04, 0.13, 0.8], [0.84, 0.1, 0.07, 0.45]]) {
    const rg = g.createRadialGradient(x * w, y * h, 2, x * w, y * h, r * w);
    rg.addColorStop(0, `rgba(255,255,255,${a})`);
    rg.addColorStop(0.5, `rgba(210,220,235,${a * 0.25})`);
    rg.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = rg; g.fillRect(0, 0, w, h);
  }
  for (const [y, a] of [[0.2, 0.55], [0.34, 0.3]]) {
    const lg = g.createLinearGradient(0, 0, w, 0);
    for (let i = 0; i <= 10; i++) {
      const t = i / 10;
      lg.addColorStop(t, `rgba(240,246,255,${(0.25 + 0.75 * Math.abs(Math.sin(t * 9.4))) * a * 0.5})`);
    }
    g.fillStyle = lg;
    g.fillRect(0, y * h, w, h * 0.012);
  }
  const warm = g.createRadialGradient(0.74 * w, 0.66 * h, 4, 0.74 * w, 0.66 * h, 0.26 * w);
  warm.addColorStop(0, 'rgba(255,132,44,0.55)');
  warm.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = warm; g.fillRect(0, 0, w, h);
  const cool = g.createRadialGradient(0.14 * w, 0.5 * h, 4, 0.14 * w, 0.5 * h, 0.22 * w);
  cool.addColorStop(0, 'rgba(150,185,235,0.35)');
  cool.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = cool; g.fillRect(0, 0, w, h);
  const floor = g.createLinearGradient(0, h * 0.82, 0, h);
  floor.addColorStop(0, 'rgba(0,0,0,0)');
  floor.addColorStop(1, 'rgba(58,64,74,0.4)');
  g.fillStyle = floor; g.fillRect(0, 0, w, h);
  const t = new THREE.CanvasTexture(c);
  t.mapping = THREE.EquirectangularReflectionMapping;
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function fabricNormal(size = 512) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d');
  g.fillStyle = '#8080ff'; g.fillRect(0, 0, size, size);
  const step = size / 96;
  for (let i = 0; i < 96; i++) {
    for (let j = 0; j < 96; j++) {
      const v = ((i + j) % 2 ? 1 : -1) * 8 + (Math.random() * 8 - 4);
      g.fillStyle = `rgb(${128 + v},${128 + v},255)`;
      g.fillRect(i * step, j * step, step, step);
    }
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(6, 6);
  return t;
}

function logoDecal() {
  const c = document.createElement('canvas');
  c.width = 512; c.height = 160;
  const g = c.getContext('2d');
  g.fillStyle = '#ffffff';
  g.font = '700 62px Inter, Arial, sans-serif';
  g.textBaseline = 'middle';
  g.fillText('ЭПИЦЕНТР', 28, 58);
  g.fillStyle = '#ff6a1a';
  g.font = '600 30px Inter, Arial, sans-serif';
  g.fillText('СПЕЦОДЕЖДА · ПЕНЗА', 30, 118);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function makeMaterials(env) {
  const nrm = fabricNormal();
  const fabric = new THREE.MeshPhysicalMaterial({
    color: 0x232833, roughness: 0.9, metalness: 0.02,
    normalMap: nrm, normalScale: new THREE.Vector2(0.4, 0.4),
    sheen: 0.5, sheenRoughness: 0.85, sheenColor: new THREE.Color(0x2b3340),
    envMap: env, envMapIntensity: 0.55, side: THREE.FrontSide,
  });
  return {
    chrome: new THREE.MeshPhysicalMaterial({
      color: 0xcfd6df, metalness: 1, roughness: 0.13, envMap: env, envMapIntensity: 1.5,
    }),
    fabric,
    fabricDark: fabric.clone(),
    accent: new THREE.MeshPhysicalMaterial({
      color: 0xff6a1a, roughness: 0.45, metalness: 0.1, envMap: env, envMapIntensity: 0.8,
      emissive: new THREE.Color(0xff6a1a), emissiveIntensity: 0.2,
    }),
    logo: new THREE.MeshBasicMaterial({ map: logoDecal(), transparent: true, depthWrite: false }),
    spritePlaceholder: new THREE.MeshBasicMaterial({ color: 0x2a313c, transparent: true, opacity: 0 }),
    sprite: {},
  };
}

/* ------------------------------------------------ загрузка фото-карточек */
async function loadSprites(materials) {
  let meta = {};
  try {
    const r = await fetch('assets/rig/sprites.json');
    if (r.ok) {
      const list = await r.json();
      for (const item of list) meta[item.sprite.split('/').pop().replace('.png', '')] = item.aspect;
    }
  } catch { /* мета необязательна */ }

  const loader = new THREE.TextureLoader();
  await Promise.all(LAYERS.map(async (def) => {
    const name = def.sprite.split('/').pop().replace('.png', '');
    try {
      const tex = await loader.loadAsync(def.sprite);
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.anisotropy = 4;
      tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;
      materials.sprite[def.key] = new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false });
      def.spriteAspect = meta[name] || (tex.image.width / tex.image.height);
    } catch {
      materials.sprite[def.key] = materials.spritePlaceholder;
    }
  }));
}

/* ------------------------------------------- фон: жидкий металл (шейдер) */
const LIQUID_VERT = 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.999, 1.0); }';
const LIQUID_FRAG = /* glsl */`
  precision highp float;
  varying vec2 vUv;
  uniform float uTime; uniform vec2 uRes; uniform vec2 uMouse;
  uniform float uEnergy; uniform sampler2D uEnv; uniform vec3 uAccent;
  float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123); }
  float noise(vec2 p){
    vec2 i = floor(p), f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    float a = hash(i), b = hash(i + vec2(1.0, 0.0)), c = hash(i + vec2(0.0, 1.0)), d = hash(i + vec2(1.0, 1.0));
    return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
  }
  float fbm(vec2 p){
    float s = 0.0, a = 0.5;
    mat2 rot = mat2(0.8, 0.6, -0.6, 0.8);
    for (int i = 0; i < 4; i++){ s += a * noise(p); p = rot * p * 2.03; a *= 0.5; }
    return s;
  }
  float height(vec2 p){
    float t = uTime * 0.062;
    mat2 rot = mat2(0.8, 0.6, -0.6, 0.8);
    vec2 q = vec2(fbm(p * 0.34 + vec2(0.0, t)), fbm(p * 0.34 + vec2(4.2, -t)));
    float h = fbm(p * 0.46 + 0.9 * q + t * 0.35);
    h += 0.45 * noise(p * 1.35 + q * 0.6 + t * 0.9);
    float edge = smoothstep(0.2, 1.2, length((vUv - 0.5) * vec2(uRes.x / uRes.y, 1.0)) * 1.7);
    h += edge * 0.1 * (0.7 + 0.3 * sin(p.x * 1.1 + t * 2.0));
    return h * (1.0 + uEnergy * 0.35);
  }
  void main(){
    vec2 uv = vUv;
    vec2 p = (uv - 0.5) * vec2(uRes.x / uRes.y, 1.0) * 3.0;
    p += (uMouse - 0.5) * 0.3;
    float e = 0.014;
    float h = height(p), hx = height(p + vec2(e, 0.0)), hy = height(p + vec2(0.0, e));
    vec3 n = normalize(vec3((h - hx) * 14.0, (h - hy) * 14.0, 1.0));
    n.xy += vec2(sin(p.y * 1.3 - uTime * 0.12), cos(p.x * 1.1 + uTime * 0.1)) * 0.07 * (0.5 + uEnergy * 0.6);
    vec3 viewDir = normalize(vec3((uv - 0.5) * 1.1, -1.0));
    vec3 refl = reflect(viewDir, normalize(n));
    refl.z = -abs(refl.z);
    vec2 euv = vec2(atan(refl.y, refl.x) / 6.2831853 + 0.5, clamp(refl.z * 0.55 + 0.32, 0.0, 1.0));
    vec3 env = texture2D(uEnv, euv).rgb;
    vec2 euv2 = vec2(atan(-refl.y, refl.x) / 6.2831853 + 0.25, clamp(refl.z * 0.9 + 0.55, 0.0, 1.0));
    env = mix(env, texture2D(uEnv, euv2).rgb * 0.75, 0.28);
    float fres = pow(1.0 - clamp(dot(viewDir, n), 0.0, 1.0), 4.0);
    vec3 chrome = env * 1.15 + vec3(0.016, 0.019, 0.025);
    chrome += vec3(0.5, 0.56, 0.64) * fres * 0.7;
    chrome += uAccent * fres * 0.5;
    chrome *= mix(0.4, 1.15, smoothstep(-0.1, 0.9, h));
    float crest = smoothstep(0.72, 0.88, h);
    chrome += crest * env * 0.85 + crest * 0.04;
    chrome *= mix(0.32, 1.0, smoothstep(0.2, 0.78, h));
    chrome += uAccent * smoothstep(0.66, 0.0, uv.y) * 0.05;
    chrome += vec3(0.02, 0.028, 0.045) * smoothstep(0.42, 1.0, uv.y);
    float vig = smoothstep(1.5, 0.15, length((uv - 0.5) * vec2(1.05, 1.0)) * 1.5);
    float scrim = smoothstep(0.5, 0.0, uv.x) * 0.55 + 0.72;
    chrome *= (0.32 + 0.78 * vig) * scrim;
    chrome += (hash(uv * uRes.xy + fract(uTime) * 91.7) - 0.5) * 0.016;
    gl_FragColor = vec4(chrome, 1.0);
  }
`;

/* ================================================================== СЦЕНА */
export async function createHero(canvas, opts = {}) {
  let mode = opts.mode === 'vertical' ? 'vertical' : 'spin';
  const zoomRef = { v: Number(opts.zoom || 1) }; // >1 — камера ближе
  const autoSpin = Number(opts.autoSpin || 0);   // рад/с, 0 — выключено
  const lookY = opts.lookY != null ? Number(opts.lookY) : null;
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: 'high-performance' });
  renderer.setClearColor(0x05060a, 1);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.06;
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 60);
  // ортокамера для вертикального «конструктора»: фигура без перспективных искажений
  const ortho = new THREE.OrthographicCamera(-1, 1, 1, -1, -20, 40);
  const view = { lookX: 0.44, lookY: 0.98, z: 5.35 };
  let activeCam = camera;
  camera.position.set(0, 1.32, view.z);
  camera.lookAt(view.lookX, view.lookY, 0);

  const envTex = studioEquirect();
  const pmrem = new THREE.PMREMGenerator(renderer);
  pmrem.compileEquirectangularShader();
  const envRT = pmrem.fromEquirectangular(envTex);
  scene.environment = envRT.texture;
  const materials = makeMaterials(envRT.texture);

  /* фон */
  const liquid = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.ShaderMaterial({
    vertexShader: LIQUID_VERT, fragmentShader: LIQUID_FRAG, depthTest: false, depthWrite: false,
    uniforms: {
      uTime: { value: 0 }, uRes: { value: new THREE.Vector2(1, 1) }, uMouse: { value: new THREE.Vector2(0.5, 0.5) },
      uEnergy: { value: 0 }, uEnv: { value: envTex }, uAccent: { value: new THREE.Color(0.55, 0.24, 0.08) },
    },
  }));
  liquid.frustumCulled = false;
  liquid.renderOrder = -1;
  scene.add(liquid);

  /* свет */
  const key = new THREE.DirectionalLight(0xdfe8ff, 2.3);
  key.position.set(3.4, 5.2, 3.6);
  scene.add(key);
  const rim = new THREE.DirectionalLight(0xffffff, 1.9);
  rim.position.set(-3.6, 3.2, -3.4);
  scene.add(rim);
  const accentLight = new THREE.PointLight(0xff6a1a, 26, 12, 2);
  accentLight.position.set(2.3, 1.05, 1.7);
  scene.add(accentLight);
  const coolFill = new THREE.PointLight(0x6f9dff, 12, 12, 2);
  coolFill.position.set(-2.4, 1.7, -1.2);
  scene.add(coolFill);
  scene.add(new THREE.AmbientLight(0x2b3340, 0.55));

  /* подиум */
  const STAGE_X = 0.95;
  const pedestal = new THREE.Mesh(
    new THREE.CylinderGeometry(0.58, 0.64, 0.07, 64),
    new THREE.MeshPhysicalMaterial({ color: 0x15181e, metalness: 0.75, roughness: 0.22, envMap: envRT.texture, envMapIntensity: 1.5 })
  );
  pedestal.position.set(STAGE_X, -0.035, 0);
  scene.add(pedestal);
  const pedestalRing = new THREE.Mesh(
    new THREE.TorusGeometry(0.6, 0.004, 8, 96),
    new THREE.MeshBasicMaterial({ color: 0xff6a1a, transparent: true, opacity: 0.5 })
  );
  pedestalRing.rotation.x = Math.PI / 2;
  pedestalRing.position.set(STAGE_X, 0.005, 0);
  scene.add(pedestalRing);

  const floorFade = new THREE.Mesh(new THREE.CircleGeometry(3.4, 48), new THREE.ShaderMaterial({
    transparent: true, depthWrite: false,
    vertexShader: 'varying vec2 vP; void main(){ vP = position.xy; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
    fragmentShader: 'varying vec2 vP; void main(){ float d = length(vP) / 3.4; float a = smoothstep(0.22, 1.0, d) * 0.55; gl_FragColor = vec4(0.012, 0.014, 0.02, a); }',
  }));
  floorFade.rotation.x = -Math.PI / 2;
  floorFade.position.set(STAGE_X, 0.002, 0);
  scene.add(floorFade);

  /* спицы на полу */
  const spokes = new THREE.Group();
  const spokeMat = new THREE.MeshBasicMaterial({ color: 0x6a7480, transparent: true, opacity: 0.22 });
  spokes.position.set(STAGE_X, 0.004, 0);
  for (let i = 0; i < 48; i++) {
    const a = (i / 48) * Math.PI * 2;
    const long = i % 4 === 0;
    const bar = new THREE.Mesh(new THREE.BoxGeometry(long ? 0.14 : 0.06, 0.002, 0.005), spokeMat);
    bar.position.set(Math.cos(a) * (long ? 0.52 : 0.55), 0, Math.sin(a) * (long ? 0.52 : 0.55));
    bar.rotation.y = -a;
    spokes.add(bar);
  }

  /* риг и экипировка */
  const turntable = new THREE.Group();
  scene.add(turntable);
  const figure = new THREE.Group();
  figure.position.x = STAGE_X;
    figure.scale.setScalar(0.94);
  turntable.add(figure);

  const rig = createRig(materials);
  figure.add(rig.root);
  turntable.add(spokes);

  /* мягкая тень */
  const shadowTex = (() => {
    const c = document.createElement('canvas');
    c.width = c.height = 256;
    const g = c.getContext('2d');
    const rg = g.createRadialGradient(128, 128, 2, 128, 128, 128);
    rg.addColorStop(0, 'rgba(0,0,0,0.75)');
    rg.addColorStop(0.55, 'rgba(0,0,0,0.26)');
    rg.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = rg; g.fillRect(0, 0, 256, 256);
    return new THREE.CanvasTexture(c);
  })();
  const softShadow = new THREE.Mesh(
    new THREE.PlaneGeometry(0.78, 0.78),
    new THREE.MeshBasicMaterial({ map: shadowTex, transparent: true, depthWrite: false, opacity: 0.6 })
  );
  softShadow.rotation.x = -Math.PI / 2;
  softShadow.position.set(STAGE_X, 0.011, 0);
  turntable.add(softShadow);

  /* фото-карточки товаров */
  await loadSprites(materials);
  // пересобираем спрайты с учётом фактических пропорций
  rig.layers.forEach((layer) => {
    const def = layer.def;
    const mat = materials.sprite[def.key] || materials.spritePlaceholder;
    for (const plane of layer.sprites) {
      plane.material = mat.clone();
      const aspect = def.spriteAspect || 0.75;
      const cropT = def.crop ? def.crop[0] : 0;
      const cropB = def.crop ? def.crop[1] : 0;
      const visible = Math.max(0.15, 1 - cropT - cropB);
      const h = def.spriteH * visible;
      plane.geometry.dispose();
      plane.geometry = new THREE.PlaneGeometry(def.spriteH * aspect, h);
      plane.userData.baseH = h;
      if (plane.material.map) {
        plane.material.map = plane.material.map.clone();
        plane.material.map.repeat.set(1, visible);
        plane.material.map.offset.set(0, cropB);
        plane.material.map.needsUpdate = true;
      }
    }
  });

  /* ------------------------------------------------------------- размеры */
  let dpr = Math.min(window.devicePixelRatio || 1, 1.6);
  let quality = 1;
  let portraitLayout = false;

  function resize() {
    const w = canvas.clientWidth || canvas.parentElement.clientWidth;
    const h = canvas.clientHeight || canvas.parentElement.clientHeight;
    renderer.setPixelRatio(dpr * quality);
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    const fit = clamp(w / h, 0.42, 2.4);
    portraitLayout = fit < 1.05;
    const vertical = mode === 'vertical';
    if (vertical) {
      // «конструктор»: фигура по центру, масштаб 1:1, плоская проекция
      figure.scale.setScalar(1);
      figure.position.set(0, 0, 0);
      view.lookX = 0;
      view.lookY = 0.95;
      // высота кадра ~2,05 м: фигура 1,86 м влезает целиком с полями
      const halfH = fit > 1.4 ? 1.2 : 1.025;
      const halfW = halfH * (w / h);
      ortho.left = -halfW; ortho.right = halfW; ortho.top = halfH; ortho.bottom = -halfH;
      const oy = lookY != null ? lookY : 0.95;
      ortho.position.set(0, oy, 4);
      ortho.lookAt(0, oy, 0);
      ortho.zoom = zoomRef.v;
      ortho.updateProjectionMatrix();
      ortho.updateProjectionMatrix();
      activeCam = ortho;
    } else {
      figure.scale.setScalar(portraitLayout ? 0.86 : 0.94);
      figure.position.set(portraitLayout ? 0 : STAGE_X, 0, 0);
      // в конфигураторе (без текста слева) фигура стоит по центру
      view.lookX = portraitLayout ? 0 : (opts.center ? 0 : 0.44);
      view.lookY = lookY != null ? lookY : 0.98;
      view.z = (portraitLayout ? 4.5 : 5.35) / zoomRef.v;
      camera.position.z = view.z;
      camera.position.x = 0;
      camera.position.y = 1.3;
      camera.lookAt(view.lookX, view.lookY, 0);
      camera.updateProjectionMatrix();
      activeCam = camera;
    }
    const u = liquid.material.uniforms.uRes.value;
    u.set(w * dpr * quality, h * dpr * quality);
  }
  resize();
  window.addEventListener('resize', resize);

  /* ------------------------------------------------------------ указатель */
  const mouse = new THREE.Vector2(0.5, 0.5);
  const mouseTarget = new THREE.Vector2(0.5, 0.5);
  canvas.addEventListener('pointermove', (e) => {
    const r = canvas.getBoundingClientRect();
    mouseTarget.set((e.clientX - r.left) / r.width, 1 - (e.clientY - r.top) / r.height);
  });
  canvas.addEventListener('pointerleave', () => mouseTarget.set(0.5, 0.5));

  /* ---------------------------------------------------- таймлайн по слоям */
  const stages = rig.layers.map((layer, i) => ({
    layer,
    start: i === 0 ? 0 : 0.05 + (i - 0.35) * 0.104,
    end: i === 0 ? 0.09 : 0.05 + (i - 0.35) * 0.104 + 0.088,
  }));
  const maxEnd = Math.max(...stages.map((s) => s.end));
  stages.forEach((s) => { s.start = (s.start / maxEnd) * 0.92; s.end = (s.end / maxEnd) * 0.92; });

  const api = {
    get mode() { return mode; },
    setMode(next) {
      mode = next === 'vertical' ? 'vertical' : 'spin';
      rig.setMode(mode === 'vertical' ? 'sprite' : 'shell');
      resize();
    },
    get progress() { return state.progress; },
    get camera() { return activeCam; },
    /** добавить поворот вручную (перетаскивание мышью) */
    nudge(rad) { state.target = clamp(state.target + rad / (Math.PI * 1.15)); },
    /** множитель зума */
    setZoom(z) { zoomRef.v = clamp(z, 0.6, 2.2); resize(); },
    setProgress(p) { state.target = clamp(p); },
    snap(p) { state.progress = state.target = clamp(p); },
    showOnly(key) {
      for (const st of stages) {
        const on = st.layer.key === key ? 0 : 1;
        for (const [, , rev] of []) void rev;
        st.layer.reveal = on;
      }
    },
    stages: stages.map((s) => ({ key: s.layer.key, title: s.layer.title, caption: s.layer.caption })),
    dispose() { window.removeEventListener('resize', resize); renderer.dispose(); },
  };

  rig.setMode(mode === 'vertical' ? 'sprite' : 'shell');

  const state = { progress: 0, target: 0, rotation: -0.4, rotationTarget: -0.4, energy: 0, time: 0 };

  /* ---------------------------------------------------------- анимация */
  const clock = new THREE.Clock();
  let running = true;
  let frames = 0, acc = 0;

  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver((entries) => {
      for (const e of entries) {
        if (e.isIntersecting && !running) { running = true; clock.getDelta(); frame(); }
        else if (!e.isIntersecting) running = false;
      }
    }, { rootMargin: '200px' });
    io.observe(canvas);
  }

  function frame() {
    if (!running) return;
    const dt = Math.min(clock.getDelta(), 0.05);
    state.time += dt;

    acc += dt; frames++;
    if (frames >= 60) {
      const avg = acc / frames;
      if (avg > 0.075) { quality = 0.5; resize(); }
      else if (avg > 0.045 && quality > 0.6) { quality = 0.68; resize(); }
      frames = 0; acc = 0;
    }

    state.progress = damp(state.progress, state.target, 4.4, dt);

    // поворот фигуры: в «Турне» крутим по скроллу, в «Вертикали» фигура строго
    // лицом к зрителю — иначе плоские фото-карточки встают ребром
    if (mode === 'spin') {
      state.rotationTarget = -0.4 + state.progress * Math.PI * 1.15 + state.time * autoSpin;
      state.rotation = damp(state.rotation, state.rotationTarget, 6.5, dt);
      turntable.rotation.y = state.rotation + Math.sin(state.time * 0.25) * 0.03;
      // компенсируем орбиту: иначе при повороте фигура «уезжает» в сторону
      if (!portraitLayout) figure.position.x = STAGE_X * Math.cos(turntable.rotation.y);
    } else {
      turntable.rotation.y = 0;
      state.rotation = state.rotationTarget = 0;
    }

    // фон
    state.energy = damp(state.energy, 0.15 + state.progress * 0.85, 2.2, dt);
    liquid.material.uniforms.uTime.value = state.time;
    liquid.material.uniforms.uEnergy.value = state.energy;
    mouse.x = damp(mouse.x, mouseTarget.x, 3.5, dt);
    mouse.y = damp(mouse.y, mouseTarget.y, 3.5, dt);
    liquid.material.uniforms.uMouse.value.set(mouse.x, mouse.y);

    // камера: в турне слегка следим за указателем, в вертикальном — статична
    if (mode === 'spin') {
      camera.position.x = damp(camera.position.x, (mouse.x - 0.5) * 0.25, 3, dt);
      camera.position.y = damp(camera.position.y, 1.3 + (mouse.y - 0.5) * 0.14, 3, dt);
      camera.lookAt(view.lookX, view.lookY, 0);
    } else {
      ortho.position.x = damp(ortho.position.x, (mouse.x - 0.5) * 0.12, 3, dt);
    }

    // слои: оболочка «надевается», фото-карточка улетает/растворяется
    let gloveShow = 0;
    for (let i = 0; i < stages.length; i++) {
      const st = stages[i];
      const layer = st.layer;
      let raw = smooth(state.progress, st.start, st.end);
      if (i === 0) raw = Math.max(raw, 1 - smooth(state.progress, 0, 0.07));
      const reveal = clamp(1 - raw);
      if (Math.abs(reveal - layer.reveal) > 0.002) {
        layer.reveal = reveal;
        layer.shells.visible = mode === 'spin' && reveal < 0.995;
        for (const mesh of layer.shells.children) {
          if (mesh.isMesh) applyReveal(mesh, reveal);
          else mesh.traverse((o) => { if (o.isMesh) applyReveal(o, reveal); });
        }
      }

      // фото-карточки товаров — только в «Вертикали»: там они приезжают снизу
      // и складываются в плоский комплект. В «Турне» работает объёмная одежда.
      if (mode === 'vertical') {
        const riseStart = Math.max(0, st.start - 0.1);
        const travel = smooth(state.progress, riseStart, st.start);        // 0→1: путь до места
        const fade = smooth(state.progress, riseStart, riseStart + 0.035);
        const alpha = fade * (1 - 0.3 * smooth(state.progress, st.start + 0.04, st.start + 0.16));
        rig.setSprite(layer, travel, 'below');
        rig.setSpriteAlpha(layer, alpha);
      } else if (layer.spriteAlpha !== 0) {
        rig.setSpriteAlpha(layer, 0);
      }

      if (layer.key === 'gloves') gloveShow = raw;
      st.current = raw;
    }

    rig.tick(state.time);

    accentLight.intensity = 24 + Math.sin(state.time * 0.8) * 5 + state.progress * 12;
    pedestalRing.material.opacity = 0.35 + state.progress * 0.45;

    addFrames();
    renderer.render(scene, activeCam);
    requestAnimationFrame(frame);
  }

  let frameCount = 0;
  function addFrames() {
    frameCount++;
    window.__heroFrames = frameCount;
  }

  /** растворение оболочки по 3D-шуму (discard, без прозрачности) */
  function applyReveal(mesh, value) {
    const mat = mesh.material;
    if (!mat.userData.shader) {
      mat.transparent = false;
      mat.onBeforeCompile = (shader) => {
        shader.uniforms.uReveal = { value: 1 };
        shader.vertexShader = shader.vertexShader
          .replace('#include <common>', '#include <common>\nvarying vec3 vRp;')
          .replace('#include <begin_vertex>', '#include <begin_vertex>\nvRp = position;');
        shader.fragmentShader = shader.fragmentShader
          .replace('#include <common>', `#include <common>
            uniform float uReveal; varying vec3 vRp;
            float h11(float p){ p = fract(p*0.1031); p *= p+33.33; p *= p+p; return fract(p); }
            float n3(vec3 x){
              vec3 i = floor(x); vec3 f = fract(x); f = f*f*(3.0-2.0*f);
              float a=h11(i.x+i.y*57.0+i.z*113.0), b=h11(i.x+1.0+i.y*57.0+i.z*113.0);
              float c=h11(i.x+(i.y+1.0)*57.0+i.z*113.0), d=h11(i.x+1.0+(i.y+1.0)*57.0+i.z*113.0);
              float e=h11(i.x+i.y*57.0+(i.z+1.0)*113.0), g=h11(i.x+1.0+i.y*57.0+(i.z+1.0)*113.0);
              float k=h11(i.x+(i.y+1.0)*57.0+(i.z+1.0)*113.0), l=h11(i.x+1.0+(i.y+1.0)*57.0+(i.z+1.0)*113.0);
              return mix(mix(mix(a,b,f.x), mix(c,d,f.x), f.y), mix(mix(e,g,f.x), mix(k,l,f.x), f.y), f.z);
            }`)
          .replace('#include <dithering_fragment>', `#include <dithering_fragment>
            float nz = n3(vRp * 3.4);
            float edge = smoothstep(uReveal - 0.28, uReveal + 0.04, nz + vRp.y * 0.04);
            if (edge < 0.5) discard;
            gl_FragColor.rgb += vec3(1.0, 0.55, 0.24) * smoothstep(0.34, 0.0, abs(edge - 0.62)) * 0.8;
          `);
        mat.userData.shader = shader;
      };
      mat.needsUpdate = true;
    }
    const shader = mat.userData.shader;
    if (shader) shader.uniforms.uReveal.value = value;
  }

  frame();

  window.__hero = { state, api, rig, stages, camera, renderer, scene };
  return api;
}

/** статичный постер, если WebGL недоступен */
export function heroPoster(canvas) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const w = (canvas.width = canvas.clientWidth || 1200);
  const h = (canvas.height = canvas.clientHeight || 700);
  const g = ctx.createLinearGradient(0, 0, w, h);
  g.addColorStop(0, '#0b0d11'); g.addColorStop(0.5, '#15181e'); g.addColorStop(1, '#08090c');
  ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
  const rg = ctx.createRadialGradient(w * 0.5, h * 0.55, 10, w * 0.5, h * 0.55, Math.max(w, h) * 0.45);
  rg.addColorStop(0, 'rgba(255,120,40,0.18)');
  rg.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = rg; ctx.fillRect(0, 0, w, h);
}
