/**
 * 状态机契约测试
 *
 * 覆盖 reducer 的白名单校验、幂等性、各类 action 的状态迁移，
 * 以及 createStore 的订阅 / 退订 / 通知语义。
 *
 * 注意：非法 action 会触发 console.warn，测试期间接管该输出，避免污染测试报告。
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import {
  ACTIONS,
  ERUPTION_DURATION,
  initialState,
  reducer,
  createStore,
} from '../src/state/store.js';

/** 执行一段逻辑并收集期间产生的 console.warn。 */
function withWarnings(fn) {
  const original = console.warn;
  const messages = [];
  console.warn = (...args) => {
    messages.push(args.map((a) => String(a)).join(' '));
  };
  try {
    return { value: fn(), messages };
  } finally {
    console.warn = original;
  }
}

describe('初始状态', () => {
  test('形状与规划案一致', () => {
    assert.deepEqual(
      initialState,
      {
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
        userOrbit: { yaw: 0, pitch: 0, distance: 1 },
      },
      '断言失败：initialState 与规划案不一致',
    );
    assert.equal(ERUPTION_DURATION, 12, `断言失败：喷发演示总时长应为 12 秒；实际 ${ERUPTION_DURATION}`);
    assert.ok(Object.isFrozen(ACTIONS), '断言失败：ACTIONS 应被冻结');
    assert.equal(Object.keys(ACTIONS).length, 20, `断言失败：白名单应有 20 个 action；实际 ${Object.keys(ACTIONS).length}`);
  });
});

describe('白名单与非法载荷', () => {
  test('不在白名单的 action 维持原引用并告警', () => {
    const { value, messages } = withWarnings(() => reducer(initialState, { type: 'NOT_AN_ACTION' }));
    assert.equal(value, initialState, '断言失败：非法 action 应返回同一 state 引用；实际返回了新对象');
    assert.equal(messages.length, 1, `断言失败：非法 action 应告警一次；实际 ${messages.length} 次`);
  });

  test('非法 payload 维持原引用并告警', () => {
    // ERUPTION_TICK 先决于喷发状态：只有运行中才会校验 dt
    const running = reducer(initialState, { type: 'ERUPTION_START' });
    const cases = [
      { base: initialState, action: { type: 'SELECT_CONTEXT', payload: { context: 'nope' } } },
      { base: initialState, action: { type: 'SELECT_STEP', payload: { step: 9 } } },
      { base: initialState, action: { type: 'SELECT_VIEW', payload: { view: 'nowhere' } } },
      { base: initialState, action: { type: 'FACT_TOGGLE', payload: { factId: '' } } },
      { base: running, action: { type: 'ERUPTION_TICK', payload: { dt: 0 } } },
      { base: running, action: { type: 'ERUPTION_TICK', payload: { dt: 'x' } } },
    ];
    for (const { base, action } of cases) {
      const { value, messages } = withWarnings(() => reducer(base, action));
      assert.equal(
        value,
        base,
        `断言失败：非法载荷 ${action.type} ${JSON.stringify(action.payload)} 应维持原引用；实际返回了新对象`,
      );
      assert.equal(
        messages.length,
        1,
        `断言失败：非法载荷 ${action.type} ${JSON.stringify(action.payload)} 应告警一次；实际 ${messages.length} 次`,
      );
    }
  });
});

describe('幂等：重复 action 不产生新对象', () => {
  test('同值选择与重复启动维持原引用', () => {
    const cases = [
      { type: 'SELECT_VIEW', payload: { view: 'cutaway' } },
      { type: 'SELECT_CONTEXT', payload: { context: 'subduction' } },
      { type: 'SELECT_STEP', payload: { step: 1 } },
      { type: 'SELECT_VOLCANO', payload: { volcanoType: 'strato' } },
      { type: 'SELECT_IMPACT', payload: { impact: 'column' } },
      { type: 'SELECT_HAZARD', payload: { hazardKind: 'pyroclastic' } },
      { type: 'NAVIGATE', payload: { chapter: 'formation' } },
    ];
    for (const action of cases) {
      const { value, messages } = withWarnings(() => reducer(initialState, action));
      assert.equal(
        value,
        initialState,
        `断言失败：重复 action ${action.type} 应返回同一 state 引用；实际返回了新对象`,
      );
      assert.equal(messages.length, 0, `断言失败：重复 action ${action.type} 不应告警；实际 ${messages.length} 次`);
    }

    const running = reducer(initialState, { type: 'ERUPTION_START' });
    const { value, messages } = withWarnings(() => reducer(running, { type: 'ERUPTION_START' }));
    assert.equal(value, running, '断言失败：重复 ERUPTION_START 应返回同一 state 引用');
    assert.equal(messages.length, 0, `断言失败：重复 ERUPTION_START 不应告警；实际 ${messages.length} 次`);
  });

  test('非运行态下的暂停维持原引用', () => {
    const { value, messages } = withWarnings(() => reducer(initialState, { type: 'ERUPTION_PAUSE' }));
    assert.equal(value, initialState, '断言失败：未运行时 ERUPTION_PAUSE 应返回同一 state 引用');
    assert.equal(messages.length, 0, `断言失败：未运行时 ERUPTION_PAUSE 不应告警；实际 ${messages.length} 次`);
  });
});

