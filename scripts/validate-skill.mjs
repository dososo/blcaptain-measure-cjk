// 校验 skill 格式（Agent Skills 规范）和字体授权表（schema + 时效）。
// 用法：node scripts/validate-skill.mjs [--data-only]
// 退出码：0 通过；1 有失败项。
import { readFileSync, existsSync, readdirSync } from "node:fs";
import { dirname, join, basename } from "node:path";
import { fileURLToPath } from "node:url";
import { findLeaks } from "./scrub-local-paths.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const dataOnly = process.argv.includes("--data-only");
const failures = [];
const passes = [];
const check = (ok, msg) => (ok ? passes : failures).push(msg);

// ---------- 极简 JSON Schema 校验（只实现 licenses.schema.json 用到的关键字） ----------
function validate(schema, value, path, rootSchema) {
  const errs = [];
  if (schema.$ref) {
    const ref = schema.$ref.replace(/^#\//, "").split("/");
    let target = rootSchema;
    for (const k of ref) target = target[k];
    return validate(target, value, path, rootSchema);
  }
  if (schema.anyOf) {
    const ok = schema.anyOf.some((s) => validate(s, value, path, rootSchema).length === 0);
    if (!ok) errs.push(`${path}：不满足 anyOf`);
    return errs;
  }
  if ("const" in schema && value !== schema.const) errs.push(`${path}：应为 ${JSON.stringify(schema.const)}`);
  if (schema.enum && !schema.enum.includes(value)) errs.push(`${path}：取值 ${JSON.stringify(value)} 不在枚举里`);
  if (schema.type) {
    const t = Array.isArray(value) ? "array" : value === null ? "null" : typeof value;
    if (t !== schema.type) {
      errs.push(`${path}：类型应为 ${schema.type}，实际是 ${t}`);
      return errs;
    }
  }
  if (typeof value === "string") {
    if (schema.minLength && value.length < schema.minLength) errs.push(`${path}：长度不足 ${schema.minLength}`);
    if (schema.pattern && !new RegExp(schema.pattern).test(value)) errs.push(`${path}：不匹配 ${schema.pattern}`);
  }
  if (Array.isArray(value)) {
    if (schema.minItems && value.length < schema.minItems) errs.push(`${path}：至少需要 ${schema.minItems} 项，实际 ${value.length}`);
    if (schema.items) value.forEach((v, i) => errs.push(...validate(schema.items, v, `${path}[${i}]`, rootSchema)));
  }
  if (value && typeof value === "object" && !Array.isArray(value)) {
    for (const k of schema.required ?? []) if (!(k in value)) errs.push(`${path}：缺少必填字段 ${k}`);
    for (const [k, v] of Object.entries(value)) {
      if (schema.properties?.[k]) errs.push(...validate(schema.properties[k], v, `${path}.${k}`, rootSchema));
      else if (schema.additionalProperties === false) errs.push(`${path}：不允许的字段 ${k}`);
    }
  }
  return errs;
}

// ---------- 字体授权表 ----------
const schema = JSON.parse(readFileSync(join(root, "data/fonts/licenses.schema.json"), "utf8"));
const table = JSON.parse(readFileSync(join(root, "data/fonts/licenses.json"), "utf8"));
const schemaErrs = validate(schema, table, "licenses", schema);
check(schemaErrs.length === 0, `授权表 schema 校验${schemaErrs.length ? "失败：" + schemaErrs.slice(0, 10).join("；") : "通过"}`);

const now = Date.now();
const stale = table.fonts.filter((f) => (now - Date.parse(f.verified_at)) / 86400000 > 180);
check(stale.length === 0, `授权表时效（≤ 180 天）${stale.length ? "失败：" + stale.map((f) => f.id).join(", ") : "通过"}`);

const ids = table.fonts.map((f) => f.id);
check(new Set(ids).size === ids.length, "授权表 id 唯一");
const allNames = table.fonts.flatMap((f) => f.names.map((n) => n.toLowerCase()));
const dupNames = allNames.filter((n, i) => allNames.indexOf(n) !== i);
check(dupNames.length === 0, `授权表字体名唯一${dupNames.length ? "：重复 " + dupNames.join(", ") : ""}`);
// 档位和字段的一致性：🟢 必须两项都为 true；🔵 必须能出图且不能确认可以自托管
for (const f of table.fonts) {
  if (f.tier === "embeddable") check(f.webfont_self_host === true && f.commercial_image === true, `${f.id}：embeddable 档要求 webfont_self_host 和 commercial_image 都为 true`);
  if (f.tier === "image-only") check(f.commercial_image === true && f.webfont_self_host !== true, `${f.id}：image-only 档要求 commercial_image 为 true 且 webfont_self_host 不为 true`);
  if (f.tier === "commercial") check(f.webfont_self_host === false, `${f.id}：commercial 档要求 webfont_self_host 为 false`);
}

// ---------- skill ----------
const ALLOWED = new Set(["name", "description", "license", "compatibility", "metadata", "allowed-tools"]);

// 估算 token：每个汉字和全角标点记 1，其余字符数除以 4 向上取整
function estimateTokens(text) {
  const cjk = (text.match(/[\p{Script=Han}　-〿＀-￯]/gu) ?? []).length;
  const rest = text.replace(/[\p{Script=Han}　-〿＀-￯]/gu, "").length;
  return cjk + Math.ceil(rest / 4);
}

function parseFrontmatter(src) {
  const m = src.match(/^---\n([\s\S]*?)\n---\n?/);
  if (!m) return null;
  const fm = {};
  let currentKey = null;
  for (const line of m[1].split("\n")) {
    const top = line.match(/^([A-Za-z][\w-]*):\s?(.*)$/);
    if (top) {
      currentKey = top[1];
      fm[currentKey] = top[2];
    } else if (currentKey && /^\s+/.test(line)) {
      fm[currentKey] += "\n" + line;
    }
  }
  return { fm, body: src.slice(m[0].length) };
}

if (!dataOnly) {
  const skillDir = join(root, "skills/measure");
  const skillPath = join(skillDir, "SKILL.md");
  check(existsSync(skillPath), "skills/measure/SKILL.md 存在");
  if (existsSync(skillPath)) {
    const src = readFileSync(skillPath, "utf8");
    const parsed = parseFrontmatter(src);
    check(parsed !== null, "SKILL.md 有 frontmatter");
    if (parsed) {
      const keys = Object.keys(parsed.fm);
      const bad = keys.filter((k) => !ALLOWED.has(k));
      check(bad.length === 0, `frontmatter 只用白名单字段${bad.length ? "：多出 " + bad.join(", ") : ""}`);
      const name = (parsed.fm.name ?? "").trim();
      check(name === basename(skillDir), `name（${name}）与目录名（${basename(skillDir)}）一致`);
      check(/^[a-z0-9]+(-[a-z0-9]+)*$/.test(name) && name.length <= 64, "name 只用小写 ASCII 字母、数字和单个连字符，≤ 64 字符");
      check(!/claude|anthropic/i.test(name), "name 不含 claude 或 anthropic");
      let desc = (parsed.fm.description ?? "").trim();
      if (/^[>|][-+]?$/.test(desc.split("\n")[0])) desc = desc.split("\n").slice(1).map((l) => l.trim()).join(" ");
      desc = desc.replace(/^["']|["']$/g, "");
      check(desc.length > 0 && desc.length <= 1024, `description 长度 ${desc.length}（1–1024）`);
      check(!/<[a-zA-Z/][^>]*>/.test(desc), "description 不含 XML 标签");
      check(!/^(我|你)/.test(desc), "description 用第三人称（不以「我 / 你」开头）");
      const lines = parsed.body.split("\n").length;
      check(lines <= 300, `正文行数 ${lines}（≤ 300）`);
      const tokens = estimateTokens(parsed.body);
      check(tokens < 5000, `正文估算 token ${tokens}（< 5000，估算法：汉字和全角标点记 1，其余字符 ÷ 4）`);
      check(/version:/.test(parsed.fm.metadata ?? ""), "metadata 里有 version");
      check(/short-description:/.test(parsed.fm.metadata ?? ""), "metadata 里有 short-description（Codex 用）");
    }
  }
  check(!existsSync(join(root, "bin")), "plugin 根目录没有 bin/ 目录");
  for (const f of [".claude-plugin/plugin.json", ".claude-plugin/marketplace.json"]) {
    const p = join(root, f);
    check(existsSync(p), `${f} 存在`);
    if (existsSync(p)) {
      const j = JSON.parse(readFileSync(p, "utf8"));
      if (f.endsWith("plugin.json")) check(typeof j.name === "string" && j.name.length > 0, "plugin.json 有 name");
      else check(typeof j.name === "string" && typeof j.owner?.name === "string" && Array.isArray(j.plugins) && j.plugins.every((x) => x.name && x.source), "marketplace.json 必填字段齐全（name、owner.name、plugins[].name、plugins[].source）");
    }
  }
}

// 主题（PRD §5.3）：6 个，每个一个文件、≤ 8 KB，传统风最多 2 个；每个都要有 CSS 代码块、字号阶梯、该做和不该做
{
  const themeDir = join(root, "skills", "measure", "references", "themes");
  const files = existsSync(themeDir) ? readdirSync(themeDir).filter((f) => f.endsWith(".md")) : [];
  check(files.length === 6, `主题文件 ${files.length} 个（应为 6 个）`);
  let traditional = 0;
  for (const f of files) {
    const md = readFileSync(join(themeDir, f), "utf8");
    const size = Buffer.byteLength(md);
    check(size <= 8192, `主题 ${f}：${size} 字节（≤ 8192）`);
    check(/```css\n[\s\S]*?```/.test(md) && /## 字号阶梯/.test(md) && /## 该做/.test(md) && /## 不该做/.test(md), `主题 ${f}：有 CSS 代码块、字号阶梯、该做、不该做`);
    check(!/linear-gradient\([^)]*(#7c3aed|#764ba2|#6366f1|#8b5cf6)|backdrop-filter/i.test(md), `主题 ${f}：不用紫色渐变、玻璃拟态`);
    // 示例截图（AUDIT_RELEASE RA-11）：链接写发布后的地址，仓库里要有对应的图
    const id = f.replace(/\.md$/, "");
    const shot = md.match(/^- 截图：<https:\/\/dososo\.github\.io\/blcaptain-measure-cjk\/(site\/shots\/theme-([a-z]+)\.jpg)>$/m);
    check(Boolean(shot) && shot[2] === id && existsSync(join(root, shot[1])), `主题 ${f}：有示例截图链接，仓库里有 site/shots/theme-${id}.jpg`);
    // 字号阶梯表：字号越大字重越轻（AUDIT_RELEASE RA-03）；字重写成区间的按下限比较
    const rows = [...md.matchAll(/^\| [^|]+ \| (\d+)px[^|]* \| (\d+)[^|]* \| [^|]+ \|$/gm)].map((m) => ({ size: Number(m[1]), weight: Number(m[2]) }));
    const inverted = rows.some((a) => rows.some((b) => a.size > b.size && a.weight > b.weight));
    check(rows.length >= 3 && !inverted, `主题 ${f}：字号阶梯 ${rows.length} 行，字号越大字重不更重`);
    if (/^- 传统风：是/m.test(md)) traditional++;
  }
  check(traditional <= 2, `传统风主题 ${traditional} 个（≤ 2）`);
}

// 版本号一致（AUDIT_RELEASE RA-20）：SKILL.md 的 metadata.version 和 npx 固定版本、npm 包及其 shrinkwrap、两个插件清单
{
  const read = (f) => readFileSync(join(root, f), "utf8");
  const skill = read("skills/measure/SKILL.md");
  const versions = {
    "SKILL.md metadata.version": skill.match(/^\s+version:\s*(\S+)/m)?.[1],
    "SKILL.md 里的 npx 固定版本": skill.match(/measure-cjk@(\d+\.\d+\.\d+)/)?.[1],
    "packages/cli/package.json": JSON.parse(read("packages/cli/package.json")).version,
    ".claude-plugin/plugin.json": JSON.parse(read(".claude-plugin/plugin.json")).version,
    ".codex-plugin/plugin.json": JSON.parse(read(".codex-plugin/plugin.json")).version,
    "packages/cli/npm-shrinkwrap.json": JSON.parse(read("packages/cli/npm-shrinkwrap.json")).version
  };
  check(new Set(Object.values(versions)).size === 1 && !Object.values(versions).includes(undefined), `版本号一致：${Object.entries(versions).map(([k, v]) => `${k} ${v}`).join("，")}`);
}

// 公开仓库前的本机信息检查：已跟踪的文本文件里不能有本机家目录、用户名、临时目录（发现后运行 node scripts/scrub-local-paths.mjs --write）
{
  const leaks = findLeaks();
  check(leaks.length === 0, `本机路径：${leaks.length ? `${leaks.length} 个文件含本机家目录、用户名或临时目录，例如 ${leaks.slice(0, 3).map((l) => l.file).join("、")}` : "已跟踪的文件里没有"}`);
}

for (const p of passes) console.log(`✓ ${p}`);
for (const f of failures) console.log(`✗ ${f}`);
console.log(`\n${passes.length} 项通过，${failures.length} 项失败`);
process.exit(failures.length ? 1 : 0);
