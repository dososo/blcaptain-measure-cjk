// W2 card 命令（小红书 3:4 卡片导出）的测试：在实现之前写好并锁定。
// 夹具在 test/fixtures/w2-card/；字体在临时目录里用代码生成（方框字体，用户拍板 D-C5），仓库里不放字体文件。
import { test } from "node:test";
import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import * as measure from "../packages/cli/dist/index.js";
import { makeTtf, toTtc, toWoff, toWoff2 } from "./helpers/font.js";

const repo = join(dirname(fileURLToPath(import.meta.url)), "..");
const fixtures = join(repo, "test", "fixtures", "w2-card");
const EXPECT = JSON.parse(readFileSync(join(fixtures, "expect.json"), "utf8"));
const BIN = join(repo, "packages", "cli", "bin", "measure-cjk.js");
const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const { runCard, parseFontFile } = measure;

// 页面上显示的全部字符（去掉 head、style、script、标签），用来生成「覆盖全部字符」的方框字体
function pageChars(html) {
  const body = html.replace(/<head[\s\S]*?<\/head>/i, "").replace(/<(style|script)[\s\S]*?<\/\1>/gi, "").replace(/<[^>]+>/g, "");
  return [...new Set([...body].filter((c) => c.trim()))].join("") + " ";
}

function workspace(files) {
  const base = mkdtempSync(join(tmpdir(), "measure-card-"));
  const ws = join(base, "ws");
  mkdirSync(join(ws, "fonts"), { recursive: true });
  for (const [from, to] of files) cpSync(from, join(ws, to));
  return { base, ws, cleanup: () => rmSync(base, { recursive: true, force: true }) };
}

