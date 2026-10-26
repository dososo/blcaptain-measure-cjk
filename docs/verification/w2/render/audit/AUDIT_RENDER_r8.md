# W2 完整档（`lint --render`）第 8 轮复核 · AUDIT_RENDER_r8

| 项 | 内容 |
|---|---|
| 当前步骤 | 8 步流程第 7 步「审计验收」，第 8 轮 |
| 审计方 | Claude Code（独立会话，不采信执行方自述，以代码、命令输出、git 历史为准） |
| 审计对象 | 在 `ff4c2ee` 之后：`9435180`（锁定复现夹具和测试）→ `27f2aa7`（整改）→ `bce170e`、`1649a78`、`e34349f`、`0b803bf`（报告和验证结果）。审计时 HEAD = `0b803bf` |
| 上一轮 | `AUDIT_RENDER_r7.md`：未达标，1 High、2 Low |
| 审计日期 | 2026-10-26 |
| 审计方改动 | 只新建本文件。对抗页面放在 `/tmp/r8audit/`，跑完已删除；`git status --porcelain` 只多出本文件 |

---

## 1. 结论

**未达标。** 唯一的原因是流程性的：R-D1、R-D2 未拍板。

### 1.1 流程性原因（与代码质量无关）

R-D1、R-D2 两项 PRD 变更仍未经用户拍板（`open_decisions.json` 中 `resolved: false`）。按项目规则，这一条本身就让结论为「未达标」。执行方的 `results.json` 也如实判了「未达标」。

### 1.2 实质评价：没有 Blocker、High、Medium

第 7 轮的 RG-01 至 RG-03 都已处理：

- RG-01 用审计方的 `cap2.html`（5200 个中文元素）复现，已修好；
- 选择器缓存前后写法完全一致，和 `model.ts` 也逐字一致：80 个页面、4496 个元素，没有一处不同；
- RG-02 的耗时改善能复现。

前七轮的全部复现页、golden 20 页、对照组 60 页都没有回归，详见 §3、§5。

本轮只有 **1 条 Low**（RH-01）：

| 严重度 | 条数 | 编号 |
|---|---|---|
| Blocker | 0 | — |
| High | 0 | — |
| Medium | 0 | — |
| Low | 1 | RH-01 |

### 1.3 R-D1、R-D2 拍板之后的结论

**结论会是「有条件达标」。** 条件如下，全部落实后可以判「达标」：

1. 用户对 R-D1、R-D2 给出书面答复：按 `open_decisions.json` 的规则写入 `user_quote`、`resolved_on`，由用户本人提供原话。然后把 PRD_RENDER_PROPOSAL 第 8 版的改动写进 PRD 和附录 C，在干净工作树上重跑 `node scripts/verify-w2-render.mjs`，`results.json` 的 `verdict_blockers` 为空。
2. RH-01（Low）：补上「同身份元素在不同宽度下轮流可见」的回归测试，或者更正响应矩阵里的说法。
3. RF-03（Low，已披露、不改）：保留在「已知局限」第 18 条，响应矩阵里注明「审计方第 6 轮同意不改」。

另外两点不影响本段结论，但交付时应该写清楚：

- D-A1、D-A2 是不阻塞的开放决策，用户可以否决；否决时 T05 的口径或脚本的处理方式要按用户意见改。
- 本段没有做 `card` 命令，以及 W2 的其余各项（6 个主题、静态 A 系列规则等），执行方已在报告 §8 写明，不属于完整档的范围缩小。

---

## 2. 发现清单

复现页面写在 `/tmp/r8audit/` 下，调用 `runRender` 和 `runLint`（`npm run build` 之后的 `packages/cli/dist/index.js`）。

### RH-01 · Low · 「轮流可见」没有补回归测试，矩阵里给的理由不准确

