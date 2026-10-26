// 选择器优先级（近似实现，够基础档用）：返回 [id, class/属性/伪类, 元素/伪元素]。
// :where() 记 0；:is() / :not() / :has() / :matches() 取参数里最高的一项。
export type Spec = [number, number, number];

function add(a: Spec, b: Spec): Spec {
  return [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
}

function cmp(a: Spec, b: Spec): number {
  return a[0] - b[0] || a[1] - b[1] || a[2] - b[2];
}

function splitTopLevel(s: string): string[] {
  const out: string[] = [];
  let depth = 0;
  let cur = "";
  for (const ch of s) {
    if (ch === "(" || ch === "[") depth++;
    if (ch === ")" || ch === "]") depth--;
    if (ch === "," && depth === 0) {
      out.push(cur);
      cur = "";
    } else cur += ch;
  }
  out.push(cur);
  return out.map((x) => x.trim()).filter(Boolean);
}

const LEGACY_PSEUDO_ELEMENTS = new Set(["before", "after", "first-line", "first-letter"]);

export function specificity(selector: string): Spec {
  let s = selector.replace(/(["'])(?:\\.|(?!\1).)*\1/g, '""');
  let total: Spec = [0, 0, 0];
  let i = 0;
  while (i < s.length) {
    const ch = s[i];
    if (ch === "#") {
      total = add(total, [1, 0, 0]);
      i++;
      while (i < s.length && /[\w\- -￿\\]/.test(s[i])) i++;
    } else if (ch === ".") {
      total = add(total, [0, 1, 0]);
      i++;
      while (i < s.length && /[\w\- -￿\\]/.test(s[i])) i++;
    } else if (ch === "[") {
      total = add(total, [0, 1, 0]);
      let depth = 1;
      i++;
      while (i < s.length && depth > 0) {
        if (s[i] === "[") depth++;
        if (s[i] === "]") depth--;
        i++;
      }
    } else if (ch === ":") {
      const isElement = s[i + 1] === ":";
      i += isElement ? 2 : 1;
      let name = "";
      while (i < s.length && /[\w-]/.test(s[i])) name += s[i++];
      let args: string | null = null;
      if (s[i] === "(") {
        let depth = 1;
        let j = i + 1;
        while (j < s.length && depth > 0) {
          if (s[j] === "(") depth++;
          if (s[j] === ")") depth--;
          j++;
        }
        args = s.slice(i + 1, j - 1);
        i = j;
      }
      const lname = name.toLowerCase();
      if (isElement || LEGACY_PSEUDO_ELEMENTS.has(lname)) total = add(total, [0, 0, 1]);
      else if (lname === "where") {
        // 0
      } else if (["is", "not", "has", "matches", "-webkit-any", "-moz-any"].includes(lname) && args !== null) {
        let best: Spec = [0, 0, 0];
        for (const part of splitTopLevel(args)) {
          const sp = specificity(part);
          if (cmp(sp, best) > 0) best = sp;
        }
        total = add(total, best);
      } else total = add(total, [0, 1, 0]);
    } else if (/[a-zA-Z]/.test(ch) && (i === 0 || /[\s>+~(,]/.test(s[i - 1]))) {
      total = add(total, [0, 0, 1]);
      while (i < s.length && /[\w-]/.test(s[i])) i++;
    } else i++;
  }
  return total;
}

export { cmp as compareSpec };
