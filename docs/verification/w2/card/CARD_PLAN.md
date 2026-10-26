# W2 第二段：`card` 命令（小红书 3:4 卡片导出）方案

| 项 | 内容 |
|---|---|
| 当前步骤 | 8 步流程第 2–3 步「分析、计划」 |
| 执行方 | Claude Code |
| 依据 | PRD §5.2 F06、§5.3「场景出口」、§5.4 命令表和「卡片导出的字体」、§11 AC-9、§12 O5（1080×1440） |
| 状态 | **用户已拍板（2026-10-26）**，D-C1 至 D-C7 全部按推荐；原话见同目录的 `open_decisions.json` |

---

## 1. 要做什么

```
measure-cjk card <html> --out card.png [--font-dir <目录>] [--format text|json] [--result <结果.json>]
```

1. 在 1080×1440 的视口里渲染卡片页面，导出同样大小的 PNG。
2. **F06 字体检查：** 查出卡片实际用到的每一款字体，对照授权表，只有 `commercial_image: true` 的才放行。
3. 要求署名的字体（`attribution_required: true`，如 MiSans、HarmonyOS Sans），在结果里附上署名提示。
4. 卡片本身也要过完整档的 lint（AC-9：零 error），宽度用 1080。
5. 3 种卡片模板，外加 AC-9 用的示例 `examples/card.html`。

## 2. 关键设计

### 2.1 怎么知道卡片「实际用到了哪些字体」

只看 CSS 里写了什么字体不够：缺字时，浏览器会悄悄回退到系统字体。

**方案：** 用 Chrome 开发者协议的 `CSS.getPlatformFontsForNode`，逐个文本节点查出实际渲染用的字体。返回值包括：
- 家族名；
- PostScript 名；
- 是不是页面加载的字体；
- 用了多少个字形。

**已核实：**
- 来源是 Chrome 官方协议定义 `ChromeDevTools/devtools-protocol` 的 `pdl/domains/CSS.pdl`，2026-10-26 读取。这个命令本身没有实验标记，但整个 CSS 域标为 experimental，Chrome 升级后可能变动。
- 本机 Chrome 155 实测：声明了 Noto Sans SC 但本机没有时，它如实报出实际用的是「PingFang SC」。

### 2.2 字体从哪来

PRD 原文是「`card` 命令只使用 `font_dir` 里用户自己准备的字体文件」。

- `card` 读取 `font_dir` 里的字体文件，从文件内部的 name 表读出字体名。支持 TTF、OTF、TTC、WOFF、WOFF2，解析代码自己写，不加依赖。
  - name 表的格式：Microsoft OpenType 规范 name 章节；
  - WOFF2 的格式：W3C WOFF2 规范。
  - 两份都在 2026-10-26 读取。
- 用这些名字查授权表，只有 `commercial_image: true` 的字体才会注入页面（`@font-face`，从本地文件读）。
- 卡片页面自己引用的其他字体文件一律拦截，和完整档的网络规则一样。
- **系统字体：** 浏览器回退到的系统字体也按授权表判断。例外是 F06 写明的微软雅黑：原文允许出图，但只能从系统字体目录调用，不能放进 `font_dir`。所以微软雅黑出现在 `font_dir` 里时拒绝。苹方按不允许处理。授权表里查不到的字体，一律不放行。

### 2.3 安全

- `font_dir` 必须在工作区内（realpath 后判断），不能是符号链接。
- 字体文件的大小上限见 §4 D-C3。
- 输出的 PNG 和结果 JSON 用 tmp-then-rename 原子写入；只能写 `.png`、`.json`，不能覆盖已有的非卡片文件。规则同 `--out`。
- 页面渲染沿用完整档的隔离和网络拦截：不访问 localhost，不联网。

### 2.4 结果格式（需要写进 PRD，见 §4 D-C7）

