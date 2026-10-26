kind: plan
task: TASK-001
round: 1
nonce: 210f4846710848f2
brief_sha: 38917710e6323d76806cc9c978135705429a137d

# TASK-001｜火山：地球内部的力量——3D 交互科学图鉴
规划日期：2026-10-27。角色：首席设计与规划；本文件仅供本机执行 Agent 直接实施。状态：READY_FOR_IMPLEMENTATION。范围：新建纯静态中文单页，不执行本轮规划之外的业务改造。

## 1. 需求、范围与非目标

### 1.1 任务解释
用户原话：「启动 sflipmloop，做个展示网页，里面有 3d 模型，展示好火山的形成与影响。」
交付「可旋转、有剖面、有喷发、有机制切换」的真实实时 Three.js 火山教具：读者先理解三种形成环境和岩浆上升、堆积的因果，再直观看懂喷发柱与火山灰、航空、气候、泥流和地热/土壤的利弊；每一次切换都让模型或三维叠层发生可见变化，同时给出文字与出处。首屏就是模型，绝不做长篇滚动图文替代 3D。

### 1.2 范围内与排除项
范围内：单页中文展厅；一套可重建的程序化火山主场景；完整模型/剖面/喷发视图；形成（三类地质环境、四阶段、三种典型山形）；影响（喷发柱、航空、气候、山麓风险、地热与土壤）；VEI 0—8 文本+数据条；内容事实与来源索引；响应式、键盘辅助控制、动效减弱、3D 不可用降级；本地构建、审计、截图、执行报告。
明确不做：真实 DEM、GIS、历史喷发重放、物理模拟、实时监测、后端/账号/持久化、多语言、在线音视频/字体/遥测、用户上传、外链 3D 资产、付费 API、自动播放长视频、实时联网图表。插画与模型为「结构/机制示意」，不冒充特定火山的测绘复原。

### 1.3 可验收的闸门（编号 A01—A12）
A01 从空仓库生成并提交 package-lock.json；干净克隆执行 npm ci && npm run build 均退出 0，dist/index.html 存在，用 127.0.0.1 上的普通静态服务器正常打开（不是 file://）。
A02 生产构建加载（包含懒加载/切章节/重置/播放）Network 外部域名请求数 **0**；无 CDN、外链字体、外链模型/HDR、fetch 数据、Analytics、service worker。
A03 页面有真实 WebGL 2 透视 3D 火山；鼠标左键/触摸旋转、滚轮/双指缩放；「完整／剖面／俯瞰／重置视角」实际改变视图；画布外有等价键盘视角控制。
A04 「形成」三种边界环境各有独立下部板块/热点 3D 动态标示；四阶段选择驱动地下熔融/岩浆上升/火山体累积；三种形态切换改变山形轮廓，不只换文案。
A05 「影响」至少有四个显式 3D 关联视效：喷发柱+伞顶/碎屑流、灰羽+航空路径、平流层气溶胶层、泥流/火山地热区。各视效配机制解释和事实来源；不把 SO₂、火山灰、水蒸气混成一物。
A06「启动喷发」/「暂停」/「重播」可独立操作；喷发默认静止；按 prefers-reduced-motion 时默认不自动动，状态仍可查看；点返回内容不会留下旧喷发残影。
A07 VEI 0—8 分档，0—8 等级与简报事实表严格一致；在 375px 横向不溢出，表格以纵向卡片排列；VEI 不作为死亡人数/受灾范围的预测指标。
A08 可只用 Tab、Enter、Space、方向键（用于视角）、Esc 完成章节切换、场景视角、喷发、数据展开；每个焦点环≥2px、可见；移动端操作目标≥44×44px。
A09 375/480/768/1024/1440/1920px 宽度人工截屏；重点 375/1440 下 document.documentElement.scrollWidth≤clientWidth，无遮挡，200% 字号/缩放仍能操作。
A10 文本≥4.5:1，大字≥3:1，关键界面边界/图标≥3:1，禁用≥2:1，非颜色唯一编码；首屏可交互本地目标≤2.5s、CLS≤0.1、轻交互反馈≤100ms。
A11 展览事实均来自本简报的策展事实表，网页正文标注「来源/年份/定义/示意非实测」；无模型比例被当成实测高度、速度或风险半径的暗示。
A12 reports/latest.md 附完整命令结果、静态资源审计、网络外链审计、键盘/移动/四态实测与可追溯截图；未实测项写明，不能假报 PASS。

### 1.4 假设与依赖
目标：macOS arm64，Node 26 / npm 11，Chrome 155；依赖 only three@0.186.1（MIT）和开发用 vite@8.3.5（MIT，npm 页面 2026-10-27 查询），锁定精确版本及锁文件；不装 React、图标包、粒子引擎、物理引擎、测试浏览器内核。使用 Vite 原生 ESM + CSS + Node 内置 node:test 与 Chrome CDP。三维算法自绘无二进制资产，所有地形、纹理、灰粒和图标由代码/内联 SVG 产生；中文字体以显式命名的系统字体栈，移动设备可回退；视为 **3D 科学示意（非测绘/仿真）**。若最新版本差异与本机有冲突，执行 §7 已定分支。

## 2. 调研结论与最高水准参照

### 2.1 已联网核对的同品类参照（2026-10-27）
| 标杆 / 类型 | 已核对的具体强项 | 本项目照着落地 | 不抄的局限 |
|---|---|---|---|
| NASA Eyes on the Earth / 浏览器实时 3D 地学展厅 https://eyes.nasa.gov/apps/earth/ ；产品页 https://science.nasa.gov/eyes/ | 3D 地球与自然现象的数据层/选择器同屏共存，点选后仍留在场景上下文 | 主火山视窗长期驻留，形成/影响切换不跳页，保留自由观察镜头 | 不复制实时联网卫星数据和过密菜单，因本项目必须零外部请求 |
| NASA My NASA Data — Volcanic Eruptions StoryMap / 地学教育课程 https://mynasadata.larc.nasa.gov/phenomenon/volcanic-eruptions/interactives ；教学集合 https://storymaps.arcgis.com/collections/3a95966351e94c73bc2aa0a3d64258e8 | Engage→Explore→Explain→Elaborate，提出问题再解释火山气溶胶与地球系统的关系 | 每章卡片固定「一个提问、一处 3D 证据、一段因果、一条数据、一条来源」；末尾有自检题 | 不照搬 8 节冗长课程导航，不依赖 ArcGIS 在线资源 |
| 冰岛 LAVA Centre / 线下先进地学互动展馆 https://lavacentre.is/the-experience/ 、https://lavacentre.is/about/ | 从地底热柱、地震、喷发史到监测，以分区、实物机制与短解释让非专业观众理解 | 用三维地下剖面 + 颜色区分冷热/压力 + 章节级情境，科学图解优先于粒子烟火 | 不模仿现场实体震动、直播、投影巨幕，网页不假称有触觉/实时测量 |
| USGS Principal Types of Volcanoes / 形态科学图鉴 https://pubs.usgs.gov/gip/volc/types.html | 将火山渣锥、复式火山、盾状火山用明显形态差异、剖面与形成机制对应 | 三种程序化山形轮廓、岩层/灰层、碗形口一键比较 | 不抄成只有静态线稿；本项目须可旋转且剖面带深度 |
| Volcanoes on the Map / 历史喷发可视化 https://volcanoesmap.com/about/ | VEI 编码+时间选择、明确数据源与历史记录不完整性 | VEI 用数值/标签/横条三重编码，面板内提醒 VEI 非危害等级、数据口径有限 | 不照搬实时地图；无坐标真实性保证时绝不放虚构地图点 |

以上为其官方/项目说明中可核验的特性，而非宣称已运行网站性能或做过实际页面截图审查。参考内容事实：USGS https://pubs.usgs.gov/gip/volc/types.html；NASA 对汤加水蒸气特别性 https://science.nasa.gov/mission/aura/aura-measurements-of-an-underwater-volcano-eruption/ 。科学事实最终以简报策展事实表为本项目唯一数值真源，禁止从外部研究引入未经本简报确认的新硬数值。

