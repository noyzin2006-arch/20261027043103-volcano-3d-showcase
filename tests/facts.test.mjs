/**
 * 事实库与章节数据契约测试
 *
 * 覆盖：
 *   1. FACTS 的结构完整性（9 个字段、章节覆盖、id 唯一、来源 URL 白名单）
 *   2. 硬数值的逐字保留（防止后续编辑悄悄改数）
 *   3. VEI_ROWS / VEI_FACT_IDS / SOURCES 的结构契约
 *   4. chapters.js 的常量、默认值与 factId 引用完整性
 *   5. 「硬数值只存在于 facts.js」的单一真源约束
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

import {
  FACTS,
  VEI_ROWS,
  VEI_FACT_IDS,
  SOURCES,
  getFact,
  getFacts,
} from '../src/data/facts.js';
import {
  FORMATION_CONTEXTS,
  FORMATION_STEPS,
  VOLCANO_TYPES,
  IMPACTS,
  HAZARD_KINDS,
  CONTEXT_META,
  VOLCANO_TYPE_META,
  IMPACT_META,
  HAZARD_KIND_META,
  DEFAULT_FORMATION,
  DEFAULT_IMPACT,
} from '../src/data/chapters.js';

/** 唯一允许出现的外部来源 URL。 */
const APPROVED_URLS = new Set([
  'https://pubs.usgs.gov/gip/volc/types.html',
  'https://science.nasa.gov/mission/aura/aura-measurements-of-an-underwater-volcano-eruption/',
  'https://mynasadata.larc.nasa.gov/phenomenon/volcanic-eruptions/interactives',
  'https://www.usgs.gov/programs/VHP',
  'https://lavacentre.is/the-experience/',
]);

/** 每条事实必须具备的 9 个字段。 */
const FACT_KEYS = [
  'id',
  'section',
  'title',
  'valueText',
  'explanation',
  'sourceLabel',
  'sourceUrl',
  'sourceYearOrPeriod',
  'caveat',
];

/** 章节代号。 */
const SECTIONS = ['A', 'B', 'C', 'D', 'E', 'F', 'G'];

/**
 * 硬数值原样保留清单 —— 这些字符串必须逐字出现在 facts.js 的
 * valueText / explanation / caveat 之中。
 * 注：坦博拉降温区间在源文件中的逐字写法是「均温降 0.4–0.7 °C」
 *     （而不是「约 0.4–0.7 °C」），此处按源文件逐字断言。
 */
const HARD_NUMBERS = [
  '约 1350 座',
  '约 2.5 万座',
  '约 4 万 km',
  '450–512 座',
  '约 75%',
  '约 1.17 万年',
  '97 座火山锥',
  '900–1400 °C',
  '约 7.5 万 km³',
  '约 9000 m',
  '约 1250 °C',
  '超过 1.6 km',
  '每级约 10 倍',
  'VEI 7 约每千年 1 次',
  'VEI 0 也可能造成重大损失',
  '1–2 km',
  '2–45 km',
  '柱高翻倍 → 物量翻 16 倍',
  '100–200 km/h',
  '约 700 °C',
  '35–40 km',
  '约 2000 万吨 SO₂',
  '约 0.5 °C · 持续约两年',
  '16 架飞机受损',
  '约 160 km³',
  '均温降 0.4–0.7 °C',
  '57 km',
  '约 30 亿吨',
  '约 1400 °C',
  '2 mg/m³',
  '约 300 m³ / 秒',
  '全球 9 个',
  '85 天 · 3000 余栋 · 7000 人',
  '2500 m 深的「黑烟囱」',
];

/**
 * 已登记的「chapters.js 硬数值副本」白名单。
 * 每一项都是已知的规则违背（chapters.js 自身规则 1 要求硬数值只留在 facts.js），
 * 此处显式登记，使「新增副本」会被测试立刻拦下，同时把现状钉死。
 *
 * 2026-10-27：原登记的「约 700 °C」（HAZARD_KIND_META.pyroclastic.body）
 * 已改为引用 facts.js 的 d-pdf-speed，白名单因此清空 —— 规则回到「零副本」。
 */
const PINNED_CHAPTER_DUPLICATES = [];

const chaptersSource = await readFile(new URL('../src/data/chapters.js', import.meta.url), 'utf8');

