/* ==========================================================================
   РИГ — манекен со скелетом (SkinnedMesh + авто-веса) и 9 слоёв экипировки.
   Каждый слой: фото-карточка товара (спрайт) + процедурная оболочка.
   Спрайты нужны режиму «Вертикаль», оболочки — режиму «Турн».
   ========================================================================== */
import * as THREE from './three.module.js';

export const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
export const smooth = (v, a, b) => { const t = clamp((v - a) / (b - a)); return t * t * (3 - 2 * t); };
export const damp = (c, t, l, dt) => c + (t - c) * (1 - Math.exp(-l * dt));

/* ------------------------------------------------------------------ скелет */
/* Y-up, метры. Пропорции фигуры ~1,86 м. */
export const BONES = [
  { name: 'pelvis', pos: [0, 0.99, 0], parent: null },
  { name: 'spine', pos: [0, 0.12, 0.008], parent: 'pelvis' },
  { name: 'chest', pos: [0, 0.16, 0.004], parent: 'spine' },
  { name: 'neck', pos: [0, 0.2, -0.006], parent: 'chest' },
  { name: 'head', pos: [0, 0.075, 0.004], parent: 'neck' },
  { name: 'shoulder_L', pos: [0.07, 0.145, 0.002], parent: 'chest' },
  { name: 'upperarm_L', pos: [0.15, -0.03, 0], parent: 'shoulder_L' },
  { name: 'forearm_L', pos: [0.012, -0.285, -0.004], parent: 'upperarm_L' },
  { name: 'hand_L', pos: [0.01, -0.255, 0.004], parent: 'forearm_L' },
  { name: 'shoulder_R', pos: [-0.07, 0.145, 0.002], parent: 'chest' },
  { name: 'upperarm_R', pos: [-0.15, -0.03, 0], parent: 'shoulder_R' },
  { name: 'forearm_R', pos: [-0.012, -0.285, -0.004], parent: 'upperarm_R' },
  { name: 'hand_R', pos: [-0.01, -0.255, 0.004], parent: 'forearm_R' },
  { name: 'thigh_L', pos: [0.092, -0.04, 0], parent: 'pelvis' },
  { name: 'shin_L', pos: [0.008, -0.39, 0.005], parent: 'thigh_L' },
  { name: 'foot_L', pos: [0.003, -0.42, 0.006], parent: 'shin_L' },
  { name: 'toe_L', pos: [0.002, -0.08, 0.12], parent: 'foot_L' },
  { name: 'thigh_R', pos: [-0.092, -0.04, 0], parent: 'pelvis' },
  { name: 'shin_R', pos: [-0.008, -0.39, 0.005], parent: 'thigh_R' },
  { name: 'foot_R', pos: [-0.003, -0.42, 0.006], parent: 'shin_R' },
  { name: 'toe_R', pos: [-0.002, -0.08, 0.12], parent: 'foot_R' },
];

export function buildSkeleton() {
  const map = new Map();
  const root = new THREE.Bone();
  root.name = 'root';
  map.set('root', root);
  for (const b of BONES) {
    const bone = new THREE.Bone();
    bone.name = b.name;
    bone.position.fromArray(b.pos);
    map.set(b.name, bone);
    if (b.parent) map.get(b.parent).add(bone); else root.add(bone);
  }
  // ВАЖНО: порядок костей в Skeleton = порядок в BONES (индексы совпадают с весами)
  return { root, skeleton: new THREE.Skeleton(BONES.map((b) => map.get(b.name))), bones: map };
}

/* --------------------------------------------------- веса скина (авторасчёт) */
function boneSegments(bones) {
  const segs = [];
  for (const b of BONES) {
    const child = bones.get(b.name);
    const parent = b.parent ? bones.get(b.parent) : null;
    const a = new THREE.Vector3();
    const c = new THREE.Vector3();
    child.getWorldPosition(a);
    if (parent) parent.getWorldPosition(c); else c.copy(a).setY(a.y - 0.06);
    segs.push({ a, b: c });
  }
  return segs;
}

