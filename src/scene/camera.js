/**
 * 相机与视角控制
 * 依据：handoff/plans/TASK-001.md §5.2 / §5.3
 *
 * 规则：
 *   1. 按钮视角控制必须与 OrbitControls 的实际方向语义一致（U4：实测定符号，不凭直觉猜）。
 *   2. 视角动画只用 transform 类概念（相机位置/朝向），不用 DOM 动画。
 *   3. 尊重 prefers-reduced-motion：减弱动效时视角切换立即到位。
 */

import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

/** 默认镜头位置与目标（规划案 §5.3）。 */
export const DEFAULT_CAMERA = Object.freeze({
  position: [8, 5.8, 10.5],
  target: [0, 0.55, 0],
  fov: 38,
  near: 0.1,
  far: 100,
});

export const ORBIT_LIMITS = Object.freeze({
  minDistance: 7.5,
  maxDistance: 20,
  minPolarAngle: 0.45,
  maxPolarAngle: 1.42,
  dampingFactor: 0.08,
});

/**
 * 三个视角预设。位置按球坐标推导，保持与默认镜头同源的观察高度。
 * - cutaway：正对缺口，看得见岩浆房与通道
 * - whole：退后看完整山体
 * - top：高角度俯瞰，看喷发柱与山体关系
 */
export const VIEW_PRESETS = Object.freeze({
  cutaway: Object.freeze({ position: [8.6, 4.9, 9.6], target: [0, 0.5, 0] }),
  whole: Object.freeze({ position: [9.4, 6.2, 12.4], target: [0, 0.85, 0] }),
  top: Object.freeze({ position: [1.2, 13.6, 6.2], target: [0, 0.9, 0] }),
});

/**
 * 按钮旋转方向符号。
 * OrbitControls 的方位角 theta 自 +Z 轴向 +X 轴增大；在默认机位下，
 * 增大 theta 会让模型看起来向左转。故「向左旋转」取 +1，「向右旋转」取 -1。
 * 该符号在浏览器中实测过（见 reports/latest.md §视觉自检）。
 */
export const ROTATE_SIGN = Object.freeze({ left: 1, right: -1 });

/** 每次按钮旋转的角度（弧度）。 */
export const ROTATE_STEP = 0.15;
/** 每次按钮俯仰的角度（弧度）。 */
export const PITCH_STEP = 0.1;
/** 每次按钮缩放的倍率。 */
export const ZOOM_STEP = 1.15;

/**
 * 创建相机装置。
 * @param {HTMLCanvasElement} canvas
 * @param {{reducedMotion?: boolean}} [opts]
 */
export function createCameraRig(canvas, opts = {}) {
  const { reducedMotion = false } = opts;

  const camera = new THREE.PerspectiveCamera(
    DEFAULT_CAMERA.fov,
    1,
    DEFAULT_CAMERA.near,
    DEFAULT_CAMERA.far
  );
  camera.position.set(...DEFAULT_CAMERA.position);

  const controls = new OrbitControls(camera, canvas);
  controls.enablePan = false;
  controls.enableDamping = true;
  controls.dampingFactor = ORBIT_LIMITS.dampingFactor;
  controls.minDistance = ORBIT_LIMITS.minDistance;
  controls.maxDistance = ORBIT_LIMITS.maxDistance;
  controls.minPolarAngle = ORBIT_LIMITS.minPolarAngle;
  controls.maxPolarAngle = ORBIT_LIMITS.maxPolarAngle;
  controls.target.set(...DEFAULT_CAMERA.target);
  controls.update();

  const spherical = new THREE.Spherical();
  const offset = new THREE.Vector3();

  /** 记录一个待应用的视角（用于插值）。 */
  let transition = null;

  const clampPhi = (phi) =>
    Math.min(ORBIT_LIMITS.maxPolarAngle, Math.max(ORBIT_LIMITS.minPolarAngle, phi));
  const clampRadius = (r) =>
    Math.min(ORBIT_LIMITS.maxDistance, Math.max(ORBIT_LIMITS.minDistance, r));

  /** 读取当前相机相对目标的位置（球坐标）。 */
  function readSpherical() {
    offset.copy(camera.position).sub(controls.target);
    spherical.setFromVector3(offset);
    return spherical;
  }

  /** 直接把球坐标写回相机。 */
  function writeSpherical() {
    offset.setFromSpherical(spherical);
    camera.position.copy(controls.target).add(offset);
    camera.lookAt(controls.target);
  }

  /**
   * 切换到预设视角。
   * @param {'cutaway'|'whole'|'top'} view
   */
  function setPreset(view) {
    const preset = VIEW_PRESETS[view] ?? VIEW_PRESETS.cutaway;
    const target = new THREE.Vector3(...preset.target);
    const position = new THREE.Vector3(...preset.position);
    if (reducedMotion) {
      controls.target.copy(target);
      camera.position.copy(position);
      camera.lookAt(target);
      transition = null;
      controls.update();
      return;
    }
    transition = {
      fromPos: camera.position.clone(),
      toPos: position,
      fromTarget: controls.target.clone(),
      toTarget: target,
      t: 0,
      duration: 0.4, // --d-scene
    };
  }

  /**
   * 绕目标旋转视角。
   * @param {number} yawDelta 弧度，正值向左
   * @param {number} [pitchDelta] 弧度，正值向上
   */
  function rotateBy(yawDelta, pitchDelta = 0) {
    transition = null;
    spherical.copy(readSpherical());
    spherical.theta += yawDelta;
    spherical.phi = clampPhi(spherical.phi + pitchDelta);
    writeSpherical();
    controls.update();
  }

  /**
   * 缩放。
   * @param {number} factor 小于 1 拉近，大于 1 拉远
   */
  function zoomBy(factor) {
    transition = null;
    spherical.copy(readSpherical());
    spherical.radius = clampRadius(spherical.radius * factor);
    writeSpherical();
    controls.update();
  }

  /** 回到默认镜头。 */
  function reset() {
    transition = null;
    controls.target.set(...DEFAULT_CAMERA.target);
    camera.position.set(...DEFAULT_CAMERA.position);
    camera.lookAt(controls.target);
    controls.update();
  }

  /**
   * 每帧推进。
   * @param {number} dt 秒
   * @returns {boolean} 是否仍在动画（调用方据此决定是否继续 requestAnimationFrame）
   */
  function update(dt) {
    let animating = false;

    if (transition) {
      transition.t = Math.min(1, transition.t + dt / transition.duration);
      // ease-out：起步快、收尾稳
      const e = 1 - Math.pow(1 - transition.t, 3);
      camera.position.lerpVectors(transition.fromPos, transition.toPos, e);
      controls.target.lerpVectors(transition.fromTarget, transition.toTarget, e);
      camera.lookAt(controls.target);
      if (transition.t >= 1) transition = null;
      animating = true;
    }

    controls.update();
    if (controls.enableDamping) animating = true;

    return animating;
  }

  /** 按视口尺寸更新相机纵横比。 */
  function resize(width, height) {
    if (!width || !height) return;
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
  }

  function dispose() {
    controls.dispose();
  }

  return {
    camera,
    controls,
    setPreset,
    rotateBy,
    zoomBy,
    reset,
    update,
    resize,
    dispose,
    get isTransitioning() {
      return transition !== null;
    },
  };
}