describe('事实库：结构完整性', () => {
  test('条目数量、章节覆盖与 id 唯一', () => {
    assert.ok(FACTS.length >= 30, `断言失败：事实条目数不足 30 条；实际 ${FACTS.length} 条`);

    const ids = FACTS.map((f) => f.id);
    const duplicated = ids.filter((id, i) => ids.indexOf(id) !== i);
    assert.deepEqual(duplicated, [], `断言失败：事实 id 存在重复；实际重复 id ${JSON.stringify(duplicated)}`);

    for (const section of SECTIONS) {
      const count = FACTS.filter((f) => f.section === section).length;
      assert.ok(count >= 2, `断言失败：章节 ${section} 的事实少于 2 条；实际 ${count} 条`);
    }
  });

  test('每条事实字段齐备且非空，sourceUrl 受白名单约束', () => {
    const bad = [];
    for (const fact of FACTS) {
      const keys = Object.keys(fact);
      for (const key of FACT_KEYS) {
        if (!keys.includes(key)) bad.push(`${fact.id} 缺字段 ${key}`);
      }
      for (const key of ['title', 'valueText', 'explanation', 'sourceLabel', 'sourceYearOrPeriod', 'caveat']) {
        if (typeof fact[key] !== 'string' || fact[key].trim() === '') {
          bad.push(`${fact.id} 的 ${key} 为空或非字符串`);
        }
      }
      if (!SECTIONS.includes(fact.section)) bad.push(`${fact.id} 的 section 非法：${fact.section}`);
      const url = fact.sourceUrl;
      if (url !== null && !APPROVED_URLS.has(url)) bad.push(`${fact.id} 的 sourceUrl 未经核验：${url}`);
    }
    assert.deepEqual(bad, [], `断言失败：事实字段不合规；实际问题清单 ${JSON.stringify(bad)}`);
  });

  test('getFact / getFacts 按 id 取事实，缺失项安全跳过', () => {
    const fact = getFact('a-land-count');
    assert.ok(fact && fact.id === 'a-land-count', `断言失败：getFact 未取到 a-land-count；实际 ${JSON.stringify(fact)}`);
    assert.equal(getFact('__不存在的 id__'), null, '断言失败：getFact 对未知 id 应返回 null；实际未返回 null');

    const picked = getFacts(['a-land-count', '__不存在的 id__', 'a-seafloor-count']);
    assert.equal(picked.length, 2, `断言失败：getFacts 应跳过缺失项并返回 2 条；实际 ${picked.length} 条`);
    assert.deepEqual(
      picked.map((f) => f.id),
      ['a-land-count', 'a-seafloor-count'],
      '断言失败：getFacts 应保持入参顺序；实际顺序不符',
    );
  });
});

describe('事实库：硬数值逐字保留', () => {
  test('清单中的每个硬数值都出现在事实文本里', () => {
    const haystack = FACTS.map((f) => `${f.valueText}\n${f.explanation}\n${f.caveat}`).join('\n');
    const missing = HARD_NUMBERS.filter((needle) => !haystack.includes(needle));
    assert.deepEqual(missing, [], `断言失败：硬数值被删除或改写；实际缺失 ${JSON.stringify(missing)}`);
  });
});

describe('VEI 量表', () => {
  test('九档齐全，体积与柱高的空缺位置固定', () => {
    assert.equal(VEI_ROWS.length, 9, `断言失败：VEI_ROWS 应为 9 档；实际 ${VEI_ROWS.length} 档`);
    assert.deepEqual(
      VEI_ROWS.map((row) => row.level),
      [0, 1, 2, 3, 4, 5, 6, 7, 8],
      '断言失败：VEI_ROWS 的 level 应为 0..8 且顺序递增',
    );

    const nullVolume = VEI_ROWS.filter((r) => r.volumeText === null).map((r) => r.level);
    assert.deepEqual(nullVolume, [1], `断言失败：volumeText 仅应在 level 1 为 null；实际 ${JSON.stringify(nullVolume)}`);

    const nullPlume = VEI_ROWS.filter((r) => r.plumeText === null).map((r) => r.level);
    assert.deepEqual(nullPlume, [7, 8], `断言失败：plumeText 仅应在 level 7、8 为 null；实际 ${JSON.stringify(nullPlume)}`);

    const emptyEvent = VEI_ROWS.filter((r) => typeof r.eventText !== 'string' || r.eventText.trim() === '');
    assert.equal(emptyEvent.length, 0, `断言失败：VEI_ROWS 的 eventText 不得为空；实际 ${emptyEvent.length} 行为空`);
  });

  test('每档关联的事实 id 都真实存在', () => {
    const known = new Set(FACTS.map((f) => f.id));
    const dangling = [];
    for (const level of [0, 1, 2, 3, 4, 5, 6, 7, 8]) {
      const ids = VEI_FACT_IDS[level];
      if (!Array.isArray(ids) || ids.length === 0) {
        dangling.push(`level ${level} 缺少事实映射`);
        continue;
      }
      for (const id of ids) if (!known.has(id)) dangling.push(`level ${level} → 不存在的 id ${id}`);
    }
    assert.deepEqual(dangling, [], `断言失败：VEI_FACT_IDS 存在悬空引用；实际 ${JSON.stringify(dangling)}`);
  });
});

