/**
 * 构建期静态审计
 *
 * 覆盖：颜色真源唯一性、运行时不联网、离线 API、设计令牌齐备与栅格规范。
 * 全部以源码文本静态分析完成，不启动浏览器、不请求网络。
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join, relative } from 'node:path';

const PROJECT_ROOT = fileURLToPath(new URL('../', import.meta.url));
const SRC_ROOT = join(PROJECT_ROOT, 'src');

/** 唯一允许出现的外部来源 URL（策展核验过的官方页面）。 */
const APPROVED_SOURCE_URLS = [
  'https://pubs.usgs.gov/gip/volc/types.html',
  'https://science.nasa.gov/mission/aura/aura-measurements-of-an-underwater-volcano-eruption/',
  'https://mynasadata.larc.nasa.gov/phenomenon/volcanic-eruptions/interactives',
  'https://www.usgs.gov/programs/VHP',
  'https://lavacentre.is/the-experience/',
];

/** SVG 命名空间标识符 —— 只是 XML 名字，不是会被请求的网络地址。 */
const SVG_NAMESPACE = 'http://www.w3.org/2000/svg';

const TOKENS_FILE = 'src/styles/tokens.css';

/**
 * 已登记的例外 —— 规则违背点在此显式钉死：
 * 任何新增的越界写法都会让对应断言失败，从而阻止问题扩大。
 *
 * 2026-10-27：原先登记在册的越界写法（terrain.js 的 8 个 hex 兜底色、
 * renderer.js 的 6 个灯光 0x 色、effects.js 的 3 个熔岩/泥流 0x 色）
 * 已全部迁入 tokens.css 的 --scene-* 令牌，两张表因此清空。
 * 清空后规则回到「零例外」——任何新出现的越界写法都会立刻让断言失败。
 */
const PINNED_HEX_IN_SRC = new Map();

const PINNED_0X_COLOR_IN_SRC = new Map();

/** 设计令牌必须齐备的名称。 */
const REQUIRED_TOKENS = [
  '--bg-0', '--bg-1', '--bg-2', '--bg-3',
  '--text-1', '--text-2', '--text-3', '--text-inverse',
  '--line-1', '--line-2',
  '--accent', '--accent-press', '--accent-pale',
  '--info', '--success', '--warning', '--danger',
  '--focus', '--disabled',
  '--scene-rock', '--scene-strata', '--scene-ash', '--scene-magma',
  '--scene-soil', '--scene-plate', '--scene-water', '--scene-aerosol',
  '--radius-1', '--radius-2', '--radius-3', '--radius-4', '--radius-pill',
  '--sp-1', '--sp-2', '--sp-3', '--sp-4', '--sp-6', '--sp-8', '--sp-12', '--sp-16', '--sp-24',
  '--border-thin', '--border-strong',
  '--shadow-0', '--shadow-1', '--shadow-2', '--shadow-3', '--shadow-4',
  '--z-canvas', '--z-mark', '--z-panel', '--z-nav', '--z-pop', '--z-alert',
  '--d-fast', '--d-normal', '--d-scene', '--d-slow',
  '--ease-work', '--ease-enter', '--ease-exit',
  '--font-cn', '--font-en', '--font-mono',
  '--fz-0', '--fz-1', '--fz-2', '--fz-3', '--fz-4', '--fz-5', '--fz-6',
];

/** 递归收集 src/ 下的文件。 */
async function walk(dir) {
  const files = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) files.push(...(await walk(full)));
    else files.push(full);
  }
  return files;
}

/** 扫描出所有匹配项，并记录文件、行号与命中文本。 */
function scan(files, pattern) {
  const hits = [];
  for (const { file, text } of files) {
    const lines = text.split('\n');
    lines.forEach((line, index) => {
      for (const match of line.matchAll(pattern)) {
        hits.push({ file, line: index + 1, literal: match[0] });
      }
    });
  }
  return hits;
}

/** 断言命中项全部落在已登记的例外之内，且例外没有过期。 */
function assertPinned(hits, pin, label) {
  const unexpected = hits.filter((h) => !pin.get(h.file)?.has(h.literal));
  assert.deepEqual(
    unexpected.map((h) => `${h.file}:${h.line}: ${h.literal}`),
    [],
    `断言失败：${label} 出现未登记的越界写法；实际 ${JSON.stringify(unexpected.map((h) => `${h.file}:${h.line}: ${h.literal}`))}`,
  );

  const present = new Set(hits.map((h) => `${h.file}|${h.literal}`));
  const stale = [];
  for (const [file, literals] of pin) {
    for (const literal of literals) {
      if (!present.has(`${file}|${literal}`)) stale.push(`${file}: ${literal}`);
    }
  }
  assert.deepEqual(
    stale,
    [],
    `断言失败：${label} 的已登记例外已失效，白名单需同步；实际 ${JSON.stringify(stale)}`,
  );
}

const allFiles = (await walk(SRC_ROOT)).map((full) => ({
  full,
  file: relative(PROJECT_ROOT, full).split('\\').join('/'),
  text: '',
}));

for (const entry of allFiles) {
  entry.text = await readFile(entry.full, 'utf8');
}

