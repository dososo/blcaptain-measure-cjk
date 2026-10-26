// W1 基础档的 12 条页面规则（F04 是 fonts 命令）。阈值见 PRD §5.1、§7.3。
import type { Element } from "domhandler";
import { EL_ORD, EL_TEXT, UsageError, type Finding, type MeasureConfig, type RuleId } from "./types.js";
import type { PageModel } from "./model.js";
import { HAN, CODE_LIKE, CODE_BLOCK, BLOCK, hasAncestor } from "./model.js";
import { ruleMeta } from "./rulesMeta.js";
import { UNRESOLVED, langOf, type Cascade } from "./cascade.js";
import type { AnyNode } from "domhandler";
import { performance } from "node:perf_hooks";

export const PAGE_TIME_BUDGET_MS = 20_000;

// 单页耗时上限：默认 20 秒；可以用环境变量 MEASURE_PAGE_BUDGET_MS 调低（测试、慢机器排查用），不能调高（A-34）
export function pageBudgetMs(): number {
  const raw = process.env.MEASURE_PAGE_BUDGET_MS;
  if (raw === undefined || raw === "") return PAGE_TIME_BUDGET_MS;
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 0 || n > PAGE_TIME_BUDGET_MS) throw new UsageError(`MEASURE_PAGE_BUDGET_MS 只能是 0 到 ${PAGE_TIME_BUDGET_MS} 之间的数字（只能调低，不能调高）`);
  return n;
}
const HIDDEN_CLASSES = /(^|\s)(sr-only|visually-hidden|screen-reader-text|visuallyhidden)(\s|$)/;

// 不可见的元素不检查（A-25）：hidden 属性、display: none、常见的「仅屏幕阅读器」类名。
// 注意：aria-hidden 只对读屏软件隐藏，页面上照样显示，不能算不可见（A-32）
function isHidden(el: Element, c: Cascade): boolean {
  let e: AnyNode | null = el;
  while (e && (e as Element).attribs !== undefined) {
    const x = e as Element;
    if (x.attribs.hidden !== undefined || HIDDEN_CLASSES.test(x.attribs.class ?? "")) return true;
    if (c.specified(x, "display")?.trim().toLowerCase() === "none") return true;
    e = e.parent as AnyNode | null;
  }
  return false;
}

function nearestBlock(el: Element): Element {
  let e: AnyNode | null = el;
  while (e && (e as Element).attribs !== undefined) {
    if (BLOCK.has((e as Element).name)) return e as Element;
    e = e.parent as AnyNode | null;
  }
  return el;
}
import { isCjkFamily, matchFontFile, matchFontName, normalizeFamily, parseFamilyList, TIER_LABEL } from "./fonts.js";

const PER_RULE_CAP = 20;
const BODY_TAGS = new Set(["p", "li"]);

function hanCount(el: Element): number {
  let n = 0;
  for (const c of el.children ?? []) if (c.type === "text") n += ((c as { data: string }).data.match(/\p{Script=Han}/gu) ?? []).length;
  return n;
}

function snippet(s: string, at: number): string {
  const start = Math.max(0, at - 8);
  return s.slice(start, at + 9).replace(/\s+/g, " ").trim();
}

class Collector {
  readonly findings: Finding[] = [];
  timedOut = false;
  private counts = new Map<string, number>();
  private overflow = new Map<string, number>();
  constructor(private page: PageModel) {}

  add(rule: RuleId, message: string, el?: Element, opts: { selector?: string; line?: number; file?: string; severity?: "error" | "warn" } = {}) {
    const meta = ruleMeta(rule)!;
    const n = this.counts.get(rule) ?? 0;
    if (n >= PER_RULE_CAP) {
      this.overflow.set(rule, (this.overflow.get(rule) ?? 0) + 1);
      return;
    }
    this.counts.set(rule, n + 1);
    this.findings.push({
      rule,
      severity: opts.severity ?? meta.severity,
      file: opts.file ?? this.page.file,
      selector: opts.selector ?? (el ? this.page.selectorOf(el) : undefined),
      line: opts.line ?? (el ? this.page.lineOf(el) : undefined),
      message,
      fix_hint: `见 skills/measure/${meta.doc}`,
      ...(el ? { [EL_TEXT]: this.page.textOf(el), [EL_ORD]: this.page.ordOf(el) } : {})
    });
  }

