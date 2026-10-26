// V-13：「不装 measure skill」的基线。对 bench/prompts 的 30 条提示词，逐条在仓库以外的空临时目录里
// 调用 Agent 生成页面，把产物复制回 bench/runs/<run-id>/<编号>/，再用基础档 lint，汇总零 error 率。
// 用法：node bench/run-baseline.mjs --agent codex|claude-code [--concurrency 3] [--only 001,002] [--timeout-min 12] [--relint-only]
// --relint-only：不重新生成页面，只用当前构建的校验器重新 lint 已有产物并重写 summary.json（用于统一口径）
// --arm control|measure：北极星实验（docs/verification/w2/NORTH_STAR_PLAN.md，用户 2026-10-25 确认）。必须同时加 --isolated。
//   两组都给同样的工具：PATH 里有 measure-cjk（指向本仓库的命令行）；claude 加 --allowedTools "Bash(measure-cjk:*)"，
//   输出 stream-json 以便核对读过哪些文件；codex 用 workspace-write 沙箱。只差「有没有 measure」：
//   - claude 实验组：skills/measure/ 复制进工作目录的 measure-skill/，并用 --append-system-prompt 提示先读 SKILL.md；
//   - codex 实验组：skills/measure/ 复制进临时 $CODEX_HOME/skills/measure/，由 codex 自己发现并触发
//     （按用户核验过的路径：skill 在 $CODEX_HOME/skills；方案原文写的 HOME/.agents/skills 不是 skill 的发现路径）。
//   产物用完整档（lint --render）和基础档各检查一次。
// --isolated：隔离环境基线（W2，D-3）。codex：临时 HOME 和 CODEX_HOME（凭证用符号链接指回原文件，不复制、不读取），
//   读不到用户的 skill、全局 AGENTS.md、memories；临时 config.toml 只带白名单里的顶层配置（模型、推理强度、审批、沙箱、人设等），
//   与用户环境对齐（AUDIT_W2_C20 W2-02）；skills、MCP、插件、memories、projects 等配置块不带。
//   claude：--safe-mode（关闭 CLAUDE.md、用户 skill、插件、hooks、MCP）+ --disable-slash-commands（连内置 skill 一起关掉，
//   实测可用 skill 为「无」）+ --no-session-persistence（不写 ~/.claude/projects）+ --output-format json（记录实际模型）。
import { spawn } from "node:child_process";
import { mkdtempSync, mkdirSync, readdirSync, readFileSync, writeFileSync, copyFileSync, statSync, existsSync, rmSync, symlinkSync, realpathSync, cpSync, chmodSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import { join, dirname, relative, extname } from "node:path";
import { fileURLToPath } from "node:url";
import { runLint, runRender } from "../packages/cli/dist/index.js";

const repo = join(dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);
const opt = (k, d) => {
  const i = args.indexOf(`--${k}`);
  return i >= 0 ? args[i + 1] : d;
};
const agent = opt("agent");
if (!["codex", "claude-code"].includes(agent)) {
  console.error("用法：node bench/run-baseline.mjs --agent codex|claude-code");
  process.exit(2);
}
const concurrency = Number(opt("concurrency", "3"));
const timeoutMs = Number(opt("timeout-min", "12")) * 60_000;
const only = opt("only")?.split(",");
const isolated = args.includes("--isolated");
const arm = opt("arm");
if (arm !== undefined && (!["control", "measure"].includes(arm) || !isolated)) {
  console.error("--arm 只能是 control 或 measure，并且必须同时加 --isolated");
  process.exit(2);
}
const runId = opt("run-id", arm ? `2026-W2-northstar-v3-${agent}-${arm}` : isolated ? `2026-W2-baseline-isolated-v2-${agent}` : `2026-W1-baseline-${agent}`);
const SKILL_SRC = join(repo, "skills", "measure");
const CLAUDE_HINT = "本目录的 measure-skill/ 是中文排版 skill；生成含中文的页面时，先读 measure-skill/SKILL.md 并照做。";
// 两组都能用的 measure-cjk 命令：一个只转发给本仓库命令行的 shim，放在临时目录里，加到 PATH 最前面
let shimDir;
function withShim(e) {
  if (!arm) return e;
  if (!shimDir) {
    shimDir = mkdtempSync(join(tmpdir(), "measure-shim-"));
    writeFileSync(join(shimDir, "measure-cjk"), `#!/bin/sh\nexec "${process.execPath}" "${join(repo, "packages", "cli", "bin", "measure-cjk.js")}" "$@"\n`);
    chmodSync(join(shimDir, "measure-cjk"), 0o755);
  }
  return { ...e, PATH: `${shimDir}:${e.PATH ?? ""}` };
}
const runDir = join(repo, "bench", "runs", runId);
mkdirSync(runDir, { recursive: true });

const SUFFIX = "\n\n输出要求：把结果写成当前目录下的 index.html（需要的话可以另外写 CSS 文件，放在当前目录）。不要启动服务器，不要安装任何依赖。完成后用一两句话说明生成了哪些文件。";

// ---------- 证据：measure skill 没有被加载；记录可能影响基线的全局指令 ----------
const env = [];
const codexHome = process.env.CODEX_HOME || join(homedir(), ".codex");
for (const d of [join(homedir(), ".agents", "skills"), join(codexHome, "skills"), join(homedir(), ".claude", "skills")]) {
  const list = existsSync(d) ? readdirSync(d) : [];
  env.push(`${d}：${list.length} 个条目；包含 measure：${list.includes("measure") ? "是（基线无效）" : "否"}`);
  if (list.includes("measure")) {
    console.error(`发现 ${d}/measure，基线会被污染，停止运行`);
    process.exit(2);
  }
}
for (const f of [join(codexHome, "AGENTS.md"), join(homedir(), ".claude", "CLAUDE.md")]) {
  if (!existsSync(f)) {
    env.push(`${f}：不存在`);
    continue;
  }
  const txt = readFileSync(f, "utf8");
  const hits = ["中英文", "空格", "排版", "「」", "全角", "line-height", "字距"].filter((k) => txt.includes(k));
  env.push(`${f}：存在；包含可能影响排版的关键词：${hits.length ? hits.join("、") : "无"}`);
}
if (isolated) env.unshift(`隔离模式：${agent === "codex" ? `临时 HOME 与 CODEX_HOME（凭证为指向原文件的符号链接；顶层配置按白名单对齐）${arm === "measure" ? "；measure 放在临时 $CODEX_HOME/skills/measure/" : ""}，下方列出的用户目录在运行中不可见` : `claude --safe-mode --disable-slash-commands --no-session-persistence --output-format ${arm ? "stream-json --verbose" : "json"}${arm ? ` --allowedTools "Bash(measure-cjk:*)"` : ""}${arm === "measure" ? "；measure 复制进工作目录的 measure-skill/，并用 --append-system-prompt 提示先读" : ""}`}`);
if (!args.includes("--relint-only")) writeFileSync(join(runDir, "environment.log"), env.join("\n") + "\n");
console.log(env.join("\n"));

// ---------- 逐条生成 ----------
const prompts = readdirSync(join(repo, "bench", "prompts"))
  .filter((f) => f.endsWith(".md"))
  .map((f) => f.replace(/\.md$/, ""))
  .filter((id) => !only || only.includes(id))
  .sort();

function promptText(id) {
  return readFileSync(join(repo, "bench", "prompts", `${id}.md`), "utf8").replace(/^---[\s\S]*?---\s*/, "").trim();
}

// 隔离环境：只带用户 codex 配置里白名单内的顶层配置行（第一个 [section] 之前）
const CODEX_KEY_WHITELIST = ["model", "model_reasoning_effort", "plan_mode_reasoning_effort", "approval_policy", "approvals_reviewer", "sandbox_mode", "personality", "service_tier"];
function userCodexTopLevel() {
  const p = join(process.env.CODEX_HOME || join(homedir(), ".codex"), "config.toml");
  if (!existsSync(p)) return [];
  const lines = readFileSync(p, "utf8").split("\n");
  const end = lines.findIndex((l) => /^\s*\[/.test(l));
  return lines.slice(0, end === -1 ? lines.length : end).filter((l) => CODEX_KEY_WHITELIST.some((k) => new RegExp(`^${k}\\s*=`).test(l)));
}

let isoBase;
function isolatedEnv() {
  if (!isoBase) {
    isoBase = mkdtempSync(join(tmpdir(), `measure-isolated-${agent}-`));
    mkdirSync(join(isoBase, "home"), { recursive: true });
    if (agent === "codex") {
      mkdirSync(join(isoBase, "codex-home"), { recursive: true });
      const realAuth = join(process.env.CODEX_HOME || join(homedir(), ".codex"), "auth.json");
      if (!existsSync(realAuth)) throw new Error("找不到 codex 的登录凭证文件，无法在隔离环境运行");
      symlinkSync(realAuth, join(isoBase, "codex-home", "auth.json"));
      writeFileSync(join(isoBase, "codex-home", "config.toml"), userCodexTopLevel().join("\n") + "\n");
      if (arm === "measure") cpSync(SKILL_SRC, join(isoBase, "codex-home", "skills", "measure"), { recursive: true });
    }
  }
  return agent === "codex" ? { ...process.env, HOME: join(isoBase, "home"), CODEX_HOME: join(isoBase, "codex-home") } : { ...process.env };
}

function commandFor(work, prompt) {
  if (agent === "codex") {
    const base = ["exec", "--skip-git-repo-check", "--ephemeral", "-s", "workspace-write", "-C", work];

    return { cmd: "codex", argv: [...base, prompt], env: withShim(isolated ? isolatedEnv() : process.env) };
  }
  const argv = ["-p", prompt, "--permission-mode", "acceptEdits"];
  if (arm) {
    argv.push("--allowedTools", "Bash(measure-cjk:*)", "--safe-mode", "--disable-slash-commands", "--no-session-persistence", "--output-format", "stream-json", "--verbose");
    if (arm === "measure") argv.push("--append-system-prompt", CLAUDE_HINT);
  } else if (isolated) argv.push("--safe-mode", "--disable-slash-commands", "--no-session-persistence", "--output-format", "json");
  return { cmd: "claude", argv, env: withShim(process.env) };
}

function copyOutputs(from, to, depth = 0) {
  let n = 0;
  for (const ent of readdirSync(from, { withFileTypes: true })) {
    if (ent.name === "node_modules" || ent.name.startsWith(".") || (depth === 0 && ent.name === "measure-skill")) continue;
    const p = join(from, ent.name);
    if (ent.isDirectory() && depth < 2) {
      n += copyOutputs(p, join(to, ent.name), depth + 1);
    } else if (ent.isFile() && [".html", ".htm", ".css"].includes(extname(ent.name).toLowerCase()) && statSync(p).size <= 5 * 1024 * 1024) {
      mkdirSync(to, { recursive: true });
      copyFileSync(p, join(to, ent.name));
      n++;
    }
  }
  return n;
}

function runOne(id) {
  return new Promise((resolveP) => {
    // R2-08：macOS 上 /var 是指向 /private/var 的符号链接；先转成真实路径再传给 -C，避免沙箱按字面比较时把写入判成越界
    const work = realpathSync(mkdtempSync(join(tmpdir(), `measure-baseline-${agent}-${id}-`)));
    const out = join(runDir, id);
    rmSync(out, { recursive: true, force: true });
    mkdirSync(out, { recursive: true });
    if (arm === "measure" && agent === "claude-code") cpSync(SKILL_SRC, join(work, "measure-skill"), { recursive: true });
    const { cmd, argv, env } = commandFor(work, promptText(id) + SUFFIX);
    const started = Date.now();
    const child = spawn(cmd, argv, { cwd: work, stdio: ["ignore", "pipe", "pipe"], env });
    const chunks = [];
    child.stdout.on("data", (d) => chunks.push(d));
    child.stderr.on("data", (d) => chunks.push(d));
    const timer = setTimeout(() => child.kill("SIGTERM"), timeoutMs);
    child.on("close", (code, signal) => {
      clearTimeout(timer);
      const seconds = Math.round((Date.now() - started) / 1000);
      // A-17：把提示词替换成占位符再记录命令（claude 的提示词不在最后一个参数，原写法会漏掉 acceptEdits）
      const shown = argv.map((a) => (a === promptText(id) + SUFFIX ? "<提示词>" : a)).join(" ");
      writeFileSync(join(out, "agent.log"), `命令：${cmd} ${shown}\n工作目录：${work}\n退出码：${code} 信号：${signal ?? "无"} 用时：${seconds}s\n\n${Buffer.concat(chunks).toString("utf8")}`);
      const copied = copyOutputs(work, join(out, "output"));
      rmSync(work, { recursive: true, force: true });
      resolveP({ id, code, signal, seconds, copied });
    });
    child.on("error", (e) => {
      clearTimeout(timer);
      writeFileSync(join(out, "agent.log"), `启动失败：${e.message}\n`);
      resolveP({ id, code: null, signal: null, seconds: 0, copied: 0, spawnError: e.message });
    });
  });
}

const relintOnly = args.includes("--relint-only");
const results = [];
let next = 0;
async function worker() {
  while (next < prompts.length) {
    const id = prompts[next++];
    const r = await runOne(id);
    results.push(r);
    console.log(`[${results.length}/${prompts.length}] ${id}：退出码 ${r.code}，${r.seconds}s，复制 ${r.copied} 个文件${r.spawnError ? `，启动失败：${r.spawnError}` : ""}`);
  }
}
if (relintOnly) {
  for (const id of prompts) {
    const log = existsSync(join(runDir, id, "agent.log")) ? readFileSync(join(runDir, id, "agent.log"), "utf8") : "";
    const code = Number(log.match(/退出码：(\S+)/)?.[1]);
    const seconds = Number(log.match(/用时：(\d+)s/)?.[1] ?? 0);
    results.push({ id, code: Number.isNaN(code) ? null : code, seconds, copied: null });
  }
} else {
  await Promise.all(Array.from({ length: Math.min(concurrency, prompts.length) }, worker));
}

if (isoBase) rmSync(isoBase, { recursive: true, force: true });
if (shimDir) rmSync(shimDir, { recursive: true, force: true });

// ---------- 从各页 agent.log 里提取实际加载的 skill 和模型（A-17） ----------
function observeEnvironment() {
  const models = {};
  const skills = {};
  for (const id of prompts) {
    const p = join(runDir, id, "agent.log");
    if (!existsSync(p)) continue;
    const log = readFileSync(p, "utf8");
    const m = log.match(/^model: (.+)$/m);
    if (m) models[m[1].trim()] = (models[m[1].trim()] ?? 0) + 1;
    // claude --output-format json：从 modelUsage 里取实际使用的模型
    const mu = log.match(/"modelUsage"\s*:\s*\{\s*"([^"]+)"/);
    if (mu) models[mu[1]] = (models[mu[1]] ?? 0) + 1;
    // 任何路径下的 skills/<名字>/SKILL.md 都算（隔离环境下 codex 的系统 skill 在临时目录里）；临时目录前缀归一成 <isolated>
    const seen = new Set((log.match(/[^\s"'`]*\/skills\/[A-Za-z0-9._-]+(?=\/SKILL\.md)/g) ?? []).map((x) => x.replace(/^.*measure-isolated-[^/]+/, "<isolated>").replace(/^.*\/(\.codex|\.agents|\.claude)\//, "/$1/")));
    for (const s of seen) skills[s] = (skills[s] ?? 0) + 1;
  }
  return {
    models: Object.keys(models).length ? models : "输出里没有记录模型（待确认）",
    skills_loaded_runs: Object.keys(skills).length ? skills : agent === "claude-code" ? (isolated ? "claude -p 只输出最终回答，无法逐次统计；隔离模式用了 --safe-mode 和 --disable-slash-commands，实测可用 skill 为「无」" : "claude -p 只输出最终回答，无法从日志统计加载过的 skill（待确认）") : {},
    global_instructions: "见 environment.log"
  };
}

// ---------- lint 并汇总 ----------
const rows = [];
const ruleHits = {};
for (const r of results.sort((a, b) => a.id.localeCompare(b.id))) {
  const outDir = join(runDir, r.id, "output");
  const produced = existsSync(outDir) && readdirSync(outDir, { recursive: true }).some((f) => /\.html?$/i.test(String(f)));
  let lint = null;
  if (produced) {
    lint = runLint({ inputs: ["."], root: outDir, cwd: outDir });
    writeFileSync(join(runDir, r.id, "lint.json"), JSON.stringify(lint, null, 2) + "\n");
    for (const f of lint.findings) {
      if (f.severity !== "error") continue;
      ruleHits[f.rule] = ruleHits[f.rule] ?? new Set();
      ruleHits[f.rule].add(r.id);
    }
  }
  const row = { id: r.id, agent_exit: r.code, seconds: r.seconds, produced, errors: lint?.summary.errors ?? null, warns: lint?.summary.warns ?? null, status: lint?.summary.status ?? "no-output", error_rules: lint ? [...new Set(lint.findings.filter((f) => f.severity === "error").map((f) => f.rule))].sort() : [] };
  if (arm) {
    // 北极星：完整档是主指标（NORTH_STAR_PLAN §5）；截图写进产物目录下的 _evidence/
    if (produced) {
      const rl = await runRender({ inputs: ["."], root: outDir, cwd: outDir, evidenceDir: join(outDir, "_evidence") });
      writeFileSync(join(runDir, r.id, "lint-render.json"), JSON.stringify(rl, null, 2) + "\n");
      row.render_errors = rl.summary.errors;
      row.render_status = rl.summary.status;
      row.render_error_rules = [...new Set(rl.findings.filter((f) => f.severity === "error").map((f) => f.rule))].sort();
    }
    // 每次运行都要检查的事（NORTH_STAR_PLAN §4）
    const log = existsSync(join(runDir, r.id, "agent.log")) ? readFileSync(join(runDir, r.id, "agent.log"), "utf8") : "";
    const outText = produced ? readdirSync(outDir, { recursive: true }).filter((f) => /\.(html?|css)$/i.test(String(f))).map((f) => readFileSync(join(outDir, String(f)), "utf8")).join("\n") : "";
    // claude 读 SKILL.md 有两种方式：Read 工具，或者 Bash 里的只读命令（cat 等，claude 会自动放行）。
    // 两种都算，但返回内容里必须出现 SKILL.md 的正文（frontmatter 的「name: measure」），只提到路径不算
    row.skill_loaded = agent === "codex" ? /skills\/measure\/SKILL\.md/.test(log) : /"(file_path|command)":"[^"]*measure-skill\/SKILL\.md/.test(log) && log.includes("name: measure");
    // 只认 agent 真正发出的命令（AUDIT_NORTHSTAR NA-02）：SKILL.md 正文里本来就有 measure-cjk 的命令示例，在整份日志里搜会误判。
    // codex 的命令行是「/bin/zsh -lc '…'」，claude 的是 Bash 工具调用的 "command" 字段
    // codex 的命令块：单独一行「exec」开头，命令可以跨行、单双引号都有，到「 succeeded in …」或「 exited N in …」那一行结束（AUDIT_NORTHSTAR_r2 R2-01）
    const codexBlocks = () => {
      const out = [];
      const lines = log.split("\n");
      for (let i = 0; i < lines.length; i++) {
        if (lines[i] !== "exec") continue;
        const block = [];
        for (let j = i + 1; j < lines.length && !/^ (succeeded|exited -?\d+) in /.test(lines[j]); j++) block.push(lines[j]);
        out.push(block.join("\n"));
      }
      return out;
    };
    const cmds = agent === "codex" ? codexBlocks() : log.match(/"name":"Bash","input":\{"command":"(?:[^"\\]|\\.)*"/g) ?? [];
    row.used_measure_cli = cmds.some((c) => /measure-cjk(\.js)?"? (lint|card|fonts|rules|init|fix)\b/.test(c));
    row.ran_measure_lint = cmds.some((c) => /measure-cjk(\.js)?"? lint\b/.test(c));
    row.leak_markers = arm === "control" ? ["measure-skill", "skills/measure/SKILL.md"].filter((k) => log.includes(k)).concat(/measure\.css/.test(outText) ? ["measure.css"] : []) : [];
    row.text_autospace_in_output = /text-autospace/.test(outText);
    row.home_path_in_log = log.includes(homedir());
  }
  rows.push(row);
}
const producedRows = rows.filter((r) => r.produced);
const zeroError = producedRows.filter((r) => r.errors === 0).length;
const summary = {
  schema_version: "1.0.0",
  run_id: runId,
  agent,
  generated_at: new Date().toISOString(),
  prompts: prompts.length,
  produced: producedRows.length,
  zero_error_pages: zeroError,
  zero_error_rate_over_produced: producedRows.length ? zeroError / producedRows.length : null,
  // 补充指标：T02（text-autospace）和 T04（line-break: strict）是本项目定的标准，AI 默认几乎不会写；
  // 排除这两条之后的零 error 页面数，更能反映其余排版问题的分布
  zero_error_pages_excluding_T02_T04: producedRows.filter((r) => r.error_rules.every((x) => x === "T02" || x === "T04")).length,
  rule_hit_pages: Object.fromEntries(Object.entries(ruleHits).map(([k, v]) => [k, v.size]).sort((a, b) => b[1] - a[1])),
  mode: "static",
  // A-17：这是「用户环境基线」——没有安装 measure，但其他设计 skill 和全局指令照常生效
  baseline_kind: isolated
    ? (agent === "codex" ? `隔离环境基线（临时 HOME 与 CODEX_HOME：不加载用户 skill、全局 AGENTS.md、memories、MCP、插件；顶层配置按白名单与用户环境对齐：${CODEX_KEY_WHITELIST.join("、")}）` : "隔离环境基线（--safe-mode + --disable-slash-commands：不加载 CLAUDE.md、用户 skill、内置 skill、插件、hooks、MCP；--no-session-persistence）")
    : "用户环境基线（未安装 measure；其他 skill 与全局指令照常加载，见 environment_observed）",
  environment_observed: observeEnvironment(),
  relinted_with: relintOnly ? "当前构建（--relint-only）" : "生成时的构建",
  ...(arm
    ? {
        arm,
        northstar: {
          zero_error_pages_render: producedRows.filter((x) => x.render_errors === 0 && x.render_status !== "incomplete").length,
          render_incomplete_pages: producedRows.filter((x) => x.render_status === "incomplete").length,
          skill_loaded_runs: rows.filter((x) => x.skill_loaded).length,
          used_measure_cli_runs: rows.filter((x) => x.used_measure_cli).length,
          ran_measure_lint_runs: rows.filter((x) => x.ran_measure_lint).length,
          leak_runs: rows.filter((x) => x.leak_markers?.length).map((x) => x.id),
          text_autospace_pages: rows.filter((x) => x.text_autospace_in_output).map((x) => x.id),
          home_path_in_log_runs: rows.filter((x) => x.home_path_in_log).map((x) => x.id)
        }
      }
    : {}),
  rows
};
writeFileSync(join(runDir, "summary.json"), JSON.stringify(summary, null, 2) + "\n");
console.log(`\n${agent}：${prompts.length} 条提示词，产出页面 ${producedRows.length} 个，零 error ${zeroError} 个，零 error 率 ${summary.zero_error_rate_over_produced === null ? "无" : (summary.zero_error_rate_over_produced * 100).toFixed(1) + "%"}`);
console.log(`排除 T02/T04 后零 error 页面：${summary.zero_error_pages_excluding_T02_T04} 个`);
console.log(`各规则命中的页面数：${JSON.stringify(summary.rule_hit_pages)}`);
if (arm) console.log(`北极星（${arm}）：完整档零 error ${summary.northstar.zero_error_pages_render} 页；skill 加载 ${summary.northstar.skill_loaded_runs} 次；用过 measure-cjk ${summary.northstar.used_measure_cli_runs} 次（其中跑过 lint ${summary.northstar.ran_measure_lint_runs} 次）；对照组泄漏 ${summary.northstar.leak_runs.length} 次`);
console.log(`结果目录：${relative(repo, runDir)}`);