function distToSegment(p, a, b) {
  const ab = new THREE.Vector3().subVectors(b, a);
  const ap = new THREE.Vector3().subVectors(p, a);
  const t = clamp(ap.dot(ab) / (ab.lengthSq() || 1e-6));
  return ap.distanceTo(ab.multiplyScalar(t));
}

/** skinIndex/skinWeight по расстоянию вершины до сегментов костей */
export function autoWeights(geometry, bones, { influence = 3, falloff = 2.1 } = {}) {
  bones.get('root').updateMatrixWorld(true);
  const segs = boneSegments(bones);
  const pos = geometry.attributes.position;
  const v = new THREE.Vector3();
  const idx = new Uint16Array(pos.count * 4);
  const wgt = new Float32Array(pos.count * 4);
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    const scored = segs
      .map((s, si) => ({ si, w: 1 / Math.pow(distToSegment(v, s.a, s.b) + 0.02, falloff) }))
      .sort((x, y) => y.w - x.w)
      .slice(0, influence);
    const sum = scored.reduce((a, s) => a + s.w, 0) || 1;
    for (let k = 0; k < 4; k++) {
      idx[i * 4 + k] = k < scored.length ? scored[k].si : 0;
      wgt[i * 4 + k] = k < scored.length ? scored[k].w / sum : 0;
    }
  }
  geometry.setAttribute('skinIndex', new THREE.BufferAttribute(idx, 4));
  geometry.setAttribute('skinWeight', new THREE.BufferAttribute(wgt, 4));
  return geometry;
}

/* -------------------------------------------------- склейка геометрий в одну */
export function mergeGeometries(list) {
  const flat = list.map((g) => (g.index ? g : g.toNonIndexed()));
  let vCount = 0, iCount = 0;
  for (const g of flat) {
    vCount += g.attributes.position.count;
    iCount += g.index ? g.index.count : g.attributes.position.count;
  }
  const pos = new Float32Array(vCount * 3);
  const nor = new Float32Array(vCount * 3);
  const uvs = new Float32Array(vCount * 2);
  const idx = vCount > 65535 ? new Uint32Array(iCount) : new Uint16Array(iCount);
  let vo = 0, io = 0;
  for (const g of flat) {
    const p = g.attributes.position;
    const n = g.attributes.normal;
    const t = g.attributes.uv;
    pos.set(p.array.subarray(0, p.count * 3), vo * 3);
    if (n) nor.set(n.array.subarray(0, n.count * 3), vo * 3);
    if (t) uvs.set(t.array.subarray(0, t.count * 2), vo * 2);
    if (g.index) {
      const ii = g.index.array;
      for (let i = 0; i < ii.length; i++) idx[io + i] = ii[i] + vo;
      io += ii.length;
    } else {
      for (let i = 0; i < p.count; i++) idx[io + i] = vo + i;
      io += p.count;
    }
    vo += p.count;
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  out.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  out.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
  out.setIndex(new THREE.BufferAttribute(idx, 1));
  out.computeBoundingSphere();
  return out;
}

/* ------------------------------------------------------------- тело манекена */
export function buildBodyGeometry() {
  const parts = [];

  // торс
  const torso = new THREE.LatheGeometry([
    [0.001, 0.9], [0.158, 0.93], [0.182, 0.99], [0.168, 1.08], [0.156, 1.16],
    [0.17, 1.25], [0.198, 1.33], [0.215, 1.4], [0.208, 1.45], [0.168, 1.48],
    [0.095, 1.5], [0.001, 1.505],
  ].map(([r, y]) => new THREE.Vector2(Math.max(r, 0.001), y)), 44);
  torso.scale(1.34, 1, 0.76);
  parts.push(torso);

  // плечи-«дельты», шея, голова
  for (const s of [-1, 1]) {
    const sh = new THREE.SphereGeometry(0.098, 22, 18);
    sh.scale(1.15, 0.78, 0.92);
    sh.translate(s * 0.2, 1.385, 0);
    parts.push(sh);
  }
  const neck = new THREE.CylinderGeometry(0.058, 0.068, 0.1, 20);
  neck.translate(0, 1.52, 0);
  parts.push(neck);
  const head = new THREE.SphereGeometry(0.1, 28, 22);
  head.scale(0.95, 1.22, 1.02);
  head.translate(0, 1.645, 0.004);
  parts.push(head);

  // руки: плечо → предплечье с сужением, кисть
  for (const s of [-1, 1]) {
    parts.push(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([
      new THREE.Vector3(s * 0.2, 1.395, 0),
      new THREE.Vector3(s * 0.228, 1.25, -0.004),
      new THREE.Vector3(s * 0.218, 1.1, -0.006),
      new THREE.Vector3(s * 0.205, 0.97, -0.01),
    ]), 22, 0.062, 16, false));
    const elbow = new THREE.SphereGeometry(0.062, 16, 12);
    elbow.translate(s * 0.222, 1.17, 0.005);
    parts.push(elbow);
    const hand = new THREE.SphereGeometry(0.055, 16, 12);
    hand.scale(0.66, 1.05, 0.46);
    hand.translate(s * 0.203, 0.92, 0.014);
    parts.push(hand);

    // бедро и голень — двумя сегментами с сужением
    parts.push(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([
      new THREE.Vector3(s * 0.092, 0.95, 0),
      new THREE.Vector3(s * 0.096, 0.78, -0.003),
      new THREE.Vector3(s * 0.1, 0.6, -0.005),
    ]), 14, 0.098, 16, false));
    parts.push(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([
      new THREE.Vector3(s * 0.1, 0.6, -0.005),
      new THREE.Vector3(s * 0.103, 0.44, -0.007),
      new THREE.Vector3(s * 0.105, 0.3, -0.009),
      new THREE.Vector3(s * 0.107, 0.17, -0.011),
    ]), 16, 0.078, 16, false));
    const knee = new THREE.SphereGeometry(0.088, 16, 12);
    knee.scale(0.95, 0.85, 1.05);
    knee.translate(s * 0.1, 0.585, 0.02);
    parts.push(knee);
    const foot = new THREE.BoxGeometry(0.105, 0.075, 0.24);
    foot.translate(s * 0.105, 0.052, 0.07);
    parts.push(foot);
  }

  return mergeGeometries(parts);
}

