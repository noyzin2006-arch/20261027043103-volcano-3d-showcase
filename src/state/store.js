/**
 * 同步纯状态机 —— 单一状态真源
 * 依据：handoff/plans/TASK-001.md §5.2「规范化数据接口与状态机契约」
 *
 * 规则：
 *   1. reducer 是纯函数，不碰 DOM、不碰 Three、不碰网络。
 *   2. action 白名单严格校验；非法 payload 维持旧 state 并 console.warn（不作为 UI 错误暴露）。
 *   3. 同类重复 action 幂等：重复 SELECT_* 不产生新对象引用变化。
 */

/** 喷发演示总时长（秒）——规划案 §5.3「预置 12s、非真实时间」。 */
export const ERUPTION_DURATION = 12;

export const ACTIONS = Object.freeze({
  NAVIGATE: 'NAVIGATE',
  SELECT_CONTEXT: 'SELECT_CONTEXT',
  SELECT_STEP: 'SELECT_STEP',
  SELECT_VOLCANO: 'SELECT_VOLCANO',
  SELECT_VIEW: 'SELECT_VIEW',
  SELECT_IMPACT: 'SELECT_IMPACT',
  SELECT_HAZARD: 'SELECT_HAZARD',
  ERUPTION_START: 'ERUPTION_START',
  ERUPTION_TICK: 'ERUPTION_TICK',
  ERUPTION_PAUSE: 'ERUPTION_PAUSE',
  ERUPTION_REPLAY: 'ERUPTION_REPLAY',
  VIEW_ROTATE: 'VIEW_ROTATE',
  VIEW_ZOOM: 'VIEW_ZOOM',
  VIEW_RESET: 'VIEW_RESET',
  SCENE_LOADING: 'SCENE_LOADING',
  SCENE_READY: 'SCENE_READY',
  SCENE_ERROR: 'SCENE_ERROR',
  SCENE_CANCEL: 'SCENE_CANCEL',
  FACT_TOGGLE: 'FACT_TOGGLE',
  SET_REDUCED_MOTION: 'SET_REDUCED_MOTION',
});

const CHAPTERS = Object.freeze(['formation', 'impact']);
const CONTEXTS = Object.freeze(['divergent', 'subduction', 'hotspot']);
const STEPS = Object.freeze([0, 1, 2, 3]);
const VOLCANO_TYPES = Object.freeze(['shield', 'strato', 'cinder']);
const VIEWS = Object.freeze(['cutaway', 'whole', 'top']);
const IMPACTS = Object.freeze(['column', 'aviation', 'climate', 'hazard', 'benefit']);
const HAZARDS = Object.freeze(['pyroclastic', 'lahar', 'lava']);
const ERUPTION_STATES = Object.freeze(['idle', 'running', 'paused', 'finished']);
const SCENE_STATES = Object.freeze(['loading', 'ready', 'error', 'cancelled']);

/** 初始状态。形成章节默认：俯冲带 → 部分熔融 → 层状火山 → 剖面（规划案 §4.1）。 */
export const initialState = Object.freeze({
  chapter: 'formation',
  context: 'subduction',
  step: 1,
  volcanoType: 'strato',
  view: 'cutaway',
  impact: 'column',
  hazardKind: 'pyroclastic',
  eruption: 'idle',
  eruptionProgress: 0,
  selectedFactId: null,
  scene: 'loading',
  sceneReason: null,
  reduceMotion: false,
  userOrbit: Object.freeze({ yaw: 0, pitch: 0, distance: 1 }),
});

const warn = (action, detail) => {
  // 非法 action/payload：维持旧状态，只在控制台记录，不在界面报错。
  console.warn(`[store] 忽略非法 action "${action}"：${detail}`);
};

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

/**
 * 纯 reducer。
 * @param {object} state
 * @param {{type:string, [k:string]:any}} action
 * @returns {object} 新状态；无变化时返回原引用（保证幂等）
 */