describe('章节与影响切换', () => {
  test('切章重置喷发进度与选中事实', () => {
    const busy = reducer(
      reducer(initialState, { type: 'ERUPTION_START' }),
      { type: 'FACT_TOGGLE', payload: { factId: 'a-land-count' } },
    );
    const ticked = reducer(busy, { type: 'ERUPTION_TICK', payload: { dt: 6 } });
    assert.notEqual(ticked, busy, '断言失败：前置状态应已改变（用于验证切章重置）');

    const next = reducer(ticked, { type: 'NAVIGATE', payload: { chapter: 'impact' } });
    assert.notEqual(next, ticked, '断言失败：切章应产生新 state 引用');
    assert.equal(next.chapter, 'impact', `断言失败：切章后 chapter 应为 impact；实际 ${next.chapter}`);
    assert.equal(next.eruption, 'idle', `断言失败：切章后喷发应重置为 idle；实际 ${next.eruption}`);
    assert.equal(next.eruptionProgress, 0, `断言失败：切章后进度应重置为 0；实际 ${next.eruptionProgress}`);
    assert.equal(next.selectedFactId, null, `断言失败：切章后选中事实应清空；实际 ${next.selectedFactId}`);
  });

  test('切换影响现象会结束喷发动画', () => {
    const running = reducer(initialState, { type: 'ERUPTION_START' });
    const next = reducer(running, { type: 'SELECT_IMPACT', payload: { impact: 'climate' } });
    assert.notEqual(next, running, '断言失败：切换影响应产生新 state 引用');
    assert.equal(next.impact, 'climate', `断言失败：impact 应为 climate；实际 ${next.impact}`);
    assert.equal(next.eruption, 'idle', `断言失败：切换影响后喷发应重置为 idle；实际 ${next.eruption}`);
    assert.equal(next.eruptionProgress, 0, `断言失败：切换影响后进度应重置为 0；实际 ${next.eruptionProgress}`);
  });
});

describe('喷发动画', () => {
  test('进度按 dt / 12 递增，到 1 转为 finished', () => {
    const running = reducer(initialState, { type: 'ERUPTION_START' });
    const ticked = reducer(running, { type: 'ERUPTION_TICK', payload: { dt: 3 } });
    assert.equal(ticked.eruption, 'running', `断言失败：进度未满时仍应为 running；实际 ${ticked.eruption}`);
    assert.ok(
      Math.abs(ticked.eruptionProgress - 3 / ERUPTION_DURATION) < 1e-12,
      `断言失败：进度应增加 dt/12；实际 ${ticked.eruptionProgress}`,
    );

    const finished = reducer(ticked, { type: 'ERUPTION_TICK', payload: { dt: 20 } });
    assert.equal(finished.eruptionProgress, 1, `断言失败：进度应封顶为 1；实际 ${finished.eruptionProgress}`);
    assert.equal(finished.eruption, 'finished', `断言失败：进度满时应转为 finished；实际 ${finished.eruption}`);
  });

  test('重播把进度归零并重新运行', () => {
    const finished = reducer(
      reducer(initialState, { type: 'ERUPTION_START' }),
      { type: 'ERUPTION_TICK', payload: { dt: 99 } },
    );
    const replayed = reducer(finished, { type: 'ERUPTION_REPLAY' });
    assert.equal(replayed.eruption, 'running', `断言失败：重播后应为 running；实际 ${replayed.eruption}`);
    assert.equal(replayed.eruptionProgress, 0, `断言失败：重播后进度应为 0；实际 ${replayed.eruptionProgress}`);
  });
});

describe('事实选中', () => {
  test('同一 id 反复切换在 id 与 null 之间来回', () => {
    const on = reducer(initialState, { type: 'FACT_TOGGLE', payload: { factId: 'a-land-count' } });
    assert.equal(on.selectedFactId, 'a-land-count', `断言失败：应选中 a-land-count；实际 ${on.selectedFactId}`);

    const off = reducer(on, { type: 'FACT_TOGGLE', payload: { factId: 'a-land-count' } });
    assert.equal(off.selectedFactId, null, `断言失败：再次切换应取消选中；实际 ${off.selectedFactId}`);

    const other = reducer(on, { type: 'FACT_TOGGLE', payload: { factId: 'a-seafloor-count' } });
    assert.equal(other.selectedFactId, 'a-seafloor-count', `断言失败：应切换到新事实；实际 ${other.selectedFactId}`);
  });
});

