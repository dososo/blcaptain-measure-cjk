// W2 发布准备（npm 包、6 个主题、插件清单、安装脚本）的验证：逐条运行 RV-01–RV-09，真实输出写进 docs/verification/w2/release/evidence/，
// 汇总成 docs/verification/w2/release/results.json（原子写入）。用法：node scripts/verify-release.mjs
// 打包和安装都在临时目录里做：全局安装用临时 --prefix，npx 用临时 npm 缓存，不碰用户自己的全局目录和缓存。
// 从 tarball 安装时要访问 npm registry 下载依赖（只读）；本脚本不发布、不推送任何东西。
// 结论规则同 verify-w2-card.mjs：工作树不干净、报告缺章节、有影响结论但用户还没拍板的事项，都判「未达标」；
// 只影响「能不能对外发布」、不影响这一轮交付的待拍板事项（blocks_publish），结论最多是「有条件达标」。
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, renameSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { isResolved, pendingBlockers } from "./verdict.mjs";
import { findLeaks, scrubText } from "./scrub-local-paths.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const REL = "docs/verification/w2/release";
const outDir = join(root, REL);
const evDir = join(outDir, "evidence");
mkdirSync(evDir, { recursive: true });
const work = mkdtempSync(join(tmpdir(), "measure-verify-release-"));
const q = (s) => `'${s.replaceAll("'", "'\\''")}'`;

function sh(cmd, cwd = root, env = {}) {
  const r = spawnSync("/bin/sh", ["-c", cmd], { cwd, encoding: "utf8", maxBuffer: 64 * 1024 * 1024, env: { ...process.env, ...env } });
  return { code: r.status, stdout: r.stdout ?? "", out: (r.stdout ?? "") + (r.stderr ? `\n[stderr]\n${r.stderr}` : "") };
}
const assertions = [];
// steps：[命令, 工作目录?, 环境变量?]；日志里的临时目录统一写成 <tmp>
function record(id, log, desc, steps, judge) {
  const runs = steps.map(([cmd, cwd, env]) => ({ cmd, ...sh(cmd, cwd, env) }));
  const { status, notes } = judge(runs);
  const text = runs.map((r) => `$ ${r.cmd}\n# 退出码：${r.code}\n${r.out}`).join("\n\n") + `\n\n# 判定：${status}${notes ? `（${notes}）` : ""}\n# 时间：${new Date().toISOString()}\n`;
  writeFileSync(join(evDir, `${log}.log`), scrubText(text.replaceAll(work, "<tmp>")));
  assertions.push({ id, desc, command: scrubText(steps.map(([c]) => c.replaceAll(work, "<tmp>")).join(" && ")), status, evidence: `evidence/${log}.log`, notes: scrubText(notes ?? "") });
  console.log(`${status.padEnd(13)} ${id} ${desc}${notes ? ` — ${notes}` : ""}`);
}
const ok = (b, notes) => ({ status: b ? "PASS" : "FAIL", notes });
const testPass = (r) => ok(r.code === 0 && /ℹ fail 0/.test(r.out), (r.out.match(/ℹ pass \d+|ℹ fail \d+/g) ?? []).join("，"));
const json = (s) => {
  try {
    return JSON.parse(s);
  } catch {
    return null;
  }
};

const porcelain = sh("git status --porcelain").out.split("\n").filter((l) => l.trim() && !l.includes(`${REL}/`));
const dirty = porcelain.length > 0;
writeFileSync(join(evDir, "git-status.log"), scrubText(porcelain.join("\n")) || "（工作树干净）");

// 用户的项目：一个中文页面；Playwright 只装在这里（RA-01 的场景）
const proj = join(work, "proj");
mkdirSync(join(proj, "node_modules"), { recursive: true });
writeFileSync(join(proj, "package.json"), JSON.stringify({ name: "proj", private: true }));
writeFileSync(join(proj, "page.html"), '<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><title>t</title><style>:where(:lang(zh)){line-break:strict;text-autospace:normal}body{font-family:"Noto Sans SC",sans-serif;font-size:17px}p{line-height:1.8;max-width:36em}</style></head><body><p>中文页面的排版检查，看浏览器实测能不能跑起来。</p></body></html>');
const linkPlaywright = `ln -s ${q(join(root, "node_modules", "playwright-core"))} ${q(join(proj, "node_modules", "playwright-core"))}`;

