// 近似层叠计算：浏览器默认样式 < 页面样式 < style 属性；!important 优先；继承；长度换算。
import { compile } from "css-select";
import type { Element, AnyNode } from "domhandler";
import { expandDecl, parseInlineStyle, parseSheet, UA_CSS, type StyleRule, type Decl } from "./css.js";
import { specificity, type Spec } from "./specificity.js";
import { matchesMedia, STATIC_VIEWPORTS, type Viewport } from "./media.js";

type Matcher = (el: Element) => boolean;

interface CompiledSelector {
  match: Matcher;
  spec: Spec;
  rule: StyleRule;
}

interface Candidate {
  value: string;
  key: number[];
}

// var() 解析不出来时的占位值；规则遇到它一律按「未知」跳过
export const UNRESOLVED = "\u0000unresolved";

export const INHERITED = new Set([
  "font-family", "font-size", "font-style", "font-weight", "font-variant", "font-variant-caps", "letter-spacing", "line-height",
  "line-break", "text-autospace", "text-transform", "font-synthesis-style", "font-synthesis-weight",
  "text-emphasis-position", "text-spacing-trim", "color", "text-align"
]);

export function langOf(el: Element | null): string | undefined {
  let e: AnyNode | null = el;
  while (e) {
    const attribs = (e as Element).attribs;
    if (attribs) {
      const v = attribs.lang ?? attribs["xml:lang"];
      if (v !== undefined) return v.toLowerCase();
    }
    e = e.parent as AnyNode | null;
  }
  return undefined;
}

