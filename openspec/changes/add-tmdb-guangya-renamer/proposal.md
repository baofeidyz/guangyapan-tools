## Why

光鸭云盘中的综艺和剧集文件常带有日期、分辨率、分隔符以及“第几期上/中/下”等非标准文字，无法被媒体库稳定识别。需要一个运行在光鸭云盘页面内的油猴脚本，以 TMDB 的真实季集数据为权威来源，安全地生成并执行标准命名。

## What Changes

- 新增可安装的 Tampermonkey 用户脚本，在光鸭云盘文件页提供 TMDB 重命名面板。
- 读取当前目录路径和文件列表，对日期、标点、发布标签、中文期号及上/中/下分段等干扰信息做容错解析，而不依赖完整文件名模板。
- 对接 TMDB TV Search 和 Season Details API，由用户确认剧集候选，同时获取正季与 `S00` 特别季数据。
- 将整个目录的本地文件与 TMDB 剧集进行序列匹配，优先使用标题、日期、期号、分段和相对顺序，并保留 TMDB 中的缺失空位。
- 将先导片、花絮、加更、特辑等默认作为 `S00` 候选，但最终集号必须对应 TMDB 条目，不按本地文件数量自动压缩。
- 提供重命名预览、匹配依据、置信度、冲突/未收录警告和手工调整；低置信度结果不默认执行。
- 通过已验证的光鸭云盘文件列表与重命名 API 执行改名，复用页面现有授权，处理同名冲突、部分失败、受控并发、重试与执行后验证。
- 保留文件扩展名，已符合 `SxxExx` 格式的文件默认跳过，除非用户明确选择重新匹配。

## Capabilities

### New Capabilities

- `tmdb-episode-matching`: 配置 TMDB 凭据、搜索并确认剧集、获取正季与特别季元数据，以及将含干扰字符的本地文件匹配到真实 TMDB 季集编号。
- `rename-plan-review`: 生成可解释的 TMDB 标准重命名计划，显示置信度与异常，并支持在提交前选择和手工修正。
- `guangya-file-rename`: 复用光鸭云盘页面授权读取目录，通过光鸭 API 安全执行重命名，并报告和验证每个文件的结果。

### Modified Capabilities

无。

## Impact

- 新增单文件 Tampermonkey 用户脚本及可单元测试的纯解析/匹配模块。
- 外部依赖 TMDB API v3，需要用户配置 TMDB API Read Access Token 或 API Key。
- 集成已验证的光鸭云盘接口：`POST /userres/v1/file/get_file_list` 和 `POST /userres/v1/file/rename`。
- 油猴权限将限定到 `www.guangyapan.com`、`api.guangyapan.com` 和 `api.themoviedb.org`；光鸭登录凭据不写入项目或脚本配置。
- 重命名会修改用户云盘中的真实文件名，因此预览、冲突检查、明确确认和执行后验证是必要安全边界。
