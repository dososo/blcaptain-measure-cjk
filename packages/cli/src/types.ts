// 数据模型，按 PRD §7.3。字段名与 PRD 保持一致（snake_case）。

export const SCHEMA_VERSION = "1.0.0";
export const RULESET_VERSION = "w2-2026.10.25";
export const TOOL_VERSION = "0.1.0";

export type Severity = "error" | "warn";
export type Mode = "static" | "render";
export type RuleId = `T${string}` | `F${string}` | `A${string}`;

export interface Thresholds {
  line_length_warn: number;
  line_length_error: number;
  body_line_height_min: number;
  min_font_px_body: number;
  webfont_budget_kb: number;
}

export interface MeasureConfig {
  schema_version: string;
  locale: "zh-CN" | "zh-TW" | "zh-HK";
  quotes: "curly" | "corner";
  spacing: "css" | "text";
  font_dir?: string;
  scenario: "web" | "xhs-card" | "wechat";
  theme?: string;
  widths?: number[];
  thresholds: Thresholds;
  disabled: Record<string, string>;
  allow_remote: boolean;
}

export interface RuleMeta {
  id: RuleId;
  layer: "typeset" | "font" | "taste";
  severity: Severity;
  modes: Mode[];
  autofix: boolean;
  phase: "P0" | "P1" | "P2";
  doc: string;
  title: string;
  implemented_w1: boolean;
  implemented: boolean; // 当前版本是否已实现（W2 起：完整档新增 T12、A01、A11）
}

export interface Finding {
  rule: RuleId;
  severity: Severity;
  file: string;
  selector?: string;
  line?: number;
  viewport?: number;
  message: string;
  evidence?: string;
  fix_hint: string;
}

export type FontTier = "embeddable" | "image-only" | "system-only" | "commercial" | "unknown";
export type TriBool = boolean | "unknown";

export interface FontLicenseEntry {
  id: string;
  names: string[];
  name_prefixes?: string[];
  filename_prefixes?: string[];
  foundry: string;
  license: string;
  tier: FontTier;
  webfont_self_host: TriBool;
  commercial_image: TriBool;
  modify_subset: TriBool;
  attribution_required: TriBool;
  reserved_font_names: string[];
  revocable: TriBool;
  source_url: string;
  verified_at: string;
  notes?: string;
}

export interface SkippedInput {
  file: string;
  // W2 完整档新增：http-error（页面返回 4xx / 5xx）、navigated（加载后跳转）、no-visible-cjk（渲染后看不到任何中文）
  // cjk-in-frame（iframe 里有中文，完整档不检查）
  reason: "too-large" | "outside-root" | "unreadable" | "timeout" | "http-error" | "navigated" | "no-visible-cjk" | "cjk-in-frame";
}

export interface LintResult {
  schema_version: string;
  tool: { name: "measure-cjk"; version: string; ruleset_version: string };
  run: {
    started_at: string;
    mode: Mode;
    inputs: string[];
    config_sha256: string;
    network: "offline" | "localhost" | "remote";
    // 以下字段是 W1 对 PRD §7.3 的补充（见 PRD 附录 C2）
    skipped_inputs: SkippedInput[];
    remote_refs: string[];
    // 解析失败的样式表、css-select 不支持的选择器：这些样式没有被检查，必须让用户看到
    sheet_errors: string[];
    unsupported_selectors: string[];
    threshold_overrides: Partial<Thresholds>; // 偏离默认值的阈值（A-08：降级判定必须留痕）
    // W2 完整档：实际使用的浏览器、渲染宽度、截图目录（相对工作区）
    render?: { browser: string; widths: number[]; evidence_dir: string; problems: { file: string; detail: string }[] };
  };
  summary: {
    files: number;
    cjk_files: number;
    errors: number;
    warns: number;
    status: "pass" | "fail" | "skipped" | "incomplete"; // incomplete：有页面超时没检查完（A-34）
  };
  disabled_rules: { rule: RuleId; reason: string }[];
  fonts: { family: string; tier: FontTier; usage: "system" | "webfont" | "image" }[];
  findings: Finding[];
}

// 结论对应的元素的文字指纹（直接文字的前 24 个字符）。用 Symbol 做键：展开复制时会带上，JSON 输出里不会出现。
// 完整档靠它把基础档的结论和浏览器里的元素一一对应（AUDIT_RENDER_r3 RC-01、RC-03）
export const EL_TEXT = Symbol.for("measure-cjk.elText");
export function elText(f: Finding): string | undefined {
  return (f as Finding & { [EL_TEXT]?: string })[EL_TEXT];
}
// 同一个「选择器 + 文字指纹」在文档里出现多次时，这是第几个（从 0 起，按文档顺序）。
// 选择器只取 4 层、指纹只取前 24 个字，两个不同的元素可能撞成同一个身份，加上序号才能一一对应（AUDIT_RENDER_r5 RE-01）
export const EL_ORD = Symbol.for("measure-cjk.elOrd");
export function elOrd(f: Finding): number {
  return (f as Finding & { [EL_ORD]?: number })[EL_ORD] ?? 0;
}

export class UsageError extends Error {
  readonly exitCode = 2;
}

// 环境问题（例如用了 --render 但没装 Playwright、浏览器启动不了）：同样是退出码 2
export class EnvError extends UsageError {}