const PSEUDOS: Record<string, (el: Element, value?: string | null) => boolean> = {
  lang: (el, value) => {
    const want = (value ?? "").trim().replace(/^["']|["']$/g, "").toLowerCase();
    const have = langOf(el);
    if (!want || have === undefined) return false;
    return have === want || have.startsWith(want + "-");
  }
};

// 层级排序：普通声明里，不分层的优先于分层的、后声明的层优先；!important 时顺序反过来（A-11）
const UNLAYERED = 1_000_000;
function keyOf(important: boolean, origin: "ua" | "author" | "inline", spec: Spec, order: number, layerRank = UNLAYERED): number[] {
  const originRank = origin === "ua" ? 0 : 1;
  const inline = origin === "inline" ? 1 : 0;
  const layer = important ? UNLAYERED - layerRank : layerRank;
  return [important ? 1 : 0, originRank, inline, layer, spec[0], spec[1], spec[2], order];
}

const SVG_TEXT = new Set(["text", "tspan", "textpath"]);
const SVG_PRESENTATION = ["font-size", "font-family", "font-style", "letter-spacing", "font-weight"];

function greater(a: number[], b: number[]): boolean {
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return a[i] > b[i];
  return false;
}

export class Cascade {
  private compiled: CompiledSelector[] = [];
  private cache = new Map<Element, Map<string, { value: string; origin: "ua" | "author" }>>();
  private fsCache = new Map<Element, number | undefined>();
  readonly unsupportedSelectors: string[] = [];
  rootEl: Element | null = null;

  private layerRank = new Map<string, number>();

  constructor(authorRules: StyleRule[], readonly viewport: Viewport = STATIC_VIEWPORTS[0], layerOrder: string[] = []) {
    layerOrder.forEach((name, i) => this.layerRank.set(name, i));
    const ua = parseSheet(UA_CSS, "<ua>", -100000, "ua").rules;
    for (const rule of [...ua, ...authorRules]) {
      if (!rule.media.every((m) => matchesMedia(m, viewport))) continue;
      for (const sel of rule.selectors) {
        // 伪元素选择器不作用于元素本身的文字，跳过
        if (/::|:(before|after|first-line|first-letter)\b/i.test(sel)) continue;
        try {
          const fn = compile(sel, { pseudos: PSEUDOS, xmlMode: false }) as unknown as Matcher;
          this.compiled.push({ match: fn, spec: specificity(sel), rule });
        } catch {
          this.unsupportedSelectors.push(sel);
        }
      }
    }
  }

  // 元素上每个属性的获胜值（不含继承），并记录它来自浏览器默认样式还是页面
  winners(el: Element): Map<string, { value: string; origin: "ua" | "author" }> {
    const hit = this.cache.get(el);
    if (hit) return hit;
    const best = new Map<string, Candidate & { origin: "ua" | "author" }>();
    const consider = (d: Decl, key: number[], origin: "ua" | "author") => {
      const cur = best.get(d.prop);
      if (!cur || greater(key, cur.key)) best.set(d.prop, { value: d.value, key, origin });
    };
    // SVG 文字的表现属性（font-size="9" 等）：优先级低于任何样式表（A-25）
    if (SVG_TEXT.has(el.name)) {
      for (const prop of SVG_PRESENTATION) {
        const raw = el.attribs?.[prop];
        if (raw === undefined) continue;
        const value = /^\d*\.?\d+$/.test(raw.trim()) && prop !== "font-weight" ? `${raw.trim()}px` : raw;
        consider({ prop, value, important: false }, [0, 1, 0, -1, 0, 0, 0, -1e9], "author");
      }
    }
    for (const c of this.compiled) {
      if (!safeMatch(c.match, el)) continue;
      const rank = c.rule.layer === undefined ? UNLAYERED : this.layerRank.get(c.rule.layer) ?? 0;
      for (const d of c.rule.decls) consider(d, keyOf(d.important, c.rule.origin, c.spec, c.rule.order, rank), c.rule.origin);
    }
    const inline = el.attribs?.style;
    if (inline) for (const d of parseInlineStyle(inline)) consider(d, keyOf(d.important, "inline", [0, 0, 0], 0), "author");
    const out = new Map<string, { value: string; origin: "ua" | "author" }>();
    for (const [k, v] of best) out.set(k, { value: v.value, origin: v.origin });
    this.cache.set(el, out);
    // font 简写里有 var()：先登记原始结果，再解析变量、展开成各个分属性，只覆盖优先级更低的分属性（A-11）
    const font = best.get("font");
    if (font) {
      const resolved = this.resolveVars(el, font.value);
      if (resolved !== undefined) {
        for (const d of expandDecl("font", resolved, false)) {
          const cur = best.get(d.prop);
          if (!cur || greater(font.key, cur.key)) out.set(d.prop, { value: d.value, origin: font.origin });
        }
      }
      out.delete("font");
    }
    return out;
  }

  specified(el: Element, prop: string): string | undefined {
    const raw = this.winners(el).get(prop)?.value;
    return raw === undefined ? undefined : this.resolveVars(el, raw);
  }

  // 自定义属性：继承，取自己或最近祖先上的原始值
  private customRaw(el: Element, name: string): { el: Element; value: string } | undefined {
    let e: AnyNode | null = el;
    while (e && (e as Element).attribs !== undefined) {
      const w = this.winners(e as Element).get(name);
      if (w && !["inherit", "unset"].includes(w.value.trim().toLowerCase())) return { el: e as Element, value: w.value };
      e = e.parent as AnyNode | null;
    }
    return undefined;
  }

  // 展开 var(--x, 回退值)。解析不出来时返回 undefined（调用方按「未知」处理，不报错）
  resolveVars(el: Element, value: string, depth = 0): string | undefined {
    if (!value.includes("var(")) return value;
    if (depth > 5) return undefined;
    let out = "";
    let i = 0;
    while (i < value.length) {
      const at = value.indexOf("var(", i);
      if (at === -1) {
        out += value.slice(i);
        break;
      }
      out += value.slice(i, at);
      let depthP = 1;
      let j = at + 4;
      while (j < value.length && depthP > 0) {
        if (value[j] === "(") depthP++;
        if (value[j] === ")") depthP--;
        j++;
      }
      const inner = value.slice(at + 4, j - 1);
      const comma = inner.indexOf(",");
      const name = (comma === -1 ? inner : inner.slice(0, comma)).trim();
      const fallback = comma === -1 ? undefined : inner.slice(comma + 1).trim();
      const found = this.customRaw(el, name);
      let sub: string | undefined;
      if (found) sub = this.resolveVars(found.el, found.value, depth + 1);
      if (sub === undefined && fallback !== undefined) sub = this.resolveVars(el, fallback, depth + 1);
      if (sub === undefined) return undefined;
      out += sub;
      i = j;
    }
    return out.trim();
  }

  // 继承属性：找到给它赋值的元素（自己或最近的祖先）。非继承属性只看自己。
  declaring(el: Element, prop: string): { el: Element; value: string; origin: "ua" | "author" } | undefined {
    let e: AnyNode | null = el;
    while (e && (e as Element).attribs !== undefined) {
      const w = this.winners(e as Element).get(prop);
      const v = w?.value.trim().toLowerCase();
      const passThrough = v === undefined || v === "inherit" || (v === "unset" && INHERITED.has(prop));
      if (!passThrough && w) {
        const resolved = this.resolveVars(e as Element, w.value);
        if (resolved === undefined) return { el: e as Element, value: UNRESOLVED, origin: w.origin };
        return { el: e as Element, value: resolved, origin: w.origin };
      }
      if (!INHERITED.has(prop) && v !== "inherit") return undefined;
      e = e.parent as AnyNode | null;
    }
    return undefined;
  }

  computedKeyword(el: Element, prop: string, initial: string): string {
    const d = this.declaring(el, prop);
    if (!d) return initial;
    const v = d.value.trim().toLowerCase();
    return v === "initial" || v === "unset" ? initial : v;
  }

  rootFontSize(): number {
    return this.rootEl ? this.fontSizePx(this.rootEl) ?? 16 : 16;
  }

  fontSizePx(el: Element): number | undefined {
    if (this.fsCache.has(el)) return this.fsCache.get(el);
    const parent = el.parent && (el.parent as Element).attribs !== undefined ? (el.parent as Element) : null;
    const parentFs = parent ? this.fontSizePx(parent) : 16;
    const v = this.specified(el, "font-size")?.trim().toLowerCase();
    let fs: number | undefined;
    if (v === undefined || v === "inherit" || v === "unset") fs = parentFs;
    else if (v === "initial" || v === "medium") fs = 16;
    else {
      const kw: Record<string, number> = { "xx-small": 9, "x-small": 10, small: 13, large: 18, "x-large": 24, "xx-large": 32, "xxx-large": 48 };
      if (kw[v] !== undefined) fs = kw[v];
      else if (v === "smaller") fs = parentFs !== undefined ? parentFs / 1.2 : undefined;
      else if (v === "larger") fs = parentFs !== undefined ? parentFs * 1.2 : undefined;
      else {
        const isRoot = el === this.rootEl;
        fs = parseLength(v, parentFs, isRoot ? 16 : this.rootFontSize(), parentFs);
      }
    }
    this.fsCache.set(el, fs);
    return fs;
  }

  // 行高：返回相对当前元素字号的倍数；'normal' 表示没有设置
  lineHeightRatio(el: Element): number | "normal" | undefined {
    const d = this.declaring(el, "line-height");
    if (!d) return "normal";
    const v = d.value.trim().toLowerCase();
    if (v === "normal" || v === "initial") return "normal";
    const own = this.fontSizePx(el);
    if (/^\d*\.?\d+$/.test(v)) return parseFloat(v);
    const declFs = this.fontSizePx(d.el);
    const px = parseLength(v, declFs, this.rootFontSize(), declFs);
    if (px === undefined || own === undefined || own === 0) return undefined;
    return px / own;
  }

  letterSpacingPx(el: Element): number | undefined {
    const d = this.declaring(el, "letter-spacing");
    if (!d) return 0;
    const v = d.value.trim().toLowerCase();
    if (v === "normal" || v === "initial") return 0;
    const declFs = this.fontSizePx(d.el);
    return parseLength(v, declFs, this.rootFontSize(), undefined);
  }

  // 非继承的宽度约束（max-width，没有就看 width）
  widthConstraintPx(el: Element): number | undefined {
    for (const prop of ["max-width", "width"]) {
      const v = this.specified(el, prop)?.trim().toLowerCase();
      if (!v || ["none", "auto", "initial", "inherit", "unset", "fit-content", "max-content", "min-content"].includes(v)) continue;
      const fs = this.fontSizePx(el);
      const m = v.match(/^(\d*\.?\d+)ch$/);
      if (m && fs !== undefined) return parseFloat(m[1]) * fs * 0.5;
      const px = parseLength(v, fs, this.rootFontSize(), undefined);
      if (px !== undefined) return px;
    }
    return undefined;
  }
}

// css-select 在个别选择器上可能运行时抛错；按「不匹配」处理，这和浏览器忽略无效选择器的行为一致
function safeMatch(fn: Matcher, el: Element): boolean {
  try {
    return fn(el);
  } catch {
    return false;
  }
}

// 长度换算成 px。percentBase 为 undefined 时百分比视为无法计算。
export function parseLength(v: string, emBase: number | undefined, remBase: number, percentBase: number | undefined): number | undefined {
  const m = v.trim().toLowerCase().match(/^(-?\d*\.?\d+)(px|em|rem|%|pt|pc|in|cm|mm|q)?$/);
  if (!m) return undefined;
  const n = parseFloat(m[1]);
  switch (m[2]) {
    case undefined:
      return n === 0 ? 0 : undefined;
    case "px":
      return n;
    case "em":
      return emBase === undefined ? undefined : n * emBase;
    case "rem":
      return n * remBase;
    case "%":
      return percentBase === undefined ? undefined : (n / 100) * percentBase;
    case "pt":
      return (n * 4) / 3;
    case "pc":
      return n * 16;
    case "in":
      return n * 96;
    case "cm":
      return (n * 96) / 2.54;
    case "mm":
      return (n * 96) / 25.4;
    case "q":
      return (n * 96) / 101.6;
  }
  return undefined;
}
