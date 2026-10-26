# 分寸 · Measure（measure-cjk）W2 第 3 步展示页 · 复核（r3）

| 项 | 内容 |
|---|---|
| 当前步骤 | 8 步流程第 7 步「审计验收」：第二次复核 |
| 审计方 | Claude Code（独立审计） |
| 被审对象 | HEAD `a9e1a63`；响应矩阵 `docs/verification/w2/showcase/AUDIT_RESPONSE_SHOWCASE.md` §4 |
| 范围 | 只复核 SA-03 的剩余部分和 R2-01，并看台账补登的 SA-04、SA-06 两处 |

---

## 1. 结论：**达标**

| 编号 | 复核结论 |
|---|---|
| SA-03 | **关闭** |
| R2-01 | **关闭** |
| SA-04（台账） | 补全，属实 |
| SA-06（台账） | 登记属实。用户已拍板（S-D2），但还没执行：现有 3 张截图里仍然有 Zapf Dingbats 或 Apple Color Emoji。**这一项必须在展示页对外发布之前完成**，见 §3 |

至此，AUDIT_SHOWCASE 的 3 条 High（SA-01、SA-02、SA-03）和 r2 新增的 R2-01 全部关闭。Medium、Low 按用户规则记台账。另有一条新的 Low（R3-01），记台账，不影响结论。

---

## 2. 逐条复核

### SA-03 · High → 关闭

- `grep -c "覆盖四类" site/index.html` 的结果是 0。
- 「怎么挑的」一条现在写的是「每个 Agent 各挑两组，偏向问题多、看得出差别的页面」，后面跟着脚本算出的排名：第 4、4、7、14。还写明了 Claude Code 不装时有一半页面零 error，并列出装了之后仍报 error 的页。整段没有和事实不符的说法。

### R2-01 · High → 关闭

- **数字核对：** `showcase.json` 的 `card_sensitivity` 由脚本从 `results.json` 和各页的 `lint-render.json` 算出，和我 r2 自己算的一致：

  ```
  {"codex":{"affected_pages":1,"zero_error_control":1,"zero_error_measure":30,"better":29,"same":1,"worse":0,"p":3.725e-9},
   "claude-code":{"affected_pages":5,"zero_error_control":20,"zero_error_measure":27,"better":9,"same":18,"worse":3,"p":0.14599609375}}
  ```

  claude 这组和 r2 的独立验算完全一致：20/30 → 27/30，9/18/3，p = 0.1460。codex 只有 029 一页受影响，结果是 29/1/0，p = 3.7e-9，我手算也是这个值。
- **页面：** 数字区的小字里加了一条（`site/index.html` 第 105 行）。这一条把 claude「不再显著」、codex「仍然显著」都写出来了，并注明「卡片的导出尺寸是假设，这只是估算」。主数字没改，和 N-D1 的先例一致。
- **其他落点：**
  - 北极星报告 §4 加了第 12 条已知局限，数字和页面一致；
  - `open_decisions.json` 新增 N-D3（补不补算附加列），`resolved: false`，等用户拍板；
  - 响应矩阵 §2 的 N-SC1 补写了它对首屏数字的影响。
- **复现：** 跑 `npm run build && node bench/showcase-build.mjs && node site/_build.mjs`，`git diff --stat` 只有 `site/showcase.json` 一行改动（`generated_at`），截图和 `index.html` 没有变化。跑完已用 `git checkout -- site` 恢复。
- **展示页自身 lint：** `lint site/index.html --render` 结果是「通过：1 个文件（含中文 1 个），0 个 error，0 个 warn」，在 6 个宽度下实测，退出码 0。

### R3-01 · Low（新，记台账）· codex 的卡片敏感性是按「最坏情况」算的，说明文字说得太满

