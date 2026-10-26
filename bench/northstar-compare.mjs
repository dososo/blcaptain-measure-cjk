// 北极星实验的汇总（docs/verification/w2/NORTH_STAR_PLAN.md §5）：读 bench/runs/<前缀>-<agent>-<control|measure>/summary.json，
// 按 agent 分别比较两组（不做跨 agent 比较，§3），写 docs/verification/w2/northstar/results.json（原子写入）。
// 用法：node bench/northstar-compare.mjs [--prefix 2026-W2-northstar-v3] [--out docs/verification/w2/northstar]
// - 主指标：完整档零 error 页面的比例（没检查完的页面不算零 error）；
// - 配对比较：同一条提示词两组各一页，按完整档 error 条数比「实验组更好 / 一样 / 更差」，双侧符号检验；
// - 实验组里没加载 skill 的运行单独列出，不算进实验组（§4 第 1 条）；
// - 补充指标：基础档零 error 率、排除 T02 和 T04 后的零 error 页数、每页平均 error 条数、各规则命中页数；
// - 排除 T02、T04 的配对比较：这两条是本项目自定的规则（text-autospace、line-break: strict），AI 默认几乎从不写，
//   单靠它们就能让对照组全军覆没；排除之后的差距，才看得出 skill 对其余排版问题的作用。
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repo = join(dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);
const opt = (k, d) => {
  const i = args.indexOf(`--${k}`);
  return i >= 0 ? args[i + 1] : d;
};
const prefix = opt("prefix", "2026-W2-northstar-v3");
const outDir = resolve(repo, opt("out", "docs/verification/w2/northstar")); // 绝对路径原样使用，相对路径相对仓库（NA-08）

// 二项分布 B(n, 0.5) 的双侧符号检验
function signTest(better, worse) {
  const n = better + worse;
  if (n === 0) return null;
  const k = Math.min(better, worse);
  let tail = 0;
  for (let i = 0; i <= k; i++) {
    let c = 1;
    for (let j = 0; j < i; j++) c = (c * (n - j)) / (j + 1);
    tail += c / 2 ** n;
  }
  return Math.min(1, 2 * tail);
}

const rate = (a, b) => (b ? a / b : null);
const OWN_RULES = new Set(["T02", "T04"]);
// 某一页完整档的 error 条数，排除 T02、T04（读 lint-render.json）
function errorsExcl(agent, name, id) {
  const p = join(repo, "bench", "runs", `${prefix}-${agent}-${name}`, id, "lint-render.json");
  if (!existsSync(p)) return null;
  return JSON.parse(readFileSync(p, "utf8")).findings.filter((f) => f.severity === "error" && !OWN_RULES.has(f.rule)).length;
}
const zeroRender = (r) => r.produced && r.render_errors === 0 && r.render_status !== "incomplete";

function arm(agent, name) {
  const p = join(repo, "bench", "runs", `${prefix}-${agent}-${name}`, "summary.json");
  return existsSync(p) ? JSON.parse(readFileSync(p, "utf8")) : null;
}

function describe(s, rows) {
  const produced = rows.filter((r) => r.produced);
  const hits = {};
  for (const r of produced) for (const rule of r.render_error_rules ?? []) hits[rule] = (hits[rule] ?? 0) + 1;
  return {
    runs: rows.length,
    produced: produced.length,
    zero_error_render: produced.filter(zeroRender).length,
    zero_error_render_rate: rate(produced.filter(zeroRender).length, produced.length),
    render_incomplete: produced.filter((r) => r.render_status === "incomplete").length,
    zero_error_static: produced.filter((r) => r.errors === 0).length,
    zero_error_static_rate: rate(produced.filter((r) => r.errors === 0).length, produced.length),
    zero_error_static_excluding_T02_T04: produced.filter((r) => r.error_rules.every((x) => x === "T02" || x === "T04")).length,
    mean_render_errors: produced.length ? produced.reduce((n, r) => n + (r.render_errors ?? 0), 0) / produced.length : null,
    render_rule_hit_pages: Object.fromEntries(Object.entries(hits).sort((a, b) => b[1] - a[1]))
  };
}

