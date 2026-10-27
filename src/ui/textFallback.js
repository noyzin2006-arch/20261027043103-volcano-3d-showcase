/**
 * 文字 / 图形降级版 —— WebGL 不可用时的静态剖面图
 * 依据：handoff/plans/TASK-001.md T11「生成 SVG cutaway fallback」
 *
 * 规则：
 *   1. 剖面图用与 3D 场景**同一套程序化点列**生成（radialHeight），不是空白占位。
 *   2. 颜色一律走 CSS class（currentColor / 令牌），不写死 hex。
 *   3. 降级时仍要能完成文字教育与全部按钮操作 —— 不谎称 3D 已就绪。
 */

import { radialHeight, baseRadius, BASE_Y, CRATER_RADIUS, CUT_CENTER, DEFAULT_SEED } from '../scene/terrain.js';

const NS = 'http://www.w3.org/2000/svg';

function el(tag, attrs = {}) {
  const node = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, String(v));
  return node;
}

/**
 * 生成静态剖面 SVG。
 * @param {{kind?:string, growth?:number, seed?:number}} [opts]
 * @returns {SVGSVGElement}
 */
export function buildFallbackSvg(opts = {}) {
  const { kind = 'strato', growth = 1, seed = DEFAULT_SEED } = opts;
  const base = baseRadius(kind);
  const samples = 64;

  // 表面轮廓（沿 CUT_CENTER 方位切一条径向剖面）
  const pts = [];
  for (let i = 0; i <= samples; i += 1) {
    const r = (base * i) / samples;
    const y = radialHeight(r, CUT_CENTER, kind, seed, growth);
    pts.push([r, y]);
  }

  const pathParts = [];
  pathParts.push(`M ${pts[0][0].toFixed(3)} ${(-pts[0][1]).toFixed(3)}`);
  for (let i = 1; i < pts.length; i += 1) {
    pathParts.push(`L ${pts[i][0].toFixed(3)} ${(-pts[i][1]).toFixed(3)}`);
  }
  pathParts.push(`L ${base.toFixed(3)} ${(-BASE_Y).toFixed(3)}`);
  pathParts.push(`L 0 ${(-BASE_Y).toFixed(3)}`);
  pathParts.push('Z');

  const viewBox = `-0.5 -4.6 ${(base + 1).toFixed(2)} ${(-BASE_Y + 5).toFixed(2)}`;
  const svg = el('svg', {
    viewBox,
    class: 'fallback-svg',
    role: 'img',
    'aria-label': '火山剖面示意图：地表山体、下方岩层、岩浆房与通往火口的岩浆通道。结构示意，非实测比例。',
  });

  // 岩层底色
  const ground = el('path', { d: pathParts.join(' '), class: 'fallback-svg__ground' });
  svg.appendChild(ground);

  // 地层分界
  for (const y of [-0.6, -1.3, -2.0]) {
    svg.appendChild(
      el('line', { x1: 0, y1: -y, x2: base, y2: -y, class: 'fallback-svg__layer' })
    );
  }

  // 岩浆房
  svg.appendChild(
    el('ellipse', { cx: 0, cy: 1.35, rx: 1.25, ry: 0.48, class: 'fallback-svg__chamber' })
  );

  // 岩浆通道
  const craterY = radialHeight(0, 0, kind, seed, growth);
  svg.appendChild(
    el('path', {
      d: `M 0 0.95 C 0.12 0.3 0.05 ${(-craterY * 0.55).toFixed(3)} 0 ${(-craterY + 0.06).toFixed(3)}`,
      class: 'fallback-svg__conduit',
    })
  );

  // 火山口标记
  svg.appendChild(
    el('circle', {
      cx: 0,
      cy: -craterY,
      r: CRATER_RADIUS * 0.7,
      class: 'fallback-svg__crater',
    })
  );

  // 标注
  const labels = [
    { x: base * 0.62, y: -craterY - 0.34, text: '火山口' },
    { x: base * 0.52, y: 1.35, text: '岩浆房' },
    { x: base * 0.4, y: 2.05, text: '岩层' },
    { x: base * 0.5, y: -craterY * 0.5, text: '岩浆通道' },
  ];
  for (const l of labels) {
    const text = el('text', { x: l.x, y: l.y, class: 'fallback-svg__label' });
    text.textContent = l.text;
    svg.appendChild(text);
  }

  return svg;
}

/**
 * 把降级剖面插入容器，并附上说明。
 * @param {HTMLElement} container
 * @param {{kind?:string, growth?:number, seed?:number, reason?:string|null}} [opts]
 * @returns {{element:HTMLElement, update:(kind:string, growth:number)=>void}}
 */
export function mountFallback(container, opts = {}) {
  const { kind = 'strato', growth = 1, seed = DEFAULT_SEED, reason = null } = opts;

  const wrap = document.createElement('div');
  wrap.className = 'fallback';
  wrap.dataset.fallback = 'true';
  wrap.dataset.sceneState = 'error';

  const head = document.createElement('p');
  head.className = 'fallback__head';
  head.textContent = '此设备未能启动 3D；以下静态剖面与文字说明仍可完整使用。';
  wrap.appendChild(head);

  if (reason) {
    const why = document.createElement('p');
    why.className = 'fallback__reason';
    why.textContent = `原因：${reason}`;
    wrap.appendChild(why);
  }

  const holder = document.createElement('div');
  holder.className = 'fallback__figure';
  wrap.appendChild(holder);

  const note = document.createElement('p');
  note.className = 'fallback__note';
  note.textContent = '结构示意，非实测比例。';
  wrap.appendChild(note);

  container.appendChild(wrap);

  const update = (nextKind, nextGrowth) => {
    holder.textContent = '';
    holder.appendChild(buildFallbackSvg({ kind: nextKind, growth: nextGrowth, seed }));
  };
  update(kind, growth);

  return { element: wrap, update };
}