### 2.2 设计系统/交互/工程来源
- IBM Carbon 字体：https://www.carbondesignsystem.com/building-blocks/foundations/typography/overview — 将阅读型 expressive 字阶与操作型 productive 字阶分离。此项目正文为 16px，主标题 39px，数值采用等宽数字。
- IBM Carbon 颜色：https://www.carbondesignsystem.com/building-blocks/foundations/color/overview — 表面分层、强调色节制，颜色不是承载信息的唯一维度。
- IBM Carbon Motion：https://www.carbondesignsystem.com/building-blocks/foundations/motion/overview — 微操作 productive 150ms；重要场景切换 expressive 400ms；标准 easing 值在 §3 固定。
- W3C WCAG 2.2：https://www.w3.org/TR/WCAG22/ — 可见焦点、对比度、键盘、非文本对比、减弱动效；本项目触摸目标取 44px，严于最低推荐数值。
- Three.js WebGLRenderer / OrbitControls / BufferGeometry / InstancedMesh：https://threejs.org/docs/pages/WebGLRenderer 、https://threejs.org/docs/pages/OrbitControls 、https://threejs.org/docs/pages/BufferGeometry 、https://threejs.org/docs/pages/InstancedMesh — WebGL2、相机旋转与 zoom API、indexed 网格法线、实例化减 draw calls。
- Vite：https://vite.dev/guide/build — base: "./" 生成能在任意子目录静态部署的相对 URL；产物检视不应存在外部绝对路径。
- 技术版本核对：https://www.npmjs.com/package/three 、https://www.npmjs.com/package/vite ，截至调研时 three=0.186.1、vite=8.3.5；执行时按精确版本安装，不自动升级。

### 2.3 品类现状与验收的视觉结论
2026 年优秀科学可视化由「可操纵的结构+透明数据口径+按问题分层揭示」构成；告别一屏密集旋钮、无标签的电影烟雾、随机起伏的假地形、无来源的巨大数字和滚动劫持。火山主画面始终能回答「哪儿熔化、从哪儿上升、形状如何积累、物质到哪里去」。画面目标：**无需读完整段文字，3 秒认出山形与地下通道；一次切换能看到因果变化；30 秒内找到灰对飞机或气候的路径；每条重大数字能点开来源**。不得以炫光/粒子遮住剖面结构。

## 3. 设计语言（唯一真源）

### 3.1 设计令牌表
**只建 src/styles/tokens.css 这一份令牌文件**。CSS 全部 var(--*)；Three.js 场景色从 getComputedStyle(document.documentElement) 读取同文件的 --scene-* 并在初始化/主题重建时映射到 THREE.Color，不再维护另一份 JS hex 常量。场景不做浅色主题；暗色工作台可保证灰羽和火流层次。令牌表的 hex 只准出现在 tokens.css；不采用浏览器默认字体/表单控件样式。

| 令牌 / 类别 | 数值 | 使用规则 |
|---|---|---|
| --bg-0 / --bg-1 / --bg-2 / --bg-3 | #080F14 / #101D25 / #182933 / #213743 | 页底、内容卡、悬浮层、强调面 |
| --text-1 / --text-2 / --text-3 / --text-inverse | #F4F8F7 / #C7D9DA / #AFC5CB / #08151B | 标题、正文、解释辅助、亮色按钮字 |
| --line-1 / --line-2 | #66818B / #9CB4BA | 卡边/分隔、关键控件边界；细线需实测≥3:1，否则用 line-2 |
| --accent / --accent-press / --accent-pale | #FFB36C / #F48A4D / #FFE3BC | 熔岩聚焦元素、按下、浅重点数字 |
| --info / --success / --warning / --danger | #8ED7FF / #81E0BC / #FFD581 / #FFA0A0 | 信息/完成/警惕/错误，均必须配文字/符号 |
| --focus / --disabled | #B2EDFF / #8BA0AA | 2px 外焦点环，与选中填充区分；禁用文本需≥2:1 |
| --scene-rock / --scene-strata / --scene-ash / --scene-magma / --scene-soil / --scene-plate / --scene-water / --scene-aerosol | #515A59 / #76695A / #B5B8B0 / #FF6C35 / #576956 / #4E8191 / #3C7F9D / #A5C8DB | 岩层、灰、发光熔岩、植被、板块、海洋、气溶胶；科普编码在图例呈现 |
| --radius-1/2/3/4/pill | 4/8/12/16/999px | 标签、按钮、卡片、浮层、胶囊 |
| --sp-1/2/3/4/6/8/12/16/24 | 4/8/12/16/24/32/48/64/96px | 4px 网格；按钮缝8、行项12、卡片内24、栏间32、节间48/64、主标题上下64 |
| --border-thin / --border-strong | 1px / 2px | 1px 容器，2px 选中/键盘控件 |
| --shadow-0 | none | 主要内容原位 |
| --shadow-1 | 0 4px 12px rgba(0,0,0,.18) | 次级卡片 hover |
| --shadow-2 | 0 12px 28px rgba(0,0,0,.28) | 浮动面板 |
| --shadow-3 | 0 18px 40px rgba(0,0,0,.38) | 来源详情层 |
| --shadow-4 | 0 24px 56px rgba(0,0,0,.48) | 错误警报/模态（仅当必须） |
| --z-canvas / --z-mark / --z-panel / --z-nav / --z-pop / --z-alert | 0 / 2 / 8 / 20 / 40 / 60 | 画布、图注、内容浮层、顶部导航、详情弹层、通知 |
| --d-fast / --d-normal / --d-scene / --d-slow | 110ms / 180ms / 400ms / 700ms | 按下反馈、状态切换、章节视角、初入场；超时不用连续转场 |
| --ease-work / --ease-enter / --ease-exit | cubic-bezier(.2,0,.38,.9) / cubic-bezier(0,0,.38,.9) / cubic-bezier(.2,0,1,.9) | Carbon productive 曲线；只有 opacity/transform 动画 |
| --font-cn / --font-en / --font-mono | "PingFang SC","Hiragino Sans GB","Microsoft YaHei","Noto Sans CJK SC","Source Han Sans SC",sans-serif / Inter,"Helvetica Neue",Arial,sans-serif / "SFMono-Regular",Consolas,Menlo,monospace | 字体完全本地；英文字体未安装就回退 Helvetica/Arial；不用 font-face 网络加载 |
| --fz-0/1/2/3/4/5/6 | 12/14/16/20/25/31/39px，分别 .75/.875/1/1.25/1.5625/1.9375/2.4375rem | 以 16px 为基准，1.25 比例近似到整数；级别≥7，不用默认 h1-h6 |

字阶指定：fz0 行高16px/字重600/字距 .06em /图例≤28汉字；fz1 20px/500/.02em/数据标签≤34汉字；fz2 27px/400/.01em/正文≤36汉字；fz3 28px/600/.00em/卡标题≤28汉字；fz4 32px/650/-.015em/章节标题≤22汉字；fz5 39px/650/-.02em/副大标题≤18汉字；fz6 48px/700/-.03em/主标题≤16汉字。数字统一 font-variant-numeric:tabular-nums；中西混排 font-feature-settings:"kern" 1,"palt" 1；首行不缩进、段间16px。正文宽度上限 36ch（中文）或 68ch（英文）；中文长链接可 overflow-wrap:anywhere。

| 响应断点/容器 | 规则 |
|---|---|
| 0—479px | 页面 padding16px，1 列；导航折成两个同尺寸 segmented 按钮；3D 容器 min-height 360px / aspect-ratio 4/5 取较大者；操作条纵向两行 |
| 480—767px | padding24px，1 列；3D aspect-ratio 5/4；控件两排4+3 |
| 768—1023px | max-width 920px，内容1列；3D aspect-ratio 16/10；资料卡2列 |
| 1024—1279px | max-width 1160px，场景/解说 7:5，间距24px；场景高度 min(70vh,680px) |
| ≥1280px | max-width 1248px，场景/解说 8:4，间距32px；模型窗高 624px；页面水平居中 |
| ≥1440px | 左右外留白至少64px；标题卡与主内容左对齐；资料最高阅读宽度 560px |

移动端横屏高<560px：模型高度固定 320px，文案下面顺序流排；绝不覆盖系统键盘或靠绝对定位挤压。列表项内部组距8/12，组间24/32；所有图例与进度条可换行。

图标：统一自绘 24×24 viewBox inline SVG，stroke-width 1.75、stroke-linecap round、stroke-linejoin round、fill none；尺寸 --icon-sm=16px、--icon-md=20px、--icon-lg=24px；只能从 src/ui/icons.js 生成路径符号；不要 emoji。Logo/主视觉用排版文字，不伪造机构标识。正文用文字「信息」「警告」而不是单色圆点。阴影令牌在禁用时归零，卡片本身只保留单边框或底层差，不堆砌三重视觉分隔。

### 3.2 组件规格表：默认结构/交互/每项四态
**通用组件全状态约定 S**：默认 --bg-1 + --line-1 + --text-1；hover（仅 hover:hover）边框 --line-2、translateY(-1px)、--shadow-1；active 背景 --bg-3、scale(.985)、--shadow-0；focus-visible outline 2px solid --focus + 2px offset，绝不挪动布局；selected 内描边2px --accent-press + 显式「已选择」；disabled aria-disabled="true"、--disabled 字、opacity .68、pointer 事件忽略但保留可读性；loading 禁止重复操作且显示「处理中…」+ 细线旋转进度（reduced-motion 关闭旋转）；error 内联 role=alert 文案 +「重试」，边框 --danger；empty 只显示文案+行动按钮；success --success 字色 +「已…」屏幕阅读器反馈。所有可用按钮最小44×44px，紧凑标签非交互可低于44px。所有组件只继承 S，不得独立定义另一套按钮状态。

