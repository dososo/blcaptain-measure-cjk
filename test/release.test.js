// AUDIT_RELEASE 的回归测试（RA-01、RA-02、RA-03）：在整改之前写好并锁定。
import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { cpSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const repo = join(dirname(fileURLToPath(import.meta.url)), "..");

// 模拟「全局安装 measure-cjk」：包单独放在一处，它自己的 node_modules 里没有 playwright；
// 用户的项目在另一处，Playwright 只装在项目里（README 和报错提示教用户这样装）
function splitInstall() {
  const base = mkdtempSync(join(tmpdir(), "measure-release-"));
  const pkg = join(base, "global", "measure-cjk");
  for (const d of ["bin", "dist", "assets", "data"]) cpSync(join(repo, "packages", "cli", d), join(pkg, d), { recursive: true });
  cpSync(join(repo, "packages", "cli", "package.json"), join(pkg, "package.json"));
  mkdirSync(join(pkg, "node_modules"));
  for (const m of readdirSync(join(repo, "node_modules"))) {
    if (m.startsWith(".") || m === "playwright" || m === "playwright-core" || m === "measure-cjk") continue;
    symlinkSync(join(repo, "node_modules", m), join(pkg, "node_modules", m));
  }
  const proj = join(base, "proj");
  mkdirSync(join(proj, "node_modules"), { recursive: true });
  writeFileSync(join(proj, "package.json"), JSON.stringify({ name: "proj", private: true }));
  writeFileSync(join(proj, "page.html"), '<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><title>t</title><style>:where(:lang(zh)){line-break:strict;text-autospace:normal}body{font-family:"Noto Sans SC",sans-serif;font-size:17px}p{line-height:1.8;max-width:36em}</style></head><body><p>中文页面的排版检查，看浏览器实测能不能跑起来。</p></body></html>');
  return { base, pkg, proj, cleanup: () => rmSync(base, { recursive: true, force: true }) };
}

test("RA-01：measure-cjk 和 Playwright 分开安装（Playwright 只在项目里）时，从项目目录运行 --render 能用", () => {
  const w = splitInstall();
  try {
    symlinkSync(join(repo, "node_modules", "playwright-core"), join(w.proj, "node_modules", "playwright-core"));
    const r = spawnSync(process.execPath, [join(w.pkg, "bin", "measure-cjk.js"), "lint", "page.html", "--render", "--format", "json", "--evidence", "ev"], { cwd: w.proj, encoding: "utf8", timeout: 120000 });
    assert.notEqual(r.status, 2, `退出码 2：${r.stderr}`);
    const j = JSON.parse(r.stdout);
    assert.equal(j.run.mode, "render");
  } finally {
    w.cleanup();
  }
});

test("RA-01：两处都没有 Playwright 时退出码 2，提示里写明要装在运行 measure-cjk 的项目里或和它装在一起", () => {
  const w = splitInstall();
  try {
    const r = spawnSync(process.execPath, [join(w.pkg, "bin", "measure-cjk.js"), "lint", "page.html", "--render"], { cwd: w.proj, encoding: "utf8", timeout: 60000 });
    assert.equal(r.status, 2, r.stderr);
    assert.match(r.stderr, /npm install -g playwright-core|全局/, `提示里应说明全局安装时怎么装：${r.stderr}`);
  } finally {
    w.cleanup();
  }
});

test("RA-02：展示页没有 undefined，主题索引的风格、适合场景都不为空", () => {
  const html = readFileSync(join(repo, "site", "index.html"), "utf8");
  assert.doesNotMatch(html, /undefined/, "展示页里出现了 undefined");
  const themes = JSON.parse(readFileSync(join(repo, "site", "themes", "themes.json"), "utf8"));
  assert.equal(themes.length, 6);
  for (const t of themes) {
    assert.ok(typeof t.style === "string" && t.style.length > 0, `${t.id} 缺少 style`);
    assert.ok(typeof t.fit === "string" && t.fit.length > 0, `${t.id} 缺少 fit`);
  }
});

test("RA-03：6 个主题示例页里，字号更大的文字，字重不能更重（字号越大字重越轻）", async () => {
  const { launchBrowser } = await import(pathToFileURL(join(repo, "packages", "cli", "dist", "render.js")).href);
  const { browser } = await launchBrowser("file", false);
  const bad = [];
  try {
    for (const id of ["broadsheet", "manual", "archive", "quarterly", "songke", "dososo"]) {
      const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
      const page = await ctx.newPage();
      await page.goto(pathToFileURL(join(repo, "site", "themes", `${id}.html`)).href);
      const items = await page.evaluate(() =>
        ["h1", "h2", ".kicker", ".lead", ".meta", ".body p", "li", "blockquote p", ".note"].flatMap((sel) => {
          const el = document.querySelector(sel);
          if (!el) return [];
          const cs = getComputedStyle(el);
          return [{ sel, size: parseFloat(cs.fontSize), weight: Number(cs.fontWeight) }];
        })
      );
      for (const a of items) for (const b of items) if (a.size > b.size && a.weight > b.weight) bad.push(`${id}：${a.sel}（${a.size}px / ${a.weight}）比 ${b.sel}（${b.size}px / ${b.weight}）字号大、字重也更重`);
      await ctx.close();
    }
  } finally {
    await browser.close();
  }
  assert.deepEqual(bad, []);
});
