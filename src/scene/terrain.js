/**
 * 程序化火山地形 —— 零二进制资产
 * 依据：handoff/plans/TASK-001.md §5.3「3D 视觉制作配方」
 *
 * 规则：
 *   1. 全部几何由确定性 seeded 噪声生成 —— 同 seed 同坐标必得同值，测试可复现。
 *   2. 颜色从 tokens.css 的 --scene-* 读取后 lerp，JS 里不另存一份 hex 常量。
 *   3. 所有尺寸为视觉单位（示意），不代表任何真实火山的公里数。
 */

import * as THREE from 'three';

/** 默认随机种子（测试与线上一致）。 */
export const DEFAULT_SEED = 427;

/** 地面块尺寸：直径 12 的圆形地块，底层自 y=-2.2 起。 */
export const GROUND_RADIUS = 6;
/** 地块底面深度。 */
export const BASE_Y = -2.2;
/** 极坐标网格默认精度。 */
export const DEFAULT_SECTIONS = 96;
export const DEFAULT_RINGS = 72;
/** 火山口半径（世界单位）。 */
export const CRATER_RADIUS = 0.46;
/** 剖面缺口角度（弧度，半宽）。 */
export const CUT_GAP = 0.78;
/**
 * 对半剖切。
 *
 * 规划案原文写的「theta∈[0.45, 2π−0.45]」只挖掉 51° 的窄楔形，
 * 且把缺口中心放在 +X 轴 —— 与它同时给出的默认相机位置 (8, 5.8, 10.5) 互相矛盾：
 * 从那个机位看过去，两侧切壁都是侧视，内部结构根本读不出来。
 *
 * 这里改为**对半剖切**：沿一条过轴的竖直平面把火山切开，
 * 切面法线与视线垂直 —— 屏幕上就是一张标准的火山剖面图
 * （左侧山坡、地下岩层、岩浆房、通道、火山口，一目了然）。
 * 相机方位角 = 剖面方位角 + 90°，保证切面正对观众。
 */
export const CUT_CENTER = Math.atan2(10.5, 8); // 默认相机的方位角
export const CUT_START = CUT_CENTER - Math.PI / 2; // 剖面所在平面的方位角
export const CUT_END = CUT_START + Math.PI; // 剖面另一侧（同一平面）

/** 三类火山的形状参数（规划案 §5.3 固定值）。 */
export const VOLCANO_SHAPE = Object.freeze({
  strato: Object.freeze({ peak: 3.35, base: 4.0, profile: (u) => Math.pow(Math.max(0, 1 - Math.pow(u, 1.55)), 1.05) }),
  shield: Object.freeze({ peak: 1.4, base: 4.75, profile: (u) => Math.pow(Math.max(0, 1 - u * u), 2.3) }),
  cinder: Object.freeze({ peak: 2.45, base: 2.65, profile: (u) => Math.pow(Math.max(0, 1 - u), 0.92) }),
});

export const VOLCANO_KINDS = Object.freeze(Object.keys(VOLCANO_SHAPE));

/** 某类火山的基半径。 */
export function baseRadius(kind) {
  return VOLCANO_SHAPE[kind]?.base ?? 4;
}

/** 某类火山的峰高。 */
export function peakHeight(kind) {
  return VOLCANO_SHAPE[kind]?.peak ?? 3.35;
}

// ---------------------------------------------------------------- 确定性噪声

function hash2(ix, iy, seed) {
  let h = Math.imul(ix | 0, 374761393) ^ Math.imul(iy | 0, 668265263) ^ Math.imul(seed | 0, 1274126177);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967295; // 0..1
}

/** 平滑插值的 value noise，返回 -1..1。 */
export function valueNoise(x, y, seed = DEFAULT_SEED) {
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const fx = x - x0;
  const fy = y - y0;
  const u = fx * fx * (3 - 2 * fx);
  const v = fy * fy * (3 - 2 * fy);
  const n00 = hash2(x0, y0, seed);
  const n10 = hash2(x0 + 1, y0, seed);
  const n01 = hash2(x0, y0 + 1, seed);
  const n11 = hash2(x0 + 1, y0 + 1, seed);
  const a = n00 + (n10 - n00) * u;
  const b = n01 + (n11 - n01) * u;
  return (a + (b - a) * v) * 2 - 1;
}

