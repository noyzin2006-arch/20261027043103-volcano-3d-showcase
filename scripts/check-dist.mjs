#!/usr/bin/env node
/**
 * check-dist —— 静态审计 dist/ 构建产物
 *
 * 判定规则（全部可审计、可复述）：
 *   1. dist/ 不存在 → 打印「先运行 npm run build」并以退出码 1 结束。
 *   2. 递归扫描 dist/ 下的全部文件；把 .html/.js/.css/.json/.svg/.map（以及 .htm/.mjs/.txt）
 *      当作文本读取，其余按二进制只统计体积。
 *   3. 「运行时外部引用」＝ 绝对外部 URL（http:// / https:// / 协议相对 //host）出现在：
 *        - HTML 的 src= / srcset= / poster= / data-src= 属性
 *        - <script src="…"> 与 <link href="…">（样式表 / preload / prefetch / icon）
 *        - CSS 的 url(…) 与 @import
 *        - JS 里作为 fetch / XMLHttpRequest.open / new Image / .src= / importScripts /
 *          EventSource / WebSocket / sendBeacon / import() 实参的字面量 URL
 *      → 以上全部记为违规。
 *   4. 唯一的外部 URL 豁免（这些是给用户点击的「来源引用」，不是运行期请求）：
 *        (a) <a href="https://…"> 且带 rel="noopener noreferrer" 与 data-citation 属性；
 *        (b) 位于 <details> 块内（来源抽屉）；
 *        (c) 位于 class 名含 source/citation/reference/bibliograph 的容器内。
 *      豁免会被逐条记录在「引用链接」清单里，便于人工复核。
 *   5. 出现 navigator.serviceWorker.register → 违规（本项目禁止 Service Worker）。
 *   6. dist/index.html 必须存在且包含 <html lang="zh-CN">。
 *
 * 已知局限：静态扫描只能识别「字面量直接写在请求 API 调用处」的外部 URL。
 * 若外部地址来自变量拼接或运行时数据，静态扫描无法判定——该风险由
 * scripts/smoke-cdp.mjs 的「Network 外部请求数 = 0」运行时断言兜底。
 */

import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join, resolve, relative, basename, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';

const REPO_ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)));
const DEFAULT_DIST = join(REPO_ROOT, 'dist');

/** 当作文本读取的扩展名。 */
const TEXT_EXT = new Set(['.html', '.htm', '.js', '.mjs', '.css', '.json', '.svg', '.map', '.txt']);

/** 运行时外部引用：绝对 http(s) 或协议相对 //host。 */
const isExternalUrl = (v) => typeof v === 'string' && /^(https?:)?\/\//i.test(v.trim());

/** 协议相对 URL（//host/...）单独标记，便于报告说清原因。 */
const isProtocolRelative = (v) => typeof v === 'string' && /^\/\//.test(v.trim());

/* ------------------------------------------------------------------ 工具 */

/** 建立「字符下标 → 行号（1 起）」的索引。 */
function makeLineIndex(text) {
  const starts = [0];
  for (let i = 0; i < text.length; i++) {
    if (text[i] === '\n') starts.push(i + 1);
  }
  return (index) => {
    let lo = 0;
    let hi = starts.length - 1;
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1;
      if (starts[mid] <= index) lo = mid;
      else hi = mid - 1;
    }
    return lo + 1;
  };
}

const linesCache = new Map();
function lineTextOf(text, lineNo) {
  let lines = linesCache.get(text);
  if (!lines) {
    lines = text.split(/\r?\n/);
    linesCache.set(text, lines);
  }
  return (lines[lineNo - 1] ?? '').trim();
}

/** 解析标签属性串 → { name: value }（属性名统一小写）。 */
function parseAttrs(attrText) {
  const attrs = {};
  const re = /([a-zA-Z_:][-a-zA-Z0-9_:.]*)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+))/g;
  let m;
  while ((m = re.exec(attrText))) {
    attrs[m[1].toLowerCase()] = m[2] ?? m[3] ?? m[4] ?? '';
  }
  return attrs;
}

/** 计算所有 <details>…</details> 区间（含未闭合的）。 */
function detailsRanges(text) {
  const re = /<details\b[^>]*>|<\/details\s*>/gi;
  const stack = [];
  const ranges = [];
  let m;
  while ((m = re.exec(text))) {
    if (m[0][1] === '/') {
      const start = stack.pop();
      if (start !== undefined) ranges.push([start, m.index + m[0].length]);
    } else {
      stack.push(m.index);
    }
  }
  while (stack.length) ranges.push([stack.pop(), text.length]);
  return ranges;
}

