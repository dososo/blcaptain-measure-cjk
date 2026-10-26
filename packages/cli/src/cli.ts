// 命令行入口：lint / fonts / init / rules。退出码 0 通过、1 有 error、2 用法或环境错误（H8）。
// 不提供 --force 或任何绕过开关（H7）。
import { lstatSync, readFileSync, realpathSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { runLint, exitCodeOf } from "./lint.js";
import { runRender } from "./render.js";
import { cardExitCode, runCard, type CardResult } from "./card.js";
import { loadConfig, defaultConfig, lastConfigPath, validateWidths } from "./config.js";
import { atomicWrite, realRoot, safeOutPath } from "./fsafe.js";
import { loadLicenseTable, matchFontName, TIER_LABEL } from "./fonts.js";
import { RULES } from "./rulesMeta.js";
import { TOOL_VERSION, UsageError, type LintResult, type TriBool } from "./types.js";

const here = dirname(fileURLToPath(import.meta.url));

const HELP = `measure-cjk ${TOOL_VERSION} · 分寸 · Measure

用法：
  measure-cjk lint <路径>... [--format text|json] [--out <文件>] [--config <文件>] [--root <目录>]
  measure-cjk lint <路径或 URL>... --render [--widths 360,390,768,1024,1280,1440] [--evidence <目录>] [--allow-remote]
  measure-cjk fonts <字体名> [--format text|json]
  measure-cjk init [--spacing css|text]
  measure-cjk rules [--format text|json]
  measure-cjk card <卡片.html> --out <卡片.png> [--font-dir <目录>] [--evidence <目录>] [--result <结果.json>] [--format text|json]

说明：
  基础档：静态分析 .html / .htm / .css，不需要浏览器。
  完整档（--render）：用 Playwright 驱动浏览器，在多个宽度下实测；每条 error 截图放进 --evidence 目录
  （默认是 --out 所在目录下的 evidence/，没有 --out 时是工作区根目录下的 evidence/）。
  URL 只能用完整档检查，默认只允许 localhost；远程地址必须加 --allow-remote。
  退出码：0 通过或没有中文内容；1 有 error；2 用法或环境错误。`;

interface Parsed {
  cmd: string | undefined;
  positionals: string[];
  flags: Record<string, string | true>;
}

const VALUE_FLAGS = new Set(["format", "out", "config", "root", "spacing", "widths", "evidence", "font-dir", "result"]);
const BOOL_FLAGS = new Set(["render", "help", "version", "allow-remote"]);

function parseArgs(argv: string[]): Parsed {
  const positionals: string[] = [];
  const flags: Record<string, string | true> = {};
  let cmd: string | undefined;
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith("--")) {
      const [k, inline] = a.slice(2).split("=", 2);
      if (VALUE_FLAGS.has(k)) {
        const v = inline ?? argv[++i];
        if (v === undefined) throw new UsageError(`参数 --${k} 需要一个值`);
        flags[k] = v;
      } else if (BOOL_FLAGS.has(k)) flags[k] = true;
      else throw new UsageError(`未知参数：--${k}`);
    } else if (a === "-h") flags.help = true;
    else if (!cmd) cmd = a;
    else positionals.push(a);
  }
  return { cmd, positionals, flags };
}

function fmt(flags: Parsed["flags"]): "text" | "json" {
  const f = flags.format ?? "text";
  if (f !== "text" && f !== "json") throw new UsageError(`--format 只能是 text 或 json`);
  return f;
}

function yesNo(v: TriBool, yes: string, no: string): string {
  return v === "unknown" ? "原文未明确" : v ? yes : no;
}

// 页面原文会进入消息和选择器：打到终端之前去掉控制字符，防止终端转义序列（RA-18）
const term = (s: string | undefined) => (s ?? "").replace(/[\p{Cc}\p{Cf}]/gu, "�");

