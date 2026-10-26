// 完整档在浏览器页面里执行的测量函数。它们在 CDP 创建的隔离环境（isolated world）里运行（render.ts 的 inWorld）：
// 和页面脚本共享 DOM，但全局对象和原型链各自独立，页面改写不了这里用到的 getComputedStyle、Range、数组方法（RA-01、RA-02）。
// 函数会被序列化成字符串送进页面执行，所以每个函数都必须自包含：不能引用本文件以外的任何变量，也不能用 import。
// 元素的选择器写法和基础档 model.ts 的 selectorOf 保持一致，方便两边的结果对上号。

export interface ProbeOptions {
  key: string; // 隔离环境里登记元素列表用的属性名
  spacingCss: boolean;
  lineWarn: number;
  lineError: number;
  lineHeightMin: number;
  minBodyPx: number;
}

export interface ProbeItem {
  rule: string;
  severity: "error" | "warn";
  idx: number;
  selector: string;
  text: string; // 元素直接文字的前 24 个字符，用来和源码的行号对应（RA-16）
  ord: number; // 同一「选择器 + 文字」里排第几（RE-01）
  message: string;
}

export interface ProbeResult {
  autospaceSupported: boolean;
  visible: number; // 本宽度下可见的中文元素个数
  // 元素的身份是「选择器 + \u0001 + 文字指纹 + \u0001 + 序号」（序号是同一选择器加文字里的第几个，RE-01）。ids：页面上登记过的全部元素（含不可见的）；
  // checked：按规则记录本宽度下真的做了检查的元素（RB-02、RC-01：按规则、按元素合并基础档的结果）
  ids: string[];
  checked: Record<string, string[]>;
  items: ProbeItem[];
}

