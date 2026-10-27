/**
 * 程序化火山地形测试
 *
 * 覆盖：
 *   1. 高度场 radialHeight 的确定性、有限性、形态差异
 *   2. 火口碗状结构、山脚归零、growth 生长系数
 *   3. 噪声函数 valueNoise / fbm 的取值范围
 *   4. 几何体的顶点/索引/法线合法性与可复现性
 *   5. 剖切几何确实只覆盖半个方位角
 *
 * 注意：terrain.js 的 readScenePalette() 依赖 DOM 的 getComputedStyle，
 *      Node 里不存在，因此必须在导入模块之前安装最小桩。
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

const SCENE_TOKENS = {
  '--scene-rock': '#515a59',
  '--scene-strata': '#76695a',
  '--scene-ash': '#b5b8b0',
  '--scene-magma': '#ff6c35',
  '--scene-soil': '#576956',
  '--scene-plate': '#4e8191',
  '--scene-water': '#3c7f9d',
  '--scene-aerosol': '#a5c8db',
};

globalThis.getComputedStyle = () => ({
  getPropertyValue: (name) => SCENE_TOKENS[name] ?? '',
});
globalThis.document = { documentElement: {} };

const T = await import('../src/scene/terrain.js');

/** 取几何体中所有顶点坐标的统计量。 */
function inspect(geometry) {
  const positions = geometry.attributes.position.array;
  const normals = geometry.attributes.normal?.array ?? null;
  let maxY = -Infinity;
  let maxYRadius = 0;
  let centreY = null;
  let nonFinite = 0;

  for (let i = 0; i < geometry.attributes.position.count; i += 1) {
    const x = positions[i * 3];
    const y = positions[i * 3 + 1];
    const z = positions[i * 3 + 2];
    if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(z)) nonFinite += 1;
    const radius = Math.hypot(x, z);
    if (radius < 1e-9 && centreY === null) centreY = y;
    if (y > maxY) {
      maxY = y;
      maxYRadius = radius;
    }
  }

  let normalNaN = 0;
  if (normals) for (const v of normals) if (!Number.isFinite(v)) normalNaN += 1;

  return { positions, maxY, maxYRadius, centreY, nonFinite, normalNaN, normals };
}

/** 方位角上的最大缺口（相邻顶点的角度间隔），用于判定剖切是否真的挖掉一半。 */
function maxAzimuthGap(geometry) {
  const positions = geometry.attributes.position.array;
  const angles = [];
  for (let i = 0; i < geometry.attributes.position.count; i += 1) {
    const x = positions[i * 3];
    const z = positions[i * 3 + 2];
    if (Math.hypot(x, z) < 1e-9) continue; // 第 0 环全部落在原点，退化点不计
    angles.push(Math.atan2(z, x));
  }
  angles.sort((a, b) => a - b);
  let max = 0;
  for (let i = 1; i < angles.length; i += 1) max = Math.max(max, angles[i] - angles[i - 1]);
  return Math.max(max, angles[0] + Math.PI * 2 - angles[angles.length - 1]);
}

describe('高度场：确定性与有限性', () => {
  test('同一输入恒得同一数值', () => {
    const samples = [
      [0.2, 0.4, 'strato'],
      [1.3, 2.1, 'shield'],
      [2.0, 5.5, 'cinder'],
      [4.9, 3.3, 'strato'],
    ];
    for (const [r, theta, kind] of samples) {
      const first = T.radialHeight(r, theta, kind, T.DEFAULT_SEED);
      for (let i = 0; i < 5; i += 1) {
        const again = T.radialHeight(r, theta, kind, T.DEFAULT_SEED);
        assert.equal(
          again,
          first,
          `断言失败：radialHeight(${r}, ${theta}, ${kind}) 不具确定性；实际 ${again} ≠ ${first}`,
        );
      }
    }
  });

  test('三种火山在全角度扫描下均无 NaN / Infinity', () => {
    const bad = [];
    for (const kind of T.VOLCANO_KINDS) {
      for (let r = 0; r <= T.GROUND_RADIUS; r += 0.25) {
        for (let theta = 0; theta < Math.PI * 2; theta += Math.PI / 12) {
          const y = T.radialHeight(r, theta, kind, T.DEFAULT_SEED);
          if (!Number.isFinite(y)) bad.push(`${kind} @ r=${r.toFixed(2)} θ=${theta.toFixed(2)} → ${y}`);
        }
      }
    }
    assert.deepEqual(bad, [], `断言失败：高度场出现非有限值；实际 ${JSON.stringify(bad.slice(0, 5))}`);
  });

  test('三类火山的峰高有序：层状 > 渣锥 > 盾状', () => {
    assert.ok(
      T.peakHeight('strato') > T.peakHeight('cinder') && T.peakHeight('cinder') > T.peakHeight('shield'),
      '断言失败：峰高顺序应为 strato > cinder > shield；实际 ' +
        `strato=${T.peakHeight('strato')} cinder=${T.peakHeight('cinder')} shield=${T.peakHeight('shield')}`,
    );
    assert.deepEqual([...T.VOLCANO_KINDS], ['strato', 'shield', 'cinder'], '断言失败：VOLCANO_KINDS 的种类不全');
  });
});

