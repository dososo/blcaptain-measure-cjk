// 全部规则的元数据（PRD §5.1–§5.3）。implemented_w1 标出 W1 基础档实现的 13 条；implemented 是当前版本（W2 完整档新增 T12、A01、A11）。
import type { RuleMeta } from "./types.js";

const RENDER_ONLY = new Set(["T12", "A01", "A11"]);

const T = (id: string, title: string, severity: "error" | "warn", phase: "P0" | "P1" | "P2", w1: boolean, autofix = false): RuleMeta => ({
  id: id as RuleMeta["id"],
  layer: "typeset",
  severity,
  modes: RENDER_ONLY.has(id) ? ["render"] : ["static", "render"],
  autofix,
  phase,
  doc: `references/typesetting.md#${id.toLowerCase()}`,
  title,
  implemented_w1: w1,
  implemented: w1 || RENDER_ONLY.has(id)
});

const A_TITLES: Record<string, string> = {
  A01: "紫色、蓝紫渐变背景（只有完整档检查）",
  A11: "每段都加粗关键词，加粗比例超过 15%（只有完整档检查）"
};

export const RULES: RuleMeta[] = [
  T("T01", "根元素声明中文 lang", "error", "P0", true, true),
  T("T02", "中英文、中文与数字之间要有间距", "error", "P0", true),
  T("T03", "中文语境用全角标点，引号风格统一", "error", "P0", true, true),
  T("T04", "行首行尾禁则：line-break: strict", "error", "P0", true),
  T("T05", "正文行长 28–40 字（基础档只报 warn）", "error", "P0", true),
  T("T06", "正文行高不低于 1.5", "error", "P0", true),
  T("T07", "中文字距不能为负", "error", "P0", true),
  T("T08", "中文不用斜体", "error", "P0", true),
  T("T09", "text-transform / small-caps 对中文无效", "warn", "P0", true),
  T("T10", "声明的字重在中文字体里真实存在", "warn", "P1", false),
  T("T11", "最小字号：正文 ≥ 14px，任何中文 ≥ 12px", "error", "P0", true),
  T("T12", "首行缩进和段间距二选一（只有完整档检查）", "warn", "P0", false),
  T("T13", "字体栈里要有中文字体", "error", "P0", true),
  T("T14", "标点挤压 text-spacing-trim", "warn", "P1", false),
  T("T15", "text-wrap: balance / pretty", "warn", "P1", false),
  T("T16", "西文占比高的段落慎用两端对齐", "warn", "P1", false),
  T("T17", "数字用法、省略号、破折号", "warn", "P1", false),
  T("T18", "竖排", "warn", "P2", false),
  T("T19", "繁体标点", "warn", "P1", false),
  { id: "F03", layer: "font", severity: "error", modes: ["static", "render"], autofix: false, phase: "P0", doc: "references/fonts.md#f03", title: "自托管 webfont 的授权", implemented_w1: true, implemented: true },
  { id: "F04", layer: "font", severity: "warn", modes: ["static"], autofix: false, phase: "P0", doc: "references/fonts.md#f04", title: "measure-cjk fonts 查询授权", implemented_w1: true, implemented: true },
  { id: "F05", layer: "font", severity: "warn", modes: ["render"], autofix: false, phase: "P1", doc: "references/fonts.md#f05", title: "webfont 体积预算和子集化改名", implemented_w1: false, implemented: false },
  { id: "F06", layer: "font", severity: "error", modes: ["render"], autofix: false, phase: "P0", doc: "references/fonts.md#f06", title: "出图场景只用 commercial_image 为 true 的字体（card 命令检查）", implemented_w1: false, implemented: true },
  ...["A01", "A02", "A03", "A04", "A05", "A06", "A07", "A08", "A09", "A10", "A11", "A12"].map(
    (id): RuleMeta => ({
      id: id as RuleMeta["id"],
      layer: "taste",
      severity: "warn",
      modes: RENDER_ONLY.has(id) || ["A08", "A10"].includes(id) ? ["render"] : ["static"],
      autofix: false,
      phase: ["A08", "A10"].includes(id) ? "P1" : "P0",
      doc: `references/anti-patterns.md#${id.toLowerCase()}`,
      title: A_TITLES[id] ?? "中文 AI 味反模式（计划中，未实现）",
      implemented_w1: false,
      implemented: RENDER_ONLY.has(id)
    })
  )
];

export function ruleMeta(id: string): RuleMeta | undefined {
  return RULES.find((r) => r.id === id);
}