const OCTAVE_FREQ = [1, 2, 4];
const OCTAVE_WEIGHT = [1, 0.45, 0.22];

/** 三频叠加的分形噪声，归一化后返回 -1..1。 */
export function fbm(x, y, seed = DEFAULT_SEED) {
  let sum = 0;
  let wsum = 0;
  for (let i = 0; i < OCTAVE_FREQ.length; i += 1) {
    sum += valueNoise(x * OCTAVE_FREQ[i], y * OCTAVE_FREQ[i], seed + i * 17) * OCTAVE_WEIGHT[i];
    wsum += OCTAVE_WEIGHT[i];
  }
  return sum / wsum;
}

/** 侵蚀沟：默认镜头右上可见的一条分叉沟。 */
const GULLY_THETA = 0.95;
const GULLY_BRANCH = 1.62;

function angularDistance(a, b) {
  const TAU = Math.PI * 2;
  let d = (a - b) % TAU;
  if (d < 0) d += TAU;
  return d > Math.PI ? TAU - d : d;
}

function gullyDepth(theta, r) {
  if (r < 0.12 || r > 0.99) return 0;
  const main = 1 - Math.min(1, angularDistance(theta, GULLY_THETA) / 0.16);
  const branch = 0.55 * (1 - Math.min(1, angularDistance(theta, GULLY_BRANCH) / 0.1));
  const fade = Math.sin(Math.PI * Math.min(1, r / 0.99)); // 两端收细
  return -(Math.max(0, main) + Math.max(0, branch)) * 0.17 * fade;
}

/**
 * 高度场。r 为世界半径（0..GROUND_RADIUS）。
 * @param {number} r 世界半径
 * @param {number} theta 角度（弧度）
 * @param {'strato'|'shield'|'cinder'} kind
 * @param {number} seed
 * @param {number} [growth] 山体生长系数 0..1 —— 四步建造阶段用它表现「堆积」
 * @returns {number} y 坐标
 */
export function radialHeight(r, theta, kind, seed = DEFAULT_SEED, growth = 1) {
  const shape = VOLCANO_SHAPE[kind] ?? VOLCANO_SHAPE.strato;
  const base = shape.base;
  const g = Math.min(1, Math.max(0, growth));

  if (r >= base) {
    // 外围低振幅地面
    const n = fbm(r * 0.42, theta * 0.9, seed + 91);
    const bowl = -0.06 * Math.exp(-Math.pow((r - base) / 1.6, 2));
    return n * 0.16 + bowl - 0.02;
  }

  const u = r / base;

  // 火山口：凹环 + 向中心下凹的内壁（不封成山尖）
  if (r < CRATER_RADIUS) {
    const t = r / CRATER_RADIUS;
    const rim = shape.peak * g - 0.12;
    return rim - 0.3 * (1 - t * t);
  }

  let h = shape.peak * g * shape.profile(u);

  // 噪声幅度 0.13×(1−u)，在火口边缘衰减到 0
  const amp = 0.13 * (1 - u);
  h += fbm(r * 1.15, theta * 1.6, seed) * amp;
  h += gullyDepth(theta, u);

  return h;
}

/** 平滑阶跃函数（smoothstep）。 */
export function smoothstep(e0, e1, x) {
  const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0)));
  return t * t * (3 - 2 * t);
}

// ---------------------------------------------------------------- 调色板

/**
 * 从 tokens.css 读取 --scene-* 调色板。
 * @returns {{rock:THREE.Color, strata:THREE.Color, ash:THREE.Color, magma:THREE.Color, soil:THREE.Color, plate:THREE.Color, water:THREE.Color, aerosol:THREE.Color}}
 */
