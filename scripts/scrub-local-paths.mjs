// 把仓库里的本机绝对路径和用户名换成占位符，免得公开仓库时暴露本机信息。
// 路径都在运行时从本机取（家目录、用户名、系统临时目录、本仓库位置），脚本里不写死任何人的路径。
// 用法：node scripts/scrub-local-paths.mjs          只列出命中的文件和次数，不改动
//       node scripts/scrub-local-paths.mjs --write  原地替换（每个文件先写临时文件再改名）
// 也可以 import { scrubText, localPatterns } 给验证脚本在写证据前调用。
import { execFileSync } from "node:child_process";
import { readFileSync, realpathSync, renameSync, writeFileSync } from "node:fs";
import { homedir, tmpdir, userInfo } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

// 按从长到短的顺序替换：先换仓库、工作区，再换家目录，最后换用户名本身
export function localPatterns() {
  const home = homedir();
  const user = userInfo().username;
  const tmp = realpathSync(tmpdir());
  const tmpShort = tmp.replace(/^\/private/, "");
  const varBase = dirname(tmp);
  const enc = (p) => p.replace(/[/_.]/g, "-");
  const pairs = [
    [root, "<仓库>"],
    [dirname(root), "<工作区>"],
    [`/private/tmp/claude-${process.getuid?.() ?? ""}/`, "<tmp>/claude/"],
    [enc(tmp), "-tmp"],
    [tmp, "<tmp>"],
    [tmpShort, "<tmp>"],
    [varBase, "<var-folders>"],
    [varBase.replace(/^\/private/, ""), "<var-folders>"],
    [home, "~"]
  ];
  const seen = new Set();
  const list = pairs.filter(([from]) => from && from.length > 1 && !seen.has(from) && seen.add(from)).sort((a, b) => b[0].length - a[0].length);
  // 用户名单独按整词替换（ls -l 的属主列、编码过的目录名里都有）
  return { list, user };
}

export function scrubText(text, patterns = localPatterns()) {
  let out = text;
  for (const [from, to] of patterns.list) out = out.split(from).join(to);
  // 日志里被截断成「前半段…」的路径（claude 的 task_summary 会这样）：前缀不短于 12 个字符就换掉
  for (const [from, to] of patterns.list) for (let k = from.length - 1; k >= 12; k--) out = out.split(`${from.slice(0, k)}…`).join(`${to}…`);
  if (patterns.user && patterns.user.length >= 3) out = out.replace(new RegExp(`(?<![A-Za-z0-9])${patterns.user.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?![A-Za-z0-9])`, "g"), "user");
  return out;
}

// 已跟踪的文本文件（git grep -I 跳过二进制）
export function trackedTextFiles() {
  const out = execFileSync("git", ["grep", "-I", "-l", "-e", ""], { cwd: root, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
  return out.split("\n").filter(Boolean);
}

export function findLeaks(patterns = localPatterns()) {
  const hits = [];
  for (const f of trackedTextFiles()) {
    const text = readFileSync(join(root, f), "utf8");
    const scrubbed = scrubText(text, patterns);
    if (scrubbed !== text) hits.push({ file: f, scrubbed });
  }
  return hits;
}

if (process.argv[1] && realpathSync(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const write = process.argv.includes("--write");
  const hits = findLeaks();
  for (const h of hits) {
    if (write) {
      const tmp = join(root, `${h.file}.${process.pid}.tmp`);
      writeFileSync(tmp, h.scrubbed);
      renameSync(tmp, join(root, h.file));
    }
  }
  console.log(`${write ? "已替换" : "命中"} ${hits.length} 个文件${hits.length && !write ? "（加 --write 原地替换）" : ""}`);
  if (!write) for (const h of hits.slice(0, 50)) console.log(`- ${h.file}`);
}
