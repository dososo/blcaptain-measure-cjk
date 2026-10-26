// 打回交包：确认结论、工作树干净之后，把整个仓库（含 .git，不含 node_modules 和 dist）打成 zip，
// 并在 zip 旁边写一份 .sha256。用法：node scripts/package.mjs --iter 2；W2 完整档用 node scripts/package.mjs --w2-render
import { spawnSync } from "node:child_process";
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { createHash } from "node:crypto";
import { join, dirname, basename } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const iterArg = process.argv.indexOf("--iter");
const ITER = iterArg >= 0 ? Number(process.argv[iterArg + 1]) : 1;
const W2_RENDER = process.argv.includes("--w2-render");
const resultsPath = W2_RENDER ? join(root, "docs", "verification", "w2", "render", "results.json") : join(root, "docs", "verification", `iter_${ITER}`, "results.json");
const results = JSON.parse(readFileSync(resultsPath, "utf8"));
const status = spawnSync("git", ["status", "--porcelain"], { cwd: root, encoding: "utf8" }).stdout.trim();
if (status) {
  console.error(`工作树不干净，拒绝打包：\n${status}`);
  process.exit(1);
}
const head = spawnSync("git", ["rev-parse", "HEAD"], { cwd: root, encoding: "utf8" }).stdout.trim();
const outDir = join(root, "..", "deliverables");
mkdirSync(outDir, { recursive: true });
const zip = join(outDir, W2_RENDER ? "measure-cjk_delivery_w2_render.zip" : `measure-cjk_delivery_iter_${ITER}.zip`);
spawnSync("rm", ["-f", zip]);
const r = spawnSync("zip", ["-rq", zip, basename(root), "-x", `${basename(root)}/node_modules/*`, `${basename(root)}/packages/cli/node_modules/*`, `${basename(root)}/packages/cli/dist/*`, `${basename(root)}/bench/.perf-tmp/*`], { cwd: join(root, ".."), encoding: "utf8" });
if (r.status !== 0 || !existsSync(zip)) {
  console.error(`打包失败：${r.stderr}`);
  process.exit(1);
}
const sha = createHash("sha256").update(readFileSync(zip)).digest("hex");
writeFileSync(`${zip}.sha256`, `${sha}  ${basename(zip)}\n# git HEAD：${head}\n# 结论（results.json）：${results.verdict}\n# 生成时间：${new Date().toISOString()}\n`);
console.log(`已生成 ${zip}\nSHA-256 ${sha}\nHEAD ${head}，结论 ${results.verdict}`);