- **位置：** `bench/showcase-build.mjs` 的 `cardSensitivity`；`site/index.html` 第 105 行 Codex 那半句。
- **问题：** 脚本只按「排除 T02、T04 后只剩 T11」来判断哪些页受影响，没有真的按卡片宽度去换算。我 r2 量过，codex 029 的卡片宽 900，最小汉字 4.95px，换算成 1080 宽导出约 5.9px，按卡片口径**仍然违规**。可页面写的是「卡片按导出尺寸换算后，这几页可能不算违规」，对 codex 029 来说不对。
- **影响：** 这样算只会让 codex 的结果看起来更差。即便如此，结论仍然是 p < 0.0001、显著，不构成夸大。claude 的 5 页我 r2 逐页量过，换算后都在 18.7px 以上，那半句是对的。
- **修法：** 让脚本真的按「最小汉字字号 × 1080 ÷ 卡片宽度」判断每页，或者把 Codex 那半句改成「按最坏情况计」。

---

## 3. 台账补登核对

| 编号 | 核对 |
|---|---|
| SA-04 | **补全，属实。** 「真实页面」一节第 177 行加了一句：「图注里的数字是整页的问题数；红框只画在截图范围内、而且 lint 给出了位置的问题……所以框数会比图注里的数字少」。这正是 r2 指出缺的那句 |
| SA-06 | **登记属实，但还没执行。** `open_decisions.json` 新增 S-D2，`resolved: true`，附有 `user_quote` 和 `user_message_verbatim`。用户的决定是「不让系统 emoji 和符号字体出现在公开截图里」，换成 Noto Color Emoji 和 Noto Sans Symbols 2，下载前要先报文件名和大小。矩阵状态写的是「待下载」。我看到的现状：`showcase.json` 的 `fonts` 里还有 3 张图用到系统字体：`real-codex-008-control.jpg`（Zapf Dingbats）、`real-codex-011-measure.jpg`（Zapf Dingbats）、`real-claude-code-004-control.jpg`（Zapf Dingbats、Apple Color Emoji）。**在 S-D2 执行完、这 3 张图重新截好之前，展示页不能对外发布**，否则和用户的明确决定相反。另外，S-D2 的用户原话我只能看到执行方记下的文本，没法独立核对，**待确认**（请协调方对照对话原文） |

---

## 4. 审计方亲自跑过的命令

全部在 HEAD `a9e1a63` 上执行，没有新建临时文件。

| # | 命令 | 结果 |
|---|---|---|
| Q1 | `git log --oneline -3 && git status --short`；`git show --stat HEAD`；`git diff HEAD~1 HEAD -- bench/showcase-build.mjs site/_build.mjs docs/verification/w2/northstar/open_decisions.json docs/verification/w2/northstar/VERIFICATION_REPORT.md` | HEAD `a9e1a63`，工作树干净；逐行看过改动 |
| Q2 | `node -e` 读 `site/showcase.json` 的 `card_sensitivity`，以及 `fonts` 里用到的系统字体 | 见 §2 R2-01 和 §3 SA-06 |
| Q3 | `grep -n` 页面里的三段新增文字；`grep -c "覆盖四类" site/index.html` | 第 105、177、178 行；`覆盖四类` 的计数是 0 |
| Q4 | `node packages/cli/bin/measure-cjk.js lint site/index.html --render --evidence site/.evidence` | 0 个 error、0 个 warn，6 个宽度，退出码 0 |
| Q5 | `npm run build && node bench/showcase-build.mjs && node site/_build.mjs && git diff --stat`，然后 `git checkout -- site` | `示意 7 组（都通过 lint 验证）；真实页面 4 组；截图 22 张……`；只有 `site/showcase.json` 一行改动（`generated_at`）；恢复后工作树干净 |
| Q6 | `git diff HEAD~1 HEAD -- docs/verification/w2/showcase/AUDIT_RESPONSE_SHOWCASE.md` | SA-04、SA-06、N-SC1 的改动和 §4 新增的内容，和实际改动对得上 |