export function formatLintText(r: LintResult): string {
  const lines: string[] = [];
  for (const f of r.findings) {
    const loc = `${term(f.file)}${f.line ? `:${f.line}` : ""}${f.selector ? `  ${term(f.selector)}` : ""}`;
    lines.push(`${f.severity === "error" ? "✗" : "△"} ${f.rule}  ${loc}${f.viewport ? `  @${f.viewport}px` : ""}\n    ${term(f.message)}\n    修法：${term(f.fix_hint)}${f.evidence ? `\n    截图：${term(f.evidence)}` : ""}`);
  }
  if (r.disabled_rules.length) lines.push(`已关闭的规则：${r.disabled_rules.map((d) => `${d.rule}（${d.reason}）`).join("；")}`);
  if (r.run.skipped_inputs.length) lines.push(`跳过的输入：${r.run.skipped_inputs.map((s) => `${term(s.file)}（${s.reason}）`).join("；")}`);
  if (r.run.render?.problems.length) lines.push(`⚠ 完整档没有检查完的页面：${r.run.render.problems.map((p) => `${term(p.file)}：${term(p.detail)}`).join("；")}`);
  if (r.run.sheet_errors.length) lines.push(`⚠ 有 ${r.run.sheet_errors.length} 份样式解析失败，其中的规则没有被检查：${r.run.sheet_errors.slice(0, 3).join("；")}`);
  if (r.run.unsupported_selectors.length) lines.push(`⚠ 有 ${r.run.unsupported_selectors.length} 个选择器无法解析，对应的样式没有被检查：${r.run.unsupported_selectors.slice(0, 3).join("；")}`);
  if (r.run.remote_refs.length) lines.push(`没有读取的远程引用（已拦截）：${r.run.remote_refs.map(term).join("；")}`);
  if (r.summary.files === 0) lines.push("提示：没有可检查的文件（基础档只检查 .html / .htm / .css）。");
  if (Object.keys(r.run.threshold_overrides).length) lines.push(`⚠ 使用了非默认阈值：${JSON.stringify(r.run.threshold_overrides)}`);
  const status = { pass: "通过", fail: "未通过", skipped: "跳过（没有中文内容）", incomplete: "不完整（有页面超时或打不开，没有检查完，不能当作通过；原因见「跳过的输入」）" }[r.summary.status];
  const how = r.run.render ? `完整档：在 ${r.run.render.widths.join("、")}px 宽度下实测（${r.run.render.browser}），截图在 ${r.run.render.evidence_dir}/。` : "基础档不做完整层叠计算，结果是近似判断。";
  lines.push(`\n${status}：${r.summary.files} 个文件（含中文 ${r.summary.cjk_files} 个），${r.summary.errors} 个 error，${r.summary.warns} 个 warn。${how}`);
  return lines.join("\n");
}

function cmdLint(p: Parsed, cwd: string): number | Promise<number> {
  const rootReal = realRoot(typeof p.flags.root === "string" ? resolve(cwd, p.flags.root) : cwd);
  const render = p.flags.render === true;
  for (const k of ["widths", "evidence", "allow-remote"]) if (!render && p.flags[k] !== undefined) throw new UsageError(`--${k} 只能和 --render 一起用`);
  const widths = typeof p.flags.widths === "string" ? validateWidths(p.flags.widths.split(","), "--widths") : undefined;
  const format = fmt(p.flags);
  const config = loadConfig(rootReal, typeof p.flags.config === "string" ? p.flags.config : undefined, cwd);
  const outPath = typeof p.flags.out === "string" ? safeOutPath(rootReal, p.flags.out, cwd) : undefined;
  if (outPath) {
    if (lastConfigPath && outPath === lastConfigPath) throw new UsageError(`--out 不能指向本次读取的配置文件，已拒绝：${p.flags.out}`);
    for (const input of p.positionals) {
      let real: string | undefined;
      try {
        real = realpathSync(resolve(cwd, input));
      } catch {
        real = undefined;
      }
      if (real === outPath) throw new UsageError(`--out 不能指向输入文件本身，已拒绝：${p.flags.out}`);
    }
  }
  const emit = (result: LintResult): number => {
    const json = JSON.stringify(result, null, 2) + "\n";
    if (outPath) atomicWrite(outPath, json);
    if (format === "json" && !outPath) process.stdout.write(json);
    else process.stdout.write(formatLintText(result) + "\n");
    return exitCodeOf(result);
  };
  if (!render) return emit(runLint({ inputs: p.positionals, root: rootReal, cwd, config }));
  const evidenceDir = typeof p.flags.evidence === "string" ? p.flags.evidence : outPath ? join(dirname(outPath), "evidence") : undefined;
  return runRender({ inputs: p.positionals, root: rootReal, cwd, config, widths, evidenceDir, allowRemote: p.flags["allow-remote"] === true ? true : undefined }).then(emit);
}

