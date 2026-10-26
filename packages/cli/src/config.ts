// 配置：默认值、读取、校验。关闭规则必须写理由（硬约束 H7），没有任何绕过开关。
import { createHash } from "node:crypto";
import { existsSync, lstatSync, readFileSync, realpathSync } from "node:fs";
import { resolve, join } from "node:path";
import { isInside } from "./fsafe.js";
import { SCHEMA_VERSION, UsageError, type MeasureConfig } from "./types.js";
import { ruleMeta } from "./rulesMeta.js";

export function defaultConfig(): MeasureConfig {
  return {
    schema_version: SCHEMA_VERSION,
    locale: "zh-CN",
    quotes: "curly",
    spacing: "css",
    scenario: "web",
    thresholds: { line_length_warn: 40, line_length_error: 45, body_line_height_min: 1.5, min_font_px_body: 14, webfont_budget_kb: 300 },
    disabled: {},
    allow_remote: false
  };
}

// 完整档的视口宽度：200–3840 的整数，1–8 个，不重复（PRD §5.4 默认 6 种）
export const DEFAULT_WIDTHS = [360, 390, 768, 1024, 1280, 1440];
export function validateWidths(list: unknown[], source: string): number[] {
  const out = list.map((v) => (typeof v === "string" && /^\d+$/.test(v.trim()) ? Number(v) : v));
  if (out.length === 0 || out.length > 8 || out.some((v) => typeof v !== "number" || !Number.isInteger(v) || v < 200 || v > 3840)) {
    throw new UsageError(`${source} 只能是 1–8 个 200–3840 之间的整数，例如 360,390,768,1024,1280,1440`);
  }
  if (new Set(out).size !== out.length) throw new UsageError(`${source} 里有重复的宽度`);
  return out as number[];
}

// 阈值的允许范围：只能往严的方向调，宽松的那一端就是 PRD 规定的默认值（A-08、A-39）
const THRESHOLD_RANGE: Record<string, [number, number]> = {
  line_length_warn: [20, 40],
  line_length_error: [20, 45],
  body_line_height_min: [1.5, 2.0],
  min_font_px_body: [14, 24],
  webfont_budget_kb: [50, 300]
};

const KNOWN_KEYS = new Set(["schema_version", "locale", "quotes", "spacing", "font_dir", "scenario", "theme", "widths", "thresholds", "disabled", "allow_remote"]);

export function validateConfig(raw: unknown, source: string): MeasureConfig {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) throw new UsageError(`配置文件 ${source} 不是 JSON 对象`);
  const r = raw as Record<string, unknown>;
  const unknown = Object.keys(r).filter((k) => !KNOWN_KEYS.has(k));
  if (unknown.length) throw new UsageError(`配置文件 ${source} 有未知字段：${unknown.join(", ")}`);
  if (r.schema_version !== SCHEMA_VERSION) throw new UsageError(`配置文件 ${source} 的 schema_version 应为 "${SCHEMA_VERSION}"`);
  const cfg = defaultConfig();
  const pick = <K extends keyof MeasureConfig>(k: K, allowed: readonly unknown[]) => {
    if (r[k] === undefined) return;
    if (!allowed.includes(r[k])) throw new UsageError(`配置字段 ${k} 的取值 ${JSON.stringify(r[k])} 无效，可选：${allowed.join(" / ")}`);
    (cfg as unknown as Record<string, unknown>)[k] = r[k];
  };
  pick("locale", ["zh-CN", "zh-TW", "zh-HK"]);
  pick("quotes", ["curly", "corner"]);
  pick("spacing", ["css", "text"]);
  pick("scenario", ["web", "xhs-card", "wechat"]);
  pick("allow_remote", [true, false]);
  if (typeof r.theme === "string") cfg.theme = r.theme;
  if (typeof r.font_dir === "string") cfg.font_dir = r.font_dir;
  if (r.widths !== undefined) {
    if (!Array.isArray(r.widths)) throw new UsageError("配置字段 widths 必须是数组");
    cfg.widths = validateWidths(r.widths, `配置文件 ${source} 的 widths`);
  }
  if (r.thresholds !== undefined) {
    if (typeof r.thresholds !== "object" || r.thresholds === null) throw new UsageError("配置字段 thresholds 必须是对象");
    for (const [k, v] of Object.entries(r.thresholds)) {
      if (!(k in cfg.thresholds)) throw new UsageError(`thresholds 里有未知字段：${k}`);
      if (typeof v !== "number" || !Number.isFinite(v)) throw new UsageError(`thresholds.${k} 必须是数字`);
      const [lo, hi] = THRESHOLD_RANGE[k];
      if (v < lo || v > hi) throw new UsageError(`thresholds.${k} 的取值 ${v} 超出允许范围 ${lo}–${hi}`);
      (cfg.thresholds as unknown as Record<string, number>)[k] = v;
    }
  }
  if (r.disabled !== undefined) {
    if (typeof r.disabled !== "object" || r.disabled === null || Array.isArray(r.disabled)) throw new UsageError("配置字段 disabled 必须是 {规则ID: 理由} 对象");
    for (const [id, reason] of Object.entries(r.disabled)) {
      if (!ruleMeta(id)) throw new UsageError(`disabled 里的规则 ${id} 不存在`);
      if (typeof reason !== "string" || reason.trim() === "") throw new UsageError(`关闭规则 ${id} 必须写明理由（disabled.${id} 不能为空）`);
      cfg.disabled[id] = reason.trim();
    }
  }
  return cfg;
}

