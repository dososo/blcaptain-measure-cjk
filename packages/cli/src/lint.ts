// lint 主流程：收集输入 → 逐文件建模 → 跑规则 → 应用 disabled → 汇总 LintResult。
// 完整档（render.ts）复用这里的逐页静态检查和汇总，只把能实测的规则换成浏览器里的结果。
import { extname } from "node:path";
import { buildCssOnly, buildPage, type PageModel } from "./model.js";
import { runCssRules, runPageRules } from "./rules.js";
import { collectInputs, dedupeSkipped, realRoot } from "./fsafe.js";
import { configSha256, defaultConfig, thresholdOverrides } from "./config.js";
import { matchFontName, parseFamilyList } from "./fonts.js";
import { STATIC_VIEWPORTS } from "./media.js";
import { pageBudgetMs } from "./rules.js";
import { RULESET_VERSION, SCHEMA_VERSION, TOOL_VERSION, UsageError, elText, type Finding, type LintResult, type MeasureConfig, type Mode, type RuleId, type SkippedInput } from "./types.js";

export interface LintOptions {
  inputs: string[];
  root?: string;
  cwd?: string;
  config?: MeasureConfig;
  render?: boolean;
}

// URL 输入只有完整档能检查（基础档离线，不发请求）
export const URL_INPUT = /^[a-z][a-z0-9+.-]*:\/\//i;

// 逐页静态检查的累加器
export interface Accum {
  findings: Finding[];
  remoteRefs: Set<string>;
  sheetErrors: string[];
  unsupported: Set<string>;
  fontUse: Map<string, LintResult["fonts"][number]>;
  skipped: SkippedInput[];
  cjkFiles: number;
  incomplete: boolean; // 有输入没有检查完（静态超时，或完整档渲染超时 / 打不开）
}

export function newAccum(skipped: SkippedInput[] = []): Accum {
  return { findings: [], remoteRefs: new Set(), sheetErrors: [], unsupported: new Set(), fontUse: new Map(), skipped, cjkFiles: 0, incomplete: false };
}

export function lintCssFile(acc: Accum, rootReal: string, real: string): void {
  const css = buildCssOnly(rootReal, real);
  acc.sheetErrors.push(...css.sheetErrors);
  acc.findings.push(...runCssRules(css.fontFaces, css.file));
}

// 一个 HTML 页面的静态检查；返回页面里是否有中文
export function lintPageInto(acc: Accum, page: PageModel, config: MeasureConfig): boolean {
  page.remoteRefs.forEach((r) => acc.remoteRefs.add(r));
  acc.sheetErrors.push(...page.sheetErrors);
  page.cascade.unsupportedSelectors.forEach((sel) => acc.unsupported.add(`${page.file}：${sel}`));
  acc.skipped.push(...page.skipped);
  if (page.cjkElements.length === 0) return false;
  acc.cjkFiles++;
  // 桌面视口的结果全部保留；窄屏视口只补充桌面上没有出现的问题，并标明视口
  const seenHere = new Set<string>();
  for (const [i, vp] of STATIC_VIEWPORTS.entries()) {
    const found = runPageRules(page, config, page.cascadeAt(vp));
    if ((found as { timedOut?: boolean }).timedOut) acc.skipped.push({ file: page.file, reason: "timeout" });
    for (const f of found) {
      const k = `${f.rule}|${f.selector}|${f.line}|${elText(f) ?? ""}`; // 带上文字指纹：选择器、行号相同的不同元素不会互相顶掉（RC-03）
      if (seenHere.has(k)) continue;
      seenHere.add(k);
      acc.findings.push(i === 0 ? f : { ...f, viewport: vp.width, message: `【${vp.label}下】${f.message}` });
    }
  }

  const webfonts = new Set(page.fontFaces.map((f) => f.family.toLowerCase()));
  for (const el of page.cjkElements) {
    for (const fam of parseFamilyList(page.cascade.computedKeyword(el, "font-family", ""))) {
      const entry = matchFontName(fam);
      if (!entry) continue;
      const usage = config.scenario === "xhs-card" ? "image" : webfonts.has(fam.toLowerCase()) ? "webfont" : "system";
      acc.fontUse.set(`${fam}|${usage}`, { family: fam, tier: entry.tier, usage });
    }
  }
  return true;
}

