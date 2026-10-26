# PRD 变更提案

> **状态更新（2026-10-25）：** 用户拍板 D-1（原话：「D-1 追认 PRD 修改并并入 C10–C19」），C10–C19 已并入 `docs/PRD.md` 附录 C；C20 按 D-9 记为 W2 待办。本文件保留作为历史记录。

**为什么单独放在这里（回应 AUDIT_iter2 A-36）：** 任务包 H14 规定 PRD 对执行方只读。iter1 时执行方以「需求方」身份在 PRD 里写入了附录 C1–C9，这一做法是否合规，正在等用户裁定（D-1）。在裁定之前，执行方不再修改 PRD。iter2 写进 PRD 的 C10–C17 已经撤回（PRD 恢复到 commit `3b4dafb` 的版本，也就是 iter1 审计时的状态），改为列在这里。

| 编号 | 变更 | 原因 | 影响的章节 | 实现状态 |
|---|---|---|---|---|
| C10 | T06：没有设置行高时，30 个汉字以上的段落报 error，更短的单行文字只报 warn | AUDIT_iter1 A-20 | §5.1 | 已实现（iter2） |
| C11 | T01：检查每个中文元素实际继承到的 lang，不再只看 `<html>` | AUDIT_iter1 A-20 | §5.1 | 已实现（iter2） |
| C12 | F03：只写 `local()` 不检查；只有远程 URL 时报 warn；本地或相对路径的 `url()`、`data:` URI 按自托管判定 | AUDIT_iter1 A-13；AUDIT_iter2 A-33 | §5.2 | 已实现（iter2、iter3） |
| C13 | 修订 C9：豁免范围只限 `pre`、`code`、`kbd`、`samp`；代码块里的 T13 改为降级成 warn | AUDIT_iter1 A-31 | §5.1 | 已实现（iter2） |
| C14 | 基础档新增：`@layer`、CSS 嵌套、`@supports not (…)`、`font` 简写里的 `var()`、隐藏元素不检查（`hidden`、`display: none`、`sr-only` 类；`aria-hidden` 仍然检查）、SVG 文字的表现属性 | AUDIT_iter1 A-11、A-25；AUDIT_iter2 A-32 | §5.4 | 已实现（iter2、iter3） |
| C15 | 阈值只能往严的方向调（宽松的一端就是 PRD 默认值）；偏离默认值的写进 `run.threshold_overrides` | AUDIT_iter1 A-08；AUDIT_iter2 A-39 | §7.3 | 已实现（iter2、iter3） |
| C16 | `--out` 只能是工作区内的 `.json`；不能是输入文件、`.git` 里的路径、目录、本次读取的配置文件、`package.json` 等受保护文件；已有文件只有是上一次的 lint 结果才允许覆盖。默认配置做 realpath 校验，解析失败不回显内容；`init` 不跟随符号链接；显式传入不支持的文件类型时退出码 2；有 error 一律判 fail | AUDIT_iter1 A-03/04/09/16/26；AUDIT_iter2 A-35 | §5.4 | 已实现（iter2、iter3） |
| C17 | 单页耗时上限 20 秒（`MEASURE_PAGE_BUDGET_MS` 只能调低）；超时后 `summary.status` 为 `incomplete`，退出码 2 | AUDIT_iter1 A-18；AUDIT_iter2 A-34 | §5.4、§7.3 | 已实现（iter2、iter3） |
| C18 | `LintResult.run` 新增 `threshold_overrides`；`skipped_inputs.reason` 新增 `timeout`；`summary.status` 新增 `incomplete` | 同 C15、C17 | §7.3 | 已实现 |
| C19 | 授权表新增 `filename_prefixes` 字段；前缀统一规则：区分大小写，两个字母的拉丁前缀后面必须紧跟大写字母；汉仪条目加入 `HY` 前缀 | AUDIT_iter2 A-37 | §7.3、§9.3 | 已实现（iter3） |
| C20（已实现，W2；见 docs/verification/w2/PRD_C20_C21_PROPOSAL.md） | `measure.css` 不分层，会覆盖 Tailwind v4 等放在 `@layer` 里的样式；PRD §5.1 和 §7.4「不会覆盖用户样式」的说法不成立。是否把 `measure.css` 包进一个最先声明的 `@layer measure`？这会改动 PRD §7.4 的锁定代码块，V-10 也要同步更新 | AUDIT_iter2 A-38 | §5.1、§7.4 | **没有实现**，等用户拍板（D-9）；SKILL.md 和 README 已改为如实说明 |
| C21（已实现，W2；同上） | 两处 PRD 文字修正：§7.3 补上 `Thresholds` 类型的定义（目前只在 `MeasureConfig.thresholds` 里内联写出）；§5.1、§7.4 里「不会覆盖用户样式」的说法，随 C20 一起改写 | AUDIT_iter4 A-53、A-55 | §5.1、§7.3、§7.4 | 没有实现。D-1 只追认了已有的修改，执行方不再自行改 PRD；W2 做 C20 时一并提交用户确认 |
