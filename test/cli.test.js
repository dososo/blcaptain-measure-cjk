// V-09（H6 / H7 / H8）：results.json 结构与原子写入、关闭规则必须写理由、退出码、没有 --force、--render 返回 2
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync, readFileSync, readdirSync, existsSync, copyFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { main, RULES } from "../packages/cli/dist/index.js";
import { capture } from "./helpers.js";

const repo = join(dirname(fileURLToPath(import.meta.url)), "..");
const fixtures = join(repo, "test", "fixtures", "bad");
const BAD = `<!doctype html><html lang="zh-CN"><head><style>body{font-family:"PingFang SC",sans-serif}p{line-height:1.2}</style></head><body><p>中文正文</p></body></html>`;

function ws() {
  return mkdtempSync(join(repo, "test", "tmp-cli-"));
}

// 按 PRD §7.3 校验 LintResult 结构
function assertLintResult(r) {
  assert.equal(r.schema_version, "1.0.0");
  assert.equal(r.tool.name, "measure-cjk");
  assert.equal(typeof r.tool.version, "string");
  assert.equal(typeof r.tool.ruleset_version, "string");
  assert.match(r.run.started_at, /^\d{4}-\d{2}-\d{2}T/);
  assert.ok(["static", "render"].includes(r.run.mode));
  assert.ok(Array.isArray(r.run.inputs));
  assert.match(r.run.config_sha256, /^[0-9a-f]{64}$/);
  assert.ok(["offline", "localhost", "remote"].includes(r.run.network));
  for (const k of ["files", "cjk_files", "errors", "warns"]) assert.equal(typeof r.summary[k], "number");
  assert.ok(["pass", "fail", "skipped"].includes(r.summary.status));
  assert.ok(Array.isArray(r.disabled_rules) && Array.isArray(r.fonts) && Array.isArray(r.findings));
  for (const f of r.findings) {
    assert.match(f.rule, /^[TFA]\d\d$/);
    assert.ok(["error", "warn"].includes(f.severity));
    assert.equal(typeof f.file, "string");
    assert.equal(typeof f.message, "string");
    assert.equal(typeof f.fix_hint, "string");
  }
}

test("results.json 符合 PRD §7.3 的结构，并且原子写入（不留 .tmp）", () => {
  const d = ws();
  try {
    writeFileSync(join(d, "p.html"), BAD);
    const { code } = capture(() => main(["lint", "p.html", "--out", "r.json"], d));
    assert.equal(code, 1);
    const r = JSON.parse(readFileSync(join(d, "r.json"), "utf8"));
    assertLintResult(r);
    assert.equal(r.summary.status, "fail");
    assert.equal(readdirSync(d).filter((f) => f.includes(".tmp")).length, 0);
  } finally {
    rmSync(d, { recursive: true, force: true });
  }
});

test("有 error 时退出码 1；没有中文内容时 status=skipped、退出码 0", () => {
  assert.equal(capture(() => main(["lint", "T06-neg-tight-number.html"], fixtures)).code, 1);
  const s = capture(() => main(["lint", "NOCJK-english-only.html", "--format", "json"], fixtures));
  assert.equal(s.code, 0);
  assert.equal(JSON.parse(s.stdout).summary.status, "skipped");
});

test("关闭规则时理由为空 → 退出码 2；写了理由 → 该规则的结果被移除，并记录在 disabled_rules", () => {
  const d = ws();
  try {
    writeFileSync(join(d, "p.html"), BAD);
    writeFileSync(join(d, "empty.json"), JSON.stringify({ schema_version: "1.0.0", disabled: { T06: "  " } }));
    const bad = capture(() => main(["lint", "p.html", "--config", "empty.json"], d));
    assert.equal(bad.code, 2);
    assert.match(bad.stderr, /必须写明理由/);
    writeFileSync(join(d, "ok.json"), JSON.stringify({ schema_version: "1.0.0", disabled: { T06: "品牌规范要求紧排" } }));
    const ok = capture(() => main(["lint", "p.html", "--config", "ok.json", "--format", "json"], d));
    const r = JSON.parse(ok.stdout);
    assert.equal(r.findings.filter((f) => f.rule === "T06").length, 0);
    assert.deepEqual(r.disabled_rules, [{ rule: "T06", reason: "品牌规范要求紧排" }]);
  } finally {
    rmSync(d, { recursive: true, force: true });
  }
});