- **位置：** `VERIFICATION_REPORT.md` §15 的 RG-03 一行：「『在不同宽度下轮流可见』那一种没有补：基础档在 1280px 和 390px 下分别计算可见性，夹具不容易写成『基础档报 error』的前提，所以只在矩阵里说明」。
- **问题：** 这种夹具写得出来。审计方第 7 轮的 `drawer-alt.html`，在 1280px 只显示页头导航，在 390px 以下只显示抽屉导航（11px）。基础档在 390px 下报出 3 条 T11 error（`static: fail e=3`），完整档在 360px 实测，也报出 3 条。所以「基础档报 error」这个前提是成立的。
- **为什么是问题：** 这种写法目前判断正确，但没有回归测试守着；以后改合并规则（例如按宽度分别判断是否检查过）时，可能悄悄回退。
- **修法：** 把 `drawer-alt.html` 补成回归夹具（`header{display:none} @media (min-width:768px){ header{display:block} .m{display:none} }`，`.m a{font-size:11px}`），断言判 fail、T11 至少 3 条；或者删掉矩阵里「不容易写」的说法，改成「暂未补测试」。

---

## 3. 第 7 轮发现逐条复核

| 编号 | 第 7 轮严重度 | 复核结论 | 依据（真实输出摘录） |
|---|---|---|---|
| RG-01 | High | **修好** | `probe.ts` 的 `ids` 不再截断，`checked` 和 `ids` 口径一致；Node 一侧超过 20 万个时整页记为 incomplete。实测：`cap2.html`（5200 个，两种宽度）、`cap-text.html`（6000 个，走文字回退路径）、`cap-20k.html`（20000 个）都判 fail，折叠里的 T11 保留；对照 `cap2-ctl.html`（2600 个）仍是 fail |
| RG-02 | Low | **修好，耗时能复现** | 同一父元素下 1000、2000、3000、5100 个中文元素，单宽度分别是 0.98、1.00、1.28、2.04 秒（第 7 轮是 1.6、3.2、6.1 秒，5100 个超时）；3000 个、6 种宽度 1.75 秒；800 段长文、6 种宽度 2.74 秒（第 7 轮 5.3 秒）。与 `RG-02-scale.log` 的量级一致 |
| RG-03 | Low | **基本修好，留一处（RH-01）** | `G-RG03-delete-visible`、`G-RG03-frame-part` 已补成回归测试；「轮流可见」没补，见 RH-01 |

### 选择器缓存会不会改变写法

审计方的做法：在真实浏览器里，对 golden 和对照组共 80 个页面、4496 个直接文字有中文的元素，逐个比较三种算法的输出：

- 第 7 轮的旧写法（每次遍历兄弟节点）；
- 本轮的缓存写法（`nthOf`、`selCache`，从源码逐字照抄）；
- `model.ts` 的 `selectorOf`（对同一份 DOM 序列化后用 htmlparser2 建模）。

结果：`diffOldNew: 0`，`diffModel: 0`。缓存没有改变写法，和基础档仍然逐字一致。

### 前几轮的复现页

`drawer-portal`、`drawer-clone`、`same-id`、`collide`、`hit-text-t11`、`append`、`spa-placeholder`、`vertical-lh`，以及 RA-01 的路径穿越页 `trav.html`，结果与上一轮一致：都判 fail，工作区外没有新文件。

### 锁定测试

- `git log 9435180..HEAD -- test/` 无输出；`w2-render-audit-r7` 的 MANIFEST 校验全部 OK。
- 整改前的证据：`G-RG01-cap` 失败，另两页通过，与执行方的说明一致。

### golden 与对照组

- golden 20 页：0 error、3 warn；
- claude-code：211 个 error、211 张截图，排除 T02/T04 后零 error 9/30，保留 0 条；
- codex：800 个 error、800 张截图，保留 10 条，重复 0 条。

都与报告 §3、`RV-13.json`（codex 37700ms、800 张；claude-code 18343ms、211 张）、`RG-kept-reasons.log` 一致。

---

## 4. 对执行方报告 §7 的裁定

