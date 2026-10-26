// 页面模型：解析 HTML，按文档顺序收集样式，找出含中文文字的元素和文本节点。
import { readFileSync } from "node:fs";
import { parseDocument } from "htmlparser2";
import type { Document, Element, AnyNode, Text } from "domhandler";
import { Cascade } from "./cascade.js";
import type { Viewport } from "./media.js";
import { parseSheet, type FontFace, type StyleRule } from "./css.js";
import { resolveLocalRef, rel } from "./fsafe.js";
import type { SkippedInput } from "./types.js";

export const HAN = /\p{Script=Han}/u;
const NON_RENDERED = new Set(["script", "style", "noscript", "template", "head", "title", "meta", "link"]);
// CODE_LIKE：不做文字类检查（T02 文本模式、T03）的容器；CODE_BLOCK：C9 豁免只限这四种（A-31）
export const CODE_LIKE = new Set(["code", "pre", "kbd", "samp", "textarea", "script", "style"]);
export const CODE_BLOCK = new Set(["code", "pre", "kbd", "samp"]);
export const BLOCK = new Set(["p", "li", "h1", "h2", "h3", "h4", "h5", "h6", "td", "th", "dd", "dt", "blockquote", "figcaption", "caption", "div", "section", "article", "aside", "header", "footer", "main", "nav", "label", "legend", "summary", "address", "button", "option"]);

export interface TextItem {
  node: Text;
  el: Element;
  text: string;
}

export interface PageModel {
  file: string;
  real: string;
  doc: Document;
  htmlEl: Element | null;
  cascade: Cascade;
  cascadeAt: (vp: Viewport) => Cascade;
  cjkElements: Element[];
  textItems: TextItem[];
  fontFaces: (FontFace & { file: string })[];
  remoteRefs: string[];
  skipped: SkippedInput[];
  sheetErrors: string[];
  lineOf: (el: Element) => number | undefined;
  selectorOf: (el: Element) => string;
  textOf: (el: Element) => string; // 直接文字的前 24 个字符（去掉控制字符、合并空白），和完整档 probe.ts 的写法一致（RA-16）
  ordOf: (el: Element) => number; // 在选择器和文字指纹都相同的中文元素里排第几（RE-01）；不是中文元素时为 0
}

function isElement(n: AnyNode): n is Element {
  return (n as Element).attribs !== undefined && (n as Element).name !== undefined;
}

function children(n: AnyNode): AnyNode[] {
  return ((n as Element).children ?? []) as AnyNode[];
}

export function hasAncestor(el: Element, names: Set<string>): boolean {
  let e: AnyNode | null = el;
  while (e) {
    if (isElement(e) && names.has(e.name)) return true;
    e = e.parent as AnyNode | null;
  }
  return false;
}