// RV-01：打包（prepack 会重新构建）
const shrink = JSON.parse(readFileSync(join(root, "packages/cli/npm-shrinkwrap.json"), "utf8"));
let tarball = "";
let integrity = "";
record("RV-01", "npm-pack", "npm pack：包里有 bin、dist、assets、data、README、LICENSE、LICENSE-docs、NOTICE、npm-shrinkwrap.json，没有源码和测试；记下 integrity；npm audit 运行时依赖没有漏洞", [[`npm pack --json --pack-destination ${q(work)}`, join(root, "packages/cli")], ["npm audit --omit=dev", join(root, "packages/cli")]], ([r, audit]) => {
  const j = json(r.stdout.slice(r.stdout.indexOf("[")));
  if (r.code !== 0 || !j) return ok(false, "打包失败");
  const files = j[0].files.map((f) => f.path);
  tarball = join(work, j[0].filename);
  integrity = j[0].integrity;
  const need = ["bin/measure-cjk.js", "dist/cli.js", "assets/measure.css", "data/licenses.json", "README.md", "LICENSE", "LICENSE-docs", "NOTICE", "npm-shrinkwrap.json", "package.json"];
  const missing = need.filter((f) => !files.includes(f));
  const extra = files.filter((f) => /^(src|test)\/|\.ts$|tsconfig/.test(f) && !f.endsWith(".d.ts"));
  return ok(missing.length === 0 && extra.length === 0 && audit.code === 0, `npm audit 退出码 ${audit.code}；${j[0].filename}，${files.length} 个文件，${j[0].size} 字节，integrity ${integrity}${missing.length ? `；缺 ${missing.join("、")}` : ""}${extra.length ? `；多出 ${extra.join("、")}` : ""}`);
});

// RV-02：全局安装（临时 prefix），从项目目录运行；Playwright 只在项目里（RA-01）
const g = join(work, "global");
const bin = join(g, "bin", "measure-cjk");
const depsCheck = `node -e ${q(`const s=require(${JSON.stringify(join(root, "packages/cli/npm-shrinkwrap.json"))});const base=${JSON.stringify(join(g, "lib/node_modules/measure-cjk"))};const bad=[];for(const [k,v] of Object.entries(s.packages)){if(!k)continue;let p;try{p=require(base+"/"+k+"/package.json")}catch{p=null}if(!p||p.version!==v.version)bad.push(k+" 期望 "+v.version+" 实际 "+(p&&p.version))}console.log(bad.length?"不一致：\\n"+bad.join("\\n"):"依赖版本和 npm-shrinkwrap.json 一致："+(Object.keys(s.packages).length-1)+" 个")`)}`;
record("RV-02", "tarball-install", "从 tarball 全局安装（临时 prefix）：--version 是 0.1.0；依赖版本和 shrinkwrap 一致；项目里没有 Playwright 时 --render 退出码 2 并提示怎么装；只在项目里装了 Playwright 时 --render 能用；Playwright 只在全局目录里时也能用（RA-01）", [
  [`npm install -g --prefix ${q(g)} ${q(tarball)} --no-audit --no-fund`],
  [`${q(bin)} --version`],
  [depsCheck],
  [`${q(bin)} lint page.html --format json`, proj],
  [`${q(bin)} lint page.html --render`, proj],
  [linkPlaywright],
  [`${q(bin)} lint page.html --render --format json --evidence ev`, proj],
  // 提示里的另一种装法：Playwright 和 measure-cjk 装在同一个全局目录（用软链代替 npm install -g playwright-core，免得下载）
  [`rm ${q(join(proj, "node_modules", "playwright-core"))} && ln -s ${q(join(root, "node_modules", "playwright-core"))} ${q(join(g, "lib", "node_modules", "playwright-core"))}`],
  [`${q(bin)} lint page.html --render --format json --evidence ev`, proj]
], ([inst, ver, deps, basic, noPw, , render, , renderGlobal]) => {
  const b = json(basic.stdout);
  const rj = json(render.stdout);
  const checks = [
    [inst.code === 0, "安装"],
    [ver.stdout.trim() === shrink.version, "版本"],
    [/一致：/.test(deps.stdout), "依赖锁定"],
    [b?.run?.mode === "static", "基础档"],
    [noPw.code === 2 && /npm install -g playwright-core/.test(noPw.out), "缺 Playwright 时退出码 2"],
    [rj?.run?.mode === "render", "完整档（Playwright 在项目里）"],
    [json(renderGlobal.stdout)?.run?.mode === "render", "完整档（Playwright 在全局目录）"]
  ];
  const failed = checks.filter(([pass]) => !pass).map(([, name]) => name);
  return ok(failed.length === 0, failed.length ? `失败：${failed.join("、")}` : `7 项都通过；完整档 errors=${rj.summary.errors}`);
});
rmSync(join(proj, "node_modules", "playwright-core"), { force: true });
rmSync(join(proj, "ev"), { recursive: true, force: true });

