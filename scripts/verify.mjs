// 全量验证：逐条运行 V-01–V-14，真实输出写进 docs/verification/iter_<N>/evidence/V-xx.log，
// 汇总成 docs/verification/iter_<N>/results.json（原子写入）。用法：node scripts/verify.mjs --iter 2
// 结论规则（A-01、A-36）：工作树不干净、缺少 VERIFICATION_REPORT.md 或其 8 节、有 INCOMPLETE 项、
// 有影响结论但用户还没拍板的事项时，都判「未达标」。「有条件达标」只用于 BLOCKED_ENV（契约 §9）。
import { spawnSync } from "node:child_process";
import { mkdirSync, writeFileSync, renameSync, readFileSync, existsSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { isResolved, pendingBlockers } from "./verdict.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const iterArg = process.argv.indexOf("--iter");
const ITER = iterArg >= 0 ? Number(process.argv[iterArg + 1]) : 1;
const iterDir = join(root, "docs", "verification", `iter_${ITER}`);
const evDir = join(iterDir, "evidence");
mkdirSync(evDir, { recursive: true });
const CLI = "node packages/cli/bin/measure-cjk.js";

function sh(cmd) {
  const r = spawnSync("/bin/sh", ["-c", cmd], { cwd: root, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
  return { code: r.status, out: (r.stdout ?? "") + (r.stderr ? `\n[stderr]\n${r.stderr}` : "") };
}

const assertions = [];
function record(id, desc, cmds, judge) {
  const runs = cmds.map((c) => ({ cmd: c, ...sh(c) }));
  const { status, notes } = judge(runs);
  const log = runs.map((r) => `$ ${r.cmd}\n# 退出码：${r.code}\n${r.out}`).join("\n\n") + `\n\n# 判定：${status}${notes ? `（${notes}）` : ""}\n# 时间：${new Date().toISOString()}\n`;
  writeFileSync(join(evDir, `${id}.log`), log);
  assertions.push({ id, desc, command: cmds.join(" && "), status, evidence: `evidence/${id}.log`, notes: notes ?? "" });
  console.log(`${status.padEnd(13)} ${id} ${desc}${notes ? ` — ${notes}` : ""}`);
}

const ok = (b, notes) => ({ status: b ? "PASS" : "FAIL", notes });

// 工作树是否干净（只允许本轮验证目录下的产物有改动）
const porcelain = sh("git status --porcelain").out.split("\n").filter((l) => l.trim() && !l.includes(`docs/verification/iter_${ITER}/`));
const dirty = porcelain.length > 0;
writeFileSync(join(evDir, "git-status.log"), porcelain.join("\n") || "（工作树干净）");

// 先构建，保证 dist 是最新的
const build = sh("npm run build");
writeFileSync(join(evDir, "build.log"), build.out);
if (build.code !== 0) {
  console.error("构建失败，停止验证");
  process.exit(1);
}

record("V-01", "skill 格式与字体授权表校验（AC-1）", ["node scripts/validate-skill.mjs"], ([r]) => ok(r.code === 0));

record("V-02", "仓库里没有字体文件（H3）", ["git ls-files | grep -iE '\\.(ttf|otf|ttc|woff2?)$' ; test $? -eq 1"], ([r]) => ok(r.code === 0, r.code === 0 ? "没有输出" : "发现字体文件"));

record("V-03", "golden 20 页基础档：出现 error 的页面 ≤ 1（AC-2 W1 版）", [`${CLI} lint bench/golden/ --format json --out docs/verification/iter_${ITER}/evidence/V-03.json`], ([r]) => {
  const j = JSON.parse(readFileSync(join(evDir, "V-03.json"), "utf8"));
  const errPages = new Set(j.findings.filter((f) => f.severity === "error").map((f) => f.file));
  return ok(errPages.size <= 1 && j.summary.cjk_files === 20, `有 error 的页面 ${errPages.size} 个；含中文页面 ${j.summary.cjk_files} 个；warn ${j.summary.warns} 个；退出码 ${r.code}`);
});

// A-24：任务包原文 `node --test test/rules/` 在 Node 22.17.1 下不能把目录当参数，这里改用 glob，含义相同
record("V-04", "W1 每条规则：2 反例命中、2 正例零 error（AC-3；命令由目录改为 glob）", ["node --test test/rules/*.test.js"], ([r]) => {
  const m = r.out.match(/# pass (\d+)[\s\S]*?# fail (\d+)/);
  return ok(r.code === 0 && m && Number(m[2]) === 0, m ? `pass ${m[1]}，fail ${m[2]}` : "无法解析测试输出");
});

record("V-05", "默认零网络请求（AC-4 / H4）", ["node --test test/offline.test.js"], ([r]) => ok(r.code === 0));
record("V-06", "路径安全（AC-5 / H5）", ["node --test test/security.test.js"], ([r]) => ok(r.code === 0));

// W2 起完整档已实现，W1 版 AC-6（「--render 返回 2，提示在 W2 实现」）被 W2 版取代：缺少 Playwright 时退出码 2 并给出安装提示
record("V-07", "没有 Playwright 时 --render 返回 2 并给出安装提示（AC-6，W2 版）", ["node --test --test-reporter=spec --test-name-pattern=AC-6 test/w2-render.test.js"], ([r]) => ok(r.code === 0 && /✔ AC-6/.test(r.out)));

record("V-08", "fonts 查询：🔴 / 🔵 / 🟢（AC-8）", [`${CLI} fonts "方正兰亭黑"`, `${CLI} fonts "阿里巴巴普惠体"`, `${CLI} fonts "Noto Sans SC"`], ([a, b, c]) =>
  ok(/🔴/.test(a.out) && /🔵/.test(b.out) && /不能自托管 webfont/.test(b.out) && /🟢/.test(c.out) && [a, b, c].every((x) => /原文：https:\/\//.test(x.out) && /核验日期：2026-10-25/.test(x.out)))
);

record("V-09", "results.json 结构与原子写入、理由必填、退出码、无 --force（H6 / H7 / H8）", ["node --test test/cli.test.js"], ([r]) => ok(r.code === 0));
record("V-10", "measure.css 两份副本与 PRD §7.4 逐字一致", ["node --test test/assets.test.js"], ([r]) => ok(r.code === 0));
record("V-11", "性能：golden 与真实页面单页 p95 ≤ 2 s，100 个文件 ≤ 20 s；超大页面受单页耗时上限约束（规模与规则类型见日志）", ["node bench/perf.mjs"], ([r]) => ok(r.code === 0));

const MANIFEST_DIRS = ["bench/golden", "test/fixtures", "test/fixtures/w1-extra", "test/fixtures/w1-extra2", "test/fixtures/iter2", "test/fixtures/iter2b", "test/fixtures/iter3", "test/fixtures/iter4", "test/fixtures/w2-c20", "test/fixtures/w2-render", "test/fixtures/w2-render-audit", "test/fixtures/w2-render-audit-r2", "test/fixtures/w2-render-audit-r3", "test/fixtures/w2-render-audit-r4", "test/fixtures/w2-render-audit-r5", "test/fixtures/w2-render-audit-r6", "test/fixtures/w2-render-audit-r7", "test/fixtures/w2-render-audit-r8"];
record("V-12", `夹具锁定：${MANIFEST_DIRS.length} 份 MANIFEST 校验通过`, MANIFEST_DIRS.map((d) => `(cd ${d} && shasum -a 256 -c MANIFEST.sha256)`), (runs) => ok(runs.every((r) => r.code === 0)));

// A-02：基线还在跑或者没有结果 → INCOMPLETE（不是 BLOCKED_ENV）；PASS 要求 30/30 产出
const baselineRunning = sh("pgrep -f 'run-baseline.mjs --agent' >/dev/null && echo running || echo idle").out.includes("running");
for (const [id, agent] of [["V-13a", "codex"], ["V-13b", "claude-code"]]) {
  const summary = join(root, "bench", "runs", `2026-W1-baseline-${agent}`, "summary.json");
  record(id, `用户环境基线（${agent}，未安装 measure skill）`, [`head -c 3000 bench/runs/2026-W1-baseline-${agent}/summary.json`, `cat bench/runs/2026-W1-baseline-${agent}/environment.log`], () => {
    if (baselineRunning) return { status: "INCOMPLETE", notes: "基线还在运行，跑完之前不得判通过" };
    if (!existsSync(summary)) return { status: "INCOMPLETE", notes: "没有 summary.json；如果是环境原因，必须附上真实的错误输出再改判 BLOCKED_ENV" };
    const s = JSON.parse(readFileSync(summary, "utf8"));
    const rate = s.zero_error_rate_over_produced;
    // claude-code 一项按原契约由审计方执行；是否追认看 open_decisions 里 D-4 的实际状态（不写死）
    const od = existsSync(join(iterDir, "open_decisions.json")) ? JSON.parse(readFileSync(join(iterDir, "open_decisions.json"), "utf8")).items : [];
    const d4 = od.find((d) => d.id === "D-4");
    const auth = agent === "claude-code" ? (d4 && isResolved(d4) ? `；由 Claude Code 代跑，用户已追认（${d4.resolved_on}，原话「${d4.user_quote}」）` : "；按任务包原契约这一项应由审计方执行，本轮由 Claude Code 代跑，用户尚未追认（D-4）") : "";
    return ok(s.prompts === 30 && s.produced === 30, `${s.prompts} 条提示词，产出 ${s.produced} 页，零 error ${s.zero_error_pages} 页（${rate === null ? "无" : (rate * 100).toFixed(1) + "%"}）；排除 T02/T04 后零 error ${s.zero_error_pages_excluding_T02_T04} 页；口径：${s.baseline_kind ?? "未标注"}${auth}`);
  });
}

record("V-14", "回归门：全量测试相对已知失败台账的新增失败为 0", ["npm test"], ([r]) => {
  const ledger = JSON.parse(readFileSync(join(root, "test", "known_failures.json"), "utf8"));
  const total = Number(r.out.match(/ℹ tests (\d+)/)?.[1] ?? 0);
  const fail = Number(r.out.match(/ℹ fail (\d+)/)?.[1] ?? -1);
  return ok(total > 0 && fail === 0, `测试 ${total} 项，失败 ${fail} 项，台账条目 ${ledger.entries.length} 条`);
});

// ---------- 伪成功扫描 ----------
const scanCmds = [
  "grep -rnE '\\.(skip|todo|only)\\(|test\\.only|\\{ *(skip|todo|only): *true' test/ packages/cli/src/ scripts/ ; true",
  "grep -rnE 'assert\\.ok\\(true\\)|status: *\"PASS\"' test/ ; true",
  "node scripts/scan-empty-catch.mjs",
  "grep -rnE 'mock\\.(method|fn)|runLint *= ' test/ ; true",
  "grep -rnE '[\"`-]force[\"`]' packages/cli/src/ ; true"
];
const scan = scanCmds.map((c) => ({ cmd: c, ...sh(c) }));
const hits = scan.filter((s) => s.out.replace(/\[stderr\][\s\S]*/, "").trim());
writeFileSync(join(evDir, "pseudo-success-scan.log"), scan.map((s) => `$ ${s.cmd}\n${s.out.trim() || "（无匹配）"}`).join("\n\n") + "\n");
const pseudo = hits.length ? `发现：${hits.map((h) => h.cmd.split(" ")[2]).join("；")}` : "未发现";

// ---------- 报告完整性（A-01） ----------
const REPORT_SECTIONS = ["结论", "断言逐条", "基线数据", "依赖与 license", "已知局限", "伪成功扫描", "需要审计方裁定", "下一轮建议"];
const reportPath = join(iterDir, "VERIFICATION_REPORT.md");
const report = existsSync(reportPath) ? readFileSync(reportPath, "utf8") : "";
const missingSections = REPORT_SECTIONS.filter((h) => !new RegExp(`^##\\s.*${h}`, "m").test(report));

// ---------- 汇总 ----------
const task = assertions.filter((a) => a.id !== "V-14");
const taskPass = task.every((a) => ["PASS", "BLOCKED_ENV", "PENDING_AGENT"].includes(a.status)) && task.some((a) => a.status === "PASS");
const incomplete = task.some((a) => a.status === "INCOMPLETE");
const blocked = task.some((a) => a.status === "BLOCKED_ENV");
const regression = assertions.find((a) => a.id === "V-14").status;
const blockers = [];
if (dirty) blockers.push("工作树不干净（见 evidence/git-status.log）");
if (!report) blockers.push("缺少 VERIFICATION_REPORT.md");
else if (missingSections.length) blockers.push(`报告缺少章节：${missingSections.join("、")}`);
if (incomplete) blockers.push("有 INCOMPLETE 项");
// A-36：开放决策只有带上用户原话（user_quote）和日期（resolved_on）才算「已拍板」；执行方不能自己把它改成 resolved
const odPath = join(iterDir, "open_decisions.json");
const openDecisions = existsSync(odPath) ? pendingBlockers(JSON.parse(readFileSync(odPath, "utf8")).items) : [];
for (const d of openDecisions) blockers.push(`待用户拍板：${d.id}（${d.finding}）${d.question}`);
const conditions = blocked ? ["有 BLOCKED_ENV 项，需要在有条件的环境里复验"] : [];
const verdict = taskPass && !incomplete && regression === "PASS" && pseudo === "未发现" && blockers.length === 0 ? (conditions.length ? "有条件达标" : "达标") : "未达标";
const head = sh("git rev-parse HEAD").out.trim().split("\n")[0];

const results = {
  schema_version: "1.0.0",
  project: "measure-cjk",
  milestone: "W1",
  iteration: ITER,
  generated_at: new Date().toISOString(),
  git_head: head,
  dirty,
  executor: "Claude Code（用户指示本轮不交给 Codex，全部由 Claude Code 闭环）",
  assertions,
  gates: { task: taskPass ? "PASS" : "FAIL", regression, art: "N/A" },
  pseudo_success_scan: pseudo,
  report: { path: `docs/verification/iter_${ITER}/VERIFICATION_REPORT.md`, present: Boolean(report), missing_sections: missingSections },
  delivery_zip: "由 scripts/package.mjs 在本文件提交之后生成（zip 包含本文件，所以本文件无法记录 zip 的哈希；哈希见 deliverables/ 下的 .sha256 文件）",
  verdict_blockers: blockers,
  verdict_conditions: conditions,
  verdict
};
const tmp = join(iterDir, `results.json.${process.pid}.tmp`);
writeFileSync(tmp, JSON.stringify(results, null, 2) + "\n");
renameSync(tmp, join(iterDir, "results.json"));
console.log(`\n任务门 ${results.gates.task}｜回归门 ${regression}｜伪成功扫描 ${pseudo}｜结论：${verdict}${blockers.length ? `（${blockers.join("；")}）` : ""}${conditions.length ? `\n条件：\n- ${conditions.join("\n- ")}` : ""}`);
