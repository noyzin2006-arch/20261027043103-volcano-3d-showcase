/**
 * 真剖面 —— 切开的岩体、层理、岩浆房与岩浆通道
 * 依据：handoff/plans/TASK-001.md §5.3「剖面必须是真截掉的立体几何，不是透明滤镜」
 *
 * 说明：
 *   1. 剖面是真正缺掉一块的实体：切面由分层四边形三角化而成，不用透明贴图伪造。
 *   2. 岩浆房与通道是「结构示意」，不是任何一座火山的真实腔形。
 *   3. 本组仅在 cutaway 视图显示；whole / top 视图隐藏。
 */

import * as THREE from 'three';
import {
  radialHeight,
  readScenePalette,
  GROUND_RADIUS,
  BASE_Y,
  CUT_START,
  CUT_END,
  DEFAULT_SEED,
} from './terrain.js';

/** 地层分界面（世界 y）。 */
const LAYER_Y = [-0.6, -1.3, -2.0];

/** 岩浆通道上的发光粒数量。 */
const PARTICLE_COUNT = 8;

/** 切面上每条径向线的采样数。 */
const FACE_SAMPLES = 64;

/** 构造一条切面（位于 theta 的竖直径向平面）。 */
function buildCutFace(theta, kind, seed, palette, growth = 1, cutThroughAxis = true) {
  const positions = [];
  const colors = [];
  const index = [];
  const c = new THREE.Color();

  const bandColors = [
    palette.rock.clone().lerp(palette.strata, 0.55).multiplyScalar(1.25),
    palette.strata.clone().multiplyScalar(1.15),
    palette.rock.clone().lerp(palette.strata, 0.2).multiplyScalar(0.95),
    palette.rock.clone().multiplyScalar(0.62),
  ];

  const levels = LAYER_Y.length + 1; // top + 3 分界面 + BASE_Y
  const cosT = Math.cos(theta);
  const sinT = Math.sin(theta);

  // 对半剖切时，这张剖面贯穿整个直径（−R…+R），山体轮廓一次看全
  const signed = cutThroughAxis;
  const steps = signed ? FACE_SAMPLES * 2 : FACE_SAMPLES;
  for (let i = 0; i <= steps; i += 1) {
    const t = i / steps;
    const r = signed
      ? -GROUND_RADIUS + 2 * GROUND_RADIUS * t
      : GROUND_RADIUS * Math.pow(t, 2.2);
    const absR = Math.abs(r);
    const sampleTheta = signed && r < 0 ? theta + Math.PI : theta;
    const x = cosT * r;
    const z = sinT * r;
    const topY = radialHeight(absR, sampleTheta, kind, seed, growth);

    const ys = [topY, ...LAYER_Y, BASE_Y];
    for (let j = 0; j < levels; j += 1) {
      positions.push(x, ys[j], z);
      const col = bandColors[Math.min(j, bandColors.length - 1)];
      colors.push(col.r, col.g, col.b);
    }
  }

  for (let i = 0; i < steps; i += 1) {
    for (let j = 0; j < levels - 1; j += 1) {
      const a = i * levels + j;
      const b = a + 1;
      const d = (i + 1) * levels + j;
      const e = d + 1;
      // 只放一种绕序：若同时放反向的同位置三角形，
      // computeVertexNormals 会让两者的法线相互抵消，算出零向量 → 切面出现木纹状竖条。
      // 双面由材质的 side: DoubleSide 负责。
      index.push(a, b, d, b, e, d);
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geo.setIndex(index);
  geo.computeVertexNormals();

  // 剖面用无光照的平面材质：地质剖面图本来就是平涂插画，
  // 受光与自阴影会让层理读不出来（实测切面一片黑）。
  const mat = new THREE.MeshBasicMaterial({
    vertexColors: true,
    side: THREE.DoubleSide,
  });
  return new THREE.Mesh(geo, mat);
}

/**
 * 构建剖面组。
 * @param {{kind?:string, seed?:number}} [opts]
 * @returns {THREE.Group} userData.update(t, step) 用于推进通道里的发光粒
 */
export function buildCrossSection(opts = {}) {
  const { kind = 'strato', seed = DEFAULT_SEED, growth = 1 } = opts;
  const palette = readScenePalette();
  const group = new THREE.Group();
  group.name = 'cross-section';

  // 一张贯穿直径的竖直剖面（对半剖切时两张切面共面，只画一张）
  const face = buildCutFace(CUT_START, kind, seed, palette, growth, true);
  face.name = 'cut-face';
  group.add(face);

  // 岩浆房：椭球体（示意）
  const chamberGeo = new THREE.SphereGeometry(1, 32, 20);
  chamberGeo.scale(1.25, 0.48, 0.85);
  chamberGeo.translate(0, -1.35, 0);
  const chamberMat = new THREE.MeshStandardMaterial({
    color: palette.magma,
    emissive: palette.magma,
    emissiveIntensity: 0.55,
    roughness: 0.55,
    metalness: 0,
  });
  const chamber = new THREE.Mesh(chamberGeo, chamberMat);
  chamber.name = 'magma-chamber';
  group.add(chamber);

  // 岩浆通道：从岩浆房顶经 (0,-0.2,0) 通到火口底
  const floorY = radialHeight(0, 0, kind, seed, growth);
  const curve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, -0.92, 0),
    new THREE.Vector3(0.3, -0.42, 0.12),
    new THREE.Vector3(0.12, 0.8, -0.07),
    new THREE.Vector3(0, floorY - 0.06, 0),
  ]);

  const tubeGeo = new THREE.TubeGeometry(curve, 48, 0.16, 10, false);
  const tubeMat = new THREE.MeshStandardMaterial({
    color: palette.strata,
    emissive: palette.magma,
    emissiveIntensity: 0.18,
    roughness: 0.8,
    metalness: 0,
  });
  const tube = new THREE.Mesh(tubeGeo, tubeMat);
  tube.name = 'conduit-shell';
  group.add(tube);

  const coreGeo = new THREE.TubeGeometry(curve, 48, 0.085, 8, false);
  const coreMat = new THREE.MeshStandardMaterial({
    color: palette.magma,
    emissive: palette.magma,
    emissiveIntensity: 1.1,
    roughness: 0.4,
    metalness: 0,
    transparent: true,
    opacity: 0.9,
  });
  const core = new THREE.Mesh(coreGeo, coreMat);
  core.name = 'conduit-core';
  group.add(core);

  // 上涌的发光粒
  const particleGeo = new THREE.SphereGeometry(0.045, 10, 8);
  const particleMat = new THREE.MeshStandardMaterial({
    color: palette.magma,
    emissive: palette.magma,
    emissiveIntensity: 1.6,
    roughness: 0.3,
  });
  const particles = [];
  for (let i = 0; i < PARTICLE_COUNT; i += 1) {
    const m = new THREE.Mesh(particleGeo, particleMat);
    m.name = 'magma-particle';
    group.add(m);
    particles.push(m);
  }

  const tmp = new THREE.Vector3();

  group.userData.update = (t = 0, step = 0) => {
    // step >= 2 时（岩浆上升）才显示上涌粒
    const visible = step >= 2;
    for (let i = 0; i < particles.length; i += 1) {
      const p = particles[i];
      p.visible = visible;
      if (!visible) continue;
      const u = (t * 0.35 + i / particles.length) % 1;
      curve.getPointAt(u, tmp);
      p.position.copy(tmp);
    }
    chamberMat.emissiveIntensity = 0.4 + 0.25 * Math.sin(t * 2.2) + step * 0.08;
    coreMat.emissiveIntensity = 0.9 + 0.3 * Math.sin(t * 3.1);
  };

  group.userData.dispose = () => {
    group.traverse((obj) => {
      if (obj.geometry) obj.geometry.dispose();
      if (obj.material) {
        const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
        for (const m of mats) m.dispose();
      }
    });
  };

  group.userData.curve = curve;
  group.userData.chamber = chamber;
  return group;
}
