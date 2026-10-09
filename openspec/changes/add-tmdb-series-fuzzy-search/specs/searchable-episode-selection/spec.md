## ADDED Requirements

### Requirement: Searchable episode selector
系统 SHALL 在每个重命名预览行中提供可输入搜索的 TMDB 剧集选择器，并在候选项中显示标准季集编号和剧集标题。

#### Scenario: Open selector with no search query
- **WHEN** 用户聚焦某一预览行的剧集选择器且搜索词为空
- **THEN** 系统展示已载入的剧集候选及“不匹配”选项

#### Scenario: Preserve the assigned episode after rendering
- **WHEN** 某一预览行已有 TMDB 剧集分配且界面重新渲染
- **THEN** 选择器显示该剧集的标准季集编号和标题

### Requirement: Fuzzy filtering by episode metadata
系统 SHALL 对搜索词进行大小写和常见分隔符无关的部分匹配，并 SHALL 使用季集编号、十进制集数、主标题及备用标题过滤已载入候选。包含多个查询片段时，候选 SHALL 同时匹配所有片段。

#### Scenario: Search by padded season and episode code
- **WHEN** 用户输入 `S03E12`
- **THEN** 系统展示第三季第十二集候选，而不要求标题匹配

#### Scenario: Search by partial title
- **WHEN** 用户输入剧集中文或英文标题的一部分且大小写与元数据不同
- **THEN** 系统展示标题或备用标题包含该文本的候选

#### Scenario: Search by multiple fragments
- **WHEN** 用户输入同时包含集数和部分标题的多个查询片段
- **THEN** 系统仅展示同时匹配全部查询片段的候选

#### Scenario: No candidate matches
- **WHEN** 搜索词不匹配任何已载入剧集
- **THEN** 系统显示无匹配结果且不改变当前剧集分配

### Requirement: Explicit episode assignment and clearing
系统 MUST 仅在用户明确选择有效候选时更新该行的剧集分配，并 SHALL 通过“不匹配”候选允许用户清除分配。无法映射到已载入剧集的自由文本 MUST NOT 改变计划。

#### Scenario: Assign a filtered episode
- **WHEN** 用户从过滤结果中选择一个有效剧集
- **THEN** 系统将该剧集分配给当前行，并重新计算目标名称、勾选状态和计划校验结果

#### Scenario: Clear an assigned episode
- **WHEN** 用户选择“不匹配”
- **THEN** 系统清除当前行的剧集分配，并通过现有计划逻辑清除目标名称及取消该行勾选

#### Scenario: Leave uncommitted search text
- **WHEN** 用户输入搜索文本后离开选择器但未选择候选
- **THEN** 系统保留原有剧集分配且不将搜索文本写入计划

### Requirement: Keyboard-accessible selection
剧集选择器 SHALL 支持使用方向键浏览可见候选、使用 Enter 确认候选以及使用 Escape 关闭候选列表，并 SHALL 暴露与组合框和列表框语义对应的可访问状态。

#### Scenario: Select an episode with the keyboard
- **WHEN** 用户输入搜索词、使用方向键高亮一个候选并按 Enter
- **THEN** 系统选择该候选，效果与鼠标选择相同

#### Scenario: Dismiss results with Escape
- **WHEN** 候选列表展开且用户按 Escape
- **THEN** 系统关闭候选列表且不改变当前剧集分配
