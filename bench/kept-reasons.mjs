// 统计完整档「按元素合并」之后保留下来的基础档 error：保留原因，以及完整档是否对同一元素、同一规则也报了（RC-04）。
// 「同一元素」按选择器相同或文字指纹相同判断。只读 bench/runs 下的已有产物，不调用任何 agent。截图写进临时目录，跑完删除。
// 用法：node bench/kept-reasons.mjs [目录...]（默认是对照组 v2 的两组）
import { mkdtempSync, rmSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { runRender, EL_TEXT } from "../packages/cli/dist/index.js";

const repo = join(dirname(fileURLToPath(import.meta.url)), "..");
const dirs = process.argv.slice(2).length ? process.argv.slice(2) : ["bench/runs/2026-W2-baseline-isolated-v2-codex", "bench/runs/2026-W2-baseline-isolated-v2-claude-code"];
for (const dir of dirs) {
  const ev = mkdtempSync(join(repo, "test", "tmp-kept-"));
  try {
    const r = await runRender({ inputs: [dir], root: repo, cwd: repo, evidenceDir: ev });
    const kept = r.findings.filter((f) => f.severity === "error" && /（基础档结果：/.test(f.message));
    const fromDom = r.findings.filter((f) => f.severity === "error" && /是脚本渲染出来的/.test(f.message));
    const rendered = r.findings.filter((f) => f.viewport !== undefined && !/（基础档结果：/.test(f.message));
    const rows = kept.map((f) => {
      const dup = rendered.some((g) => g.file === f.file && g.rule === f.rule && (g.selector === f.selector || (f[EL_TEXT] && g[EL_TEXT] === f[EL_TEXT])));
      return { file: f.file.replace(`${dir}/`, ""), rule: f.rule, selector: f.selector, reason: f.message.match(/（基础档结果：([^）]*)）/)[1], duplicate_of_render: dup };
    });
    console.log(`\n== ${dir}：保留的基础档 error ${rows.length} 条，其中与完整档重复 ${rows.filter((x) => x.duplicate_of_render).length} 条；DOM 快照补报 ${fromDom.length} 条`);
    for (const x of rows) console.log(`${x.rule} | ${x.file} | ${x.selector} | 重复：${x.duplicate_of_render ? "是" : "否"} | ${x.reason}`);
  } finally {
    rmSync(ev, { recursive: true, force: true });
  }
}
