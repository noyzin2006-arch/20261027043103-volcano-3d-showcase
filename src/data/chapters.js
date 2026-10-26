/**
 * 章节文案与结构 —— 固定叙事内容
 * 依据：handoff/plans/TASK-001.md §4.1 信息架构 / §4.3 用户旅程 / §4.4 章节叙事与固定主文案
 *
 * 规则：
 *   1. 硬数字一律不在此重复，步骤与影响项只引用 facts.js 里的 fact.id。
 *   2. 文案不得暗示所有火山都会出现所有影响，也不得暗示每座火山必经完全相同的四个时间阶段。
 */

/** 形成章节的三种地质环境（顺序即页面上的顺序）。 */
export const FORMATION_CONTEXTS = Object.freeze(['divergent', 'subduction', 'hotspot']);

/** 形成章节的四步（index 0..3，与规划案 §4.4 固定文案一致）。 */
export const FORMATION_STEPS = Object.freeze(
  [
    {
      index: 0,
      label: '01',
      title: '岩层深处具备条件',
      body: '在岩层深处，温度、压力与物质条件同时具备，才有可能产生岩浆。此处还看不见火山——它只是地下的物理前提。',
      factIds: ['a-three-settings'],
    },
    {
      index: 1,
      label: '02',
      title: '岩石部分熔融，产生岩浆',
      body: '并非整块地幔都融化，只有部分区域发生部分熔融，形成含挥发分的岩浆。洋中脊靠减压熔融，俯冲带靠带入的水降低熔点。',
      factIds: ['a-volatile-release', 'a-seafloor-magma-temp'],
    },
    {
      index: 2,
      label: '03',
      title: '岩浆向上运移并储集',
      body: '岩浆在压力和浮力等作用下向上运移、储集于岩浆房；挥发分随压力降低而析出，为喷发做准备。',
      factIds: ['a-volatile-release', 'd-gas-thrust'],
    },
    {
      index: 3,
      label: '04',
      title: '喷出与堆积成山',
      body: '熔岩与碎屑物反复喷出、层层堆积，最终形成不同形态的火山体。不同火山经历的时序并不完全相同。',
      factIds: ['b-shield', 'b-strato', 'b-cinder'],
    },
  ].map(Object.freeze)
);

/** 三种典型山形。 */
export const VOLCANO_TYPES = Object.freeze(['shield', 'strato', 'cinder']);

/** 影响章节的五种现象。 */
export const IMPACTS = Object.freeze(['column', 'aviation', 'climate', 'hazard', 'benefit']);

/** 山麓危险的三类（互斥，同一次喷发未必同时发生）。 */
export const HAZARD_KINDS = Object.freeze(['pyroclastic', 'lahar', 'lava']);

/** 三种地质环境的中文文案。 */
export const CONTEXT_META = Object.freeze({
  divergent: Object.freeze({
    label: '洋中脊 · 发散边界',
    title: '板块分开，深部物质减压后部分熔融',
    body: '板块分离处岩浆上涌，生成新的洋壳。冰岛就是大西洋中脊扩展的产物——海底火山持续喷发、不断堆高，最终露出海平面。',
    factIds: ['a-three-settings', 'a-land-count', 'a-seafloor-count'],
  }),
  subduction: Object.freeze({
    label: '俯冲带 · 汇聚边界',
    title: '洋板块下沉，带入的水促进上覆地幔部分熔融',
    body: '俯冲到地壳之下的板块把含水的岩石与沉积物带向深处，在高压下促成部分熔融。环太平洋火山带上的多数火山属于这一类。',
    factIds: ['a-three-settings', 'a-ring-of-fire'],
  }),
  hotspot: Object.freeze({
    label: '热点 · 板块内部',
    title: '地幔热柱供应熔融物质，形成火山链',
    body: '热点是地幔内热物质集中的位置，它持续加热上覆板块直至岩浆上涌。板块在热点上移动，便留下年龄递变的火山链——夏威夷群岛是典型。',
    factIds: ['a-three-settings', 'a-tengchong'],
  }),
});

/** 三种山形的中文文案。 */
export const VOLCANO_TYPE_META = Object.freeze({
  shield: Object.freeze({
    label: '盾状火山',
    title: '坡缓 · 基性熔岩流动性强',
    body: '流动性好的玄武岩熔岩一层层铺开，形成宽阔低矮的山体。夏威夷冒纳罗亚与基拉韦亚都属此类。',
    factIds: ['b-shield', 'b-maunaloa'],
  }),
  strato: Object.freeze({
    label: '复式（层状）火山',
    title: '熔岩与火山灰互层 · 锥体较陡',
    body: '熔岩与火山灰层层堆积，把锥体垒得又陡又高。美国雷尼尔山是著名的复式火山。',
    factIds: ['b-strato', 'b-lava-temp'],
  }),
  cinder: Object.freeze({
    label: '火山渣锥',
    title: '小型陡锥 · 碗状顶口',
    body: '最简单的一类火山：由火山口喷出的火山灰与熔岩堆积而成，坡面松散，顶端留有碗状火山口。',
    factIds: ['b-cinder'],
  }),
});