| ID / 组件 | 结构、尺寸、字体、色与位置（均调用令牌） | 键盘/ARIA 与四态专属文案 |
|---|---|---|
| C01 顶部标题与章节切换 | header 标题 fz6，附说明 fz2；双段 nav button 48px 高、内边距 sp-3/sp-4、radius-2；selected 带底部2px强调线；sticky 仅 ≥1024 使用 --z-nav，移动为静态 | Tab→形成→影响；aria-current="page" 标当前展章，不混用 role=tab；空「先从形成开始」；加载「章节载入中」；错误「无法展示章节，请重试」；成功「当前：形成/影响」 |
| C02 3D 展台 | figure 内 canvas 填满 --bg-0，radius-4、1px --line-1；右下角常驻「科学结构示意·非实测比例」fz0；canvas 设置 role=img/aria-label（不让 canvas 捕获唯一交互焦点），caption 下方有同等文字图例 | 模型操纵走 C03；空「尚未选择观察对象」+「查看层状火山」；加载「正在构建模型 0—100%」；错误「此设备未能启动 3D；文字与剖面图仍可使用」+「重试 3D」；成功「3D 已就绪，拖动旋转」 |
| C03 视角工具组 | 位于 canvas 后的 toolbar；剖面/完整/俯瞰/左转/右转/放大/缩小/重置，全部 44×44px，工具栏 flex wrap gap8，背景 --bg-2，radius-2 | 每个原生 button+aria-label；剖面等 aria-pressed，方向控制单次转±15°/俯仰±10°、缩放倍率1.15；空「选择视图以观察火山」；加载「正在切换视角」；错误「相机无法更新，点击重置视角」；成功「当前视图：剖面」 |
| C04 过程步骤选择 | 形成页 1—4 分步按钮组，每个高52px，左序号 fz1，主文 fz2，右说明 fz1；桌面每行4、手机2×2，radius-2 | aria-pressed、aria-controls=explanation；点击选中同时更新 3D、文字；空「选择一个形成步骤」；加载「正在展示岩浆上升」；错误「步骤未加载，已保留文字说明」；成功「第 2 步：部分熔融」 |
| C05 三类成因/形态切换 | 成因三钮/山形三钮共用 segmented 样式，48px，交互缝8，选中显式「选中」；单项过长两行，最小高44，可伸到64 | aria-pressed，焦点与选中状态不同；空「选一种形成环境」；加载「正在生成盾状火山」；错误「切换失败，查看默认层状火山」；成功「已切换：盾状火山」 |
| C06 影响场景选择 | 4 张同款 section card，每张≥88px 高、sp-4 内边距、radius-3；标题 fz3、摘要 fz1、图标20px；grid自适应1/2列（≥768 2列） | button/aria-pressed，aria-describedby 机制摘要；空「选择一种火山影响」；加载「正在呈现火山灰路径」；错误「场景不可见，下面有文字解释」；成功「当前场景：航空风险」 |
| C07 喷发/时间控制 | primary「启动喷发」宽≥152px高48px --accent 底 --text-inverse 字；暂停/重播次级按钮同高；进度轨道 4px 高，配「0/12秒」数字；无自由滑条以避免时间轴虚假精度 | Space/Enter按键按钮触发；按钮重复点做幂等；aria-live=polite 只宣告开始/结束，**不每帧播报**；空「先选择喷发示意」；加载「正在准备喷发序列」；错误「喷发动效不可用，切到静态喷发剖面」；成功「喷发已暂停/已完成」 |
| C08 事实数据/VEI卡 | 数据值 fz5 + 单位 fz1，说明 fz2，来源 fz0；VEI 单列 9 行（每行 min-height56px）代表条 width 按档0—8递增但标「示意等级，不按数量线性缩放」；radius-3，内边距sp-6 | 数据行可选 button 展详情，aria-expanded/aria-controls，展开不抢焦点；空「此视角没有单独数值，继续阅读机制」；加载「正在整理数值标注」；错误「数据说明不可见，请阅读来源表」；成功「VEI 6：10—100 km³」 |
| C09 来源抽屉/术语解释 | details/summary 优先，若须弹层则 dialog；max-width560px，padding sp-6，radius-4，shadow-3；每个来源显式原始出版机构及链接且外链点击后才导航 | Enter/Space展开；Esc关闭 dialog、焦点回触发按钮；空「这一段没有量化指标」；加载「正在展示本地来源索引」；错误「来源索引无法展开，查看页面底部来源列表」；成功「已展开：数据依据与定义」 |
| C10 状态条/降级版 | figure 紧随标题下的角色状态条，52px高，radius-2、--bg-2；静态 2D SVG 剖面图由同一程序化点列生成，不能是空白占位；提示文本 fz1 | role=status；失败 role=alert；空「选择形成或影响章节」；加载「在本机生成火山几何」；错误「图形加速不可用，已启用可操作的静态剖面」；成功「画面已准备好」 |
| C11 图例与标记 | canvas 下方4—6项说明，有词语+SVG线样+颜色，排布 gap12；在 3D 周边最多3个 DOM 标签，标签字号fz1与背景--bg-1，遮挡模型时隐藏低优先级标签而非叠字 | DOM 标签只是辅助，所有信息在图例中可读；空「选择现象可查看标记」；加载「标记计算中」；错误「标记未定位，继续阅读图例」；成功「已标注：岩浆房、火山通道、灰羽」 |

四态与 S 是**每一个组件**的强制实现契约；纯文字/装饰组件不生成假的可点击态。无异步的按钮 loading 仅在几何体构建>100ms时出现，否则立即完成；error 不是因为没有数据而出现。所有组件出现在空/加载/错误/成功状态的视觉快照中，报告给出覆盖矩阵；不允许只测一个全局错误框。

## 4. 体验设计与固定文案

### 4.1 信息架构（严格两层主导航+详情）
首页/标题「火山｜地球内部的力量」；一级「01 火山如何形成」「02 喷发如何影响世界」；二级：形成→「板块环境（三类）」「四步建造」「火山形态（三类）」；影响→「喷发柱」「航空」「气候」「山麓危险」「火山的馈赠」（影响共5个现象按钮：C06 实际渲染为5项，见下条更正）；三级只允许「来源与定义」抽屉，不另设深层路由。形成默认「俯冲带→部分熔融→层状火山→剖面」，影响默认「喷发柱→剖面」。**C06 数量以此处的五项为准**，保持所有按钮同一组件规范。各章节局部选择离开时可重置；URL 仅 hash #formation 或 #impact 可前进/后退，hash 未知统一回 #formation，不发送网络。

### 4.2 首页首屏与布局像素规则
桌面 ≥1280：顶栏高96px、页边padding32，标题区左宽≥360、右角用小号「互动地球科学」编号；主舞台左(8/12)宽，右(4/12)解释区，竖向顶对齐。左主舞台完整火山占画面高度65%，前景裂开的地层和微弱热流占20%，天空灰蓝留白15%，右上不放粘屏浮按钮；右栏以一问一答卡+段落+关键数值+来源组成，每屏至多2个数据大字。舞台底视角工具栏、章节内操作、底部 VEI/来源分区按垂直文档流排列。
375px：从上至下 logo/章按钮、32px页标题、舞台360—500px、视角按钮（两行）、单段解释、互动选项、图例、指标卡、来源。不得让文字浮在 3D 上造成触控误触；3D 标签最多两个，静态注释放在下方。
视觉基调：岩石灰+深海蓝底，克制的熔岩橙只出现于热源和主操作；亮度与明度对比而非大片鲜红天空；镜头45°上方向俯视、左上冷环境补光、岩浆用小面积橙色发光近光。初始镜头应看见火口、山坡、地底通道而非只见标准圆锥侧面。

### 4.3 用户主旅程（逐步可观察）
1. 入站见层状火山剖面与问题「岩浆为什么能从地下到达地表？」、三枚板块环境选项。状态条从「在本机生成火山几何」更新为「3D 已就绪」。
2. 点击「俯冲带」：地表下出现斜向俯冲海洋板块（用箭头标记方向）与上覆板块，旁边贴「水促进地幔部分熔融；并非整块地幔融化」。点击「洋中脊」变为两块板块相离+熔融上涌；点击「热点」变为板内上升热柱与地表火山体。不把所有火山成因画成同一种俯冲。
3. 依次选择「01 地下条件」「02 部分熔融」「03 岩浆上升」「04 喷出与堆积」：岩浆房热度增强→中央通道上升亮环→火口抬升→形态/灰层增厚；下方即时更新一句因果和来源。步进动画单次≤400ms，若动效减弱则立即到终态。
4. 切「盾状」「层状」「渣锥」，火山外轮廓有一眼可见宽矮/高陡/小尖锥差异；「完整/剖面」切换保持形态。图例写「比例示意，不表示特定火山真实高宽」。
5. 导航「影响」，初选喷发柱；点击「启动喷发」播12秒演示气体推力→对流→伞顶，允许暂停/重播，明确写「动画时间不代表真实喷发时长」。点击航空/气候/山麓/馈赠，主场景材质与路径标示同步切换，底部数值卡对应变化。
6. 点 VEI 6 展开「皮纳图博 1991」的同口径案例，再展开来源说明；返回/刷新保留 #impact 但默认演示停止。读完答小题「VEI 0 是否代表没危害？」→显示「不。VEI 不衡量损失；2021 拉帕尔马仍造成房屋损毁」，不建立账号/计分。