describe('高度场：火口、坡脚与生长系数', () => {
  test('中心为火口底部，比火山口沿低 0.42', () => {
    for (const kind of T.VOLCANO_KINDS) {
      const bottom = T.radialHeight(0, 0, kind, T.DEFAULT_SEED);
      const expected = T.peakHeight(kind) - 0.12 - 0.3;
      assert.ok(
        Math.abs(bottom - expected) < 1e-9,
        `断言失败：${kind} 的中心高度应为火口底部 ${expected}；实际 ${bottom}`,
      );
    }
  });

  test('山脚之外的高度接近 0', () => {
    const offenders = [];
    for (const kind of T.VOLCANO_KINDS) {
      for (let r = T.baseRadius(kind); r <= T.GROUND_RADIUS; r += 0.25) {
        for (const theta of [0, 1.1, 2.7, 4.4, 5.9]) {
          const y = T.radialHeight(r, theta, kind, T.DEFAULT_SEED);
          if (Math.abs(y) >= 0.4) offenders.push(`${kind} @ r=${r.toFixed(2)} → ${y}`);
        }
      }
    }
    assert.deepEqual(offenders, [], `断言失败：山脚之外高度应接近 0；实际越界 ${JSON.stringify(offenders.slice(0, 5))}`);
  });

  test('growth 系数单调缩小山体', () => {
    for (const kind of T.VOLCANO_KINDS) {
      const r = (T.CRATER_RADIUS + T.baseRadius(kind)) / 2;
      const half = T.radialHeight(r, 0.7, kind, T.DEFAULT_SEED, 0.5);
      const full = T.radialHeight(r, 0.7, kind, T.DEFAULT_SEED, 1);
      assert.ok(
        half < full,
        `断言失败：${kind} 在 growth=0.5 时应低于 growth=1；实际 ${half} ≥ ${full}`,
      );
    }
  });
});

describe('噪声函数', () => {
  test('valueNoise 与 fbm 取值落在 [-1.2, 1.2]', () => {
    let min = Infinity;
    let max = -Infinity;
    for (let i = 0; i < 3000; i += 1) {
      const x = ((i * 37) % 211) / 10 - 10;
      const y = ((i * 53) % 197) / 10 - 10;
      for (const value of [T.valueNoise(x, y, T.DEFAULT_SEED), T.fbm(x, y, T.DEFAULT_SEED)]) {
        if (!Number.isFinite(value)) {
          assert.fail(`断言失败：噪声函数返回非有限值；实际 ${value} @ (${x}, ${y})`);
        }
        min = Math.min(min, value);
        max = Math.max(max, value);
      }
    }
    assert.ok(
      min >= -1.2 && max <= 1.2,
      `断言失败：噪声取值应落在 [-1.2, 1.2]；实际区间 [${min}, ${max}]`,
    );
  });

  test('smoothstep 在区间两端取 0 与 1，并单调过渡', () => {
    assert.equal(T.smoothstep(0, 1, 0), 0, '断言失败：smoothstep(0,1,0) 应为 0');
    assert.equal(T.smoothstep(0, 1, 1), 1, '断言失败：smoothstep(0,1,1) 应为 1');
    const mid = T.smoothstep(0, 1, 0.5);
    assert.ok(mid > 0 && mid < 1, `断言失败：smoothstep 中点应介于 0 与 1 之间；实际 ${mid}`);
  });
});

