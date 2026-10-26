// W2 完整档（lint --render）的验证：逐条运行 RV-01–RV-13，真实输出写进 docs/verification/w2/render/evidence/RV-xx.log，
// 汇总成 docs/verification/w2/render/results.json（原子写入）。用法：node scripts/verify-w2-render.mjs
// 结论规则和 W1 的 verify.mjs 相同：工作树不干净、报告缺章节、有 INCOMPLETE、有影响结论但用户还没拍板的事项，都判「未达标」。
import { spawnSync } from "node:child_process";
import { mkdirSync, writeFileSync, renameSync, readFileSync, existsSync, rmSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { pendingBlockers } from "./verdict.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const REL = "docs/verification/w2/render";
const outDir = join(root, REL);
const evDir = join(outDir, "evidence");
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
const testPass = (r, pattern) => ok(r.code === 0 && /ℹ fail 0/.test(r.out) && (!pattern || pattern.test(r.out)), (r.out.match(/ℹ pass \d+|ℹ fail \d+/g) ?? []).join("，"));
const nodeTest = (file, pattern) => `node --test --test-reporter=spec${pattern ? ` --test-name-pattern='${pattern}'` : ""} ${file}`;

const porcelain = sh("git status --porcelain").out.split("\n").filter((l) => l.trim() && !l.includes(`${REL}/`));
const dirty = porcelain.length > 0;
writeFileSync(join(evDir, "git-status.log"), porcelain.join("\n") || "（工作树干净）");

const build = sh("npm run build");
writeFileSync(join(evDir, "build.log"), build.out);
if (build.code !== 0) {
  console.error("构建失败，停止验证");
  process.exit(1);
}

// 截图目录每次重建，避免上一次的截图混进来
rmSync(join(evDir, "screens-golden"), { recursive: true, force: true });
record("RV-01", "AC-2 完整档：golden 20 页里出现 error 的页面 ≤ 1", [`${CLI} lint bench/golden/ --render --format json --out ${REL}/evidence/RV-01.json --evidence ${REL}/evidence/screens-golden`], ([r]) => {
  const j = JSON.parse(readFileSync(join(evDir, "RV-01.json"), "utf8"));
  const errPages = new Set(j.findings.filter((f) => f.severity === "error").map((f) => f.file));
  return ok(j.run.mode === "render" && errPages.size <= 1 && j.summary.cjk_files === 20 && j.summary.status !== "incomplete", `有 error 的页面 ${errPages.size} 个；含中文页面 ${j.summary.cjk_files} 个；warn ${j.summary.warns} 个；宽度 ${j.run.render.widths.join("、")}；浏览器 ${j.run.render.browser}；退出码 ${r.code}`);
});
record("RV-02", "规则夹具：T04、T05、T06、T07、T08、T11、T12、A01、A11 按 expect.json 命中或不命中；每条 error 都有 PNG 截图", [nodeTest("test/w2-render.test.js", "各规则夹具|实测只有一行")], ([r]) => testPass(r));
record("RV-03", "AC-6：没有 Playwright 时退出码 2 并给出安装提示，不降级", [nodeTest("test/w2-render.test.js", "AC-6")], ([r]) => testPass(r, /✔ AC-6/));
record("RV-04", "AC-7：lint http://127.0.0.1:<port>/… --render，6 种宽度跑完，每条 error 都有截图", [nodeTest("test/w2-render.test.js", "AC-7")], ([r]) => testPass(r, /✔ AC-7/));
record("RV-05", "浏览器一侧网络拦截：远程资源、工作区外的 file://、localhost 服务都访问不到", [nodeTest("test/w2-render.test.js", "网络拦截")], ([r]) => testPass(r));
record("RV-06", "Node 一侧零网络请求（完整档）", [nodeTest("test/w2-render-offline.test.js")], ([r]) => testPass(r));
record("RV-07", "单页 15 秒上限：死循环页面 → incomplete、退出码 2；环境变量只能调低", [nodeTest("test/w2-render.test.js", "超时")], ([r]) => testPass(r));
record("RV-08", "输入与路径校验：远程 URL 需要 --allow-remote、URL 需要 --render、--widths 范围、截图目录不能是符号链接或在工作区外", [nodeTest("test/w2-render.test.js", "URL 输入|--widths|截图目录安全")], ([r]) => testPass(r));
record("RV-09", "实现中发现的问题的回归测试（R-01 伪成功、R-02 IP 字面量被 DNS 规则误伤、R-03 HTTP 302 不算跳转）", [nodeTest("test/w2-render-review.test.js")], ([r]) => testPass(r));

const MANIFEST_DIRS = ["bench/golden", "test/fixtures", "test/fixtures/w1-extra", "test/fixtures/w1-extra2", "test/fixtures/iter2", "test/fixtures/iter2b", "test/fixtures/iter3", "test/fixtures/iter4", "test/fixtures/w2-c20", "test/fixtures/w2-render", "test/fixtures/w2-render-audit", "test/fixtures/w2-render-audit-r2", "test/fixtures/w2-render-audit-r3", "test/fixtures/w2-render-audit-r4", "test/fixtures/w2-render-audit-r5", "test/fixtures/w2-render-audit-r6", "test/fixtures/w2-render-audit-r7", "test/fixtures/w2-render-audit-r8"];
record("RV-10", `夹具锁定：${MANIFEST_DIRS.length} 份 MANIFEST 校验通过`, MANIFEST_DIRS.map((d) => `(cd ${d} && shasum -a 256 -c MANIFEST.sha256)`), (runs) => ok(runs.every((r) => r.code === 0)));
record("RV-11", "基础档默认仍然零网络、源码里没有网络和子进程模块的导入（AC-4）", [nodeTest("test/offline.test.js")], ([r]) => testPass(r));
record("RV-12", "回归门：全量测试失败为 0", ["npm test"], ([r]) => {
  const total = Number(r.out.match(/ℹ tests (\d+)/)?.[1] ?? 0);
  const fail = Number(r.out.match(/ℹ fail (\d+)/)?.[1] ?? -1);
  return ok(total > 0 && fail === 0, `测试 ${total} 项，失败 ${fail} 项`);
});
record("RV-14", "AUDIT_RENDER 回归：RA-01 至 RA-20 的复现夹具和测试（路径穿越、页面改写测量、脚本渲染的中文、隐藏和折叠、跳转、HTTP 错误、浮点容差、多栏、中英混排、伪元素渐变、TCP 连接等）", [nodeTest("test/w2-render-audit.test.js")], ([r]) => testPass(r));
record("RV-15", "AUDIT_RENDER_r2 回归：RB-01 至 RB-09 的复现夹具和测试（占位中文、竖排与选择器碰撞、blob/javascript 跳转、iframe、tbody、行内间隔、蓝色渐变、T04 两类、行号）", [nodeTest("test/w2-render-audit-r2.test.js")], ([r]) => testPass(r));
record("RV-16", "AUDIT_RENDER_r3 回归：RC-01 至 RC-05（不可见的同文字元素、响应式两份文字、被拦截的外部 iframe 和错误页、脚本改文字、超过 4 层的同名元素；全部夹具和 golden、对照组 80 页上「同一规则、同一元素最多一条 error」）", [nodeTest("test/w2-render-audit-r3.test.js")], ([r]) => testPass(r));
record("RV-17", "AUDIT_RENDER_r4 回归：RD-01 至 RD-03（不可见元素的 error 不能被同文字或同选择器的可见元素删掉；脚本追加、替换、短占位带出来的问题要补报；带选择器的 error 都有文字指纹）", [nodeTest("test/w2-render-audit-r4.test.js")], ([r]) => testPass(r));
record("RV-18", "AUDIT_RENDER_r5 回归：RE-01 至 RE-03（身份撞车的不可见元素、短文字加前缀不重复、脚本插入同文字段落要补报）", [nodeTest("test/w2-render-audit-r5.test.js")], ([r]) => testPass(r));
record("RV-19", "AUDIT_RENDER_r6 回归：RF-01、RF-04（脚本挪动或复制同身份元素、调换顺序后，不可见元素的 error 不能被删）", [nodeTest("test/w2-render-audit-r6.test.js")], ([r]) => testPass(r));
record("RV-20", "AUDIT_RENDER_r7 回归：RG-01、RG-03（中文元素超过 5000 个的页面不能错删基础档 error；删掉可见的同身份元素；同身份元素一部分在 iframe 里）", [nodeTest("test/w2-render-audit-r7.test.js")], ([r]) => testPass(r));
record("RV-21", "AUDIT_RENDER_r8 回归：RH-01（同身份元素在不同宽度下轮流可见，窄屏的问题必须报出）", [nodeTest("test/w2-render-audit-r8.test.js")], ([r]) => testPass(r));
record("RV-13", "真实页面完成度检查：对照组 v2 的 60 页在完整档下全部检查完（没有 incomplete），记录耗时和与基础档的对比（只检查完成度，不检验结果正确与否）", ["node bench/render-compare.mjs --out docs/verification/w2/render/evidence/RV-13.json"], ([r]) => {
  if (!existsSync(join(evDir, "RV-13.json"))) return ok(false, "没有生成 RV-13.json");
  const j = JSON.parse(readFileSync(join(evDir, "RV-13.json"), "utf8"));
  const allDone = j.groups.every((g) => g.status !== "incomplete" && g.cjk_pages === 30);
  return ok(r.code === 0 && allDone, j.groups.map((g) => `${g.agent}：${g.cjk_pages} 页，${(g.ms / 1000).toFixed(0)} 秒，完整档零 error ${g.render.zero_error}、排除 T02/T04 后 ${g.render.zero_error_excl_T02_T04}；基础档 ${g.static.zero_error}、${g.static.zero_error_excl_T02_T04}`).join("；"));
});

// ---------- 伪成功扫描 ----------
const scanCmds = [
  "grep -rnE '\\.(skip|todo|only)\\(|test\\.only|\\{ *(skip|todo|only): *true' test/ packages/cli/src/ scripts/ ; true",
  "grep -rnE 'assert\\.ok\\(true\\)|status: *\"PASS\"' test/ ; true",
  "node scripts/scan-empty-catch.mjs",
  "grep -rnE 'mock\\.(method|fn)|runLint *= |runRender *= ' test/ ; true",
  "grep -rnE '[\"`-]force[\"`]' packages/cli/src/ ; true"
];
const scan = scanCmds.map((c) => ({ cmd: c, ...sh(c) }));
const hits = scan.filter((s) => s.out.replace(/\[stderr\][\s\S]*/, "").trim());
writeFileSync(join(evDir, "pseudo-success-scan.log"), scan.map((s) => `$ ${s.cmd}\n${s.out.trim() || "（无匹配）"}`).join("\n\n") + "\n");
const pseudo = hits.length ? `发现：${hits.map((h) => h.cmd.split(" ")[2]).join("；")}` : "未发现";

// ---------- 报告完整性 ----------
const REPORT_SECTIONS = ["结论", "断言逐条", "基线数据", "依赖与 license", "已知局限", "伪成功扫描", "需要审计方裁定", "下一轮建议"];
const reportPath = join(outDir, "VERIFICATION_REPORT.md");
const report = existsSync(reportPath) ? readFileSync(reportPath, "utf8") : "";
const missingSections = REPORT_SECTIONS.filter((h) => !new RegExp(`^##\\s.*${h}`, "m").test(report));

const task = assertions.filter((a) => a.id !== "RV-12");
// 伪成功扫描只是关键字扫描（AUDIT_RENDER RA-13）：伪成功路径靠 RV-14 等行为测试覆盖
const taskPass = task.every((a) => a.status === "PASS");
const regression = assertions.find((a) => a.id === "RV-12").status;
const blockers = [];
if (dirty) blockers.push("工作树不干净（见 evidence/git-status.log）");
if (!report) blockers.push("缺少 VERIFICATION_REPORT.md");
else if (missingSections.length) blockers.push(`报告缺少章节：${missingSections.join("、")}`);
const odPath = join(outDir, "open_decisions.json");
const openDecisions = existsSync(odPath) ? pendingBlockers(JSON.parse(readFileSync(odPath, "utf8")).items) : [];
for (const d of openDecisions) blockers.push(`待用户拍板：${d.id}（${d.finding}）${d.question}`);
const verdict = taskPass && regression === "PASS" && pseudo === "未发现" && blockers.length === 0 ? "达标" : "未达标";

const results = {
  schema_version: "1.0.0",
  project: "measure-cjk",
  milestone: "W2 完整档（lint --render）",
  generated_at: new Date().toISOString(),
  git_head: sh("git rev-parse HEAD").out.trim().split("\n")[0],
  dirty,
  executor: "Claude Code（用户指示全部由 Claude Code 闭环）",
  assertions,
  gates: { task: taskPass ? "PASS" : "FAIL", regression },
  pseudo_success_scan: pseudo,
  report: { path: `${REL}/VERIFICATION_REPORT.md`, present: Boolean(report), missing_sections: missingSections },
  verdict_blockers: blockers,
  verdict
};
const tmp = join(outDir, `results.json.${process.pid}.tmp`);
writeFileSync(tmp, JSON.stringify(results, null, 2) + "\n");
renameSync(tmp, join(outDir, "results.json"));
console.log(`\n任务门 ${results.gates.task}｜回归门 ${regression}｜伪成功扫描 ${pseudo}｜结论：${verdict}${blockers.length ? `（${blockers.join("；")}）` : ""}`);