// 本次运行实际读取的配置文件（realpath），供 --out 校验使用（A-35）
export let lastConfigPath: string | undefined;

export function loadConfig(rootReal: string, configPath?: string, cwd = process.cwd()): MeasureConfig {
  lastConfigPath = undefined;
  let p: string | undefined;
  if (configPath) {
    p = resolve(cwd, configPath);
    if (!existsSync(p)) throw new UsageError(`找不到配置文件：${configPath}`);
    if (!isInside(rootReal, realpathSync(p))) throw new UsageError(`配置文件在工作区之外，已拒绝：${configPath}`);
  } else {
    const def = join(rootReal, "measure.config.json");
    let present = false;
    try {
      lstatSync(def);
      present = true;
    } catch {
      present = false;
    }
    if (present) {
      // 默认配置同样要做 realpath + 工作区内校验，不能跟随 symlink 读工作区外的文件（A-03）
      let real: string;
      try {
        real = realpathSync(def);
      } catch {
        throw new UsageError("默认配置 measure.config.json 是一个悬空的符号链接，已拒绝");
      }
      if (!isInside(rootReal, real)) throw new UsageError("默认配置 measure.config.json 指向工作区之外，已拒绝");
      p = real;
    }
  }
  if (!p) return defaultConfig();
  lastConfigPath = realpathSync(p);
  let raw: unknown;
  try {
    raw = JSON.parse(readFileSync(p, "utf8"));
  } catch {
    // 不回显解析错误的原文，避免把文件内容带进输出（A-03）
    throw new UsageError("配置文件不是合法 JSON，请检查格式");
  }
  return validateConfig(raw, p);
}

export function thresholdOverrides(cfg: MeasureConfig): Partial<MeasureConfig["thresholds"]> {
  const d = defaultConfig().thresholds;
  return Object.fromEntries(Object.entries(cfg.thresholds).filter(([k, v]) => d[k as keyof typeof d] !== v));
}

export function configSha256(cfg: MeasureConfig): string {
  return createHash("sha256").update(JSON.stringify(sortDeep(cfg))).digest("hex");
}

function sortDeep(v: unknown): unknown {
  if (Array.isArray(v)) return v.map(sortDeep);
  if (v && typeof v === "object") return Object.fromEntries(Object.keys(v as object).sort().map((k) => [k, sortDeep((v as Record<string, unknown>)[k])]));
  return v;
}
