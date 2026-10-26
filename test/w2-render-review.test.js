// 完整档实现过程中发现的问题，补的回归测试（问题先修、后补测试，见 docs/verification/w2/render/VERIFICATION_REPORT.md §2.1）。
import { test } from "node:test";
import assert from "node:assert/strict";
import net from "node:net";
import { spawn } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const repo = join(dirname(fileURLToPath(import.meta.url)), "..");
const BIN = join(repo, "packages", "cli", "bin", "measure-cjk.js");
function cli(args, cwd) {
  return new Promise((ok) => {
    const p = spawn(process.execPath, [BIN, ...args], { cwd });
    const out = [];
    const err = [];
    p.stdout.on("data", (d) => out.push(d));
    p.stderr.on("data", (d) => err.push(d));
    p.on("close", (code) => ok({ code, stdout: Buffer.concat(out).toString("utf8"), stderr: Buffer.concat(err).toString("utf8") }));
  });
}

// 先占一个端口再释放，得到一个当前没有服务在监听的 localhost 端口
async function deadPort() {
  const s = net.createServer();
  await new Promise((ok) => s.listen(0, "127.0.0.1", ok));
  const port = s.address().port;
  await new Promise((ok) => s.close(ok));
  return port;
}

test("R-01：localhost 页面打不开时，结果是 incomplete、退出码 2，不能是 skipped / 0（伪成功）", async () => {
  const d = mkdtempSync(join(tmpdir(), "measure-render-dead-"));
  try {
    const port = await deadPort();
    const r = await cli(["lint", `http://127.0.0.1:${port}/`, "--render", "--widths", "1280", "--format", "json"], d);
    assert.equal(r.code, 2, r.stderr);
    const j = JSON.parse(r.stdout);
    assert.equal(j.summary.status, "incomplete");
    assert.ok(j.run.skipped_inputs.some((s) => s.reason === "unreadable"));
  } finally {
    rmSync(d, { recursive: true, force: true });
  }
});

test("R-02：localhost 的 127.0.0.1 写法能正常渲染（浏览器的 DNS 拦截规则没有误伤 IP 字面量）", async () => {
  const http = await import("node:http");
  const server = http.createServer((req, res) => {
    res.setHeader("content-type", "text/html; charset=utf-8");
    res.end(`<!doctype html><html lang="zh-CN"><body><p style="font-size:11px">很小的中文</p></body></html>`);
  });
  await new Promise((ok) => server.listen(0, "127.0.0.1", ok));
  const d = mkdtempSync(join(tmpdir(), "measure-render-ip-"));
  try {
    const r = await cli(["lint", `http://127.0.0.1:${server.address().port}/`, "--render", "--widths", "1280", "--format", "json"], d);
    const j = JSON.parse(r.stdout);
    assert.equal(j.run.skipped_inputs.length, 0, JSON.stringify(j.run));
    assert.ok(j.findings.some((f) => f.rule === "T11" && f.severity === "error"));
  } finally {
    rmSync(d, { recursive: true, force: true });
    server.close();
  }
});

// AUDIT_RENDER 整改时补的（写于实现之后）：RA-05 拦截「加载后跳转」时，不能误伤服务器正常的 HTTP 重定向
test("R-03：localhost 页面的 HTTP 302 重定向照常检查，不算「加载后跳转」", async () => {
  const http = await import("node:http");
  const server = http.createServer((req, res) => {
    if (req.url === "/") {
      res.statusCode = 302;
      res.setHeader("location", "/zh/");
      return res.end();
    }
    res.setHeader("content-type", "text/html; charset=utf-8");
    res.end(`<!doctype html><html lang="zh-CN"><body><p style="font-size:11px">很小的中文</p></body></html>`);
  });
  await new Promise((ok) => server.listen(0, "127.0.0.1", ok));
  const d = mkdtempSync(join(tmpdir(), "measure-render-302-"));
  try {
    const r = await cli(["lint", `http://127.0.0.1:${server.address().port}/`, "--render", "--widths", "1280", "--format", "json"], d);
    const j = JSON.parse(r.stdout);
    assert.equal(j.summary.status, "fail", JSON.stringify(j.run.render.problems));
    assert.deepEqual(j.run.render.problems, []);
    assert.ok(j.findings.some((f) => f.rule === "T11" && f.severity === "error"));
  } finally {
    rmSync(d, { recursive: true, force: true });
    server.close();
  }
});