const sourceFiles = allFiles.filter((f) => f.file.startsWith('src/'));
const scriptFiles = sourceFiles.filter((f) => f.file.endsWith('.js'));
const styleFiles = sourceFiles.filter((f) => f.file.endsWith('.css'));
const auditedFiles = sourceFiles.filter((f) => f.file !== TOKENS_FILE && (f.file.endsWith('.js') || f.file.endsWith('.css')));

const tokensSource = allFiles.find((f) => f.file === TOKENS_FILE)?.text ?? '';

describe('颜色真源唯一性', () => {
  test('src 内除 tokens.css 外不得出现 #hex 颜色', () => {
    const hits = scan(auditedFiles, /#[0-9a-fA-F]{3,8}\b/g);
    assertPinned(hits, PINNED_HEX_IN_SRC, '十六进制颜色');
  });

  test('src 内除 tokens.css 外不得出现 0x 颜色字面量', () => {
    // 结尾加 \b 以排除 0x6d2b79f5 这类 8 位 PRNG 常数
    const hits = scan(scriptFiles, /0x[0-9a-fA-F]{6}\b/g);
    assertPinned(hits, PINNED_0X_COLOR_IN_SRC, '0x 颜色字面量');
  });

  test('tokens.css 自己承载全部十六进制颜色', () => {
    const count = (tokensSource.match(/#[0-9a-fA-F]{3,8}\b/g) ?? []).length;
    assert.ok(count >= 20, `断言失败：tokens.css 的颜色变量过少；实际 ${count} 处`);
  });
});

describe('运行时完全离线', () => {
  test('src 内不得出现未经批准的外链', () => {
    const hits = scan(scriptFiles, /https?:\/\/[^\s'"`)]+/g);
    const allowed = new Set([...APPROVED_SOURCE_URLS, SVG_NAMESPACE]);
    const offenders = hits.filter((h) => !allowed.has(h.literal));
    assert.deepEqual(
      offenders.map((h) => `${h.file}:${h.line}: ${h.literal}`),
      [],
      `断言失败：src 内出现外链；实际 ${JSON.stringify(offenders.map((h) => `${h.file}:${h.line}: ${h.literal}`))}`,
    );
  });

  test('策展来源 URL 只允许出现在 facts.js', () => {
    const hits = scan(scriptFiles, /https?:\/\/[^\s'"`)]+/g).filter((h) =>
      APPROVED_SOURCE_URLS.includes(h.literal),
    );
    const outside = hits.filter((h) => h.file !== 'src/data/facts.js');
    assert.deepEqual(
      outside.map((h) => `${h.file}:${h.line}: ${h.literal}`),
      [],
      `断言失败：来源 URL 只应出现在 facts.js；实际 ${JSON.stringify(outside.map((h) => h.file))}`,
    );
  });

  test('src 内不得使用任何网络 API', () => {
    const patterns = [
      /fetch\s*\(/g,
      /XMLHttpRequest/g,
      /importScripts/g,
      /EventSource/g,
      /new\s+WebSocket/g,
      /sendBeacon/g,
      /serviceWorker/g,
    ];
    const hits = patterns.flatMap((pattern) => scan(scriptFiles, pattern));
    assert.deepEqual(
      hits.map((h) => `${h.file}:${h.line}: ${h.literal}`),
      [],
      `断言失败：src 内出现网络 API；实际 ${JSON.stringify(hits.map((h) => `${h.file}:${h.line}: ${h.literal}`))}`,
    );
  });
});

describe('设计令牌', () => {
  test('tokens.css 定义了全部必需令牌', () => {
    const missing = REQUIRED_TOKENS.filter((token) => !new RegExp(`${token}\\s*:`).test(tokensSource));
    assert.deepEqual(
      missing,
      [],
      `断言失败：tokens.css 缺少令牌；实际缺失 ${JSON.stringify(missing)}`,
    );
  });

  test('间距令牌遵循 4px 基准栅格', () => {
    const offenders = [];
    for (const match of tokensSource.matchAll(/--sp-(\d+)\s*:\s*([^;]+);/g)) {
      const value = Number.parseFloat(match[2]);
      if (!Number.isFinite(value) || value % 4 !== 0) offenders.push(`--sp-${match[1]}: ${match[2].trim()}`);
    }
    assert.deepEqual(
      offenders,
      [],
      `断言失败：间距令牌必须是 4px 的整数倍；实际越界 ${JSON.stringify(offenders)}`,
    );
  });

  test('字阶令牌一律使用 rem', () => {
    const offenders = [];
    for (const match of tokensSource.matchAll(/--fz-(\d+)\s*:\s*([^;]+);/g)) {
      if (!/^\s*[\d.]+rem\s*$/.test(match[2])) offenders.push(`--fz-${match[1]}: ${match[2].trim()}`);
    }
    assert.deepEqual(
      offenders,
      [],
      `断言失败：字阶令牌必须使用 rem；实际越界 ${JSON.stringify(offenders)}`,
    );
  });

  test('间距令牌在样式表里被真正使用', () => {
    const consumers = styleFiles.filter((f) => f.file !== TOKENS_FILE);
    for (const file of consumers) {
      const uses = (file.text.match(/var\(--sp-/g) ?? []).length;
      assert.ok(
        uses > 0,
        `断言失败：${file.file} 未使用任何 var(--sp-*) 间距令牌；实际 0 处`,
      );
    }
  });
});
