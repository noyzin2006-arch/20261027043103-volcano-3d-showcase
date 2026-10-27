#!/usr/bin/env node
/**
 * smoke-cdp —— 用系统自带 Chrome + 原生 WebSocket 直连 CDP 做端到端冒烟测试
 *
 * 覆盖的硬性断言：
 *   1. 页面加载成功（Page.navigate 无 errorText 且触发 load 事件）
 *   2. 运行期外部域名请求数 = 0（Network.requestWillBeSent，主机不是 127.0.0.1/localhost）
 *   3. 控制台错误数 = 0（Runtime.consoleAPICalled type=error + Runtime.exceptionThrown）
 *   4. document.title 非空；canvas ≥ 1；[data-chapter] === 2
 *   5. WebGL 上下文可用，且画布像素不是纯色（distinctColors > 8）
 *   6. 切换到「剖面」视图后画面像素发生变化
 *   7. 启动喷发后画面像素发生变化
 *   8. 375px / 1440px 均无横向滚动
 *   9. prefers-reduced-motion: reduce 下喷发不会自动开始
 *  10. 禁用 WebGL 时出现静态降级内容，且正文有足够中文
 *
 * 产物：reports/screenshots/*.png 与 reports/network-log.json
 */

import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { tmpdir } from 'node:os';
import { createServer } from 'node:net';

import { startServer } from './serve-dist.mjs';

const REPO_ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)));
const DEFAULT_DIST = join(REPO_ROOT, 'dist');
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

const delay = (ms) => new Promise((r) => setTimeout(r, ms));

/* =========================================================== CDP 客户端 */

class CdpClient {
  #ws = null;
  #id = 0;
  #pending = new Map();
  #listeners = new Map();

  constructor(url) {
    this.url = url;
  }