export function measurePage(o: ProbeOptions): ProbeResult {
  const HAN = /\p{Script=Han}/u;
  const HAN_G = /\p{Script=Han}/gu;
  // 行长按「字」计：汉字加全角标点，标点占一个字位（clreq）；西文字母、数字、空格不计（D-A1）
  const ZI = /[\p{Script=Han}　-〿！-｠‘’“”—…]/u;
  const CTRL = /[\p{Cc}\p{Cf}]/gu;
  const NON_RENDERED = "head,script,style,noscript,template,title,textarea";
  const CODE = "code,pre,kbd,samp";
  const BLOCK = new Set(["p", "li", "h1", "h2", "h3", "h4", "h5", "h6", "td", "th", "dd", "dt", "blockquote", "figcaption", "caption", "div", "section", "article", "aside", "header", "footer", "main", "nav", "label", "legend", "summary", "address", "button", "option"]);
  const HIDDEN_CLASSES = /(^|\s)(sr-only|visually-hidden|screen-reader-text|visuallyhidden)(\s|$)/;
  // 行首禁则（clreq）：句号、逗号、顿号、分号、冒号、问号、叹号、结束引号、结束括号、结束书名号、连接号、间隔号、分隔号
  const NO_LINE_START = "、。，．：；？！）］｝〕〉》」』】〙〗〟’”｠～・·／";
  const TRACKING = /^(?:[\w-]+:)*tracking-(tight|tighter|tightest)$/;
  const W = window.innerWidth;
  const clean = (s: string, n: number) => s.replace(CTRL, "").replace(/\s+/g, " ").trim().slice(0, n);

  // 选择器写法和 model.ts 的 selectorOf 一致。:nth-of-type 的序号按父元素一次算好、整页缓存，
  // 避免同一父元素下元素很多时反复遍历兄弟节点，耗时随元素个数超线性增长（RG-02）
  const nthCache = new Map<Element, string>();
  const nthOf = (e: Element): string => {
    const hit = nthCache.get(e);
    if (hit !== undefined) return hit;
    const parent = e.parentElement;
    if (!parent) return "";
    const total = new Map<string, number>();
    for (const c of Array.from(parent.children)) total.set(c.localName, (total.get(c.localName) ?? 0) + 1);
    const seen = new Map<string, number>();
    for (const c of Array.from(parent.children)) {
      const k = (seen.get(c.localName) ?? 0) + 1;
      seen.set(c.localName, k);
      nthCache.set(c, (total.get(c.localName) ?? 0) > 1 ? `:nth-of-type(${k})` : "");
    }
    return nthCache.get(e) ?? "";
  };
  const selCache = new Map<Element, string>();
  const selectorOf = (el: Element): string => {
    const hit = selCache.get(el);
    if (hit !== undefined) return hit;
    const parts: string[] = [];
    let e: Element | null = el;
    while (e && parts.length < 4) {
      const name = e.localName;
      if (name === "html" || name === "body") break;
      let part = name;
      const id = e.getAttribute("id");
      const cls = e.getAttribute("class");
      if (id) part += `#${id}`;
      else if (cls) part += `.${cls.trim().split(/\s+/)[0]}`;
      part += nthOf(e);
      parts.unshift(part);
      e = e.parentElement;
    }
    const sel = parts.join(" > ") || el.localName;
    selCache.set(el, sel);
    return sel;
  };

  const directText = (el: Element): Text[] => Array.from(el.childNodes).filter((n): n is Text => n.nodeType === 3);
  const hanIn = (s: string) => (s.match(HAN_G) ?? []).length;
  const fingerprint = (el: Element) => clean(directText(el).map((t) => t.data).join(""), 24);

  const textRects = (el: Element): DOMRect[] => {
    const out: DOMRect[] = [];
    for (const t of directText(el)) {
      const r = document.createRange();
      r.selectNodeContents(t);
      for (const x of Array.from(r.getClientRects())) if (x.width > 0 && x.height > 0) out.push(x);
    }
    return out;
  };

  // display: contents 的元素自己没有盒子，可见性和位置按它的文字算（RA-04）
  const visible = (el: Element): boolean => {
    if (el.closest("[hidden]")) return false;
    for (let e: Element | null = el; e; e = e.parentElement) if (HIDDEN_CLASSES.test(e.getAttribute("class") ?? "")) return false;
    if (getComputedStyle(el).display === "contents") return textRects(el).length > 0;
    const check = (el as Element & { checkVisibility?: (o: object) => boolean }).checkVisibility;
    if (check && !check.call(el, { checkVisibilityCSS: true, visibilityProperty: true })) return false;
    const r = el.getBoundingClientRect();
    return r.width > 1 && r.height > 1;
  };

  // 某个元素「自己的」文字：后代文本节点里，最近的块级祖先就是它本身的那些（嵌套的块级元素各自统计）
  const ownText = (el: Element): Text[] => {
    const out: Text[] = [];
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    for (let n = walker.nextNode() as Text | null; n; n = walker.nextNode() as Text | null) {
      let p = n.parentElement;
      while (p && p !== el && !BLOCK.has(p.localName)) p = p.parentElement;
      if (p === el && !n.parentElement?.closest(NON_RENDERED)) out.push(n);
    }
    return out;
  };

  const charRect = (t: Text, i: number): DOMRect | null => {
    const r = document.createRange();
    r.setStart(t, i);
    r.setEnd(t, i + 1);
    const list = r.getClientRects();
    return list.length ? list[0] : null;
  };

  // 段落自己或祖先是多栏排版
  const multicol = (el: Element): boolean => {
    for (let e: Element | null = el; e; e = e.parentElement) {
      const cs = getComputedStyle(e);
      if (cs.columnCount !== "auto" || cs.columnWidth !== "auto") return true;
    }
    return false;
  };

  // 按阅读顺序逐字归行，返回每行的「字」数（RA-08、D-A1）。
  // 新一行的判断：垂直位置变了，或者往左回绕；只有多栏排版里，和前一个字隔开超过 1.5 个字号（跳到下一栏）才也算新的一行（RB-06）
  const linesOf = (el: Element, fs: number): number[] => {
    const cols = multicol(el);
    const lines: number[] = [];
    let prev: DOMRect | null = null;
    let cur = 0;
    let seen = 0;
    for (const t of ownText(el)) {
      for (let i = 0; i < t.data.length && seen < 6000; i++) {
        const ch = t.data[i];
        if (!ch.trim()) continue;
        seen++;
        const r = charRect(t, i);
        if (!r || r.width === 0) continue;
        const same = prev !== null && Math.abs(r.top + r.height / 2 - (prev.top + prev.height / 2)) < Math.max(r.height, prev.height) / 2 && r.left >= prev.left - 1 && (!cols || r.left - prev.right < fs * 1.5);
        if (prev && !same) {
          lines.push(cur);
          cur = 0;
        }
        if (ZI.test(ch)) cur++;
        prev = r;
      }
    }
    if (prev) lines.push(cur);
    return lines;
  };

  // 前一个可见字符的矩形（可能在前一个文本节点里）
  const prevCharRect = (t: Text, i: number): DOMRect | null => {
    for (let j = i - 1; j >= 0; j--) if (t.data[j].trim()) return charRect(t, j);
    const walker = document.createTreeWalker(document.body ?? document.documentElement, NodeFilter.SHOW_TEXT);
    walker.currentNode = t;
    for (let n = walker.previousNode() as Text | null; n; n = walker.previousNode() as Text | null) {
      if (n.parentElement?.closest(NON_RENDERED)) continue;
      for (let j = n.data.length - 1; j >= 0; j--) if (n.data[j].trim()) return charRect(n, j);
    }
    return null;
  };

  // 含中文文字的元素，加上自己的文字（含行内子元素）里有中文的 p、li（RA-17）：登记下来，截图时按序号找回
  const all: Element[] = [];
  const blocks: Element[] = [];
  for (const el of Array.from(document.querySelectorAll("*"))) {
    if (el.closest(NON_RENDERED)) continue;
    const direct = directText(el).some((t) => HAN.test(t.data));
    const block = (el.localName === "p" || el.localName === "li") && !el.closest(CODE) && ownText(el).some((t) => HAN.test(t.data));
    if (direct || block) all.push(el);
    if (block) blocks.push(el);
  }
  (window as unknown as Record<string, unknown>)[o.key] = all;
  const vis = new Set(all.filter(visible));
  const els = all.filter((el) => vis.has(el) && directText(el).some((t) => HAN.test(t.data)));
  const items: ProbeItem[] = [];
  // 序号只在「直接文字里有中文」的元素之间排，和基础档模型（cjkElements）的口径一致
  const ordMap = new Map<Element, number>();
  const ordSeen = new Map<string, number>();
  for (const el of all) {
    if (!directText(el).some((t) => HAN.test(t.data))) continue;
    const k = `${selectorOf(el)}\u0001${fingerprint(el)}`;
    const n = ordSeen.get(k) ?? 0;
    ordMap.set(el, n);
    ordSeen.set(k, n + 1);
  }
  const ordOf = (el: Element) => ordMap.get(el) ?? 0;
  const idOf = (el: Element) => `${selectorOf(el)}\u0001${fingerprint(el)}\u0001${ordOf(el)}`;
  const checked: Record<string, string[]> = {};
  const mark = (rule: string, el: Element) => {
    (checked[rule] ??= []).push(idOf(el));
  };
  // 不截断（RG-01）：截断后排在后面的元素会被当成「浏览器里不存在」，基础档的结论会被错删
  const ids = all.map(idOf);
  const indexOf = new Map(all.map((el, i) => [el, i]));
  const add = (rule: string, severity: "error" | "warn", el: Element, message: string) =>
    items.push({ rule, severity, idx: indexOf.get(el) ?? -1, selector: selectorOf(el), text: fingerprint(el), ord: ordOf(el), message: clean(message, 600) });

  // 页面上有没有给 tracking- 类写样式：有的话，计算值就是准的，不用再按类名猜（RA-10）
  let trackingStyled = false;
  const scan = (rules: CSSRuleList) => {
    for (const r of Array.from(rules)) {
      if (trackingStyled) return;
      if ((r as CSSStyleRule).selectorText?.includes("tracking-")) trackingStyled = true;
      const inner = (r as CSSGroupingRule).cssRules;
      if (inner) scan(inner);
    }
  };
  for (const s of Array.from(document.styleSheets)) {
    try {
      scan(s.cssRules);
    } catch {
      // 跨域样式表读不到规则，跳过
    }
  }

  const autospaceSupported = "textAutospace" in document.documentElement.style;
  const noAutospace: Element[] = [];
  const notStrict: Element[] = [];

  for (const el of els) {
    const cs = getComputedStyle(el);
    const fs = parseFloat(cs.fontSize);
    const inCode = !!el.closest(CODE);
    const isBody = el.localName === "p" || el.localName === "li";
    const horizontal = cs.writingMode === "horizontal-tb";
    for (const rule of ["T04", "T07", "T08", "T11"]) mark(rule, el);
    if (o.spacingCss && autospaceSupported) mark("T02", el);

    // T02（spacing: css）：计算后的 text-autospace
    if (o.spacingCss && autospaceSupported && (cs as unknown as Record<string, string>).textAutospace === "no-autospace") noAutospace.push(el);

    // T04：计算后的 line-break，以及实测落在行首的标点
    if (cs.lineBreak !== "strict") notStrict.push(el);
    if (horizontal && !inCode) {
      let hit = "";
      for (const t of directText(el)) {
        for (let i = 0; i < t.data.length && !hit; i++) {
          if (!NO_LINE_START.includes(t.data[i])) continue;
          const r = charRect(t, i);
          const p = prevCharRect(t, i);
          if (r && p && r.top >= p.top + p.height / 2 && r.left < p.left) {
            hit = `实测：在 ${W}px 宽度下，标点「${t.data[i]}」出现在行首：「${clean(t.data.slice(Math.max(0, i - 6), i + 6), 24)}」。请加上 line-break: strict。`;
          }
        }
      }
      if (hit) add("T04", "error", el, hit);
    }

    // T07：计算后的字距；样式里没有 tracking- 规则（样式没加载）时，才按 Tailwind 类名推断（RA-10）
    const ls = cs.letterSpacing === "normal" ? 0 : parseFloat(cs.letterSpacing);
    if (ls < 0) add("T07", "error", el, `中文字距为负（计算值 ${cs.letterSpacing}），汉字会挤在一起。中文字距请用 0 到 0.05em。`);
    else if (!trackingStyled) {
      for (let e: Element | null = el; e; e = e.parentElement) {
        const hit = (e.getAttribute("class") ?? "").split(/\s+/).find((x) => TRACKING.test(x));
        if (hit) {
          add("T07", "error", el, `中文元素带有 Tailwind 类 ${hit}（负字距），页面上又没有加载对应的样式，按类名推断字距为负。请去掉或改成 tracking-normal / tracking-wide。`);
          break;
        }
      }
    }

    // T08：显示为斜体，而且允许浏览器合成假斜体
    const synth = (cs as unknown as Record<string, string>).fontSynthesisStyle ?? "auto";
    if ((cs.fontStyle === "italic" || cs.fontStyle.startsWith("oblique")) && synth !== "none") {
      if (inCode) add("T08", "warn", el, `实测：代码块里的中文显示为斜体（font-style: ${cs.fontStyle}），中文会被硬掰歪，建议注释改用正体。`);
      else add("T08", "error", el, `实测：中文显示为斜体（font-style: ${cs.fontStyle}），中文字体没有斜体，浏览器会合成假斜体。请引入 measure.css（font-synthesis-style: none），或改用着重号、加粗。`);
    }

    // T11：计算后的字号
    if (fs > 0) {
      if (fs < 12 - 0.01) add("T11", "error", el, `中文字号 ${fs.toFixed(1)}px，小于 12px，笔画会糊成一团。`);
      else if (isBody && fs < o.minBodyPx - 0.01) add("T11", "warn", el, `正文字号 ${fs.toFixed(1)}px，建议不小于 ${o.minBodyPx}px。`);
    }
  }

  // T05、T06：正文段落（p、li），按段落自己的全部文字算，文字在行内子元素里也算（RA-17）
  for (const el of blocks) {
    if (!vis.has(el)) continue;
    const cs = getComputedStyle(el);
    const fs = parseFloat(cs.fontSize);
    if (!(fs > 0) || cs.writingMode !== "horizontal-tb") continue;
    const own = ownText(el).reduce((n, t) => n + hanIn(t.data), 0);
    const lines = linesOf(el, fs);
    mark("T06", el);
    if (own >= 15) mark("T05", el);

    // T05：实测每行的字数（汉字加全角标点）
    if (own >= 15) {
      const most = Math.max(0, ...lines);
      const detail = `实测：在 ${W}px 宽度下，正文最长一行有 ${most} 个字（汉字和全角标点）`;
      if (most > o.lineError) add("T05", "error", el, `${detail}，超过 ${o.lineError}。请给正文容器加 .measure-prose 或 max-width: 36em。`);
      else if (most > o.lineWarn) add("T05", "warn", el, `${detail}，超过 ${o.lineWarn}，建议控制在 28–40 字。`);
    }

    // T06：行高。没设行高时，实际折成多行才报 error；比较时留 0.005 的浮点容差（RA-07）
    if (cs.lineHeight === "normal") {
      if (lines.length >= 2) add("T06", "error", el, `实测：在 ${W}px 宽度下，这段中文折成 ${lines.length} 行，但没有设置行高（浏览器默认约 1.2），中文会显得太密。正文请用 1.6–1.9。`);
      else add("T06", "warn", el, `这段中文没有设置行高（浏览器默认约 1.2），在 ${W}px 宽度下只有一行。如果它会折行，请设为 1.6–1.9。`);
    } else {
      const lh = parseFloat(cs.lineHeight) / fs;
      if (lh < o.lineHeightMin - 0.005) add("T06", "error", el, `正文行高 ${lh.toFixed(2)}（计算值 ${cs.lineHeight} ÷ 字号 ${cs.fontSize}），低于 ${o.lineHeightMin}。中文正文请用 1.6–1.9。`);
      else if (lh < 1.6 - 0.005 || lh > 1.9 + 0.005) add("T06", "warn", el, `正文行高 ${lh.toFixed(2)}，建议在 1.6–1.9 之间。`);
    }
  }

  if (noAutospace.length) add("T02", "error", noAutospace[0], `实测：有 ${noAutospace.length} 个中文元素的 text-autospace 计算值是 no-autospace。必须显式写 text-autospace: normal（引入 measure.css 即可）；或者把配置改成 spacing: "text"，在文案里打空格。`);
  if (notStrict.length) add("T04", "error", notStrict[0], `有 ${notStrict.length} 个中文元素的 line-break 计算值不是 strict，标点可能出现在行首。`);

  // T12：首行缩进和段间距同时使用（相邻两段之间有空隙，同时又有首行缩进）
  const paras = els.filter((el) => el.localName === "p" && !el.closest(CODE));
  const paraSet = new Set(paras);
  let both: Element | null = null;
  let bothCount = 0;
  for (const el of paras) {
    const cs = getComputedStyle(el);
    const next = el.nextElementSibling;
    if (!next || next.localName !== "p" || !paraSet.has(next)) continue;
    const gap = next.getBoundingClientRect().top - el.getBoundingClientRect().bottom;
    if (parseFloat(cs.textIndent) > 0 && gap > 0.25 * parseFloat(cs.fontSize)) {
      bothCount++;
      both = both ?? el;
    }
  }
  if (both) add("T12", "warn", both, `有 ${bothCount} 处段落同时用了首行缩进和段间距（在 ${W}px 宽度下实测）。两者二选一：要么首行缩进、段间距为 0，要么不缩进、用段间距分段。`);

  // A01：紫色、蓝紫渐变背景（含 ::before、::after）。把渐变里的每个颜色画到 1×1 的画布上取 sRGB 值，再算色相（RA-12）
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 1;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  const COLOR = /(?:rgba?|hsla?|hwb|lab|lch|oklab|oklch|color)\((?:[^()]|\([^()]*\))*\)|#[0-9a-fA-F]{3,8}\b|\b(?:purple|violet|indigo|blueviolet|darkviolet|mediumpurple|rebeccapurple|darkorchid|mediumorchid|orchid|magenta|fuchsia|slateblue|mediumslateblue|darkslateblue|plum)\b/g;
  const isViolet = (token: string): boolean => {
    if (!ctx) return false;
    ctx.clearRect(0, 0, 1, 1);
    ctx.fillStyle = "#000";
    ctx.fillStyle = token;
    ctx.fillRect(0, 0, 1, 1);
    const [r, g, b, a] = Array.from(ctx.getImageData(0, 0, 1, 1).data).map((v) => v / 255);
    if (a < 0.3) return false;
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const l = (max + min) / 2;
    const d = max - min;
    if (d === 0) return false;
    const s = d / (1 - Math.abs(2 * l - 1));
    let h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
    h = (h * 60 + 360) % 360;
    // 紫色、蓝紫：250°–320°。235°–250° 的靛蓝只在饱和度 60%–95%、亮度 40%–75% 时才算，
    // 这样纯蓝（#0000ff，饱和度 100%）、藏青（#000080，亮度 25%）不算（RB-07）
    if (s < 0.25 || l < 0.15 || l > 0.9) return false;
    return (h >= 250 && h <= 320) || (h >= 235 && h < 250 && s >= 0.6 && s <= 0.95 && l >= 0.4 && l <= 0.75);
  };
  const bigArea = W * window.innerHeight * 0.15;
  outer: for (const el of [document.documentElement, ...Array.from(document.querySelectorAll("body, body *"))]) {
    const r = el.getBoundingClientRect();
    if (el !== document.documentElement && el !== document.body && r.width * r.height < bigArea) continue;
    for (const pseudo of [null, "::before", "::after"]) {
      const bg = getComputedStyle(el, pseudo).backgroundImage;
      if (!bg.includes("gradient(")) continue;
      const violet = (bg.match(COLOR) ?? []).filter(isViolet);
      if (violet.length) {
        const target = all.includes(el) ? el : (all.find((x) => el.contains(x)) ?? el);
        items.push({ rule: "A01", severity: "warn", idx: all.indexOf(target), selector: selectorOf(el) + (pseudo ?? ""), text: "", ord: 0, message: clean(`背景是紫色 / 蓝紫渐变（${violet.slice(0, 3).join("、")}），这是常见的 AI 生成页面套路。换成从真实素材里采样的颜色。`, 600) });
        break outer;
      }
    }
  }

  // A11：每段都把关键词加粗。正文段落里加粗的汉字超过 15%，并且至少一半的段落（不少于 2 段）有加粗
  let eligible = 0;
  let withBold = 0;
  let total = 0;
  let bold = 0;
  let firstBold: Element | null = null;
  for (const el of blocks) {
    if (!vis.has(el)) continue;
    if (parseInt(getComputedStyle(el).fontWeight, 10) >= 600) continue;
    const texts = ownText(el);
    const t = texts.reduce((n, x) => n + hanIn(x.data), 0);
    if (t < 20) continue;
    const b = texts.reduce((n, x) => n + (x.parentElement && parseInt(getComputedStyle(x.parentElement).fontWeight, 10) >= 600 ? hanIn(x.data) : 0), 0);
    eligible++;
    total += t;
    bold += b;
    if (b > 0) {
      withBold++;
      firstBold = firstBold ?? el;
    }
  }
  if (firstBold && withBold >= 2 && withBold * 2 >= eligible && bold / total > 0.15) {
    add("A11", "warn", firstBold, `${eligible} 段正文里有 ${withBold} 段加粗了关键词，加粗的汉字占 ${Math.round((bold / total) * 100)}%，超过 15%。重点太多就等于没有重点。`);
  }

  return { autospaceSupported, visible: els.length, ids, checked, items };
}