### 4.4 章节叙事和固定主文案
形成三因：洋中脊/发散边界「板块分开，深部物质减压后发生部分熔融，岩浆上升并生成新洋壳（冰岛）」；俯冲带「洋板块下沉，带入的水促进上覆地幔部分熔融（环太平洋带）」；热点「板块内部，地幔热柱供应熔融物质，形成火山链（夏威夷）」。**这三个选择必须是同一舞台下不同地下结构，不能只修改标题。**
形成四步文字：01「岩层深处具备温度、压力与物质条件」；02「岩石部分熔融，产生岩浆」；03「岩浆在压力和浮力等作用下向上运移、储集，挥发分随压力降低析出」；04「熔岩与碎屑物反复喷出，堆积成不同山形」。盾状「坡缓、基性熔岩流动性强」；层状「熔岩与火山灰互层、锥体较陡」；渣锥「小型陡锥、碗状顶口」。避免表示每座火山必经完全相同的四个时间阶段。
影响喷发柱「火口近处靠气体推动；中段靠吸入空气的热对流上升；上部达到中性浮力并受风拉成伞」；航空「火山灰是尖锐的岩石/矿物/玻璃颗粒，进发动机高温区可熔化再凝固、堵塞与磨蚀」；气候「SO₂在平流层形成硫酸盐气溶胶，反射阳光，可能造成短期降温。水蒸气效应与硫酸盐不同」；山麓「碎屑流是炽热且快速的密度流；火山泥流可由融雪融冰形成；熔岩虽然相对慢仍会破坏建筑」；馈赠「火山土可肥沃、地热能可发电、热液喷口可支撑化能合成生态系统」。文案不暗示所有火山都会出现所有影响。

### 4.5 事实呈现的**唯一真源**表（数据留在 src/data/facts.js，禁止散落）
以下字面数值、范围、年份照简报，展现时连同单位/适用条件输出。每项 fact 需有 id, title, valueText, explanation, sourceLabel, sourceUrl, sourceYearOrPeriod, caveat, briefSection，URL 未取得确认可指向简报权威来源总入口，不能伪称直达证据；若简报没有具体文献 URL，注明「策展简报汇编口径」。
- A：全球陆地约 1350 座有喷发潜力火山；海底另约 2.5 万座；环太平洋带约 4 万 km、活火山 450–512 座、约 75% 的喷发；活火山采用全新世约 1.17 万年定义；腾冲火山群 97 座火山锥；海底岩浆温度 900–1400 °C；冒纳罗亚体积约 7.5 万 km³、海底隆起约 9000 m。
- B：三类场景只采用盾状、复式/层状、火山渣锥；大火成岩省可超过1.6 km厚、淹没上千万 km²（仅作为阅读侧栏，不在三种山形中伪造它是第四座普通锥体）；对大塔穆火山最大单体的历史判断含争议，**本轮不在首屏作现代确定性排名**，来源详情注明为简报历史记载，不能把历史陈述升级为确证。
- C：VEI 0 <100m、<0.0001km³；1 为100m–1km且体积未列；2 为1–5km、0.001–0.01km³；3 为3–15km、0.01–0.1km³；4 为10–25km、0.1–1km³；5 为>25km、1–10km³；6 为>30km、10–100km³；7 高度未列、100–1000km³；8 高度未列、>1000km³；VEI2起相邻等级体积约10倍；重点提示「不衡量危害与持续时间」。表中高度区间存在重叠属于原简报口径，**不得擅自修正或填补空白**。
- D：喷发柱气体推力区火口上方 1–2km；柱高实测常见2–45km、理论最高约55km；「柱高翻倍需喷发物量约16倍」作为机制概念；碎屑流速度100–200km/h、温度约700°C，另有320km/h口径但不用单项动画速度暗示真实值。
- E：皮纳图博 1991（VEI 6）柱高35–40km、SO₂约2000万吨、全球均温下降约0.5°C持续约两年、16架飞机损伤；坦博拉1815（VEI7）喷发物约160km³、1816「无夏之年」、北半球均温下降0.4–0.7°C；汤加2022柱高57km，水蒸气约30亿吨（原简报「1小时内向大气注入」），SO₂约2000万吨中进入大气不到100万吨。关于汤加气候变化只标「水蒸气作用突出；不将其与皮纳图博降温量类比」，避免把几种温室/辐射效应误称等价。
- F：发动机燃烧室约1400°C；1982英航747四台发动机失去动力；2010艾雅菲亚约克欧洲空运停摆一周，航司损失至少10亿美元；全球9个VAAC；简报2mg/m³工作阈值**只在详情作为特定评估口径，不得写成「低于绝对安全」**，说明风险随发动机、颗粒、暴露而异。
- G：拉帕尔马2021持续85天、毁坏3000余栋建筑、7000人流离失所；1977阿尔文号在2500m发现深海热液生态；内华达德尔鲁伊1985泥流冲毁阿梅罗；本轮没有泥流真实路径测量。
- 来源页面固定列：主来源「本项目策展简报 TASK-001 §A—G」；延伸验证官方页 USGS 类型 https://pubs.usgs.gov/gip/volc/types.html ，NASA 汤加 https://science.nasa.gov/mission/aura/aura-measurements-of-an-underwater-volcano-eruption/ ，NASA 气溶胶教学 https://mynasadata.larc.nasa.gov/phenomenon/volcanic-eruptions/interactives ，USGS 火山 https://www.usgs.gov/programs/VHP 。**所有数值从 data/facts.js 读取，单位字符串不可由程序重新换算/取整。**「来源年份」指事件发生年份/发布年或「策展简报（2026-10-27复核）」；不得捏造页级引文。

### 4.6 微交互、四态、可访问性与响应
指针悬停只能变 transform/opacity（同时避免鼠标悬停时引起控制区域漂移）；按压反馈110ms；章节交替布局原地渐显180ms；镜头移动400ms，视觉状态调整中使用按钮加载与状态条即时反馈。镜头拖动只在 canvas 区触发且 touch-action:none；页面其它地方始终可纵向滚动。按 Tab 顺序：跳转主内容→形成/影响→视角控制→阶段/成因/形态或影响按钮→喷发→事实→来源；canvas 不作为唯一可交互元素，也不设陷阱。Esc 关来源和可撤销弹层；用 ARIA live 最多1条通知，不发每帧内容。
加载真实顺序：先 HTML 骨架/可读标题→本地生成几何→构造 renderer→显示可交互；>1s 显示「正在本机生成地形，请稍候」+数值步骤，>10s 显示「取消 3D，使用文字图解」；取消立即停止后续生成/动画并可重启。空状态（尚未选影响）提示「从喷发柱开始观察」；错误（WebGL 禁止/上下文丢失）展示 SVG 固定剖面、标注、完整文字、相同操作按钮，3D 按钮 aria-disabled。成功状态显示「3D 已就绪」。无脚本时 noscript 写「本展项需要 JavaScript 展示交互；下方来源说明仍可阅读」，提供静态段落。
移动 375px：内容只能在卡片内行折叠，永远不水平滚动；长来源 URL 用断词换行；VEI 9行独立卡而非宽表；200%浏览器缩放测试、场景高度重测；对应更改见 §3 断点。

## 5. 技术实现细节与边界处理

### 5.1 工程树（全为计划新建路径，不声称仓库已存在）
- package.json / package-lock.json；vite.config.js（base:"./"，build target:"es2022"）；index.html（lang="zh-CN"、title/description、meta viewport、CSP meta 可选但不挡本地脚本）；.gitignore。
- src/main.js 仅启动、清理、异常边界；src/styles/tokens.css（全部设计令牌和场景调色）；src/styles/base.css（reset/排版/布局）；src/styles/components.css（组件引用令牌）；src/ui/icons.js（统一SVG）；src/ui/renderShell.js（语义 DOM +四态）；src/ui/controller.js（事件与 aria）；src/ui/textFallback.js（SVG结构图/文字回退）。
- src/data/facts.js（只含数据内容/出处）；src/data/chapters.js（固定文案与关联 scene cue）；src/state/store.js（同步纯状态机）；src/scene/terrain.js（噪声山体网格）；src/scene/crossSection.js（剖面/通道/岩浆房）；src/scene/tectonics.js（三类板块/热点）；src/scene/effects.js（灰羽/航空/气溶胶/碎屑流/泥流/地热）；src/scene/camera.js（OrbitControls和相机预设）；src/scene/renderer.js（生命周期/按需绘制）。
- tests/facts.test.mjs、tests/terrain.test.mjs、tests/state.test.mjs、tests/a11y-dom.test.mjs、tests/build-audit.test.mjs；scripts/check-dist.mjs、scripts/serve-dist.mjs、scripts/smoke-cdp.mjs（仅用 Node 26 原生 WebSocket/CDP，不能下载浏览器）；reports/ 由本机填实测证据。
- README.md（启动/操作/来源/限制）。

