/**
 * 语义 DOM 外壳 —— 构建 + 状态渲染
 * 依据：handoff/plans/TASK-001.md §3.2 组件规格表 C01—C11 / §4 体验设计
 *
 * 设计要点：
 *   1. DOM 只构建一次，状态变化只改文本、属性与可见性 —— 不重建节点，焦点不丢。
 *   2. 每个组件都具备「空 / 加载 / 错误 / 成功」四态，通过 data-state 暴露给样式层。
 *   3. 所有交互元素用原生 button，aria 属性齐全；颜色不是唯一信息载体。
 */

import { FACTS, VEI_ROWS, VEI_FACT_IDS, SOURCES, getFacts } from '../data/facts.js';
import {
  CONTEXT_META,
  FORMATION_STEPS,
  VOLCANO_TYPE_META,
  IMPACT_META,
  HAZARD_KIND_META,
  PAGE_COPY,
} from '../data/chapters.js';
import { iconNode } from './icons.js';

/** 创建元素的小工具。props 里 class/dataset/aria/attrs/text 都支持。 */
function h(tag, props = {}, children = []) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (v === null || v === undefined || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k === 'text') el.textContent = v;
    else if (k === 'html') el.innerHTML = v;
    else if (k === 'dataset') Object.assign(el.dataset, v);
    else if (k === 'attrs') for (const [ak, av] of Object.entries(v)) el.setAttribute(ak, av);
    else el.setAttribute(k, v === true ? '' : String(v));
  }
  for (const c of [].concat(children)) {
    if (c === null || c === undefined || c === false) continue;
    el.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
  }
  return el;
}

/** 图标按钮：原生 button + aria-label，44×44 由样式保证。 */
function iconButton({ icon, label, dataset = {}, pressed = null, describedBy = null }) {
  const btn = h('button', {
    class: 'icon-btn',
    type: 'button',
    'aria-label': label,
    dataset,
    attrs: pressed === null ? {} : { 'aria-pressed': String(pressed) },
  });
  btn.appendChild(iconNode(icon, { size: 'md' }));
  if (describedBy) btn.setAttribute('aria-describedby', describedBy);
  return btn;
}

/** 四态条：空 / 加载 / 错误 / 成功。 */
function stateLine(kind, text) {
  const map = {
    empty: { icon: 'info', tone: 'info' },
    loading: { icon: 'layers', tone: 'info' },
    error: { icon: 'error', tone: 'danger' },
    success: { icon: 'success', tone: 'success' },
    warning: { icon: 'warning', tone: 'warning' },
  };
  const cfg = map[kind] ?? map.info;
  const box = h('p', { class: `state-line state-line--${cfg.tone}`, attrs: { role: 'status' } });
  box.appendChild(iconNode(cfg.icon, { size: 'sm' }));
  box.appendChild(document.createTextNode(text));
  return box;
}

/**
 * 由事实 id 推出策展简报的章节字母（如 "D、E、F"）。
 * 事实 id 的首字母只是命名习惯，真正的章节号存在 fact.section 里。
 */
function impactSectionLetters(factIds = []) {
  const letters = [...new Set(getFacts(factIds).map((f) => f.section))].sort();
  return letters.length ? letters.join('、') : 'A—G';
}

/**
 * 构建并返回外壳控制器。
 * @param {HTMLElement} root #app 容器
 */
