/**
 * 入口 —— 启动、异常边界与降级
 * 依据：handoff/plans/TASK-001.md T01 / T11
 *
 * 规则：
 *   1. 先 HTML 骨架可读，再本地生成几何，最后进入可交互。
 *   2. WebGL 不可用 / 构建超时不黑屏：切到静态剖面 + 完整文字 + 同样可用的按钮。
 *   3. 降级时绝不谎称 3D 已就绪。
 */

import './styles/tokens.css';
import './styles/base.css';
import './styles/components.css';

import { createStore } from './state/store.js';
import { createShell } from './ui/renderShell.js';
import { createController } from './ui/controller.js';
import { mountFallback } from './ui/textFallback.js';
import { createVolcanoExperience, WebGLUnavailable } from './scene/renderer.js';

const root = document.getElementById('app');

if (!root) {
  throw new Error('缺少 #app 容器');
}

const store = createStore();
const shell = createShell(root);
shell.update(store.getState());

// 尊重系统的减弱动效偏好
const motionQuery = window.matchMedia?.('(prefers-reduced-motion: reduce)');
if (motionQuery?.matches) {
  store.dispatch({ type: 'SET_REDUCED_MOTION', payload: { value: true } });
}
motionQuery?.addEventListener?.('change', (event) => {
  store.dispatch({ type: 'SET_REDUCED_MOTION', payload: { value: event.matches } });
});

let experience = null;
let fallback = null;

/** 场景状态变化 → 外壳状态条。 */
function handleSceneStatus({ scene, reason }) {
  if (scene === 'error') {
    store.dispatch({ type: 'SCENE_ERROR', payload: { reason } });
  } else if (scene === 'ready') {
    store.dispatch({ type: 'SCENE_READY' });
  } else {
    store.dispatch({ type: 'SCENE_LOADING' });
  }
}

/** 启用静态降级剖面。 */
function enableFallback(reason) {
  if (fallback) return;
  const container = shell.slots.canvas;
  container.textContent = '';
  fallback = mountFallback(container, {
    kind: store.getState().volcanoType,
    growth: [0.5, 0.72, 0.88, 1][store.getState().step] ?? 1,
    reason,
  });
  store.dispatch({ type: 'SCENE_ERROR', payload: { reason } });
}

/**
 * 初始化 3D。失败不抛出到全局：降级 + 文字教学继续可用。
 */
async function boot() {
  try {
    experience = await createVolcanoExperience(shell.slots.canvas, handleSceneStatus);
    store.dispatch({ type: 'SCENE_READY' });
  } catch (error) {
    if (error instanceof WebGLUnavailable || error?.code === 'WEBGL_UNAVAILABLE') {
      enableFallback('此设备未能启动 WebGL 2');
    } else {
      console.error('[main] 3D 初始化失败', error);
      enableFallback('3D 初始化失败，已启用静态剖面');
    }
  }

  // 控制器必须在 experience 就绪后创建，才能拿到 setState
  createController({ root, shell, store, experience, onSceneStatus: handleSceneStatus });

  // 补一次渲染：控制器创建前的状态派发（SCENE_READY）当时还没有订阅者
  shell.update(store.getState());

  // 降级模式下，山形/阶段变化要同步刷新静态剖面
  store.subscribe((state) => {
    if (!fallback) return;
    fallback.update(state.volcanoType, [0.5, 0.72, 0.88, 1][state.step] ?? 1);
  });

  // 窗口尺寸变化 → 相机与画布
  window.addEventListener('resize', () => experience?.resize());

  // 返回前台时重绘一帧，不追帧
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) experience?.invalidate();
  });
}

boot();

// 便于调试与自动化测试挂载
window.__volcano = {
  store,
  shell,
  get experience() {
    return experience;
  },
  /** 已渲染帧数（自动化实测 FPS 用） */
  get frameCount() {
    return experience?.frameCount ?? 0;
  },
};
