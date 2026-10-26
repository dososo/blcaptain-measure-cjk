// CSS 解析：收集样式规则、@font-face、@import。展开 font / font-synthesis 简写。
// 局限（写进 README）：@media、@supports 一律视为生效；不展开 var()，不计算 calc()。
import postcss from "postcss";
import type { AtRule, ChildNode, Rule } from "postcss";

export interface Decl {
  prop: string;
  value: string;
  important: boolean;
}

export interface StyleRule {
  selectors: string[];
  media: string[]; // 祖先 @media 的条件，全部满足才生效
  layer?: string; // 所在的 @layer（嵌套层用点号连接）；undefined 表示不分层
  decls: Decl[];
  order: number;
  origin: "ua" | "author";
  source: string;
  line?: number;
}

export interface FontFace {
  family: string;
  srcUrls: string[];
  source: string;
  line?: number;
}

export interface SheetData {
  layerOrder: string[]; // 本样式表里各层第一次出现的顺序（含 @layer a, b; 声明）
  rules: StyleRule[];
  fontFaces: FontFace[];
  imports: string[];
  error?: string;
}

const SKIP_AT = new Set(["keyframes", "-webkit-keyframes", "font-feature-values", "page", "counter-style", "property"]);

const SIZE_KEYWORDS = new Set(["xx-small", "x-small", "small", "medium", "large", "x-large", "xx-large", "xxx-large", "smaller", "larger"]);
const SYSTEM_FONTS = new Set(["caption", "icon", "menu", "message-box", "small-caption", "status-bar"]);

