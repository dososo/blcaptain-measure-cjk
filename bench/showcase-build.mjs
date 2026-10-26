// 展示页的素材（W2 第 3 步，用户 2026-10-26 拍板：数字放最前面；每条规则一组「同一段文字开关 measure」的示意，标明是示意；
// 再配 3–4 组真实实验页面，用红框标出 lint 查到的问题）。
// 1. 示意：site/demos/ 的每组「关 / 开」先用 measure-cjk lint --render 验证（关只踩中目标规则，开零 error），再截图；
// 2. 真实页面：北极星实验里同一条提示词的两页，在「不装」那页上按 lint-render.json 的位置画红框、标出实测值；
// 3. 数字从 docs/verification/w2/northstar/results.json 读，写进 site/showcase.json，展示页由 site/_build.mjs 生成。
// 截图全部经过字体替换和核对（showcase-lib.mjs），有不合格字体就停下。用法：node bench/showcase-build.mjs
import { mkdirSync, readFileSync, realpathSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { fontCheck, openBrowser, openPage } from "./showcase-lib.mjs";

const repo = join(dirname(fileURLToPath(import.meta.url)), "..");
const site = join(repo, "site");
const shots = join(site, "shots");
rmSync(shots, { recursive: true, force: true });
mkdirSync(shots, { recursive: true });
const OWN = new Set(["T02", "T04"]);
// 红框不标 T06：它对单行的 p、li 按正文行高报 error，北极星审计判为误报（AUDIT_NORTHSTAR NA-05），修好之前不拿来展示
const NOT_MARKED = new Set(["T06"]);
const PAIRS = [
  { agent: "codex", id: "008", kind: "文章页（游记）" },
  { agent: "codex", id: "011", kind: "价格页" },
  { agent: "claude-code", id: "004", kind: "落地页" },
  // 小红书卡片（026）不放：卡片按 1080×1440 导出成图，T11 按浏览器里的像素判断卡片，口径有问题（缩放到同一宽度后，
  // 两版最小字号占卡片宽度只是 2.03% 对 2.41%），拿它当「装之前更差」的例子会误导。T11 对卡片的口径记入台账
  { agent: "claude-code", id: "006", kind: "文章页（随笔）" }
];
// 网页用桌面视图（行长这类问题要宽屏才看得出）；小红书卡片按导出尺寸看：1280 宽的视口里截 1440 高（卡片是 1080×1440 的图，不在手机浏览器里看）
const VIEW = { desktop: { width: 1280, height: 900, scale: 1, clipH: 900 }, card: { width: 1280, height: 1440, scale: 1, clipH: 1440 } };
const AGENT_LABEL = { codex: "Codex", "claude-code": "Claude Code" };
const AGENT_MODEL = { codex: "gpt-6-astra", "claude-code": "claude-opus-5-5" };
const fail = (msg) => {
  console.error(msg);
  process.exit(1);
};

// ---------- 1. 示意：先验证 ----------
const demos = JSON.parse(readFileSync(join(site, "demos", "demos.json"), "utf8"));
const lint = spawnSync(process.execPath, [join(repo, "packages", "cli", "bin", "measure-cjk.js"), "lint", "site/demos", "--render", "--widths", "1280", "--format", "json", "--evidence", "site/.evidence"], { cwd: repo, encoding: "utf8", maxBuffer: 64 << 20 });
const demoLint = JSON.parse(lint.stdout);
const demoCheck = [];
for (const d of demos) {
  const of = (arm) => demoLint.findings.filter((f) => f.file.endsWith(`${d.rule.toLowerCase()}-${arm}.html`));
  const off = of("off");
  const on = of("on");
  const ok = off.length > 0 && off.every((f) => f.rule === d.rule && f.severity === "error") && on.length === 0;
  demoCheck.push({ rule: d.rule, off: off.map((f) => `${f.rule} ${f.severity}`), on: on.map((f) => `${f.rule} ${f.severity}`), ok });
  if (!ok) fail(`示意 ${d.rule} 没通过验证：关 ${JSON.stringify(off.map((f) => f.rule))}，开 ${JSON.stringify(on.map((f) => f.rule))}`);
}

const browser = await openBrowser();
const fontRecord = {};
const shoot = async (name, ctx, page, clip) => {
  const check = await fontCheck(ctx, page);
  fontRecord[name] = check;
  if (check.violations.length) fail(`${name} 用到了不能出图的字体：${check.violations.join("、")}`);
  await page.screenshot({ path: join(shots, name), type: name.endsWith(".png") ? "png" : "jpeg", ...(name.endsWith(".png") ? {} : { quality: 88 }), clip, animations: "disabled", caret: "hide" });
};

try {
  for (const d of demos) {
    for (const arm of ["off", "on"]) {
      const file = join(site, "demos", `${d.rule.toLowerCase()}-${arm}.html`);
      const { ctx, page } = await openPage(browser, file, realpathSync(join(site, "demos")), { width: d.width, height: 600, scale: 2 });
      const box = await page.evaluate(() => {
        const r = document.querySelector(".demo").getBoundingClientRect();
        return { x: r.x, y: r.y, width: r.width, height: r.height };
      });
      await shoot(`demo-${d.rule.toLowerCase()}-${arm}.png`, ctx, page, box);
      await ctx.close();
    }
  }

  // ---------- 1b. 6 个主题（PRD §5.3）：示例页由 site/themes/_gen.mjs 从主题文件生成，先验证零 error，再截图 ----------
  const themeMeta = JSON.parse(readFileSync(join(site, "themes", "themes.json"), "utf8"));
  const themeLint = JSON.parse(spawnSync(process.execPath, [join(repo, "packages", "cli", "bin", "measure-cjk.js"), "lint", "site/themes", "--render", "--format", "json", "--evidence", "site/.evidence"], { cwd: repo, encoding: "utf8", maxBuffer: 64 << 20 }).stdout);
  const themeErrors = themeLint.findings.filter((f) => f.severity === "error");
  if (themeErrors.length) fail(`主题示例页有 ${themeErrors.length} 条 lint error：${themeErrors.map((f) => `${f.file} ${f.rule}`).join("；")}`);
  const themes = [];
  for (const t of themeMeta) {
    const { ctx, page } = await openPage(browser, join(site, "themes", `${t.id}.html`), realpathSync(join(site, "themes")), { width: 1280, height: 1000, scale: 1 });
    const docH = await page.evaluate(() => document.documentElement.scrollHeight);
    await page.setViewportSize({ width: 1280, height: Math.max(1000, docH) });
    await shoot(`theme-${t.id}.jpg`, ctx, page, { x: 0, y: 0, width: 1280, height: Math.min(1000, docH) });
    await ctx.close();
    const warns = themeLint.findings.filter((f) => f.severity === "warn" && f.file.endsWith(`/${t.id}.html`)).map((f) => f.rule);
    themes.push({ ...t, lint_errors: 0, lint_warns: warns });
  }

  // ---------- 2. 真实页面：红框 ----------
  // 标签上的数值在截图的这一次渲染里当场量（AUDIT_SHOWCASE SA-01）：lint 结论里的数值是它第一个出问题的宽度量到的，
  // 和截图的宽度不一定一样。量出来已经不违反规则的元素不画框，并记下个数。
  // 小红书卡片按卡片边框裁切，再按「卡片宽度 → 1080 像素」缩放，两版显示比例一致（SA-02）。
  const errorsExcl = (agent, arm, id) => JSON.parse(readFileSync(join(repo, "bench", "runs", `2026-W2-northstar-v3-${agent}-${arm}`, id, "lint-render.json"), "utf8")).findings.filter((f) => f.severity === "error" && !OWN.has(f.rule)).length;
  const pairs = [];
  for (const p of PAIRS) {
    const side = {};
    for (const arm of ["control", "measure"]) {
      const runDir = join(repo, "bench", "runs", `2026-W2-northstar-v3-${p.agent}-${arm}`, p.id);
      const root = realpathSync(join(runDir, "output"));
      const findings = JSON.parse(readFileSync(join(runDir, "lint-render.json"), "utf8")).findings.filter((f) => f.severity === "error");
      // 图注的计数（SA-04）：不含 T02、T04（本项目自定）和 T06（误报争议）；lint 每条规则最多列 20 处，其余汇总成「另有 N 处」，要加回来
      const counts = {};
      for (const f of findings) {
        if (OWN.has(f.rule) || NOT_MARKED.has(f.rule)) continue;
        const more = f.selector === undefined ? Number(f.message.match(/另有 (\d+) 处/)?.[1] ?? 0) : 1;
        counts[f.rule] = (counts[f.rule] ?? 0) + more;
      }
      const v = VIEW[p.view ?? "desktop"];
      const atWidth = findings.filter((f) => !OWN.has(f.rule) && !NOT_MARKED.has(f.rule) && f.selector && (f.viewport === undefined || new RegExp(`\\b${v.width}\\b`).test(f.message)));
      // 卡片：先找卡片边框（宽 ≥ 300、高宽比 1.25–1.45 的最大元素），再按 1080 / 卡片宽度 设置像素密度重新打开
      let scale = v.scale;
      let cardRect = null;
      if (p.view === "card") {
        const probe = await openPage(browser, join(root, "index.html"), root, v);
        cardRect = await probe.page.evaluate(() => {
          let best = null;
          for (const el of document.querySelectorAll("body *")) {
            const r = el.getBoundingClientRect();
            const ratio = r.height / r.width;
            if (r.width >= 300 && ratio >= 1.25 && ratio <= 1.45 && (!best || r.width * r.height > best.w * best.h)) best = { x: r.x + scrollX, y: r.y + scrollY, w: r.width, h: r.height };
          }
          return best;
        });
        await probe.ctx.close();
        if (!cardRect) fail(`${p.agent}-${p.id}-${arm}：找不到卡片边框`);
        scale = 1080 / cardRect.w;
      }
      const { ctx, page } = await openPage(browser, join(root, "index.html"), root, { ...v, scale });
      const marks = await page.evaluate((items) => {
        const out = [];
        let skipped = 0;
        for (const it of items) {
          let el;
          try {
            el = document.querySelector(it.selector);
          } catch {
            el = null;
          }
          if (!el) continue;
          const r = el.getBoundingClientRect();
          if (r.width < 1 || r.height < 1) continue;
          const cs = getComputedStyle(el);
          let label = it.rule;
          let violates = true;
          if (it.rule === "T11") {
            const px = parseFloat(cs.fontSize);
            label += ` · ${Math.round(px * 10) / 10}px`;
            violates = px < 14;
          } else if (it.rule === "T07") {
            const ls = cs.letterSpacing === "normal" ? 0 : parseFloat(cs.letterSpacing);
            label += ` · ${Math.round(ls * 10) / 10}px`;
            violates = ls < 0;
          } else if (it.rule === "T03") label += " · 标点";
          else if (it.rule === "T05") label += " · 行长";
          if (!violates) {
            skipped++;
            continue;
          }
          out.push({ label, x: r.x + scrollX, y: r.y + scrollY, w: r.width, h: r.height });
        }
        return { out, skipped };
      }, atWidth.map((f) => ({ selector: f.selector, rule: f.rule })));
      const clipH = v.clipH;
      // 「不装」那页：首屏里没有问题时，截第一个问题所在的位置（上方留 200px）；「装了」那页截首屏
      const firstY = Math.min(...marks.out.map((m) => m.y), Infinity);
      const top = arm === "control" && !cardRect && firstY !== Infinity && firstY > clipH * 0.6 ? Math.max(0, Math.floor(firstY - 200)) : 0;
      const inClip = (m) => (cardRect ? m.y >= cardRect.y && m.y < cardRect.y + cardRect.h : m.y >= top && m.y < top + clipH);
      if (arm === "control") {
        await page.evaluate((list) => {
          for (const m of list) {
            const b = document.createElement("div");
            b.setAttribute("style", `position:absolute;z-index:2147483646;left:${m.x - 3}px;top:${m.y - 3}px;width:${m.w + 6}px;height:${m.h + 6}px;border:2px solid #c0392b;box-sizing:border-box;pointer-events:none;`);
            const t = document.createElement("span");
            t.textContent = m.label;
            t.setAttribute("style", "all:initial;position:absolute;left:-2px;top:-22px;background:#c0392b;color:#fff;font:600 12px/20px \"NS-Sans\";padding:0 6px;white-space:nowrap;");
            b.appendChild(t);
            document.body.appendChild(b);
          }
        }, marks.out.filter(inClip));
      }
      const docH = await page.evaluate(() => document.documentElement.scrollHeight);
      const clip = cardRect ? { x: cardRect.x, y: cardRect.y, width: cardRect.w, height: cardRect.h } : { x: 0, y: Math.min(top, Math.max(0, docH - clipH)), width: v.width, height: Math.min(clipH, docH) };
      const name = `real-${p.agent}-${p.id}-${arm}.jpg`;
      await page.setViewportSize({ width: v.width, height: Math.max(v.height, docH) });
      await shoot(name, ctx, page, clip);
      // 页面上最小的中文字号；卡片同时给出占卡片宽度的比例（缩放到同一宽度后，比例才可比）
      const minPx = await page.evaluate(() => {
        let min = Infinity;
        const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
        for (let n = w.nextNode(); n; n = w.nextNode()) {
          if (!/\p{Script=Han}/u.test(n.textContent) || !n.parentElement || n.parentElement.closest("[aria-hidden=true]")) continue;
          const cs = getComputedStyle(n.parentElement);
          if (cs.display === "none" || cs.visibility === "hidden") continue;
          min = Math.min(min, parseFloat(cs.fontSize));
        }
        return min === Infinity ? null : min;
      });
      side[arm] = {
        image: `shots/${name}`,
        clip_top: clip.y,
        counts,
        errors_shown: Object.values(counts).reduce((a, b) => a + b, 0),
        errors_excl_own: findings.filter((f) => !OWN.has(f.rule)).length,
        marks_in_image: arm === "control" ? marks.out.filter(inClip).length : 0,
        marks_skipped_not_violating: arm === "control" ? marks.skipped : 0,
        min_cjk_px: minPx,
        card_width_px: cardRect ? cardRect.w : undefined,
        min_cjk_ratio: cardRect && minPx ? minPx / cardRect.w : undefined
      };
      await ctx.close();
    }
    // 挑选的透明度（SA-03）：这一页在同一 agent 的 30 页里，按对照组 error 数（不含 T02、T04）从多到少排第几
    const all = Array.from({ length: 30 }, (_, i) => String(i + 1).padStart(3, "0")).map((id) => ({ id, n: errorsExcl(p.agent, "control", id) }));
    const rank = 1 + all.filter((x) => x.n > all.find((y) => y.id === p.id).n).length;
    const prompt = readFileSync(join(repo, "bench", "prompts", `${p.id}.md`), "utf8").replace(/^---[\s\S]*?---\s*/, "").trim();
    pairs.push({ ...p, view: p.view ?? "desktop", agent_label: AGENT_LABEL[p.agent], model: AGENT_MODEL[p.agent], prompt, rank_by_control_errors: rank, control: side.control, measure: side.measure });
  }
  // 卡片口径的敏感性（AUDIT_SHOWCASE_r2 R2-01，N-SC1）：对照组里的小红书卡片页（026–030），如果排除 T02、T04 之后只剩 T11，
  // 按卡片导出尺寸换算后可能不算违规。假设这些页不违规，重算「排除 T02、T04」的零 error 页和配对比较。卡片的导出宽度是假设，只是估算
  const CARD_IDS = ["026", "027", "028", "029", "030"];
  const binom = (b, w) => {
    const n = b + w;
    if (!n) return null;
    let t = 0;
    for (let i = 0; i <= Math.min(b, w); i++) {
      let c = 1;
      for (let j = 0; j < i; j++) c = (c * (n - j)) / (j + 1);
      t += c / 2 ** n;
    }
    return Math.min(1, 2 * t);
  };
  const cardSensitivity = {};
  for (const agent of ["codex", "claude-code"]) {
    const nsPairs = JSON.parse(readFileSync(join(repo, "docs", "verification", "w2", "northstar", "results.json"), "utf8")).agents[agent].paired.pairs;
    let b = 0, same = 0, w = 0, zc = 0, zm = 0, affected = 0;
    for (const x of nsPairs) {
      let c = x.control_errors_excl_T02_T04;
      const m = x.measure_errors_excl_T02_T04;
      if (CARD_IDS.includes(x.id) && c > 0) {
        const rules = new Set(JSON.parse(readFileSync(join(repo, "bench", "runs", `2026-W2-northstar-v3-${agent}-control`, x.id, "lint-render.json"), "utf8")).findings.filter((f) => f.severity === "error" && !OWN.has(f.rule)).map((f) => f.rule));
        if ([...rules].every((r) => r === "T11")) {
          c = 0;
          affected++;
        }
      }
      zc += c === 0;
      zm += m === 0;
      if (c > m) b++;
      else if (c < m) w++;
      else same++;
    }
    cardSensitivity[agent] = { affected_pages: affected, zero_error_control: zc, zero_error_measure: zm, better: b, same, worse: w, p: binom(b, w) };
  }

  // 装了 measure 之后仍有 error 的页面（SA-03：不只展示好的）
  const stillFailing = {};
  for (const agent of ["codex", "claude-code"]) {
    const rows = JSON.parse(readFileSync(join(repo, "bench", "runs", `2026-W2-northstar-v3-${agent}-measure`, "summary.json"), "utf8")).rows;
    stillFailing[agent] = rows.filter((r) => r.render_errors > 0).map((r) => ({ id: r.id, rules: r.render_error_rules, control: errorsExcl(agent, "control", r.id), measure: errorsExcl(agent, "measure", r.id) }));
  }

  // ---------- 3. 数字 ----------
  const ns = JSON.parse(readFileSync(join(repo, "docs", "verification", "w2", "northstar", "results.json"), "utf8"));
  const numbers = Object.fromEntries(
    Object.entries(ns.agents).map(([a, v]) => [
      a,
      {
        label: AGENT_LABEL[a],
        model: AGENT_MODEL[a],
        all: { control: v.control.zero_error_render, measure: v.measure.zero_error_render, n: v.control.produced },
        excl: { control: v.paired_excluding_T02_T04.zero_error_control, measure: v.paired_excluding_T02_T04.zero_error_measure, n: v.paired_excluding_T02_T04.comparable },
        paired_excl: { better: v.paired_excluding_T02_T04.better, same: v.paired_excluding_T02_T04.same, worse: v.paired_excluding_T02_T04.worse, p: v.paired_excluding_T02_T04.sign_test_p_two_sided },
        used_lint: v.checks.measure_used_cli_runs
      }
    ])
  );
  const out = { schema_version: "1.0.0", generated_at: new Date().toISOString(), source: "docs/verification/w2/northstar/results.json", numbers, themes, card_sensitivity: cardSensitivity, still_failing: stillFailing, demos: demos.map((d) => ({ ...d, off: `shots/demo-${d.rule.toLowerCase()}-off.png`, on: `shots/demo-${d.rule.toLowerCase()}-on.png` })), demo_check: demoCheck, pairs, fonts: fontRecord };
  const tmp = join(site, `showcase.json.${process.pid}.tmp`);
  writeFileSync(tmp, JSON.stringify(out, null, 2) + "\n");
  renameSync(tmp, join(site, "showcase.json"));
  console.log(`示意 ${demos.length} 组（都通过 lint 验证）；主题 ${themes.length} 个（示例页零 error）；真实页面 ${pairs.length} 组；截图 ${Object.keys(fontRecord).length} 张，全部只用到允许出图的字体`);
} finally {
  await browser.close();
}