```ts
export interface CardResult {
  schema_version: string;
  input: string;                  // 卡片 HTML，相对工作区
  output?: string;                // 导出的 PNG（相对工作区）；没导出时没有这个字段
  size: { width: 1080; height: 1440 };
  status: "exported" | "rejected" | "incomplete";
  fonts: {
    family: string;               // 浏览器报告的字体名
    postscript_name: string;
    source: "font_dir" | "system";
    file?: string;                // font_dir 里的文件（相对工作区）
    license_id?: string;          // 授权表条目；查不到时没有
    commercial_image: boolean | "unknown";
    allowed: boolean;
    reason: string;               // 中文，说明放行或拒绝的原因，附原文链接和核验日期
    glyph_count: number;
  }[];
  attribution: { family: string; license_id: string; note: string }[];  // 要求署名的字体
  lint: LintResult;               // 卡片按完整档 lint 的结果（宽度 1080）
}
```

## 3. 测试怎么做

- **仓库里不放字体文件（硬约束 H3，V-02 会检查）。** 测试时，在临时目录里用代码生成最小的合法字体文件：
  - 只有一个方框字形，覆盖卡片里用到的全部字符；
  - name 表写成授权表里的字体名，例如「Noto Sans SC」（🟢 放行）、「MiSans」（🔵 放行，要求署名）、「苹方」（不放行）、「方正兰亭黑」（🔴 不放行）、查不到的名字（不放行）。
  - 这样可以测授权判定、署名提示、回退检测，不涉及任何真实字体的文件。
  - 测试结束就删除，不提交，不分发。
- **先写夹具和测试并锁定，再实现。** 和完整档的流程一样，完成后交独立审计。
- **真实字体的效果**（AC-9 的「用到的字体全部满足 commercial_image: true」）：需要用一款真实的 🟢 字体跑一次，见 §4 D-C6。

## 4. 开放决策（需要你拍板）

| 编号 | 问题 | 推荐 | 备选 |
|---|---|---|---|
| D-C1 | F06 按什么判断「用到的字体」？ | **按浏览器实际渲染用到的字体（§2.1）**，包括缺字时回退的系统字体。后果：Mac 上卡片的中文如果回退到苹方，会被拒绝出图，必须在 `font_dir` 里放好字体并在 CSS 里用上 | 只检查 `font_dir` 里的字体和 CSS 声明，不管回退；更宽松，但可能出了图才发现用的是不能商用的系统字体 |
| D-C2 | 有 error 时还导出 PNG 吗？ | **不导出。** 字体不合规或 lint 有 error，都不写 PNG，退出码 1，结果里列出原因 | 照常导出 PNG，退出码 1 |
| D-C3 | `font_dir` 里单个字体文件的大小上限 | **64 MB**，最多 50 个文件。中文字体常见 10–20 MB，现有输入文件的 5 MB 上限不够用 | 32 MB |
| D-C4 | 3 种模板放哪、做哪 3 种 | **放在 `skills/measure/assets/cards/`：** ① 图文封面（大标题、副标题、三条要点）；② 清单卡（编号要点）；③ 引语卡（一句话加出处）。视觉按 `dososo-design-system`：米纸、墨、青瓷色板，不用紫渐变、玻璃拟态、emoji 图标 | 你指定其他 3 种 |
| D-C5 | 测试用「代码生成的方框字体，名字写成真实字体名」 | **同意。** 只在测试的临时目录里生成，用完删除，不提交、不分发 | 只用你提供的真实字体测试 |
| D-C6 | AC-9 的真实字体验收用哪款字体、怎么获取 | **霞鹜文楷（OFL-1.1，🟢）**，从官方 GitHub 发布页下载 `LXGWWenKai-Regular.ttf`（v1.530，2026-10-17 发布，25,928,940 字节，约 24.7 MB；地址 `https://github.com/lxgw/LxgwWenKai/releases/download/v1.530/LXGWWenKai-Regular.ttf`；仓库 license 为 OFL-1.1，2026-10-26 用 GitHub API 核对），放在仓库外的 `deliverables/fonts-for-test/`，不进 git。**下载要你同意。** MiSans 的署名提示用 D-C5 的生成字体测 | 你自己下载一款字体放到指定目录 |
| D-C7 | PRD 变更 | 实现完成后，把 §2.4 的结果格式、F06 的判定口径（D-C1）、`font_dir` 的限制（D-C3）、模板位置（D-C4）写成提案交你确认，确认后再写进 PRD 附录 C | 先改 PRD，再实现 |
