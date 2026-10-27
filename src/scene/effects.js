/**
 * 影响场景动效 —— 五种现象 + 12 秒喷发序列
 * 依据：handoff/plans/TASK-001.md §5.3「物理机制分层而非烟火」/ T09
 *
 * 规则：
 *   1. 灰羽、硫酸盐气溶胶、水蒸气是三件不同的事，分开建模、分开标注。
 *   2. 动画时间不代表真实喷发时长；不按任何单一速度暗示真实位移。
 *   3. 全部随机都走确定性 PRNG —— 同一 seed 画面一致，测试可复现。
 */

import * as THREE from 'three';
import { radialHeight, readScenePalette, CRATER_RADIUS, DEFAULT_SEED } from './terrain.js';

/** 喷发演示总时长（秒）。 */
export const ERUPTION_SECONDS = 12;
/** 火山灰粒子总数。 */
export const ASH_COUNT = 360;
/** 每帧实际写入 instanceMatrix 的活跃粒子数。 */
export const ASH_PER_FRAME = 100;
/** 火山碎屑流粒子数。 */
export const PDF_COUNT = 35;
/** 灰羽沿坡下泄的方向角（避开剖面缺口，保证可见）。 */
const FLOW_THETA = 0.1;

/** 确定性 PRNG。 */
function mulberry32(seed) {
  let a = seed >>> 0;
  return function rand() {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** 喷发柱顶高度随时间的变化（分段线性）。 */
export function columnTop(t) {
  if (t <= 2) return 1.0 + t * 0.1;
  if (t <= 6) return 1.2 + ((t - 2) / 4) * 4.0;
  if (t <= 9) return 5.2 + ((t - 6) / 3) * 2.0;
  return 7.2 + Math.min(1, (t - 9) / 3) * 0.8;
}

/** 伞区半径随时间的变化（9 秒后开始张开）。 */
export function umbrellaRadius(t) {
  if (t < 9) return 0;
  return Math.min(2.6, ((t - 9) / 3) * 2.6);
}

/** 沿山坡取一条从火口到坡脚的路径点。 */
function slopePath(kind, seed, samples = 24, growth = 1) {
  const pts = [];
  const base = kind === 'shield' ? 4.75 : kind === 'cinder' ? 2.65 : 4.0;
  for (let i = 0; i <= samples; i += 1) {
    const t = i / samples;
    const r = CRATER_RADIUS + (base - CRATER_RADIUS) * t;
    const y = radialHeight(r, FLOW_THETA, kind, seed, growth);
    pts.push(new THREE.Vector3(Math.cos(FLOW_THETA) * r, y, Math.sin(FLOW_THETA) * r));
  }
  return pts;
}

/** 灰羽系统：InstancedMesh，360 粒，每帧只写 100 个活跃粒。 */
function buildAshColumn(palette, seed, craterY = 0) {
  const group = new THREE.Group();
  group.name = 'ash-column';
  // 灰羽从火口升起，而不是从世界原点（否则会埋在山体内部）
  group.position.y = craterY;

  const geo = new THREE.IcosahedronGeometry(0.13, 0);
  const mat = new THREE.MeshStandardMaterial({
    roughness: 1,
    metalness: 0,
    vertexColors: false,
    transparent: true,
    opacity: 0.92,
  });
  const mesh = new THREE.InstancedMesh(geo, mat, ASH_COUNT);
  mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  mesh.name = 'ash-particles';

  const rand = mulberry32(seed);
  const colors = new Float32Array(ASH_COUNT * 3);
  const c = new THREE.Color();
  const parts = [];
  for (let i = 0; i < ASH_COUNT; i += 1) {
    const angle = rand() * Math.PI * 2;
    const radial = rand();
    const birth = rand() * 6.2;
    const lifetime = 4 + rand() * 4.2;
    const role = rand() < 0.58 ? 'column' : 'umbrella';
    const size = 0.7 + rand() * 0.9;
    // 深浅不一的灰
    c.copy(palette.ash).multiplyScalar(0.62 + rand() * 0.5);
    colors[i * 3] = c.r;
    colors[i * 3 + 1] = c.g;
    colors[i * 3 + 2] = c.b;
    parts.push({ angle, radial, birth, lifetime, role, size });
  }
  mesh.instanceColor = new THREE.InstancedBufferAttribute(colors, 3);
  group.add(mesh);

  const dummy = new THREE.Object3D();
  const hidden = new THREE.Matrix4().makeScale(0, 0, 0);

  return {
    group,
    mesh,
    /** @param {number} t 秒（0..12） */
    update(t) {
      const top = columnTop(t);
      const umb = umbrellaRadius(t);
      // 每帧只更新前 ASH_PER_FRAME 个活跃粒，其余保持上一帧结果
      let written = 0;
      for (let i = 0; i < ASH_COUNT && written < ASH_PER_FRAME; i += 1) {
        const p = parts[i];
        const life = (t - p.birth) / p.lifetime;
        if (life < 0 || life > 1) {
          mesh.setMatrixAt(i, hidden);
          written += 1;
          continue;
        }
        let r;
        let y;
        let xOff = 0;
        if (p.role === 'column') {
          y = life * top;
          r = p.radial * (0.22 + life * 0.5);
        } else {
          if (t < 9) {
            mesh.setMatrixAt(i, hidden);
            written += 1;
            continue;
          }
          const u = (t - 9) / 3;
          y = top - 0.05 + Math.sin(u * Math.PI) * 0.42;
          r = p.radial * (0.35 + umb);
          xOff = u * u * 1.8; // 缓慢西风位移
        }
        const a = p.angle;
        dummy.position.set(Math.cos(a) * r + xOff, y + 0.12, Math.sin(a) * r);
        const s = p.size * (p.role === 'umbrella' ? 1.35 : 1);
        dummy.scale.setScalar(s);
        dummy.rotation.set(0, a, 0);
        dummy.updateMatrix();
        mesh.setMatrixAt(i, dummy.matrix);
        written += 1;
      }
      mesh.instanceMatrix.needsUpdate = true;
      mesh.computeBoundingSphere();
    },
    dispose() {
      geo.dispose();
      mat.dispose();
    },
  };
}

/** 火口辉光：喷发时的小面积橙色发光。 */
function buildCraterGlow(palette, craterY = 0) {
  const geo = new THREE.SphereGeometry(CRATER_RADIUS * 0.92, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2);
  const mat = new THREE.MeshStandardMaterial({
    color: palette.magma,
    emissive: palette.magma,
    emissiveIntensity: 1.4,
    roughness: 0.4,
    transparent: true,
    opacity: 0.9,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.name = 'crater-glow';
  mesh.position.y = craterY;
  return { mesh, mat };
}

/** 航空：低多边形飞机剪影 + 穿过灰羽的虚线路径。 */
function buildAviation(palette, kind, seed, craterY = 0) {
  const group = new THREE.Group();
  group.name = 'aviation';

  const bodyMat = new THREE.MeshStandardMaterial({ color: palette.ash, roughness: 0.75, metalness: 0.05 });
  const plane = new THREE.Group();
  plane.name = 'aircraft';

  const fuselage = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.13, 1.5, 12), bodyMat);
  fuselage.rotation.z = Math.PI / 2;
  plane.add(fuselage);

  const wing = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.045, 1.5), bodyMat);
  wing.position.set(0.05, 0, 0);
  plane.add(wing);

  const tail = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.05, 0.5), bodyMat);
  tail.position.set(-0.62, 0.08, 0);
  tail.rotation.x = 0.4;
  plane.add(tail);

  plane.position.set(2.6, 4.6, 1.2);
  plane.rotation.y = 0.55;
  group.add(plane);

  // 虚线路径：穿过灰羽边缘
  const pts = [
    new THREE.Vector3(5.4, 4.9, 3.4),
    new THREE.Vector3(3.4, 4.8, 2.4),
    new THREE.Vector3(1.4, 4.7, 1.4),
    new THREE.Vector3(-0.6, 4.7, 0.4),
    new THREE.Vector3(-2.8, 4.8, -0.8),
  ];
  const pathGeo = new THREE.BufferGeometry().setFromPoints(pts);
  const pathMat = new THREE.LineDashedMaterial({
    color: palette.aerosol,
    dashSize: 0.28,
    gapSize: 0.2,
    transparent: true,
    opacity: 0.9,
  });
  const path = new THREE.Line(pathGeo, pathMat);
  path.computeLineDistances();
  path.name = 'flight-path';
  group.add(path);

  // 灰羽边缘提示圈（淡橙虚线），不画坠落事故
  const warnGeo = new THREE.BufferGeometry().setFromPoints(
    Array.from({ length: 33 }, (_, i) => {
      const a = (i / 32) * Math.PI * 2;
      return new THREE.Vector3(Math.cos(a) * 0.85, 4.7, Math.sin(a) * 0.85);
    })
  );
  const warnMat = new THREE.LineDashedMaterial({
    color: palette.magma,
    dashSize: 0.16,
    gapSize: 0.12,
    transparent: true,
    opacity: 0.85,
  });
  const warnRing = new THREE.Line(warnGeo, warnMat);
  warnRing.computeLineDistances();
  warnRing.position.set(0.3, 0, 0.9);
  warnRing.name = 'ash-edge-marker';
  group.add(warnRing);

  return { group, plane, path, warnRing };
}

