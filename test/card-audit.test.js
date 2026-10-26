// AUDIT_CARD 整改的回归测试：在整改之前写好并锁定（夹具在 test/fixtures/w2-card-audit/，MANIFEST.sha256 锁定）。
// 覆盖 CA-01–CA-07、CA-09–CA-11、CA-13；字体在临时目录里用代码生成（方框字体，D-C5），仓库里不放字体文件。
import { test } from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { brotliCompressSync } from "node:zlib";
import { cpSync, existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import * as measure from "../packages/cli/dist/index.js";
import { makeTtf } from "./helpers/font.js";

const repo = join(dirname(fileURLToPath(import.meta.url)), "..");
const fixtures = join(repo, "test", "fixtures", "w2-card-audit");
const EXPECT = JSON.parse(readFileSync(join(fixtures, "expect.json"), "utf8"));
const BIN = join(repo, "packages", "cli", "bin", "measure-cjk.js");
const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const { runCard, parseFontFile } = measure;

// 源码里的全部可见字符（含 CSS、属性、脚本里的字）：方框字体覆盖它们，被拒绝就只能是因为点名用了别的字体
const allChars = (html, exclude = "") => [...new Set([...html].filter((c) => c.trim() && !exclude.includes(c)))].join("") + " ";

function workspace() {
  const base = mkdtempSync(join(tmpdir(), "measure-card-audit-"));
  const ws = join(base, "ws");
  mkdirSync(join(ws, "fonts"), { recursive: true });
  return { base, ws, cleanup: () => rmSync(base, { recursive: true, force: true }) };
}

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

// 按 expect.json 准备工作区并导出；返回结果和 PNG（没导出时为 undefined）
async function runFixture(name) {
  const e = EXPECT[name];
  let html = readFileSync(join(fixtures, `${name}.html`), "utf8");
  const w = workspace();
  try {
    if (e.page_font) html = html.replaceAll("__FONT_B64__", makeTtf({ family: e.page_font.family, chars: allChars(html) }).toString("base64"));
    writeFileSync(join(w.ws, `${name}.html`), html);
    for (const f of e.copy ?? []) cpSync(join(fixtures, f), join(w.ws, f));
    if (e.font) writeFileSync(join(w.ws, "fonts", e.font.file ?? "font.ttf"), makeTtf({ family: e.font.family, chars: allChars(html, e.font.exclude) }));
    const r = await runCard({ input: `${name}.html`, root: w.ws, cwd: w.ws, fontDir: "fonts", out: "card.png" });
    const png = existsSync(join(w.ws, "card.png")) ? readFileSync(join(w.ws, "card.png")) : undefined;
    return { r, png };
  } finally {
    w.cleanup();
  }
}

for (const name of Object.keys(EXPECT)) {
  const e = EXPECT[name];
  test(`AUDIT_CARD 夹具 ${name}：${e.status ?? e.status_in.join(" / ")}`, async () => {
    const { r, png } = await runFixture(name);
    const show = JSON.stringify({ status: r.status, fonts: r.fonts?.map((f) => [f.family, f.source, f.used, f.requested, f.allowed, f.reason?.slice(0, 50)]), problems: r.problems, lint: r.lint?.findings?.filter((f) => f.severity === "error").map((f) => f.rule) });
    if (e.status) assert.equal(r.status, e.status, show);
    else assert.ok(e.status_in.includes(r.status), show);
    if (r.status === "exported") {
      assert.ok(png && png.subarray(0, 8).equals(PNG), "导出时必须写出 PNG");
      assert.ok(r.fonts.filter((f) => f.used).every((f) => f.allowed), show);
      assert.equal(r.lint.summary.errors, 0, show);
    } else {
      assert.equal(png, undefined, `没导出时不能写 PNG（D-C2）：${show}`);
      assert.equal(r.output, undefined);
      assert.ok(r.problems.length > 0, `没导出时 problems 必须写明原因（CA-09）：${show}`);
    }
    if (e.bad_used) assert.ok(r.fonts.some((f) => f.used && !f.allowed), `应查出实际用到、但不允许出图的字体：${show}`);
    if (e.page_font_source) assert.ok(r.fonts.some((f) => f.source === "page" && !f.allowed), `应查出页面自带的字体（source: page）：${show}`);
    if (e.requested_font) {
      const f = r.fonts.find((x) => x.family === e.requested_font || x.names?.includes(e.requested_font));
      assert.ok(f && f.requested && !f.allowed, `${e.requested_font} 应列为点名要用、不允许出图：${show}`);
    }
    if (e.reason_has) assert.ok(r.fonts.some((f) => !f.allowed && f.reason.includes(e.reason_has)), `原因应包含「${e.reason_has}」：${show}`);
    if (e.lint_error) assert.ok(r.lint.summary.errors > 0, `卡片 lint 应有 error：${show}`);
    if (e.problems_has) assert.ok(r.problems.some((p) => p.includes(e.problems_has)), `problems 应包含「${e.problems_has}」：${show}`);
    if (e.same_png_as) {
      const control = await runFixture(e.same_png_as);
      assert.ok(control.png, "对照组没有导出");
      assert.ok(png.equals(control.png), "导出的 PNG 和对照组不同：截图时的画面不是检查时的画面（CA-02）");
    }
  });
}

// ---------- CA-07：安全检查逐条断言原因 ----------

test("安全：每一种拒绝都给出对应的原因（CA-07），不写任何文件", async () => {
  const w = workspace();
  try {
    const html = readFileSync(join(fixtures, "C00-control.html"), "utf8");
    writeFileSync(join(w.ws, "c.html"), html);
    // 能导出的字体：「不覆盖已有文件」的断言只有在本来会导出时才有意义
    writeFileSync(join(w.ws, "fonts", "font.ttf"), makeTtf({ family: "LXGW WenKai", chars: allChars(html) }));
    mkdirSync(join(w.base, "outside-fonts"));
    symlinkSync(join(w.base, "outside-fonts"), join(w.ws, "linked-out"));
    symlinkSync(join(w.ws, "fonts"), join(w.ws, "linked-in"));
    writeFileSync(join(w.ws, "notes.png"), "这不是 PNG");
    const ok = await cli(["card", "c.html", "--out", "ok.png", "--font-dir", "fonts"], w.ws);
    assert.equal(ok.code, 0, `对照：这张卡片本来能导出：${ok.stderr}${ok.stdout}`);
    const cases = [
      [["--out", "x.png", "--font-dir", join(w.base, "outside-fonts")], /font_dir 必须在工作区之内/],
      [["--out", "x.png", "--font-dir", "linked-out"], /font_dir 是符号链接/],
      [["--out", "x.png", "--font-dir", "linked-in"], /font_dir 是符号链接/],
      [["--out", "x.jpg", "--font-dir", "fonts"], /只能是 \.png/],
      [["--out", "notes.png", "--font-dir", "fonts"], /不是 PNG，已拒绝覆盖/],
      [["--out", join(w.base, "x.png"), "--font-dir", "fonts"], /输出路径在工作区之外/]
    ];
    for (const [args, reason] of cases) {
      const r = await cli(["card", "c.html", ...args], w.ws);
      assert.equal(r.code, 2, `${args.join(" ")}：${r.stderr}`);
      assert.match(r.stderr, reason, `${args.join(" ")} 的原因不对：${r.stderr}`);
    }
    assert.ok(!existsSync(join(w.ws, "x.png")) && !existsSync(join(w.ws, "x.jpg")) && !existsSync(join(w.base, "x.png")));
    assert.equal(readFileSync(join(w.ws, "notes.png"), "utf8"), "这不是 PNG");
  } finally {
    w.cleanup();
  }
});

// ---------- CA-10：lint 截图的位置可以指定，并写进结果 ----------

test("card --evidence：卡片 lint 的截图写进指定目录，结果里记录这个目录（CA-10）", async () => {
  const w = workspace();
  try {
    const html = readFileSync(join(fixtures, "C25-media-portrait.html"), "utf8");
    writeFileSync(join(w.ws, "c.html"), html);
    writeFileSync(join(w.ws, "fonts", "font.ttf"), makeTtf({ family: "LXGW WenKai", chars: allChars(html) }));
    const r = await cli(["card", "c.html", "--out", "c.png", "--font-dir", "fonts", "--evidence", "shots", "--format", "json"], w.ws);
    assert.equal(r.code, 1, r.stderr);
    const j = JSON.parse(r.stdout);
    assert.equal(j.lint.run.render.evidence_dir, "shots");
    assert.ok(existsSync(join(w.ws, "shots")) && readdirSync(join(w.ws, "shots")).some((f) => f.endsWith(".png")), "截图应写进 shots/");
    assert.ok(!existsSync(join(w.ws, "evidence")), "指定了 --evidence 时不能再写默认目录");
  } finally {
    w.cleanup();
  }
});

// ---------- CA-11：配置文件里的 font_dir 相对配置文件所在目录 ----------

test("配置文件里的 font_dir 按配置文件所在目录解析，不按当前目录（CA-11）", async () => {
  const w = workspace();
  try {
    const html = readFileSync(join(fixtures, "C00-control.html"), "utf8");
    writeFileSync(join(w.ws, "c.html"), html);
    writeFileSync(join(w.ws, "fonts", "font.ttf"), makeTtf({ family: "LXGW WenKai", chars: allChars(html) }));
    writeFileSync(join(w.ws, "measure.config.json"), JSON.stringify({ schema_version: "1.0.0", font_dir: "fonts" })); // RULING-09：锁定时漏写了 schema_version
    mkdirSync(join(w.ws, "sub"));
    const r = await cli(["card", "../c.html", "--out", "b.png", "--root", ".."], join(w.ws, "sub"));
    assert.equal(r.code, 0, r.stderr + r.stdout);
    assert.ok(existsSync(join(w.ws, "sub", "b.png")));
  } finally {
    w.cleanup();
  }
});

// ---------- CA-13：解压按需，不能被小文件撑到 256 MB ----------

function bombWoff2(claimed) {
  // 只有一张 name 表（未变换），目录里声称解压后有 claimed 字节；压缩数据是一大串 0
  const zeros = brotliCompressSync(Buffer.alloc(claimed));
  const b128 = (v) => {
    const out = [v & 0x7f];
    for (v = Math.floor(v / 128); v > 0; v = Math.floor(v / 128)) out.unshift((v & 0x7f) | 0x80);
    return Buffer.from(out);
  };
  const dir = Buffer.concat([Buffer.from([5]), b128(claimed)]);
  const header = Buffer.alloc(48);
  header.write("wOF2", 0, "latin1");
  header.writeUInt32BE(0x00010000, 4);
  header.writeUInt32BE(48 + dir.length + zeros.length, 8);
  header.writeUInt16BE(1, 12);
  header.writeUInt32BE(claimed + 12, 16);
  header.writeUInt32BE(zeros.length, 20);
  return Buffer.concat([header, dir, zeros]);
}

test("字体解析：WOFF2 解压后的大小和压缩数据极不相称时直接报错，不分配大块内存（CA-13）", () => {
  const buf = bombWoff2(32 * 1024 * 1024);
  assert.ok(buf.length < 64 * 1024, `测试用的文件应该很小：${buf.length}`);
  const before = process.memoryUsage().arrayBuffers;
  const t0 = Date.now();
  const r = parseFontFile(buf);
  const ms = Date.now() - t0;
  assert.equal(typeof r.error, "string");
  assert.equal(r.faces.length, 0);
  assert.ok(ms < 200, `解压炸弹应该很快报错：${ms} ms`);
  assert.ok(process.memoryUsage().arrayBuffers - before < 16 * 1024 * 1024, "不应为解压炸弹分配大块内存");
});