export function createShell(root) {
  const slot = (name) => root.querySelector(`[data-slot="${name}"]`);

  const slots = {
    status: slot('status'),
    canvas: slot('canvas'),
    toolbar: slot('toolbar'),
    legend: slot('legend'),
    panel: slot('panel'),
    dossier: slot('dossier'),
    footer: slot('footer'),
  };

  // ---------------------------------------------------------------- 舞台状态条 C10
  const statusBox = slots.status;
  statusBox.dataset.state = 'loading';

  // ---------------------------------------------------------------- 视角工具组 C03
  const toolbar = slots.toolbar;
  const viewButtons = new Map();
  const VIEW_TOOLS = [
    { key: 'cutaway', icon: 'cutaway', label: '剖面视图', view: 'cutaway' },
    { key: 'whole', icon: 'whole', label: '完整视图', view: 'whole' },
    { key: 'top', icon: 'top', label: '俯瞰视图', view: 'top' },
    { key: 'left', icon: 'rotateLeft', label: '向左旋转视角' },
    { key: 'right', icon: 'rotateRight', label: '向右旋转视角' },
    { key: 'in', icon: 'zoomIn', label: '放大' },
    { key: 'out', icon: 'zoomOut', label: '缩小' },
    { key: 'reset', icon: 'reset', label: '重置视角' },
  ];
  for (const t of VIEW_TOOLS) {
    const btn = iconButton({
      icon: t.icon,
      label: t.label,
      dataset: { view: t.view ?? `tool-${t.key}` },
    });
    toolbar.appendChild(btn);
    if (t.view) viewButtons.set(t.view, btn);
  }

  // ---------------------------------------------------------------- 图例 C11
  const legend = slots.legend;
  legend.appendChild(h('h3', { class: 'legend__title', text: PAGE_COPY.legendTitle }));
  const legendList = h('ul', { class: 'legend__list' });
  legend.appendChild(legendList);
  // 说明行只创建一次：每次状态变化都重建图例的话，追加说明会一行行堆起来
  const legendNote = h('p', { class: 'legend__note', text: '图例为结构示意，比例不代表真实火山高宽与厚度。' });
  legend.appendChild(legendNote);

  // ---------------------------------------------------------------- 面板
  const panel = slots.panel;

  // --- 形成章节 ---
  const formation = h('section', {
    class: 'card card--formation',
    attrs: { 'aria-labelledby': 'formation-heading' },
  });
  formation.appendChild(h('h2', { class: 'card__title', text: PAGE_COPY.chapters.formation, id: 'formation-heading' }));
  formation.appendChild(
    h('p', { class: 'card__lead', text: '岩浆为什么能从地下到达地表？先看它在哪里生成。' })
  );

  // C05 地质环境
  const ctxGroup = h('div', { class: 'field' });
  ctxGroup.appendChild(h('h3', { class: 'field__label', text: '板块环境', id: 'ctx-label' }));
  const ctxButtons = h('div', { class: 'segmented', attrs: { role: 'group', 'aria-labelledby': 'ctx-label' } });
  const ctxMap = new Map();
  for (const key of Object.keys(CONTEXT_META)) {
    const meta = CONTEXT_META[key];
    const btn = h('button', {
      class: 'segmented__btn',
      type: 'button',
      text: meta.label,
      dataset: { context: key },
      attrs: { 'aria-pressed': 'false' },
    });
    ctxButtons.appendChild(btn);
    ctxMap.set(key, btn);
  }
  ctxGroup.appendChild(ctxButtons);
  formation.appendChild(ctxGroup);

  // C04 四步
  const stepGroup = h('div', { class: 'field' });
  stepGroup.appendChild(h('h3', { class: 'field__label', text: '四步建造', id: 'step-label' }));
  const stepButtons = h('div', { class: 'steps', attrs: { role: 'group', 'aria-labelledby': 'step-label' } });
  const stepMap = new Map();
  for (const s of FORMATION_STEPS) {
    const btn = h('button', {
      class: 'step-btn',
      type: 'button',
      dataset: { step: String(s.index) },
      attrs: { 'aria-pressed': 'false', 'aria-controls': 'chapter-explanation' },
    });
    btn.appendChild(h('span', { class: 'step-btn__index num', text: s.label }));
    btn.appendChild(h('span', { class: 'step-btn__title', text: s.title }));
    stepButtons.appendChild(btn);
    stepMap.set(s.index, btn);
  }
  stepGroup.appendChild(stepButtons);
  formation.appendChild(stepGroup);

  // C05 三种形态
  const typeGroup = h('div', { class: 'field' });
  typeGroup.appendChild(h('h3', { class: 'field__label', text: '火山形态', id: 'type-label' }));
  const typeButtons = h('div', { class: 'segmented', attrs: { role: 'group', 'aria-labelledby': 'type-label' } });
  const typeMap = new Map();
  for (const key of Object.keys(VOLCANO_TYPE_META)) {
    const meta = VOLCANO_TYPE_META[key];
    const btn = h('button', {
      class: 'segmented__btn',
      type: 'button',
      text: meta.label,
      dataset: { volcano: key },
      attrs: { 'aria-pressed': 'false' },
    });
    typeButtons.appendChild(btn);
    typeMap.set(key, btn);
  }
  typeGroup.appendChild(typeButtons);
  formation.appendChild(typeGroup);

  // 解释区（C04 / C05 的 aria-controls 目标）
  const explain = h('div', {
    class: 'explain',
    id: 'chapter-explanation',
    attrs: { 'aria-live': 'polite' },
  });
  formation.appendChild(explain);

  panel.appendChild(formation);

  // --- 影响章节 ---
  const impact = h('section', {
    class: 'card card--impact',
    attrs: { 'aria-labelledby': 'impact-heading' },
  });
  impact.appendChild(h('h2', { class: 'card__title', text: PAGE_COPY.chapters.impact, id: 'impact-heading' }));
  impact.appendChild(
    h('p', { class: 'card__lead', text: '一次喷发会把物质和影响送到多远？先从喷发柱看起。' })
  );

  // C06 影响场景
  const impactCards = h('div', { class: 'cards', attrs: { role: 'group', 'aria-label': '影响场景' } });
  const impactMap = new Map();
  for (const key of Object.keys(IMPACT_META)) {
    const meta = IMPACT_META[key];
    const btn = h('button', {
      class: 'impact-card',
      type: 'button',
      dataset: { impact: key },
      attrs: { 'aria-pressed': 'false', 'aria-describedby': `impact-summary-${key}` },
    });
    btn.appendChild(h('span', { class: 'impact-card__title', text: meta.label }));
    btn.appendChild(h('span', { class: 'impact-card__summary', id: `impact-summary-${key}`, text: meta.title }));
    impactCards.appendChild(btn);
    impactMap.set(key, btn);
  }
  impact.appendChild(impactCards);

  // 山麓三子类（共享 C05 样式）
  const hazardWrap = h('div', { class: 'field field--hazard' });
  hazardWrap.appendChild(h('h3', { class: 'field__label', text: '山麓危险的三条路径', id: 'hazard-label' }));
  const hazardButtons = h('div', { class: 'segmented', attrs: { role: 'group', 'aria-labelledby': 'hazard-label' } });
  const hazardMap = new Map();
  for (const key of Object.keys(HAZARD_KIND_META)) {
    const meta = HAZARD_KIND_META[key];
    const btn = h('button', {
      class: 'segmented__btn',
      type: 'button',
      text: meta.label,
      dataset: { hazard: key },
      attrs: { 'aria-pressed': 'false' },
    });
    hazardButtons.appendChild(btn);
    hazardMap.set(key, btn);
  }
  hazardWrap.appendChild(hazardButtons);
  impact.appendChild(hazardWrap);

  // C07 喷发控制
  const eruptionBox = h('div', { class: 'eruption' });
  const btnStart = h('button', {
    class: 'btn btn--primary',
    type: 'button',
    text: '启动喷发',
    dataset: { eruption: 'start' },
  });
  const btnPause = h('button', {
    class: 'btn btn--ghost',
    type: 'button',
    text: '暂停',
    dataset: { eruption: 'pause' },
    attrs: { 'aria-disabled': 'true' },
  });
  const btnReplay = h('button', {
    class: 'btn btn--ghost',
    type: 'button',
    text: '重播',
    dataset: { eruption: 'replay' },
  });
  const eruptionBtns = h('div', { class: 'eruption__buttons' });
  eruptionBtns.append(btnStart, btnPause, btnReplay);

  const progress = h('div', { class: 'eruption__progress' });
  const progressTrack = h('div', {
    class: 'progress',
    attrs: { role: 'progressbar', 'aria-valuemin': '0', 'aria-valuemax': '12', 'aria-valuenow': '0', 'aria-label': '喷发演示进度' },
  });
  const progressFill = h('div', { class: 'progress__fill' });
  progressTrack.appendChild(progressFill);
  const progressText = h('span', { class: 'progress__text num', text: '0 / 12 秒' });
  const progressWrap = h('div', { class: 'eruption__progress-wrap' });
  progressWrap.append(progressTrack, progressText);
  progress.appendChild(progressWrap);

  const eruptionNote = h('p', { class: 'eruption__note', text: '动画为 12 秒机制演示，时间不代表真实喷发时长。' });
  eruptionBox.append(eruptionBtns, progress, eruptionNote);
  impact.appendChild(eruptionBox);

  const impactExplain = h('div', {
    class: 'explain',
    id: 'impact-explanation',
    attrs: { 'aria-live': 'polite' },
  });
  impact.appendChild(impactExplain);

  panel.appendChild(impact);

  // ---------------------------------------------------------------- 资料区 C08 / C09
  const dossier = slots.dossier;

  const veiSection = h('section', { class: 'card card--vei', attrs: { 'aria-labelledby': 'vei-heading' } });
  veiSection.appendChild(h('h2', { class: 'card__title', text: '喷发强度：VEI 量表', id: 'vei-heading' }));
  veiSection.appendChild(
    h('p', {
      class: 'card__lead',
      text: 'VEI 是 0–8 的对数级标尺，衡量的是爆发威力，不是危害等级。表中区间按策展资料原样呈现。',
    })
  );
  const veiList = h('div', { class: 'vei' });
  const veiRows = new Map();
  for (const row of VEI_ROWS) {
    const wrap = h('div', { class: 'vei__item' });
    const btn = h('button', {
      class: 'vei__row',
      type: 'button',
      dataset: { vei: String(row.level) },
      attrs: { 'aria-expanded': 'false', 'aria-controls': `vei-detail-${row.level}` },
    });
    btn.appendChild(h('span', { class: 'vei__level num', text: `VEI ${row.level}` }));
    btn.appendChild(
      h('span', { class: 'vei__metric', attrs: { 'data-label': '喷发柱高度' } }, [
        h('span', { class: 'vei__metric-value num', text: row.plumeText ?? '简报未列' }),
      ])
    );
    btn.appendChild(
      h('span', { class: 'vei__metric', attrs: { 'data-label': '喷出物体积' } }, [
        h('span', { class: 'vei__metric-value num', text: row.volumeText ?? '简报未列' }),
      ])
    );
    btn.appendChild(h('span', { class: 'vei__event', attrs: { 'data-label': '代表事件' }, text: row.eventText }));

    const detail = h('div', { class: 'vei__detail', id: `vei-detail-${row.level}`, hidden: true });
    for (const f of getFacts(VEI_FACT_IDS[row.level] ?? [])) {
      detail.appendChild(factRow(f));
    }
    wrap.append(btn, detail);
    veiList.appendChild(wrap);
    veiRows.set(row.level, { btn, detail });
  }
  veiSection.appendChild(veiList);
  dossier.appendChild(veiSection);

  const sourceSection = h('section', { class: 'card card--sources', attrs: { 'aria-labelledby': 'source-heading' } });
  sourceSection.appendChild(h('h2', { class: 'card__title', text: '来源与定义', id: 'source-heading' }));
  const sourceList = h('ul', { class: 'sources' });
  for (const s of SOURCES) {
    const li = h('li', { class: 'sources__item' });
    if (s.url) {
      const a = h('a', {
        class: 'sources__link',
        text: s.label,
        href: s.url,
        attrs: { rel: 'noopener noreferrer', target: '_blank', 'data-citation': s.id },
      });
      li.appendChild(a);
    } else {
      li.appendChild(h('span', { class: 'sources__link sources__link--plain', text: s.label }));
    }
    li.appendChild(h('p', { class: 'sources__note', text: s.note }));
    sourceList.appendChild(li);
  }
  sourceSection.appendChild(sourceList);
  sourceSection.appendChild(
    h('p', {
      class: 'card__note',
      text: '本页所有数值来自上述策展简报汇编口径，未引入未经核实的外部统计；网页正文中的图形均为结构示意，不代表任何真实火山的尺度、速度或风险半径。',
    })
  );
  dossier.appendChild(sourceSection);

  // ---------------------------------------------------------------- 页脚
  const footer = slots.footer;
  footer.appendChild(h('h2', { class: 'site-footer__title', text: PAGE_COPY.footerTitle }));
  footer.appendChild(
    h('p', {
      text: '策展简报 TASK-001（2026-10-27 复核）为本页唯一数值真源。模型由代码程序化生成，不依赖任何外部模型、贴图或字体资源。',
    })
  );

  // ---------------------------------------------------------------- 事实行工具
  function factRow(f) {
    const row = h('div', { class: 'fact', dataset: { factId: f.id } });
    row.appendChild(h('p', { class: 'fact__value num', text: f.valueText }));
    row.appendChild(h('p', { class: 'fact__title', text: f.title }));
    row.appendChild(h('p', { class: 'fact__explanation', text: f.explanation }));
    row.appendChild(h('p', { class: 'fact__caveat', text: `注意：${f.caveat}` }));
    const cite = h('p', { class: 'fact__source', text: `来源：${f.sourceLabel}｜${f.sourceYearOrPeriod}` });
    row.appendChild(cite);
    return row;
  }

  // ---------------------------------------------------------------- 渲染
  let lastState = null;

  function renderChapterNav(state) {
    for (const btn of root.querySelectorAll('[data-chapter]')) {
      const active = btn.dataset.chapter === state.chapter;
      btn.setAttribute('aria-current', active ? 'page' : 'false');
      btn.classList.toggle('is-active', active);
    }
  }

  function renderStatus(state) {
    const map = {
      loading: { kind: 'loading', text: '在本机生成火山几何，请稍候…' },
      ready: { kind: 'success', text: '3D 已就绪，可拖动旋转。' },
      error: { kind: 'error', text: `图形加速不可用：${state.sceneReason ?? '未知原因'}。已启用可操作的静态剖面。` },
      cancelled: { kind: 'warning', text: '已取消 3D 生成，改用文字与剖面图解。' },
    };
    const cfg = map[state.scene] ?? map.loading;
    statusBox.dataset.state = state.scene;
    statusBox.textContent = '';
    const line = stateLine(cfg.kind, cfg.text);
    line.classList.add('state-line--inline');
    statusBox.appendChild(line);
  }

  function renderToolbar(state) {
    for (const [view, btn] of viewButtons) {
      const active = state.view === view;
      btn.setAttribute('aria-pressed', String(active));
      btn.classList.toggle('is-active', active);
    }
    const err = state.scene === 'error' || state.scene === 'cancelled';
    for (const btn of toolbar.querySelectorAll('button')) {
      btn.toggleAttribute('aria-disabled', err);
      btn.disabled = false; // aria-disabled 而非 disabled，保持可聚焦与可读
    }
  }

  function renderLegend(state) {
    legendList.textContent = '';
    const items =
      state.chapter === 'formation'
        ? [
            ['岩层与地幔', 'var(--scene-rock)'],
            ['火山灰层', 'var(--scene-strata)'],
            ['岩浆与热流', 'var(--scene-magma)'],
            ['板块', 'var(--scene-plate)'],
            ['植被与土壤', 'var(--scene-soil)'],
          ]
        : [
            ['火山灰', 'var(--scene-ash)'],
            ['岩浆与热流', 'var(--scene-magma)'],
            ['平流层气溶胶', 'var(--scene-aerosol)'],
            ['海洋与水', 'var(--scene-water)'],
            ['岩层与地幔', 'var(--scene-rock)'],
          ];
    for (const [label, color] of items) {
      const li = h('li', { class: 'legend__item' });
      const swatch = h('span', { class: 'legend__swatch', attrs: { 'aria-hidden': 'true' } });
      swatch.style.background = color;
      li.append(swatch, h('span', { class: 'legend__label', text: label }));
      legendList.appendChild(li);
    }
  }

  function renderFormation(state) {
    for (const [key, btn] of ctxMap) {
      const active = state.context === key;
      btn.setAttribute('aria-pressed', String(active));
      btn.classList.toggle('is-active', active);
    }
    for (const [idx, btn] of stepMap) {
      const active = state.step === idx;
      btn.setAttribute('aria-pressed', String(active));
      btn.classList.toggle('is-active', active);
    }
    for (const [key, btn] of typeMap) {
      const active = state.volcanoType === key;
      btn.setAttribute('aria-pressed', String(active));
      btn.classList.toggle('is-active', active);
    }

    const ctx = CONTEXT_META[state.context];
    const step = FORMATION_STEPS[state.step];
    const type = VOLCANO_TYPE_META[state.volcanoType];

    explain.textContent = '';
    explain.appendChild(h('p', { class: 'explain__question', text: `第 ${step.label} 步｜${step.title}` }));
    explain.appendChild(h('p', { class: 'explain__body', text: step.body }));
    explain.appendChild(h('p', { class: 'explain__body', text: `${ctx.label}：${ctx.body}` }));
    explain.appendChild(h('p', { class: 'explain__body', text: `${type.label}：${type.body}` }));

    const facts = getFacts([...ctx.factIds, ...type.factIds]);
    if (facts.length) {
      const list = h('ul', { class: 'explain__facts' });
      for (const f of facts.slice(0, 3)) {
        const li = h('li', { class: 'explain__fact' });
        li.appendChild(h('span', { class: 'explain__fact-value num', text: f.valueText }));
        li.appendChild(h('span', { class: 'explain__fact-title', text: f.title }));
        list.appendChild(li);
      }
      explain.appendChild(list);
    }
    explain.appendChild(
      h('p', { class: 'explain__source', text: `依据：${ctx.label} / ${type.label} —— 本项目策展简报 TASK-001（2026-10-27 复核）` })
    );
  }

  function renderImpact(state) {
    for (const [key, btn] of impactMap) {
      const active = state.impact === key;
      btn.setAttribute('aria-pressed', String(active));
      btn.classList.toggle('is-active', active);
    }
    hazardWrap.hidden = state.impact !== 'hazard';
    for (const [key, btn] of hazardMap) {
      const active = state.hazardKind === key;
      btn.setAttribute('aria-pressed', String(active));
      btn.classList.toggle('is-active', active);
    }

    const meta = IMPACT_META[state.impact];
    const hazardMeta = HAZARD_KIND_META[state.hazardKind];

    impactExplain.textContent = '';
    impactExplain.appendChild(h('p', { class: 'explain__question', text: meta.label }));
    impactExplain.appendChild(h('p', { class: 'explain__body', text: meta.body }));
    if (state.impact === 'hazard') {
      impactExplain.appendChild(
        h('p', { class: 'explain__body', text: `${hazardMeta.label}：${hazardMeta.body}` })
      );
    }

    const facts = getFacts(meta.factIds);
    if (facts.length) {
      const list = h('ul', { class: 'explain__facts' });
      for (const f of facts.slice(0, 3)) {
        const li = h('li', { class: 'explain__fact' });
        li.appendChild(h('span', { class: 'explain__fact-value num', text: f.valueText }));
        li.appendChild(h('span', { class: 'explain__fact-title', text: f.title }));
        list.appendChild(li);
      }
      impactExplain.appendChild(list);
    }
    impactExplain.appendChild(
      h('p', {
        class: 'explain__source',
        text: `依据：本项目策展简报 TASK-001 §${impactSectionLetters(meta.factIds)}（2026-10-27 复核）`,
      })
    );
  }

  function renderEruption(state) {
    const running = state.eruption === 'running';
    const paused = state.eruption === 'paused';
    const finished = state.eruption === 'finished';

    btnStart.textContent = running ? '喷发进行中' : finished ? '重新启动喷发' : '启动喷发';
    btnStart.setAttribute('aria-disabled', String(running));
    btnPause.setAttribute('aria-disabled', String(!running));
    btnPause.disabled = false;
    btnReplay.setAttribute('aria-disabled', String(running));

    const seconds = Math.round(state.eruptionProgress * 12);
    progressFill.style.transform = `scaleX(${state.eruptionProgress})`;
    progressTrack.setAttribute('aria-valuenow', String(seconds));
    progressText.textContent = `${seconds} / 12 秒`;

    const note =
      running
        ? '正在演示：气体推力 → 对流托举 → 中性浮力伞顶。'
        : paused
          ? '喷发已暂停，可继续或重播。'
          : finished
            ? '演示已完成。切换场景或重播可再看一次。'
            : '动画为 12 秒机制演示，时间不代表真实喷发时长。';
    eruptionNote.textContent = note;
    eruptionBox.dataset.state = state.eruption;
  }

  function renderVei(state) {
    for (const [level, { btn, detail }] of veiRows) {
      const open = btn.getAttribute('aria-expanded') === 'true';
      detail.hidden = !open;
      btn.setAttribute('aria-expanded', String(open));
    }
  }

  /** 渲染整个外壳到指定状态。 */
  function update(state) {
    lastState = state;
    renderChapterNav(state);
    renderStatus(state);
    renderToolbar(state);
    renderLegend(state);

    const isFormation = state.chapter === 'formation';
    formation.hidden = !isFormation;
    impact.hidden = isFormation;
    if (isFormation) renderFormation(state);
    else renderImpact(state);
    renderEruption(state);
    renderVei(state);

    slots.panel.dataset.chapter = state.chapter;
    slots.dossier.dataset.chapter = state.chapter;
  }

  /** 切换某个 VEI 行的展开状态（展开不抢焦点）。 */
  function toggleVei(level) {
    const row = veiRows.get(level);
    if (!row) return;
    const open = row.btn.getAttribute('aria-expanded') === 'true';
    row.btn.setAttribute('aria-expanded', String(!open));
    row.detail.hidden = open;
  }

  return {
    update,
    toggleVei,
    get state() {
      return lastState;
    },
    refs: {
      statusBox,
      toolbar,
      legend,
      panel,
      dossier,
      footer,
      formation,
      impact,
      explain,
      impactExplain,
      btnStart,
      btnPause,
      btnReplay,
      ctxMap,
      stepMap,
      typeMap,
      impactMap,
      hazardMap,
      veiRows,
    },
    slots,
  };
}