/** 气候：平流层气溶胶层 + 散射示意箭头。 */
function buildClimate(palette) {
  const group = new THREE.Group();
  group.name = 'climate';

  const ringGeo = new THREE.RingGeometry(2.4, 11, 96, 1);
  const ringMat = new THREE.MeshBasicMaterial({
    color: palette.aerosol,
    transparent: true,
    opacity: 0.28,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
  const layer = new THREE.Mesh(ringGeo, ringMat);
  layer.rotation.x = -Math.PI / 2;
  layer.position.y = 9.6;
  layer.name = 'aerosol-layer';
  group.add(layer);

  const sunMat = new THREE.MeshBasicMaterial({ color: palette.ash });
  const mkArrow = (dir, len) => {
    const g = new THREE.Group();
    const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, len, 8), sunMat);
    const head = new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.24, 10), sunMat);
    const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.clone().normalize());
    shaft.quaternion.copy(q);
    head.quaternion.copy(q);
    shaft.position.copy(dir).multiplyScalar(len / 2);
    head.position.copy(dir).multiplyScalar(len + 0.12);
    g.add(shaft, head);
    return g;
  };

  const incoming = mkArrow(new THREE.Vector3(-0.45, -1, 0.18), 2.2);
  incoming.position.set(-4.6, 11.6, 2.6);
  incoming.name = 'sunlight-in';
  group.add(incoming);

  const scattered = mkArrow(new THREE.Vector3(0.5, 0.85, 0.2), 1.5);
  scattered.position.set(-2.4, 9.5, 2.0);
  scattered.name = 'sunlight-scattered';
  group.add(scattered);

  return { group, layer };
}