### 5.2 规范化数据接口与状态机契约
data/facts.js 导出 FACTS（Object.freeze 数组），单项 {id:string, section:"A"|"B"|"C"|"D"|"E"|"F"|"G", title:string, valueText:string, explanation:string, sourceLabel:string, sourceUrl:string|null, sourceYearOrPeriod:string, caveat:string}；VEI_ROWS 9项 {level:0..8, plumeText:string, volumeText:string|null, eventText:string}。VEI volumeText 为 null 时显示「原简报未列」，不能填 0。
chapters.js 导出 FORMATION_CONTEXTS= ["divergent","subduction","hotspot"]、FORMATION_STEPS 0..3、VOLCANO_TYPES=["shield","strato","cinder"]、IMPACTS=["column","aviation","climate","hazard","benefit"] 及中文对应；步骤和指标引用 fact.id，不重复数字。
state/store.js 导出 initialState, reducer(state, action), subscribe(listener), dispatch(action), getState()；state = {chapter:"formation"|"impact", context:"subduction"|"divergent"|"hotspot",step:0|1|2|3, volcanoType:"strato"|"shield"|"cinder", view:"cutaway"|"whole"|"top", impact:"column"|"aviation"|"climate"|"hazard"|"benefit", eruption:"idle"|"running"|"paused"|"finished", eruptionProgress:0..1, selectedFactId:string|null, scene:"loading"|"ready"|"error"|"cancelled", sceneReason:string|null, reduceMotion:boolean, userOrbit:{yaw:number,pitch:number,distance:number}}。
action 严格白名单：NAVIGATE, SELECT_CONTEXT, SELECT_STEP, SELECT_VOLCANO, SELECT_VIEW, SELECT_IMPACT, ERUPTION_START, ERUPTION_TICK, ERUPTION_PAUSE, ERUPTION_REPLAY, VIEW_ROTATE, VIEW_ZOOM, VIEW_RESET, SCENE_LOADING, SCENE_READY, SCENE_ERROR, SCENE_CANCEL, FACT_TOGGLE, SET_REDUCED_MOTION。校验非法 payload 时维持旧 state，记录 console.warn（非 UI 错误）；同类重复 action 幂等。
renderer.js 导出 createVolcanoExperience(container, onStatus) → Promise<{setState(nextState), resize(), dispose(), snapshotState()}>；若不支持 WebGL2 则 Promise reject 标准 {code:"WEBGL_UNAVAILABLE"}；初始化重试前 dispose()；切章不会重建 renderer，只切 group.visible / transforms / material opacity，换火山类型时仅更新 outerMesh geometry 并对旧 geometry dispose。动画循环仅在运行、阻尼衰减或镜头过渡时启用 requestAnimationFrame；静止用 invalidate() 更新一次。页签不可见 document.hidden 时暂停计时器；返回时不追帧。
terrain.js 导出 buildVolcanoGeometry({kind,sections=96,rings=48,cutaway=false,seed=427}) 和 radialHeight(r,theta,kind,seed)。参数都在 scene 模块顶部命名常量（**非视觉令牌**），测试可取固定 seed。tectonics.js 导出 buildTectonicContext(context) → THREE.Group；effects.js 导出 buildImpactGroup(impact) → {group,update(t),dispose()}；camera.js 导出 setPreset(view), rotateBy(yawDelta,pitchDelta), zoomBy(factor), reset(), update(dt)；UI 不直接访问 Three 内部对象。
交互数据流：button/键盘→controller.dispatch→reducer 原子计算→同步 DOM 文案/ARIA/图例→经验对象.setState更新 mesh/动作→必要时 invalidate；hashchange→NAVIGATE，不设置 localStorage/后端。来源展开只需本地 facts 对象，无 API / loading 网络请求。

### 5.3 3D 视觉制作配方（模型长相/算法/参数写死）
**坐标与镜头**：+Y 上、单位为视觉单位非 km。地面 12×12、底层从 y=-2.2 到0；默认火山基半径4.0，层状锥顶约 y=3.35；火山口唇半径0.46、深0.28。PerspectiveCamera(fov=38, near=.1,far=100)，默认位置(8,5.8,10.5)，lookAt(0,.55,0)，OrbitControls: enablePan=false, enableDamping=true, dampingFactor=.08, minDistance=7.5,maxDistance=20,minPolarAngle=.45,maxPolarAngle=1.42。camera 会绕中心旋转，按钮 rotateBy 必须按 **OrbitControls 实际的方向语义**做实测，不凭直觉猜符号；重置回默认视角。视觉上 3D 画面右上能看到一个远坡侧的侵蚀沟、左前可见剖面层，避免完美塑料圆锥。

**地形噪声（零模型/贴图依赖）**：采用确定性的 seeded hash value noise（每频点 hash(ix,iy,seed)，平滑插值 u=t²(3−2t)；三频叠加 octaves [1,2,4]、weights [1,.45,.22] 归一化）+ 一圈分叉侵蚀沟 ridge/crease 项。极坐标网格圆周 96 段×半径48环；角 θ=2πj/96，归一 r∈[0,1]。地面外围 r>4 用低振幅地形，整体山高 H(kind)*profile(r)；strato: H=3.35, profile=max(0,1−r^1.55)^1.05；shield: H=1.4, profile=max(0,1−r^2)^2.3，基半径放大到4.75；cinder: H=2.45、基半径2.65、profile=max(0,1−r)^0.92。noise 在坡面幅度0.13×(1−r)且火口边缘衰减到0，避免尖锐噪声盖过边界；由 radialHeight 得到每顶点 y，computeVertexNormals。顶火口半径 r<0.46 不封成山尖：凹口环 y≈H−0.12，内壁向中心下凹0.3，底部橙灰色；另建 crater floor。岩石材质 MeshStandardMaterial roughness=.95 metalness=0, vertexColors=true；基于法线朝向/高度+层位使用 --scene-rock、--scene-strata、--scene-soil 的色相变体，变体用 THREE.Color.lerp（不得硬编码新的颜色）。**所有尺寸示意，非真实比例**。

