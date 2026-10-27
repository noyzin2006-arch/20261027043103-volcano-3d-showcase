/**
 * 事实库 —— 本项目唯一数值真源
 * 依据：handoff/plans/TASK-001.md §4.5「事实呈现的唯一真源表」+ handoff/briefs/TASK-001.md §A—G
 *
 * 规则：
 *   1. 数值仅来自策展简报，不得在此处新增、换算、取整或「修正」。
 *   2. 简报未列出的数值一律为 null（界面显示「简报未列」），绝不填 0 或猜测值。
 *   3. sourceUrl 只允许指向已核验的官方页面；无页级证据时为 null，
 *      sourceLabel 写明「本项目策展简报 TASK-001 §X」。
 *   4. 每条事实的 caveat 必须说明该数字「不代表什么」。
 */

/** @typedef {{id:string, section:'A'|'B'|'C'|'D'|'E'|'F'|'G', title:string, valueText:string, explanation:string, sourceLabel:string, sourceUrl:string|null, sourceYearOrPeriod:string, caveat:string}} Fact */

const BRIEF = (section) => `本项目策展简报 TASK-001 §${section}`;

const URL = {
  usgsTypes: 'https://pubs.usgs.gov/gip/volc/types.html',
  usgsVhp: 'https://www.usgs.gov/programs/VHP',
  nasaTonga:
    'https://science.nasa.gov/mission/aura/aura-measurements-of-an-underwater-volcano-eruption/',
  nasaAerosol:
    'https://mynasadata.larc.nasa.gov/phenomenon/volcanic-eruptions/interactives',
  lavaCentre: 'https://lavacentre.is/the-experience/',
};

