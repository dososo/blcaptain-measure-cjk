// V-06（H5）：路径安全——工作区外的路径、symlink、超大文件、文件数上限、--out 越界
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, symlinkSync, rmSync, readdirSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runLint, main, UsageError } from "../packages/cli/dist/index.js";
import { capture } from "./helpers.js";

const PAGE = `<!doctype html><html lang="zh-CN"><head><style>body{font-family:"PingFang SC",sans-serif}</style></head><body><p>中文</p></body></html>`;
let base, ws, outside;

before(() => {
  base = mkdtempSync(join(tmpdir(), "measure-sec-"));
  ws = join(base, "ws");
  outside = join(base, "outside");
  mkdirSync(ws);
  mkdirSync(outside);
  writeFileSync(join(ws, "inside.html"), PAGE);
  writeFileSync(join(outside, "secret.html"), PAGE);
  symlinkSync(join(outside, "secret.html"), join(ws, "link-to-outside.html"));
  mkdirSync(join(ws, "dir"));
  writeFileSync(join(ws, "dir", "ok.html"), PAGE);
  symlinkSync(outside, join(ws, "dir", "linked-outside-dir"));
  writeFileSync(join(ws, "dir", "big.html"), PAGE + "<!--" + "x".repeat(5 * 1024 * 1024) + "-->");
  mkdirSync(join(ws, "many"));
  for (let i = 0; i < 2001; i++) writeFileSync(join(ws, "many", `f${i}.css`), "a{}");
  symlinkSync(join(outside, "r.json"), join(ws, "out-link.json"));
});

after(() => rmSync(base, { recursive: true, force: true }));

test("直接指向工作区外的 symlink 被拒绝", () => {
  assert.throws(() => runLint({ inputs: ["link-to-outside.html"], root: ws, cwd: ws }), (e) => e instanceof UsageError && /工作区之外/.test(e.message));
});

test("工作区外的绝对路径被拒绝", () => {
  assert.throws(() => runLint({ inputs: [join(outside, "secret.html")], root: ws, cwd: ws }), (e) => e instanceof UsageError);
});

test("相对路径用 .. 跳出工作区被拒绝", () => {
  assert.throws(() => runLint({ inputs: ["../outside/secret.html"], root: ws, cwd: ws }), (e) => e instanceof UsageError);
});

test("目录里指向工作区外的 symlink 被跳过并记录，超过 5 MB 的文件被跳过并记录", () => {
  const r = runLint({ inputs: ["dir"], root: ws, cwd: ws });
  assert.equal(r.summary.files, 1, "只应检查 ok.html");
  const reasons = Object.fromEntries(r.run.skipped_inputs.map((s) => [s.file, s.reason]));
  assert.equal(reasons["dir/linked-outside-dir"], "outside-root");
  assert.equal(reasons["dir/big.html"], "too-large");
});

test("超过 2000 个文件时报错（退出码 2）", () => {
  assert.throws(() => runLint({ inputs: ["many"], root: ws, cwd: ws }), (e) => e instanceof UsageError && /2000/.test(e.message));
  const { code } = capture(() => main(["lint", "many"], ws));
  assert.equal(code, 2);
});

test("--out 指向工作区外被拒绝（退出码 2），且不写任何文件", () => {
  const { code, stderr } = capture(() => main(["lint", "inside.html", "--out", "../outside/r.json"], ws));
  assert.equal(code, 2);
  assert.match(stderr, /工作区之外/);
  assert.equal(existsSync(join(outside, "r.json")), false);
});

test("--out 指向悬空的 symlink 被拒绝（退出码 2），不会跟随链接写到工作区外", () => {
  const { code, stderr } = capture(() => main(["lint", "inside.html", "--out", "out-link.json"], ws));
  assert.equal(code, 2);
  assert.match(stderr, /符号链接/);
  assert.equal(existsSync(join(outside, "r.json")), false);
});

test("--out 在工作区内：原子写入，不留临时文件", () => {
  const { code } = capture(() => main(["lint", "inside.html", "--out", "result.json"], ws));
  assert.notEqual(code, 2, "不应是用法错误");
  assert.ok(existsSync(join(ws, "result.json")));
  assert.equal(readdirSync(ws).filter((f) => f.endsWith(".tmp")).length, 0);
});