**剖面必须是真截掉的立体几何，不是透明滤镜**：完整 outerMesh 使用全圆角度 [0,2π]；剖面 outerMesh 用 theta∈[0.45,2π−0.45] 的开扇面，缺口指向相机，底板暴露两条径向切面；对每个切角从火山表面到底层 y=-2.2 生成分层四边形并三角化，层纹在 y=-.6/-1.3/-2.0，色阶用 --scene-strata 与 --scene-rock。剖面切缘线同色浅一级。地下岩浆房位于(0,-1.35,0)，椭球半轴(1.25,.48,.85)，表现为局部熔体储集（不是每座火山真实腔形）；弯曲通道从房顶经(0,-.2,0)通往 crater floor，用 TubeGeometry(CatmullRomCurve3, radius=.16, tubularSegments=48,radialSegments=10) 及橙色半透明内芯；向上游动的8个小发光粒以通道曲线 t移动，形成选 step≥2 时出现。岩浆房/通道视图只在 cutaway 显示，whole 隐藏；所有实例有文字对应。
**科学意义的形态与分层**：strato 山坡做4—6条宽度变化的火山灰/熔岩层（贴坡细环、层厚不一）；shield 显示3条宽缓的熔岩台地；cinder 在坡面使用 InstancedMesh 约220粒不均匀火山渣、顶部深碗状口。不要把盾状画成层状的简单缩小版，不要让渣锥像整齐光滑金字塔。背景地表大约低绿灰无茂密热带森林，散布20—40颗简化岩块；不允许下载 PBR/HDR。
**三类地质环境**：同一底座下可切3套板块示意。subduction：海侧一块蓝灰色倾斜板 y=-.2 向 y=-2.0 下插，陆侧水平板在 y=-.45，上覆小楔状暖色 partially molten patch 靠深侧；divergent：两块长方板中间张开间距0.8，中央橙色薄上涌体并分两侧箭头；hotspot：完整水平单块板，板下细长橙色上涌柱，从 y=-2.3 通至 y=-.5，与上覆板位置关联。用 3D 方向箭头加下方 HTML 「板块分离/俯冲/热点」文字。板块差异大于装饰效果，形成各步骤亮度/出显程度调整，点击后立即看得见。
**物理机制分层而非烟火**：预置 12s、非真实时间。0—2s 火口橙光与低处小粒向上；2—6s 气体推力区窄柱、灰颗粒向上推；6—9s 中段羽状扩张，对流卷吸，密度渐淡；9—12s 顶部 umbrella 环盘（半径最大2.6），以缓慢 X 风向位移。灰云由 InstancedMesh 360个有深浅灰随机形状球（禁止 shader 大噪声/透明 overdraw过量），每帧只 update instanceMatrix 的100个活跃粒；硫酸盐气溶胶为 **另一组薄蓝灰环层**，在气候选择才显示，文字标「概念示意，并非当前测量浓度」；不能把火山灰扩散动画标作 SO₂ 浓度预测。火山碎屑流用35个灰褐球沿坡底轨迹向下扩散（采用0..1标准化时间，不写速度 km/h 对应位移）。熔岩用沿坡一条 0.25—0.55宽的折线带与橙色中心细条，渐暗到红黑末端；不可越过地表交错浮空。
**航空 impact**：scene 上空一架无品牌低多边形灰白飞机剪影（机身一个细柱体、翼两片挤出几何、尾翼），路径用白色虚线从灰柱右后穿过灰羽边缘，经过灰羽时飞机外圈淡橙虚线提示而非坠落事故动画；右栏展示“磨蚀→热端熔融→凝固附着→动力风险”的4节因果。
**气候 impact**：喷发柱顶部上空远层显示泛蓝灰半透明大范围 aerosol ribbon，局部细白太阳光箭头在进入层后反向短箭头；箭头只说明散射/反射机制，不按比例显示全球均温。下方列皮纳图博1991、SO₂约2000万吨、降温约0.5°C约两年（不同数据行一起出现不拆改）。
**山麓 hazard**：5条路径小图例「高温碎屑流」「融雪泥流」「缓行熔岩」，场景中只显示被选中的其中一条（默认碎屑流）以免误解同次必然一起发生；山麓 1座低几何村舍轮廓仅作空间风险参照，不要复现具体灾难现场。子选项为共享C05样式；数值仅在详情里显示。
**馈赠 benefit**：喷发停止、移除灰羽与飞机；坡底一条温泉热流与细蒸气、2块低饱和绿耕地区域；镜头侧下方剖面出现地热井双管与换热箭头；不把热液喷口深海系统生搬到陆上火山脚，深海热液作为另一个非3D文字事实卡。
**灯光与画面**：背景 --bg-0 的近黑蓝，环境光低强度0.7，DirectionalLight 位置(-5,9,8)、强度2.1，柔和冷色，补光白0.35；Ambient occlusion 不引入后处理；renderer.outputColorSpace=SRGBColorSpace，toneMapping=ACESFilmicToneMapping，toneMappingExposure=1.05；setPixelRatio(min(devicePixelRatio,1.5))；shadowMap.enabled = true 但仅地表和山体接收，PCFSoftShadowMap 1024²，移动屏小于768关实时阴影改穹顶轮廓漫反射。禁止 bloom、过亮烧穿橙色熔岩、飞溅全屏覆盖。

### 5.4 性能、容错、边界
顶点总数目标 ≤80k，场景 draw calls ≤100，粒子≤360，正常桌面≥30FPS，375px软件渲染至少可完成所有操作、动画可主动降低至15FPS。材质不超过12种，优先同几何InstancedMesh；统一 dispose geometry/material/controls/renderer；contextlost e.preventDefault 后设置错误态，contextrestored 允许点重试但不盲目复用已损坏对象。若初次构建>1s先呈现本地生成的轻量剖面与进度；>10s可取消转静态 SVG。按章节进入时删除互斥特效组或隐藏（不得叠加喷发与地热）。
性能预算：dist JS gzip≤300KiB（Three 打包视实际情况，超过就按U3记录但不得外链拆资源）；非压缩 dist 总量≤1.8MiB；first interaction ≤2.5s（本地正常 Chrome），CLS≤0.1（设定 canvas 包装高度）；功能按钮反馈≤100ms；静态数据<80KB；SVG fallback <60KB。若软件渲染导致绝对 FPS/首屏目标未达，先降粒子360→120，几何96×48→64×32，阴影关，画布DPR≤1，性能结果仍必须诚实报告。不要为追分数牺牲准确的示意。
空值：facts 缺值直接显示「简报未列」，不填猜值；unknown hash重置formation；非法状态无操作；连续快速选标签最后一次有效，旧章节效果在单次 setState 中先清空；失焦暂停；可见性恢复不补时；文本过长自然换行，数字与单位保持不可断行；无 API、数据列表远小于200，不要分页/虚拟滚动；依赖包只在构建期由 npm 下载，运行期永不联网。
**禁令**：外链资源、随机非种子生成导致测试不稳定、旋转相机时 canvas 吞掉整个页面滚动、只靠颜色传达危害、用同一按钮却不同交互、用传统 CSS width/height/left/top 逐帧动画、无障碍虚假标签、不经测试说已达标、不标非真实比例、SVG 假3D替代正常的实时场景、任何未被核准的新统计数值。

## 6. 任务拆解（每项七要素、按依赖排序）
格式固定：前置｜操作｜位置｜产物｜自查｜测试｜完成，随后注明关联组件/令牌。所有路径均为计划新建，函数名即必须采用的导出签名；不写虚构现有行号。