export function reducer(state, action) {
  if (!action || typeof action.type !== 'string' || !ACTIONS[action.type]) {
    warn(action?.type ?? '(空)', '不在白名单内');
    return state;
  }
  const p = action.payload ?? {};

  switch (action.type) {
    case ACTIONS.NAVIGATE: {
      const chapter = p.chapter;
      if (!CHAPTERS.includes(chapter)) {
        warn(action.type, `chapter="${chapter}" 非法`);
        return state;
      }
      if (state.chapter === chapter) return state;
      // 切章：重置喷发，避免旧章节特效残留（规划案 §5.4「旧章节效果在单次 setState 中先清空」）
      return {
        ...state,
        chapter,
        eruption: 'idle',
        eruptionProgress: 0,
        selectedFactId: null,
      };
    }

    case ACTIONS.SELECT_CONTEXT: {
      if (!CONTEXTS.includes(p.context)) {
        warn(action.type, `context="${p.context}" 非法`);
        return state;
      }
      if (state.context === p.context) return state;
      return { ...state, context: p.context };
    }

    case ACTIONS.SELECT_STEP: {
      const step = p.step;
      if (!STEPS.includes(step)) {
        warn(action.type, `step="${step}" 非法`);
        return state;
      }
      if (state.step === step) return state;
      return { ...state, step };
    }

    case ACTIONS.SELECT_VOLCANO: {
      if (!VOLCANO_TYPES.includes(p.volcanoType)) {
        warn(action.type, `volcanoType="${p.volcanoType}" 非法`);
        return state;
      }
      if (state.volcanoType === p.volcanoType) return state;
      return { ...state, volcanoType: p.volcanoType };
    }

    case ACTIONS.SELECT_VIEW: {
      if (!VIEWS.includes(p.view)) {
        warn(action.type, `view="${p.view}" 非法`);
        return state;
      }
      if (state.view === p.view) return state;
      return { ...state, view: p.view };
    }

    case ACTIONS.SELECT_IMPACT: {
      if (!IMPACTS.includes(p.impact)) {
        warn(action.type, `impact="${p.impact}" 非法`);
        return state;
      }
      if (state.impact === p.impact) return state;
      // 影响互斥：切到别的现象即结束喷发动画，避免叠着显示
      return {
        ...state,
        impact: p.impact,
        eruption: 'idle',
        eruptionProgress: 0,
      };
    }

    case ACTIONS.SELECT_HAZARD: {
      if (!HAZARDS.includes(p.hazardKind)) {
        warn(action.type, `hazardKind="${p.hazardKind}" 非法`);
        return state;
      }
      if (state.hazardKind === p.hazardKind) return state;
      return { ...state, hazardKind: p.hazardKind };
    }

    case ACTIONS.ERUPTION_START: {
      if (state.eruption === 'running') return state; // 幂等
      return { ...state, eruption: 'running' };
    }

    case ACTIONS.ERUPTION_TICK: {
      if (state.eruption !== 'running') return state;
      const dt = Number(p.dt);
      if (!Number.isFinite(dt) || dt <= 0) {
        warn(action.type, `dt="${p.dt}" 非法`);
        return state;
      }
      const next = clamp(state.eruptionProgress + dt / ERUPTION_DURATION, 0, 1);
      if (next >= 1) {
        return { ...state, eruptionProgress: 1, eruption: 'finished' };
      }
      return { ...state, eruptionProgress: next };
    }

    case ACTIONS.ERUPTION_PAUSE: {
      if (state.eruption !== 'running') return state;
      return { ...state, eruption: 'paused' };
    }

    case ACTIONS.ERUPTION_REPLAY: {
      return { ...state, eruption: 'running', eruptionProgress: 0 };
    }

    case ACTIONS.VIEW_ROTATE: {
      const yaw = Number(p.yawDelta);
      const pitch = Number(p.pitchDelta ?? 0);
      if (!Number.isFinite(yaw) || !Number.isFinite(pitch)) {
        warn(action.type, 'yawDelta/pitchDelta 必须是有限数');
        return state;
      }
      return {
        ...state,
        userOrbit: {
          ...state.userOrbit,
          yaw: state.userOrbit.yaw + yaw,
          pitch: clamp(state.userOrbit.pitch + pitch, -0.6, 0.6),
        },
      };
    }

    case ACTIONS.VIEW_ZOOM: {
      const factor = Number(p.factor);
      if (!Number.isFinite(factor) || factor <= 0) {
        warn(action.type, `factor="${p.factor}" 非法`);
        return state;
      }
      return {
        ...state,
        userOrbit: {
          ...state.userOrbit,
          distance: clamp(state.userOrbit.distance * factor, 0.6, 2.2),
        },
      };
    }

    case ACTIONS.VIEW_RESET: {
      return { ...state, userOrbit: initialState.userOrbit };
    }

    case ACTIONS.SCENE_LOADING: {
      if (state.scene === 'loading' && state.sceneReason === null) return state;
      return { ...state, scene: 'loading', sceneReason: null };
    }

    case ACTIONS.SCENE_READY: {
      if (state.scene === 'ready') return state;
      return { ...state, scene: 'ready', sceneReason: null };
    }

    case ACTIONS.SCENE_ERROR: {
      const reason = typeof p.reason === 'string' && p.reason ? p.reason : '未知原因';
      return { ...state, scene: 'error', sceneReason: reason };
    }

    case ACTIONS.SCENE_CANCEL: {
      if (state.scene === 'cancelled') return state;
      return { ...state, scene: 'cancelled', sceneReason: '已取消 3D 生成' };
    }

    case ACTIONS.FACT_TOGGLE: {
      const id = p.factId;
      if (typeof id !== 'string' || !id) {
        warn(action.type, 'factId 必须是非空字符串');
        return state;
      }
      return {
        ...state,
        selectedFactId: state.selectedFactId === id ? null : id,
      };
    }

    case ACTIONS.SET_REDUCED_MOTION: {
      const value = Boolean(p.value);
      if (state.reduceMotion === value) return state;
      return { ...state, reduceMotion: value };
    }

    default:
      return state;
  }
}

/**
 * 极简 store：同步 dispatch + 订阅。
 */
export function createStore(initial = initialState) {
  let state = initial;
  const listeners = new Set();

  const getState = () => state;

  const dispatch = (action) => {
    const next = reducer(state, action);
    if (next === state) return state; // 幂等 / 非法：不通知订阅者
    state = next;
    for (const fn of listeners) fn(state, action);
    return state;
  };

  const subscribe = (fn) => {
    listeners.add(fn);
    return () => listeners.delete(fn);
  };

  return { getState, dispatch, subscribe };
}