function isSizeToken(t: string): boolean {
  const base = t.split("/")[0];
  return SIZE_KEYWORDS.has(base) || /^(\d*\.?\d+)(px|em|rem|%|pt|pc|vw|vh|vmin|vmax|ch|ex|cm|mm|in|q)$/i.test(base) || /^calc\(/i.test(base);
}

export function expandDecl(prop: string, value: string, important: boolean): Decl[] {
  // 自定义属性（--x）区分大小写，原样保留
  if (prop.startsWith("--")) return [{ prop, value: value.trim(), important }];
  const p = prop.toLowerCase();
  const v = value.trim();
  if (p === "font") {
    if (v.includes("var(")) return [{ prop: "font", value: v, important }];
    const lower = v.toLowerCase();
    if (["inherit", "initial", "unset", "revert"].includes(lower)) {
      return ["font-style", "font-variant", "font-weight", "font-size", "line-height", "font-family"].map((x) => ({ prop: x, value: lower, important }));
    }
    if (SYSTEM_FONTS.has(lower)) return [];
    const tokens = v.split(/\s+/);
    const idx = tokens.findIndex(isSizeToken);
    if (idx === -1) return [];
    const pre = tokens.slice(0, idx).map((t) => t.toLowerCase());
    let [size, lh] = tokens[idx].split("/");
    let rest = idx + 1;
    if (!lh && tokens[rest] === "/") {
      lh = tokens[rest + 1];
      rest += 2;
    } else if (!lh && tokens[rest]?.startsWith("/")) {
      lh = tokens[rest].slice(1) || tokens[rest + 1];
      rest += tokens[rest].length > 1 ? 1 : 2;
    }
    const family = tokens.slice(rest).join(" ");
    const style = pre.find((t) => t === "italic" || t.startsWith("oblique")) ?? "normal";
    const variant = pre.includes("small-caps") ? "small-caps" : "normal";
    const weight = pre.find((t) => /^(bold|bolder|lighter|\d{3})$/.test(t)) ?? "normal";
    const out: Decl[] = [
      { prop: "font-style", value: style, important },
      { prop: "font-variant", value: variant, important },
      { prop: "font-weight", value: weight, important },
      { prop: "font-size", value: size, important },
      { prop: "line-height", value: lh ?? "normal", important }
    ];
    if (family) out.push({ prop: "font-family", value: family, important });
    return out;
  }
  if (p === "font-synthesis") {
    const lower = v.toLowerCase();
    const parts = lower.split(/\s+/);
    if (lower === "none") {
      return [
        { prop: "font-synthesis-style", value: "none", important },
        { prop: "font-synthesis-weight", value: "none", important }
      ];
    }
    if (["inherit", "initial", "unset"].includes(lower)) {
      return ["font-synthesis-style", "font-synthesis-weight"].map((x) => ({ prop: x, value: lower, important }));
    }
    return [
      { prop: "font-synthesis-style", value: parts.includes("style") ? "auto" : "none", important },
      { prop: "font-synthesis-weight", value: parts.includes("weight") ? "auto" : "none", important }
    ];
  }
  return [{ prop: p, value: v, important }];
}

function insideSkippedAt(node: ChildNode): boolean {
  let p = node.parent as ChildNode | undefined;
  while (p && (p as { type: string }).type !== "root") {
    if (p.type === "atrule" && SKIP_AT.has((p as AtRule).name.toLowerCase())) return true;
    p = p.parent as ChildNode | undefined;
  }
  return false;
}

function stripUrl(v: string): string[] {
  const out: string[] = [];
  const re = /url\(\s*(['"]?)(.*?)\1\s*\)/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(v))) out.push(m[2]);
  return out;
}

export function parseSheet(css: string, source: string, orderStart: number, origin: "ua" | "author" = "author"): SheetData {
  const data: SheetData = { layerOrder: [], rules: [], fontFaces: [], imports: [] };
  let anon = 0;
  const anonNames = new Map<AtRule, string>();
  const layerNameOf = (at: AtRule): string => {
    const own = at.params.trim();
    if (own) return own;
    if (!anonNames.has(at)) anonNames.set(at, `<anonymous-${source}-${anon++}>`);
    return anonNames.get(at)!;
  };
  const noteLayer = (name: string) => {
    if (!data.layerOrder.includes(name)) data.layerOrder.push(name);
  };
  let root;
  try {
    root = postcss.parse(css, { from: undefined });
  } catch (e) {
    data.error = (e as Error).message;
    return data;
  }
  let order = orderStart;
  root.walk((node) => {
    if (node.type === "atrule") {
      const at = node as AtRule;
      const name = at.name.toLowerCase();
      if (name === "font-face") {
        let family = "";
        const srcUrls: string[] = [];
        at.walkDecls((d) => {
          if (d.prop.toLowerCase() === "font-family") family = d.value.trim().replace(/^["']|["']$/g, "");
          if (d.prop.toLowerCase() === "src") srcUrls.push(...stripUrl(d.value));
        });
        data.fontFaces.push({ family, srcUrls, source, line: at.source?.start?.line });
      } else if (name === "layer") {
        // 「@layer a, b;」只声明顺序；「@layer x { … }」也在这里登记顺序
        if (!at.nodes) for (const n of at.params.split(",").map((x) => x.trim()).filter(Boolean)) noteLayer(n);
        else noteLayer(layerPath(at, layerNameOf));
      } else if (name === "import") {
        const urls = stripUrl(at.params);
        const bare = at.params.trim().match(/^(['"])(.*?)\1/);
        if (urls.length) data.imports.push(urls[0]);
        else if (bare) data.imports.push(bare[2]);
      }
      return;
    }
    if (node.type !== "rule") return;
    const rule = node as Rule;
    if (insideSkippedAt(rule)) return;
    const parent = rule.parent as ChildNode | undefined;
    if (parent && parent.type === "atrule" && (parent as AtRule).name.toLowerCase() === "font-face") return;
    const decls: Decl[] = [];
    for (const child of rule.nodes ?? []) {
      if (child.type === "decl") decls.push(...expandDecl(child.prop, child.value, Boolean(child.important)));
    }
    if (!decls.length) return;
    const media: string[] = [];
    let supportsOk = true;
    let layer: string | undefined;
    let anc = rule.parent as ChildNode | undefined;
    while (anc && (anc as { type: string }).type !== "root") {
      if (anc.type === "atrule") {
        const a = anc as AtRule;
        const an = a.name.toLowerCase();
        if (an === "media") media.push(a.params);
        // 基础档假设浏览器支持现代特性：带 not 的 @supports 条件视为不成立（A-11）
        if (an === "supports" && /\bnot\s*\(/i.test(a.params)) supportsOk = false;
        if (an === "layer" && layer === undefined) layer = layerPath(a, layerNameOf);
      }
      anc = anc.parent as ChildNode | undefined;
    }
    if (!supportsOk) return;
    data.rules.push({ selectors: resolveNestedSelectors(rule), media, layer, decls, order: order++, origin, source, line: rule.source?.start?.line });
  });
  return data;
}

// 嵌套层的完整名字：外层.内层
function layerPath(at: AtRule, nameOf: (a: AtRule) => string): string {
  const names: string[] = [nameOf(at)];
  let p = at.parent as ChildNode | undefined;
  while (p && (p as { type: string }).type !== "root") {
    if (p.type === "atrule" && (p as AtRule).name.toLowerCase() === "layer") names.unshift(nameOf(p as AtRule));
    p = p.parent as ChildNode | undefined;
  }
  return names.join(".");
}

// CSS 嵌套：把子规则的选择器和所有祖先规则的选择器拼成完整选择器（A-11）
function resolveNestedSelectors(rule: Rule): string[] {
  let sels = rule.selectors;
  let p = rule.parent as ChildNode | undefined;
  while (p && (p as { type: string }).type !== "root") {
    if (p.type === "rule") {
      const parent = `:is(${(p as Rule).selectors.join(", ")})`;
      sels = sels.map((s) => (s.includes("&") ? s.replace(/&/g, parent) : `${parent} ${s}`));
    }
    p = p.parent as ChildNode | undefined;
  }
  return sels;
}

export function parseInlineStyle(style: string): Decl[] {
  try {
    const root = postcss.parse(`x{${style}}`);
    const out: Decl[] = [];
    root.walkDecls((d) => {
      out.push(...expandDecl(d.prop, d.value, Boolean(d.important)));
    });
    return out;
  } catch {
    return [];
  }
}

// 浏览器默认样式（只收和 W1 规则有关的部分）
export const UA_CSS = `
i, em, cite, var, dfn, address { font-style: italic; }
h1 { font-size: 2em; font-weight: bold; }
h2 { font-size: 1.5em; font-weight: bold; }
h3 { font-size: 1.17em; font-weight: bold; }
h4 { font-size: 1em; font-weight: bold; }
h5 { font-size: 0.83em; font-weight: bold; }
h6 { font-size: 0.67em; font-weight: bold; }
small, sub, sup { font-size: smaller; }
code, kbd, samp, pre, tt { font-family: monospace; }
`;