// RV-03：npx 从 tarball 运行（临时 npm 缓存），Playwright 只在项目里
const npxEnv = { npm_config_cache: join(work, "npm-cache"), npm_config_update_notifier: "false" };
record("RV-03", "npx-run", "npx --package=<tarball> 运行：--version 是 0.1.0；项目里装了 Playwright 时 --render 能用（RA-01 的 npx 场景）", [
  [`npx --yes --package=${q(tarball)} -- measure-cjk --version`, proj, npxEnv],
  [linkPlaywright],
  [`npx --yes --package=${q(tarball)} -- measure-cjk lint page.html --render --format json --evidence ev`, proj, npxEnv]
], ([ver, , render]) => {
  const rj = json(render.stdout);
  return ok(ver.stdout.trim().endsWith(shrink.version) && rj?.run?.mode === "render", `版本 ${ver.stdout.trim()}，模式 ${rj?.run?.mode}`);
});

// RV-04：6 个主题示例页，完整档 0 error（warn 写进日志）
record("RV-04", "themes-lint", "6 个主题示例页：完整档 lint 0 error（结果 JSON 存为 evidence/themes-lint.json）", [[`node packages/cli/bin/measure-cjk.js lint site/themes --render --format json --out ${q(join(evDir, "themes-lint.json"))}`]], () => {
  const raw = readFileSync(join(evDir, "themes-lint.json"), "utf8");
  writeFileSync(join(evDir, "themes-lint.json"), scrubText(raw));
  const j = json(raw);
  const warns = (j?.findings ?? []).filter((f) => f.severity === "warn").map((f) => `${f.rule} ${f.file}`);
  return ok(j?.summary?.files === 6 && j.summary.errors === 0, `${j?.summary?.files} 个文件，errors ${j?.summary?.errors}，warns ${j?.summary?.warns}（${warns.join("；")}）`);
});

// RV-05：发布回归测试（整改前锁定）、展示页
record("RV-05", "release-tests", "AUDIT_RELEASE 回归测试（RA-01–RA-03，整改前锁定；SHA-256 和锁定时一致）；展示页没有 undefined", [["shasum -a 256 -c docs/verification/w2/release/release-tests.sha256"], ["node --test --test-reporter=spec test/release.test.js"], ["grep -c undefined site/index.html ; true"]], ([lock, t, grep]) => {
  const pass = testPass(t);
  return ok(lock.code === 0 && pass.status === "PASS" && grep.stdout.trim() === "0", `锁定 ${lock.code === 0 ? "未改" : "被改过"}；${pass.notes}；undefined ${grep.stdout.trim()} 处`);
});

// RV-06：skill、主题、版本号、插件清单
record("RV-06", "validate", "validate-skill（含主题截图、字号阶梯、6 处版本号一致）和 claude plugin validate --strict", [["node scripts/validate-skill.mjs"], ["claude plugin validate . --strict"]], ([v, c]) => ok(v.code === 0 && c.code === 0, `${(v.out.match(/\d+ 项通过，\d+ 项失败/) ?? [""])[0]}；claude plugin validate 退出码 ${c.code}`));