/* ------------------------------------------------------- оболочки экипировки */
function lathe(profile, segments, material, flat = 1.22) {
  const pts = profile.map(([r, y]) => new THREE.Vector2(Math.max(r, 0.001), y));
  const mesh = new THREE.Mesh(new THREE.LatheGeometry(pts, segments), material);
  mesh.geometry.scale(flat, 1, 0.8);
  return mesh;
}

/** жилет: спинка + две полочки (перед открыт) */
function vestShell(material, profile) {
  const group = new THREE.Group();
  const pts = profile.map(([r, y]) => new THREE.Vector2(Math.max(r, 0.001), y));
  const back = new THREE.Mesh(new THREE.LatheGeometry(pts, 40, Math.PI * 0.34, Math.PI * 1.32), material);
  back.geometry.scale(1.22, 1, 0.8);
  group.add(back);
  for (const s of [-1, 1]) {
    const front = new THREE.Mesh(new THREE.LatheGeometry(pts, 22, Math.PI * (s < 0 ? 1.72 : -0.04), Math.PI * 0.33), material);
    front.geometry.scale(1.22, 1, 0.8);
    group.add(front);
  }
  return group;
}

/* ============================================================ 9 СЛОЁВ */
/* Позиции спрайтов заданы мировыми координатами (фигура стоит как при bind),
   поэтому для каждого слоя они пересчитываются в локальные координаты кости. */