function cmdFonts(p: Parsed): number {
  const name = p.positionals.join(" ").trim();
  if (!name) throw new UsageError("请给出要查询的字体名，例如：measure-cjk fonts \"Noto Sans SC\"");
  const table = loadLicenseTable();
  const entry = matchFontName(name, table);
  if (fmt(p.flags) === "json") {
    process.stdout.write(JSON.stringify(entry ? { query: name, found: true, disclaimer: table.disclaimer, ...entry } : { query: name, found: false, code: "F-UNKNOWN", disclaimer: table.disclaimer }, null, 2) + "\n");
    return 0;
  }
  if (!entry) {
    process.stdout.write(`F-UNKNOWN：授权表里没有「${name}」。请先查官方授权原文，再决定能不能自托管或出图。\n${table.disclaimer}\n`);
    return 0;
  }
  const lines = [
    `${name} → ${TIER_LABEL[entry.tier]}（${entry.tier}）· 命中条目 ${entry.id}`,
    `  授权：${entry.license}`,
    `  自托管 webfont：${yesNo(entry.webfont_self_host, "可以", "不能自托管 webfont")}`,
    `  商用图片：${yesNo(entry.commercial_image, "可以", "不可以")}`,
    `  子集化 / 修改：${yesNo(entry.modify_subset, "可以", "不可以")}${entry.reserved_font_names.length ? `（保留字体名：${entry.reserved_font_names.join("、")}，子集化后要改名）` : ""}`,
    `  需要署名：${yesNo(entry.attribution_required, "需要", "不需要")}`,
    `  授权可撤销：${yesNo(entry.revocable, "是", "否")}`,
    `  原文：${entry.source_url}`,
    `  核验日期：${entry.verified_at}`
  ];
  if (entry.notes) lines.push(`  说明：${entry.notes}`);
  lines.push(`  ${table.disclaimer}`);
  process.stdout.write(lines.join("\n") + "\n");
  return 0;
}

function cmdInit(p: Parsed, cwd: string): number {
  const spacing = (p.flags.spacing ?? "css") as string;
  if (spacing !== "css" && spacing !== "text") throw new UsageError("--spacing 只能是 css 或 text");
  const cfgPath = join(cwd, "measure.config.json");
  const cssPath = join(cwd, "measure.css");
  // A-09：先用 lstat 检查（不跟随链接），符号链接一律拒绝；写入用 wx 独占创建
  const state = (p: string): "none" | "file" | "link" => {
    try {
      return lstatSync(p).isSymbolicLink() ? "link" : "file";
    } catch {
      return "none";
    }
  };
  for (const p of [cfgPath, cssPath]) if (state(p) === "link") throw new UsageError(`${p} 是符号链接，已拒绝写入`);
  if (state(cfgPath) === "file") process.stdout.write("measure.config.json 已存在，没有覆盖。\n");
  else {
    const cfg = defaultConfig();
    writeFileSync(cfgPath, JSON.stringify({ schema_version: cfg.schema_version, locale: cfg.locale, quotes: cfg.quotes, spacing, scenario: cfg.scenario, disabled: {} }, null, 2) + "\n", { flag: "wx" });
    process.stdout.write("已生成 measure.config.json\n");
  }
  if (state(cssPath) === "file") process.stdout.write("measure.css 已存在，没有覆盖。\n");
  else {
    let css = readFileSync(join(here, "..", "assets", "measure.css"), "utf8");
    if (spacing === "text") css = stripAutospace(css);
    writeFileSync(cssPath, css, { flag: "wx" });
    process.stdout.write("已复制 measure.css\n");
  }
  return 0;
}

// spacing: text 模式只删掉 text-autospace 那一段（注释 + @supports 块），保留 @layer measure 的闭合花括号（C20）；
// LF 和 CRLF 换行都支持（W2-03）。找不到这一段时报错，不静默返回原文
export function stripAutospace(css: string): string {
  const out = css.replace(/\r?\n[ \t]*\/\* 实现里的初始值是 no-autospace[^\r\n]*\r?\n[ \t]*@supports \(text-autospace: normal\) \{\r?\n[^\r\n]*\r?\n[ \t]*\}(\r?\n)/, "$1");
  if (out === css) throw new UsageError("measure.css 里找不到 text-autospace 那一段，无法生成 spacing: text 版本");
  return out;
}

export function formatCardText(r: CardResult): string {
  const term = (s: string | undefined) => (s ?? "").replace(/[\p{Cc}\p{Cf}]/gu, "�");
  const head = { exported: `已导出：${r.output}（${r.size.width}×${r.size.height}）`, rejected: "没有导出：卡片有问题，见下面的原因", incomplete: "没有导出：卡片没有检查完，不能当作通过" }[r.status];
  const lines = [head];
  const where = (f: CardResult["fonts"][number]) => ({ font_dir: `font_dir：${term(f.file)}`, system: "系统字体", page: "页面自带", css: "样式里点名" })[f.source];
  for (const f of r.fonts) lines.push(`${f.allowed ? "✓" : "✗"} ${term(f.family)}（${where(f)}${f.used ? `，单个元素里最多用了 ${f.glyph_count} 个字形` : "，没有用它渲染文字"}）\n    ${term(f.reason)}`);
  for (const a of r.attribution) lines.push(`署名提示：${term(a.note)}`);
  if (r.blocked.length) lines.push(`已拦截：${r.blocked.map(term).join("；")}`);
  if (r.skipped_fonts.length) lines.push(`跳过的字体文件：${r.skipped_fonts.map((s) => `${term(s.file)}（${s.reason}）`).join("；")}`);
  for (const p of r.problems) lines.push(`⚠ ${term(p)}`);
  if (r.lint.findings.some((f) => f.evidence)) lines.push(`卡片 lint 的截图在：${term(r.lint.run.render?.evidence_dir)}/`);
  if (r.lint.findings.length) lines.push("\n卡片的 lint 结果：\n" + formatLintText(r.lint));
  return lines.join("\n");
}

