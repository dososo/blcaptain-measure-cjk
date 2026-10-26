// 字体授权表的读取与匹配。判定只看布尔字段，档位只用于展示（PRD §5.2、O9）。
import { readFileSync } from "node:fs";
import { dirname, join, basename, extname } from "node:path";
import { fileURLToPath } from "node:url";
import type { FontLicenseEntry, FontTier } from "./types.js";

const here = dirname(fileURLToPath(import.meta.url));

export interface LicenseTable {
  schema_version: string;
  disclaimer: string;
  fonts: FontLicenseEntry[];
}

let cached: LicenseTable | undefined;

export function loadLicenseTable(): LicenseTable {
  if (!cached) {
    // 包内副本由 scripts/sync-assets.mjs 从 data/fonts/licenses.json 同步，测试保证两份一致
    const p = join(here, "..", "data", "licenses.json");
    cached = JSON.parse(readFileSync(p, "utf8")) as LicenseTable;
  }
  return cached;
}

export const TIER_LABEL: Record<FontTier, string> = {
  embeddable: "🟢 可嵌入",
  "image-only": "🔵 可出图",
  "system-only": "🟡 只能调用系统字体",
  commercial: "🔴 商用授权",
  unknown: "❔ 原文没写清"
};

export function normalizeFamily(name: string): string {
  return name.trim().replace(/^["']|["']$/g, "").toLowerCase().replace(/[\s_\-]+/g, "");
}

// 精确匹配前去掉字符集 / 繁简后缀，例如「方正黑体_GBK」「方正黑体简体」（A-14）。不去 SC/TC，避免把西文的 Noto Sans 当成 Noto Sans SC
function stripSuffix(n: string): string {
  return n.replace(/(gbk|gb18030|gb2312|简体|繁体)$/, "");
}

// 按字体名匹配：先精确匹配所有条目的 names，再按 name_prefixes 前缀匹配（区分大小写）
export function matchFontName(name: string, table = loadLicenseTable()): FontLicenseEntry | undefined {
  const raw = name.trim().replace(/^["']|["']$/g, "");
  const n = normalizeFamily(raw);
  if (!n) return undefined;
  const exact = table.fonts.find((f) => f.names.some((x) => normalizeFamily(x) === n));
  if (exact) return exact;
  const loose = stripSuffix(n);
  const bySuffix = table.fonts.find((f) => f.names.some((x) => stripSuffix(normalizeFamily(x)) === loose));
  if (bySuffix) return bySuffix;
  return table.fonts.find((f) => (f.name_prefixes ?? []).some((p) => prefixMatches(raw, p)));
}

// 前缀匹配的统一规则（A-37）：区分大小写；两个字母的拉丁前缀（FZ、HY）后面必须紧跟一个大写字母，
// 这样 FZLanTingHei、HYQiHei 能命中，Hyperlegible、Hybrid 这类西文名不会被误伤。前缀只是字体名到条目的映射规则，不是授权结论
function prefixMatches(raw: string, prefix: string): boolean {
  if (!raw.startsWith(prefix)) return false;
  if (/^[A-Za-z]{2}$/.test(prefix)) return /^[A-Z]$/.test(raw.charAt(prefix.length));
  return true;
}

// 按字体文件名匹配：文件名（去扩展名、归一化后）以某个字体名开头；取最长的那个名字
export function matchFontFile(file: string, table = loadLicenseTable()): FontLicenseEntry | undefined {
  const base = basename(file.split(/[?#]/)[0], extname(file.split(/[?#]/)[0]));
  const n = normalizeFamily(base);
  let best: { entry: FontLicenseEntry; len: number } | undefined;
  for (const f of table.fonts) {
    for (const name of f.names) {
      const k = normalizeFamily(name);
      if (k.length >= 4 && n.startsWith(k) && (!best || k.length > best.len)) best = { entry: f, len: k.length };
    }
  }
  if (best) return best.entry;
  // 先按字体名的前缀规则匹配；再按数据里单独列出的文件名前缀（不区分大小写，如 fzltxh.woff2）匹配（A-14、A-37）
  const byName = table.fonts.find((f) => (f.name_prefixes ?? []).some((p) => prefixMatches(base, p)));
  if (byName) return byName;
  return table.fonts.find((f) => (f.filename_prefixes ?? []).some((p) => base.toLowerCase().startsWith(p.toLowerCase())));
}

// 常见的系统中文字体（不在授权表里，但出现在字体栈里时算作「有中文字体」）
const SYSTEM_CJK = [
  "Hiragino Sans GB", "Hiragino Sans", "Heiti SC", "Heiti TC", "STHeiti", "Songti SC", "Songti TC", "STSong",
  "Kaiti SC", "STKaiti", "KaiTi", "FangSong", "STFangsong", "SimSun", "NSimSun", "SimHei",
  "Microsoft JhengHei", "Microsoft JhengHei UI", "DengXian", "等线", "宋体", "黑体", "楷体", "仿宋",
  "WenQuanYi Micro Hei", "WenQuanYi Zen Hei", "Droid Sans Fallback", "Sarasa Gothic SC", "LXGW Neo XiHei"
].map(normalizeFamily);

export function isCjkFamily(name: string, extraCjkFamilies: Set<string>): boolean {
  const n = normalizeFamily(name);
  if (SYSTEM_CJK.includes(n)) return true;
  if (extraCjkFamilies.has(n)) return true;
  if (/\p{Script=Han}/u.test(name)) return true;
  return matchFontName(name) !== undefined;
}

export function parseFamilyList(value: string): string[] {
  const out: string[] = [];
  let cur = "";
  let quote: string | null = null;
  for (const ch of value) {
    if (quote) {
      if (ch === quote) quote = null;
      else cur += ch;
    } else if (ch === '"' || ch === "'") quote = ch;
    else if (ch === ",") {
      out.push(cur.trim());
      cur = "";
    } else cur += ch;
  }
  if (cur.trim()) out.push(cur.trim());
  return out.filter(Boolean);
}
