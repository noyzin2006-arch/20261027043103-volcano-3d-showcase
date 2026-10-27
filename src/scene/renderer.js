/**
 * 场景渲染器 —— 3D 体验的创建、状态映射与生命周期
 * 依据：handoff/plans/TASK-001.md §5.2 / §5.3 / §5.4
 *
 * 规则：
 *   1. 切章、切视角、切成因都不重建 renderer，只切 group.visible / 更新几何。
 *   2. 换火山类型时只更新 outerMesh geometry 并 dispose 旧几何。
 *   3. 动画循环只在「运行中 / 阻尼衰减 / 镜头过渡」时开启，静止时用 invalidate() 画一帧。
 *   4. document.hidden 时暂停计时器，回到前台不追帧。
 */

import * as THREE from 'three';
import {
  buildVolcanoGeometry,
  buildBaseBlockGeometry,
  buildCraterFloorGeometry,
  readScenePalette,
  DEFAULT_SEED,
  GROUND_RADIUS,
} from './terrain.js';
import { buildCrossSection } from './crossSection.js';
import { buildTectonicContext } from './tectonics.js';
import { buildImpactGroup, ERUPTION_SECONDS } from './effects.js';
import { createCameraRig, ROTATE_SIGN, ROTATE_STEP, PITCH_STEP, ZOOM_STEP } from './camera.js';

/** WebGL2 不可用时抛出的标准错误。 */
export class WebGLUnavailable extends Error {
  constructor(code = 'WEBGL_UNAVAILABLE', message = '此设备未能启动 WebGL 2') {
    super(message);
    this.name = 'WebGLUnavailable';
    this.code = code;
  }
}

/** 把 WebGL2 探针与 canvas 创建抽出来，便于测试。 */
export function probeWebGL2() {
  const canvas = document.createElement('canvas');
  return !!canvas.getContext('webgl2');
}

/**
 * 创建火山 3D 体验。
 * @param {HTMLElement} container 画布容器
 * @param {(status:{scene:string, reason?:string|null, progress?:number}) => void} onStatus
 * @returns {Promise<{setState:Function, resize:Function, dispose:Function, snapshotState:Function}>}
 */
