// iter2：针对独立审计 AUDIT_iter1 的 CLI、路径安全、退出码类发现（A-03/04/07/08/09/16/22/26/27）
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, symlinkSync, rmSync, existsSync, readFileSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { main, runLint } from "../packages/cli/dist/index.js";
import { atomicWrite } from "../packages/cli/dist/fsafe.js";
import { capture } from "./helpers.js";

const GOOD = `<!doctype html><html lang="zh-CN"><head><style>
:where(:root:lang(zh)) { line-break: strict; } @supports (text-autospace: normal) { :where(:lang(zh)) { text-autospace: normal; } }
body { font-family: "PingFang SC", sans-serif; font-size: 16px; } p { line-height: 1.75; }</style></head><body><p>中文</p></body></html>`;

function sandbox() {
  const base = mkdtempSync(join(tmpdir(), "measure-iter2-"));
  const ws = join(base, "ws");
  const outside = join(base, "outside");
  mkdirSync(ws);
  mkdirSync(outside);
  writeFileSync(join(ws, "p.html"), GOOD);
  return { base, ws, outside, done: () => rmSync(base, { recursive: true, force: true }) };
}

test("A-03：默认配置是指向工作区外的 symlink → 退出码 2，不读取、不回显外部内容", () => {
  const s = sandbox();
  try {
    writeFileSync(join(s.outside, "secret.txt"), "SECRET_TOKEN_123");
    symlinkSync(join(s.outside, "secret.txt"), join(s.ws, "measure.config.json"));
    const r = capture(() => main(["lint", "p.html"], s.ws));
    assert.equal(r.code, 2);
    assert.doesNotMatch(r.stderr + r.stdout, /SECRET/);
  } finally {
    s.done();
  }
});

test("A-03：配置文件不是合法 JSON 时，报错不回显文件内容", () => {
  const s = sandbox();
  try {
    writeFileSync(join(s.ws, "measure.config.json"), "SECRET_TOKEN_123 not json");
    const r = capture(() => main(["lint", "p.html"], s.ws));
    assert.equal(r.code, 2);
    assert.doesNotMatch(r.stderr, /SECRET/);
  } finally {
    s.done();
  }
});

test("A-04：只传 .css 文件且有 F03 error → 退出码 1，status 为 fail", () => {
  const s = sandbox();
  try {
    writeFileSync(join(s.ws, "f.css"), `@font-face { font-family: "方正兰亭黑"; src: url("fonts/FZLTH.woff2"); }`);
    const r = capture(() => main(["lint", "f.css", "--format", "json"], s.ws));
    assert.equal(r.code, 1);
    assert.equal(JSON.parse(r.stdout).summary.status, "fail");
  } finally {
    s.done();
  }
});

test("A-07：--root 传绝对路径可以正常工作", () => {
  const s = sandbox();
  try {
    const r = capture(() => main(["lint", join(s.ws, "p.html"), "--root", s.ws], s.base));
    assert.notEqual(r.code, 2, r.stderr);
  } finally {
    s.done();
  }
});

test("A-08：阈值低于下限 → 退出码 2；偏离默认值的阈值写进结果", () => {
  const s = sandbox();
  try {
    writeFileSync(join(s.ws, "low.json"), JSON.stringify({ schema_version: "1.0.0", thresholds: { body_line_height_min: 0 } }));
    assert.equal(capture(() => main(["lint", "p.html", "--config", "low.json"], s.ws)).code, 2);
    writeFileSync(join(s.ws, "ok.json"), JSON.stringify({ schema_version: "1.0.0", thresholds: { body_line_height_min: 1.6 } }));
    const r = JSON.parse(capture(() => main(["lint", "p.html", "--config", "ok.json", "--format", "json"], s.ws)).stdout);
    assert.deepEqual(r.run.threshold_overrides, { body_line_height_min: 1.6 });
  } finally {
    s.done();
  }
});

test("A-09：init 遇到悬空 symlink → 退出码 2，不在工作区外写文件", () => {
  const s = sandbox();
  try {
    symlinkSync(join(s.outside, "pwn.css"), join(s.ws, "measure.css"));
    symlinkSync(join(s.outside, "pwn.json"), join(s.ws, "measure.config.json"));
    const r = capture(() => main(["init"], s.ws));
    assert.equal(r.code, 2);
    assert.deepEqual(readdirSync(s.outside), []);
  } finally {
    s.done();
  }
});

test("A-16：显式传入不支持的文件类型 → 退出码 2；空目录 → 退出码 0 并给出提示", () => {
  const s = sandbox();
  try {
    writeFileSync(join(s.ws, "App.jsx"), "export default () => <p>中文</p>;");
    assert.equal(capture(() => main(["lint", "App.jsx"], s.ws)).code, 2);
    mkdirSync(join(s.ws, "empty"));
    const r = capture(() => main(["lint", "empty"], s.ws));
    assert.equal(r.code, 0);
    assert.match(r.stdout, /没有可检查的文件/);
  } finally {
    s.done();
  }
});

test("A-26：--out 指向输入文件、.git 目录、已有目录 → 退出码 2，且不输出堆栈", () => {
  const s = sandbox();
  try {
    mkdirSync(join(s.ws, ".git"));
    mkdirSync(join(s.ws, "outdir"));
    for (const out of ["p.html", ".git/r.json", "outdir"]) {
      const r = capture(() => main(["lint", "p.html", "--out", out], s.ws));
      assert.equal(r.code, 2, out);
      assert.doesNotMatch(r.stderr, /\n\s+at /, `不应输出堆栈：${out}`);
    }
    assert.equal(readFileSync(join(s.ws, "p.html"), "utf8"), GOOD);
  } finally {
    s.done();
  }
});

test("A-27：skipped_inputs 不重复", () => {
  const s = sandbox();
  try {
    writeFileSync(join(s.outside, "x.css"), "p{}");
    writeFileSync(join(s.ws, "a.html"), GOOD.replace("<head>", `<head><link rel="stylesheet" href="../outside/x.css">`));
    writeFileSync(join(s.ws, "b.html"), GOOD.replace("<head>", `<head><link rel="stylesheet" href="../outside/x.css">`));
    const r = runLint({ inputs: ["a.html", "b.html"], root: s.ws, cwd: s.ws });
    const keys = r.run.skipped_inputs.map((x) => `${x.file}|${x.reason}`);
    assert.equal(new Set(keys).size, keys.length);
  } finally {
    s.done();
  }
});

test("A-22：atomicWrite 在 rename 失败时清理临时文件、保留原状", () => {
  const s = sandbox();
  try {
    mkdirSync(join(s.ws, "target"));
    assert.throws(() => atomicWrite(join(s.ws, "target"), "x"));
    assert.deepEqual(readdirSync(s.ws).filter((f) => f.endsWith(".tmp")), []);
  } finally {
    s.done();
  }
});

test("A-22：无法解析的选择器如实记录在 unsupported_selectors", () => {
  const s = sandbox();
  try {
    writeFileSync(join(s.ws, "u.html"), GOOD.replace("</style>", "p:unknownpseudo { line-height: 1 }</style>"));
    const r = runLint({ inputs: ["u.html"], root: s.ws, cwd: s.ws });
    assert.ok(r.run.unsupported_selectors.some((x) => x.includes("p:unknownpseudo")));
  } finally {
    s.done();
  }
});