export interface FinishOptions {
  inputs: string[];
  files: number;
  config: MeasureConfig;
  startedAt: string;
  mode: Mode;
  network: LintResult["run"]["network"];
  render?: LintResult["run"]["render"];
}

export function finishResult(acc: Accum, o: FinishOptions): LintResult {
  // 去重：同一文件、同一规则、同一位置、同一消息只保留一条（页面和它引用的 CSS 可能重复报 F03）；
  // 重复的几条里优先保留带截图的那条（RA-09）
  const byKey = new Map<string, Finding>();
  for (const f of acc.findings) {
    const k = `${f.rule}|${f.file}|${f.line}|${f.selector}|${f.message}`;
    const old = byKey.get(k);
    if (!old || (!old.evidence && f.evidence)) byKey.set(k, f);
  }
  const unique = [...byKey.values()];

  const disabledIds = new Set(Object.keys(o.config.disabled));
  const kept = unique.filter((f) => !disabledIds.has(f.rule));
  const errors = kept.filter((f) => f.severity === "error").length;
  const warns = kept.length - errors;
  const skipped = dedupeSkipped(acc.skipped);

  return {
    schema_version: SCHEMA_VERSION,
    tool: { name: "measure-cjk", version: TOOL_VERSION, ruleset_version: RULESET_VERSION },
    run: {
      started_at: o.startedAt,
      mode: o.mode,
      inputs: o.inputs,
      config_sha256: configSha256(o.config),
      network: o.network,
      skipped_inputs: skipped,
      remote_refs: [...acc.remoteRefs],
      sheet_errors: acc.sheetErrors,
      unsupported_selectors: [...acc.unsupported].slice(0, 100),
      threshold_overrides: thresholdOverrides(o.config),
      ...(o.render ? { render: o.render } : {})
    },
    summary: {
      files: o.files,
      cjk_files: acc.cjkFiles,
      errors,
      warns,
      // 有 error 一律判 fail（A-04：只检查 CSS 时 F03 error 也必须让退出码为 1）
      // 有页面超时没检查完 → incomplete，不能判通过（A-34）；完整档里页面打不开同样是 incomplete
      status: acc.incomplete || skipped.some((s) => s.reason === "timeout") ? "incomplete" : errors > 0 ? "fail" : acc.cjkFiles === 0 ? "skipped" : "pass"
    },
    disabled_rules: Object.entries(o.config.disabled).map(([rule, reason]) => ({ rule: rule as RuleId, reason })),
    fonts: [...acc.fontUse.values()],
    findings: kept
  };
}

export function runLint(opts: LintOptions): LintResult {
  if (opts.render) throw new UsageError("完整档是异步的，请调用 runRender()（命令行用 lint --render）。");
  const urls = opts.inputs.filter((i) => URL_INPUT.test(i));
  if (urls.length) throw new UsageError(`URL 输入只能用完整档检查，请加上 --render：${urls[0]}`);
  const startedAt = new Date().toISOString();
  const cwd = opts.cwd ?? process.cwd();
  const rootReal = realRoot(opts.root ?? cwd);
  const config = opts.config ?? defaultConfig();
  pageBudgetMs(); // 先校验环境变量，非法时直接报用法错误
  const { files, skipped } = collectInputs(rootReal, opts.inputs, cwd);

  const acc = newAccum(skipped);
  for (const real of files) {
    if (extname(real).toLowerCase() === ".css") lintCssFile(acc, rootReal, real);
    else lintPageInto(acc, buildPage(rootReal, real), config);
  }
  return finishResult(acc, { inputs: opts.inputs, files: files.length, config, startedAt, mode: "static", network: "offline" });
}

export function exitCodeOf(result: LintResult): number {
  if (result.summary.status === "incomplete") return 2;
  return result.summary.status === "fail" ? 1 : 0;
}