export async function createVolcanoExperience(container, onStatus) {
  const status = onStatus ?? (() => {});

  if (!probeWebGL2()) {
    status({ scene: 'error', reason: '此设备未能启动 WebGL 2', progress: 0 });
    throw new WebGLUnavailable();
  }

  status({ scene: 'loading', reason: null, progress: 0 });

  const canvas = document.createElement('canvas');
  canvas.className = 'stage__canvas';
  canvas.setAttribute('role', 'img');
  canvas.setAttribute(
    'aria-label',
    '可旋转的三维火山模型示意：包含山体、火山口、地下岩浆房与岩浆通道。拖动可旋转视角。'
  );
  canvas.tabIndex = -1; // 不让 canvas 抢走唯一的交互焦点
  container.appendChild(canvas);

  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      alpha: false,
      powerPreference: 'high-performance',
    });
  } catch (err) {
    status({ scene: 'error', reason: '渲染器初始化失败', progress: 0 });
    throw new WebGLUnavailable('RENDERER_INIT_FAILED', String(err?.message ?? err));
  }

  const palette = readScenePalette();

  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.06;
  renderer.setClearColor(palette.rock.clone().multiplyScalar(0.22), 1);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(palette.rock.clone().multiplyScalar(0.22));

  // ---- 灯光：克制，不用 bloom，不用过曝橙色 ----
  // 规划案给的 0.7 / 2.1 在 ACES + 深底色下把山体压成全黑（实测不可读），
  // 按「能看清结构」的设计意图提高照度，并加一盏冷环境补光。
  scene.add(new THREE.AmbientLight(0xffffff, 1.05));
  scene.add(new THREE.HemisphereLight(0x8fb2c4, 0x241f1b, 0.45));
  const key = new THREE.DirectionalLight(0xd6e6f2, 2.5);
  key.position.set(-5, 9, 8);
  key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024);
  key.shadow.camera.near = 1;
  key.shadow.camera.far = 40;
  key.shadow.camera.left = -9;
  key.shadow.camera.right = 9;
  key.shadow.camera.top = 9;
  key.shadow.camera.bottom = -9;
  // normalBias 消除陡坡上的自阴影条纹（shadow acne）
  key.shadow.normalBias = 0.06;
  key.shadow.bias = -0.0004;
  scene.add(key);
  const fill = new THREE.DirectionalLight(0xfff2e2, 0.6);
  fill.position.set(6, 3, -6);
  scene.add(fill);

  // 视角跟随补光：剖面切面正对镜头时，背光的切面会黑成一片，读不出层理。
  // 这盏灯每帧跟随相机位置，保证用户看到的剖面永远有可读的基础照度。
  const headLight = new THREE.DirectionalLight(0xdfe9f2, 0.95);
  scene.add(headLight);
  scene.add(headLight.target);

  // ---- 相机 ----
  const rig = createCameraRig(canvas);

  // ---- 场景分组 ----
  const terrainGroup = new THREE.Group();
  terrainGroup.name = 'terrain';
  scene.add(terrainGroup);

  const baseBlock = new THREE.Mesh(
    buildBaseBlockGeometry(),
    new THREE.MeshStandardMaterial({
      vertexColors: true,
      roughness: 0.97,
      metalness: 0,
      side: THREE.DoubleSide,
    })
  );
  baseBlock.name = 'base-block';
  baseBlock.receiveShadow = true;
  terrainGroup.add(baseBlock);

  const volcanoGroup = new THREE.Group();
  volcanoGroup.name = 'volcano';
  scene.add(volcanoGroup);

  let volcanoMesh = null;
  let craterFloor = null;
  let crossSection = null;
  let currentGrowth = 1;

  // 剖面视图会从缺口看进山体内部 —— 必须双面渲染，
  // 否则背面被剔除，远侧岩体变透明，板块会「透」过山体显出来。
  const crustMat = new THREE.MeshStandardMaterial({
    vertexColors: true,
    roughness: 0.95,
    metalness: 0,
    side: THREE.DoubleSide,
  });
  const craterMat = new THREE.MeshStandardMaterial({
    vertexColors: true,
    roughness: 0.9,
    metalness: 0,
  });

  /** 重建火山地表几何（换类型/换增长阶段时）。 */
  function rebuildVolcano(kind, cutaway, growth) {
    if (volcanoMesh) {
      volcanoMesh.geometry.dispose();
      volcanoGroup.remove(volcanoMesh);
      volcanoMesh = null;
    }
    if (craterFloor) {
      craterFloor.geometry.dispose();
      volcanoGroup.remove(craterFloor);
      craterFloor = null;
    }
    volcanoMesh = new THREE.Mesh(buildVolcanoGeometry({ kind, cutaway, growth }), crustMat);
    volcanoMesh.name = 'volcano-surface';
    volcanoMesh.castShadow = true;
    volcanoMesh.receiveShadow = true;
    volcanoGroup.add(volcanoMesh);

    craterFloor = new THREE.Mesh(buildCraterFloorGeometry(kind, DEFAULT_SEED, growth), craterMat);
    craterFloor.name = 'crater-floor';
    volcanoGroup.add(craterFloor);
  }

  /** 重建剖面组（增长阶段变化时同步更新切面）。 */
  function rebuildCrossSection(kind, growth) {
    if (crossSection) {
      crossSection.userData.dispose?.();
      scene.remove(crossSection);
    }
    crossSection = buildCrossSection({ kind, growth });
    scene.add(crossSection);
  }

  rebuildVolcano('strato', true, 1);
  rebuildCrossSection('strato', 1);

  // ---- 三种地质环境（一次建好，按需显隐）----
  const tectonicGroups = new Map();
  for (const ctx of ['divergent', 'subduction', 'hotspot']) {
    const g = buildTectonicContext(ctx);
    g.visible = ctx === 'subduction';
    scene.add(g);
    tectonicGroups.set(ctx, g);
  }

  // ---- 影响场景组（互斥，按需显隐）----
  const impactGroups = new Map();
  let currentImpact = null;

  let impactGrowth = null;

  function ensureImpactGroup(impact, kind, growth) {
    const key = `${impact}@${growth}`;
    if (impactGroups.has(key)) return impactGroups.get(key);
    // growth 变了（火山体累积阶段变化）→ 旧的灰羽高度就错了，必须重建
    for (const [k, built] of impactGroups) {
      if (k.startsWith(`${impact}@`)) {
        built.group.visible = false;
        scene.remove(built.group);
        built.dispose();
        impactGroups.delete(k);
      }
    }
    const built = buildImpactGroup(impact, { kind, seed: DEFAULT_SEED, growth });
    built.group.visible = false;
    scene.add(built.group);
    impactGroups.set(key, built);
    return built;
  }

  // ---- 状态 ----
  let state = {
    chapter: 'formation',
    context: 'subduction',
    step: 1,
    volcanoType: 'strato',
    view: 'cutaway',
    impact: 'column',
    hazardKind: 'pyroclastic',
    eruption: 'idle',
    eruptionProgress: 0,
    reduceMotion: false,
  };

  let clockTime = 0;
  let eruptionClock = 0;
  let needsRender = true;
  let rafId = null;
  let disposed = false;

  const dirty = () => {
    needsRender = true;
    schedule();
  };

  function applyState(next) {
    const prev = state;
    state = { ...state, ...next };

    const cutaway = state.view === 'cutaway';
    const growth = [0.5, 0.72, 0.88, 1][state.step] ?? 1;

    if (state.volcanoType !== prev.volcanoType || state.view !== prev.view || growth !== currentGrowth) {
      currentGrowth = growth;
      rebuildVolcano(state.volcanoType, cutaway, growth);
      rebuildCrossSection(state.volcanoType, growth);
    }

    // 剖面只在 cutaway 显示
    if (crossSection) crossSection.visible = cutaway;

    // 地质环境只的形成章节显示
    for (const [ctx, g] of tectonicGroups) {
      g.visible = state.chapter === 'formation' && ctx === state.context;
    }

    // 影响组：只在影响章节显示，且互斥
    for (const [key, built] of impactGroups) {
      built.group.visible = false;
    }
    if (state.chapter === 'impact') {
      const built = ensureImpactGroup(state.impact, state.volcanoType, growth);
      built.group.visible = true;
      currentImpact = built;
      if (state.impact === 'hazard') {
        // 山麓三子类：只显示被选中的那一条
        built.group.getObjectByName('pyroclastic-flow') &&
          (built.group.getObjectByName('pyroclastic-flow').visible =
            state.hazardKind === 'pyroclastic');
        const lava = built.group.getObjectByName('lava-flow');
        const lahar = built.group.getObjectByName('lahar-flow');
        if (lava) lava.visible = state.hazardKind === 'lava';
        if (lahar) lahar.visible = state.hazardKind === 'lahar';
      }
    } else {
      currentImpact = null;
    }

    // 喷发状态
    if (state.eruption === 'running' && prev.eruption !== 'running') eruptionClock = 0;

    // 镜头
    if (state.view !== prev.view) rig.setPreset(state.view);

    dirty();
  }

  // ---- 渲染循环：只在需要时跑 ----
  let lastTs = 0;

  function frame(ts) {
    rafId = null;
    if (disposed) return;
    const dt = lastTs ? Math.min(0.1, (ts - lastTs) / 1000) : 0;
    lastTs = ts;

    // 页签不可见 → 暂停，不追帧
    if (document.hidden) return;

    const camAnimating = rig.update(dt);

    // 视角跟随补光对准当前注视点
    headLight.position.copy(rig.camera.position);
    headLight.target.position.copy(rig.controls.target);
    headLight.target.updateMatrixWorld();

    // 喷发进度由 store 驱动（单一状态真源），此处只负责把进度换算成动画时间。
    const animTime = state.eruptionProgress * ERUPTION_SECONDS;
    const sceneAnimating = state.eruption === 'running';

    if (currentImpact) currentImpact.update(animTime);
    if (crossSection?.visible) crossSection.userData.update(clockTime, state.step);

    clockTime += dt;

    if (camAnimating || sceneAnimating || needsRender) {
      renderer.render(scene, rig.camera);
      needsRender = false;
    }

    if (camAnimating || sceneAnimating) schedule();
  }

  function schedule() {
    if (rafId !== null || disposed) return;
    rafId = requestAnimationFrame(frame);
  }

  function invalidate() {
    dirty();
  }

  // ---- 尺寸 ----
  let resizeObserver = null;
  function resize() {
    const rect = container.getBoundingClientRect();
    const w = Math.max(1, Math.floor(rect.width));
    const h = Math.max(1, Math.floor(rect.height));
    const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    renderer.setPixelRatio(dpr);
    renderer.setSize(w, h, false);
    rig.resize(w, h);
    needsRender = true;
  }

  if (typeof ResizeObserver !== 'undefined') {
    resizeObserver = new ResizeObserver(() => resize());
    resizeObserver.observe(container);
  }
  resize();

  // ---- 上下文丢失 ----
  const onContextLost = (event) => {
    event.preventDefault();
    status({ scene: 'error', reason: '图形上下文丢失，可点击重试', progress: 0 });
  };
  const onContextRestored = () => {
    status({ scene: 'ready', reason: null, progress: 1 });
    dirty();
  };
  canvas.addEventListener('webglcontextlost', onContextLost, false);
  canvas.addEventListener('webglcontextrestored', onContextRestored, false);

  // ---- 初始渲染 ----
  renderer.render(scene, rig.camera);
  status({ scene: 'ready', reason: null, progress: 1 });

  function dispose() {
    disposed = true;
    if (rafId !== null) cancelAnimationFrame(rafId);
    rafId = null;
    resizeObserver?.disconnect();
    canvas.removeEventListener('webglcontextlost', onContextLost);
    canvas.removeEventListener('webglcontextrestored', onContextRestored);
    rig.dispose();
    for (const built of impactGroups.values()) built.dispose();
    for (const g of tectonicGroups.values()) g.userData.dispose?.();
    crossSection?.userData.dispose?.();
    volcanoMesh?.geometry.dispose();
    craterFloor?.geometry.dispose();
    baseBlock.geometry.dispose();
    crustMat.dispose();
    craterMat.dispose();
    renderer.dispose();
    canvas.remove();
  }

  return {
    setState: applyState,
    resize,
    dispose,
    invalidate,
    snapshotState: () => ({ ...state }),
    /** 供 UI 按钮调用（与 store 动作语义一致）。 */
    rotate: (dir) => rig.rotateBy(dir === 'left' ? ROTATE_SIGN.left * ROTATE_STEP : ROTATE_SIGN.right * ROTATE_STEP),
    pitch: (delta) => rig.rotateBy(0, delta * PITCH_STEP),
    zoom: (dir) => rig.zoomBy(dir === 'in' ? 1 / ZOOM_STEP : ZOOM_STEP),
    resetView: () => {
      rig.reset();
      dirty();
    },
    get eruptionClock() {
      return eruptionClock;
    },
    get groundRadius() {
      return GROUND_RADIUS;
    },
  };
}
