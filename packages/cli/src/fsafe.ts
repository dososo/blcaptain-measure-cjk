// 路径安全（硬约束 H5）：realpath + symlink 解析，限制在工作区内；限制单文件大小和文件数。
import { realpathSync, statSync, lstatSync, readdirSync, existsSync, writeFileSync, renameSync, unlinkSync, readFileSync } from "node:fs";
import { resolve, sep, join, dirname, basename, relative, extname } from "node:path";
import { UsageError, type SkippedInput } from "./types.js";

export const MAX_FILE_BYTES = 5 * 1024 * 1024;
export const MAX_FILES = 2000;
const SKIP_DIRS = new Set(["node_modules", ".git"]);
const LINT_EXTS = new Set([".html", ".htm", ".css"]);

export function realRoot(root: string): string {
  try {
    return realpathSync(resolve(root));
  } catch {
    throw new UsageError(`工作区根目录不存在：${root}`);
  }
}

export function isInside(rootReal: string, p: string): boolean {
  return p === rootReal || p.startsWith(rootReal.endsWith(sep) ? rootReal : rootReal + sep);
}

export function rel(rootReal: string, p: string): string {
  return relative(rootReal, p).split(sep).join("/") || ".";
}

export interface Collected {
  files: string[]; // realpath，已排序
  skipped: SkippedInput[];
}

export function collectInputs(rootReal: string, inputs: string[], cwd = process.cwd()): Collected {
  const files = new Set<string>();
  const skipped: SkippedInput[] = [];
  const visitedDirs = new Set<string>();

  const addFile = (real: string, explicit = false) => {
    if (!LINT_EXTS.has(extname(real).toLowerCase())) {
      // 显式传入不支持的文件类型时报错，避免「0 个文件 → 通过」的伪成功（A-16）
      if (explicit) throw new UsageError(`不支持的文件类型：${rel(rootReal, real)}。基础档只检查 .html / .htm / .css；React、Vue 等源码请先构建再检查产物`);
      return;
    }
    const size = statSync(real).size;
    if (size > MAX_FILE_BYTES) {
      skipped.push({ file: rel(rootReal, real), reason: "too-large" });
      return;
    }
    files.add(real);
    if (files.size > MAX_FILES) throw new UsageError(`输入文件超过 ${MAX_FILES} 个上限，请缩小范围后再运行`);
  };

  const walk = (dirReal: string) => {
    if (visitedDirs.has(dirReal)) return;
    visitedDirs.add(dirReal);
    for (const ent of readdirSync(dirReal, { withFileTypes: true })) {
      if (SKIP_DIRS.has(ent.name)) continue;
      const p = join(dirReal, ent.name);
      let real: string;
      try {
        real = realpathSync(p);
      } catch {
        skipped.push({ file: rel(rootReal, p), reason: "unreadable" });
        continue;
      }
      if (!isInside(rootReal, real)) {
        skipped.push({ file: rel(rootReal, p), reason: "outside-root" });
        continue;
      }
      const st = statSync(real);
      if (st.isDirectory()) walk(real);
      else if (st.isFile()) addFile(real);
    }
  };

  if (inputs.length === 0) throw new UsageError("请至少指定一个要检查的文件或目录");
  for (const input of inputs) {
    const abs = resolve(cwd, input);
    let real: string;
    try {
      real = realpathSync(abs);
    } catch {
      throw new UsageError(`找不到输入：${input}`);
    }
    if (!isInside(rootReal, real)) {
      throw new UsageError(`输入路径在工作区之外，已拒绝：${input}（解析后为 ${real}）`);
    }
    const st = statSync(real);
    if (st.isDirectory()) walk(real);
    else addFile(real, true);
  }
  return { files: [...files].sort(), skipped: dedupeSkipped(skipped) };
}

export function dedupeSkipped(list: SkippedInput[]): SkippedInput[] {
  const seen = new Set<string>();
  return list.filter((s) => {
    const k = `${s.file}|${s.reason}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

// 解析 HTML 里引用的本地资源：只接受工作区内的相对路径
export function resolveLocalRef(rootReal: string, fromFile: string, href: string): { real?: string; remote?: string; skipped?: SkippedInput } {
  const h = href.trim();
  if (/^(https?:)?\/\//i.test(h)) return { remote: h };
  if (/^(data|blob|javascript):/i.test(h)) return {};
  const clean = h.split(/[?#]/)[0];
  if (!clean) return {};
  const abs = clean.startsWith("/") ? join(rootReal, clean) : resolve(dirname(fromFile), clean);
  if (!existsSync(abs)) return { skipped: { file: rel(rootReal, abs), reason: "unreadable" } };
  const real = realpathSync(abs);
  if (!isInside(rootReal, real)) return { skipped: { file: rel(rootReal, abs), reason: "outside-root" } };
  if (statSync(real).size > MAX_FILE_BYTES) return { skipped: { file: rel(rootReal, real), reason: "too-large" } };
  return { real };
}

// 输出路径校验 + 原子写入（硬约束 H6）
export function safeOutPath(rootReal: string, out: string, cwd = process.cwd()): string {
  const abs = resolve(cwd, out);
  const parent = dirname(abs);
  let parentReal: string;
  try {
    parentReal = realpathSync(parent);
  } catch {
    throw new UsageError(`输出目录不存在：${parent}`);
  }
  if (!isInside(rootReal, parentReal)) throw new UsageError(`输出路径在工作区之外，已拒绝：${out}`);
  const target = join(parentReal, basename(abs));
  // A-26：只允许写 .json；不能写进 .git；不能是已有目录
  if (extname(target).toLowerCase() !== ".json") throw new UsageError(`--out 只能是 .json 文件，已拒绝：${out}`);
  if (rel(rootReal, target).split("/").includes(".git")) throw new UsageError(`--out 不能写进 .git 目录，已拒绝：${out}`);
  if (existsSync(target) && statSync(target).isDirectory()) throw new UsageError(`--out 指向一个已有目录，已拒绝：${out}`);
  // A-35：已有的 .json 只有是上一次的 lint 结果才允许覆盖；package.json、配置文件、授权表等一律拒绝
  const PROTECTED = new Set(["package.json", "package-lock.json", "measure.config.json", "licenses.json", "tsconfig.json"]);
  if (PROTECTED.has(basename(target))) throw new UsageError(`--out 不能覆盖 ${basename(target)}，已拒绝`);
  if (existsSync(target)) {
    let isResult = false;
    try {
      const j = JSON.parse(readFileSync(target, "utf8"));
      isResult = j?.tool?.name === "measure-cjk" && typeof j?.schema_version === "string";
    } catch {
      isResult = false;
    }
    if (!isResult) throw new UsageError(`--out 指向的文件已存在，而且不是 measure-cjk 的结果文件，已拒绝覆盖：${out}`);
  }
  // 用 lstat 检查链接本身：existsSync 会跟随链接，悬空的符号链接会被漏掉
  let isLink = false;
  try {
    isLink = lstatSync(target).isSymbolicLink();
  } catch {
    isLink = false;
  }
  if (isLink) throw new UsageError(`输出路径是符号链接，已拒绝：${out}`);
  return target;
}

export function atomicWrite(target: string, content: string | Buffer): void {
  const tmp = `${target}.${process.pid}.${Date.now()}.tmp`;
  try {
    writeFileSync(tmp, content);
    renameSync(tmp, target);
  } catch (e) {
    if (existsSync(tmp)) unlinkSync(tmp);
    throw e;
  }
}
