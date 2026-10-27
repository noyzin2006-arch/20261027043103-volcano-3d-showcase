/**
 * 静态骨架与无障碍接线审计
 *
 * renderShell.js 需要 DOM，不能在 Node 里直接执行，因此这里做静态源码审计：
 * 读取 index.html / renderShell.js / icons.js 的文本，断言骨架契约与 ARIA 接线。
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');
const renderShell = await readFile(new URL('../src/ui/renderShell.js', import.meta.url), 'utf8');
const icons = await readFile(new URL('../src/ui/icons.js', import.meta.url), 'utf8');

/** Unicode emoji 区段（含装饰性符号、变体选择符）。 */
const EMOJI_RE = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}]/u;

const htmlSlots = [...html.matchAll(/data-slot="([^"]+)"/g)].map((m) => m[1]);
const shellSlots = [...renderShell.matchAll(/slot\('([^']+)'\)/g)].map((m) => m[1]);
const buttons = [...html.matchAll(/<button[^>]*>/g)].map((m) => m[0]);

describe('index.html 骨架', () => {
  test('语言、标题、视口与跳转链接齐备', () => {
    assert.match(html, /<html[^>]*\slang="zh-CN"/, '断言失败：<html> 应声明 lang="zh-CN"');
    assert.match(html, /<title>[^<]+<\/title>/, '断言失败：缺少非空的 <title>');
    assert.match(html, /<meta[^>]*name="viewport"/, '断言失败：缺少 name="viewport" 的 meta');
    assert.match(html, /<a[^>]*class="skip-link"[^>]*href="#main"/, '断言失败：缺少指向 #main 的 .skip-link');
    assert.match(html, /id="main"/, '断言失败：缺少 id="main" 的主内容容器');
  });

  test('章节导航恰有两个按钮，且全部声明 type="button"', () => {
    const chapterButtons = [...html.matchAll(/<button[^>]*data-chapter="([^"]+)"/g)].map((m) => m[1]);
    assert.deepEqual(
      chapterButtons.sort(),
      ['formation', 'impact'],
      `断言失败：data-chapter 按钮应为 formation 与 impact 各一；实际 ${JSON.stringify(chapterButtons)}`,
    );

    const missingType = buttons.filter((tag) => !/\stype="button"/.test(tag));
    assert.deepEqual(
      missingType,
      [],
      `断言失败：所有 <button> 都应声明 type="button"；实际缺失 ${missingType.length} 个`,
    );
  });

  test('提供 noscript 兜底并说明依赖 JavaScript', () => {
    assert.match(html, /<noscript>[\s\S]*<\/noscript>/, '断言失败：缺少 <noscript> 兜底块');
    const noscript = html.match(/<noscript>[\s\S]*?<\/noscript>/)[0];
    assert.match(noscript, /JavaScript/, '断言失败：noscript 文案应说明本展项依赖 JavaScript');
  });

  test('骨架中不出现 emoji', () => {
    const hit = html.match(EMOJI_RE);
    assert.equal(
      hit,
      null,
      `断言失败：index.html 不应包含 emoji；实际命中 ${hit ? JSON.stringify(hit[0]) : '无'}`,
    );
  });
});

describe('renderShell.js 的 ARIA 接线', () => {
  test('交互组件具备按压态、当前项、展开态与关联关系', () => {
    const required = [
      'aria-pressed',
      'aria-current',
      'aria-expanded',
      'aria-controls',
      'aria-live',
      'aria-label',
      'aria-disabled',
    ];
    const missing = required.filter((attr) => !renderShell.includes(attr));
    assert.deepEqual(
      missing,
      [],
      `断言失败：renderShell.js 缺少 ARIA 属性；实际缺失 ${JSON.stringify(missing)}`,
    );
  });

  test('状态条与控件组声明了 role', () => {
    // 源码里两种写法都算：role="status"（HTML 串）与 role: 'status'（属性对象）
    const roleOf = (name) =>
      new RegExp(`role\\s*(?:=|:)\\s*['"]${name}['"]`).test(renderShell);
    const missing = ['status', 'group'].filter((name) => !roleOf(name));
    assert.deepEqual(
      missing,
      [],
      `断言失败：renderShell.js 缺少 role 声明；实际缺失 ${JSON.stringify(missing)}`,
    );
  });

  test('源码中不出现 emoji', () => {
    const hit = renderShell.match(EMOJI_RE);
    assert.equal(
      hit,
      null,
      `断言失败：renderShell.js 不应包含 emoji；实际命中 ${hit ? JSON.stringify(hit[0]) : '无'}`,
    );
  });
});

describe('插槽契约', () => {
  test('外壳查询的每个插槽都在骨架中存在', () => {
    const dangling = shellSlots.filter((name) => !htmlSlots.includes(name));
    assert.deepEqual(
      dangling,
      [],
      `断言失败：renderShell.js 查询了骨架里不存在的插槽；实际 ${JSON.stringify(dangling)}`,
    );
  });

  test('骨架的每个插槽都由外壳接管', () => {
    const unclaimed = htmlSlots.filter((name) => !shellSlots.includes(name));
    assert.deepEqual(
      unclaimed,
      [],
      `断言失败：index.html 里不应存在外壳不接管的 data-slot；实际 ${JSON.stringify(unclaimed)}`,
    );
  });
});

describe('图标系统', () => {
  test('导出 ICON_NAMES 且不含 emoji', () => {
    assert.match(icons, /export const ICON_NAMES/, '断言失败：icons.js 应导出 ICON_NAMES');
    const hit = icons.match(EMOJI_RE);
    assert.equal(
      hit,
      null,
      `断言失败：icons.js 不应包含 emoji；实际命中 ${hit ? JSON.stringify(hit[0]) : '无'}`,
    );
  });

  test('图标为自绘 SVG，并带 aria-hidden / role=img 的可访问性处理', () => {
    assert.match(icons, /<svg/, '断言失败：icons.js 应输出内联 <svg>');
    assert.match(icons, /aria-hidden/, '断言失败：装饰性图标应标记 aria-hidden');
    assert.match(icons, /role="img"/, '断言失败：有标题的图标应标记 role="img"');
    assert.match(icons, /currentColor/, '断言失败：图标颜色应使用 currentColor 而非写死颜色');
  });
});
