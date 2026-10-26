// AUDIT_CARD_r2 CB-01 的复现扫描：卡片加载后过 T 毫秒把一段字改成 10px，T 从 from 扫到 to（步长 step），
// 每个 T 导出一次。导出的 PNG 和对照组不同（标 ✗）= 截下的不是 lint 检查过的画面。
// 用法：node scripts/sweep-card-late-change.mjs <仓库根目录> <from> <to> <step>
//       node scripts/sweep-card-late-change.mjs <仓库根目录> --adaptive
// --adaptive（AUDIT_CARD_r3 CC-02）：先在 0–3000 ms 按 50 ms 粗扫，找到「拒绝」的最后一点和「导出」的第一点，
// 再在两点之间按 2 ms 细扫。结果里必须同时有拒绝和导出（证明扫到了窗口两端），而且 0 个 ✗，才以退出码 0 结束。
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
const repo = resolve(process.argv[2] ?? ".");
const m = await import(pathToFileURL(join(repo, "packages/cli/dist/index.js")).href);
const { makeTtf } = await import(pathToFileURL(join(repo, "test/helpers/font.js")).href);
const fx = join(repo, "test/fixtures/w2-card-audit-r2");
const tpl = readFileSync(join(fx, "D-late-0050ms.html"), "utf8");
const ctl = readFileSync(join(fx, "D00-control.html"), "utf8");
const chars = [...new Set([...tpl].filter((c) => c.trim()))].join("") + " ";
async function run(html) {
  const base = mkdtempSync(join(tmpdir(), "sweep-")); const ws = join(base, "ws"); mkdirSync(join(ws, "fonts"), { recursive: true });
  writeFileSync(join(ws, "c.html"), html); writeFileSync(join(ws, "fonts/f.ttf"), makeTtf({ family: "LXGW WenKai", chars }));
  const r = await m.runCard({ input: "c.html", root: ws, cwd: ws, fontDir: "fonts", out: "c.png" });
  const png = existsSync(join(ws, "c.png")) ? readFileSync(join(ws, "c.png")) : undefined; rmSync(base, { recursive: true, force: true }); return { r, png };
}
const control = (await run(ctl)).png;
const at = (t) => tpl.replace("}, 50));", `}, ${t}));`);
async function probe(t) {
  const { r, png } = await run(at(t));
  return { t, status: r.status, bad: r.status === "exported" && !png.equals(control) };
}
if (process.argv[3] === "--adaptive") {
  const all = [];
  let lastRejected = -1;
  let firstExported = -1;
  for (let t = 0; t <= 3000; t += 50) {
    const x = await probe(t);
    all.push(x);
    if (x.status === "rejected") lastRejected = t;
    if (x.status === "exported") {
      firstExported = t;
      break;
    }
  }
  if (lastRejected >= 0 && firstExported > lastRejected) for (let t = lastRejected + 2; t < firstExported; t += 2) all.push(await probe(t));
  all.sort((a, b) => a.t - b.t);
  const n = (s) => all.filter((x) => x.status === s).length;
  const bad = all.filter((x) => x.bad).length;
  console.log(all.map((x) => `${x.t}ms:${x.status}${x.bad ? "✗" : ""}`).join(" "));
  const bracketed = n("rejected") > 0 && n("exported") > 0;
  console.log(`汇总：细扫区间 ${lastRejected}–${firstExported} ms；拒绝 ${n("rejected")}、没检查完 ${n("incomplete")}、导出 ${n("exported")}；✗ ${bad} 个；${bracketed ? "扫到了窗口两端" : "没扫到窗口两端"}`);
  process.exit(bracketed && bad === 0 ? 0 : 1);
}

const [from, to, step] = process.argv.slice(3).map(Number);
const out = [];
for (let t = from; t <= to; t += step) {
  const x = await probe(t);
  out.push(`${t}ms:${x.status}${x.bad ? "✗" : ""}`);
}
console.log(out.join(" "));