const agents = {};
for (const agent of ["codex", "claude-code"]) {
  const c = arm(agent, "control");
  const m = arm(agent, "measure");
  if (!c || !m) {
    agents[agent] = { status: "缺数据", control: !!c, measure: !!m };
    continue;
  }
  const notLoaded = m.rows.filter((r) => !r.skill_loaded).map((r) => r.id);
  const mRows = m.rows.filter((r) => r.skill_loaded);
  const cById = new Map(c.rows.map((r) => [r.id, r]));
  let better = 0;
  let same = 0;
  let worse = 0;
  const ex = { better: 0, same: 0, worse: 0 };
  const pairs = [];
  for (const r of mRows) {
    const k = cById.get(r.id);
    if (!k || !k.produced || !r.produced || k.render_status === "incomplete" || r.render_status === "incomplete") {
      pairs.push({ id: r.id, result: "不可比", why: !k ? "对照组没有这条" : !k.produced || !r.produced ? "有一组没产出页面" : "有一组完整档没检查完" });
      continue;
    }
    const d = k.render_errors - r.render_errors;
    const result = d > 0 ? "实验组更好" : d < 0 ? "实验组更差" : "一样";
    if (d > 0) better++;
    else if (d < 0) worse++;
    else same++;
    const ce = errorsExcl(agent, "control", r.id);
    const me = errorsExcl(agent, "measure", r.id);
    const dx = ce - me;
    if (dx > 0) ex.better++;
    else if (dx < 0) ex.worse++;
    else ex.same++;
    pairs.push({ id: r.id, control_errors: k.render_errors, measure_errors: r.render_errors, result, control_errors_excl_T02_T04: ce, measure_errors_excl_T02_T04: me });
  }
  agents[agent] = {
    control: describe(c, c.rows),
    measure: describe(m, mRows),
    measure_skill_not_loaded: notLoaded,
    paired: { better, same, worse, sign_test_p_two_sided: signTest(better, worse), pairs },
    paired_excluding_T02_T04: { ...ex, sign_test_p_two_sided: signTest(ex.better, ex.worse), zero_error_control: pairs.filter((x) => x.control_errors_excl_T02_T04 === 0).length, zero_error_measure: pairs.filter((x) => x.measure_errors_excl_T02_T04 === 0).length, comparable: pairs.filter((x) => x.result !== "不可比").length },
    checks: {
      control_leak_runs: c.northstar?.leak_runs ?? "无数据",
      control_text_autospace_pages: c.northstar?.text_autospace_pages ?? "无数据",
      home_path_in_log_runs: { control: c.northstar?.home_path_in_log_runs ?? "无数据", measure: m.northstar?.home_path_in_log_runs ?? "无数据" },
      measure_used_cli_runs: m.northstar?.used_measure_cli_runs ?? "无数据",
      models: { control: c.environment_observed?.models, measure: m.environment_observed?.models }
    }
  };
}

const results = {
  schema_version: "1.0.0",
  experiment: "北极星：同一个 agent、同一个模型，不装与装 measure，完整档零 error 页面的比例（PRD §4.1）",
  plan: "docs/verification/w2/NORTH_STAR_PLAN.md",
  prefix,
  generated_at: new Date().toISOString(),
  comparison_scope: "只在同一个 agent 内比较两组，不做跨 agent 比较（claude 实验组测 skill 内容，codex 实验组测真实触发）",
  agents
};
mkdirSync(outDir, { recursive: true });
const tmp = join(outDir, `results.json.${process.pid}.tmp`);
writeFileSync(tmp, JSON.stringify(results, null, 2) + "\n");
renameSync(tmp, join(outDir, "results.json"));
for (const [a, v] of Object.entries(agents)) {
  if (v.status) {
    console.log(`${a}：${v.status}`);
    continue;
  }
  const pct = (x) => (x === null ? "无" : `${(x * 100).toFixed(1)}%`);
  const e = v.paired_excluding_T02_T04;
  console.log(`${a}（排除 T02、T04）：零 error 对照 ${e.zero_error_control}/${e.comparable} → 实验 ${e.zero_error_measure}/${e.comparable}；配对 更好 ${e.better}、一样 ${e.same}、更差 ${e.worse}，符号检验 p = ${e.sign_test_p_two_sided?.toFixed(4) ?? "无"}`);
  console.log(`${a}：完整档零 error 率 对照 ${pct(v.control.zero_error_render_rate)}（${v.control.zero_error_render}/${v.control.produced}）→ 实验 ${pct(v.measure.zero_error_render_rate)}（${v.measure.zero_error_render}/${v.measure.produced}）；配对 更好 ${v.paired.better}、一样 ${v.paired.same}、更差 ${v.paired.worse}，符号检验 p = ${v.paired.sign_test_p_two_sided?.toFixed(4) ?? "无"}；实验组没加载 skill ${v.measure_skill_not_loaded.length} 次`);
}
