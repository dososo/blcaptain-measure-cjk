// 完整档的 Node 一侧也不能联网：把网络入口换成「一调用就抛错并计数」，跑一次 --render，外发请求数必须为 0。
// 浏览器一侧的拦截由 w2-render.test.js 的「网络拦截」两个测试覆盖。
import { test } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import https from "node:https";
import net from "node:net";
import tls from "node:tls";
import dns from "node:dns";
import { syncBuiltinESMExports } from "node:module";
import { cpSync, mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

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
syncBuiltinESMExports();

const { runRender } = await import("../packages/cli/dist/index.js");

test("--render 跑合格页面和网络拦截页面：Node 一侧外发请求数为 0", async () => {
  const base = mkdtempSync(join(tmpdir(), "measure-render-offline-"));
  const ws = join(base, "ws");
  mkdirSync(ws);
  try {
    for (const n of ["R-pos-baseline", "R-net-block"]) cpSync(join(repo, "test", "fixtures", "w2-render", `${n}.html`), join(ws, `${n}.html`));
    const r = await runRender({ inputs: ["."], root: ws, cwd: ws, widths: [390, 1280], evidenceDir: join(ws, "evidence") });
    assert.equal(r.summary.files, 2);
    assert.equal(attempts, 0);
  } finally {
    rmSync(base, { recursive: true, force: true });
  }
});
