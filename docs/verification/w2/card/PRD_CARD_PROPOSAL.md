# PRD 变更提案：`card` 命令（小红书卡片导出）

**状态：用户已确认（2026-10-26，R-C1）。** 用户原话：「R-C1 同意：按 PRD_CARD_PROPOSAL 的改动 1–3 修改 PRD，新增附录 C27–C29。」改动 1–3 已写进 `docs/PRD.md`（§5.3、§5.4、§7.1、§7.3），附录 C 新增 C27–C29。

说明：§7.1 原本就列了 `references/scenarios/{web,xhs-card}.md`，所以改动 3 只加了 `assets/cards/` 和 `examples/card.html`。

**依据：**
- 用户 2026-10-26 拍板 D-C1 至 D-C7，原话见 `open_decisions.json`；
- PRD §5.2 F06、§5.3「场景出口」、§5.4、§11 AC-9。

---

## 改动 1：§5.4「卡片导出的字体」补充判定口径（C27）

在现有 3 条后面加上：

> - **按实际渲染判断（D-C1）：** 用 Chrome 开发者协议的 `CSS.getPlatformFontsForNode`，逐个含文字的元素查出浏览器实际用到的字体，包括缺字时回退的系统字体。
>   - 来源：Chrome 官方协议定义 `ChromeDevTools/devtools-protocol` 的 `pdl/domains/CSS.pdl`，2026-10-26 读取。
>   - 这个命令本身没有实验标记，但整个 CSS 域标为 experimental，Chrome 升级后可能变动。
> - **`font_dir` 里的字体：**
>   - 按字体文件 name 表里的名字（1、4、6、16 号，含本地化名）查授权表，`commercial_image` 为 `true` 的才注入页面；
>   - 支持 TTF、OTF、TTC、WOFF、WOFF2，解析时做越界检查，解压设上限；
>   - 单个文件 ≤ 64 MB，最多 50 个，超过个数时退出码 2（D-C3）；
>   - `font_dir` 必须在工作区内，不能是符号链接。
> - **微软雅黑：** 放进 `font_dir` 的不加载；从系统字体目录调用时放行（F06）。苹方按不允许出图处理。
> - **系统字体：** 浏览器实际用到的系统字体也按授权表判断，`commercial_image` 不是 `true`、或者查不到时，不出图。
> - **卡片点名要用、但不允许出图的字体：** 例如 `font-family` 里写了方正兰亭黑，即使浏览器回退到了别的字体，也不出图，并说明原因、附原文链接（对应场景 S2）。
> - **拦截：** 卡片页面自己用 `@font-face` 引用的字体文件一律拦截。网络规则同完整档：只读工作区内的 `file://`，不访问 localhost，不联网。
> - **有 error 不出图（D-C2）：** 字体不合规，或者卡片按完整档 lint（宽度 1080）有 error，都不写 PNG，退出码 1。没检查完（超时、加载后跳转等）时退出码 2。

## 改动 2：§5.4 命令表、§7.3 数据模型（C28）

1. 命令表 `card` 一行改为：

   > `measure-cjk card <html> --out card.png [--font-dir <目录>] [--result <结果.json>] [--format text|json]`。退出码：0 已导出；1 没导出（字体不合规或卡片有 error）；2 没检查完、用法错误或环境问题。

   `--out` 只能是 `.png`，必须在工作区内；已有的文件必须本来就是 PNG，否则拒绝覆盖。`--result` 的规则同 `lint --out`。

2. §7.3 新增 `CardResult`：

   ```ts
   export interface CardResult {
     schema_version: string;
     tool: { name: "measure-cjk"; version: string };
     input: string;                    // 卡片 HTML，相对工作区
     output?: string;                  // 导出的 PNG；没导出时没有
     size: { width: 1080; height: 1440 };
     status: "exported" | "rejected" | "incomplete";
     fonts: {
       family: string;
       names?: string[];               // font_dir 里的字体：文件里的全部名字
       postscript_name: string;
       source: "font_dir" | "system";
       file?: string;
       license_id?: string;
       tier?: FontTier;
       commercial_image: boolean | "unknown";
       allowed: boolean;
       used: boolean;                  // 实际用它渲染了文字
       requested?: boolean;            // 卡片的 font-family 点名要它
       reason: string;                 // 中文，附原文链接和核验日期
       glyph_count: number;
     }[];
     attribution: { family: string; license_id: string; note: string }[];
     blocked: string[];                // 被拦截的字体文件和其他请求
     skipped_fonts: { file: string; reason: "too-large" | "unreadable" | "symlink" | "outside-root" }[];
     problems: string[];               // 没导出、没检查完的原因
     lint: LintResult;                 // 卡片按完整档 lint 的结果（宽度 1080）
   }
   ```

## 改动 3：§7.1 仓库结构、§5.3 模板（C29）

- §7.1 的 `skills/measure/` 下加上 `assets/cards/{cover,list,quote}.html`（D-C4）和 `references/scenarios/xhs-card.md`；仓库根目录加上 `examples/card.html`（AC-9 用的示例，基于图文封面）。
- §5.3「场景出口」小红书卡片一行的「模板 3 种」写明：图文封面、清单卡、引语卡；字体用霞鹜文楷（🟢，OFL-1.1）；视觉按 `dososo-design-system`，用米纸、墨、青瓷、朱砂，不用紫渐变、玻璃拟态、emoji 图标。

---

## 不改 PRD、但需要说明的

- **测试字体：** 测试用代码在临时目录里生成方框字体（D-C5），仓库里不放字体文件，V-02 和 CV-07 都会检查。
- **AC-9 的真实字体验收：** 用霞鹜文楷 v1.530（D-C6），从官方 GitHub 下载到仓库外的 `deliverables/fonts-for-test/`，SHA-256 `2d73eea9…`。验证脚本 CV-08 按这个哈希核对；本机没有这份字体时判 BLOCKED_ENV。
- **F06 规则的状态：** `rules` 命令里，F06 标为已实现，由 `card` 命令检查。

## 开放决策

1. ~~**R-C1：是否按本提案的改动 1–3 修改 PRD，并新增附录 C27–C29？**~~ 用户已同意（2026-10-26）。
