// W2 card 命令（小红书卡片导出）的验证：逐条运行 CV-01–CV-11（CV-10、CV-11 是独立审计 AUDIT_CARD、AUDIT_CARD_r2 的回归），真实输出写进 docs/verification/w2/card/evidence/CV-xx.log，
// 汇总成 docs/verification/w2/card/results.json（原子写入）。用法：node scripts/verify-w2-card.mjs
// 结论规则同 verify-w2-render.mjs：工作树不干净、报告缺章节、有影响结论但用户还没拍板的事项，都判「未达标」；
// 真实字体验收（CV-08）在本机没有那份字体时判 BLOCKED_ENV，结论最多是「有条件达标」。
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { copyFileSync, existsSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { pendingBlockers } from "./verdict.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const REL = "docs/verification/w2/card";
const outDir = join(root, REL);
const evDir = join(outDir, "evidence");
mkdirSync(evDir, { recursive: true });
// 真实字体（用户拍板 D-C6）：放在仓库外，不进 git；按 SHA-256 核对是官方 v1.530 的那一份
const REAL_FONT_DIR = join(root, "..", "deliverables", "fonts-for-test");
const REAL_FONT = join(REAL_FONT_DIR, "LXGWWenKai-Regular.ttf");
const REAL_FONT_SHA256 = "2d73eea94ad808999d90c0000c239a84a33b09d4bc6ab6c5b8bbf1eda8a7fc8b";

function sh(cmd, cwd = root) {
  const r = spawnSync("/bin/sh", ["-c", cmd], { cwd, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
  return { code: r.status, out: (r.stdout ?? "") + (r.stderr ? `\n[stderr]\n${r.stderr}` : "") };
}
const assertions = [];
function record(id, desc, cmds, judge, cwd) {
  const runs = cmds.map((c) => ({ cmd: c, ...sh(c, cwd) }));
  const { status, notes } = judge(runs);
  writeFileSync(join(evDir, `${id}.log`), runs.map((r) => `$ ${r.cmd}\n# 退出码：${r.code}\n${r.out}`).join("\n\n") + `\n\n# 判定：${status}${notes ? `（${notes}）` : ""}\n# 时间：${new Date().toISOString()}\n`);
  assertions.push({ id, desc, command: cmds.join(" && "), status, evidence: `evidence/${id}.log`, notes: notes ?? "" });
  console.log(`${status.padEnd(13)} ${id} ${desc}${notes ? ` — ${notes}` : ""}`);
}
const ok = (b, notes) => ({ status: b ? "PASS" : "FAIL", notes });
const testPass = (r) => ok(r.code === 0 && /ℹ fail 0/.test(r.out), (r.out.match(/ℹ pass \d+|ℹ fail \d+/g) ?? []).join("，"));
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

record("CV-01", "字体文件解析：TTF、OTF、TTC、WOFF、WOFF2 读出名称；坏文件返回 error 不抛异常", [nodeTest("test/card.test.js", "字体解析")], ([r]) => testPass(r));
record("CV-02", "F06 判定：🟢、🔵 放行；🔴、微软雅黑进 font_dir、查不到的字体拒绝；缺字回退到不能出图的系统字体时拒绝；页面自带字体被拦截；有 lint error 不出图（D-C1、D-C2）", [nodeTest("test/card.test.js", "card 夹具")], ([r]) => testPass(r));
record("CV-03", "3 种模板和 examples/card.html：导出 1080×1440，lint 零 error（AC-9，方框字体）", [nodeTest("test/card.test.js", "模板")], ([r]) => testPass(r));
record("CV-04", "命令行、结果 JSON、WOFF2 注入、安全（font_dir、--out 校验）、64 MB 与 50 个的上限（D-C3）、没装 Playwright 时退出码 2", [nodeTest("test/card.test.js", "命令行|安全|D-C3|Playwright|WOFF2|接口")], ([r]) => testPass(r));
record("CV-05", "card 在 Node 一侧零网络请求", [nodeTest("test/card-offline.test.js")], ([r]) => testPass(r));
const MANIFEST_DIRS = ["bench/golden", "test/fixtures", "test/fixtures/w2-render", "test/fixtures/w2-card", "test/fixtures/w2-card-audit", "test/fixtures/w2-card-audit-r2", "test/fixtures/w2-card-audit-r3"];
record("CV-06", `夹具锁定：${MANIFEST_DIRS.length} 份 MANIFEST 校验通过`, MANIFEST_DIRS.map((d) => `(cd ${d} && shasum -a 256 -c MANIFEST.sha256)`), (runs) => ok(runs.every((r) => r.code === 0)));
record("CV-07", "仓库里没有字体文件（H3），skill 格式和授权表校验通过（AC-1）", ["git ls-files | grep -iE '\\.(ttf|otf|ttc|woff2?)$' ; test $? -eq 1", "node scripts/validate-skill.mjs"], ([a, b]) => ok(a.code === 0 && b.code === 0));

// CV-08：真实字体验收（AC-9）
{
  const samples = join(root, "..", "deliverables", "card-samples");
  const present = existsSync(REAL_FONT) && createHash("sha256").update(readFileSync(REAL_FONT)).digest("hex") === REAL_FONT_SHA256;
  if (!present) {
    writeFileSync(join(evDir, "CV-08.log"), `本机没有 ${REAL_FONT}，或者它的 SHA-256 不是 ${REAL_FONT_SHA256}。\n# 判定：BLOCKED_ENV\n`);
    assertions.push({ id: "CV-08", desc: "AC-9 真实字体验收（霞鹜文楷 v1.530）", command: "", status: "BLOCKED_ENV", evidence: "evidence/CV-08.log", notes: "本机没有这份字体" });
    console.log("BLOCKED_ENV   CV-08 AC-9 真实字体验收");
  } else {
    rmSync(samples, { recursive: true, force: true });
    mkdirSync(samples, { recursive: true });
    const cards = ["skills/measure/assets/cards/cover.html", "skills/measure/assets/cards/list.html", "skills/measure/assets/cards/quote.html", "examples/card.html"];
    const cmds = cards.map((c) => {
      const name = c.split("/").pop().replace(".html", "");
      return `node measure-cjk/packages/cli/bin/measure-cjk.js card measure-cjk/${c} --out deliverables/card-samples/${name}.png --font-dir deliverables/fonts-for-test --root . --result deliverables/card-samples/${name}.json --format json`;
    });
    record("CV-08", "AC-9 真实字体验收：用霞鹜文楷 v1.530（SHA-256 核对过）导出 3 种模板和示例卡片，全部导出，只用到这一款字体，lint 零 error", cmds, (runs) => {
      const results = runs.map((r) => {
        try {
          return JSON.parse(r.out.replace(/\n\[stderr\][\s\S]*$/, ""));
        } catch {
          return null;
        }
      });
      const good = results.every((j, i) => runs[i].code === 0 && j && j.status === "exported" && j.fonts.every((f) => !f.used || (f.license_id === "lxgw-wenkai" && f.allowed)) && j.fonts.every((f) => f.allowed) && j.lint.summary.errors === 0);
      // 样张由脚本自己复制进 evidence/real-font/，并记下哈希（AUDIT_CARD CA-08）
      const realDir = join(evDir, "real-font");
      rmSync(realDir, { recursive: true, force: true });
      mkdirSync(realDir, { recursive: true });
      const hashes = [];
      for (const j of results) {
        if (!j?.output) continue;
        const name = j.output.split("/").pop().replace(".png", "");
        writeFileSync(join(evDir, `CV-08-${name}.json`), JSON.stringify(j, null, 2) + "\n");
        copyFileSync(join(root, "..", j.output), join(realDir, `${name}.png`));
        hashes.push(`${createHash("sha256").update(readFileSync(join(realDir, `${name}.png`))).digest("hex")}  real-font/${name}.png`);
      }
      writeFileSync(join(evDir, "real-font", "SHA256SUMS"), hashes.join("\n") + "\n");
      return ok(good, results.map((j) => (j ? `${j.input.split("/").pop()}：${j.status}，字体 ${j.fonts.filter((f) => f.used).map((f) => `${f.family}（单个元素最多 ${f.glyph_count} 字形）`).join("、")}` : "解析失败")).join("；") + `；样张哈希见 evidence/real-font/SHA256SUMS`);
    }, join(root, ".."));
  }
}
record("CV-10", "AUDIT_CARD 回归：伪元素、表单控件、shadow DOM、canvas、含文字的 SVG 图片（img、object）、iframe、动画、页面自带字体（data:、blob:、FontFace）、点名的 🔴 字体、竖屏媒体查询、按文件名放行都不能导出；安全检查逐条给出原因；--evidence；配置里的 font_dir；解压炸弹（CA-01–CA-07、CA-09–CA-11、CA-13）", [nodeTest("test/card-audit.test.js")], ([r]) => testPass(r));
record("CV-11", "AUDIT_CARD_r2/r3 回归：lint 测量之后、截图之前改页面不能导出没检查过的画面（CB-01：夹具 + 自适应扫描 2 次，必须扫到窗口两端且 0 个 ✗，CC-02）；embed、CSS 背景、mask、content: url()、内联 SVG 的 image 里的 SVG 文字判没检查完（CB-02）；shadow DOM、样式表、冒用红框 id 的持续改动判没检查完（CC-01）", [nodeTest("test/card-audit-r2.test.js test/card-audit-r3.test.js"), "node scripts/sweep-card-late-change.mjs . --adaptive", "node scripts/sweep-card-late-change.mjs . --adaptive"], ([t, ...sweeps]) => {
  const pass = testPass(t);
  const sums = sweeps.map((x) => (x.out.match(/汇总：[^\n]*/) ?? ["（没有汇总）"])[0]);
  return ok(pass.status === "PASS" && sweeps.every((x) => x.code === 0), `${pass.notes}；${sums.join("；")}`);
});
// 回归门的结果受机器负载影响（AUDIT_CARD_r2 CB-03）：日志里记下运行前后的 uptime
record("CV-09", "回归门：全量测试失败为 0（并发 4，日志记 uptime）", ["uptime", "npm test", "uptime"], ([, r]) => {
  const total = Number(r.out.match(/ℹ tests (\d+)/)?.[1] ?? 0);
  const fail = Number(r.out.match(/ℹ fail (\d+)/)?.[1] ?? -1);
  return ok(total > 0 && fail === 0, `测试 ${total} 项，失败 ${fail} 项`);
});

const scanCmds = [
  "grep -rnE '\\.(skip|todo|only)\\(|test\\.only|\\{ *(skip|todo|only): *true' test/ packages/cli/src/ scripts/ ; true",
  "grep -rnE 'assert\\.ok\\(true\\)|status: *\"PASS\"' test/ ; true",
  "node scripts/scan-empty-catch.mjs",
  "grep -rnE 'mock\\.(method|fn)|runLint *= |runRender *= |runCard *= ' test/ ; true",
  "grep -rnE '[\"`-]force[\"`]' packages/cli/src/ ; true"
];
const scan = scanCmds.map((c) => ({ cmd: c, ...sh(c) }));
const hits = scan.filter((s) => s.out.replace(/\[stderr\][\s\S]*/, "").trim());
writeFileSync(join(evDir, "pseudo-success-scan.log"), scan.map((s) => `$ ${s.cmd}\n${s.out.trim() || "（无匹配）"}`).join("\n\n") + "\n");
const pseudo = hits.length ? `发现：${hits.map((h) => h.cmd.split(" ")[2]).join("；")}` : "未发现";

const REPORT_SECTIONS = ["结论", "断言逐条", "依赖与 license", "已知局限", "伪成功扫描", "需要审计方裁定", "下一轮建议"];
const report = existsSync(join(outDir, "VERIFICATION_REPORT.md")) ? readFileSync(join(outDir, "VERIFICATION_REPORT.md"), "utf8") : "";
const missingSections = REPORT_SECTIONS.filter((h) => !new RegExp(`^##\\s.*${h}`, "m").test(report));
const task = assertions.filter((a) => a.id !== "CV-09");
const taskPass = task.every((a) => ["PASS", "BLOCKED_ENV"].includes(a.status));
const blocked = task.some((a) => a.status === "BLOCKED_ENV");
const regression = assertions.find((a) => a.id === "CV-09").status;
const blockers = [];
if (dirty) blockers.push("工作树不干净（见 evidence/git-status.log）");
if (!report) blockers.push("缺少 VERIFICATION_REPORT.md");
else if (missingSections.length) blockers.push(`报告缺少章节：${missingSections.join("、")}`);
const odPath = join(outDir, "open_decisions.json");
for (const d of existsSync(odPath) ? pendingBlockers(JSON.parse(readFileSync(odPath, "utf8")).items) : []) blockers.push(`待用户拍板：${d.id} ${d.question}`);
const verdict = taskPass && regression === "PASS" && pseudo === "未发现" && blockers.length === 0 ? (blocked ? "有条件达标" : "达标") : "未达标";

const results = {
  schema_version: "1.0.0",
  project: "measure-cjk",
  milestone: "W2 card 命令（小红书卡片导出）",
  generated_at: new Date().toISOString(),
  git_head: sh("git rev-parse HEAD").out.trim().split("\n")[0],
  dirty,
  executor: "Claude Code（用户指示全部由 Claude Code 闭环）",
  assertions,
  gates: { task: taskPass ? "PASS" : "FAIL", regression },
  pseudo_success_scan: pseudo,
  report: { path: `${REL}/VERIFICATION_REPORT.md`, present: Boolean(report), missing_sections: missingSections },
  verdict_blockers: blockers,
  verdict_conditions: blocked ? ["有 BLOCKED_ENV 项，需要在有这份字体的环境里复验"] : [],
  verdict
};
const tmp = join(outDir, `results.json.${process.pid}.tmp`);
writeFileSync(tmp, JSON.stringify(results, null, 2) + "\n");
renameSync(tmp, join(outDir, "results.json"));
console.log(`\n任务门 ${results.gates.task}｜回归门 ${regression}｜伪成功扫描 ${pseudo}｜结论：${verdict}${blockers.length ? `（${blockers.join("；")}）` : ""}`);