| 编号 | 问题 | 裁定 | 理由 |
|---|---|---|---|
| 1 | 元素清单不再截断，Node 一侧 20 万个上限、超过时整页记为没检查完，是否堵住了 RG-01 | **同意，已堵住** | 审计方的 5200、6000、20000 个元素的页面，包括走文字回退路径的那一种，都判断正确。超过 20 万个的那条路径没有实测（页面太大，在单页 15 秒内跑不完），审计方只核对了代码：`mergeIds` 返回 false，就整页记为 incomplete，原因写进 `problems`，不会静默截断。方向正确。 |
| 2 | 除了选择器缓存和身份索引，是否还需要其他性能处理 | **不需要** | 耗时已经基本是线性的：5100 个同级元素单宽度约 2 秒，800 段长文 6 种宽度约 2.7 秒，都远低于 15 秒的上限。`bench/render-scale.mjs` 可以留作今后改动时的耗时基准，不需要再加处理。 |

---

## 5. 审计方亲自运行的命令和关键输出

全部在本机运行（系统 Chrome 155.0.8059.86，playwright-core 1.64.1），没有联网，没有安装依赖，没有运行 `bench/run-baseline.mjs`。

1. **锁定测试有没有被改**

   ```
   $ git log --format='%h %s' 9435180..HEAD -- test/                                                     → 无输出
   $ (cd test/fixtures/w2-render-audit-r7 && shasum -a 256 -c MANIFEST.sha256) | grep -vc OK             → 0
   ```

2. **构建和全量测试**（含前七轮的全部回归测试）

   ```
   $ npm run build && npm test
   ℹ tests 221
   ℹ pass 221
   ℹ fail 0
   EXIT=0
   ```

3. **元素清单和前几轮的复现页**（`t1.mjs`）：

   ```
   == cap2.html          | static: fail e=1 | render: fail e=1 1941ms（360、1280）
   == cap2-ctl.html      | static: fail e=1 | render: fail e=1 1068ms
   == cap-text.html      | static: fail e=1 | render: fail e=1 2020ms
   == cap-20k.html       | static: fail e=1 | render: fail e=1 5424ms
   == drawer-portal.html | static: fail e=3 | render: fail e=3
   == drawer-clone.html  | static: fail e=3 | render: fail e=3
   == same-id / collide / hit-text-t11 / vertical-lh | render: fail，与上一轮一致
   == append / spa-placeholder                       | static: pass | render: fail（DOM 快照补报）
   == trav.html          | render: fail e=2（RA-01 的路径穿越页，工作区外没有新文件）
   ```

4. **选择器一致性**（`sel.mjs`，用 playwright-core 打开 80 个页面）：

   ```
   { pages: 80, els: 4496, diffOldNew: 0, cmpModel: 4496, diffModel: 0 }
   ```

5. **耗时**（`t2.mjs`）：

   ```
   s1000.html 1w: pass 979ms
   s2000.html 1w: pass 1000ms
   s3000.html 1w: pass 1281ms
   s5100.html 1w: pass 2044ms
   s3000-6w.html 6w: pass 1750ms
   long800.html 6w: pass 2739ms
   ```

6. **golden 与对照组**（复制到 `/tmp` 后跑 6 种宽度）：

   ```
   golden         {"errors":0,"warns":3,"status":"pass"} kept 0 dup 0 dom 0 problems 0
   rv-claude-code {"errors":211,"warns":146,"status":"fail"} excl 9 shots 211 kept 0 dup 0 dom 0 problems 0
   rv-codex       {"errors":800,"warns":302,"status":"fail"} excl 0 shots 800 kept 10 dup 0 dom 0 problems 0
   ```

7. **收尾**：`/tmp/r8audit/` 和构建日志已删除；`git status --porcelain` 只显示本文件。

---

## 6. 需要用户拍板的事项

| 编号 | 事项 | 审计方意见 |
|---|---|---|
| R-D1 | 是否按 PRD_RENDER_PROPOSAL 第 8 版的改动 1–4 修改 PRD（playwright-core、实测口径与按元素合并、网络策略、数据模型），并新增附录 C23–C26 | 推荐同意。按元素合并的口径经过 8 轮对抗复核，已经稳定 |
| R-D2 | 检查本地文件时不允许访问 localhost（包括 TCP 连接） | 推荐同意 |
| D-A1 | T05 按每行汉字数统计，全角标点也算字（会让门槛实际上变严） | 推荐同意（不阻塞） |
| D-A2 | 页面脚本照常执行，测量放进隔离环境 | 推荐同意（不阻塞） |