  finish(): Finding[] & { timedOut?: boolean } {
    for (const [rule, extra] of this.overflow) {
      const meta = ruleMeta(rule)!;
      this.findings.push({
        rule: rule as RuleId,
        severity: this.findings.find((f) => f.rule === rule)?.severity ?? meta.severity,
        file: this.page.file,
        message: `同一条规则在本文件另有 ${extra} 处，已省略`,
        fix_hint: `见 skills/measure/${meta.doc}`
      });
    }
    return Object.assign(this.findings, { timedOut: this.timedOut });
  }
}

export function runPageRules(page: PageModel, config: MeasureConfig, cascade: Cascade = page.cascade): Finding[] {
  const out = new Collector(page);
  const c = cascade;
  const started = performance.now();
  const budget = pageBudgetMs();
  const els = page.cjkElements.filter((el) => !isHidden(el, c));
  if (els.length === 0) return [];
  const th = config.thresholds;

  // T01：每个中文元素实际继承到的 lang 必须是中文（PRD：<html> 或含中文的根元素声明即可，A-20）
  const noLang = els.filter((el) => {
    const l = langOf(el);
    return l === undefined || !/^zh(-|$)/i.test(l.trim());
  });
  if (noLang.length) {
    const lang = page.htmlEl?.attribs.lang;
    const msg = lang === undefined
      ? `有 ${noLang.length} 个中文元素没有声明语言，<html> 也没有 lang。浏览器会按默认语言选字体和断行，请写 lang="zh-CN"。`
      : `有 ${noLang.length} 个中文元素实际继承到的语言是「${langOf(noLang[0]) ?? "无"}」，不是中文。请在 <html> 或包住中文的元素上写 lang="zh-CN"（繁体用 zh-TW 或 zh-HK）。`;
    out.add("T01", msg, noLang[0]);
  }

  // T02：中英文间距
  if (config.spacing === "css") {
    const bad = els.filter((el) => {
      const v = c.computedKeyword(el, "text-autospace", "no-autospace");
      return v === "no-autospace";
    });
    if (bad.length) {
      out.add("T02", `有 ${bad.length} 个中文元素没有开启 text-autospace。三大浏览器实现里它的初始值是 no-autospace，必须显式写 text-autospace: normal（引入 measure.css 即可）；或者把配置改成 spacing: "text"，在文案里打空格。`, bad[0]);
    }
  } else {
    for (const item of page.textItems) {
      const re = /\p{Script=Han}[A-Za-z0-9]|[A-Za-z0-9]\p{Script=Han}/gu;
      const m = re.exec(item.text);
      if (m) out.add("T02", `汉字和西文 / 数字紧挨在一起：「${snippet(item.text, m.index)}」。spacing: "text" 模式要求在文案里加空格。`, item.el);
    }
  }

  // T03：标点。同一个块级元素里的文字先拼起来再检查，避免漏掉行内元素边界处的标点（A-12）
  // A-40：遇到嵌套的块级元素、代码类元素就断开，不把页面上不相邻的文字拼在一起
  const blockSet = new Set<Element>();
  for (const item of page.textItems) if (!isHidden(item.el, c)) blockSet.add(nearestBlock(item.el));
  const segments: { el: Element; text: string }[] = [];
  for (const b of blockSet) {
    let cur = "";
    const flush = () => {
      if (HAN.test(cur)) segments.push({ el: b, text: cur });
      cur = "";
    };
    const walk = (n: AnyNode) => {
      for (const ch of ((n as Element).children ?? []) as AnyNode[]) {
        if (ch.type === "text") cur += (ch as unknown as { data: string }).data;
        else if ((ch as Element).attribs !== undefined) {
          const name = (ch as Element).name;
          if (BLOCK.has(name) || CODE_LIKE.has(name)) flush();
          else if (!isHidden(ch as Element, c)) walk(ch); // 隐藏的行内文字不纳入（A-47）
        }
      }
    };
    walk(b);
    flush();
  }
  for (const seg of segments) {
    const t = seg.text;
    const item = { el: seg.el, text: t };
    const half = /(\p{Script=Han})([,;:?!.])(?=\p{Script=Han}|\s*$)/u.exec(t);
    if (half) {
      out.add("T03", `中文里用了半角标点「${half[2]}」：「${snippet(t, half.index)}」。中文语境请用全角的 ，。；：？！`, item.el);
      continue;
    }
    if (/"[^"]*\p{Script=Han}[^"]*"/u.test(t)) {
      out.add("T03", `中文用了直引号 "…"：「${snippet(t, t.indexOf('"'))}」。请改用 ${config.quotes === "curly" ? "“…”" : "「…」"}。`, item.el);
      continue;
    }
    if (config.quotes === "curly" && /[「」『』]/.test(t)) out.add("T03", `配置的引号风格是 “”（curly），这里用了「」：「${snippet(t, t.search(/[「」『』]/))}」。`, item.el);
    else if (config.quotes === "corner" && /[“”]/.test(t)) out.add("T03", `配置的引号风格是「」（corner），这里用了 “”：「${snippet(t, t.search(/[“”]/))}」。`, item.el);
  }

  // T04：行首行尾禁则
  const lb = els.filter((el) => {
    const v = c.computedKeyword(el, "line-break", "auto");
    return v !== "strict" && v !== UNRESOLVED;
  });
  if (lb.length) out.add("T04", `有 ${lb.length} 个中文元素没有 line-break: strict，标点可能出现在行首。`, lb[0]);

  for (const [i, el] of els.entries()) {
    // A-18：单页耗时上限，超时就停止并在结果里记为 timeout，不无限卡住
    if (i % 100 === 0 && performance.now() - started >= budget) {
      out.timedOut = true;
      break;
    }
    const isBody = BODY_TAGS.has(el.name);
    const fs = c.fontSizePx(el);

    // T05：行长（基础档只 warn）
    if (isBody && hanCount(el) >= 15 && fs) {
      let e: Element | null = el;
      let width: number | undefined;
      while (e && e.attribs) {
        width = c.widthConstraintPx(e);
        if (width !== undefined) break;
        e = e.parent as Element | null;
      }
      if (width === undefined) out.add("T05", "正文找不到行长约束（max-width / width），在宽屏上一行可能有几十个字。请给正文容器加 .measure-prose 或 max-width: 36em。", el, { severity: "warn" });
      else {
        const chars = width / fs;
        if (chars > th.line_length_warn) out.add("T05", `正文每行约 ${Math.round(chars)} 个汉字（容器 ${Math.round(width)}px ÷ 字号 ${Math.round(fs)}px），超过 ${th.line_length_warn}。基础档是估算，只报 warn；完整档实测超过 ${th.line_length_error} 才报 error。`, el, { severity: "warn" });
      }
    }

    // T06：行高
    if (isBody) {
      const lh = c.lineHeightRatio(el);
      if (lh === "normal") {
        // 没有设置行高：30 个汉字以上（会折行的段落）报 error；更短的单行文字只报 warn（A-20，PRD 附录 C10）
        if (hanCount(el) >= 30) out.add("T06", "正文没有设置行高，浏览器默认约 1.2，中文会显得太密。正文请用 1.6–1.9。", el);
        else out.add("T06", "这段中文没有设置行高（浏览器默认约 1.2）。如果它会折行，请设为 1.6–1.9。", el, { severity: "warn" });
      }
      else if (typeof lh === "number") {
        if (lh < th.body_line_height_min) out.add("T06", `正文行高 ${lh.toFixed(2)}，低于 ${th.body_line_height_min}。中文正文请用 1.6–1.9。`, el);
        else if (lh < 1.6 || lh > 1.9) out.add("T06", `正文行高 ${lh.toFixed(2)}，建议在 1.6–1.9 之间。`, el, { severity: "warn" });
      }
    }

    // T07：负字距
    const ls = c.letterSpacingPx(el);
    if (ls !== undefined && ls < 0) out.add("T07", `中文字距为负（${ls.toFixed(2)}px），汉字会挤在一起。中文字距请用 0 到 0.05em。`, el);
    else {
      let e: Element | null = el;
      while (e && e.attribs) {
        const cls = (e.attribs.class ?? "").split(/\s+/);
        const hit = cls.find((x) => /^(?:[\w-]+:)*tracking-(tight|tighter|tightest)$/.test(x));
        if (hit) {
          out.add("T07", `中文元素带有 Tailwind 类 ${hit}（负字距），汉字会挤在一起。请去掉或改成 tracking-normal / tracking-wide。`, el);
          break;
        }
        e = e.parent as Element | null;
      }
    }

    // T08：斜体
    const fsDecl = c.declaring(el, "font-style");
    const style = fsDecl?.value.trim().toLowerCase();
    if (style && (style === "italic" || style.startsWith("oblique"))) {
      if (hasAncestor(el, CODE_BLOCK)) {
        // 代码块里的中文（多为高亮后的斜体注释）：业界常见写法，只提示，不判失败
        out.add("T08", `代码块里的中文是斜体（font-style: ${style}，通常是代码高亮把注释设成了斜体）。中文会被硬掰歪，建议注释改用正体。`, el, { severity: "warn" });
      } else if (fsDecl!.origin === "author") out.add("T08", `中文设置了 font-style: ${style}。中文字体没有斜体，浏览器只能把字形硬掰歪。强调请用着重号、加粗或换楷体。`, el);
      else if (c.computedKeyword(el, "font-synthesis-style", "auto") !== "none") {
        out.add("T08", `中文在 <${fsDecl!.el.name}> 里，浏览器默认会显示成假斜体。请引入 measure.css（font-synthesis-style: none），或者把 ${fsDecl!.el.name} 设为 font-style: normal。`, el);
      }
    }

    // T09：text-transform / small-caps
    const tt = c.computedKeyword(el, "text-transform", "none");
    if (["uppercase", "lowercase", "capitalize", "full-width"].includes(tt)) out.add("T09", `中文元素上的 text-transform: ${tt} 对汉字没有效果，通常是照搬了英文样式。`, el);
    const fv = c.computedKeyword(el, "font-variant", "normal");
    const fvc = c.computedKeyword(el, "font-variant-caps", "normal");
    if (/small-caps/.test(fv) || /small-caps/.test(fvc)) out.add("T09", "中文元素上的 small-caps 对汉字没有效果。", el);

    // T11：最小字号
    if (fs !== undefined) {
      if (fs < 12) out.add("T11", `中文字号 ${fs.toFixed(1)}px，小于 12px，笔画会糊成一团。`, el);
      else if (isBody && fs < th.min_font_px_body) out.add("T11", `正文字号 ${fs.toFixed(1)}px，建议不小于 ${th.min_font_px_body}px。`, el, { severity: "warn" });
    }
  }

  // T13：字体栈里要有中文字体（按不同的字体栈去重）
  const declaredCjk = new Set<string>();
  for (const ff of page.fontFaces) {
    if (!ff.family) continue;
    const entry = matchFontName(ff.family) ?? ff.srcUrls.map((u) => matchFontFile(u)).find(Boolean);
    if (entry || HAN.test(ff.family)) declaredCjk.add(normalizeFamily(ff.family));
  }
  const seenStacks = new Set<string>();
  for (const el of els) {
    const inCode = hasAncestor(el, CODE_BLOCK);
    const ff = c.computedKeyword(el, "font-family", "");
    if (ff === UNRESOLVED) continue; // var() 解析不出来，按未知处理
    const key = `${inCode ? "code" : "body"}|${ff}`;
    if (seenStacks.has(key)) continue;
    seenStacks.add(key);
    const fams = parseFamilyList(ff);
    if (!fams.some((f) => isCjkFamily(f, declaredCjk))) {
      if (inCode) {
        // 代码块用等宽字体栈是常规做法，但中文仍会回退到系统字体：降为 warn，不跳过（A-31）
        out.add("T13", `代码块里的中文使用字体栈「${ff}」，里面没有中文字体，中文会回退到访客系统的默认字体。可以在等宽字体后面补一个中文字体。`, el, { severity: "warn" });
      } else {
        out.add("T13", ff ? `字体栈「${ff}」里没有中文字体，中文会回退到访客系统的默认字体，效果不可控。请在西文字体后面加上中文字体，例如 "PingFang SC", "Noto Sans SC"。` : "中文元素没有设置 font-family，会用浏览器的默认字体，效果不可控。", el);
      }
    }
  }

  // F03：自托管 webfont 的授权
  checkFontFaces(out, page.fontFaces);

  if (performance.now() - started > budget) out.timedOut = true;
  return out.finish();
}