describe('来源列表', () => {
  test('至少 5 条来源，简报条目无 URL，其余均已核验', () => {
    assert.ok(SOURCES.length >= 5, `断言失败：来源条目少于 5 条；实际 ${SOURCES.length} 条`);

    const withoutUrl = SOURCES.filter((s) => s.url === null);
    assert.equal(withoutUrl.length, 1, `断言失败：应恰有 1 条无 URL 的简报来源；实际 ${withoutUrl.length} 条`);

    const unknown = SOURCES.filter((s) => s.url !== null && !APPROVED_URLS.has(s.url));
    assert.deepEqual(
      unknown.map((s) => `${s.id}:${s.url}`),
      [],
      '断言失败：来源列表出现未经核验的 URL',
    );
  });
});

describe('章节数据', () => {
  test('常量列表与默认值符合规划案', () => {
    assert.deepEqual(FORMATION_CONTEXTS, ['divergent', 'subduction', 'hotspot'], '断言失败：FORMATION_CONTEXTS 不符');
    assert.deepEqual(VOLCANO_TYPES, ['shield', 'strato', 'cinder'], '断言失败：VOLCANO_TYPES 不符');
    assert.deepEqual(IMPACTS, ['column', 'aviation', 'climate', 'hazard', 'benefit'], '断言失败：IMPACTS 不符');
    assert.deepEqual(HAZARD_KINDS, ['pyroclastic', 'lahar', 'lava'], '断言失败：HAZARD_KINDS 不符');

    assert.equal(FORMATION_STEPS.length, 4, `断言失败：形成步骤应为 4 步；实际 ${FORMATION_STEPS.length} 步`);
    assert.deepEqual(
      FORMATION_STEPS.map((s) => s.index),
      [0, 1, 2, 3],
      '断言失败：形成步骤 index 应为 0..3',
    );

    assert.deepEqual(
      DEFAULT_FORMATION,
      { context: 'subduction', step: 1, volcanoType: 'strato' },
      '断言失败：DEFAULT_FORMATION 与规划案不一致',
    );
    assert.deepEqual(
      DEFAULT_IMPACT,
      { impact: 'column', hazardKind: 'pyroclastic' },
      '断言失败：DEFAULT_IMPACT 与规划案不一致',
    );
  });

  test('所有 factId 引用都能在事实库中找到', () => {
    const known = new Set(FACTS.map((f) => f.id));
    const groups = [
      ...FORMATION_STEPS.map((s) => [`FORMATION_STEPS[${s.index}]`, s.factIds]),
      ...Object.entries(CONTEXT_META).map(([k, v]) => [`CONTEXT_META.${k}`, v.factIds]),
      ...Object.entries(VOLCANO_TYPE_META).map(([k, v]) => [`VOLCANO_TYPE_META.${k}`, v.factIds]),
      ...Object.entries(IMPACT_META).map(([k, v]) => [`IMPACT_META.${k}`, v.factIds]),
      ...Object.entries(HAZARD_KIND_META).map(([k, v]) => [`HAZARD_KIND_META.${k}`, v.factIds]),
    ];

    const dangling = [];
    for (const [where, ids] of groups) {
      if (!Array.isArray(ids) || ids.length === 0) {
        dangling.push(`${where} 的 factIds 为空`);
        continue;
      }
      for (const id of ids) if (!known.has(id)) dangling.push(`${where} → 不存在的 id ${id}`);
    }
    assert.deepEqual(dangling, [], `断言失败：章节文案存在悬空 factId；实际 ${JSON.stringify(dangling)}`);
  });

  test('硬数值只住在 facts.js（chapters.js 不得另起数值真源）', () => {
    const duplicates = HARD_NUMBERS.filter((needle) => chaptersSource.includes(needle));
    const unexpected = duplicates.filter((n) => !PINNED_CHAPTER_DUPLICATES.some((p) => p.needle === n));
    assert.deepEqual(
      unexpected,
      [],
      `断言失败：chapters.js 出现未登记的硬数值副本；实际 ${JSON.stringify(unexpected)}`,
    );

    // 已登记的例外必须仍然在位，避免白名单过期后失去约束力
    const stale = PINNED_CHAPTER_DUPLICATES.filter((p) => !chaptersSource.includes(p.needle)).map((p) => p.needle);
    assert.deepEqual(stale, [], `断言失败：已登记的重复数值已从源文件消失，白名单需同步；实际 ${JSON.stringify(stale)}`);
  });
});