/** 山麓：碎屑流 / 泥流 / 熔岩 三条互斥路径。 */
function buildHazard(palette, kind, seed, growth = 1) {
  const group = new THREE.Group();
  group.name = 'hazard';

  const pts = slopePath(kind, seed, 24, growth);

  // 火山碎屑流：灰褐球体沿坡下泄
  const pdfGeo = new THREE.IcosahedronGeometry(0.17, 0);
  const pdfMat = new THREE.MeshStandardMaterial({ color: palette.strata, roughness: 0.95 });
  const pdf = new THREE.InstancedMesh(pdfGeo, pdfMat, PDF_COUNT);
  pdf.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  pdf.name = 'pyroclastic-flow';
  const dummy = new THREE.Object3D();
  const pdfRand = mulberry32(seed + 5);
  const pdfParts = Array.from({ length: PDF_COUNT }, () => ({
    offset: pdfRand(),
    lateral: (pdfRand() - 0.5) * 0.34,
    size: 0.7 + pdfRand() * 0.8,
  }));
  group.add(pdf);

  // 熔岩：沿坡的折线带 + 橙色中心
  const lavaGroup = new THREE.Group();
  lavaGroup.name = 'lava-flow';
  const lavaOuter = new THREE.Mesh(
    new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 48, 0.22, 6, false),
    new THREE.MeshStandardMaterial({ color: palette.lavaCrust, roughness: 0.95 })
  );
  const lavaCore = new THREE.Mesh(
    new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 48, 0.09, 6, false),
    new THREE.MeshStandardMaterial({
      color: palette.magma,
      emissive: palette.magma,
      emissiveIntensity: 1.2,
      roughness: 0.5,
    })
  );
  lavaGroup.add(lavaOuter, lavaCore);
  group.add(lavaGroup);

  // 泥流：泥色带 + 坡脚泥水潭
  const laharGroup = new THREE.Group();
  laharGroup.name = 'lahar-flow';
  const laharBand = new THREE.Mesh(
    new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts.slice(Math.floor(pts.length * 0.25))), 36, 0.19, 6, false),
    new THREE.MeshStandardMaterial({ color: palette.lahar, roughness: 1 })
  );
  const poolGeo = new THREE.CircleGeometry(0.85, 28);
  poolGeo.rotateX(-Math.PI / 2);
  const pool = new THREE.Mesh(
    poolGeo,
    new THREE.MeshStandardMaterial({ color: palette.laharPool, roughness: 1 })
  );
  const last = pts[pts.length - 1];
  pool.position.set(last.x, last.y + 0.02, last.z);
  laharGroup.add(laharBand, pool);
  group.add(laharGroup);

  const curve = new THREE.CatmullRomCurve3(pts);

  return {
    group,
    pdf,
    lavaGroup,
    laharGroup,
    /** @param {number} t 0..1 归一化时间（不代表真实速度） */
    update(t) {
      for (let i = 0; i < PDF_COUNT; i += 1) {
        const p = pdfParts[i];
        const u = (t + p.offset * 0.5) % 1;
        const pt = curve.getPointAt(Math.min(0.999, u));
        const tan = curve.getTangentAt(Math.min(0.999, u));
        dummy.position.copy(pt).addScaledVector(tan, 0.1);
        dummy.position.y += 0.14;
        dummy.position.x += p.lateral;
        dummy.scale.setScalar(p.size);
        dummy.updateMatrix();
        pdf.setMatrixAt(i, dummy.matrix);
      }
      pdf.instanceMatrix.needsUpdate = true;
      pdf.computeBoundingSphere();
    },
  };
}

