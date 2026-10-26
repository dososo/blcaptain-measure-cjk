# 小红书 3:4 卡片场景

## 尺寸和模板

- 卡片固定 1080×1440，`body` 写死宽高、`overflow: hidden`。
- 三种模板在 `assets/cards/`：
  - `cover.html`：图文封面，有标题、副标题、三条要点；
  - `list.html`：清单卡，带编号的要点；
  - `quote.html`：引语卡，一句话加出处。
- 只改文字，保持留白：
  - 四周边距不少于 72px；
  - 标题不超过两行；
  - 正文每行不超过 26 个字；
  - 序号、引号、装饰符号直接写在 HTML 里，不用 CSS 计数器或 `::before` 生成（生成的字不在源码里，容易用到没准备的字体；`card` 也会检查伪元素里的字）。
- 卡片写成静态页面：
  - 不用 canvas、iframe、object、embed、video，也不用带文字的 SVG 图片。这些地方的字用什么字体查不到，`card` 会判为没检查完；
  - 动画和过渡在导出时会被去掉，导出的是去掉动画之后的样式；
  - 不要用脚本在加载后改页面。检查期间页面有变化，`card` 判为没检查完。
- 视觉：米纸、墨、青瓷、朱砂，一张卡片最多两个强调色；不用紫色渐变、玻璃拟态、emoji 图标。

## 字体（F06）

1. 卡片上的字体只能用授权表里 `commercial_image` 为 `true` 的（🟢 和 🔵 两档）。先用 `measure-cjk fonts "<字体名>"` 查。
2. 把字体文件（TTF、OTF、TTC、WOFF、WOFF2）放进工作区里的一个目录，作为 `font_dir`。限制：
   - 单个文件不超过 64 MB，最多 50 个；
   - 仓库里不要提交字体文件。
3. CSS 的 `font-family` 写字体文件里的名字，例如 `"LXGW WenKai", "霞鹜文楷"`。`card` 按字体文件内部的名字查授权表，不看文件名。
4. `font-family` 里不要写不能商用出图的字体（例如方正兰亭黑）。即使 `font_dir` 里没有这份文件、浏览器换成了别的字体，`card` 也不出图。
5. 微软雅黑只能从本机系统字体目录调用，不能放进 `font_dir`。苹方按不允许出图处理。
6. 字体必须覆盖卡片上的全部文字，包括伪元素、输入框、占位文字里的字。缺字时浏览器会回退到系统字体，回退到的系统字体也要能商用出图，否则不出图。

## 导出

```bash
node <measure-cjk 仓库>/packages/cli/bin/measure-cjk.js card card.html --out card.png --font-dir fonts --result card-result.json
```

- 退出码 0：已导出 PNG。
- 退出码 1：没导出。原因写在结果里，可能是用到了不能商用出图的字体（包括回退到的系统字体），或者卡片本身有 lint error。按原因修改后重试，不要关掉规则。
- 退出码 2：没检查完（超时、页面加载后跳转、有查不到字体的内容、检查期间页面有变化），或者用法错误、没装 Playwright。
- 结果里的 `attribution` 不为空时（例如 MiSans、HarmonyOS Sans），发布卡片时要按官方要求注明字体来源。
- `card` 只认 `font_dir` 里的字体：
  - 卡片页面自己用 `@font-face` 引用的字体文件会被拦截；
  - 用 `data:`、`blob:` 地址或 FontFace API 带进来的字体拦不住，只要加载了就不出图。
- 卡片的 lint 和导出是同一次渲染：1080×1440，用 `font_dir` 里的字体。
- lint 有 error 时会截图，默认写进输出 PNG 旁边的 `evidence/`，同名文件会被覆盖。用 `--evidence <目录>` 可以换目录，结果里的 `lint.run.render.evidence_dir` 记录了实际的目录。
- 用到的系统字体由操作系统决定。同一张卡片在不同系统上结论可能不同，以运行 `card` 的这台机器为准。
