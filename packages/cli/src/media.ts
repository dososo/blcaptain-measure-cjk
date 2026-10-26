// 基础档的 @media 求值：在两个典型视口（桌面 1280×800、手机 390×844）下分别判断。
// 只支持常见条件；认不出的条件按「生效」处理（宁可多查，不漏查）。
export interface Viewport {
  width: number;
  height: number;
  phone: boolean;
  label: string;
}

export const STATIC_VIEWPORTS: Viewport[] = [
  { width: 1280, height: 800, phone: false, label: "桌面 1280px" },
  { width: 390, height: 844, phone: true, label: "窄屏 390px" }
];

function lengthPx(v: string): number | undefined {
  const m = v.trim().toLowerCase().match(/^(\d*\.?\d+)(px|em|rem)?$/);
  if (!m) return undefined;
  const n = parseFloat(m[1]);
  return m[2] === "em" || m[2] === "rem" ? n * 16 : n;
}

function feature(expr: string, vp: Viewport): boolean {
  const e = expr.trim().toLowerCase();
  // 范围语法：width >= 600px、400px <= width <= 900px
  const range = e.match(/^(?:(\S+)\s*(<=|<|>=|>)\s*)?(width|height)\s*(<=|<|>=|>)\s*(\S+)$/);
  if (range) {
    const dim = range[3] === "width" ? vp.width : vp.height;
    const test = (a: number, op: string, b: number) => (op === "<=" ? a <= b : op === "<" ? a < b : op === ">=" ? a >= b : a > b);
    const right = lengthPx(range[5]);
    if (right === undefined) return true;
    let ok = test(dim, range[4], right);
    if (range[1]) {
      const left = lengthPx(range[1]);
      const flip: Record<string, string> = { "<=": ">=", "<": ">", ">=": "<=", ">": "<" };
      if (left !== undefined) ok = ok && test(dim, flip[range[2]], left);
    }
    return ok;
  }
  const [name, rawValue] = e.split(":").map((x) => x.trim());
  const value = rawValue ?? "";
  switch (name) {
    case "min-width":
      return (lengthPx(value) ?? 0) <= vp.width;
    case "max-width":
      return (lengthPx(value) ?? Infinity) >= vp.width;
    case "min-height":
      return (lengthPx(value) ?? 0) <= vp.height;
    case "max-height":
      return (lengthPx(value) ?? Infinity) >= vp.height;
    case "orientation":
      return value === (vp.width > vp.height ? "landscape" : "portrait");
    case "prefers-color-scheme":
      return value !== "dark";
    case "prefers-reduced-motion":
    case "prefers-contrast":
    case "forced-colors":
    case "prefers-reduced-transparency":
      return value === "" || value === "no-preference" || value === "none";
    case "hover":
    case "any-hover":
      return value === (vp.phone ? "none" : "hover");
    case "pointer":
    case "any-pointer":
      return value === (vp.phone ? "coarse" : "fine");
    default:
      return true;
  }
}

function singleQuery(q: string, vp: Viewport): boolean {
  let s = q.trim().toLowerCase();
  let negate = false;
  if (s.startsWith("not ")) {
    negate = true;
    s = s.slice(4);
  }
  s = s.replace(/^only\s+/, "");
  const parts = s.split(/\s+and\s+/);
  let ok = true;
  for (const part of parts) {
    const p = part.trim();
    if (p === "print" || p === "speech") ok = false;
    else if (p === "screen" || p === "all" || p === "") ok = ok && true;
    else if (p.startsWith("(") && p.endsWith(")")) ok = ok && feature(p.slice(1, -1), vp);
    else ok = ok && true;
  }
  return negate ? !ok : ok;
}

export function matchesMedia(params: string, vp: Viewport): boolean {
  const queries = params.split(",").map((q) => q.trim()).filter(Boolean);
  if (queries.length === 0) return true;
  return queries.some((q) => singleQuery(q, vp));
}