/** 全部策展事实。冻结，不可变。 */
export const FACTS = Object.freeze(
  [
    // ---------------------------------------------------------------- A 成因与分布
    {
      id: 'a-three-settings',
      section: 'A',
      title: '火山的三种地质环境',
      valueText: '洋中脊 · 俯冲带 · 热点',
      explanation:
        '火山并不只长在同一种地质环境里：板块分离处、岩板俯冲处，以及板块内部的地幔热柱，都会长出火山。',
      sourceLabel: BRIEF('A'),
      sourceUrl: null,
      sourceYearOrPeriod: '策展简报（2026-10-27 复核）',
      caveat: '三类成因是学界公认的分类框架，单个火山常同时受多个过程影响。',
    },
    {
      id: 'a-volatile-release',
      section: 'A',
      title: '喷发为何会发生',
      valueText: '压力骤降 → 挥发分急剧释放',
      explanation:
        '岩浆里的挥发分被周围岩层压住、溶在熔体中；岩浆上升使围压骤降，挥发分急剧析出，驱动喷发。',
      sourceLabel: BRIEF('A'),
      sourceUrl: null,
      sourceYearOrPeriod: '策展简报（2026-10-27 复核）',
      caveat: '这是喷发的触发条件，不代表喷发规模；规模另由 VEI 等指标衡量。',
    },
    {
      id: 'a-active-definition',
      section: 'A',
      title: '活火山的定义',
      valueText: '约 1.17 万年内喷发过',
      explanation:
        '全新世（约 1.17 万年前至今）内喷发过的火山称为活火山；更早之前喷发过的算作死火山。',
      sourceLabel: 'USGS 火山计划（VHP）',
      sourceUrl: URL.usgsVhp,
      sourceYearOrPeriod: '策展简报（2026-10-27 复核）',
      caveat:
        '「休眠火山」没有严格科学定义，可能指定期喷发但暂时平静的火山，也可能指也许永不再喷发的火山。',
    },
    {
      id: 'a-land-count',
      section: 'A',
      title: '全球陆地上的火山',
      valueText: '约 1350 座',
      explanation:
        '全球陆地上约有 1350 座具有喷发潜力的火山，这个数字还不包含大量海底火山。',
      sourceLabel: BRIEF('A'),
      sourceUrl: null,
      sourceYearOrPeriod: '策展简报（2026-10-27 复核）',
      caveat: '「有喷发潜力」不等于「正在喷发」，绝大多数火山处于休眠状态。',
    },
    {
      id: 'a-seafloor-count',
      section: 'A',
      title: '全球海底的火山',
      valueText: '约 2.5 万座',
      explanation: '海底火山数量远超陆地，集中在洋中脊、洋岛与俯冲带——也就是地球内部能量释放的主要通道。',
      sourceLabel: BRIEF('A'),
      sourceUrl: null,
      sourceYearOrPeriod: '策展简报（2026-10-27 复核）',
      caveat: '主要指已知与已编目的数量，海底火山的探测仍不完整。',
    },
    {
      id: 'a-ring-of-fire',
      section: 'A',
      title: '环太平洋火山带',
      valueText: '约 4 万 km',
      explanation:
        '环太平洋火山带全长约 4 万 km，有活火山 450–512 座（不同统计口径），汇集了全球约 75% 的喷发。',
      sourceLabel: BRIEF('A'),
      sourceUrl: null,
      sourceYearOrPeriod: '策展简报（2026-10-27 复核）',
      caveat: '活火山座数随统计年份与口径变化，450 与 512 两个数字都来自公开资料。',
    },
    {
      id: 'a-china-monitored',
      section: 'A',
      title: '中国纳入监测的火山',
      valueText: '6 处',
      explanation:
        '中国已发现全新世火山 10 余处，其中 6 处（含长白山天池等）已建立火山监测台网。',
      sourceLabel: BRIEF('A'),
      sourceUrl: null,
      sourceYearOrPeriod: '策展简报（2026-10-27 复核）',
      caveat: '我国活火山基本处于休眠状态，短期内喷发风险低，但喷发周期长，仍需持续监测。',
    },
    {
      id: 'a-tengchong',
      section: 'A',
      title: '腾冲火山群',
      valueText: '97 座火山锥',
      explanation: '腾冲火山群是中国最年轻的新生代火山群，97 座火山锥呈北斗七星状分布，构成世界罕见的火山链。',
      sourceLabel: BRIEF('A'),
      sourceUrl: null,
      sourceYearOrPeriod: '策展简报（2026-10-27 复核）',
      caveat: '「火山链」的形态与规模属示意，不代表其中每一座都曾喷发。',
    },
    {
      id: 'a-seafloor-magma-temp',
      section: 'A',
      title: '海底岩浆的温度',
      valueText: '900–1400 °C',
      explanation:
        '海底岩浆温度高达 900–1400 °C，远超海水的冷却能力；且岩浆燃烧不依赖氧气，所以海水浇不熄海底火山。',
      sourceLabel: BRIEF('A'),
      sourceUrl: null,
      sourceYearOrPeriod: '策展简报（2026-10-27 复核）',
      caveat: '这是岩浆的区间温度，具体到某次喷发的实际温度会有差异。',
    },

    // ---------------------------------------------------------------- B 火山形态
    {
      id: 'b-shield',
      section: 'B',
      title: '盾状火山',
      valueText: '坡缓 · 玄武质熔岩流动性强',
      explanation:
        '盾状火山宽阔低矮，由流动性好的玄武岩熔岩多次叠出。夏威夷冒纳罗亚与基拉韦亚都属于这一类。',
      sourceLabel: 'USGS 火山形态图鉴',
      sourceUrl: URL.usgsTypes,
      sourceYearOrPeriod: '策展简报（2026-10-27 复核）',
      caveat: '本页模型为结构示意，坡度与比例不表示任何一座真实火山。',
    },
    {
      id: 'b-maunaloa',
      section: 'B',
      title: '冒纳罗亚火山',
      valueText: '约 7.5 万 km³',
      explanation:
        '夏威夷冒纳罗亚火山体积约 7.5 万 km³，从海底向上隆起约 9000 m，是世界最大的活火山。',
      sourceLabel: BRIEF('B'),
      sourceUrl: null,
      sourceYearOrPeriod: '策展简报（2026-10-27 复核）',
      caveat: '体积含海底部分；本页 3D 模型的尺寸是示意单位，不是公里。',
    },
    {
      id: 'b-strato',
      section: 'B',
      title: '复式（层状）火山',
      valueText: '熔岩与火山灰互层',
      explanation:
        '复式火山是锥形，由熔岩与火山灰层层堆积而成，美国雷尼尔山是著名实例。',
      sourceLabel: 'USGS 火山形态图鉴',
      sourceUrl: URL.usgsTypes,
      sourceYearOrPeriod: '策展简报（2026-10-27 复核）',
      caveat: '本页模型为结构示意，层理厚度不按真实比例绘制。',
    },
    {
      id: 'b-lava-temp',
      section: 'B',
      title: '熔岩的温度',
      valueText: '约 1250 °C',
      explanation: '夏威夷火山的熔岩从地下喷出时温度约为 1250 °C，高到足以熔化黄金。',
      sourceLabel: BRIEF('B'),
      sourceUrl: null,
      sourceYearOrPeriod: '策展简报（2026-10-27 复核）',
      caveat: '不同成分的岩浆温度差异很大，此处是夏威夷玄武质熔岩的量级。',
    },
    {
      id: 'b-cinder',
      section: 'B',
      title: '火山渣锥',
      valueText: '小型陡锥 · 碗状顶口',
      explanation:
        '火山渣锥是最简单的一类火山，由火山口喷出的火山灰与熔岩堆积而成，通常在山顶留有碗状火山口。',
      sourceLabel: 'USGS 火山形态图鉴',
      sourceUrl: URL.usgsTypes,
      sourceYearOrPeriod: '策展简报（2026-10-27 复核）',
      caveat: '本页模型为结构示意，火山口深度与颗粒分布均不代表实测。',
    },
    {
      id: 'b-lip',
      section: 'B',
      title: '大火成岩省',
      valueText: '厚度可超过 1.6 km',
      explanation:
        '大火成岩省是由玄武岩等岩石构成的大规模熔岩喷发，熔岩厚度可超过 1.6 km，淹没上千万平方公里。',
      sourceLabel: BRIEF('B'),
      sourceUrl: null,
      sourceYearOrPeriod: '策展简报（2026-10-27 复核）',
      caveat:
        '目前没有活动的大火成岩省；科学家认为此类喷发曾导致地球上一些最严重的物种灭绝事件。它不是三种普通锥形火山之一。',
    },
    {
      id: 'b-tamu',
      section: 'B',
      title: '大塔穆火山',
      valueText: '面积约等于广东+广西两省',
      explanation:
        '西太平洋海底的大塔穆火山被 2013 年的研究确认为地球上最大的单体火山，面积超过冒纳罗亚，可与火星奥林帕斯山比拟。',
      sourceLabel: BRIEF('B'),
      sourceUrl: null,
      sourceYearOrPeriod: '2013 年确认',
      caveat:
        '「最大单体火山」的判定存在地幔柱模型与板块模型之争，成因尚未定论。本页只作为历史记载呈现，不作现代确定性排名。',
    },

    // ---------------------------------------------------------------- C VEI 量表
    {
      id: 'c-vei-log',
      section: 'C',
      title: 'VEI 的对数刻度',
      valueText: '每级约 10 倍',
      explanation:
        'VEI（火山爆发指数）是 0–8 的对数级标尺，从 VEI 2 起，每升一级喷出的物体积约增加 10 倍。',
      sourceLabel: 'USGS 火山计划（VHP）',
      sourceUrl: URL.usgsVhp,
      sourceYearOrPeriod: '策展简报（2026-10-27 复核）',
      caveat: 'VEI 衡量的是爆发威力，不是危害等级，也不是灾害损失的预测指标。',
    },
    {
      id: 'c-vei-frequency',
      section: 'C',
      title: '大喷发有多罕见',
      valueText: 'VEI 7 约每千年 1 次',
      explanation:
        'VEI 0–2 每年数百次，3–4 每年数次至每十年数次，5 约每 10 年 1–2 次，6 约每百年数次，7 约每千年 1 次，8 约每百万年 1–2 次。',
      sourceLabel: BRIEF('C'),
      sourceUrl: null,
      sourceYearOrPeriod: '策展简报（2026-10-27 复核）',
      caveat: '频率是长期统计的平均值，实际间隔可能相差数百年。',
    },
    {
      id: 'c-vei-limits',
      section: 'C',
      title: 'VEI 不衡量危害',
      valueText: 'VEI 0 也可能造成重大损失',
      explanation:
        'VEI 只测爆发威力，不测持续时间与危害。2021 年拉帕尔马火山是 VEI 0 的熔岩喷发，却持续 85 天、毁坏 3000 余栋建筑。',
      sourceLabel: BRIEF('C'),
      sourceUrl: null,
      sourceYearOrPeriod: '2021 年',
      caveat: '不能把 VEI 读数当作「受灾人数」或「影响范围」的预测。',
    },
    {
      id: 'c-vei-overlap',
      section: 'C',
      title: 'VEI 柱高区间的口径',
      valueText: '区间存在重叠',
      explanation:
        '策展资料中的 VEI 喷发柱高度区间彼此有重叠（例如 VEI 3 记 3–15 km、VEI 4 记 10–25 km），这里按原口径如实呈现。',
      sourceLabel: BRIEF('C'),
      sourceUrl: null,
      sourceYearOrPeriod: '策展简报（2026-10-27 复核）',
      caveat: '本页不擅自修改或「修正」这些区间；历史喷发的柱高估算本身也带有误差。',
    },

    // ---------------------------------------------------------------- D 喷发柱结构
    {
      id: 'd-gas-thrust',
      section: 'D',
      title: '气体推力区',
      valueText: '火口上方 1–2 km',
      explanation:
        '喷发柱最底部是气体推力区：气体因压力骤减而膨胀，把物质猛烈抛出火山口，通常位于火口上方一两公里。',
      sourceLabel: BRIEF('D'),
      sourceUrl: null,
      sourceYearOrPeriod: '策展简报（2026-10-27 复核）',
      caveat: '分层是机制模型，实际喷发柱的各段高度会随喷发强度与气象条件变化。',
    },
    {
      id: 'd-column-range',
      section: 'D',
      title: '喷发柱的高度',
      valueText: '2–45 km',
      explanation:
        '实测喷发柱高度常见为 2–45 km；理论上最高可达约 55 km。柱高超过 20–40 km 就会突破对流层顶，把颗粒送进平流层。',
      sourceLabel: BRIEF('D'),
      sourceUrl: null,
      sourceYearOrPeriod: '策展简报（2026-10-27 复核）',
      caveat: '本页动画为 12 秒演示，时间与高度均不代表真实喷发。',
    },
    {
      id: 'd-height-scaling',
      section: 'D',
      title: '柱高与喷发物量',
      valueText: '柱高翻倍 → 物量翻 16 倍',
      explanation:
        '喷发柱高度与质量喷发率的 1/4 次方根成正比，所以柱高翻倍，需要喷出的物质增加到约 16 倍。',
      sourceLabel: BRIEF('D'),
      sourceUrl: null,
      sourceYearOrPeriod: '策展简报（2026-10-27 复核）',
      caveat: '这是比例关系的机制概念，不是某次具体喷发的换算值。',
    },
    {
      id: 'd-pdf-speed',
      section: 'D',
      title: '火山碎屑流',
      valueText: '100–200 km/h · 约 700 °C',
      explanation:
        '喷发柱过密、支撑不住时会塌陷，沿山坡形成炽热快速的火山碎屑流，速度约 100–200 km/h，温度约 700 °C。',
      sourceLabel: BRIEF('D'),
      sourceUrl: null,
      sourceYearOrPeriod: '策展简报（2026-10-27 复核）',
      caveat:
        '另有 320 km/h 的口径。本页动画不按任何单一速度暗示真实位移，画面时长仅为演示。',
    },

    // ---------------------------------------------------------------- E 影响：气候
    {
      id: 'e-pinatubo-column',
      section: 'E',
      title: '皮纳图博 1991 喷发柱',
      valueText: '35–40 km',
      explanation:
        '1991 年菲律宾皮纳图博的喷发柱高达 35–40 km，是有现代仪器监测以来记录最完整的喷发之一。',
      sourceLabel: BRIEF('E'),
      sourceUrl: null,
      sourceYearOrPeriod: '1991 年',
      caveat: '喷发柱高度的不同测法给出略有差异的读数。',
    },
    {
      id: 'e-pinatubo-so2',
      section: 'E',
      title: '皮纳图博注入的二氧化硫',
      valueText: '约 2000 万吨 SO₂',
      explanation: '皮纳图博向平流层注入约 2000 万吨二氧化硫，在那里形成硫酸盐气溶胶层。',
      sourceLabel: 'NASA 气溶胶教学专题',
      sourceUrl: URL.nasaAerosol,
      sourceYearOrPeriod: '1991 年',
      caveat: '这是注入量，不是大气中的残留浓度。',
    },
    {
      id: 'e-pinatubo-cooling',
      section: 'E',
      title: '皮纳图博造成的降温',
      valueText: '约 0.5 °C · 持续约两年',
      explanation:
        '皮纳图博之后，全球平均气温下降约 0.5 °C 并持续约两年，1991–1993 年比温室气体的升温背景趋势更冷。',
      sourceLabel: 'NASA 气溶胶教学专题',
      sourceUrl: URL.nasaAerosol,
      sourceYearOrPeriod: '1991–1993 年',
      caveat: '这是全球平均量级，不是某地某天的气温；本页动画不按比例显示全球降温。',
    },
    {
      id: 'e-pinatubo-aircraft',
      section: 'E',
      title: '皮纳图博与航空',
      valueText: '16 架飞机受损',
      explanation: '皮纳图博喷发后有 16 架飞机被火山灰损伤，其中距离最近的一架在 1000 km 之外。',
      sourceLabel: BRIEF('E'),
      sourceUrl: null,
      sourceYearOrPeriod: '1991 年',
      caveat: '受损数量按公开记录统计；「受损」程度不同，并非都是报废。',
    },
    {
      id: 'e-tambora',
      section: 'E',
      title: '坦博拉 1815 与无夏之年',
      valueText: '约 160 km³ · 均温降 0.4–0.7 °C',
      explanation:
        '1815 年印尼坦博拉喷出约 160 km³ 物质，向平流层注入 1.3 亿吨二氧化硫，形成覆盖全球的硫酸盐气幕。1816 年北半球均温下降 0.4–0.7 °C，全球农作物绝收、饥荒流行，直接死亡约 7.1 万–10 万人。',
      sourceLabel: BRIEF('E'),
      sourceUrl: null,
      sourceYearOrPeriod: '1815 年喷发 / 1816 年气候',
      caveat: '死亡人数为史料估计区间，不同来源给出不同数字。',
    },
    {
      id: 'e-samalas',
      section: 'E',
      title: '萨马拉斯 1257',
      valueText: '约当 2000 颗原子弹',
      explanation:
        '1257 年印尼萨马拉斯喷发的威力相当于约 2000 颗原子弹，其喷发物在南极冰芯中留下化学信号。',
      sourceLabel: BRIEF('E'),
      sourceUrl: null,
      sourceYearOrPeriod: '1257 年',
      caveat:
        '与中世纪欧洲大饥荒的关联被广泛讨论，但因果链条并非已经完全确定。',
    },
    {
      id: 'e-krakatoa',
      section: 'E',
      title: '喀拉喀托 1883 的声响',
      valueText: '约 310 分贝',
      explanation: '1883 年印尼喀拉喀托爆发，产生了有记录以来最响的喷发声。',
      sourceLabel: BRIEF('E'),
      sourceUrl: null,
      sourceYearOrPeriod: '1883 年',
      caveat: '分贝是对数单位，用于说明强度量级，不用于表示「听得更清楚」。',
    },
    {
      id: 'e-tonga-column',
      section: 'E',
      title: '汤加 2022 喷发柱',
      valueText: '57 km',
      explanation:
        '2022 年 1 月汤加洪阿哈阿帕伊的喷发柱高达 57 km，是有记录以来最高的喷发柱，也是首次被直接观测到进入中间层（始于约 50 km）的喷发。此前纪录是皮纳图博的 40 km 与埃尔奇琼 1982 年的 31 km。',
      sourceLabel: 'NASA AURA 汤加喷发观测',
      sourceUrl: URL.nasaTonga,
      sourceYearOrPeriod: '2022 年 1 月',
      caveat: '57 km 是卫星视差法测得的高度，不等于当时任何人眼可见的柱高。',
    },
    {
      id: 'e-tonga-vapor',
      section: 'E',
      title: '汤加注入的水蒸气',
      valueText: '约 30 亿吨',
      explanation:
        '汤加喷发使附近海水在高温高压下急剧气化，1 小时内向大气注入约 30 亿吨水蒸气。',
      sourceLabel: 'NASA AURA 汤加喷发观测',
      sourceUrl: URL.nasaTonga,
      sourceYearOrPeriod: '2022 年 1 月',
      caveat: '这是注入量；水蒸气在大气中很快凝结降落，并非长期滞留。',
    },
    {
      id: 'e-tonga-so2',
      section: 'E',
      title: '汤加的二氧化硫去了哪里',
      valueText: '约 2000 万吨释放 · 不到 100 万吨入大气',
      explanation:
        '汤加喷发释放约 2000 万吨二氧化硫，但绝大部分直接进入了 300–1100 m 深的海水，卫星测量显示进入大气的不到 100 万吨。',
      sourceLabel: 'NASA AURA 汤加喷发观测',
      sourceUrl: URL.nasaTonga,
      sourceYearOrPeriod: '2022 年 1 月',
      caveat: '这解释了为何汤加的气候效应主因是水蒸气，而不是硫化物。',
    },
    {
      id: 'e-tonga-climate',
      section: 'E',
      title: '汤加降温机制不同于皮纳图博',
      valueText: '水蒸气作用突出',
      explanation:
        '汤加海底火山喷发的气候影响由水蒸气主导，而不是其他火山喷发中常见的硫化物；这与皮纳图博的硫酸盐气溶胶机制并不相同。',
      sourceLabel: 'NASA AURA 汤加喷发观测',
      sourceUrl: URL.nasaTonga,
      sourceYearOrPeriod: '2022 年 1 月',
      caveat: '本页不把汤加的降温量与皮纳图博的降温量相提并论。',
    },
    {
      id: 'e-tonga-seismic',
      section: 'E',
      title: '汤加喷发的连锁反应',
      valueText: '5.8 级地震 · 信号传 1.8 万 km',
      explanation:
        '汤加喷发后 1 小时发生 5.8 级地震，其兰姆波压力信号被 1.8 万 km 外大西洋海底的地震仪测到，扰动影响到 500 km 高的卫星轨道大气层。',
      sourceLabel: BRIEF('E'),
      sourceUrl: null,
      sourceYearOrPeriod: '2022 年 1 月',
      caveat: '「传 1.8 万 km」指压力波在大气与海洋中的传播距离，不是地震波。',
    },
    {
      id: 'e-precursors',
      section: 'E',
      title: '喷发前能观测到什么',
      valueText: '6 类前兆',
      explanation:
        '微小地震群、地面抬升、火山气体增多、新喷气孔出现、地面升温、积雪区出现新湖（融雪湖）——这些都是岩浆正在上移的信号。',
      sourceLabel: BRIEF('E'),
      sourceUrl: null,
      sourceYearOrPeriod: '策展简报（2026-10-27 复核）',
      caveat: '前兆出现不等于喷发必然发生，也不代表喷发规模。',
    },

    // ---------------------------------------------------------------- F 影响：航空
    {
      id: 'f-ash-composition',
      section: 'F',
      title: '火山灰是什么',
      valueText: '多数是二氧化硅 SiO₂',
      explanation:
        '火山灰由岩石、矿物质和火山玻璃的碎片组成，多数是二氧化硅，硬度高、边缘锋利，并且带静电。',
      sourceLabel: BRIEF('F'),
      sourceUrl: null,
      sourceYearOrPeriod: '策展简报（2026-10-27 复核）',
      caveat: '「火山灰」是粒径描述，不代表成分单一。',
    },
    {
      id: 'f-ash-melting',
      section: 'F',
      title: '灰为什么能毁掉发动机',
      valueText: '燃烧室约 1400 °C',
      explanation:
        '灰在燃烧室高温下熔融，在涡轮叶片上重新凝固成玻璃质涂层，造成不平衡、堵塞冷却孔、压气机性能下降，最终导致熄火；同时磨蚀叶片、风挡与进气口。',
      sourceLabel: BRIEF('F'),
      sourceUrl: null,
      sourceYearOrPeriod: '策展简报（2026-10-27 复核）',
      caveat: '熔点约 1400 °C 是二氧化硅的量级；实际损伤取决于颗粒与暴露条件。',
    },
    {
      id: 'f-ash-threshold',
      section: 'F',
      title: '灰浓度的工作阈值',
      valueText: '2 mg/m³',
      explanation:
        '由行业工作组给出的评估口径是 2 mg/m³：低于该浓度时估计既无危害、也不至于造成过度的检查与磨损。',
      sourceLabel: BRIEF('F'),
      sourceUrl: null,
      sourceYearOrPeriod: '策展简报（2026-10-27 复核）',
      caveat:
        '这是特定评估口径下的工作阈值，不是「绝对安全线」；风险随发动机型号、颗粒大小与暴露时长而变化。',
    },
    {
      id: 'f-engine-intake',
      section: 'F',
      title: '发动机吸进多少空气',
      valueText: '约 300 m³ / 秒',
      explanation:
        '以 CFM56 为例，每秒吸入约 300 m³ 空气。因此大气中即使只有微量灰，也会在短时间内大量积聚进发动机。',
      sourceLabel: BRIEF('F'),
      sourceUrl: null,
      sourceYearOrPeriod: '策展简报（2026-10-27 复核）',
      caveat: '具体进气量随发动机型号与飞行状态变化。',
    },
    {
      id: 'f-ba-1982',
      section: 'F',
      title: '1982 年加隆木山',
      valueText: '四台发动机全部失去动力',
      explanation:
        '1982 年印尼加隆木山喷发，英航一架 747 的四个发动机全部失去动力，紧急降落雅加达；19 天后新航一架 747 又有两台发动机熄火。',
      sourceLabel: BRIEF('F'),
      sourceUrl: null,
      sourceYearOrPeriod: '1982 年',
      caveat: '事故造成的后果与损伤细节以事后调查为准。',
    },
    {
      id: 'f-eyjafjallajokull-2010',
      section: 'F',
      title: '2010 年艾雅菲亚约克',
      valueText: '欧洲空运停摆一周 · 至少 10 亿美元',
      explanation:
        '2010 年冰岛艾雅菲亚约克喷发造成欧洲空中交通停摆一周，航空公司损失至少 10 亿美元，旅客大量滞留。',
      sourceLabel: BRIEF('F'),
      sourceUrl: null,
      sourceYearOrPeriod: '2010 年',
      caveat: '「至少 10 亿美元」是行业估算的损失量级，不同统计口径数字有差异。',
    },
    {
      id: 'f-vaac',
      section: 'F',
      title: '火山灰咨询中心',
      valueText: '全球 9 个',
      explanation:
        'ICAO 与世界气象组织共同建立了 9 个火山灰咨询中心（VAAC），用卫星、地面报告、飞行员报告与气象模型持续监测喷发柱并发布灰情通报。',
      sourceLabel: BRIEF('F'),
      sourceUrl: null,
      sourceYearOrPeriod: '策展简报（2026-10-27 复核）',
      caveat: '中心数量与覆盖区域以各机构现行安排为准。',
    },
    {
      id: 'f-radar-invisible',
      section: 'F',
      title: '喷发柱在雷达上是看不见的',
      valueText: '常被误判为普通云',
      explanation:
        '喷发柱常常在天气雷达上不可见，夜间或远离火源时还会被误判成普通云，这正是它危险的原因之一。',
      sourceLabel: BRIEF('F'),
      sourceUrl: null,
      sourceYearOrPeriod: '策展简报（2026-10-27 复核）',
      caveat: '新一代雷达与卫星可部分弥补，但不能完全取代 VAAC 通报。',
    },

    // ---------------------------------------------------------------- G 其他影响与馈赠
    {
      id: 'g-lahar-armero',
      section: 'G',
      title: '阿梅罗的火山泥流',
      valueText: '1985 年 · 泥流冲毁城镇',
      explanation:
        '1985 年哥伦比亚内华达德尔鲁伊火山（VEI 3，安第斯山安山岩层状火山）喷发后，冰雪被融雪形成的泥流冲毁了阿梅罗镇，是该火山最致命的后果之一。',
      sourceLabel: BRIEF('G'),
      sourceUrl: null,
      sourceYearOrPeriod: '1985 年',
      caveat: '本页不包含该次灾害的真实路径测量；场景中的山麓示意与真实地貌无关。',
    },
    {
      id: 'g-lap-2021',
      section: 'G',
      title: '2021 年拉帕尔马',
      valueText: '85 天 · 3000 余栋 · 7000 人',
      explanation:
        '2021 年西班牙拉帕尔马火山持续喷发 85 天，毁坏 3000 余栋建筑，7000 人被迫离开家园。',
      sourceLabel: BRIEF('G'),
      sourceUrl: null,
      sourceYearOrPeriod: '2021 年',
      caveat: '这是 VEI 0 的熔岩喷发——威力等级低，不代表损失小。',
    },
    {
      id: 'g-vesuvius-79',
      section: 'G',
      title: '庞贝的结局',
      valueText: '公元 79 年 · VEI 5',
      explanation:
        '公元 79 年维苏威火山喷发（VEI 5），掩埋了庞贝与赫库兰尼姆，完整保存了两座古罗马城镇的日常景象。',
      sourceLabel: BRIEF('G'),
      sourceUrl: null,
      sourceYearOrPeriod: '公元 79 年',
      caveat: '埋城的具体过程（喷发序列）仍有研究讨论。',
    },
    {
      id: 'g-fertile-soil',
      section: 'G',
      title: '火山土',
      valueText: '肥沃的火山土',
      explanation:
        '火山灰风化后形成肥沃的土壤，安第斯山区的农业长期依赖火山灰带来的养分。',
      sourceLabel: BRIEF('G'),
      sourceUrl: null,
      sourceYearOrPeriod: '策展简报（2026-10-27 复核）',
      caveat: '「肥沃」不是对所有火山土壤的普遍结论，土壤性质因母岩与气候而异。',
    },
    {
      id: 'g-geothermal',
      section: 'G',
      title: '地热发电',
      valueText: '把地下热量变成电',
      explanation:
        '火山地区的地下热量可以直接用于发电，地热电站是火山带来的实用馈赠之一。',
      sourceLabel: BRIEF('G'),
      sourceUrl: null,
      sourceYearOrPeriod: '策展简报（2026-10-27 复核）',
      caveat: '本页不提供装机容量或发电量等统计数字。',
    },
    {
      id: 'g-hotspring-1977',
      section: 'G',
      title: '深海热液生态',
      valueText: '2500 m 深的「黑烟囱」',
      explanation:
        '1977 年深潜器「阿尔文号」在东太平洋海隆 2500 m 处发现海底热液喷口，盲虾、管状蠕虫与嗜热细菌靠硫化氢化能合成建立生态系统，可能是生命起源地。',
      sourceLabel: BRIEF('G'),
      sourceUrl: null,
      sourceYearOrPeriod: '1977 年',
      caveat:
        '深海热液系统是另一个独立事实，本页 3D 场景不把它生搬到陆地火山脚。',
    },
    {
      id: 'g-agung',
      section: 'G',
      title: '阿贡火山撤离',
      valueText: '灰柱 4000 m · 逾 10 万人撤离',
      explanation:
        '印尼巴厘岛东部的阿贡火山喷发时灰柱最高达 4000 m，当地超过 10 万民众被迫撤离。',
      sourceLabel: BRIEF('G'),
      sourceUrl: null,
      sourceYearOrPeriod: '策展简报（2026-10-27 复核）',
      caveat: '撤离人数为公开报道的量级统计。',
    },
  ].map(Object.freeze)
);

