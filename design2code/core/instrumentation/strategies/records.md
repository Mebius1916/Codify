站在“拿到 instrumentation 数据”的视角，reconstruction pipeline 的六个策略各自是一个维度。每个维度都提供两类信息：一批「提交型决策记录」（真正改变了结构的动作）和一份「阶段摘要」（计数与阈值）。失败的候选只进摘要计数，不逐条记录，遵循“宁可不触发也不错杀”。

---

## occlusion（遮挡剔除）

移除被上层不透明兄弟节点遮挡的节点。含两类记录点。

**node-visibility：每个节点为什么保留/删除**

能看到：

- 节点是谁：`targetId`、`title`、`nodeType`
- 最终动作：`action = keep/remove`
- 决策原因：`reason`
- 剩余可见比例：`remainingAreaRatio`
- 剩余区域块数：`remainingRegionCount`
- 内容可见规则：`visibleContentRule`
- 命中的子节点数：`hitChildCount`
- 子节点最大相交比例：`maxChildIntersectionAreaRatio`
- 影响它的遮挡层数量：`occluderInfluenceCount`

能判断：

- 它是被完全遮住删的，还是因为没有可见内容删的。
- 它虽然被遮挡，但还剩多少面积。
- 它是靠自身样式保留，还是靠子节点露出保留。
- 有多少个上层遮挡物参与影响了它。

**occluder-opacity：保留节点为什么能/不能作为遮挡层**

能看到：

- 节点是谁：`targetId`、`title`、`nodeType`
- 最终动作：`action = add-occluder/reject-occluder`
- 不透明判断规则：`opaqueRule`
- 节点透明度：`opacity`
- 混合模式：`blendMode`
- 圆角：`borderRadius`
- 填充类型：`fillKind`
- 填充颜色是否不透明：`fillColorOpaque`

能判断：

- 哪些节点被加入遮挡层，哪些被拒绝。
- 拒绝原因是透明度、混合模式、图片、文本/SVG、圆角，还是填充不合格。

阶段摘要：输入节点数、输出节点数、删除节点数、遮挡层数量、无效几何节点数、各类决策计数、平均/最小剩余面积比例、最大剩余区域块数。

---

## reparenting（收编与绝对定位）

把重叠节点收编进最合适的父节点，并把兄弟重叠标记为绝对定位。含两类记录点。

**reparent-adoption：某节点为什么被收编为某父节点的绝对子节点**

能看到：

- 子节点是谁：`targetId`、`title`、`childType`
- 父节点是谁：`parentId`、`parentName`
- 是否完全包含：`fullyContained`
- 重叠比例：`overlapRatio`
- 相对父节点坐标：`relativeX`、`relativeY`

能判断：

- 收编是因为完全包含，还是因为重叠比例超阈值。
- 子节点落到父节点内的具体位置。

**absolute-position：某节点为什么因兄弟重叠被强制绝对定位**

能看到：

- 被定位节点：`targetId`、`title`
- 与谁重叠：`againstId`、`againstName`

能判断：哪个节点因和哪个兄弟相交而退出正常流。

阶段摘要：收编总数、完全包含数、部分包含数、绝对定位数，以及阈值 `partlyContainThreshold`、`absoluteOverlapThreshold`。

---

## spatial-merging（碎片图标合并）

把相邻的碎片图标合并成单个虚拟图标节点。含一类记录点。

**icon-merge：哪些碎片被合并成一个虚拟图标**

能看到：

- 合并后节点：`targetId`
- 碎片数量：`partCount`
- 合并包围盒：`unionWidth`、`unionHeight`
- 定位方式：`position`

能判断：合并了几个碎片、结果盒子多大、是绝对还是相对定位。

阶段摘要：合并簇数、合并碎片总数，以及被拒绝的计数（`rejectedTooLargeCount` 过大、`rejectedRepeatedSequenceCount` 疑似重复图标序列），加上阈值 `maxClusterSize`、`maxPartGap`、`repeatedSequenceTolerance`。

---

## layout-grouping（投影布局分组）

按 gap 将流内节点包成虚拟行/列布局容器。含一类记录点。

**layout-grouping：哪些节点被包进一个行/列容器**

能看到：

- 容器节点：`targetId`
- 主轴方向：`direction = row/column`
- 子节点数：`childCount`

能判断：分组方向、每组包了几个节点（单节点不建组、不记录）。

阶段摘要：分组总数、行组数、列组数、被分组节点总数，以及阈值 `minLayoutGap`。

---

## adjacency-clustering（邻接聚类）

把互相邻接的节点聚成虚拟内容组。含一类记录点。

**adjacency-cluster：哪些相邻节点被聚成一个内容组**

能看到：

- 组节点：`targetId`
- 主轴方向：`direction = row/column`
- 成员数量：`memberCount`

能判断：聚类方向、每个组聚了几个节点。

阶段摘要：聚类总数、行聚类数、列聚类数、被聚类节点总数，以及阈值 `maxMainAxisGapRatio`、`minCrossAxisOverlapRatio`、`maxMergedEmptyRatio`。

---

## semantic-inference（语义标签推断）

为缺少语义标签的节点按名称推断 HTML 语义标签。含一类记录点。

**semantic-tag：某节点为什么被推断出某语义标签**

能看到：

- 节点是谁：`targetId`、`title`
- 推断出的标签：`inferredTag`
- 命中的规则：`rule`

能判断：标签是靠哪条命名规则命中的（如 `text-heading`、`name-section`）。

阶段摘要：被打标签的节点总数 `taggedCount`。