function cmdCard(p: Parsed, cwd: string): Promise<number> | number {
  const rootReal = realRoot(typeof p.flags.root === "string" ? resolve(cwd, p.flags.root) : cwd);
  if (p.positionals.length !== 1) throw new UsageError("用法：measure-cjk card <卡片.html> --out <卡片.png> [--font-dir <目录>] [--evidence <目录>]");
  if (typeof p.flags.out !== "string") throw new UsageError("card 需要 --out <卡片.png>");
  const format = fmt(p.flags);
  const config = loadConfig(rootReal, typeof p.flags.config === "string" ? p.flags.config : undefined, cwd);
  const resultPath = typeof p.flags.result === "string" ? safeOutPath(rootReal, p.flags.result, cwd) : undefined;
  const configDir = lastConfigPath ? dirname(lastConfigPath) : undefined;
  const evidenceDir = typeof p.flags.evidence === "string" ? p.flags.evidence : undefined;
  return runCard({ input: p.positionals[0], out: p.flags.out, fontDir: typeof p.flags["font-dir"] === "string" ? p.flags["font-dir"] : undefined, root: rootReal, cwd, config, configDir, evidenceDir }).then((r) => {
    const json = JSON.stringify(r, null, 2) + "\n";
    if (resultPath) atomicWrite(resultPath, json);
    process.stdout.write(format === "json" ? json : formatCardText(r) + "\n");
    return cardExitCode(r);
  });
}

function cmdRules(p: Parsed): number {
  if (fmt(p.flags) === "json") {
    process.stdout.write(JSON.stringify(RULES, null, 2) + "\n");
    return 0;
  }
  const lines = RULES.map((r) => `${!r.implemented ? "○" : r.modes.includes("static") ? "●" : "◐"} ${r.id.padEnd(4)} ${r.severity.padEnd(5)} ${r.phase}  ${r.title}`);
  lines.push("\n● = 已实现（基础档和完整档都检查）　◐ = 已实现（只有完整档 --render 检查）　○ = 尚未实现。\n基础档只做近似层叠计算：@media 在桌面 1280px 和窄屏 390px 下分别求值，@supports 视为生效，展开 var()，不计算 calc()。\n完整档在浏览器里按多个宽度实测，T02、T04–T07、T11 以实测结果为准。");
  process.stdout.write(lines.join("\n") + "\n");
  return 0;
}

function handleError(e: unknown): number {
  if (e instanceof UsageError) {
    process.stderr.write(`错误：${e.message}\n`);
    return 2;
  }
  // 默认不打印堆栈（A-26）；需要排查时设置 MEASURE_DEBUG=1
  process.stderr.write(`内部错误：${(e as Error).message ?? e}\n`);
  if (process.env.MEASURE_DEBUG === "1") process.stderr.write(`${(e as Error).stack ?? ""}\n`);
  return 2;
}

// 返回退出码；完整档（lint --render）是异步的，返回 Promise
export function main(argv: string[], cwd = process.cwd()): number | Promise<number> {
  try {
    const p = parseArgs(argv);
    if (p.flags.version) {
      process.stdout.write(`${TOOL_VERSION}\n`);
      return 0;
    }
    if (p.flags.help || !p.cmd) {
      process.stdout.write(HELP + "\n");
      return p.cmd || p.flags.help ? 0 : 2;
    }
    switch (p.cmd) {
      case "lint": {
        const r = cmdLint(p, cwd);
        return typeof r === "number" ? r : r.catch(handleError);
      }
      case "fonts":
        return cmdFonts(p);
      case "init":
        return cmdInit(p, cwd);
      case "card": {
        const r = cmdCard(p, cwd);
        return typeof r === "number" ? r : r.catch(handleError);
      }
      case "rules":
        return cmdRules(p);
      default:
        throw new UsageError(`未知命令：${p.cmd}\n\n${HELP}`);
    }
  } catch (e) {
    return handleError(e);
  }
}