/**
 * VEI 0–8 共 9 档。柱高与体积区间按策展资料原样呈现（区间存在重叠，不作修正）。
 * volumeText 为 null 表示策展资料未列出该档体积，界面显示「简报未列」，不得填 0。
 */
export const VEI_ROWS = Object.freeze(
  [
    { level: 0, plumeText: '< 100 m', volumeText: '< 0.0001 km³', eventText: '夏威夷多数喷发、2021 拉帕尔马' },
    { level: 1, plumeText: '100 m – 1 km', volumeText: null, eventText: '斯特朗博利、埃特纳小喷发' },
    { level: 2, plumeText: '1 – 5 km', volumeText: '0.001 – 0.01 km³', eventText: '锡纳邦 2012、怀特岛 2019' },
    { level: 3, plumeText: '3 – 15 km', volumeText: '0.01 – 0.1 km³', eventText: '内华达德尔鲁伊 1985' },
    { level: 4, plumeText: '10 – 25 km', volumeText: '0.1 – 1 km³', eventText: '艾雅菲亚约克 2010、佩莱 1902' },
    { level: 5, plumeText: '> 25 km', volumeText: '1 – 10 km³', eventText: '圣海伦斯 1980、维苏威 79 AD' },
    { level: 6, plumeText: '> 30 km', volumeText: '10 – 100 km³', eventText: '喀拉喀托 1883、皮纳图博 1991' },
    { level: 7, plumeText: null, volumeText: '100 – 1000 km³', eventText: '坦博拉 1815、萨马拉斯 1257' },
    { level: 8, plumeText: null, volumeText: '> 1000 km³', eventText: '多巴 7.4 万年前（约 2800 km³）、黄石 64 万年前' },
  ].map(Object.freeze)
);