**T01 搭骨架与依赖**
- 前置：已读简报三文件（本规划为唯一指令）；操作：创建 package.json，精确安装 three@0.186.1、vite@8.3.5，vite.config.js base:"./"，scripts dev/build/preview/test/check:static/smoke，创建 index.html 完整元标签并 npm install 出锁文件；位置：package.json、vite.config.js、index.html；产物：可 npm ci 的工程骨架；自查：npm ls three vite 且 git diff 包含 lock；测试：rm -rf node_modules && npm ci && npm run build，退出0；完成：dist/index.html 与本地样式/脚本，未引用 CDN。质量线 E/D，C01/C02。
**T02 建令牌与页面容器**
- 前置：T01；操作：逐行将 §3.1 令牌放单一 tokens.css，reset html/body/form，建立最大宽/栏间距与字阶，给默认控件 S，字串不带裸色；位置：src/styles/tokens.css、base.css、components.css；产物：统一字体/颜色/圆角/栅格；自查：grep 在其他 src 文件查十六进制颜色为0条（图标 path 的色也来自 currentColor）；测试：tests/build-audit.test.mjs 检查 tokens 和非法 CDN 字符串；完成：375与1440无结构横溢。质量线A1—A5/E，C01—C11。
**T03 构建 facts 与固定内容**
- 前置：T01；操作：按 §4.4/4.5 拆成 facts.js、chapters.js；每个事实附 section/sourceUrl/sourceYearOrPeriod/caveat；生成 VEI_ROWS 9行，volumeText null 原样保留；位置：src/data/facts.js、chapters.js；产物：唯一事实/文案库；自查：按 id/section 对照简报表逐条核对，严禁单位拼凑；测试：facts.test.mjs 断言9行、关键数字原样、ID唯一、文案全有出处；完成：事实校验全过且正文没有第二份硬数字。质量线B4，C08/C09。
**T04 先构建可读 HTML 控制台**
- 前置：T02、T03；操作：renderShell 产生 header/nav/main/figure/toolbar/过程卡/事实卡/footer，所有按钮 type=button、aria属性、标签文字；设置首屏默认 formation/subduction/strato；位置：src/ui/renderShell.js、src/ui/icons.js、src/ui/controller.js（先只DOM）；产物：不开3D也能阅读及点击切换；自查：Tab与键盘可走完控件、无emoji；测试：a11y-dom.test.mjs 断言交互元素结构和唯一 id；完成：两章能展示正确事实、无JS生成模型前也不空白。质量线A1—C，C01/C03—C11。
**T05 模型几何/外形比较**
- 前置：T03、T04；操作：按 §5.3 实现 deterministic noise、3类radialHeight及 indexed mesh、三类火山口、地层、山坡侵蚀，定义统一 geometry.dispose；位置：src/scene/terrain.js；产物：外形肉眼不同的三类几何；自查：渲染固定镜头截图看盾宽矮/层锥/渣锥顶凹；测试：terrain.test.mjs 验证同seed同坐标同值、所有顶点有限数、三类型峰值和径向坡度不同、法线存在；完成：三种山体无缝裂洞无倒置面。质量线A5、D/E，C02/C05。
**T06 真剖面与成因三组**
- 前置：T05；操作：按 §5.3 theta 开扇，建两块切面地层、岩浆房和弯管、板块三机制；在形成步骤中控制 group 显隐与亮度；位置：src/scene/crossSection.js、tectonics.js；产物：完整/剖面切换及三机制独特下部结构；自查：前透视能看到橙通道从岩浆房到火口，subduction 有下插倾斜板，而 divergence 是分离缝；测试：terrain.test.mjs 增建几何边界/材质可见性和Dispose测试；完成：不能透视穿帮，不靠单一透明纹理伪剖面。质量线A5、D，C02/C04/C05/C11。
**T07 渲染器、镜头与按钮等价**
- 前置：T05、T06；操作：WebGL2 renderer、相机预设、OrbitControls范围与按钮方向、resize observer、全生命周期，读 --scene-*；位置：src/scene/renderer.js、camera.js、main.js；产物：可转可缩可切视角的真实3D；自查：实际拖转、转15°按钮、回正后 cut 仍面向镜头；测试：state.test.mjs 状态动作、Chrome smoke 截图证明像素改变；完成：在本机WebGL可用时 canvas 稳定绘制不黑屏。质量线B/C/D，C02/C03。
**T08 形成交互闭环**
- 前置：T03、T06、T07；操作：controller绑定成因/四步/形态，reducer守护非法值，变更一次同步 DOM/3D/aria；切换章节保留hash、重置喷发；位置：state/store.js、ui/controller.js、scene/renderer.js；产物：三因四步三形态任意组合正常；自查：十次快速切换仍只显示一个地质环境和一座火山；测试：state.test.mjs 每一action合法/非法分支+历史前进/返回；完成：每次操作≤100ms有文本反馈且模型跟随。质量线B1—B4/E，C01/C04/C05。
**T09 影响动效/科学图解**
- 前置：T07、T08；操作：buildImpactGroup 五种现象和 Hazard 三子类，灰云12秒分阶段、飞机路线、气溶胶层、碎屑流/泥流/熔岩、地热井，内置动画进度控制，污染物标签分离；位置：src/scene/effects.js、src/scene/renderer.js、src/ui/controller.js；产物：五类影响场景和喷发控制；自查：启停/暂停/重播/切章后各组互斥、相同随机seed画面一致；测试：state.test.mjs 喷发状态转换和越界时间，Chrome smoke 检查动效前后图差异；完成：每种影响确有独特模型证据不是文字换牌。质量线A5/B/D，C06/C07/C11。
**T10 数据/来源/科学审核**
- 前置：T03、T09；操作：渲染VEI 9档、单位、异常空值、详情抽屉、官方外链（仅点击才导航）；用简报逐条复核、标注示意不代表速度/比例；位置：src/ui/renderShell.js、src/data/facts.js、src/styles/components.css；产物：数据详情与来源完整；自查：VEI 0/1/8边界正确，灰与SO₂不混淆；测试：facts.test.mjs 事件映射/数字/单位/年份和 null 测试；完成：涉及关键数字的 UI 100% 有来源语境。质量线A1/B4/E，C08/C09。
**T11 四态/异常回退**
- 前置：T04、T07、T09；操作：scene loading/error/cancelled/ready，生成SVG cutaway fallback、WebGL2不可用检测、context loss、cancel、重试、重复动作保护、真实进度文案；位置：src/ui/textFallback.js、src/ui/renderShell.js、src/main.js；产物：无WebGL也能完成文字教育和按钮体验；自查：DevTools 禁 WebGL/模拟丢失 context、重试不重复插canvas；测试：state.test.mjs 状态机四态和错误分支、Chrome smoke 强制禁 WebGL；完成：不黑屏、不把 fallback 谎称3D通过。质量线B1/B2/C/D，C01—C11。
**T12 响应/键盘/动效减弱**
- 前置：T10、T11；操作：按 §3 各断点媒体查询、44px点击区、焦点环、键盘视角、hash history、prefers-reduced-motion 即时终态、浏览器200%缩放；位置：src/styles/base.css/components.css、src/ui/controller.js；产物：375—1920自适应；自查：375/1440 Tab/Enter/Esc/Space无焦点丢失、屏幕阅读器顺序；测试：a11y-dom.test.mjs + Chrome smoke 测 scrollWidth、rect 重叠、focus ring、reduceMotion；完成：A08/A09实测过门槛。质量线A1—C，C01—C11。
**T13 脚本审计、实测与交付**
- 前置：T01—T12；操作：创建 serve-dist 只绑定127.0.0.1，check-dist 扫所有产物 remote URL / font import / CSS import / 非本地资源，smoke-cdp 用已安装系统 Chrome 做双尺寸截图/日志/外部请求监测；最终 README 和 reports/latest.md；位置：scripts/*、tests/build-audit.test.mjs、README.md、reports/*；产物：可复现的一键 build+tests+screenshots 与真实执行报告；自查：清空node_modules跑 npm ci && npm test && npm run build && npm run check:static && npm run smoke；测试：脚本均退出0，否则报告 BLOCKED 并留日志；完成：A01—A12逐项含证据且无红线不合格。质量线A—G，全部组件。

## 7. 未知信息与调查入口（零悬空决策）

### 7.0 清单
U1 npm版本/依赖安装（有入口）；U2 Chrome WebGL2/SwiftShader能力（有入口）；U3 构建体积与性能达标（有入口）；U4 动作方向与软件渲染差异（有入口）；U5 本机真实字体回退对标题排版的实际形态（无外部可查入口，仅本机）；U6 真实浏览器/系统缩放组合导致的截断（无外部可查入口，仅本机）；U7 源数据存在争议或来源不能逐条定位（有入口）；U8 目标用户低性能设备上帧率（无本轮远程设备入口）。每项均有默认。

### 7.1 有入口条目（入口/判据/分支/耗时上限）
- U1：本机 npm 能否安装精确版？查 https://www.npmjs.com/package/three 和 https://www.npmjs.com/package/vite 及命令 npm view three@0.186.1 version && npm view vite@8.3.5 version && npm ci；两条输出对应版本且 ci=0 为真；失败先检查 registry 配置并 npm cache verify，再重试1次，仍失败则 **不得替换版本、状态 BLOCKED**；上限15分钟。
- U2：Chrome 软件渲染能否提供 WebGL2？入口本机 Chrome 155、chrome://gpu（人工）与 CDP Runtime.evaluate 代码 canvas.getContext("webgl2")!=null；为真走3D；为假先启 --enable-unsafe-swiftshader --use-angle=swiftshader 并创建独立临时user-data-dir再试，仍假走SVG fallback并标 **A03 BLOCKED，不能交完整成品**；上限12分钟。
- U3：包体积/CPU/GPU预算？入口 npm run build、find dist -type f、gzip -c dist/assets/*.js、Chrome Performance / 自建 performance.mark；满足 §5.4 继续，否则按“360→120粒、96×48→64×32、关阴影、DPR=1”四级顺序处理，每级重新截图/验证可读性；仍超出记录实际值，若首屏>2.5s标明未过 A10、不许冒充通过；上限20分钟。
- U4：OrbitControls按键左转与实际画面是否一致？入口 https://threejs.org/docs/pages/OrbitControls + 本机Chrome 操作固定镜头前后截图；方向与按钮标题一致则保留，反向则翻转 rotateBy 的符号再测试；若视角偏移过大则限制按钮Δyaw=±0.15rad（少于原15°为安全降级）并在报告记录；上限10分钟。
- U7：简报事实与外部权威口径冲突怎么办？入口本地 handoff/briefs/TASK-001.md §A—G，以及 https://pubs.usgs.gov/gip/volc/types.html 、https://www.usgs.gov/programs/VHP 、https://science.nasa.gov/mission/aura/aura-measurements-of-an-underwater-volcano-eruption/；若官方来源直接核实则附官方页+简报，若难以核验**保持简报数字原样**且加「策展简报汇编口径/需对照权威原始研究」并从头部高亮移入详情，不自行替换；本轮不添加所谓更新数据；上限20分钟。

### 7.2 无可公开确认入口条目（待查/怎么查/决策分支/默认）
- U5 本机字体：待查 375px 真机缺少 PingFang 时标题是否换行重叠；怎么查 Chrome 字体渲染 screenshot+computedStyle(fontFamily)，系统 fc-list（存在才用）；决策 = 首屏fz6 39px或手机切fz4 25px；若文字宽度>容器则手机fz4，其他保留fz6；默认手机fz4。上限10分钟；使用默认写「未知项调查结果」。
- U6 缩放与滚动：待查 Chrome 200% zoom 是否把控制条挤出 viewport；怎么查本机 Chrome DevTools 设备预设+zoom和截图；决策 = toolbar 2排或3排；若任一按钮宽<44px转3排，否则2排；默认3排（375px）。上限10分钟；记录采用默认。
- U8 低端安卓性能：待查无实机时最终主画面实际FPS；怎么查本机 Chrome CPU×4节流/禁GPU人工观察但**不得等同安卓实测**；决策 = 资源档 high/low；如果帧均时>50ms 切 low（粒120、64×32、DPR1、无阴影），否则 high；默认 low 当 width≤767px，用户可通过「画质」按钮开高档但非必需；若无真机，在报告明确「移动端仅尺寸仿真，未真机测性能」。上限10分钟。

### 7.3 自检
上述8项均有明确分支或保守默认；从未访问真实设备/未测网络不能以「未能查证」假装已通过。新发现问题按 §10 处理，默认优先保科学解释、交互无障碍和离线可用。

## 8. 本机验收 / 回归 / 视觉自检

### 8.1 必跑命令与产物
1. npm ci → exit 0，使用锁文件；npm test → exit0并显示每个测试真实pass/fail计数（由 node:test 输出，报告粘原始末尾，不手算）；npm run build → exit0，dist/index.html存在；npm run check:static → exit0，扫描出0远程资源绝对地址（区分文案来源 href 与真正运行时请求）。
2. npm run smoke → 先启动 scripts/serve-dist.mjs 在 127.0.0.1:4173，使用已装Chrome headless/new与隔离profile通过 CDP 截 desktop 1440×900 / mobile 375×812，采集浏览器 console/page errors/Network.requestWillBeSent; **仅打开页面和交互，不点击官方外链**；外部 http(s) 请求计数0；保存 reports/screenshots/desktop-formation.png、desktop-impact.png、mobile-formation.png、mobile-impact.png、webgl-error.png 与对应 network-log.json。
3. smoke 中断言 localhost 页面 status 200 / DOM 标题存在 / 章节按钮可达 / WebGL2可用下 canvas 渲染至少一次 / 3D 视图切换像素差明显 / 喷发 t0与t6s 有像素差 / reduced-motion 下不会自动播放 / 375与1440页面无水平滚动 / 禁WebGL能出现 fallback；不准用「页面有canvas」代替真实 3D 像素检验。
4. 本机人工 npm run preview -- --host 127.0.0.1（或者 npm run dev -- --host 127.0.0.1）打开，做下列全流程观察，并记录截图与事实；如果 smoke 不支持或 Chrome 未安装，仍需人工走查并将自动化项标「未运行」，不能宣称全部通过。

### 8.2 逐项人工流程/可视化验证
- **正常态**：进入形成→三因各一次→四步逐一→三形态各一次→完整/剖面/俯瞰/自由旋转→重置；进入影响→喷发柱→启动/暂停/重播→航空/气候/山麓三危险/馈赠→展开 VEI6、VEI0、来源→浏览器后退前进。截图同一模型不同外观与剖面的对比。
- **空态**：人为把 selectedFactId设null并切影响未选项，看到「从喷发柱开始观察」和可点动作，没有空白区域。
- **加载态**：人为在 dev 模式短暂延迟初始化3秒，看到进度和原因说明；取消/重试可恢复。不要把调试延时带进正式 build。
- **错误态**：禁 WebGL2 或触发 context lost，看到信息、备用 SVG 剖面、可继续阅读的完整中文解释、重试路径，截图。
- **键盘**：不碰鼠标，用 Tab/Shift+Tab/Enter/Space/Esc/方向（通过视角按钮）完成形成→影响→喷发→数据详情→收起，焦点没有消失；检查跳主内容；屏幕阅读器读 button 名称、已选章节、剖面图文字说明。
- **尺寸**：375/480/768/1024/1440/1920 + 375宽200%缩放，界面截图检查标题换行、解释块最多36汉字宽、按钮不遮挡、44px hit targets、无横滚、canvas无拉伸；单独测试 touch 一指转/双指缩放与页面其它位置滚动。
- **对比度**：记录具体取色对（--text-2对--bg-1、--text-3对--bg-1、--line-2对--bg-2、--disabled对--bg-1、--focus对背景），用脚本计算WCAG相对亮度比；全部按 A2 对应阈值，**未到线必须调整 tokens 并重新截图**。
- **动效**：Chrome emulate prefers-reduced-motion:reduce，模型仍可切最终态，喷发必须点击才能运行且可以暂停；每帧更新是 WebGL 物体位置，**DOM/CSS 只用 transform/opacity 动画**；后台标签页暂停，不会回到前台瞬间跳完。
- **同类一致性**：3种成因按钮、3种山形按钮、5种影响按钮分别检查颜色/内边距/圆角/焦点一致；来源详情、错误/空态都以相同token生成。
- **性能**：本机 Performance 标首屏可操作时间、FPS采样、CLS、dist gzip、软件渲染档位；指标超出按 §7 U3 改且说明取舍。**明确报告设备与是否GPU渲染**。

### 8.3 交付失败门槛
若 A01/A02/A03/A04/A05/A08/A09 任一失败，状态 **BLOCKED**，不交「完成」；A10 指标若因软件渲染不能完成，标 **NEEDS_IMPROVEMENT** 且交证据，不用示意图冒充 3D；所有 C1—C11 组件的状态与 design-quality-bar A—G 质量线中红线必须逐项结论。个别外部事实无法进一步定位时仅用已给简报口径且标注，不私自补数据。本规划方未运行本机任何测试，最终 PASS 仅由本机实际结果产生。

## 9. 首次交付文件、证据与报告模板

### 9.1 仓库目录核对
必须出现 package.json、package-lock.json、index.html、vite.config.js、src/styles/{tokens,base,components}.css、src/data/{facts,chapters}.js、src/state/store.js、src/scene/{terrain,crossSection,tectonics,effects,camera,renderer}.js、src/ui/{icons,renderShell,controller,textFallback}.js、src/main.js、tests/{facts,terrain,state,a11y-dom,build-audit}.test.mjs、scripts/{check-dist,serve-dist,smoke-cdp}.mjs、README.md、dist/（构建产物可不纳入git，必须构建可得）、reports/latest.md、reports/screenshots/*.png、reports/network-log.json。不要把 node_modules、临时 user-data-dir、巨型浏览器下载缓存提交。

### 9.2 reports/latest.md 必须按此顺序写实测
1. 环境与源码提交SHA / 执行时间 / Chrome / macOS / Node/npm / WebGL渲染方式。
2. 变更文件清单与每项 T01—T13 完成/阻塞证据。
3. 命令原样+exit code+完整日志文件路径，测试数取 node:test 真输出：tests passed/failed/skipped，不手抄期望数。
4. 验收 A01—A12 按行 PASS/FAIL/NOT_TESTED，附截图/日志引用。
5. 设计质量线 A1—G 每一条的事实（对比度值、4态截图、Tab路径、尺寸截图、实测FPS/包大小）。
6. 科学审核差异表：每条可见硬数值→facts.id→简报A—G→官方延伸链接/局限说明；重点记录汤加、Tamu、VEI、航空阈值措辞。
7. 未知项调查结果 U1—U8：实际入口、用了哪支分支、默认值/无法确认的原因及影响。
8. 已知限制、下一次改进优先级与是否满足交付标准；未经验证不得留空。

### 9.3 证据操作
每条 smoke 证据同源码HEAD生成；截图不得修饰/裁剪遮挡问题区域。screenshots 默认保存 desktop-formation、desktop-impact、mobile-formation、mobile-impact、webgl-error、veitable-expanded、focus-visible 六张，附完整浏览器控制台及 Network 的 JSON；在 README 列清楚「图像为程序化科学示意、不代表真实火山尺度、不提供灾害预测」。若截图因 CDP 不可用，人工 Chrome 实截图另存并写清方式。验收表逐条对应文件路径和可重放命令；仅报告描述但无结果不得算测试证据。

## 10. 本机执行 Agent 遇困处置规则

1. **零提问**：本文件是完整作业指导书；不能要求用户/网页版规划者补审美、文件结构、参数或实现步骤。计划未覆盖的新情况由本机 Agent 按「科学可解释 → 键盘可用 → 本地可运行 → 视觉一致 → 性能」优先级自行解决并记录决策。
2. API/平台冲突：先检查已锁定版本官方文档和本机最小复现；以真正跑通为准，不编造API；改变实现细节但保持§1验收功能，reports/latest.md写「偏离第X条／原因／替代实现／新测试证据」。
3. 不可撤销的科学表述冲突：不能捏造统计数、发生年份或「几何量代表真实公里数」；保持简报原文数值并标口径。仍无法确认就降为附录、显式提醒，不作为首屏定量主结论。
4. 硬指标优先：零外部请求、真 WebGL 可交互与无障碍任一不能满足，不能靠删功能/假动画宣称完成；输出 BLOCKED + 最小复现+余项证据。可接受的低性能降级已在 U3/U8 定死。
5. 不运行无用大包下载、不扩大仓库读取范围、不生成第二套 token、不用录屏代替源码真实实时场景；实施、调试、视觉/自动实测与最终报告由本机执行 Agent 完成；本轮规划阶段本身没有执行或测试。

---
**任务指纹校验**：文件开头五行与 TASK-001 简报 SHA 匹配。完成定义是执行 Agent 对 A01—A12 与设计质量线逐条给出证据，并实际在 main 交付；本规划提交不等于实现已完成。