test("不存在 --force：传入时按未知参数处理，退出码 2；源码里也没有 force 开关", () => {
  const r = capture(() => main(["lint", "T06-neg-tight-number.html", "--force"], fixtures));
  assert.equal(r.code, 2);
  assert.match(r.stderr, /未知参数/);
  for (const f of readdirSync(join(repo, "packages/cli/src"))) {
    assert.doesNotMatch(readFileSync(join(repo, "packages/cli/src", f), "utf8"), /["'`-]force["'`]/, `${f} 里出现了 force 开关`);
  }
});

// W1 版 AC-6（「--render 返回 2，提示完整档在 W2 实现」）已被 W2 完整档取代：
// 缺少 Playwright 时退出码 2 由 w2-render.test.js 的 AC-6 覆盖；这里只确认 --render 不再走 W1 的拒绝分支
test("--render 走完整档的异步路径：参数错误同步返回 2，截图目录越界异步返回 2，合格页面真的渲染并返回 0", async () => {
  const r = main(["lint", "T01-pos-zh-cn.html", "--render", "--widths", "abc"], fixtures);
  assert.equal(typeof r, "number"); // 参数非法，同步返回 2
  assert.equal(r, 2);
  const p = main(["lint", "T01-pos-zh-cn.html", "--render", "--widths", "1280", "--evidence", "../tmp-render-evidence-never-created"], fixtures);
  assert.equal(typeof p.then, "function"); // 完整档是异步的，返回 Promise
  assert.equal(await p, 2); // 截图目录在工作区外，拒绝（在启动浏览器之前）
  // RULING-05 的条件：补一条能成功渲染的断言（合格页面在完整档下通过，结果里有渲染信息）
  const d = mkdtempSync(join(tmpdir(), "measure-cli-render-"));
  try {
    copyFileSync(join(repo, "test", "fixtures", "w2-render", "R-pos-baseline.html"), join(d, "p.html"));
    const ok = await main(["lint", "p.html", "--render", "--widths", "1280", "--format", "json", "--out", "r.json"], d);
    assert.equal(ok, 0);
    const r = JSON.parse(readFileSync(join(d, "r.json"), "utf8"));
    assert.equal(r.run.mode, "render");
    assert.deepEqual(r.run.render.widths, [1280]);
  } finally {
    rmSync(d, { recursive: true, force: true });
  }
});

test("fonts 命令：🔴 / 🔵 / 🟢 / 未知", () => {
  const red = capture(() => main(["fonts", "方正兰亭黑"], repo)).stdout;
  assert.match(red, /🔴/);
  assert.match(red, /https:\/\/www\.foundertype\.com/);
  const blue = capture(() => main(["fonts", "阿里巴巴普惠体"], repo)).stdout;
  assert.match(blue, /🔵/);
  assert.match(blue, /不能自托管 webfont/);
  const green = capture(() => main(["fonts", "Noto Sans SC"], repo)).stdout;
  assert.match(green, /🟢/);
  assert.match(green, /2026-10-25/);
  const free = capture(() => main(["fonts", "方正书宋"], repo)).stdout;
  assert.match(free, /🔵/, "方正免费字体应以精确名字优先命中，而不是被「方正」前缀判成 🔴");
  const unknown = capture(() => main(["fonts", "Some Unknown Font"], repo));
  assert.equal(unknown.code, 0);
  assert.match(unknown.stdout, /F-UNKNOWN/);
});

test("init：生成配置和 measure.css，已存在时不覆盖；--spacing text 去掉 text-autospace 段", () => {
  const d = ws();
  try {
    capture(() => main(["init"], d));
    const cfg = JSON.parse(readFileSync(join(d, "measure.config.json"), "utf8"));
    assert.equal(cfg.schema_version, "1.0.0");
    assert.match(readFileSync(join(d, "measure.css"), "utf8"), /text-autospace: normal/);
    writeFileSync(join(d, "measure.css"), "/* 用户自己改过 */");
    const again = capture(() => main(["init"], d));
    assert.match(again.stdout, /没有覆盖/);
    assert.equal(readFileSync(join(d, "measure.css"), "utf8"), "/* 用户自己改过 */");
    const d2 = ws();
    try {
      capture(() => main(["init", "--spacing", "text"], d2));
      assert.equal(JSON.parse(readFileSync(join(d2, "measure.config.json"), "utf8")).spacing, "text");
      assert.doesNotMatch(readFileSync(join(d2, "measure.css"), "utf8"), /text-autospace/);
    } finally {
      rmSync(d2, { recursive: true, force: true });
    }
  } finally {
    rmSync(d, { recursive: true, force: true });
  }
});

test("rules 命令：W1 已实现 13 条（T01–T09、T11、T13、F03、F04）", () => {
  const implemented = RULES.filter((r) => r.implemented_w1).map((r) => r.id).sort();
  assert.deepEqual(implemented, ["F03", "F04", "T01", "T02", "T03", "T04", "T05", "T06", "T07", "T08", "T09", "T11", "T13"]);
  assert.match(capture(() => main(["rules"], repo)).stdout, /● T01/);
});

test("未知命令和缺少参数都返回 2", () => {
  assert.equal(capture(() => main(["bogus"], repo)).code, 2);
  assert.equal(capture(() => main(["lint"], repo)).code, 2);
  assert.equal(capture(() => main(["fonts"], repo)).code, 2);
  assert.equal(existsSync(join(repo, "r.json")), false);
});

test("样式解析失败、选择器不支持时，结果里如实记录，不静默吞掉", () => {
  const d = ws();
  try {
    writeFileSync(join(d, "p.html"), `<!doctype html><html lang="zh-CN"><head><style>p { color: red; </style><style>p:nth-child(2n of .x) { line-height: 1 }</style></head><body><p>中文</p></body></html>`);
    const r = JSON.parse(capture(() => main(["lint", "p.html", "--format", "json"], d)).stdout);
    assert.ok(r.run.sheet_errors.length >= 1, "未闭合的样式应记录为解析错误");
    assert.ok(Array.isArray(r.run.unsupported_selectors));
  } finally {
    rmSync(d, { recursive: true, force: true });
  }
});