// 截图用：按序号或选择器找回元素，返回它在整页坐标系里的位置；找不到时返回 null
export function locateElement(o: { key: string; idx?: number; selector?: string }): { x: number; y: number; width: number; height: number } | null {
  const all = ((window as unknown as Record<string, unknown>)[o.key] as Element[] | undefined) ?? [];
  let el: Element | undefined = o.idx !== undefined && o.idx >= 0 ? all[o.idx] : undefined;
  if (!el && o.selector) {
    const selectorOf = (e0: Element): string => {
      const parts: string[] = [];
      let e: Element | null = e0;
      while (e && parts.length < 4) {
        const name = e.localName;
        if (name === "html" || name === "body") break;
        let part = name;
        const id = e.getAttribute("id");
        const cls = e.getAttribute("class");
        if (id) part += `#${id}`;
        else if (cls) part += `.${cls.trim().split(/\s+/)[0]}`;
        const parent: Element | null = e.parentElement;
        if (parent) {
          const same = Array.from(parent.children).filter((c) => c.localName === name);
          if (same.length > 1) part += `:nth-of-type(${same.indexOf(e) + 1})`;
        }
        parts.unshift(part);
        e = parent;
      }
      return parts.join(" > ") || e0.localName;
    };
    el = all.find((x) => selectorOf(x) === o.selector);
  }
  if (!el) return null;
  let r: { left: number; top: number; right: number; bottom: number } = el.getBoundingClientRect();
  if (r.right - r.left < 1 || r.bottom - r.top < 1) {
    // display: contents 等没有盒子的元素：用文字的矩形
    const rects: DOMRect[] = [];
    for (const n of Array.from(el.childNodes)) {
      if (n.nodeType !== 3) continue;
      const range = document.createRange();
      range.selectNodeContents(n);
      rects.push(...Array.from(range.getClientRects()).filter((x) => x.width > 0 && x.height > 0));
    }
    if (!rects.length) return null;
    r = { left: Math.min(...rects.map((x) => x.left)), top: Math.min(...rects.map((x) => x.top)), right: Math.max(...rects.map((x) => x.right)), bottom: Math.max(...rects.map((x) => x.bottom)) };
  }
  return { x: r.left + window.scrollX, y: r.top + window.scrollY, width: r.right - r.left, height: r.bottom - r.top };
}