export function readScenePalette() {
  const cs = getComputedStyle(document.documentElement);
  const get = (name, fallback) => {
    const v = cs.getPropertyValue(name).trim();
    return v ? new THREE.Color(v) : new THREE.Color(fallback);
  };
  return {
    rock: get('--scene-rock', '#515a59'),
    strata: get('--scene-strata', '#76695a'),
    ash: get('--scene-ash', '#b5b8b0'),
    magma: get('--scene-magma', '#ff6c35'),
    soil: get('--scene-soil', '#576956'),
    plate: get('--scene-plate', '#4e8191'),
    water: get('--scene-water', '#3c7f9d'),
    aerosol: get('--scene-aerosol', '#a5c8db'),
  };
}

/** 按高度与层位给顶点上色（层状火山有明显的火山灰/熔岩互层）。 */
function colorForHeight(h, r, theta, kind, palette, out) {
  const shape = VOLCANO_SHAPE[kind] ?? VOLCANO_SHAPE.strato;

  if (r < CRATER_RADIUS) {
    // 火口底部：岩色偏橙灰
    out.copy(palette.rock).lerp(palette.strata, 0.4).lerp(palette.magma, 0.14);
    return out;
  }

  if (r >= shape.base) {
    // 外围地面：土壤为主，掺一点岩石
    const n = fbm(r * 0.8, 3.1, 11) * 0.5 + 0.5;
    out.copy(palette.soil).lerp(palette.rock, 0.62 + n * 0.3).multiplyScalar(0.72);
    return out;
  }

  const u = r / shape.base;
  const hn = Math.min(1, Math.max(0, h / shape.peak));

  if (kind === 'strato') {
    // 5 条宽度变化的火山灰 / 熔岩互层。
    // 用连续量做层界（而不是 floor 取整后硬切）——硬切会在网格环上留下阶梯状锯齿。
    const bands = 5;
    const phase = hn * bands;
    const frac = phase - Math.floor(phase);
    const edge = smoothstep(0.34, 0.66, frac);
    out.copy(palette.rock).lerp(palette.strata, edge * 0.82);
    out.lerp(palette.ash, edge * 0.12);
  } else if (kind === 'shield') {
    // 3 条宽缓的熔岩台地
    const terraces = 3;
    const phase = hn * terraces;
    const frac = phase - Math.floor(phase);
    const edge = smoothstep(0.06, 0.24, frac) * (1 - smoothstep(0.62, 0.8, frac));
    out.copy(palette.rock).lerp(palette.strata, 0.25);
    out.lerp(palette.rock, edge * 0.45); // 台地边缘
    out.lerp(palette.soil, 0.06 * Math.floor(hn * terraces));
  } else {
    // 渣锥：松散颗粒，整体偏灰
    const n = fbm(r * 2.6, theta * 2.6, 7) * 0.5 + 0.5;
    out.copy(palette.rock).lerp(palette.ash, 0.18 + n * 0.2);
  }

  // 靠近火口略暗（受热区），坡脚偏土壤
  out.lerp(palette.soil, Math.max(0, (u - 0.72) / 0.28) * 0.45);
  return out;
}

/**
 * 构建火山地表几何（带顶点色）。
 * @param {{kind:'strato'|'shield'|'cinder', sections?:number, rings?:number, cutaway?:boolean, seed?:number}} opts
 * @returns {THREE.BufferGeometry}
 */
