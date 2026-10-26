// V-05（H4）：把所有网络入口替换成「一调用就抛错并计数」，跑完整的 lint / fonts / rules / init 流程，外发请求数必须为 0
import { test } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import https from "node:https";
import net from "node:net";
import tls from "node:tls";
import dns from "node:dns";
import { syncBuiltinESMExports } from "node:module";
import { readdirSync, readFileSync } from "node:fs";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { capture } from "./helpers.js";

const repo = join(dirname(fileURLToPath(import.meta.url)), "..");
let attempts = 0;
const trap = (name) => () => {
  attempts++;
  throw new Error(`离线测试：禁止网络调用 ${name}`);
};
globalThis.fetch = trap("fetch");
http.request = trap("http.request");
http.get = trap("http.get");
https.request = trap("https.request");
https.get = trap("https.get");
net.connect = trap("net.connect");
net.createConnection = trap("net.createConnection");
tls.connect = trap("tls.connect");
dns.lookup = trap("dns.lookup");
dns.resolve = trap("dns.resolve");
// A-10：让 `import { request } from "node:https"` 这类具名导入也拿到拦截后的函数
syncBuiltinESMExports();

const { main, runLint } = await import("../packages/cli/dist/index.js");

test("完整 lint 流程（golden + 夹具 + 含远程 <link> 的页面）不发任何网络请求", () => {
  const r1 = runLint({ inputs: ["bench/golden"], root: repo, cwd: repo });
  const r2 = runLint({ inputs: ["test/fixtures/bad"], root: repo, cwd: repo });
  assert.ok(r1.summary.files > 0 && r2.summary.files > 0);
  assert.equal(r1.run.network, "offline");
  assert.equal(attempts, 0);
});

test("CLI 各命令都不发网络请求", () => {
  const tmp = mkdtempSync(join(repo, "test", "tmp-offline-"));
  try {
    capture(() => main(["lint", "bench/golden", "--format", "json"], repo));
    capture(() => main(["fonts", "Noto Sans SC"], repo));
    capture(() => main(["rules"], repo));
    capture(() => main(["init"], tmp));
    assert.equal(attempts, 0);
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});

test("远程样式表只记录到 run.remote_refs，不去读取", () => {
  const tmp = mkdtempSync(join(repo, "test", "tmp-remote-"));
  try {
    const page = `<!doctype html><html lang="zh-CN"><head><link rel="stylesheet" href="https://fonts.example.com/css?family=X"></head><body><p>中文</p></body></html>`;
    writeFileSync(join(tmp, "p.html"), page);
    const r = runLint({ inputs: ["p.html"], root: tmp, cwd: tmp });
    assert.deepEqual(r.run.remote_refs, ["https://fonts.example.com/css?family=X"]);
    assert.equal(attempts, 0);
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});

test("A-10：源码和构建产物里没有任何网络或子进程模块的导入", () => {
  const banned = /from\s+["'](node:)?(http|https|http2|net|tls|dns|dgram|child_process|undici|worker_threads)["']|require\(["'](node:)?(http|https|http2|net|tls|dns|child_process|undici)["']\)|\bfetch\s*\(/;
  for (const d of ["packages/cli/src", "packages/cli/dist"]) {
    for (const f of readdirSync(join(repo, d))) {
      if (!/\.(ts|js)$/.test(f)) continue;
      assert.doesNotMatch(readFileSync(join(repo, d, f), "utf8"), banned, `${d}/${f}`);
    }
  }
});
