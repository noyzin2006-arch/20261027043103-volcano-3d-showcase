/**
 * 事件与 ARIA 控制器
 * 依据：handoff/plans/TASK-001.md §5.2「交互数据流」/ §4.6「微交互、四态、可访问性与响应」
 *
 * 数据流：按钮/键盘 → controller.dispatch → reducer 原子计算 → 同步 DOM 文案/ARIA
 *         → experience.setState 更新 mesh/动作 → invalidate 重绘。
 */

import { ACTIONS, ERUPTION_DURATION } from '../state/store.js';

/** 合法 hash → 章节。未知 hash 统一回落到 formation。 */
const HASH_TO_CHAPTER = { formation: 'formation', impact: 'impact' };

/**
 * @param {{root:HTMLElement, shell:object, store:object, experience:object|null, onSceneStatus?:Function}} deps
 */
export function createController({ root, shell, store, experience, onSceneStatus }) {
  const { dispatch, getState, subscribe } = store;
  const refs = shell.refs;

  // ---------------------------------------------------------------- 章节
  for (const btn of root.querySelectorAll('[data-chapter]')) {
    btn.addEventListener('click', () => {
      dispatch({ type: ACTIONS.NAVIGATE, payload: { chapter: btn.dataset.chapter } });
    });
  }

  // ---------------------------------------------------------------- 视角工具组
  for (const btn of refs.toolbar.querySelectorAll('button')) {
    const key = btn.dataset.view;
    btn.addEventListener('click', () => {
      if (!experience) return;
      if (key === 'cutaway' || key === 'whole' || key === 'top') {
        dispatch({ type: ACTIONS.SELECT_VIEW, payload: { view: key } });
        experience.setState({ view: key });
      } else if (key === 'tool-left') {
        experience.rotate('left');
      } else if (key === 'tool-right') {
        experience.rotate('right');
      } else if (key === 'tool-in') {
        experience.zoom('in');
      } else if (key === 'tool-out') {
        experience.zoom('out');
      } else if (key === 'tool-reset') {
        experience.resetView();
        dispatch({ type: ACTIONS.VIEW_RESET });
      }
    });
  }

  // 键盘方向键控制视角（焦点在工具条内时）
  refs.toolbar.addEventListener('keydown', (event) => {
    if (!experience) return;
    const map = {
      ArrowLeft: () => experience.rotate('left'),
      ArrowRight: () => experience.rotate('right'),
      ArrowUp: () => experience.pitch(1),
      ArrowDown: () => experience.pitch(-1),
    };
    const fn = map[event.key];
    if (!fn) return;
    event.preventDefault();
    fn();
  });

  // ---------------------------------------------------------------- 形成：成因 / 步骤 / 形态
  for (const [key, btn] of refs.ctxMap) {
    btn.addEventListener('click', () => {
      dispatch({ type: ACTIONS.SELECT_CONTEXT, payload: { context: key } });
    });
  }
  for (const [index, btn] of refs.stepMap) {
    btn.addEventListener('click', () => {
      dispatch({ type: ACTIONS.SELECT_STEP, payload: { step: index } });
    });
  }
  for (const [key, btn] of refs.typeMap) {
    btn.addEventListener('click', () => {
      dispatch({ type: ACTIONS.SELECT_VOLCANO, payload: { volcanoType: key } });
    });
  }

  // ---------------------------------------------------------------- 影响：现象 / 山麓子类
  for (const [key, btn] of refs.impactMap) {
    btn.addEventListener('click', () => {
      dispatch({ type: ACTIONS.SELECT_IMPACT, payload: { impact: key } });
    });
  }
  for (const [key, btn] of refs.hazardMap) {
    btn.addEventListener('click', () => {
      dispatch({ type: ACTIONS.SELECT_HAZARD, payload: { hazardKind: key } });
    });
  }

  // ---------------------------------------------------------------- 喷发控制
  refs.btnStart.addEventListener('click', () => {
    const s = getState();
    if (s.eruption === 'running') return;
    if (s.eruption === 'finished') {
      dispatch({ type: ACTIONS.ERUPTION_REPLAY });
    } else {
      dispatch({ type: ACTIONS.ERUPTION_START });
    }
  });
  refs.btnPause.addEventListener('click', () => {
    dispatch({ type: ACTIONS.ERUPTION_PAUSE });
  });
  refs.btnReplay.addEventListener('click', () => {
    dispatch({ type: ACTIONS.ERUPTION_REPLAY });
  });

  // ---------------------------------------------------------------- VEI 展开
  for (const [level, { btn }] of refs.veiRows) {
    btn.addEventListener('click', () => {
      shell.toggleVei(level);
    });
  }

  // ---------------------------------------------------------------- Esc 收起
  document.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape') return;
    let changed = false;
    for (const [, { btn, detail }] of refs.veiRows) {
      if (btn.getAttribute('aria-expanded') === 'true') {
        btn.setAttribute('aria-expanded', 'false');
        detail.hidden = true;
        changed = true;
      }
    }
    if (changed) event.preventDefault();
  });

  // ---------------------------------------------------------------- hash 路由
  function chapterFromHash() {
    const raw = (window.location.hash || '').replace('#', '').trim();
    return HASH_TO_CHAPTER[raw] ?? 'formation';
  }

  function applyHash() {
    const chapter = chapterFromHash();
    if (getState().chapter !== chapter) {
      dispatch({ type: ACTIONS.NAVIGATE, payload: { chapter } });
    }
  }

  window.addEventListener('hashchange', applyHash);

  // ---------------------------------------------------------------- 喷发时钟（store 驱动）
  let rafId = null;
  let lastTs = 0;
  const TICK_HZ = 30;

  function tick(ts) {
    rafId = null;
    const dt = lastTs ? (ts - lastTs) / 1000 : 0;
    lastTs = ts;
    const s = getState();
    if (s.eruption === 'running' && !document.hidden) {
      dispatch({ type: ACTIONS.ERUPTION_TICK, payload: { dt } });
      scheduleTick();
    }
  }

  function scheduleTick() {
    if (rafId !== null) return;
    rafId = requestAnimationFrame(tick);
  }

  // ---------------------------------------------------------------- 状态 → 视图
  let lastHash = null;
  subscribe((state, action) => {
    shell.update(state);
    if (experience) experience.setState(state);

    // 章节变化同步 hash（pushState 不触发 hashchange，不会成环）
    if (action.type === ACTIONS.NAVIGATE) {
      const next = `#${state.chapter}`;
      if (window.location.hash !== next) {
        lastHash = next;
        history.pushState(null, '', next);
      }
    }

    if (state.eruption === 'running') scheduleTick();
  });

  // 初始 hash
  const initial = chapterFromHash();
  if (initial !== getState().chapter) {
    dispatch({ type: ACTIONS.NAVIGATE, payload: { chapter: initial } });
  } else {
    history.replaceState(null, '', `#${initial}`);
  }

  return {
    applyHash,
    destroy() {
      window.removeEventListener('hashchange', applyHash);
      if (rafId !== null) cancelAnimationFrame(rafId);
    },
  };
}

export { ERUPTION_DURATION };