// source：完整档检查 URL 页面时，传入浏览器里取到的 DOM 快照（样式已内联，没有外部引用），file 是 URL 本身
export function buildPage(rootReal: string, real: string, source?: { src: string; file: string }): PageModel {
  const src = source ? source.src : readFileSync(real, "utf8");
  const doc = parseDocument(src, { withStartIndices: true, lowerCaseTags: true, lowerCaseAttributeNames: true });
  const file = source ? source.file : rel(rootReal, real);
  const newlines: number[] = [];
  for (let i = 0; i < src.length; i++) if (src[i] === "\n") newlines.push(i);
  const lineAt = (idx: number) => {
    let lo = 0;
    let hi = newlines.length;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (newlines[mid] < idx) lo = mid + 1;
      else hi = mid;
    }
    return lo + 1;
  };

  const rules: StyleRule[] = [];
  const layerOrder: string[] = [];
  const fontFaces: (FontFace & { file: string })[] = [];
  const remoteRefs: string[] = [];
  const skipped: SkippedInput[] = [];
  const sheetErrors: string[] = [];
  let order = 0;
  const seenSheets = new Set<string>();

  const addSheet = (css: string, source: string, sourceFile: string, sourceReal: string, depth: number, lineOffset = 0) => {
    const data = parseSheet(css, source, order);
    order += data.rules.length + 1;
    for (const l of data.layerOrder) if (!layerOrder.includes(l)) layerOrder.push(l);
    if (data.error) sheetErrors.push(`${source}：${data.error}`);
    rules.push(...data.rules);
    for (const ff of data.fontFaces) fontFaces.push({ ...ff, line: ff.line !== undefined ? ff.line + lineOffset : undefined, file: sourceFile });
    if (depth >= 3) return;
    for (const imp of data.imports) {
      const r = resolveLocalRef(rootReal, sourceReal, imp);
      if (r.remote) remoteRefs.push(r.remote);
      if (r.skipped) skipped.push(r.skipped);
      if (r.real && !seenSheets.has(r.real)) {
        seenSheets.add(r.real);
        addSheet(readFileSync(r.real, "utf8"), rel(rootReal, r.real), rel(rootReal, r.real), r.real, depth + 1);
      }
    }
  };

  let htmlEl: Element | null = null;
  const walk = (n: AnyNode) => {
    if (isElement(n)) {
      if (n.name === "html" && !htmlEl) htmlEl = n;
      if (n.name === "style") {
        const text = children(n).map((c) => (c as Text).data ?? "").join("");
        const line = n.startIndex !== null ? lineAt(n.startIndex) - 1 : 0;
        addSheet(text, `${file}#style@${line + 1}`, file, real, 0, line);
      } else if (n.name === "link" && /(^|\s)stylesheet(\s|$)/i.test(n.attribs.rel ?? "") && n.attribs.href) {
        const r = resolveLocalRef(rootReal, real, n.attribs.href);
        if (r.remote) remoteRefs.push(r.remote);
        if (r.skipped) skipped.push(r.skipped);
        if (r.real && !seenSheets.has(r.real)) {
          seenSheets.add(r.real);
          addSheet(readFileSync(r.real, "utf8"), rel(rootReal, r.real), rel(rootReal, r.real), r.real, 0);
        }
      }
    }
    for (const c of children(n)) walk(c);
  };
  walk(doc);

  const cascadeAt = (vp: Viewport) => {
    const c = new Cascade(rules, vp, layerOrder);
    c.rootEl = htmlEl;
    return c;
  };
  const cascade = cascadeAt({ width: 1280, height: 800, phone: false, label: "桌面 1280px" });

  const cjkElements: Element[] = [];
  const textItems: TextItem[] = [];
  const collect = (n: AnyNode) => {
    if (isElement(n)) {
      if (NON_RENDERED.has(n.name)) return;
      const direct = children(n).filter((c) => c.type === "text") as Text[];
      if (direct.some((t) => HAN.test(t.data))) cjkElements.push(n);
      if (!hasAncestor(n, CODE_LIKE)) {
        for (const t of direct) if (HAN.test(t.data)) textItems.push({ node: t, el: n, text: t.data });
      }
    }
    for (const c of children(n)) collect(c);
  };
  collect(doc);

  const selectorOf = (el: Element): string => {
    const parts: string[] = [];
    let e: AnyNode | null = el;
    while (e && isElement(e) && parts.length < 4) {
      const cur: Element = e;
      if (cur.name === "html" || cur.name === "body") break;
      let part = cur.name;
      if (cur.attribs.id) part += `#${cur.attribs.id}`;
      else if (cur.attribs.class) part += `.${cur.attribs.class.trim().split(/\s+/)[0]}`;
      const parent = cur.parent as AnyNode | null;
      if (parent) {
        const same = children(parent).filter((c) => isElement(c) && c.name === cur.name);
        if (same.length > 1) part += `:nth-of-type(${same.indexOf(cur) + 1})`;
      }
      parts.unshift(part);
      e = parent;
    }
    return parts.join(" > ") || el.name;
  };

  const textOf = (el: Element) =>
    children(el)
      .filter((c) => c.type === "text")
      .map((c) => (c as Text).data)
      .join("")
      .replace(/[\p{Cc}\p{Cf}]/gu, "")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 24);
  let ords: Map<Element, number> | undefined;
  const ordOf = (el: Element) => {
    if (!ords) {
      ords = new Map();
      const seen = new Map<string, number>();
      for (const e of cjkElements) {
        const k = `${selectorOf(e)}\u0001${textOf(e)}`;
        const n = seen.get(k) ?? 0;
        ords.set(e, n);
        seen.set(k, n + 1);
      }
    }
    return ords.get(el) ?? 0;
  };

  return {
    file,
    real,
    doc,
    htmlEl,
    cascade,
    cascadeAt,
    cjkElements,
    textItems,
    fontFaces,
    remoteRefs,
    skipped,
    sheetErrors,
    lineOf: (el) => (el.startIndex !== null ? lineAt(el.startIndex) : undefined),
    selectorOf,
    textOf,
    ordOf
  };
}

export function buildCssOnly(rootReal: string, real: string): { file: string; fontFaces: (FontFace & { file: string })[]; sheetErrors: string[] } {
  const file = rel(rootReal, real);
  const data = parseSheet(readFileSync(real, "utf8"), file, 0);
  return { file, fontFaces: data.fontFaces.map((f) => ({ ...f, file })), sheetErrors: data.error ? [`${file}：${data.error}`] : [] };
}