export function buildVolcanoGeometry(opts = {}) {
  const {
    kind = 'strato',
    sections = DEFAULT_SECTIONS,
    rings = DEFAULT_RINGS,
    cutaway = false,
    seed = DEFAULT_SEED,
    growth = 1,
  } = opts;

  const palette = readScenePalette();
  // 剖面：**保留**背对镜头的一半、**挖掉**朝向镜头的一半。
  // 保留范围 = [CUT_END, CUT_START + 2π)，张角 π。
  const thetaStart = cutaway ? CUT_END : 0;
  const thetaSpan = cutaway ? Math.PI : Math.PI * 2;

  const cols = sections + 1;
  const rows = rings + 1;
  const count = cols * rows;

  const positions = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);
  const c = new THREE.Color();

  let p = 0;
  for (let i = 0; i < rows; i += 1) {
    const t = i / rings;
    // 径向分布：靠近火山中心更密
    const r = GROUND_RADIUS * Math.pow(t, 2.2);
    for (let j = 0; j < cols; j += 1) {
      const theta = thetaStart + thetaSpan * (j / sections);
      const y = radialHeight(r, theta, kind, seed, growth);
      positions[p * 3] = Math.cos(theta) * r;
      positions[p * 3 + 1] = y;
      positions[p * 3 + 2] = Math.sin(theta) * r;

      colorForHeight(y, r, theta, kind, palette, c);
      colors[p * 3] = c.r;
      colors[p * 3 + 1] = c.g;
      colors[p * 3 + 2] = c.b;
      p += 1;
    }
  }

  const index = [];
  for (let i = 0; i < rings; i += 1) {
    for (let j = 0; j < sections; j += 1) {
      const a = i * cols + j;
      const b = a + 1;
      const d = (i + 1) * cols + j;
      const e = d + 1;
      // 绕序必须让法线朝上（+Y）：极坐标下「角向 × 径向」的顺序决定朝向
      index.push(a, b, d, b, e, d);
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geo.setIndex(index);
  geo.computeVertexNormals();
  geo.computeBoundingSphere();
  return geo;
}

/**
 * 构建地块外缘的裙壁与底盖（把地表做成一块可剖开的岩芯）。
 * @returns {THREE.BufferGeometry}
 */
export function buildBaseBlockGeometry() {
  const palette = readScenePalette();
  const segments = DEFAULT_SECTIONS;
  const positions = [];
  const colors = [];
  const index = [];
  const c = new THREE.Color();

  for (let j = 0; j <= segments; j += 1) {
    const theta = (Math.PI * 2 * j) / segments;
    const x = Math.cos(theta) * GROUND_RADIUS;
    const z = Math.sin(theta) * GROUND_RADIUS;
    const top = radialHeight(GROUND_RADIUS, theta, 'strato', DEFAULT_SEED);
    positions.push(x, top, z, x, BASE_Y, z);
    c.copy(palette.rock).lerp(palette.strata, 0.4);
    colors.push(c.r, c.g, c.b);
    c.copy(palette.rock).lerp(palette.strata, 0.15).multiplyScalar(0.55);
    colors.push(c.r, c.g, c.b);
  }
  for (let j = 0; j < segments; j += 1) {
    const a = j * 2;
    // 法线朝外（径向）
    index.push(a, a + 2, a + 1, a + 1, a + 2, a + 3);
  }

  // 底盖
  const centerIdx = positions.length / 3;
  positions.push(0, BASE_Y, 0);
  c.copy(palette.rock).multiplyScalar(0.5);
  colors.push(c.r, c.g, c.b);
  for (let j = 0; j < segments; j += 1) {
    const a = j * 2 + 1;
    // 底盖法线朝下（-Y）
    index.push(centerIdx, a, a + 2);
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geo.setIndex(index);
  geo.computeVertexNormals();
  return geo;
}

/**
 * 火山口底面（独立网格，橙灰色）。
 * @returns {THREE.BufferGeometry}
 */
export function buildCraterFloorGeometry(kind = 'strato', seed = DEFAULT_SEED, growth = 1) {
  const palette = readScenePalette();
  const segments = 48;
  const positions = [];
  const colors = [];
  const index = [];
  const c = new THREE.Color();
  const bottomY = radialHeight(0, 0, kind, seed, growth);

  positions.push(0, bottomY, 0);
  c.copy(palette.rock).lerp(palette.magma, 0.3);
  colors.push(c.r, c.g, c.b);

  for (let j = 0; j <= segments; j += 1) {
    const theta = (Math.PI * 2 * j) / segments;
    const r = CRATER_RADIUS * 0.985;
    positions.push(Math.cos(theta) * r, radialHeight(r, theta, kind, seed, growth), Math.sin(theta) * r);
    c.copy(palette.rock).lerp(palette.strata, 0.45).lerp(palette.magma, 0.1);
    colors.push(c.r, c.g, c.b);
  }
  for (let j = 0; j < segments; j += 1) {
    index.push(0, j + 2, j + 1);
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geo.setIndex(index);
  geo.computeVertexNormals();
  return geo;
}