export const LAYERS = [
  {
    key: 'base', title: 'Трикотаж', caption: 'Трикотаж и термобельё с нанесением логотипа компании',
    id: 'EP-1076', sprite: 'assets/rig/base.png', spriteH: 0.58, box: [0, 0.95, 1.53], crop: [0, 0.52], spriteZ: -0.08,
    mount: 'chest', shell: (m) => lathe([
      [0.001, 0.98], [0.158, 0.99], [0.172, 1.05], [0.16, 1.15], [0.158, 1.25],
      [0.176, 1.34], [0.192, 1.41], [0.186, 1.45], [0.15, 1.48], [0.001, 1.485],
    ], 40, m),
  },
  {
    key: 'boots', title: 'Спецобувь', caption: 'Ботинки с композитным подноском, подошва ПУ/ТПУ',
    id: 'EP-1086', sprite: 'assets/rig/boots.png', spriteH: 0.2, box: [-0.13, 0.02, 0.3], two: 'foot', crop: [0.5, 0], spriteZ: -0.14,
    mount: 'foot_L', shell: (m) => {
      const g = new THREE.Group();
      const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.082, 0.18, 20, 1, true), m);
      shaft.position.set(0.098, 0.17, -0.02);
      const foot = new THREE.Mesh(new THREE.BoxGeometry(0.115, 0.085, 0.28), m);
      foot.position.set(0.098, 0.07, -0.075);
      const sole = new THREE.Mesh(new THREE.BoxGeometry(0.125, 0.03, 0.3), m);
      sole.position.set(0.098, 0.015, -0.08);
      const mirror = (mesh) => {
        const c = mesh.clone();
        c.position.x = -c.position.x;
        return c;
      };
      g.add(shaft, foot, sole, mirror(shaft), mirror(foot), mirror(sole));
      return g;
    },
  },
  {
    key: 'trousers', title: 'Брюки рабочие', caption: 'Смесовая ткань, светоотражающие элементы, СОП',
    id: 'EP-1002', sprite: 'assets/rig/trousers.png', spriteH: 0.6, box: [0, 0.1, 0.72], crop: [0.24, 0], spriteZ: -0.1,
    mount: 'pelvis', shell: (m) => lathe([
      [0.001, 0.9], [0.166, 0.92], [0.185, 0.99], [0.176, 1.08], [0.168, 1.15], [0.001, 1.16],
    ], 36, m),
  },
  {
    key: 'jacket', title: 'Куртка рабочая', caption: 'Светоотражающие полосы, шеврон компании на груди',
    id: 'EP-1001', sprite: 'assets/rig/jacket.png', spriteH: 0.66, box: [0, 0.88, 1.56], spriteZ: -0.12,
    mount: 'chest', shell: (m) => lathe([
      [0.001, 0.95], [0.178, 0.96], [0.198, 1.03], [0.19, 1.13], [0.19, 1.25],
      [0.203, 1.34], [0.198, 1.4], [0.176, 1.45], [0.1, 1.48], [0.001, 1.49],
    ], 42, m),
  },
  {
    key: 'gloves', title: 'Защита рук', caption: 'Краги спилковые, перчатки с нитриловым покрытием',
    id: 'EP-1155', sprite: 'assets/rig/gloves.png', spriteH: 0.15, box: [0, 0.86, 1.0], two: 'hand', crop: [0, 0], spriteZ: -0.12,
    mount: 'hand_L', shell: (m) => {
      const g = new THREE.Group();
      const build = (s) => {
        const grp = new THREE.Group();
        const palm = new THREE.Mesh(new THREE.BoxGeometry(0.075, 0.13, 0.045), m);
        palm.position.set(s * 0.19, 0.88, -0.02);
        const cuff = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.05, 0.07, 18, 1, true), m);
        cuff.position.set(s * 0.19, 0.955, -0.016);
        grp.add(palm, cuff);
        return grp;
      };
      g.add(build(1), build(-1));
      return g;
    },
  },
  {
    key: 'helmet', title: 'Защита головы', caption: 'Каска СОМЗ-55 с храповым механизмом, очки Anti-Fog',
    id: 'EP-1123', sprite: 'assets/rig/helmet.png', spriteH: 0.22, box: [0, 1.6, 1.84], spriteZ: -0.04,
    mount: 'head', shell: (m) => {
      const g = new THREE.Group();
      const dome = new THREE.Mesh(new THREE.SphereGeometry(0.135, 28, 20, 0, Math.PI * 2, 0, Math.PI * 0.58), m);
      dome.position.set(0, 1.73, -0.004);
      dome.scale.set(1, 1.05, 1.12);
      const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.165, 0.165, 0.014, 28, 1, false, Math.PI * 0.62, Math.PI * 0.76), m);
      brim.position.set(0, 1.715, -0.024);
      g.add(dome, brim);
      return g;
    },
  },
  {
    key: 'respirator', title: 'Защита дыхания', caption: 'Полумаска FFP1–FFP3 со сменными фильтрами',
    id: 'EP-1139', sprite: 'assets/rig/respirator.png', spriteH: 0.16, box: [0, 1.5, 1.68], spriteZ: -0.1,
    mount: 'head', shell: (m) => {
      const g = new THREE.Group();
      const shell = new THREE.Mesh(new THREE.SphereGeometry(0.095, 24, 18, 0, Math.PI * 2, 0, Math.PI * 0.62), m);
      shell.position.set(0, 1.575, -0.055);
      shell.rotation.x = Math.PI * 0.52;
      shell.scale.set(1.05, 0.9, 1.02);
      g.add(shell);
      for (const s of [-1, 1]) {
        const f = new THREE.Mesh(new THREE.CylinderGeometry(0.038, 0.04, 0.05, 18), m);
        f.position.set(s * 0.075, 1.565, -0.09);
        f.rotation.z = Math.PI / 2;
        g.add(f);
      }
      return g;
    },
  },
  {
    key: 'vest', title: 'Сигнальный жилет', caption: 'Жилет 1-го класса защиты, светоотражающая лента',
    id: 'EP-1017', sprite: 'assets/rig/vest.png', spriteH: 0.58, box: [0, 0.88, 1.5], spriteZ: -0.14,
    mount: 'chest', shell: (m) => vestShell(m, [
      [0.001, 0.98], [0.206, 0.99], [0.214, 1.06], [0.2, 1.16], [0.2, 1.28],
      [0.214, 1.36], [0.206, 1.42], [0.001, 1.43],
    ]),
  },
  {
    key: 'harness', title: 'Страховочная система', caption: 'Привязь УСП с анкерной точкой для работ на высоте',
    id: 'EP-1163', sprite: 'assets/rig/harness.png', spriteH: 0.46, box: [0, 0.98, 1.46], spriteZ: -0.16,
    mount: 'chest', shell: (m) => {
      const g = new THREE.Group();
      for (const s of [-1, 1]) {
        const strap = new THREE.Mesh(new THREE.BoxGeometry(0.046, 0.4, 0.012), m);
        strap.position.set(s * 0.09, 1.21, -0.152);
        g.add(strap, strap.clone().translateZ(-0.3));
      }
      const belt = new THREE.Mesh(new THREE.TorusGeometry(0.165, 0.019, 8, 26), m);
      belt.position.y = 1.0;
      belt.rotation.x = Math.PI / 2;
      belt.scale.set(1.24, 0.8, 1);
      g.add(belt);
      return g;
    },
  },
];

