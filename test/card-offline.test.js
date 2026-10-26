// card 命令在 Node 一侧也不能联网：把网络入口换成「一调用就抛错并计数」，导出一张卡片，外发请求数必须为 0。
import { test } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import https from "node:https";
import net from "node:net";
import tls from "node:tls";
import dns from "node:dns";
import { syncBuiltinESMExports } from "node:module";
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { makeTtf } from "./helpers/font.js";

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

const measure = await import("../packages/cli/dist/index.js");

test("card 导出一张卡片：Node 一侧外发请求数为 0", async () => {
  assert.equal(typeof measure.runCard, "function", "缺少 runCard");
  const base = mkdtempSync(join(tmpdir(), "measure-card-offline-"));
  const ws = join(base, "ws");
  mkdirSync(join(ws, "fonts"), { recursive: true });
  try {
    const html = readFileSync(join(repo, "test", "fixtures", "w2-card", "K-pass.html"), "utf8");
    cpSync(join(repo, "test", "fixtures", "w2-card", "K-pass.html"), join(ws, "K-pass.html"));
    const body = html.replace(/<head[\s\S]*?<\/head>/i, "").replace(/<[^>]+>/g, "");
    writeFileSync(join(ws, "fonts", "a.ttf"), makeTtf({ family: "Noto Sans SC", chars: [...new Set([...body].filter((c) => c.trim()))].join("") + " " }));
    const r = await measure.runCard({ input: "K-pass.html", root: ws, cwd: ws, fontDir: "fonts", out: "card.png" });
    assert.equal(r.status, "exported");
    assert.equal(attempts, 0);
  } finally {
    rmSync(base, { recursive: true, force: true });
  }
});