/** 近似判断锚点是否落在「来源类容器」内（class 含 source/citation/reference/bibliograph）。 */
function inSourceBlock(text, index) {
  const window = text.slice(Math.max(0, index - 8000), index);
  const re = /<([a-zA-Z][\w:-]*)\b([^>]*?)(\/?)>/g;
  const open = [];
  let m;
  while ((m = re.exec(window))) {
    const name = m[1].toLowerCase();
    if (m[3] === '/') continue;
    if (open.length && open[open.length - 1] === name) {
      open.pop();
      continue;
    }
    const cls = (m[2].match(/class\s*=\s*(?:"([^"]*)"|'([^']*)')/i) || [])[1] || '';
    if (/\b(source|citation|reference|bibliograph)\w*/i.test(cls)) return true;
    open.push(name);
  }
  return false;
}

/* -------------------------------------------------------------- 报告结构 */

const findings = [];
const exemptions = [];

function addFinding(file, line, rule, text, detail, external = true) {
  findings.push({ file, line, rule, text, detail, external });
}

function addExemption(file, line, kind, text) {
  exemptions.push({ file, line, kind, text });
}

/* -------------------------------------------------------------- CSS 扫描 */

function scanCss(text, { file, fileText, prefix, lineIndex }) {
  // @import url(...) / @import "..."
  const importRe = /@import\s+(?:url\(\s*)?(["']?)([^"')]+)\1/gi;
  const importRanges = [];
  let m;
  while ((m = importRe.exec(text))) {
    const url = m[2].trim();
    importRanges.push([m.index, m.index + m[0].length]);
    if (isExternalUrl(url)) {
      addFinding(file, lineIndex(m.index), `${prefix}-external-import`,
        lineTextOf(fileText, lineIndex(m.index)),
        `@import 指向外部资源：${url}`);
    }
  }

  // 先找出 @font-face 区间，便于给出更精确的规则名
  const fontFaces = [];
  const ffRe = /@font-face\s*\{([^}]*)\}/gi;
  while ((m = ffRe.exec(text))) fontFaces.push([m.index, m.index + m[0].length]);

  // url(...)
  const urlRe = /url\(\s*(["']?)([^"')]*)\1\s*\)/gi;
  while ((m = urlRe.exec(text))) {
    const url = m[2].trim();
    if (!url) continue;
    // @import 里的 url() 已由 external-import 规则报告，不重复计数
    if (importRanges.some(([s, e]) => m.index >= s && m.index < e)) continue;
    const inFontFace = fontFaces.some(([s, e]) => m.index >= s && m.index < e);
    if (isExternalUrl(url)) {
      addFinding(file, lineIndex(m.index), inFontFace ? `${prefix}-font-face-external` : `${prefix}-external-url`,
        lineTextOf(fileText, lineIndex(m.index)),
        `CSS url() 指向外部资源${inFontFace ? '（@font-face）' : ''}：${url}`);
    } else if (isProtocolRelative(url)) {
      addFinding(file, lineIndex(m.index), `${prefix}-protocol-relative-url`,
        lineTextOf(fileText, lineIndex(m.index)),
        `CSS url() 使用协议相对地址：${url}`);
    }
  }
}

/* --------------------------------------------------------------- JS 扫描 */

const JS_RULES = [
  { rule: 'js-fetch-external', re: /\bfetch\s*\(\s*(["'`])((?:(?!\1)[^"'`])*https?:\/\/[^"'`]*)\1/g, group: 2, label: 'fetch(' },
  { rule: 'js-xhr-external', re: /\.open\s*\(\s*(["'`])[^"'`]*\1\s*,\s*(["'`])((?:(?!\2)[^"'`])*https?:\/\/[^"'`]*)\2/g, group: 3, label: 'XMLHttpRequest.open(' },
  { rule: 'js-image-external', re: /new\s+Image\s*\(\s*(["'`])((?:(?!\1)[^"'`])*https?:\/\/[^"'`]*)\1/g, group: 2, label: 'new Image(' },
  { rule: 'js-img-src-external', re: /\.src\s*=\s*(["'`])((?:(?!\1)[^"'`])*https?:\/\/[^"'`]*)\1/g, group: 2, label: 'img.src =' },
  { rule: 'js-importscripts-external', re: /\bimportScripts\s*\(\s*(["'`])((?:(?!\1)[^"'`])*https?:\/\/[^"'`]*)\1/g, group: 2, label: 'importScripts(' },
  { rule: 'js-eventsource-external', re: /new\s+EventSource\s*\(\s*(["'`])((?:(?!\1)[^"'`])*https?:\/\/[^"'`]*)\1/g, group: 2, label: 'new EventSource(' },
  { rule: 'js-websocket-external', re: /new\s+WebSocket\s*\(\s*(["'`])((?:(?!\1)[^"'`])*https?:\/\/[^"'`]*)\1/g, group: 2, label: 'new WebSocket(' },
  { rule: 'js-sendbeacon-external', re: /\.sendBeacon\s*\(\s*[^,()]*?(["'`])((?:(?!\1)[^"'`])*https?:\/\/[^"'`]*)\1/g, group: 2, label: 'navigator.sendBeacon(' },
  { rule: 'js-dynamic-import-external', re: /\bimport\s*\(\s*(["'`])((?:(?!\1)[^"'`])*https?:\/\/[^"'`]*)\1/g, group: 2, label: 'import(' },
  { rule: 'js-static-import-external', re: /\bimport\s+[^\n;]*?\bfrom\s*(["'`])((?:(?!\1)[^"'`])*https?:\/\/[^"'`]*)\1/g, group: 2, label: 'import … from' },
];

function scanJs(text, { file, fileText, lineIndex }) {
  for (const { rule, re, group, label } of JS_RULES) {
    re.lastIndex = 0;
    let m;
    while ((m = re.exec(text))) {
      addFinding(file, lineIndex(m.index), rule, lineTextOf(fileText, lineIndex(m.index)),
        `${label} 的参数是外部 URL：${m[group]}`);
    }
  }

  const swRe = /serviceWorker\s*\.\s*register\s*\(/g;
  let m;
  while ((m = swRe.exec(text))) {
    addFinding(file, lineIndex(m.index), 'js-service-worker-register', lineTextOf(fileText, lineIndex(m.index)),
      '检测到 navigator.serviceWorker.register —— 本项目禁止注册 Service Worker', false);
  }
}

/* -------------------------------------------------------------- HTML 扫描 */

const TAG_RE = /<([a-zA-Z][\w:-]*)((?:"[^"]*"|'[^']*'|[^>"'])*)>/g;

function scanHtml(text, { file, fileText, lineIndex }) {
  const detailRanges = detailsRanges(text);

  // 内联 <style> 区块
  const styleRe = /<style\b[^>]*>([\s\S]*?)<\/style\s*>/gi;
  let sm;
  while ((sm = styleRe.exec(text))) {
    const inner = sm[1];
    const offset = sm.index + sm[0].indexOf(inner);
    scanCss(inner, {
      file,
      fileText,
      prefix: 'html-style',
      lineIndex: (i) => lineIndex(offset + i),
    });
  }

  // 标签逐个检查
  TAG_RE.lastIndex = 0;
  let tm;
  while ((tm = TAG_RE.exec(text))) {
    const tagName = tm[1].toLowerCase();
    const attrText = tm[2] ?? '';
    const attrs = parseAttrs(attrText);
    const line = lineIndex(tm.index);
    const snippet = lineTextOf(text, line);

    // 运行时会被浏览器拉取的属性
    const RUNTIME_ATTRS = ['src', 'srcset', 'poster', 'data-src'];
    for (const name of RUNTIME_ATTRS) {
      const value = attrs[name];
      if (value === undefined) continue;
      const candidates = name === 'srcset'
        ? value.split(',').map((s) => s.trim().split(/\s+/)[0]).filter(Boolean)
        : [value];
      for (const url of candidates) {
        if (!isExternalUrl(url) && !isProtocolRelative(url)) continue;
        const rule = tagName === 'script'
          ? 'html-external-script'
          : tagName === 'link'
            ? 'html-external-link'
            : 'html-external-src';
        addFinding(file, line, rule, snippet,
          `<${tagName} ${name}="…"> 指向外部资源：${url}`);
      }
    }

    // <link href="https://…"> —— 样式表 / preload / prefetch / icon 都会在运行期拉取
    if (tagName === 'link' && attrs.href !== undefined) {
      const href = attrs.href.trim();
      if (isExternalUrl(href) || isProtocolRelative(href)) {
        addFinding(file, line, 'html-external-link', snippet,
          `<link rel="${attrs.rel ?? ''}" href="…"> 指向外部资源：${href}`);
      }
    }

    // <a href="https://…"> —— 引用链接豁免判定
    if (tagName === 'a' && attrs.href !== undefined) {
      const href = attrs.href.trim();
      if (isExternalUrl(href) || isProtocolRelative(href)) {
        const rel = (attrs.rel ?? '').toLowerCase();
        const hasNoopener = /noopener/.test(rel);
        const hasNoreferrer = /noreferrer/.test(rel);
        const hasCitation = Object.hasOwn(attrs, 'data-citation');
        const inDetails = detailRanges.some(([s, e]) => tm.index >= s && tm.index < e);
        const inSource = inSourceBlock(text, tm.index);
        let kind = null;
        if (hasNoopener && hasNoreferrer && hasCitation) kind = 'data-citation 锚点';
        else if (inDetails) kind = '<details> 来源块内';
        else if (inSource) kind = '来源类容器内';
        if (kind) addExemption(file, line, kind, snippet);
        else {
          addFinding(file, line, 'html-external-anchor', snippet,
            `<a href> 指向外部 URL，但既没有 rel="noopener noreferrer" + data-citation，`
            + `也不在 <details> 来源块内：${href}`);
        }
      }
    }

    // 行内 style 属性里的 url()
    if (attrs.style) {
      const styleOffset = tm.index + attrText.indexOf(attrs.style);
      scanCss(attrs.style, {
        file,
        fileText,
        prefix: 'html-inline-style',
        lineIndex: (i) => lineIndex(styleOffset + i),
      });
    }
  }

  // 内联 <script> 区块（无 src 的）
  const scriptRe = /<script\b(?![^>]*\bsrc\s*=)[^>]*>([\s\S]*?)<\/script\s*>/gi;
  let scm;
  while ((scm = scriptRe.exec(text))) {
    const inner = scm[1];
    const offset = scm.index + scm[0].indexOf(inner);
    scanJs(inner, { file, fileText, lineIndex: (i) => lineIndex(offset + i) });
  }
}

/* ------------------------------------------------------------- 文件遍历 */

function walk(dir, acc) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(full, acc);
    } else if (entry.isFile()) {
      acc.push(full);
    } else {
      acc.push({ skipped: full, reason: entry.isSymbolicLink() ? '符号链接' : '非普通文件' });
    }
  }
  return acc;
}

/* ----------------------------------------------------------------- 主流程 */

function parseArgs(argv) {
  const out = { dist: DEFAULT_DIST, help: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--help' || a === '-h') out.help = true;
    else if (a === '--dist') out.dist = resolve(argv[++i] ?? DEFAULT_DIST);
    else if (a.startsWith('--dist=')) out.dist = resolve(a.slice(7));
  }
  return out;
}

function usage() {
  console.log(`用法：node scripts/check-dist.mjs [选项]

选项：
  --dist <目录>   待审计的构建产物目录（默认：仓库根目录下的 dist/）
  -h, --help      显示本帮助并退出

判定摘要：
  · src=/srcset=/poster=/data-src=、<script src>、<link href>、CSS url()、CSS @import
    中出现绝对外部 URL 即违规；
  · JS 的 fetch / XHR.open / new Image / .src= / importScripts / EventSource / WebSocket /
    sendBeacon / import() 实参为外部 URL 即违规；
  · navigator.serviceWorker.register 出现即违规；
  · 仅 <a href="https://…" rel="noopener noreferrer" data-citation="…">、<details> 来源块内、
    来源类容器内的外部链接被豁免（作为「引用链接」逐条列出）。`);
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    usage();
    process.exit(0);
  }

  const distDir = resolve(args.dist);
  const distBase = basename(distDir);
  const distLabel = relative(REPO_ROOT, distDir) || distDir;

  if (!existsSync(distDir) || !statSync(distDir).isDirectory()) {
    console.error(`✗ 未找到构建产物目录：${distDir}`);
    console.error('  先运行 npm run build');
    process.exit(1);
  }

  const entries = walk(distDir, []);
  const files = [];
  const skipped = [];
  for (const e of entries) {
    if (typeof e === 'string') files.push(e);
    else skipped.push(e);
  }
  files.sort();

  let totalBytes = 0;
  const gzipRows = [];

  for (const file of files) {
    const buf = readFileSync(file);
    totalBytes += buf.length;
    const ext = extname(file).toLowerCase();
    if (ext === '.js' || ext === '.css') {
      gzipRows.push({
        file: `${distBase}/${relative(distDir, file)}`,
        raw: buf.length,
        gzip: gzipSync(buf, { level: 9 }).length,
      });
    }

    if (!TEXT_EXT.has(ext)) continue;

    const text = buf.toString('utf8');
    const relFile = `${distBase}/${relative(distDir, file)}`;
    const lineIndex = makeLineIndex(text);
    const ctx = { file: relFile, fileText: text, lineIndex };

    if (ext === '.html' || ext === '.htm') scanHtml(text, ctx);
    if (ext === '.js' || ext === '.mjs') scanJs(text, ctx);
    if (ext === '.css') scanCss(text, { ...ctx, prefix: 'css' });
    if (ext === '.svg') scanHtml(text, ctx); // SVG 内的 image/use 同样会拉取外部资源
    if (ext === '.json') scanJson(text, ctx);
  }

  // index.html 检查
  const indexFile = join(distDir, 'index.html');
  if (!existsSync(indexFile)) {
    addFinding(`${distBase}/index.html`, 0, 'missing-index-html', '', 'dist/index.html 不存在', false);
  } else {
    const html = readFileSync(indexFile, 'utf8');
    const hasLang = /<html\b[^>]*\blang\s*=\s*["']zh-CN["']/i.test(html);
    if (!hasLang) {
      addFinding(`${distBase}/index.html`, 1, 'index-lang-not-zh-cn', lineTextOf(html, 1),
        'dist/index.html 缺少 <html lang="zh-CN">', false);
    }
  }

  /* ----------------------------------------------------------- 打印报告 */

  console.log(`审计目录：${distDir}`);
  console.log('规则：src/srcset/poster/data-src、<script src>、<link href>、CSS url()/@import、');
  console.log('      JS 的 fetch/XHR/Image/importScripts/EventSource/WebSocket/sendBeacon/import()');
  console.log('      实参中出现绝对外部 URL 即违规；serviceWorker.register 即违规。');
  console.log('豁免：<a> 带 rel="noopener noreferrer" + data-citation、<details> 来源块内、来源类容器内的链接。');
  console.log('─'.repeat(72));

  if (skipped.length) {
    for (const s of skipped) {
      console.log(`ℹ️  跳过 ${relative(REPO_ROOT, s.skipped)}（${s.reason}）`);
    }
  }

  if (exemptions.length) {
    console.log(`ℹ️ 引用链接（豁免）${exemptions.length} 条：`);
    for (const e of exemptions) {
      console.log(`   · [${e.kind}] ${e.file}:${e.line}`);
      if (e.text) console.log(`     ${e.text.slice(0, 150)}`);
    }
  } else {
    console.log('ℹ️ 引用链接（豁免）0 条。');
  }

  const externalFindings = findings.filter((f) => f.external);
  const swFindings = findings.filter((f) => f.rule === 'js-service-worker-register');

  if (findings.length === 0) {
    console.log('✓ 未发现违规。');
  } else {
    console.log(`✗ 违规 ${findings.length} 处：`);
    for (const f of findings) {
      console.log(`   [${f.rule}] ${f.file}:${f.line}`);
      console.log(`     原文：${(f.text || '').slice(0, 200)}`);
      console.log(`     原因：${f.detail}`);
    }
  }

  console.log('─'.repeat(72));
  console.log(`ℹ️ dist 总体积：${(totalBytes / 1024).toFixed(1)} KiB（${files.length} 个文件）`);
  if (gzipRows.length) {
    for (const g of gzipRows) {
      console.log(`   gzip ${g.file}：${(g.gzip / 1024).toFixed(1)} KiB（原始 ${(g.raw / 1024).toFixed(1)} KiB）`);
    }
  }
  console.log('ℹ️ 静态扫描只能发现「字面量直接写在请求 API 处」的外部 URL；');
  console.log('   变量拼接的外部地址由 scripts/smoke-cdp.mjs 的运行时零外部请求断言兜底。');

  const summary = `check-dist: ${files.length} 个文件，外部运行时请求 ${externalFindings.length}，${findings.length} 处违规`;
  console.log(summary);
  if (swFindings.length) console.log(`（其中 Service Worker 注册 ${swFindings.length} 处）`);

  process.exit(findings.length === 0 ? 0 : 1);
}

/** JSON 产物：只对「会被加载的属性键」判定外部 URL，其余绝对 URL 仅作提示。 */
function scanJson(text, { file, fileText, lineIndex }) {
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    return;
  }
  const RUNTIME_KEYS = new Set(['src', 'srcset', 'poster', 'data-src']);
  const visit = (node, pathStr) => {
    if (Array.isArray(node)) {
      node.forEach((v, i) => visit(v, `${pathStr}[${i}]`));
      return;
    }
    if (!node || typeof node !== 'object') return;
    for (const [k, v] of Object.entries(node)) {
      const key = k.toLowerCase();
      if (RUNTIME_KEYS.has(key) && typeof v === 'string' && isExternalUrl(v)) {
        addFinding(file, lineIndex(0), 'json-external-asset', lineTextOf(fileText, 1),
          `JSON 字段 ${pathStr}.${k} 指向外部资源：${v}`);
      }
      visit(v, pathStr ? `${pathStr}.${k}` : k);
    }
  };
  visit(data, '');
}

main();