describe('几何体：结构合法性', () => {
  test('顶点、索引、法线齐备且无 NaN', () => {
    for (const kind of T.VOLCANO_KINDS) {
      const geometry = T.buildVolcanoGeometry({ kind });
      const info = inspect(geometry);

      assert.equal(
        info.positions.length % 3,
        0,
        `断言失败：${kind} 的 position 长度应为 3 的倍数；实际 ${info.positions.length}`,
      );
      assert.equal(
        info.nonFinite,
        0,
        `断言失败：${kind} 的顶点坐标含非有限值；实际 ${info.nonFinite} 个`,
      );
      assert.ok(
        geometry.attributes.position.count > 0 && geometry.attributes.position.count <= 80000,
        `断言失败：${kind} 的顶点数应在 (0, 80000] 区间；实际 ${geometry.attributes.position.count}`,
      );
      assert.ok(
        geometry.getIndex() && geometry.getIndex().count > 0,
        `断言失败：${kind} 的索引数组不得为空；实际 ${geometry.getIndex()?.count ?? '无索引'}`,
      );
      assert.ok(
        geometry.attributes.normal && info.normalNaN === 0,
        `断言失败：${kind} 的法线属性缺失或含 NaN；实际 NaN ${info.normalNaN} 个`,
      );
    }
  });

  test('火山口是碗状：最高点不在中心', () => {
    for (const kind of T.VOLCANO_KINDS) {
      const geometry = T.buildVolcanoGeometry({ kind });
      const info = inspect(geometry);
      assert.ok(
        Number.isFinite(info.maxY) && info.maxYRadius > 0,
        `断言失败：${kind} 的最高点应在中心之外的半径处；实际 maxY=${info.maxY} @ r=${info.maxYRadius}`,
      );
      assert.ok(
        info.centreY < info.maxY,
        `断言失败：${kind} 的中心应低于最高点（碗状火山口）；实际中心 ${info.centreY} ≥ 最高点 ${info.maxY}`,
      );
    }
  });

  test('同一 seed 两次构建的顶点数据逐字节一致', () => {
    const a = T.buildVolcanoGeometry({ kind: 'strato', seed: 427 });
    const b = T.buildVolcanoGeometry({ kind: 'strato', seed: 427 });
    assert.ok(
      Buffer.from(a.attributes.position.array.buffer).equals(Buffer.from(b.attributes.position.array.buffer)),
      '断言失败：相同 seed 的两次构建结果不一致（几何不可复现）',
    );
  });

  test('剖切几何只覆盖半个方位角', () => {
    const cut = T.buildVolcanoGeometry({ kind: 'strato', cutaway: true });
    const whole = T.buildVolcanoGeometry({ kind: 'strato', cutaway: false });

    const cutGap = maxAzimuthGap(cut);
    const wholeGap = maxAzimuthGap(whole);

    assert.ok(
      Math.abs(cutGap - Math.PI) < 0.05,
      `断言失败：剖切几何的方位角缺口应为 π（约半圈）；实际 ${cutGap.toFixed(4)}`,
    );
    assert.ok(
      wholeGap < 0.2,
      `断言失败：完整几何不应有方位角缺口；实际最大缺口 ${wholeGap.toFixed(4)}`,
    );
    assert.ok(
      cutGap > wholeGap * 10,
      `断言失败：剖切缺口应远大于完整几何；实际 ${cutGap.toFixed(4)} vs ${wholeGap.toFixed(4)}`,
    );
  });

  test('基座裙壁与火山口底面几何合法', () => {
    const base = T.buildBaseBlockGeometry();
    const crater = T.buildCraterFloorGeometry('strato', T.DEFAULT_SEED, 1);

    for (const [name, geometry] of [['基座', base], ['火山口底面', crater]]) {
      const info = inspect(geometry);
      assert.equal(
        info.nonFinite,
        0,
        `断言失败：${name}几何含非有限坐标；实际 ${info.nonFinite} 个`,
      );
      assert.ok(
        geometry.getIndex() && geometry.getIndex().count > 0,
        `断言失败：${name}几何的索引数组不得为空；实际 ${geometry.getIndex()?.count ?? '无索引'}`,
      );
      assert.ok(
        geometry.attributes.normal && info.normalNaN === 0,
        `断言失败：${name}几何的法线缺失或含 NaN；实际 NaN ${info.normalNaN} 个`,
      );
    }
  });
});