/** 馈赠：温泉、地热井与两小块耕地。 */
function buildBenefit(palette, kind, seed, growth = 1) {
  const group = new THREE.Group();
  group.name = 'benefit';

  const pts = slopePath(kind, seed, 24, growth);
  const foot = pts[pts.length - 1];

  // 温泉：热流与细蒸气
  const springMat = new THREE.MeshStandardMaterial({
    color: palette.water,
    emissive: palette.water,
    emissiveIntensity: 0.28,
    roughness: 0.3,
  });
  const springGeo = new THREE.CircleGeometry(0.42, 24);
  springGeo.rotateX(-Math.PI / 2);
  const spring = new THREE.Mesh(springGeo, springMat);
  spring.position.set(foot.x * 1.12, 0.06, foot.z * 1.12);
  spring.name = 'hot-spring';
  group.add(spring);

  const steamMat = new THREE.MeshBasicMaterial({ color: palette.ash, transparent: true, opacity: 0.5 });
  const steam = [];
  for (let i = 0; i < 8; i += 1) {
    const m = new THREE.Mesh(new THREE.IcosahedronGeometry(0.1, 0), steamMat);
    m.position.copy(spring.position);
    group.add(m);
    steam.push(m);
  }

  // 两块低饱和耕地区
  const fieldMat = new THREE.MeshStandardMaterial({ color: palette.soil, roughness: 1 });
  const fieldA = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.05, 1.0), fieldMat);
  fieldA.position.set(foot.x * 1.3 + 0.6, 0.03, foot.z * 1.3 - 0.7);
  const fieldB = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.05, 0.85), fieldMat);
  fieldB.position.set(foot.x * 1.3 - 0.7, 0.03, foot.z * 1.3 + 0.5);
  fieldA.name = 'farmland-a';
  fieldB.name = 'farmland-b';
  group.add(fieldA, fieldB);

  // 地热井：剖面里的双管 + 换热箭头
  const wellMat = new THREE.MeshStandardMaterial({ color: palette.plate, roughness: 0.6, metalness: 0.2 });
  const wellA = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.055, 1.5, 10), wellMat);
  wellA.position.set(1.45, -0.75, 0.1);
  const wellB = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.055, 1.5, 10), wellMat);
  wellB.position.set(1.95, -0.75, 0.1);
  const cap = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.1, 0.3), wellMat);
  cap.position.set(1.7, 0.02, 0.1);
  const wells = new THREE.Group();
  wells.name = 'geothermal-wells';
  wells.add(wellA, wellB, cap);
  group.add(wells);

  return {
    group,
    steam,
    update(t) {
      for (let i = 0; i < steam.length; i += 1) {
        const u = ((t * 0.28 + i / steam.length) % 1);
        steam[i].position.set(
          spring.position.x + Math.sin(u * 5 + i) * 0.1,
          spring.position.y + u * 0.95,
          spring.position.z + Math.cos(u * 4 + i) * 0.1
        );
        steam[i].scale.setScalar(0.6 + u * 1.1);
      }
    },
  };
}