// RV-07：安装脚本（RA-09），每种情况一个临时 HOME
const homes = ["case 1 home", "h2", "h3", "h4"].map((h) => join(work, h));
for (const h of homes) mkdirSync(h, { recursive: true });
mkdirSync(join(homes[1], ".claude/skills"), { recursive: true });
mkdirSync(join(homes[1], "other/measure"), { recursive: true });
symlinkSync(join(homes[1], "other/measure"), join(homes[1], ".claude/skills/measure"));
mkdirSync(join(homes[2], ".claude/skills/measure"), { recursive: true });
const inst = (h, args = "") => [`sh scripts/install_skill_links.sh ${args}`, root, { HOME: h }];
record("RV-07", "install-script", "install_skill_links.sh：路径带空格能装、重复运行不变；软链指向别处时不改任何目录、加 --replace 才替换；同名普通目录报错且另一个目录也没动；未知参数退出码 2", [
  inst(homes[0]),
  inst(homes[0]),
  inst(homes[1]),
  [`test ! -e ${q(join(homes[1], ".agents/skills/measure"))}`],
  inst(homes[1], "--replace"),
  [`readlink ${q(join(homes[1], ".claude/skills/measure"))}`],
  inst(homes[2]),
  [`test ! -e ${q(join(homes[2], ".agents/skills/measure"))}`],
  inst(homes[3], "--force")
], ([a, b, c, cUntouched, d, dLink, e, eUntouched, f]) =>
  ok(a.code === 0 && b.code === 0 && c.code === 1 && cUntouched.code === 0 && d.code === 0 && dLink.stdout.trim() === join(root, "skills/measure") && e.code === 1 && eUntouched.code === 0 && f.code === 2, `退出码 ${[a, b, c, d, e, f].map((r) => r.code).join("、")}`)
);

// RV-08：Codex 插件（临时 CODEX_HOME），从本地仓库装
const codexHome = join(work, "codex-home");
mkdirSync(codexHome);
const codexEnv = { CODEX_HOME: codexHome };
const hasCodex = sh("command -v codex").code === 0;
if (!hasCodex) {
  writeFileSync(join(evDir, "codex-plugin-rerun.log"), "本机没有 codex 命令。\n# 判定：BLOCKED_ENV\n");
  assertions.push({ id: "RV-08", desc: "Codex 插件从本地仓库安装", command: "", status: "BLOCKED_ENV", evidence: "evidence/codex-plugin-rerun.log", notes: "本机没有 codex" });
  console.log("BLOCKED_ENV   RV-08 Codex 插件");
} else {
  record("RV-08", "codex-plugin-rerun", "Codex 插件：临时 CODEX_HOME 里 marketplace add 本仓库、plugin add measure@blcaptain-measure-cjk，插件目录里有 skills/measure/SKILL.md", [
    ["codex --version", root, codexEnv],
    [`codex plugin marketplace add ${q(root)}`, root, codexEnv],
    ["codex plugin add measure@blcaptain-measure-cjk", root, codexEnv],
    [`find ${q(codexHome)} -path '*skills/measure/SKILL.md' | head -3`]
  ], ([, add, plug, find]) => ok(add.code === 0 && plug.code === 0 && find.stdout.trim() !== "", find.stdout.trim().split("\n")[0] ? "找到 SKILL.md" : "没找到 SKILL.md"));
}

// RV-10：Claude Code 插件（临时 CLAUDE_CONFIG_DIR），市场名按 D-5 改成 blcaptain-measure-cjk
const claudeEnv = { CLAUDE_CONFIG_DIR: join(work, "claude-config") };
record("RV-10", "claude-plugin", "Claude Code 插件：临时 CLAUDE_CONFIG_DIR 里 marketplace add 本仓库、plugin install measure@blcaptain-measure-cjk，列表里是 0.1.0 且已启用（D-5）", [
  [`claude plugin marketplace add ${q(root)}`, root, claudeEnv],
  ["claude plugin install measure@blcaptain-measure-cjk", root, claudeEnv],
  ["claude plugin list", root, claudeEnv]
], ([add, inst, list]) => ok(add.code === 0 && inst.code === 0 && /measure@blcaptain-measure-cjk[\s\S]*?Version: 0\.1\.0[\s\S]*?enabled/.test(list.out), `marketplace add ${add.code}，install ${inst.code}`));