/** 五种影响的中文文案。 */
export const IMPACT_META = Object.freeze({
  column: Object.freeze({
    label: '喷发柱',
    title: '从火口到平流层的三段推力',
    body: '火口近处靠气体膨胀把物质推出；中段靠卷入空气的热对流托举上升；上部达到中性浮力后被平流层风拉成伞状。若柱体过密撑不住，就会塌陷成火山碎屑流。',
    factIds: ['d-gas-thrust', 'd-column-range', 'd-height-scaling', 'd-pdf-speed'],
  }),
  aviation: Object.freeze({
    label: '航空',
    title: '火山灰是「引擎杀手」',
    body: '火山灰是尖锐的岩石、矿物与玻璃颗粒，进入发动机高温区会熔融再凝固、堵塞与磨蚀；喷发柱在天气雷达上还常常看不见，容易被误判为普通云。',
    factIds: ['f-ash-composition', 'f-ash-melting', 'f-ash-threshold', 'f-radar-invisible', 'f-vaac'],
  }),
  climate: Object.freeze({
    label: '气候',
    title: '硫酸盐气幕与水蒸气：两种不同的机制',
    body: 'SO₂ 在平流层形成硫酸盐气溶胶，反射阳光，可能造成短期降温；水蒸气的作用路径不同。汤加 2022 年的气候影响主要由水蒸气主导。',
    factIds: ['e-pinatubo-so2', 'e-pinatubo-cooling', 'e-tonga-vapor', 'e-tonga-climate'],
  }),
  hazard: Object.freeze({
    label: '山麓危险',
    title: '碎屑流、泥流与熔岩：三条不同的路径',
    body: '火山碎屑流是炽热而快速的密度流；火山泥流可由融雪融冰形成；熔岩虽然流动相对缓慢，仍会破坏建筑。同一次喷发未必同时发生这三种现象。',
    factIds: ['d-pdf-speed', 'g-lahar-armero', 'g-lap-2021'],
  }),
  benefit: Object.freeze({
    label: '火山的馈赠',
    title: '肥沃土壤、地热与热液生态',
    body: '火山灰风化形成肥沃土壤，地下热量可用于发电，深海热液喷口更支撑起不依赖阳光的化能合成生态系统——那里可能是生命起源地。',
    factIds: ['g-fertile-soil', 'g-geothermal', 'g-hotspring-1977'],
  }),
});

/** 山麓三类危险的中文文案。 */
export const HAZARD_KIND_META = Object.freeze({
  pyroclastic: Object.freeze({
    label: '高温碎屑流',
    body: '炽热快速的密度流沿山坡奔下，温度可达约 700 °C，对所经之处的毁灭性极强。',
    factIds: ['d-pdf-speed'],
  }),
  lahar: Object.freeze({
    label: '融雪泥流',
    body: '融化的冰雪与火山碎屑混合成泥流，沿沟谷冲下。1985 年内华达德尔鲁伊的泥流冲毁了阿梅罗镇。',
    factIds: ['g-lahar-armero'],
  }),
  lava: Object.freeze({
    label: '缓行熔岩',
    body: '熔岩流速相对缓慢，却会持续掩埋建筑与道路。2021 年拉帕尔马持续 85 天的熔岩毁坏 3000 余栋建筑。',
    factIds: ['g-lap-2021'],
  }),
});

/** 首页标题区与图注文案。 */
export const PAGE_COPY = Object.freeze({
  title: '火山｜地球内部的力量',
  eyebrow: '互动地球科学',
  chapters: {
    formation: '01 火山如何形成',
    impact: '02 喷发如何影响世界',
  },
  stageCaption: '科学结构示意 · 非实测比例 · 图像不代表任何一座真实火山的尺度',
  legendTitle: '图例',
  dossierTitle: '喷发强度与数据来源',
  footerTitle: '来源与限制',
});

/** 展章默认初始状态（与规划案 §4.1 一致：形成默认俯冲带→部分熔融→层状火山→剖面）。 */
export const DEFAULT_FORMATION = Object.freeze({
  context: 'subduction',
  step: 1,
  volcanoType: 'strato',
});

/** 影响章节默认项（规划案：影响默认「喷发柱」）。 */
export const DEFAULT_IMPACT = Object.freeze({
  impact: 'column',
  hazardKind: 'pyroclastic',
});