/**
 * 构建某个影响场景的组。
 * @param {'column'|'aviation'|'climate'|'hazard'|'benefit'} impact
 * @param {{kind?:string, seed?:number}} [opts]
 * @returns {{group:THREE.Group, update:(t:number)=>void, dispose:()=>void}}
 */
export function buildImpactGroup(impact, opts = {}) {
  const { kind = 'strato', seed = DEFAULT_SEED, growth = 1 } = opts;
  const palette = readScenePalette();
  const group = new THREE.Group();
  group.name = `impact-${impact}`;

  // 火口底高度：灰羽与火口辉光都从这里升起，而不是从世界原点
  const craterY = radialHeight(0, 0, kind, seed, growth);

  let updater = null;

  if (impact === 'column') {
    const ash = buildAshColumn(palette, seed, craterY);
    const glow = buildCraterGlow(palette, craterY);
    group.add(ash.group, glow.mesh);
    updater = (t) => {
      ash.update(t);
      glow.mat.emissiveIntensity = 0.7 + (t < 2 ? t * 0.5 : 1.0);
    };
  } else if (impact === 'aviation') {
    const av = buildAviation(palette, kind, seed, craterY);
    const ash = buildAshColumn(palette, seed, craterY);
    group.add(av.group, ash.group);
    updater = (t) => ash.update(t);
  } else if (impact === 'climate') {
    const cl = buildClimate(palette);
    const ash = buildAshColumn(palette, seed, craterY);
    group.add(cl.group, ash.group);
    updater = (t) => ash.update(t);
  } else if (impact === 'hazard') {
    const hz = buildHazard(palette, kind, seed, growth);
    group.add(hz.group);
    updater = (t) => hz.update(t);
  } else {
    const bn = buildBenefit(palette, kind, seed, growth);
    group.add(bn.group);
    updater = (t) => bn.update(t);
  }

  return {
    group,
    update: (t = 0) => updater?.(t),
    dispose() {
      group.traverse((obj) => {
        if (obj.geometry) obj.geometry.dispose();
        if (obj.material) {
          const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
          for (const m of mats) m.dispose();
        }
      });
    },
  };
}