// RV-11：公开前的本机信息检查：已跟踪的文本文件里没有本机家目录、用户名、临时目录（用户 2026-10-26 要求去除本机绝对路径）
{
  const leaks = findLeaks();
  const text = `$ node scripts/scrub-local-paths.mjs（检查已跟踪的文本文件）\n命中 ${leaks.length} 个文件\n${leaks.map((l) => `- ${l.file}`).join("\n")}\n\n# 判定：${leaks.length ? "FAIL" : "PASS"}\n# 时间：${new Date().toISOString()}\n`;
  writeFileSync(join(evDir, "local-paths.log"), text);
  assertions.push({ id: "RV-11", desc: "已跟踪的文本文件里没有本机家目录、用户名、临时目录", command: "node scripts/scrub-local-paths.mjs", status: leaks.length ? "FAIL" : "PASS", evidence: "evidence/local-paths.log", notes: `命中 ${leaks.length} 个文件` });
  console.log(`${(leaks.length ? "FAIL" : "PASS").padEnd(13)} RV-11 本机路径检查 — 命中 ${leaks.length} 个文件`);
}

// RV-09：回归门
record("RV-09", "regression", "回归门：全量测试失败为 0（并发 4，日志记 uptime）", [["uptime"], ["npm test"], ["uptime"]], ([, r]) => {
  const total = Number(r.out.match(/ℹ tests (\d+)/)?.[1] ?? 0);
  const fail = Number(r.out.match(/ℹ fail (\d+)/)?.[1] ?? -1);
  return ok(total > 0 && fail === 0, `测试 ${total} 项，失败 ${fail} 项`);
});
rmSync(work, { recursive: true, force: true });

const REPORT_SECTIONS = ["结论", "断言逐条", "依赖与 license", "已知局限", "需要审计方裁定", "下一轮建议"];
const report = existsSync(join(outDir, "VERIFICATION_REPORT.md")) ? readFileSync(join(outDir, "VERIFICATION_REPORT.md"), "utf8") : "";
const missingSections = REPORT_SECTIONS.filter((h) => !new RegExp(`^##\\s.*${h}`, "m").test(report));
const task = assertions.filter((a) => a.id !== "RV-09");
const taskPass = task.every((a) => ["PASS", "BLOCKED_ENV"].includes(a.status));
const blocked = task.some((a) => a.status === "BLOCKED_ENV");
const regression = assertions.find((a) => a.id === "RV-09").status;
const blockers = [];
if (dirty) blockers.push("工作树不干净（见 evidence/git-status.log）");
if (!report) blockers.push("缺少 VERIFICATION_REPORT.md");
else if (missingSections.length) blockers.push(`报告缺少章节：${missingSections.join("、")}`);
const decisions = JSON.parse(readFileSync(join(outDir, "open_decisions.json"), "utf8")).items;
for (const d of pendingBlockers(decisions)) blockers.push(`待用户拍板：${d.id} ${d.question}`);
const publishPending = decisions.filter((d) => d.blocks_publish && !isResolved(d)).map((d) => `发布前待用户拍板：${d.id} ${d.question}`);
const conditions = [...(blocked ? ["有 BLOCKED_ENV 项，需要在有对应环境的机器上复验"] : []), ...publishPending];
const verdict = taskPass && regression === "PASS" && blockers.length === 0 ? (conditions.length ? "有条件达标" : "达标") : "未达标";

const results = {
  schema_version: "1.0.0",
  project: "measure-cjk",
  milestone: "W2 发布准备（npm 包、6 个主题、插件清单）",
  generated_at: new Date().toISOString(),
  git_head: sh("git rev-parse HEAD").out.trim().split("\n")[0],
  dirty,
  executor: "Claude Code（用户指示全部由 Claude Code 闭环）",
  package: { name: "measure-cjk", version: shrink.version, integrity },
  assertions,
  gates: { task: taskPass ? "PASS" : "FAIL", regression },
  report: { path: `${REL}/VERIFICATION_REPORT.md`, present: Boolean(report), missing_sections: missingSections },
  verdict_blockers: blockers,
  verdict_conditions: conditions,
  verdict
};
const tmp = join(outDir, `results.json.${process.pid}.tmp`);
writeFileSync(tmp, scrubText(JSON.stringify(results, null, 2)) + "\n");
renameSync(tmp, join(outDir, "results.json"));
console.log(`\n任务门 ${results.gates.task}｜回归门 ${regression}｜结论：${verdict}${blockers.length ? `（${blockers.join("；")}）` : ""}${conditions.length ? `\n条件：${conditions.join("；")}` : ""}`);