describe('视角控制', () => {
  test('旋转累加偏航角，俯仰角被夹在 [-0.6, 0.6]', () => {
    const once = reducer(initialState, { type: 'VIEW_ROTATE', payload: { yawDelta: 0.5 } });
    const twice = reducer(once, { type: 'VIEW_ROTATE', payload: { yawDelta: 0.25 } });
    assert.ok(
      Math.abs(twice.userOrbit.yaw - 0.75) < 1e-12,
      `断言失败：偏航角应累加为 0.75；实际 ${twice.userOrbit.yaw}`,
    );

    const up = reducer(initialState, { type: 'VIEW_ROTATE', payload: { yawDelta: 0, pitchDelta: 5 } });
    assert.equal(up.userOrbit.pitch, 0.6, `断言失败：俯仰角应夹到上界 0.6；实际 ${up.userOrbit.pitch}`);
    const down = reducer(initialState, { type: 'VIEW_ROTATE', payload: { yawDelta: 0, pitchDelta: -5 } });
    assert.equal(down.userOrbit.pitch, -0.6, `断言失败：俯仰角应夹到下界 -0.6；实际 ${down.userOrbit.pitch}`);
  });

  test('缩放为倍率相乘并夹在 [0.6, 2.2]', () => {
    const zoomed = reducer(initialState, { type: 'VIEW_ZOOM', payload: { factor: 1.5 } });
    assert.ok(
      Math.abs(zoomed.userOrbit.distance - 1.5) < 1e-12,
      `断言失败：缩放后距离应为 1.5；实际 ${zoomed.userOrbit.distance}`,
    );

    const far = reducer(zoomed, { type: 'VIEW_ZOOM', payload: { factor: 10 } });
    assert.equal(far.userOrbit.distance, 2.2, `断言失败：距离应夹到上界 2.2；实际 ${far.userOrbit.distance}`);

    const near = reducer(zoomed, { type: 'VIEW_ZOOM', payload: { factor: 0.01 } });
    assert.equal(near.userOrbit.distance, 0.6, `断言失败：距离应夹到下界 0.6；实际 ${near.userOrbit.distance}`);
  });

  test('重置把视角恢复为默认值', () => {
    const moved = reducer(
      reducer(initialState, { type: 'VIEW_ROTATE', payload: { yawDelta: 1.2, pitchDelta: 0.4 } }),
      { type: 'VIEW_ZOOM', payload: { factor: 1.8 } },
    );
    const reset = reducer(moved, { type: 'VIEW_RESET' });
    assert.deepEqual(
      reset.userOrbit,
      { yaw: 0, pitch: 0, distance: 1 },
      '断言失败：VIEW_RESET 后视角应恢复默认；实际 ' + JSON.stringify(reset.userOrbit),
    );
  });
});

describe('场景状态', () => {
  test('错误态记录原因，缺省为「未知原因」', () => {
    const failed = reducer(initialState, { type: 'SCENE_ERROR', payload: { reason: 'WebGL 不可用' } });
    assert.equal(failed.scene, 'error', `断言失败：scene 应为 error；实际 ${failed.scene}`);
    assert.equal(failed.sceneReason, 'WebGL 不可用', `断言失败：应记录原因；实际 ${failed.sceneReason}`);

    const blank = reducer(initialState, { type: 'SCENE_ERROR' });
    assert.equal(blank.sceneReason, '未知原因', `断言失败：缺省原因应为「未知原因」；实际 ${blank.sceneReason}`);
  });
});

describe('store：订阅与通知', () => {
  test('订阅者收到 (nextState, action)，退订后不再收到', () => {
    const store = createStore();
    const seen = [];
    const unsubscribe = store.subscribe((state, action) => seen.push([state, action]));

    const action = { type: 'SELECT_VIEW', payload: { view: 'whole' } };
    store.dispatch(action);
    assert.equal(seen.length, 1, `断言失败：一次状态变化应通知一次；实际 ${seen.length} 次`);
    assert.equal(seen[0][0], store.getState(), '断言失败：通知的 state 应与 getState() 一致');
    assert.equal(seen[0][1], action, '断言失败：通知应携带原始 action');

    const noop = store.dispatch({ type: 'SELECT_VIEW', payload: { view: 'whole' } });
    assert.equal(noop, store.getState(), '断言失败：无变化时 dispatch 应返回当前 state');
    assert.equal(seen.length, 1, `断言失败：无变化时不应通知订阅者；实际通知 ${seen.length} 次`);

    assert.equal(typeof unsubscribe, 'function', '断言失败：subscribe 应返回退订函数');
    unsubscribe();
    store.dispatch({ type: 'SELECT_VIEW', payload: { view: 'top' } });
    assert.equal(seen.length, 1, `断言失败：退订后不应再收到通知；实际收到 ${seen.length} 次`);
  });

  test('非法 action 不触发订阅通知', () => {
    const store = createStore();
    const seen = [];
    store.subscribe((state) => seen.push(state));

    const { value, messages } = withWarnings(() =>
      store.dispatch({ type: 'SELECT_CONTEXT', payload: { context: 'nope' } }),
    );
    assert.equal(value, store.getState(), '断言失败：非法 action 后 state 应保持不变');
    assert.equal(seen.length, 0, `断言失败：非法 action 不应通知订阅者；实际通知 ${seen.length} 次`);
    assert.equal(messages.length, 1, `断言失败：非法 action 应告警一次；实际 ${messages.length} 次`);
  });
});