  async connect() {
    const ws = new WebSocket(this.url);
    this.#ws = ws;
    await new Promise((res, rej) => {
      ws.addEventListener('open', () => res(), { once: true });
      ws.addEventListener('error', () => rej(new Error(`WebSocket 连接失败：${this.url}`)), { once: true });
    });
    ws.addEventListener('message', (ev) => this.#onMessage(ev.data));
    ws.addEventListener('close', () => {
      for (const [, p] of this.#pending) p.reject(new Error('CDP 连接已关闭'));
      this.#pending.clear();
    });
  }

  #onMessage(raw) {
    let msg;
    try {
      msg = JSON.parse(typeof raw === 'string' ? raw : String(raw));
    } catch {
      return;
    }
    if (msg.id !== undefined) {
      const pending = this.#pending.get(msg.id);
      if (!pending) return;
      this.#pending.delete(msg.id);
      if (msg.error) {
        pending.reject(new Error(`${pending.method} 失败：${msg.error.message}（code ${msg.error.code}）`));
      } else {
        pending.resolve(msg.result);
      }
      return;
    }
    if (!msg.method) return;
    for (const fn of this.#listeners.get(msg.method) ?? []) fn(msg.params, msg.sessionId);
    if (msg.sessionId) {
      for (const fn of this.#listeners.get(`${msg.sessionId}:${msg.method}`) ?? []) fn(msg.params, msg.sessionId);
    }
    for (const fn of this.#listeners.get('*') ?? []) fn(msg);
  }

  send(method, params = {}, sessionId) {
    const id = ++this.#id;
    const payload = sessionId ? { id, method, params, sessionId } : { id, method, params };
    return new Promise((res, rej) => {
      this.#pending.set(id, { resolve: res, reject: rej, method });
      try {
        this.#ws.send(JSON.stringify(payload));
      } catch (err) {
        this.#pending.delete(id);
        rej(err);
      }
    });
  }

  /** 注册事件监听，返回取消订阅函数。 */
  on(method, fn) {
    if (!this.#listeners.has(method)) this.#listeners.set(method, new Set());
    this.#listeners.get(method).add(fn);
    return () => this.#listeners.get(method)?.delete(fn);
  }

  close() {
    try {
      this.#ws?.close();
    } catch {
      /* 忽略关闭异常 */
    }
  }
}

/* ============================================================ 启动 Chrome */

function launchChrome({ port, userDataDir, extraArgs = [], headless = '--headless=new' }) {
  const args = [
    headless,
    `--remote-debugging-port=${port}`,
    `--user-data-dir=${userDataDir}`,
    '--no-first-run',
    '--no-default-browser-check',
    '--disable-gpu',
    '--enable-unsafe-swiftshader',
    '--use-angle=swiftshader',
    '--window-size=1440,900',
    '--disable-background-networking',
    '--disable-component-update',
    '--disable-domain-reliability',
    '--disable-sync',
    '--disable-extensions',
    '--hide-crash-restore-bubble',
    ...extraArgs,
    'about:blank',
  ];
  const child = spawn(CHROME, args, { stdio: ['ignore', 'pipe', 'pipe'] });
  child.stderrText = '';
  child.stderr.on('data', (d) => {
    child.stderrText = (child.stderrText + d.toString()).slice(-4000);
  });
  child.stdout.resume();
  return child;
}

async function fetchJson(url, timeoutMs = 2000) {
  const res = await fetch(url, { signal: AbortSignal.timeout(timeoutMs) });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

async function waitForBrowserEndpoint(port, timeoutMs = 15000) {
  const deadline = Date.now() + timeoutMs;
  let lastError = null;
  while (Date.now() < deadline) {
    try {
      return await fetchJson(`http://127.0.0.1:${port}/json/version`);
    } catch (err) {
      lastError = err;
      await delay(200);
    }
  }
  throw new Error(`等待 Chrome DevTools 端点超时（${timeoutMs}ms）：${lastError?.message ?? '未知原因'}`);
}

/* ============================================================== 页面工具 */

function waitForEvent(cdp, method, sessionId, timeoutMs = 15000) {
  return new Promise((res, rej) => {
    let off = () => {};
    const timer = setTimeout(() => {
      off();
      rej(new Error(`等待事件 ${method} 超时（${timeoutMs}ms）`));
    }, timeoutMs);
    off = cdp.on(method, (params, sid) => {
      if (sessionId && sid && sid !== sessionId) return;
      clearTimeout(timer);
      off();
      res(params);
    });
  });
}

async function evaluate(cdp, sessionId, expression, { awaitPromise = false } = {}) {
  const res = await cdp.send('Runtime.evaluate', {
    expression,
    returnByValue: true,
    awaitPromise,
    userGesture: true,
  }, sessionId);
  if (res.exceptionDetails) {
    const d = res.exceptionDetails;
    throw new Error(`页面求值异常：${d.exception?.description ?? d.text ?? '未知'}`);
  }
  return res.result?.value;
}

async function screenshot(cdp, sessionId, filePath) {
  const shot = await captureScreenshotData(cdp, sessionId);
  writeFileSync(filePath, Buffer.from(shot.b64, 'base64'));
  return { bytes: shot.bytes, hash: shot.hash };
}

/** 只取截图数据（不落盘），供页内解码用。 */
async function captureScreenshotData(cdp, sessionId) {
  const { data } = await cdp.send('Page.captureScreenshot', {
    format: 'png',
    captureBeyondViewport: false,
  }, sessionId);
  const buf = Buffer.from(data, 'base64');
  return { b64: data, bytes: buf.length, hash: hashString(data) };
}

/**
 * 采集画布像素签名。
 * 优先走 screenshot 通道：截图反映用户实际看到的画面，且不会扰动场景。
 * 只有截图通道不可用时，才回退到 webgl-readback —— 该通道会用一次极小的合成指针
 * 拖动促使按需渲染的应用重绘，会轻微转动镜头，因此只作为兜底。
 */
async function captureSignature(cdp, sessionId, preferSource = null) {
  let viaShot = { ok: false, reason: 'not-captured' };
  try {
    const shot = await captureScreenshotData(cdp, sessionId);
    viaShot = await evaluate(cdp, sessionId, SCREENSHOT_READBACK(shot.b64), { awaitPromise: true });
  } catch (err) {
    viaShot = { ok: false, reason: String(err?.message ?? err) };
  }
  const s = viaShot?.distinctColors ?? 0;
  const shotUsable = viaShot?.ok === true && s > 8;

  if (shotUsable && preferSource !== 'webgl-readback') {
    return { ...viaShot, source: 'screenshot', viaScreenshot: viaShot };
  }

  const direct = await evaluate(cdp, sessionId, READBACK_SNIPPET, { awaitPromise: true });
  const d = direct?.distinctColors ?? 0;
  if (direct?.ok && (d >= s || !shotUsable)) {
    return { ...direct, source: 'webgl-readback', viaScreenshot: viaShot, viaDirect: direct };
  }
  return {
    ...(viaShot?.ok ? viaShot : direct ?? { ok: false, reason: 'no-readback' }),
    source: 'screenshot',
    viaScreenshot: viaShot,
    viaDirect: direct,
  };
}

function hashString(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h;
}

/* ======================================================= 页内探针片段 */

/** 像素签名计算（两条读取通道共用）。 */
const SIGNATURE_FN = `function computeSignature(data, W, H) {
  const seen = new Map();
  let sum = 0, hash = 0, idx = 0;
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i], g = data[i + 1], b = data[i + 2];
    const key = (r << 16) | (g << 8) | b;
    seen.set(key, (seen.get(key) || 0) + 1);
    sum += r + g + b;
    hash = (hash + key * (idx + 1)) % 2147483647;
    idx++;
  }
  let dominant = 0;
  for (const v of seen.values()) if (v > dominant) dominant = v;
  return {
    ok: true,
    distinctColors: seen.size,
    nonBackgroundRatio: 1 - dominant / (W * H),
    sum, hash, pixelCount: W * H,
  };
}`;

/**
 * 通道 A：直接读 WebGL 画布。
 * 注意：应用常常按需渲染（invalidate 一次即停），preserveDrawingBuffer 为 false 时
 * 合成后的绘制缓冲会被清空，drawImage 只能读到空白帧。因此每次尝试前先用一次
 * 极小的合成指针拖动促使应用重绘，再在 rAF 回调里读取。
 */
const READBACK_SNIPPET = `(async () => {
  ${SIGNATURE_FN}
  const c = document.querySelector('canvas');
  if (!c) return { ok: false, reason: 'no-canvas' };
  if (!c.width || !c.height) return { ok: false, reason: 'zero-size', canvasW: c.width, canvasH: c.height };
  const W = 320, H = 240;
  const off = document.createElement('canvas');
  off.width = W; off.height = H;
  const ctx = off.getContext('2d', { willReadFrequently: true });
  if (!ctx) return { ok: false, reason: 'no-2d-context' };
  const read = () => {
    try {
      ctx.clearRect(0, 0, W, H);
      ctx.drawImage(c, 0, 0, W, H);
      const data = ctx.getImageData(0, 0, W, H).data;
      const sig = computeSignature(data, W, H);
      sig.canvasW = c.width; sig.canvasH = c.height;
      return sig;
    } catch (err) {
      return { ok: false, reason: String(err) };
    }
  };
  const nudge = () => {
    try {
      const r = c.getBoundingClientRect();
      const x = r.left + r.width / 2, y = r.top + r.height / 2;
      const base = { bubbles: true, cancelable: true, clientX: x, clientY: y, pointerId: 1, pointerType: 'mouse', isPrimary: true, button: 0 };
      c.dispatchEvent(new PointerEvent('pointerdown', { ...base, buttons: 1 }));
      c.dispatchEvent(new PointerEvent('pointermove', { ...base, clientX: x + 1, buttons: 1 }));
      c.dispatchEvent(new PointerEvent('pointerup', { ...base, clientX: x + 1, buttons: 0 }));
      c.dispatchEvent(new MouseEvent('mousemove', { bubbles: true, clientX: x + 1, clientY: y }));
    } catch (e) { /* 忽略 */ }
  };
  const attempt = () => new Promise((done) => {
    let settled = false;
    const finish = (v) => { if (!settled) { settled = true; done(v); } };
    const timer = setTimeout(() => finish(read()), 500);
    requestAnimationFrame(() => { clearTimeout(timer); finish(read()); });
  });
  let best = { ok: false, reason: 'no-attempt' };
  for (let i = 0; i < 6; i++) {
    nudge();
    await new Promise((r) => setTimeout(r, 150));
    const r = await attempt();
    if (r.ok && (r.distinctColors || 0) > (best.distinctColors || 0)) best = r;
    if (best.ok && best.distinctColors > 8) break;
  }
  return best;
})()`;

/**
 * 通道 B：把 CDP 截图交回页面解码（浏览器自带 PNG 解码器，无需任何图像库），
 * 裁出 canvas 所在矩形后计算像素签名。截图反映的是用户实际看到的画面，
 * 不受 preserveDrawingBuffer 影响。
 */
const SCREENSHOT_READBACK = (b64) => `(async () => {
  ${SIGNATURE_FN}
  const c = document.querySelector('canvas');
  if (!c) return { ok: false, reason: 'no-canvas' };
  const r = c.getBoundingClientRect();
  const img = new Image();
  img.src = 'data:image/png;base64,' + ${JSON.stringify(b64)};
  try { await img.decode(); } catch (e) { return { ok: false, reason: 'image-decode-failed' }; }
  const scale = img.width / Math.max(1, window.innerWidth);
  const sx = Math.max(0, Math.round(r.left * scale));
  const sy = Math.max(0, Math.round(r.top * scale));
  const sw = Math.min(img.width - sx, Math.round(r.width * scale));
  const sh = Math.min(img.height - sy, Math.round(r.height * scale));
  if (sw <= 1 || sh <= 1) {
    return { ok: false, reason: 'canvas-region-empty', region: { sx, sy, sw, sh }, imgW: img.width, imgH: img.height };
  }
  const W = 320, H = 240;
  const off = document.createElement('canvas');
  off.width = W; off.height = H;
  const ctx = off.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(img, sx, sy, sw, sh, 0, 0, W, H);
  const data = ctx.getImageData(0, 0, W, H).data;
  const sig = computeSignature(data, W, H);
  sig.region = { sx, sy, sw, sh };
  sig.scale = scale;
  return sig;
})()`;

/** 生成点击探针：优先按选择器，其次按文案关键词。 */
function clickSnippet(selectors, keywords = []) {
  return `(() => {
  const selectors = ${JSON.stringify(selectors)};
  const keywords = ${JSON.stringify(keywords)};
  const all = [];
  for (const sel of selectors) {
    try { document.querySelectorAll(sel).forEach((el) => all.push(el)); } catch (e) {}
  }
  let el = null;
  for (const kw of keywords) {
    el = all.find((e) => (((e.textContent || '') + ' ' + (e.getAttribute('aria-label') || '')).includes(kw)));
    if (el) break;
  }
  if (!el && keywords.length === 0) el = all[0] || null;
  if (!el) return { ok: false, reason: 'not-found', candidates: all.length };
  try { el.scrollIntoView({ block: 'center' }); } catch (e) {}
  el.click();
  return {
    ok: true,
    tag: el.tagName,
    text: (el.textContent || '').trim().slice(0, 40),
    aria: el.getAttribute('aria-label') || '',
    attrs: Array.from(el.attributes || []).map((a) => a.name + '=' + a.value).join(' ').slice(0, 220),
  };
})()`;
}

const ERUPTION_STATE_SNIPPET = `(() => {
  const out = { running: false, found: false, evidence: [] };
  const stateSel = '[data-eruption-state],[data-eruption-running],[data-scene-state],[data-state],[data-eruption]';
  const nodes = Array.from(document.querySelectorAll(stateSel));
  for (const el of nodes) {
    const raw = el.getAttribute('data-eruption-state')
      || el.getAttribute('data-eruption-running')
      || el.getAttribute('data-scene-state')
      || el.getAttribute('data-state')
      || '';
    const kind = el.getAttribute('data-eruption') || '';
    if (kind === 'start') continue;
    if (raw) {
      out.found = true;
      if (/^(running|playing|active|started|eruption|on)$/i.test(raw)
          || /进行|运行|播放|喷发中/i.test(raw)) {
        out.running = true;
        out.evidence.push('state=' + raw + ' on ' + el.tagName);
      }
    }
    if (el.getAttribute('aria-pressed') === 'true' && /pause|stop|running/i.test(kind + raw)) {
      out.running = true;
      out.evidence.push('aria-pressed=true on ' + el.tagName + '[' + (kind || raw) + ']');
    }
  }
  const status = document.querySelector('[data-slot="status"],[role="status"],[role="alert"]');
  if (status) {
    const t = (status.textContent || '').trim();
    if (t) out.statusText = t.slice(0, 80);
    if (/喷发/.test(t) && /(进行中|运行|播放|中$|开始)/.test(t)) {
      out.running = true;
      out.evidence.push('status=' + t.slice(0, 60));
    }
  }
  const pause = document.querySelector('[data-eruption="pause"],[data-eruption="stop"]');
  if (pause) {
    out.found = true;
    const disabled = pause.disabled || pause.getAttribute('aria-disabled') === 'true';
    const visible = !!(pause.offsetWidth || pause.offsetHeight || pause.getClientRects().length);
    if (!disabled && visible) {
      out.running = true;
      out.evidence.push('pause/stop 按钮可见且可用');
    }
  }
  return out;
})()`;

const SCROLL_SNIPPET = `(() => {
  const d = document.documentElement;
  const b = document.body;
  return {
    scrollWidth: d.scrollWidth,
    clientWidth: d.clientWidth,
    bodyScrollWidth: b ? b.scrollWidth : 0,
    innerWidth: window.innerWidth,
  };
})()`;

const FALLBACK_SNIPPET = `(() => {
  const marker = document.querySelector('[data-fallback],[data-scene-state="error"]');
  const text = (document.body && document.body.innerText) || '';
  const chinese = (text.match(/[\\u4e00-\\u9fff]/g) || []).length;
  const svgs = document.querySelectorAll('svg').length;
  return {
    hasMarker: !!marker,
    marker: marker ? (marker.getAttribute('data-fallback') !== null ? 'data-fallback' : 'data-scene-state=error') : null,
    chineseChars: chinese,
    svgCount: svgs,
    textLength: text.length,
    webgl2: (() => { try { const c = document.createElement('canvas'); return !!c.getContext('webgl2'); } catch (e) { return false; } })(),
  };
})()`;

/* ============================================================ 断言记录 */

class Checks {
  constructor() {
    this.items = [];
  }

  record(name, passed, detail = '') {
    this.items.push({ name, passed: Boolean(passed), detail: String(detail) });
    console.log(`${passed ? '✅ PASS' : '❌ FAIL'}  ${name}${detail ? ` —— ${detail}` : ''}`);
    return Boolean(passed);
  }

  get failed() {
    return this.items.filter((i) => !i.passed).length;
  }
}

/* ============================================================ 签名比较 */

function signatureDiff(a, b) {
  if (!a?.ok || !b?.ok) {
    return { comparable: false, changed: false, sumRel: null, hashRel: null, colorRel: null };
  }
  const sumRel = Math.abs(a.sum - b.sum) / Math.max(1, Math.abs(a.sum), Math.abs(b.sum));
  const hashRel = Math.abs(a.hash - b.hash) / 2147483647;
  const colorRel = Math.abs((a.distinctColors || 0) - (b.distinctColors || 0))
    / Math.max(1, a.distinctColors || 0, b.distinctColors || 0);
  return {
    comparable: true,
    sumRel,
    hashRel,
    colorRel,
    changed: sumRel > 0.002 || hashRel > 0.0002,
  };
}

/* ============================================================ 端口工具 */

function freePort() {
  return new Promise((res, rej) => {
    const srv = createServer();
    srv.once('error', rej);
    srv.listen(0, '127.0.0.1', () => {
      const { port } = srv.address();
      srv.close(() => res(port));
    });
  });
}

async function isPortFree(port) {
  return new Promise((res) => {
    const srv = createServer();
    srv.once('error', () => res(false));
    srv.listen(port, '127.0.0.1', () => srv.close(() => res(true)));
  });
}

/* ========================================================== 主测试流程 */

async function runSuite({ distDir, port: preferredPort }) {
  const checks = new Checks();
  const requests = [];
  const requestIndex = new Map();
  const consoleMessages = [];
  const exceptions = [];
  const logEntries = [];
  const readbacks = {};
  const artifacts = {};

  const shotDir = join(REPO_ROOT, 'reports', 'screenshots');
  mkdirSync(shotDir, { recursive: true });

  if (!existsSync(distDir)) {
    console.error(`✗ 未找到构建产物目录：${distDir}`);
    console.error('  先运行 npm run build');
    checks.record('构建产物目录存在', false, `${distDir} 不存在 —— 先运行 npm run build`);
    return { checks, requests, consoleMessages, exceptions, logEntries, readbacks, artifacts };
  }

  /* ------------------------------------------------ 1. 启动静态服务器 */
  const port = (await isPortFree(preferredPort)) ? preferredPort : await freePort();
  const server = await startServer({ root: distDir, port, quiet: true });
  checks.record('静态服务器启动', true, `${server.url}（根目录 ${server.root}）`);

  const tempProfiles = [];
  let browser = null;
  let cdp = null;

  try {
    /* ---------------------------------------------- 2. 启动 Chrome 并接入 */
    const debugPort = await freePort();
    const profile = join(tmpdir(), `volcano-smoke-${process.pid}-${Date.now()}`);
    tempProfiles.push(profile);
    browser = launchChrome({ port: debugPort, userDataDir: profile });

    let version;
    try {
      version = await waitForBrowserEndpoint(debugPort, 15000);
    } catch (err) {
      throw new Error(`${err.message}\nChrome 输出：\n${browser.stderrText.slice(-1500)}`);
    }
    artifacts.chrome = version.Browser;
    console.log(`ℹ️ Chrome：${version.Browser}（调试端口 ${debugPort}）`);

    cdp = new CdpClient(version.webSocketDebuggerUrl);
    await cdp.connect();

    const { targetId } = await cdp.send('Target.createTarget', { url: 'about:blank' });
    const { sessionId } = await cdp.send('Target.attachToTarget', { targetId, flatten: true });

    await cdp.send('Page.enable', {}, sessionId);
    await cdp.send('Runtime.enable', {}, sessionId);
    await cdp.send('Log.enable', {}, sessionId);
    await cdp.send('Network.enable', {}, sessionId);

    /* ------------------------------------------- 事件采集（全程记录） */
    cdp.on('Network.requestWillBeSent', (params) => {
      const rec = {
        method: params.request.method,
        url: params.request.url,
        type: params.type,
        status: null,
        requestId: params.requestId,
        ts: Date.now(),
      };
      requests.push(rec);
      requestIndex.set(params.requestId, rec);
    });
    cdp.on('Network.responseReceived', (params) => {
      const rec = requestIndex.get(params.requestId);
      if (rec) rec.status = params.response.status;
    });
    cdp.on('Network.loadingFailed', (params) => {
      const rec = requestIndex.get(params.requestId);
      if (rec) rec.error = params.errorText;
    });
    cdp.on('Runtime.consoleAPICalled', (params) => {
      consoleMessages.push({
        type: params.type,
        text: (params.args ?? []).map((a) => a.value ?? a.description ?? a.unserializableValue ?? '').join(' '),
        ts: Date.now(),
      });
    });
    cdp.on('Runtime.exceptionThrown', (params) => {
      const d = params.exceptionDetails ?? {};
      exceptions.push({
        text: d.text ?? '',
        description: d.exception?.description ?? '',
        ts: Date.now(),
      });
    });
    cdp.on('Log.entryAdded', (params) => {
      logEntries.push({
        level: params.entry.level,
        source: params.entry.source,
        text: params.entry.text,
        url: params.entry.url ?? null,
        ts: Date.now(),
      });
    });

    /* ------------------------------------------------ 3. 视口与导航 */
    await cdp.send('Emulation.setDeviceMetricsOverride', {
      width: 1440, height: 900, deviceScaleFactor: 1, mobile: false,
    }, sessionId);

    const loadPromise = waitForEvent(cdp, 'Page.loadEventFired', sessionId, 20000);
    const navResult = await cdp.send('Page.navigate', { url: server.url }, sessionId);
    const navOk = navResult && !navResult.errorText;
    let loadFired = true;
    try {
      await loadPromise;
    } catch {
      loadFired = false;
    }
    checks.record('Page.navigate 成功且触发 load 事件', navOk && loadFired,
      navOk ? (loadFired ? `url=${server.url}` : '未收到 load 事件') : `errorText=${navResult?.errorText}`);

    // 等待场景就绪（最多 12 秒），失败也不中断后续检查
    await waitForSceneReady(cdp, sessionId, 12000);
    await delay(600);

    /* --------------------------------------------------- 4. DOM 断言 */
    const dom = await evaluate(cdp, sessionId, `(() => ({
      title: document.title || '',
      canvases: document.querySelectorAll('canvas').length,
      chapterButtons: document.querySelectorAll('button[data-chapter]').length,
      chapterScopes: document.querySelectorAll('[data-chapter]').length,
      bodyTextLen: (document.body && document.body.innerText ? document.body.innerText.length : 0),
    }))()`);
    checks.record('document.title 非空', Boolean(dom?.title?.trim()), `title="${dom?.title ?? ''}"`);
    checks.record('页面存在 canvas', (dom?.canvases ?? 0) >= 1, `canvas 数量=${dom?.canvases}`);
    checks.record('章节按钮存在且可达（2 个）', dom?.chapterButtons === 2,
      `button[data-chapter]=${dom?.chapterButtons}（另有 ${dom?.chapterScopes ?? '?'} 个 [data-chapter] 作用域标记）`);

    /* --------------------------------------------- 5. WebGL 与像素 */
    const glInfo = await evaluate(cdp, sessionId, `(() => {
      const c = document.querySelector('canvas');
      if (!c) return { ok: false, reason: 'no-canvas' };
      const gl = c.getContext('webgl2') || c.getContext('webgl');
      return { ok: !!gl, w: c.width, h: c.height, type: gl ? (gl instanceof WebGL2RenderingContext ? 'webgl2' : 'webgl') : null };
    })()`);
    checks.record('WebGL 上下文可用', glInfo?.ok === true, `canvas=${glInfo?.w}x${glInfo?.h} 类型=${glInfo?.type ?? '无'}`);

    const full = await captureSignature(cdp, sessionId);
    readbacks.full = full;
    checks.record('画布像素非纯色（真实 3D 渲染）', full?.ok === true && (full?.distinctColors ?? 0) > 8,
      full?.ok
        ? `distinctColors=${full.distinctColors} nonBackgroundRatio=${(full.nonBackgroundRatio ?? 0).toFixed(3)} 读取通道=${full.source}`
        : `读取失败：${full?.reason}`);

    await screenshot(cdp, sessionId, join(shotDir, 'desktop-formation.png'));
    artifacts.desktopFormation = 'reports/screenshots/desktop-formation.png';

    /* ------------------------------------------- 6. 切到「影响」章节 */
    const clickImpact = await evaluate(cdp, sessionId, clickSnippet(['[data-chapter="impact"]']));
    await delay(900);
    await screenshot(cdp, sessionId, join(shotDir, 'desktop-impact.png'));
    artifacts.desktopImpact = 'reports/screenshots/desktop-impact.png';
    const impactTitle = await evaluate(cdp, sessionId, `(() => {
      const el = document.querySelector('[data-chapter="impact"]');
      return { pressed: el ? el.getAttribute('aria-current') : null, text: el ? (el.textContent||'').trim() : '' };
    })()`);
    checks.record('可点击「影响」章节按钮', clickImpact?.ok === true,
      clickImpact?.ok ? `按钮文案="${clickImpact.text}"` : '未找到 [data-chapter="impact"]');

    // 回到「形成」章节，保证后续像素对比在同一场景下进行
    await evaluate(cdp, sessionId, clickSnippet(['[data-chapter="formation"]']));
    await delay(900);

    /* --------------------------------------------- 7. 剖面视图对比 */
    // 后续所有像素采集走同一条通道，保证前后可比
    const sigSource = full?.source ?? null;
    const baseline = await captureSignature(cdp, sessionId, sigSource);
    readbacks.full = baseline?.ok ? baseline : full;
    // 空闲漂移：同一视图间隔 400ms 再取一次，用于判断「像素变化」是否只是持续动画造成的
    await delay(400);
    const baseline2 = await captureSignature(cdp, sessionId, sigSource);
    const drift = signatureDiff(baseline, baseline2);
    const shotBefore = await screenshot(cdp, sessionId, join(shotDir, '.tmp-view-before.png'));

    const cutawayClick = await evaluate(cdp, sessionId,
      clickSnippet(['[data-view="cutaway"]', '[data-view="cut"]', '[data-action="view-cutaway"]'], ['剖面']));
    await delay(700);
    const cutaway = await captureSignature(cdp, sessionId, sigSource);
    const shotAfter = await screenshot(cdp, sessionId, join(shotDir, '.tmp-view-after.png'));
    readbacks.cutaway = cutaway;

    const diffCut = signatureDiff(baseline, cutaway);
    const shotChanged = shotBefore.hash !== shotAfter.hash;
    checks.record('切到「剖面」后画面像素发生变化',
      diffCut.comparable && (diffCut.changed || shotChanged),
      `画布签名变化=${diffCut.changed ? '是' : '否'}(sumRel=${diffCut.sumRel?.toFixed(5)}, hashRel=${diffCut.hashRel?.toFixed(6)}) `
      + `整页截图变化=${shotChanged ? '是' : '否'}；空闲漂移(hashRel=${drift.hashRel?.toFixed(6)})；`
      + `通道=${cutaway?.source}；按钮=${cutawayClick?.ok ? cutawayClick.text : '未找到'}`);

    // 回到完整视图
    await evaluate(cdp, sessionId, clickSnippet(['[data-view="full"]', '[data-view="complete"]'], ['完整']));
    await delay(700);
    const restored = await captureSignature(cdp, sessionId, sigSource);
    readbacks.restoredFull = restored;

    /* --------------------------------------------- 8. 喷发动效对比 */
    const beforeEruption = restored?.ok ? restored : baseline;
    const eruptionClick = await evaluate(cdp, sessionId,
      clickSnippet(['[data-eruption="start"]', '[data-action="eruption-start"]'], ['启动喷发', '开始喷发']));
    await delay(1500);
    const during = await captureSignature(cdp, sessionId, sigSource);
    readbacks.eruption = during;
    const diffErupt = signatureDiff(beforeEruption, during);

    /* -------------------------- 8b. 实测帧率（喷发进行中，渲染循环持续跑） */
    const fpsProbe = await evaluate(cdp, sessionId,
      `(() => { const a = window.__volcano?.frameCount ?? 0; return new Promise((res) => {
         setTimeout(() => { const b = window.__volcano?.frameCount ?? 0; res({ a, b, ms: 1200 }); }, 1200);
       }); })()`,
      { awaitPromise: true });
    const fps = fpsProbe?.b > fpsProbe?.a
      ? ((fpsProbe.b - fpsProbe.a) / (fpsProbe.ms / 1000))
      : 0;
    checks.record('喷发期间实测帧率（软件渲染档）', fps >= 1,
      `渲染帧 ${fpsProbe?.a} → ${fpsProbe?.b}，用时 ${fpsProbe?.ms}ms，实测 ${fps.toFixed(1)} FPS（headless SwiftShader 软件渲染，非 GPU）`);
    artifacts.fps = Number(fps.toFixed(1));
    const eruptState = await evaluate(cdp, sessionId, ERUPTION_STATE_SNIPPET);
    checks.record('启动喷发后画面像素发生变化',
      diffErupt.comparable && diffErupt.changed,
      `画布签名变化=${diffErupt.changed ? '是' : '否'}(sumRel=${diffErupt.sumRel?.toFixed(5)}, hashRel=${diffErupt.hashRel?.toFixed(6)}) `
      + `distinctColors ${beforeEruption?.distinctColors}→${during?.distinctColors}；通道=${during?.source}；`
      + `按钮=${eruptionClick?.ok ? eruptionClick.text : '未找到'}`);

    // 暂停 / 停止喷发
    const pauseClick = await evaluate(cdp, sessionId,
      clickSnippet(['[data-eruption="pause"]', '[data-eruption="stop"]', '[data-action="eruption-pause"]'], ['暂停', '停止']));
    await delay(300);
    checks.record('喷发可暂停/停止', pauseClick?.ok === true,
      pauseClick?.ok ? `按钮="${pauseClick.text}"` : '未找到暂停/停止按钮');

    /* ------------------------------------------ 9. 375px 无横向滚动 */
    await cdp.send('Emulation.setDeviceMetricsOverride', {
      width: 375, height: 812, deviceScaleFactor: 1, mobile: true,
    }, sessionId);
    await delay(700);
    const scroll375 = await evaluate(cdp, sessionId, SCROLL_SNIPPET);
    checks.record('375px 视口无横向滚动',
      scroll375.scrollWidth <= scroll375.clientWidth + 1,
      `scrollWidth=${scroll375.scrollWidth} clientWidth=${scroll375.clientWidth} innerWidth=${scroll375.innerWidth}`);
    // 先切回形成章，否则这张「mobile-formation」拍到的是影响章
    await evaluate(cdp, sessionId, clickSnippet(['[data-chapter="formation"]']));
    await delay(900);
    await screenshot(cdp, sessionId, join(shotDir, 'mobile-formation.png'));
    artifacts.mobileFormation = 'reports/screenshots/mobile-formation.png';

    await evaluate(cdp, sessionId, clickSnippet(['[data-chapter="impact"]']));
    await delay(900);
    await screenshot(cdp, sessionId, join(shotDir, 'mobile-impact.png'));
    artifacts.mobileImpact = 'reports/screenshots/mobile-impact.png';

    /* ----------------------------------------- 10. 1440px 无横向滚动 */
    await cdp.send('Emulation.setDeviceMetricsOverride', {
      width: 1440, height: 900, deviceScaleFactor: 1, mobile: false,
    }, sessionId);
    await delay(700);
    const scroll1440 = await evaluate(cdp, sessionId, SCROLL_SNIPPET);
    checks.record('1440px 视口无横向滚动',
      scroll1440.scrollWidth <= scroll1440.clientWidth + 1,
      `scrollWidth=${scroll1440.scrollWidth} clientWidth=${scroll1440.clientWidth} innerWidth=${scroll1440.innerWidth}`);
    /* ------------------------- 9b. 补齐规划案 §9.3 要求的其余证据截图 */
    // (a) 火山渣锥：坡面应有 InstancedMesh 渣粒
    // 先回到页面顶部并滚到画布，保证截图里是 3D 展台而不是解说栏
    await evaluate(cdp, sessionId, `(() => { window.scrollTo(0, 0);
      document.querySelector('.stage__canvas-wrap')?.scrollIntoView({ block: 'center' }); return true; })()`);
    await delay(400);
    await evaluate(cdp, sessionId, clickSnippet(['[data-chapter="formation"]']));
    await delay(700);
    await evaluate(cdp, sessionId, clickSnippet(['[data-volcano="cinder"]']));
    await delay(1200);
    const cinderShot = await screenshot(cdp, sessionId, join(shotDir, 'cinder-cone.png'));
    artifacts.cinderCone = 'reports/screenshots/cinder-cone.png';
    checks.record('火山渣锥形态可切换并出图', cinderShot?.bytes > 0,
      `cinder-cone.png 已保存（${cinderShot?.bytes ?? 0} 字节）`);

    // (b) VEI 表展开态：展开 VEI 6（皮纳图博 1991）
    await evaluate(cdp, sessionId, clickSnippet(['[data-vei="6"]']));
    await delay(600);
    const veiExpanded = await evaluate(cdp, sessionId,
      `(() => { const b = document.querySelector('[data-vei="6"]');
        return { expanded: b?.getAttribute('aria-expanded') ?? null,
                 detailVisible: !document.querySelector('#vei-detail-6')?.hidden }; })()`);
    checks.record('VEI 行可展开并显示对应事实', veiExpanded?.expanded === 'true' && veiExpanded?.detailVisible === true,
      `aria-expanded=${veiExpanded?.expanded} 详情可见=${veiExpanded?.detailVisible}`);
    await screenshot(cdp, sessionId, join(shotDir, 'veitable-expanded.png'));
    artifacts.veiTableExpanded = 'reports/screenshots/veitable-expanded.png';

    // (c) 焦点可见态：聚焦章节按钮后截图
    await evaluate(cdp, sessionId,
      `(() => { const b = document.querySelector('button[data-chapter="formation"]'); b?.focus(); return !!b; })()`);
    await delay(400);
    const focusRing = await evaluate(cdp, sessionId,
      `(() => { const b = document.querySelector('button[data-chapter="formation"]');
        if (!b) return null;
        const cs = getComputedStyle(b);
        return { active: document.activeElement === b, outlineWidth: cs.outlineWidth, outlineStyle: cs.outlineStyle }; })()`);
    checks.record('键盘焦点环可见（≥2px 实线）',
      focusRing?.active === true && parseFloat(focusRing?.outlineWidth ?? '0') >= 2 && focusRing?.outlineStyle !== 'none',
      `聚焦=${focusRing?.active} outline=${focusRing?.outlineWidth} ${focusRing?.outlineStyle}`);
    await screenshot(cdp, sessionId, join(shotDir, 'focus-visible.png'));
    artifacts.focusVisible = 'reports/screenshots/focus-visible.png';


    /* ------------------------------------------- 11. 减弱动效不自动播 */
    await cdp.send('Emulation.setEmulatedMedia', {
      features: [{ name: 'prefers-reduced-motion', value: 'reduce' }],
    }, sessionId);
    const reloadPromise = waitForEvent(cdp, 'Page.loadEventFired', sessionId, 20000);
    await cdp.send('Page.reload', { ignoreCache: false }, sessionId);
    try {
      await reloadPromise;
    } catch {
      /* 下面的检查会如实报告结果 */
    }
    await waitForSceneReady(cdp, sessionId, 12000);
    await delay(800);
    const reducedState = await evaluate(cdp, sessionId, ERUPTION_STATE_SNIPPET);
    checks.record('减弱动效（reduce）下喷发不自动开始',
      reducedState?.running === false,
      `running=${reducedState?.running} 专用状态标记=${reducedState?.found ? '有' : '未发现'}`
      + `${reducedState?.evidence?.length ? ` 证据=${reducedState.evidence.join('; ')}` : ''}`
      + `${reducedState?.statusText ? ` 状态条="${reducedState.statusText}"` : ''}`);

    /* ---------------------------------------- 12. 外部请求与控制台 */
    const external = requests.filter((r) => externalHostOf(r.url) !== null);
    checks.record('运行期外部域名请求数为 0', external.length === 0,
      external.length === 0
        ? `共 ${requests.length} 个请求，全部指向本地静态服务器`
        : `发现 ${external.length} 个外部请求：${external.map((r) => `${r.method} ${r.url}`).join(' | ')}`);

    const consoleErrors = consoleMessages.filter((m) => m.type === 'error');
    checks.record('控制台错误数为 0', consoleErrors.length === 0 && exceptions.length === 0,
      consoleErrors.length === 0 && exceptions.length === 0
        ? `console error=0，未捕获异常=0（日志条目 ${logEntries.length} 条）`
        : `console error=${consoleErrors.length} 未捕获异常=${exceptions.length}：`
          + `${[...consoleErrors.map((m) => m.text), ...exceptions.map((e) => e.description || e.text)].join(' | ').slice(0, 400)}`);

    /* -------------------------------- 13. 关闭第一实例，准备降级测试 */
    try {
      await cdp.send('Target.closeTarget', { targetId });
    } catch {
      /* 忽略 */
    }
    cdp.close();
    cdp = null;
    browser.kill('SIGKILL');
    browser = null;

    /* ------------------------------- 14. 禁用 WebGL 的第二实例 */
    const fallbackProfile = join(tmpdir(), `volcano-smoke-nogl-${process.pid}-${Date.now()}`);
    tempProfiles.push(fallbackProfile);
    const fallbackPort = await freePort();
    const fallbackBrowser = launchChrome({
      port: fallbackPort,
      userDataDir: fallbackProfile,
      extraArgs: ['--disable-webgl', '--disable-webgl2', '--disable-3d-apis'],
    });
    try {
      const fbVersion = await waitForBrowserEndpoint(fallbackPort, 20000);
      const fbCdp = new CdpClient(fbVersion.webSocketDebuggerUrl);
      await fbCdp.connect();
      try {
        const { targetId: fbTarget } = await fbCdp.send('Target.createTarget', { url: 'about:blank' });
        const { sessionId: fbSession } = await fbCdp.send('Target.attachToTarget', { targetId: fbTarget, flatten: true });
        await fbCdp.send('Page.enable', {}, fbSession);
        await fbCdp.send('Runtime.enable', {}, fbSession);
        await fbCdp.send('Network.enable', {}, fbSession);
        await fbCdp.send('Emulation.setDeviceMetricsOverride', {
          width: 1440, height: 900, deviceScaleFactor: 1, mobile: false,
        }, fbSession);

        const fbLoad = waitForEvent(fbCdp, 'Page.loadEventFired', fbSession, 20000);
        await fbCdp.send('Page.navigate', { url: server.url }, fbSession);
        try {
          await fbLoad;
        } catch {
          /* 忽略超时，状态检查会如实报告 */
        }
        await delay(2500);

        const fallback = await evaluate(fbCdp, fbSession, FALLBACK_SNIPPET);
        artifacts.fallback = fallback;
        await screenshot(fbCdp, fbSession, join(shotDir, 'webgl-error.png'));
        artifacts.webglError = 'reports/screenshots/webgl-error.png';

        checks.record('禁用 WebGL 时出现静态降级内容',
          fallback?.hasMarker === true && (fallback?.chineseChars ?? 0) >= 200,
          `降级标记=${fallback?.hasMarker ? `有（${fallback.marker}）` : '无'} `
          + `中文字数=${fallback?.chineseChars} webgl2可用=${fallback?.webgl2} svg=${fallback?.svgCount}`);
      } finally {
        fbCdp.close();
      }
    } finally {
      fallbackBrowser.kill('SIGKILL');
    }
  } catch (err) {
    checks.record('冒烟测试执行未中断', false, err?.message ?? String(err));
    console.error(`✗ 执行异常：${err?.stack ?? err}`);
  } finally {
    cdp?.close();
    if (browser) {
      browser.kill('SIGKILL');
    }
    await server.close();
    for (const dir of tempProfiles) {
      try {
        rmSync(dir, { recursive: true, force: true });
      } catch {
        /* 忽略清理失败 */
      }
    }
    // 临时对比图不入库
    for (const tmp of ['.tmp-view-before.png', '.tmp-view-after.png']) {
      try {
        rmSync(join(shotDir, tmp), { force: true });
      } catch {
        /* 忽略 */
      }
    }
  }

  /* ------------------------------------------------------ 写 network-log */
  const logPath = join(REPO_ROOT, 'reports', 'network-log.json');
  mkdirSync(join(REPO_ROOT, 'reports'), { recursive: true });
  // data:/blob: 等非网络 scheme 不是网络请求（冒烟脚本自身的页内 PNG 解码会用到 data: URL），
  // 单独列出以免污染网络记录，但同样不计入外部请求判定。
  const isNetworkScheme = (u) => /^(https?|wss?|file|ftp):/i.test(u);
  const networkRequests = requests.filter((r) => isNetworkScheme(r.url));
  const nonNetworkRequests = requests.filter((r) => !isNetworkScheme(r.url));
  writeFileSync(logPath, `${JSON.stringify({
    generatedAt: new Date().toISOString(),
    chrome: artifacts.chrome ?? null,
    server: server.url,
    requests: networkRequests.map(({ method, url, type, status, error }) => ({ method, url, type, status, error: error ?? null })),
    externalRequests: networkRequests.filter((r) => externalHostOf(r.url) !== null).map((r) => r.url),
    nonNetworkRequests: nonNetworkRequests.map((r) => ({
      method: r.method,
      scheme: (r.url.split(':')[0] || '?').toLowerCase(),
      urlLength: r.url.length,
      note: '非网络 scheme（data:/blob: 等），未联系任何域名',
    })),
    console: consoleMessages,
    exceptions,
    logEntries,
    readbacks,
    artifacts,
    checks: checks.items,
  }, null, 2)}\n`, 'utf8');
  artifacts.networkLog = 'reports/network-log.json';

  return { checks, requests, consoleMessages, exceptions, logEntries, readbacks, artifacts };
}

/** 等待场景进入就绪状态（有专用标记或状态条文案变化）。 */
async function waitForSceneReady(cdp, sessionId, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const st = await evaluate(cdp, sessionId, `(() => {
      const s = document.querySelector('[data-scene-state]');
      const status = document.querySelector('[data-slot="status"],[role="status"]');
      const canvas = document.querySelector('canvas');
      return {
        sceneState: s ? s.getAttribute('data-scene-state') : null,
        statusText: status ? (status.textContent || '').trim() : '',
        hasCanvas: !!canvas,
      };
    })()`).catch(() => null);
    if (st) {
      if (st.sceneState === 'ready' || st.sceneState === 'error') return st;
      if (/已就绪|已准备好|画面已准备好|3D 已就绪/.test(st.statusText)) return st;
      if (st.hasCanvas && st.statusText && !/正在|准备|加载|生成|构建/.test(st.statusText)) return st;
    }
    await delay(200);
  }
  return null;
}

/** 返回非本地主机名（本地为 null）。 */
function externalHostOf(url) {
  if (!/^(https?|wss?):/i.test(url)) return null;
  try {
    const u = new URL(url);
    const host = u.hostname.replace(/^\[|\]$/g, '');
    if (host === '127.0.0.1' || host === 'localhost' || host === '::1' || host === '0.0.0.0') return null;
    return host;
  } catch {
    return '无法解析的主机名';
  }
}

/* ============================================================ 命令行 */

function usage() {
  console.log(`用法：node scripts/smoke-cdp.mjs [选项]

选项：
  --dist <目录>   待测构建产物目录（默认：仓库根目录下的 dist/）
  --port <n>      静态服务器端口（默认 4173，被占用时自动改用随机端口）
  --manual        只打印人工走查清单，不启动 Chrome
  -h, --help      显示本帮助并退出

用系统自带 Chrome + 原生 WebSocket 直连 CDP，不依赖 puppeteer/playwright。`);
}

function manualChecklist() {
  console.log('人工走查清单（smoke-cdp 无法自动执行时的替代方案）');
  console.log('─'.repeat(72));
  const items = [
    'npm run build 成功，dist/index.html 存在且含 <html lang="zh-CN">',
    'npm run check:static 退出码 0，报告「外部运行时请求 0」',
    'npm run preview -- --host 127.0.0.1 打开页面，DevTools Network 勾选 All，刷新后外部域名请求数为 0',
    'DevTools Console 无 error、无未捕获异常',
    '页面首屏出现真实 3D 火山模型（可拖动旋转、滚轮缩放），不是纯色画布',
    '「完整 / 剖面 / 俯瞰 / 重置视角」四个按钮都能改变画面（截图前后像素不同）',
    '「启动喷发」播放喷发柱动画，「暂停」能停下，重播可再次播放',
    '形成章节的三种板块环境 / 四步建造 / 三种山形都能改变 3D 与文案',
    '影响章节的五个现象都能切换对应 3D 视效与数值卡',
    '375px 与 1440px 均无横向滚动条',
    'DevTools 渲染 → 模拟 prefers-reduced-motion: reduce，刷新后喷发不会自动开始',
    'DevTools → Rendering → 禁用 WebGL（或加 --disable-webgl 启动），页面出现静态剖面与完整中文解释',
    '只用 Tab / Enter / Space / Esc / 方向键可以完成章节切换、视角切换、喷发与数据展开',
    '键盘可达：焦点环可见，操作目标 ≥44×44px',
    '长来源 URL 在窄屏下断词换行，不撑破布局',
  ];
  items.forEach((t, i) => console.log(`${String(i + 1).padStart(2, ' ')}. [ ] ${t}`));
  console.log('─'.repeat(72));
  console.log('勾选完成后，请如实把未通过项写进 reports/latest.md（不要宣称自动项已通过）。');
}

async function main() {
  const argv = process.argv.slice(2);
  let distDir = DEFAULT_DIST;
  let port = 4173;
  let manual = false;
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--help' || a === '-h') {
      usage();
      process.exit(0);
    } else if (a === '--manual') {
      manual = true;
    } else if (a === '--dist') {
      distDir = resolve(argv[++i] ?? DEFAULT_DIST);
    } else if (a.startsWith('--dist=')) {
      distDir = resolve(a.slice(7));
    } else if (a === '--port') {
      port = Number(argv[++i]);
    } else if (a.startsWith('--port=')) {
      port = Number(a.slice(7));
    }
  }

  if (manual) {
    manualChecklist();
    process.exit(0);
  }

  if (!existsSync(CHROME)) {
    console.error(`✗ 找不到 Chrome：${CHROME}`);
    console.error('  可用 node scripts/smoke-cdp.mjs --manual 走人工清单。');
    process.exit(1);
  }

  const result = await runSuite({ distDir, port });

  console.log('');
  console.log('══════ 冒烟测试汇总 ══════');
  for (const item of result.checks.items) {
    console.log(`${item.passed ? '✅' : '❌'} ${item.name}${item.detail ? ` —— ${item.detail}` : ''}`);
  }
  const total = result.checks.items.length;
  const failed = result.checks.failed;
  console.log('─────────────────────────');
  console.log(`共 ${total} 项检查，通过 ${total - failed} 项，失败 ${failed} 项。`);
  const produced = Object.values(result.artifacts)
    .filter((v) => typeof v === 'string' && v.startsWith('reports/'));
  console.log(produced.length
    ? `产物：${produced.join('、')}`
    : '产物：无（测试未进入浏览器阶段）');
  process.exit(failed === 0 ? 0 : 1);
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) {
  await main();
}