function pngSize(file) {
  const b = readFileSync(file);
  assert.deepEqual(b.subarray(0, 8), PNG, "不是 PNG");
  return { width: b.readUInt32BE(16), height: b.readUInt32BE(20) };
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

test("card 和字体解析的接口存在", () => {
  assert.equal(typeof runCard, "function", "缺少 runCard");
  assert.equal(typeof parseFontFile, "function", "缺少 parseFontFile");
});

// ---------- 字体文件解析（name 表） ----------

test("字体解析：TTF、OTF 头、WOFF、WOFF2、TTC 都能读出家族名、全名、PostScript 名和本地化名", () => {
  assert.equal(typeof parseFontFile, "function");
  const ttf = makeTtf({ family: "Noto Sans SC", chars: "中文", localizedFamily: "思源黑体", typographicFamily: "Noto Sans SC" });
  for (const [label, buf] of [["ttf", ttf], ["woff", toWoff(ttf)], ["woff2", toWoff2(ttf)], ["otf", makeTtf({ family: "Noto Sans SC", chars: "中文", sfntVersion: 0x4f54544f })]]) {
    const r = parseFontFile(buf);
    assert.equal(r.error, undefined, `${label}：${r.error}`);
    assert.equal(r.faces.length, 1, label);
    const names = r.faces[0].names;
    assert.ok(names.includes("Noto Sans SC"), `${label}：${JSON.stringify(r.faces[0])}`);
    assert.ok(r.faces[0].postscript === "NotoSansSC-Regular", `${label}：${r.faces[0].postscript}`);
    if (label !== "otf") assert.ok(names.includes("思源黑体"), `${label} 缺少本地化名：${JSON.stringify(names)}`);
  }
  const ttc = parseFontFile(toTtc([makeTtf({ family: "MiSans", chars: "中" }), makeTtf({ family: "Noto Serif SC", chars: "中" })]));
  assert.deepEqual(ttc.faces.map((f) => f.names[0]).sort(), ["MiSans", "Noto Serif SC"]);
});

test("字体解析：截断、乱码、空文件都返回 error，不抛异常", () => {
  const ttf = makeTtf({ family: "Noto Sans SC", chars: "中" });
  for (const buf of [Buffer.alloc(0), Buffer.from("not a font at all"), ttf.subarray(0, 40), toWoff2(ttf).subarray(0, 60)]) {
    const r = parseFontFile(buf);
    assert.equal(typeof r.error, "string");
    assert.equal(r.faces.length, 0);
  }
});

// ---------- 夹具：放行、拒绝、署名、回退、拦截、lint ----------

for (const name of Object.keys(EXPECT)) {
  const e = EXPECT[name];
  test(`card 夹具 ${name}：${e.status}`, async () => {
    const html = readFileSync(join(fixtures, `${name}.html`), "utf8");
    const w = workspace([[join(fixtures, `${name}.html`), `${name}.html`]]);
    try {
      const chars = pageChars(html);
      if (e.font) {
        const cover = e.font.cover === "all" ? chars : [...chars].slice(0, 4).join("");
        writeFileSync(join(w.ws, "fonts", "font.ttf"), makeTtf({ family: e.font.family, chars: cover }));
      }
      if (e.own_font_file) writeFileSync(join(w.ws, e.own_font_file), makeTtf({ family: "Noto Sans SC", chars }));
      const r = await runCard({ input: `${name}.html`, root: w.ws, cwd: w.ws, fontDir: "fonts", out: "card.png" });
      const show = JSON.stringify({ status: r.status, fonts: r.fonts?.map((f) => [f.family, f.source, f.allowed, f.reason?.slice(0, 60)]), blocked: r.blocked, lint: r.lint?.findings?.filter((f) => f.severity === "error").map((f) => f.rule) });
      assert.equal(r.status, e.status, show);
      assert.deepEqual(r.size, { width: 1080, height: 1440 });
      if (e.status === "exported") {
        assert.equal(r.output, "card.png");
        assert.deepEqual(pngSize(join(w.ws, "card.png")), { width: 1080, height: 1440 });
        assert.ok(r.fonts.length > 0 && r.fonts.every((f) => f.allowed), show);
        assert.equal(r.lint.summary.errors, 0, show);
      } else {
        assert.equal(r.output, undefined);
        assert.ok(!existsSync(join(w.ws, "card.png")), "拒绝时不能写 PNG（D-C2）");
      }
      if (e.attribution) assert.deepEqual(r.attribution.map((a) => a.family), e.attribution, show);
      if (e.rejected_font) {
        const f = r.fonts.find((x) => x.family === e.rejected_font || x.names?.includes(e.rejected_font));
        assert.ok(f && !f.allowed, `${e.rejected_font} 应列为不放行：${show}`);
        if (e.reason_has) assert.ok(f.reason.includes(e.reason_has), `原因应包含「${e.reason_has}」：${f.reason}`);
      }
      if (e.system_fallback) assert.ok(r.fonts.some((f) => f.source === "system" && !f.allowed), `应查出回退的系统字体：${show}`);
      if (e.blocked_font) assert.ok(r.blocked.some((b) => b.includes(e.blocked_font)), `应拦截 ${e.blocked_font}：${show}`);
      if (e.lint_errors) for (const rule of e.lint_errors) assert.ok(r.lint.findings.some((f) => f.rule === rule && f.severity === "error"), show);
    } finally {
      w.cleanup();
    }
  });
}

// ---------- 3 种模板和 AC-9 的示例卡片 ----------

const TEMPLATES = [
  ["skills/measure/assets/cards/cover.html", "cover.html"],
  ["skills/measure/assets/cards/list.html", "list.html"],
  ["skills/measure/assets/cards/quote.html", "quote.html"],
  ["examples/card.html", "card.html"]
];

for (const [from, to] of TEMPLATES) {
  test(`模板 ${from}：用霞鹜文楷（方框字体）导出 1080×1440，lint 零 error（AC-9）`, async () => {
    assert.ok(existsSync(join(repo, from)), `缺少模板 ${from}`);
    const html = readFileSync(join(repo, from), "utf8");
    assert.doesNotMatch(html, /(linear|radial|conic)-gradient\([^)]*(#(7c3aed|764ba2|6366f1|8b5cf6))/i, "模板不能用紫色渐变（dososo-design-system）");
    assert.doesNotMatch(html, /backdrop-filter/i, "模板不能用玻璃拟态");
    const w = workspace([[join(repo, from), to]]);
    try {
      writeFileSync(join(w.ws, "fonts", "wenkai.ttf"), makeTtf({ family: "LXGW WenKai", localizedFamily: "霞鹜文楷", chars: pageChars(html) }));
      const r = await runCard({ input: to, root: w.ws, cwd: w.ws, fontDir: "fonts", out: "out.png" });
      assert.equal(r.status, "exported", JSON.stringify({ fonts: r.fonts, lint: r.lint?.findings?.map((f) => [f.rule, f.severity, f.message.slice(0, 40)]) }));
      assert.deepEqual(pngSize(join(w.ws, "out.png")), { width: 1080, height: 1440 });
      assert.equal(r.lint.summary.errors, 0);
    } finally {
      w.cleanup();
    }
  });
}

// ---------- 字体格式：WOFF2 和 TTC 也能注入 ----------

test("font_dir 里的 WOFF2 字体同样能加载并放行", async () => {
  const html = readFileSync(join(fixtures, "K-pass.html"), "utf8");
  const w = workspace([[join(fixtures, "K-pass.html"), "K-pass.html"]]);
  try {
    writeFileSync(join(w.ws, "fonts", "font.woff2"), toWoff2(makeTtf({ family: "Noto Sans SC", chars: pageChars(html) })));
    const r = await runCard({ input: "K-pass.html", root: w.ws, cwd: w.ws, fontDir: "fonts", out: "card.png" });
    assert.equal(r.status, "exported", JSON.stringify(r.fonts));
  } finally {
    w.cleanup();
  }
});

// ---------- 命令行、结果文件、安全 ----------

test("命令行：card <html> --out --font-dir --result；导出时退出码 0，拒绝时退出码 1，结果 JSON 带 schema_version", async () => {
  const html = readFileSync(join(fixtures, "K-pass.html"), "utf8");
  const w = workspace([[join(fixtures, "K-pass.html"), "K-pass.html"], [join(fixtures, "K-red.html"), "K-red.html"]]);
  try {
    writeFileSync(join(w.ws, "fonts", "a.ttf"), makeTtf({ family: "Noto Sans SC", chars: pageChars(html) }));
    writeFileSync(join(w.ws, "fonts", "b.ttf"), makeTtf({ family: "方正兰亭黑", chars: pageChars(html) }));
    const ok = await cli(["card", "K-pass.html", "--out", "a.png", "--font-dir", "fonts", "--result", "a.json"], w.ws);
    assert.equal(ok.code, 0, ok.stderr);
    const j = JSON.parse(readFileSync(join(w.ws, "a.json"), "utf8"));
    assert.equal(typeof j.schema_version, "string");
    assert.equal(j.status, "exported");
    const bad = await cli(["card", "K-red.html", "--out", "b.png", "--font-dir", "fonts", "--format", "json"], w.ws);
    assert.equal(bad.code, 1, bad.stderr);
    assert.equal(JSON.parse(bad.stdout).status, "rejected");
    assert.ok(!existsSync(join(w.ws, "b.png")));
  } finally {
    w.cleanup();
  }
});

test("安全：font_dir 在工作区外或是符号链接、--out 不是 .png、--out 指向已有的非 PNG 文件或工作区外 → 退出码 2，不写任何文件", async () => {
  const w = workspace([[join(fixtures, "K-pass.html"), "K-pass.html"]]);
  try {
    mkdirSync(join(w.base, "outside-fonts"));
    symlinkSync(join(w.base, "outside-fonts"), join(w.ws, "linked-fonts"));
    writeFileSync(join(w.ws, "notes.png"), "这不是 PNG");
    const cases = [
      ["card", "K-pass.html", "--out", "x.png", "--font-dir", join(w.base, "outside-fonts")],
      ["card", "K-pass.html", "--out", "x.png", "--font-dir", "linked-fonts"],
      ["card", "K-pass.html", "--out", "x.jpg", "--font-dir", "fonts"],
      ["card", "K-pass.html", "--out", "notes.png", "--font-dir", "fonts"],
      ["card", "K-pass.html", "--out", join(w.base, "x.png"), "--font-dir", "fonts"]
    ];
    for (const args of cases) {
      const r = await cli(args, w.ws);
      assert.equal(r.code, 2, `${args.join(" ")}：${r.stderr}`);
    }
    assert.ok(!existsSync(join(w.ws, "x.png")) && !existsSync(join(w.base, "x.png")));
    assert.equal(readFileSync(join(w.ws, "notes.png"), "utf8"), "这不是 PNG");
  } finally {
    w.cleanup();
  }
});

test("D-C3：超过 64 MB 的字体文件跳过并记录；超过 50 个字体文件 → 退出码 2", async () => {
  const html = readFileSync(join(fixtures, "K-pass.html"), "utf8");
  const w = workspace([[join(fixtures, "K-pass.html"), "K-pass.html"]]);
  try {
    const font = makeTtf({ family: "Noto Sans SC", chars: pageChars(html) });
    writeFileSync(join(w.ws, "fonts", "big.ttf"), Buffer.concat([font, Buffer.alloc(64 * 1024 * 1024 + 1 - font.length)]));
    const r = await runCard({ input: "K-pass.html", root: w.ws, cwd: w.ws, fontDir: "fonts", out: "card.png" });
    assert.ok(r.skipped_fonts.some((s) => s.file.endsWith("big.ttf") && s.reason === "too-large"), JSON.stringify(r.skipped_fonts));
    assert.equal(r.status, "rejected"); // 字体没加载，回退到系统字体
    rmSync(join(w.ws, "fonts", "big.ttf"));
    for (let i = 0; i < 51; i++) writeFileSync(join(w.ws, "fonts", `f${i}.ttf`), font);
    const many = await cli(["card", "K-pass.html", "--out", "card.png", "--font-dir", "fonts"], w.ws);
    assert.equal(many.code, 2, many.stderr);
  } finally {
    w.cleanup();
  }
});

test("没有安装 Playwright 时 card 退出码 2，并给出安装提示", () => {
  const base = mkdtempSync(join(tmpdir(), "measure-card-nopw-"));
  try {
    const pkg = join(base, "pkg");
    for (const d of ["bin", "dist", "assets", "data"]) cpSync(join(repo, "packages", "cli", d), join(pkg, d), { recursive: true });
    cpSync(join(repo, "packages", "cli", "package.json"), join(pkg, "package.json"));
    mkdirSync(join(pkg, "node_modules"));
    for (const m of readdirSync(join(repo, "node_modules"))) {
      if (m.startsWith(".") || m === "playwright" || m === "playwright-core" || m === "measure-cjk") continue;
      symlinkSync(join(repo, "node_modules", m), join(pkg, "node_modules", m));
    }
    cpSync(join(fixtures, "K-pass.html"), join(base, "K-pass.html"));
    mkdirSync(join(base, "fonts"));
    const r = spawnSync(process.execPath, [join(pkg, "bin", "measure-cjk.js"), "card", "K-pass.html", "--out", "card.png", "--font-dir", "fonts"], { cwd: base, encoding: "utf8" });
    assert.equal(r.status, 2, r.stderr);
    assert.match(r.stderr, /playwright/i);
  } finally {
    rmSync(base, { recursive: true, force: true });
  }
});