// 截图时在元素外面画一个红框（独立的覆盖层，不改动页面元素本身）；传 null 移除
// 画的红框按对象身份登记在隔离环境的全局里（AUDIT_CARD_r3 CC-01）：card 的变化检测据此排除它，页面冒用同一个 id 骗不过去
export function markElement(o: { id: string; rect: { x: number; y: number; width: number; height: number } | null }): void {
  const w = window as unknown as { __measureCjkMarks?: WeakSet<Element>; __measureCjkMarkList?: Element[] };
  w.__measureCjkMarks ??= new WeakSet();
  w.__measureCjkMarkList ??= [];
  for (const m of w.__measureCjkMarkList.splice(0)) m.remove();
  if (!o.rect) return;
  const d = document.createElement("div");
  w.__measureCjkMarks.add(d);
  w.__measureCjkMarkList.push(d);
  d.id = o.id;
  d.setAttribute("style", `all: initial; position: absolute; z-index: 2147483647; pointer-events: none; box-sizing: border-box; border: 2px solid #c0392b; left: ${o.rect.x - 3}px; top: ${o.rect.y - 3}px; width: ${o.rect.width + 6}px; height: ${o.rect.height + 6}px;`);
  document.documentElement.appendChild(d);
}

// 页面的 DOM 快照：去掉外部样式和 <style>，把所有同源样式表（含 @import 进来的）按顺序内联成一个 <style>，
// 交给基础档的规则检查（基础档不发网络请求，也不读本地文件）。URL 页面、以及源码里没有中文的本地页面（RA-03）用它
// skipId：card 命令注入 font_dir 字体的 <style>，不属于卡片本身，不交给基础档检查（AUDIT_CARD CA-05）
export function snapshotPage(skipId?: string): string {
  const css: string[] = [];
  const visit = (sheet: CSSStyleSheet, depth: number) => {
    let rules: CSSRuleList;
    try {
      rules = sheet.cssRules;
    } catch {
      return; // 跨域样式表读不到规则（本来也被拦截了）
    }
    for (const rule of Array.from(rules)) {
      if (rule instanceof CSSImportRule) {
        if (rule.styleSheet && depth < 3) visit(rule.styleSheet, depth + 1);
      } else css.push(rule.cssText);
    }
  };
  for (const sheet of Array.from(document.styleSheets)) if (!skipId || (sheet.ownerNode as Element | null)?.id !== skipId) visit(sheet, 0);
  const clone = document.documentElement.cloneNode(true) as HTMLElement;
  for (const n of Array.from(clone.querySelectorAll("style, link[rel~='stylesheet' i], script"))) n.remove();
  const head = clone.querySelector("head") ?? clone.insertBefore(document.createElement("head"), clone.firstChild);
  const style = document.createElement("style");
  style.textContent = css.join("\n");
  head.appendChild(style);
  return `<!doctype html>\n${clone.outerHTML}`;
}