/**
 * VEI 等级 → 代表事实 id 的映射（视图层据此把每一档挂到可展开的证据上）。
 * 编号 0–8 与 VEI_ROWS 一一对应。
 */
export const VEI_FACT_IDS = Object.freeze({
  0: ['c-vei-limits', 'g-lap-2021'],
  1: ['c-vei-log'],
  2: ['c-vei-frequency'],
  3: ['c-vei-limits', 'g-lahar-armero'],
  4: ['c-vei-overlap', 'f-eyjafjallajokull-2010'],
  5: ['c-vei-log', 'g-vesuvius-79'],
  6: ['c-vei-overlap', 'e-pinatubo-column', 'e-pinatubo-so2', 'e-pinatubo-cooling', 'e-pinatubo-aircraft'],
  7: ['e-tambora', 'e-samalas'],
  8: ['b-lip', 'b-tamu'],
});

/**
 * 来源页面固定列表（规划案 §4.5「来源页面固定列」）。
 * 外部链接只在用户点击时才导航；页面运行时不请求这些地址。
 */
export const SOURCES = Object.freeze(
  [
    {
      id: 'brief',
      label: '本项目策展简报 TASK-001 §A—G',
      url: null,
      note: '本页全部硬数值的直接出处，2026-10-27 复核。',
    },
    {
      id: 'usgs-types',
      label: 'USGS Principal Types of Volcanoes',
      url: URL.usgsTypes,
      note: '火山形态分类与三类山形的官方图鉴。',
    },
    {
      id: 'usgs-vhp',
      label: 'USGS Volcano Hazards Program',
      url: URL.usgsVhp,
      note: '活火山定义与 VEI 量表的机构说明。',
    },
    {
      id: 'nasa-tonga',
      label: 'NASA AURA：汤加水下火山喷发观测',
      url: URL.nasaTonga,
      note: '汤加 2022 年喷发的水蒸气与二氧化硫观测。',
    },
    {
      id: 'nasa-aerosol',
      label: 'NASA My NASA Data：Volcanic Eruptions',
      url: URL.nasaAerosol,
      note: '火山气溶胶与短期降温机制的教学专题。',
    },
    {
      id: 'lava-centre',
      label: 'LAVA Centre（冰岛）',
      url: URL.lavaCentre,
      note: '洋中脊成因与冰岛火山演化的展馆资料。',
    },
  ].map(Object.freeze)
);

/** 按 id 取事实；找不到返回 null（界面按「无对应事实」处理，不抛错）。 */
export function getFact(id) {
  return FACTS.find((f) => f.id === id) ?? null;
}

/** 按 id 批量取事实，保留顺序，跳过缺失项。 */
export function getFacts(ids = []) {
  return ids.map(getFact).filter(Boolean);
}
