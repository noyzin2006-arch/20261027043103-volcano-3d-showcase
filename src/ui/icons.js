/**
 * 图标系统 —— 统一自绘 SVG
 * 依据：handoff/plans/TASK-001.md §3.1「图标：统一自绘 24×24 viewBox inline SVG，
 * stroke-width 1.75、stroke-linecap round、stroke-linejoin round、fill none」
 *
 * 规则：
 *   1. 全部图标走同一套网格与线宽；颜色一律 currentColor。
 *   2. 禁止用 emoji 充当正式界面图标。
 *   3. 路径在本文件内自绘，不引入第三方图标包。
 */

/** 图标路径表（24×24 网格，stroke 绘制）。 */
const PATHS = {
  // 视角
  cutaway: 'M4 19h16M12 19V7M6 19l6-12 6 12',
  whole: 'M4 19h16M7 19 12 5l5 14M9.6 5h4.8',
  top: 'M12 3.2v3M12 17.8v3M3.2 12h3M17.8 12h3M12 6.4a5.6 5.6 0 1 0 0 11.2 5.6 5.6 0 0 0 0-11.2',
  rotateLeft: 'M4.5 12a7.5 7.5 0 1 0 2.2-5.3M4.5 4v5h5',
  rotateRight: 'M19.5 12a7.5 7.5 0 1 1-2.2-5.3M19.5 4v5h-5',
  zoomIn: 'M10.8 4.2a6.6 6.6 0 1 0 0 13.2 6.6 6.6 0 0 0 0-13.2M20 20l-4.7-4.7M10.8 8v6M7.8 11h6',
  zoomOut: 'M10.8 4.2a6.6 6.6 0 1 0 0 13.2 6.6 6.6 0 0 0 0-13.2M20 20l-4.7-4.7M7.8 11h6',
  reset: 'M4.5 4.5h5M4.5 4.5v5M19.5 19.5h-5M19.5 19.5v-5M4.5 4.5l5 5M19.5 19.5l-5-5',
  // 播放
  play: 'M8 5.2v13.6L19 12z',
  pause: 'M9.5 5v14M14.5 5v14',
  replay: 'M20 12a8 8 0 1 1-2.4-5.7M20 3v5h-5',
  // 语义
  info: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18M12 11v6M12 7.4v.7',
  warning: 'M12 4.2 2.6 20h18.8zM12 10v5M12 17.4v.5',
  error: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18M9 9.2l6 5.6M15 9.2l-6 5.6',
  success: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18M8 12.3l2.8 2.8 5.2-5.4',
  layers: 'M12 3.2 3 8.2l9 5 9-5zM3 13.2l9 5 9-5',
  expand: 'M8.5 4.5H4.5v4M15.5 4.5h4v4M19.5 15.5v4h-4M4.5 15.5v4h4',
  layersUp: 'M12 20.8 3 15.8l9-5 9 5zM3 11.8l9 5 9-5',
};

export const ICON_NAMES = Object.freeze(Object.keys(PATHS));

const SIZE_VAR = { sm: 'var(--icon-sm)', md: 'var(--icon-md)', lg: 'var(--icon-lg)' };

/**
 * 生成一个内联 SVG 图标字符串。
 * @param {keyof typeof PATHS} name 图标名
 * @param {{size?: 'sm'|'md'|'lg', className?: string, title?: string}} [opts]
 * @returns {string}
 */
export function icon(name, opts = {}) {
  const d = PATHS[name];
  if (!d) {
    console.warn(`[icons] 未知图标 "${name}"`);
    return '';
  }
  const { size = 'md', className = '', title = '' } = opts;
  const sizePx = SIZE_VAR[size] ?? SIZE_VAR.md;
  const a11y = title
    ? `role="img" aria-label="${title}"`
    : 'aria-hidden="true" focusable="false"';
  return (
    `<svg class="icon ${className}".trim() viewBox="0 0 24 24" width="${sizePx}" height="${sizePx}" ` +
    `fill="none" stroke="currentColor" stroke-width="var(--icon-stroke)" ` +
    `stroke-linecap="round" stroke-linejoin="round" ${a11y}>${title ? `<title>${title}</title>` : ''}` +
    `<path d="${d}"/></svg>`
  );
}

/**
 * 生成一个内联 SVG 图标节点（DOM 元素，不经过 innerHTML 拼接）。
 * @param {keyof typeof PATHS} name
 * @param {{size?: 'sm'|'md'|'lg', className?: string, title?: string}} [opts]
 * @returns {SVGElement}
 */
export function iconNode(name, opts = {}) {
  const d = PATHS[name];
  const wrapper = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  wrapper.setAttribute('viewBox', '0 0 24 24');
  wrapper.setAttribute('fill', 'none');
  wrapper.setAttribute('stroke', 'currentColor');
  wrapper.setAttribute('stroke-width', 'var(--icon-stroke)');
  wrapper.setAttribute('stroke-linecap', 'round');
  wrapper.setAttribute('stroke-linejoin', 'round');
  wrapper.setAttribute('class', `icon ${opts.className ?? ''}`.trim());
  const sizePx = SIZE_VAR[opts.size ?? 'md'] ?? SIZE_VAR.md;
  wrapper.setAttribute('width', sizePx);
  wrapper.setAttribute('height', sizePx);
  if (opts.title) {
    wrapper.setAttribute('role', 'img');
    wrapper.setAttribute('aria-label', opts.title);
    const t = document.createElementNS('http://www.w3.org/2000/svg', 'title');
    t.textContent = opts.title;
    wrapper.appendChild(t);
  } else {
    wrapper.setAttribute('aria-hidden', 'true');
    wrapper.setAttribute('focusable', 'false');
  }
  const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  path.setAttribute('d', d ?? '');
  wrapper.appendChild(path);
  return wrapper;
}