// 单独的 .css 文件只检查 F03（中文元素要靠 HTML 页面才能判断）
export function runCssRules(fontFaces: PageModel["fontFaces"], file: string): Finding[] {
  const fake = { file, selectorOf: () => "", lineOf: () => undefined } as unknown as PageModel;
  const out = new Collector(fake);
  checkFontFaces(out, fontFaces);
  return out.finish();
}

const REMOTE = /^(https?:)?\/\//i;

// F03 的判定（A-13）：只有本地或相对路径的 url() 才算自托管；只写 local() 不检查；全部是远程 URL 时只给 warn
function checkFontFaces(out: Collector, fontFaces: PageModel["fontFaces"]): void {
  for (const ff of fontFaces) {
    // data: URI 把字体文件内嵌进 CSS，和放在自己服务器上一样是在分发字体文件，按自托管处理（A-33）
    const urls = ff.srcUrls;
    if (urls.length === 0) continue;
    const local = urls.filter((u) => !REMOTE.test(u));
    const entry = (ff.family ? matchFontName(ff.family) : undefined) ?? urls.filter((u) => !/^data:/i.test(u)).map((u) => matchFontFile(u)).find(Boolean);
    const where = { selector: `@font-face "${ff.family}"`, line: ff.line, file: ff.file };
    if (!entry) {
      out.add("F03", `@font-face「${ff.family || "（未命名）"}」不在字体授权表里（F-UNKNOWN）。请先查官方授权原文，确认能不能这样使用。`, undefined, { ...where, severity: "warn" });
      continue;
    }
    if (entry.webfont_self_host === true) continue;
    const src = `原文：${entry.source_url}（核验于 ${entry.verified_at}）`;
    if (local.length === 0) {
      out.add("F03", `@font-face「${ff.family}」命中授权表「${entry.names[0]}」（${TIER_LABEL[entry.tier]}），字体文件来自远程地址。通过 CDN 引用是否被允许，授权表里没有记录（原文未明确），请自行核实。${src}`, undefined, { ...where, severity: "warn" });
      continue;
    }
    const why = entry.webfont_self_host === "unknown" ? "官方原文没有写清能不能自托管" : "官方原文不允许自托管成 webfont";
    out.add("F03", `@font-face「${ff.family}」命中授权表「${entry.names[0]}」（${TIER_LABEL[entry.tier]}）：${why}。${src}。可以改用 Noto Sans SC / Noto Serif SC 等 🟢 字体，或者只写进字体栈调用系统字体。`, undefined, where);
  }
}