/* ============================================================== СБОРКА РИГА */
/**
 * @param {object} materials — набор материалов (chrome, fabric, accent, sprites…)
 * @returns {{root, skeleton, bones, skinned, layers, tick, setMode, setSpriteAlpha}}
 */
export function createRig(materials) {
  const { root, skeleton, bones } = buildSkeleton();
  root.updateMatrixWorld(true);
  // веса скина считаем до создания SkinnedMesh — иначе three.js не сможет
  // деформировать вершины (нет атрибутов skinIndex/skinWeight)
  const bodyGeo = autoWeights(buildBodyGeometry(), bones);
  const skinned = new THREE.SkinnedMesh(bodyGeo, materials.chrome);
  skinned.frustumCulled = false;
  const group = new THREE.Group();
  group.add(root, skinned);
  skinned.bind(skeleton);
  root.updateMatrixWorld(true);
  const layers = [];

  for (const def of LAYERS) {
    const shells = new THREE.Group();
    if (def.shell) shells.add(def.shell(materials.fabric));

    /* фото-карточка товара: плоский «билборд» в координатах фигуры.
       Позиция = мировая точка кости-крепления + целевой бокс слоя, поэтому
       карточка всегда встаёт ровно на своё место и не зависит от позы костей. */
    const spriteMat = (materials.sprite && materials.sprite[def.key]) || materials.spritePlaceholder;
    const sprites = [];
    const holders = [];
    const mounts = def.two ? [def.two + '_L', def.two + '_R'] : [def.mount];
    for (const mountName of mounts) {
      const bone = bones.get(mountName);
      bone.updateWorldMatrix(true, false);
      const boneWorld = new THREE.Vector3();
      bone.getWorldPosition(boneWorld);
      const centerX = def.two ? boneWorld.x : 0;
      // у одиночного слоя box = [x, yНиз, yВерх] в метрах; у парного — берём позу кости
      const centerY = def.two ? boneWorld.y : (def.box[1] + def.box[2]) / 2;
      // перед фигуры — это -Z (фигура развёрнута лицом к камере), поэтому
      // карточка выносится в минус и читается поверх манекена
      const baseZ = def.spriteZ ?? -0.017;
      const target = new THREE.Vector3(centerX, centerY, baseZ - 0.22);

      const aspect = def.spriteAspect || 0.75;
      const cropT = def.crop ? def.crop[0] : 0;
      const cropB = def.crop ? def.crop[1] : 0;
      const visible = Math.max(0.15, 1 - cropT - cropB);
      const h = def.spriteH * visible;
      const plane = new THREE.Mesh(new THREE.PlaneGeometry(def.spriteH * aspect, h), spriteMat.clone());
      if (plane.material.map) {
        plane.material.map = plane.material.map.clone();
        plane.material.map.repeat.set(1, visible);
        plane.material.map.offset.set(0, cropB);
        plane.material.map.needsUpdate = true;
      }
      plane.userData.target = target.clone();
      plane.userData.baseH = h;
      plane.userData.mount = mountName;
      plane.position.copy(target);
      plane.renderOrder = 6;
      plane.visible = false;
      const holder = new THREE.Group();
      holder.name = 'spriteHold:' + def.key;
      holder.add(plane);
      sprites.push(plane);
      holders.push(holder);
    }

    layers.push({
      key: def.key, title: def.title, caption: def.caption, id: def.id,
      shells, sprites, holders, def, reveal: 1, spriteAlpha: 0,
    });
    // оболочки одежды и держатели карточек — в систему координат фигуры
    group.add(shells);
    for (const h of holders) group.add(h);
  }

  /** «дыхание» — вращение костей поверх bind-позы */
  function tick(t) {
    const b = Math.sin(t * 1.35);
    const get = (n) => bones.get(n);
    get('spine').rotation.x = b * 0.014;
    get('chest').rotation.x = b * 0.009;
    get('neck').rotation.y = Math.sin(t * 0.37) * 0.07;
    get('head').rotation.y = Math.sin(t * 0.37 + 0.4) * 0.06;
    get('upperarm_L').rotation.z = 0.02 + Math.sin(t * 0.9) * 0.013;
    get('upperarm_R').rotation.z = -0.02 - Math.sin(t * 0.9 + 1.1) * 0.013;
    root.position.y = b * 0.004;
  }

  /** прогресс одного спрайта: 0 — вне кадра снизу, 1 — занял своё место */
  function setSprite(layer, p, from = 'below') {
    const ease = p * p * (3 - 2 * p);
    for (const s of layer.sprites) {
      const target = s.userData.target;
      const h = s.userData.baseH || 0.5;
      const fly = (1 - ease) * (h * 1.9);
      s.position.set(target.x, from === 'below' ? target.y - fly : target.y + fly, target.z);
      s.rotation.z = (1 - ease) * (from === 'below' ? 0.05 : 0.09);
      s.rotation.y = 0;
      s.rotation.x = 0;
    }
  }

  /** прозрачность спрайтов слоя (0 — скрыт) */
  function setSpriteAlpha(layer, a) {
    layer.spriteAlpha = a;
    for (const s of layer.sprites) {
      s.visible = a > 0.01;
      s.material.opacity = a;
      s.material.transparent = a < 0.99;
    }
  }

  /** режим отображения: 'sprite' — конструктор из фото, 'shell' — объёмная одежда */
  function setMode(mode) {
    const isSprite = mode === 'sprite';
    for (const l of layers) {
      l.shells.visible = !isSprite;
      for (const s of l.sprites) s.visible = isSprite && l.spriteAlpha > 0.01;
    }
  }

  return { root: group, skeleton, bones, skinned, layers, tick, setMode, setSprite, setSpriteAlpha };
}
