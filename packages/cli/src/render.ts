// 完整档（--render）：在真实浏览器里按多个宽度渲染页面，用计算后的样式和 Range.getClientRects() 实测，
// 每条 error 截一张元素级截图放进 evidence/（PRD §5.4）。
// - 浏览器：优先用 playwright 自带的 Chromium；没有就用系统的 Chrome / Edge（playwright-core 同样支持）。都没有时退出码 2，不降级成基础档。
// - 网络：本地文件页面只能读工作区内的 file://，连 localhost 也连不上；URL 页面只能访问 localhost（--allow-remote 时才放开远程）。
//   两类页面用两个浏览器实例分别检查（RA-19）。其余请求一律拦截并记录。
// - 隔离：每个页面一个独立的浏览器上下文，禁用 Service Worker 和下载；测量代码在 CDP 隔离环境里执行，页面脚本改写不了它（RA-02）；
//   测量结果回到 Node 一侧后还要再校验一遍（RA-01）。单页 15 秒上限，超时记为 timeout，结果为 incomplete。
// - 没检查完的情况一律 incomplete：超时、打不开、HTTP 错误（RA-06）、加载后跳转（RA-05）、渲染后看不见任何中文（RA-04）。
import { createRequire } from "node:module";
import { existsSync, lstatSync, mkdirSync, readFileSync, realpathSync, statSync } from "node:fs";
import { basename, dirname, extname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { buildPage, type PageModel } from "./model.js";
import type { AnyNode, Element } from "domhandler";
import { atomicWrite, collectInputs, isInside, MAX_FILE_BYTES, realRoot, rel } from "./fsafe.js";
import { DEFAULT_WIDTHS, defaultConfig, validateWidths } from "./config.js";
import { finishResult, lintCssFile, lintPageInto, newAccum, URL_INPUT, type Accum, type LintOptions } from "./lint.js";
import { pageBudgetMs } from "./rules.js";
import { ruleMeta } from "./rulesMeta.js";
import { locateElement, markElement, measurePage, snapshotPage, type ProbeItem, type ProbeOptions } from "./probe.js";
import { EL_ORD, EL_TEXT, EnvError, UsageError, elOrd, elText, type Finding, type LintResult, type MeasureConfig, type RuleId, type SkippedInput } from "./types.js";

export const RENDER_BUDGET_MS = 15_000;
const VIEWPORT_HEIGHT = 800;
const PER_RULE_CAP = 20;
const MAX_SHOT_HEIGHT = 1200;
const MAX_SHOT_WIDTH = 1600;
const REGISTRY_KEY = "__measureCjkElements";
export const MARK_ID = "__measure-cjk-mark";

// 完整档实测的结果取代基础档的近似判断——按元素取代：只有完整档实测过的元素，基础档那条才去掉（RA-04）。
// T08 两边都保留（基础档看声明来源，完整档看实际是否合成假斜体），同一元素只留完整档那条
const REPLACED_BY_RENDER = new Set(["T04", "T05", "T06", "T07", "T11"]);
// 测量函数能报的规则：返回值里出现别的规则 ID 一律丢弃（RA-01）
const PROBE_RULES = new Set(["T02", "T04", "T05", "T06", "T07", "T08", "T11", "T12", "A01", "A11"]);

export const INSTALL_HINT = "用了 --render，但没有找到 Playwright。完整档需要它来驱动浏览器，不会静默降级成基础档。\n请在运行 measure-cjk 的项目目录里安装：npm install -D playwright && npx playwright install chromium\n（本机已有 Chrome 或 Edge 时，只装 npm install -D playwright-core 也可以。）\nmeasure-cjk 是全局安装的、又不想改项目时，也可以全局安装：npm install -g playwright-core";

// 单页渲染耗时上限：默认 15 秒；环境变量 MEASURE_RENDER_BUDGET_MS 只能调低（测试、排查用），不能调高
export function renderBudgetMs(): number {
  const raw = process.env.MEASURE_RENDER_BUDGET_MS;
  if (raw === undefined || raw === "") return RENDER_BUDGET_MS;
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 1000 || n > RENDER_BUDGET_MS) throw new UsageError(`MEASURE_RENDER_BUDGET_MS 只能是 1000 到 ${RENDER_BUDGET_MS} 之间的数字（只能调低，不能调高）`);
  return n;
}

export interface RenderOptions extends LintOptions {
  widths?: number[];
  evidenceDir?: string; // 默认：工作区根目录下的 evidence/
  allowRemote?: boolean;
  card?: CardHooks;
}

// card 命令（AUDIT_CARD CA-05）：卡片的 lint 和导出在同一次渲染里完成——同一个视口、同一批注入的字体、同样的拦截规则。
// card 通过这几个挂钩接进完整档的渲染流程；普通的 lint --render 不传，行为不变
export interface PageWorld {
  cdp: Cdp;
  frameId: string;
  evaluate: (fn: ((a: any) => unknown) | string, arg?: unknown) => Promise<any>;
}
export interface CardHooks {
  viewportHeight: number;
  snapshotSkipId: string; // 注入字体的 <style> 的 id：DOM 快照里去掉它
  route: (route: any, req: any, url: string) => Promise<boolean>; // 返回 true 表示已经处理了这个请求
  beforeLoad: (cdp: Cdp) => Promise<void>; // 打开页面之前：开启事件监听
  afterLoad: (page: Page, w: PageWorld) => Promise<void>; // 页面和字体加载完、测量之前：冻结动画
  afterMeasure: (page: Page, w: PageWorld) => Promise<void>; // 测量全部完成、页面判为检查完之前：查字体、截图
}

// 关闭页面和浏览器设时间上限（AUDIT_CARD CA-12）：卡死的页面不能让整个命令无限期地等下去
const CLOSE_BUDGET_MS = 5_000;
export function closeWithin(p: Promise<unknown>, ms = CLOSE_BUDGET_MS): Promise<void> {
  return withDeadline(p, ms, () => undefined).then(() => undefined, () => undefined);
}

export function isLoopback(hostname: string): boolean {
  const h = hostname.replace(/^\[|\]$/g, "").toLowerCase();
  return h === "localhost" || h.endsWith(".localhost") || h === "127.0.0.1" || h === "::1";
}

function checkUrlInput(input: string, allowRemote: boolean): URL {
  let u: URL;
  try {
    u = new URL(input);
  } catch {
    throw new UsageError(`无法解析的 URL：${input}`);
  }
  if (u.protocol !== "http:" && u.protocol !== "https:") throw new UsageError(`URL 只支持 http 和 https：${input}`);
  if (u.username || u.password) throw new UsageError("URL 里不能带用户名或密码");
  if (!isLoopback(u.hostname) && !allowRemote) throw new UsageError(`完整档默认只允许检查 localhost；检查远程地址必须显式加 --allow-remote：${input}`);
  return u;
}

// 截图目录：必须在工作区内，不能是符号链接，不能在 .git 里；不存在时先只校验上级目录，第一次写截图时再创建
function evidenceTarget(rootReal: string, dir: string, cwd: string): { path: string; ensure: () => void } {
  const abs = resolve(cwd, dir);
  let st;
  try {
    st = lstatSync(abs);
  } catch {
    st = undefined;
  }
  if (st) {
    if (st.isSymbolicLink()) throw new UsageError(`截图目录是符号链接，已拒绝：${dir}`);
    if (!st.isDirectory()) throw new UsageError(`截图目录不是目录，已拒绝：${dir}`);
    const real = realpathSync(abs);
    if (!isInside(rootReal, real) || real === rootReal) throw new UsageError(`截图目录必须在工作区之内（且不能是工作区根目录本身），已拒绝：${dir}`);
    if (rel(rootReal, real).split("/").includes(".git")) throw new UsageError(`截图目录不能在 .git 里，已拒绝：${dir}`);
    return { path: real, ensure: () => undefined };
  }
  let parentReal: string;
  try {
    parentReal = realpathSync(dirname(abs));
  } catch {
    throw new UsageError(`截图目录的上级目录不存在：${dirname(abs)}`);
  }
  if (!isInside(rootReal, parentReal)) throw new UsageError(`截图目录必须在工作区之内，已拒绝：${dir}`);
  const target = join(parentReal, basename(abs));
  if (rel(rootReal, target).split("/").includes(".git")) throw new UsageError(`截图目录不能在 .git 里，已拒绝：${dir}`);
  return {
    path: target,
    ensure: () => {
      if (!existsSync(target)) mkdirSync(target);
      if (lstatSync(target).isSymbolicLink()) throw new UsageError(`截图目录是符号链接，已拒绝：${dir}`);
    }
  };
}

export const MIME: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".htm": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".json": "application/json",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".avif": "image/avif",
  ".ico": "image/x-icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf",
  ".otf": "font/otf"
};


/* eslint-disable @typescript-eslint/no-explicit-any -- playwright 是可选依赖，不引入它的类型 */
type Browser = any;
type Page = any;
type Cdp = any;

// Node 一侧校验测量结果（RA-01）：规则 ID 在白名单里，级别只能是 error / warn，序号是 ≥ -1 的整数，文字限长
export function sanitizeProbeItems(raw: unknown): { items: ProbeItem[]; rejected: number } {
  if (!Array.isArray(raw)) return { items: [], rejected: 0 };
  const items: ProbeItem[] = [];
  let rejected = 0;
  for (const x of raw as unknown[]) {
    const o = x as Partial<ProbeItem> | null;
    const ok =
      !!o && typeof o === "object" && typeof o.rule === "string" && PROBE_RULES.has(o.rule) && (o.severity === "error" || o.severity === "warn") &&
      typeof o.idx === "number" && Number.isInteger(o.idx) && o.idx >= -1 && typeof o.selector === "string" && typeof o.message === "string";
    if (!ok) {
      rejected++;
      continue;
    }
    const ord = typeof o.ord === "number" && Number.isInteger(o.ord) && o.ord >= 0 ? o.ord : 0;
    items.push({ rule: o.rule!, severity: o.severity!, idx: o.idx!, selector: o.selector!.slice(0, 300), text: typeof o.text === "string" ? o.text.slice(0, 40) : "", ord, message: o.message!.slice(0, 600) });
  }
  return { items, rejected };
}

export type Mode = "file" | "url";

export async function launchBrowser(mode: Mode, allowRemote: boolean): Promise<{ browser: Browser; label: string }> {
  let chromium: any;
  let pkg = "";
  // 先从 measure-cjk 自己的位置找，再从当前项目目录找（AUDIT_RELEASE RA-01）：全局安装或用 npx 运行 measure-cjk 时，
  // Playwright 通常装在用户的项目里，按 measure-cjk 自己的位置解析找不到它
  const fromCwd = createRequire(join(process.cwd(), "__measure-cjk__.js"));
  const loaders: [string, () => Promise<any>][] = [];
  for (const name of ["playwright", "playwright-core"]) loaders.push([name, () => import(name)]);
  for (const name of ["playwright", "playwright-core"]) loaders.push([name, () => import(pathToFileURL(fromCwd.resolve(name)).href)]);
  for (const [name, load] of loaders) {
    try {
      const mod: any = await load();
      chromium = mod.chromium ?? mod.default?.chromium;
      if (chromium) {
        pkg = name;
        break;
      }
    } catch (e) {
      const code = (e as { code?: string }).code;
      if (code !== "ERR_MODULE_NOT_FOUND" && code !== "MODULE_NOT_FOUND") throw e;
    }
  }
  if (!chromium) throw new EnvError(INSTALL_HINT);

  // 纵深防御：除了逐个请求拦截，还把浏览器的 DNS 解析和代理都指向不存在的地方，
  // 预连接、DNS 预取、iframe、表单这类连接也出不去；WebRTC 禁止走非代理的 UDP。
  // 本地文件模式连 localhost 也不放行（代理的 <-loopback> 让本机地址也走代理，RA-19）；
  // URL 模式放行 localhost 的四种写法（MAP * 连 IP 字面量也会拦，所以逐一排除，和 isLoopback 一致）
  const args = ["--force-webrtc-ip-handling-policy=disable_non_proxied_udp"];
  let proxy: { server: string; bypass: string } | undefined;
  if (mode === "file") {
    args.push("--host-resolver-rules=MAP * ~NOTFOUND");
    proxy = { server: "http://127.0.0.1:9", bypass: "<-loopback>" };
  } else if (!allowRemote) {
    args.push("--host-resolver-rules=MAP * ~NOTFOUND , EXCLUDE localhost , EXCLUDE *.localhost , EXCLUDE 127.0.0.1 , EXCLUDE [::1]");
    proxy = { server: "http://127.0.0.1:9", bypass: "localhost,*.localhost,127.0.0.1,[::1]" };
  }
  const tries: { label: string; opts: Record<string, unknown> }[] = [
    { label: `${pkg} 自带的 Chromium`, opts: {} },
    { label: "系统 Chrome", opts: { channel: "chrome" } },
    { label: "系统 Edge", opts: { channel: "msedge" } }
  ];
  const errors: string[] = [];
  for (const t of tries) {
    try {
      const browser = await chromium.launch({ headless: true, args, proxy, ...t.opts });
      return { browser, label: `${t.label} ${browser.version()}（${pkg}）` };
    } catch (e) {
      errors.push(`${t.label}：${String((e as Error).message ?? e).split("\n")[0]}`);
    }
  }
  throw new EnvError(`找到了 ${pkg}，但启动不了任何浏览器。请运行 npx playwright install chromium，或者安装 Chrome。\n${errors.join("\n")}`);
}

interface Target {
  kind: Mode;
  url: string;
  file: string; // 结果里的 file 字段：本地文件是相对工作区的路径，URL 就是 URL 本身
  real?: string;
}

interface RunCtx {
  rootReal: string;
  viewportHeight: number;
  hooks?: CardHooks;
  config: MeasureConfig;
  widths: number[];
  allowRemote: boolean;
  acc: Accum;
  evidence: { path: string; ensure: () => void };
  shotCounter: Map<string, number>;
  problems: { file: string; detail: string }[];
}

interface StaticInfo {
  errors: Finding[]; // 本页基础档的全部 error（同一批对象，截图写回 evidence）
  lineOf: Map<string, { line: number; text: string }>;
  lineByText: Map<string, number | null>; // 文字指纹 → 行号；同一指纹出现多次时为 null（不唯一，不用）
  textsOf: (f: Finding) => string[]; // 这条基础档结论对应的元素（按选择器找）的文字指纹（结论本身没带指纹时才用）
  domAdded: Finding[]; // 从 DOM 快照补进来的结论：页面判为「换了文档」时要撤回（RC-02）
  srcBaseCount: (base: string) => number; // 基础档模型里「选择器 + \u0001 + 文字指纹」相同的元素个数（RF-01）
  hasCjk: boolean;
}

interface PageOutcome {
  ok: boolean;
  findings: Finding[];
  ids: Set<string>; // 浏览器里登记过的元素（选择器 + \u0001 + 文字指纹 + \u0001 + 序号），各宽度取并集
  byBase?: Map<string, string[]>; // 「选择器 + 指纹」→ 身份列表、文字指纹 → 身份列表：按需建一次，避免每条结论都遍历全部身份（RG-02）
  byText?: Map<string, string[]>;
  checked: Map<string, Set<string>>; // 规则 → 在任一宽度下做过这条规则检查的元素，各宽度取并集（RC-01）
  hits: Set<string>; // 完整档报过的「规则|元素身份」（身份完全相同，RD-01）：只用于 T08 两边去重
  autospaceSupported: boolean;
}

function emptyOutcome(): PageOutcome {
  return { ok: false, findings: [], ids: new Set(), checked: new Map(), hits: new Set(), autospaceSupported: true };
}

export function withDeadline<T>(p: Promise<T>, ms: number, onTimeout: () => void): Promise<T | "timeout"> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const t = new Promise<"timeout">((ok) => {
    timer = setTimeout(() => {
      onTimeout();
      ok("timeout");
    }, ms);
  });
  p.catch(() => undefined); // 超时后关闭上下文，原来的 promise 会被拒绝，这里吞掉，避免未处理的拒绝
  return Promise.race([p, t]).finally(() => clearTimeout(timer));
}

// 在 CDP 隔离环境里执行一个自包含函数，返回 JSON 值
async function inWorld(cdp: Cdp, contextId: number, fn: ((a: any) => unknown) | string, arg?: unknown): Promise<any> {
  const expression = typeof fn === "string" ? fn : `(${fn.toString()})(${arg === undefined ? "" : JSON.stringify(arg)})`;
  const r = await cdp.send("Runtime.evaluate", { expression, contextId, returnByValue: true, awaitPromise: true });
  if (r.exceptionDetails) throw new Error(`测量代码出错：${r.exceptionDetails.exception?.description ?? r.exceptionDetails.text}`);
  return r.result?.value;
}

const EVIDENCE_RULE = /^[TFA]\d{2}$/;

async function screenshot(page: Page, world: { cdp: Cdp; id: number }, ctx: RunCtx, rule: string, at: { idx?: number; selector?: string }): Promise<string> {
  if (!EVIDENCE_RULE.test(rule)) throw new Error(`非法的规则 ID：${rule}`);
  const rect = (await inWorld(world.cdp, world.id, locateElement, { key: REGISTRY_KEY, ...at })) as { x: number; y: number; width: number; height: number } | null;
  const size = (await inWorld(world.cdp, world.id, "({ w: document.documentElement.scrollWidth, h: document.documentElement.scrollHeight })")) as { w: number; h: number };
  const vw = page.viewportSize()?.width ?? 1280;
  let clip: { x: number; y: number; width: number; height: number };
  if (rect) {
    const x = Math.max(0, Math.floor(rect.x - 12));
    const y = Math.max(0, Math.floor(rect.y - 12));
    clip = { x, y, width: Math.max(1, Math.min(Math.ceil(rect.width + 24), MAX_SHOT_WIDTH, Math.max(size.w, vw) - x)), height: Math.max(1, Math.min(Math.ceil(rect.height + 24), MAX_SHOT_HEIGHT, size.h - y)) };
    await inWorld(world.cdp, world.id, markElement, { id: MARK_ID, rect });
  } else {
    // 页面级的问题（例如 T01）或看不见的元素：截首屏
    clip = { x: 0, y: 0, width: vw, height: Math.min(ctx.viewportHeight, Math.max(1, size.h)) };
  }
  let buf: Buffer;
  try {
    // card 模式下动画已经冻结；不能用 animations: "disabled"，它会把动画快进到终点，改变页面状态（AUDIT_CARD CA-02）
    // card 模式下也不让 Playwright 往页面里插隐藏光标的样式：那是一次 DOM 变化（CB-01 的检测会把它当成页面被改了）；光标已经由冻结样式设成透明
    buf = await page.screenshot({ clip, fullPage: true, animations: ctx.hooks ? "allow" : "disabled", caret: ctx.hooks ? "initial" : "hide" });
  } finally {
    if (rect) await inWorld(world.cdp, world.id, markElement, { id: MARK_ID, rect: null });
  }
  ctx.evidence.ensure();
  const n = (ctx.shotCounter.get(rule) ?? 0) + 1;
  ctx.shotCounter.set(rule, n);
  const target = resolve(ctx.evidence.path, `${rule}-${String(n).padStart(3, "0")}.png`);
  if (dirname(target) !== ctx.evidence.path) throw new Error(`截图路径越界：${target}`);
  atomicWrite(target, buf);
  return rel(ctx.rootReal, target);
}

// 弹出窗口的第一次导航还没有 frame，Playwright 会抛错：这种请求不属于主页面
export function isMainFrame(req: any, page: Page): boolean {
  try {
    return req.frame() === page.mainFrame();
  } catch {
    return false;
  }
}

function fixHint(rule: string): string {
  const meta = ruleMeta(rule);
  return meta ? `见 skills/measure/${meta.doc}` : "";
}

function incomplete(ctx: RunCtx, target: Target, reason: SkippedInput["reason"], detail: string): void {
  ctx.acc.skipped.push({ file: target.file, reason });
  ctx.acc.incomplete = true;
  ctx.problems.push({ file: target.file, detail });
}

// 测量结果里的元素身份列表：校验后并入 into（各宽度取并集）。超过上限时返回 false：
// 不静默截断（RG-01），调用方把这一页记为没检查完
const MAX_IDS = 200_000;
function mergeIds(into: Set<string>, raw: unknown): boolean {
  if (!Array.isArray(raw)) return true;
  if (raw.length > MAX_IDS) return false;
  for (const x of raw) if (typeof x === "string") into.add(x.slice(0, 400));
  return true;
}

// 子框架里有没有中文（RB-04）：在每个子框架里各建一个隔离环境检查；建不了（例如跨进程的框架）按「无法确认」处理
async function framesWithCjk(cdp: Cdp): Promise<{ withCjk: string[]; unknown: string[] }> {
  const { frameTree } = await cdp.send("Page.getFrameTree");
  const out = { withCjk: [] as string[], unknown: [] as string[] };
  const walk = async (node: any) => {
    for (const child of node.childFrames ?? []) {
      const url = String(child.frame.url ?? "").slice(0, 200);
      // 被拦截的 iframe 显示的是 Chrome 的错误页（中文系统下是中文），不是页面内容；地址已经记进 remote_refs（RC-02）
      if (url.startsWith("chrome-error:")) continue;
      try {
        const { executionContextId } = await cdp.send("Page.createIsolatedWorld", { frameId: child.frame.id, worldName: "measure-cjk-frame" });
        if (await inWorld(cdp, executionContextId, "!!document.body && /\\p{Script=Han}/u.test(document.body.innerText || '')")) out.withCjk.push(url);
      } catch {
        out.unknown.push(url);
      }
      await walk(child);
    }
  };
  await walk(frameTree);
  return out;
}

async function renderOne(browser: Browser, target: Target, ctx: RunCtx, staticPass: (snapshot: string) => StaticInfo): Promise<PageOutcome> {
  const { rootReal, config } = ctx;
  const context = await browser.newContext({
    viewport: { width: ctx.widths[0], height: ctx.viewportHeight },
    // 固定浏览器语言，结果不随操作系统语言变化；没写 lang 的中文也按简体中文选字体（RC-02）
    locale: "zh-CN",
    deviceScaleFactor: 1,
    serviceWorkers: "block",
    acceptDownloads: false
  });
  const outcome = emptyOutcome();
  let mainPage: Page | undefined;
  let navigations = 0;
  let navigatedTo = "";
  const run = async () => {
    await context.route("**/*", async (route: any) => {
      const req = route.request();
      const url: string = req.url();
      // RA-05：主页面只允许第一次导航；加载后再跳转（location.replace、meta refresh、表单提交）一律拦下并记为没检查完
      if (mainPage && req.isNavigationRequest() && isMainFrame(req, mainPage)) {
        navigations++;
        if (navigations > 1) {
          navigatedTo = navigatedTo || url;
          return route.abort("blockedbyclient");
        }
      }
      if (ctx.hooks && (await ctx.hooks.route(route, req, url))) return;
      let u: URL;
      try {
        u = new URL(url);
      } catch {
        return route.abort("blockedbyclient");
      }
      if (u.protocol === "file:") {
        if (target.kind !== "file") return route.abort("blockedbyclient");
        let real: string | undefined;
        try {
          real = realpathSync(fileURLToPath(u));
        } catch {
          real = undefined;
        }
        if (!real) return route.abort("failed");
        if (!isInside(rootReal, real) || rel(rootReal, real).split("/").includes(".git")) {
          ctx.acc.skipped.push({ file: rel(rootReal, real), reason: "outside-root" });
          return route.abort("blockedbyclient");
        }
        const st = statSync(real);
        if (!st.isFile()) return route.abort("blockedbyclient");
        if (st.size > MAX_FILE_BYTES) {
          ctx.acc.skipped.push({ file: rel(rootReal, real), reason: "too-large" });
          return route.abort("blockedbyclient");
        }
        return route.fulfill({ status: 200, contentType: MIME[extname(real).toLowerCase()] ?? "application/octet-stream", body: readFileSync(real) });
      }
      if ((u.protocol === "http:" || u.protocol === "https:") && target.kind === "url" && (isLoopback(u.hostname) || ctx.allowRemote)) return route.continue();
      if (ctx.acc.remoteRefs.size < 200) ctx.acc.remoteRefs.add(url);
      return route.abort("blockedbyclient");
    });
    if (typeof context.routeWebSocket === "function") {
      await context.routeWebSocket(/.*/, (ws: any) => {
        let host = "";
        try {
          host = new URL(ws.url()).hostname;
        } catch {
          host = "";
        }
        if (target.kind === "url" && (isLoopback(host) || ctx.allowRemote)) ws.connectToServer();
        else {
          if (ctx.acc.remoteRefs.size < 200) ctx.acc.remoteRefs.add(ws.url());
          ws.close();
        }
      });
    }
    // 页面用 window.open 打开的新窗口直接关掉，不检查
    context.on("page", (p: Page) => {
      if (mainPage && p !== mainPage) p.close().catch(() => undefined);
    });
    const page = await context.newPage();
    mainPage = page;
    // RB-03：不经过网络的跳转（blob:、javascript:）路由拦不住，用两个信号判断「加载后换了文档」：
    // ① 主框架提交的文档多于一个（blob: 跳转、解析阶段的跳转都会多一次）；
    // ② 主框架最近一次提交之后，新建了不止一个默认执行环境（javascript: 地址替换文档时不算一次导航，但会再新建一个）。
    // history.pushState 不换文档，两个信号都不会触发
    const cdp = await context.newCDPSession(page);
    let mainId = "";
    let mainCommits = 0;
    let contextsSinceCommit = 0;
    cdp.on("Page.frameNavigated", (e: any) => {
      if (e?.frame?.parentId) return;
      mainId = String(e.frame.id);
      mainCommits++;
      contextsSinceCommit = 0;
    });
    cdp.on("Runtime.executionContextCreated", (e: any) => {
      const aux = e?.context?.auxData;
      if (aux?.isDefault && aux.frameId === mainId) contextsSinceCommit++;
    });
    await cdp.send("Page.enable");
    await cdp.send("Runtime.enable");
    if (ctx.hooks) await ctx.hooks.beforeLoad(cdp);
    const resp = await page.goto(target.url, { waitUntil: "load" });
    // RA-06：HTTP 错误页不算检查完
    if (!resp) return incomplete(ctx, target, "unreadable", "完整档：页面没有返回响应");
    if (resp.status() >= 400) return incomplete(ctx, target, "http-error", `完整档：页面返回 HTTP ${resp.status()}`);
    if (page.url().startsWith("chrome-error:")) return incomplete(ctx, target, "unreadable", "完整档：页面加载后显示的是浏览器的错误页（例如跳转被拦截）");

    const { frameTree } = await cdp.send("Page.getFrameTree");

    const { executionContextId } = await cdp.send("Page.createIsolatedWorld", { frameId: frameTree.frame.id, worldName: "measure-cjk" });
    const world = { cdp, id: executionContextId as number };
    await inWorld(cdp, world.id, "document.fonts.ready.then(() => true)");
    const pageWorld: PageWorld = { cdp, frameId: String(frameTree.frame.id), evaluate: (fn, arg) => inWorld(cdp, world.id, fn, arg) };
    if (ctx.hooks) await ctx.hooks.afterLoad(page, pageWorld);

    // 主框架已经换成错误页（例如加载后的跳转被拦截）时，不取 DOM 快照，避免把错误页当成页面内容（RC-02）
    const st = staticPass(page.url().startsWith("chrome-error:") ? "" : ((await inWorld(cdp, world.id, snapshotPage, ctx.hooks?.snapshotSkipId)) as string));
    const withdraw = () => {
      const added = new Set(st.domAdded);
      ctx.acc.findings = ctx.acc.findings.filter((f) => !added.has(f));
    };

    const probeOpts: ProbeOptions = {
      key: REGISTRY_KEY,
      spacingCss: config.spacing === "css",
      lineWarn: config.thresholds.line_length_warn,
      lineError: config.thresholds.line_length_error,
      lineHeightMin: config.thresholds.body_line_height_min,
      minBodyPx: config.thresholds.min_font_px_body
    };
    const merged = new Map<string, { f: Finding; widths: number[] }>();
    const perRule = new Map<string, number>();
    const omitted = new Map<string, Set<string>>(); // RA-14：被省略的元素按 规则 → 选择器 去重
    let visibleMax = 0;
    const lineFor = (it: ProbeItem): number | undefined => {
      if (target.kind !== "file") return undefined;
      const bySel = st.lineOf.get(it.selector);
      if (bySel && bySel.text === it.text) return bySel.line;
      return it.text ? (st.lineByText.get(it.text) ?? undefined) : undefined; // RA-16：对不上就不给行号
    };

    for (const w of ctx.widths) {
      await page.setViewportSize({ width: w, height: ctx.viewportHeight });
      await inWorld(cdp, world.id, "new Promise((ok) => requestAnimationFrame(() => requestAnimationFrame(() => ok(true))))");
      const res = (await inWorld(cdp, world.id, measurePage, probeOpts)) as { autospaceSupported?: unknown; visible?: unknown; ids?: unknown; checked?: unknown; items?: unknown } | null;
      const { items, rejected } = sanitizeProbeItems(res?.items);
      if (rejected > 0) return incomplete(ctx, target, "unreadable", `完整档：测量结果里有 ${rejected} 条格式不对，已丢弃，本页不能判通过`);
      outcome.autospaceSupported = res?.autospaceSupported === true;
      visibleMax = Math.max(visibleMax, typeof res?.visible === "number" ? res.visible : 0);
      let within = mergeIds(outcome.ids, res?.ids);
      if (res?.checked && typeof res.checked === "object") {
        for (const [rule, list] of Object.entries(res.checked as Record<string, unknown>)) {
          if (!PROBE_RULES.has(rule)) continue;
          if (!outcome.checked.has(rule)) outcome.checked.set(rule, new Set());
          within = mergeIds(outcome.checked.get(rule)!, list) && within;
        }
      }
      if (!within) return incomplete(ctx, target, "unreadable", `完整档：页面上的中文元素超过 ${MAX_IDS} 个，无法和基础档的结论一一对应，本页不能判通过`);
      for (const it of items) {
        outcome.hits.add(`${it.rule}|${it.selector}\u0001${it.text}\u0001${it.ord}`);
        // RA-15：「实测标点落在行首」和「line-break 不是 strict」是两件事，分开记
        const key = `${it.rule}|${it.selector}|${it.rule === "T04" && it.message.startsWith("实测") ? "m" : ""}`;
        const cur = merged.get(key);
        if (cur) {
          cur.widths.push(w);
          if (!(cur.f.severity === "warn" && it.severity === "error")) continue;
        } else {
          const n = perRule.get(it.rule) ?? 0;
          if (n >= PER_RULE_CAP) {
            if (!omitted.has(it.rule)) omitted.set(it.rule, new Set());
            omitted.get(it.rule)!.add(it.selector);
            continue;
          }
          perRule.set(it.rule, n + 1);
        }
        const f: Finding = { rule: it.rule as RuleId, severity: it.severity, file: target.file, selector: it.selector, line: lineFor(it), viewport: w, message: it.message, fix_hint: fixHint(it.rule), [EL_TEXT]: it.text, [EL_ORD]: it.ord } as Finding;
        if (f.severity === "error") f.evidence = await screenshot(page, world, ctx, it.rule, { idx: it.idx });
        merged.set(key, { f, widths: cur ? cur.widths : [w] });
      }
    }

    // RA-05、RB-03：加载后试图跳转、或者换了文档的页面，测到的未必是原页面，不能判通过
    if (navigatedTo || mainCommits > 1 || contextsSinceCommit > 1) withdraw();
    if (navigatedTo) return incomplete(ctx, target, "navigated", `完整档：页面加载后试图跳转到 ${navigatedTo.slice(0, 200)}，已拦截；本页结果不完整`);
    if (mainCommits > 1 || contextsSinceCommit > 1) return incomplete(ctx, target, "navigated", "完整档：页面加载后换了一个新文档（例如跳转到 blob: 或 javascript: 地址）；本页结果不完整");
    // RB-04：子框架里有中文，完整档不检查 iframe 的内容
    const frames = await framesWithCjk(cdp);
    if (frames.withCjk.length) return incomplete(ctx, target, "cjk-in-frame", `完整档：页面的 iframe 里有中文（${frames.withCjk.slice(0, 3).join("、")}），完整档不检查 iframe 的内容；请单独检查 iframe 指向的页面`);
    if (frames.unknown.length) return incomplete(ctx, target, "cjk-in-frame", `完整档：有 ${frames.unknown.length} 个 iframe 无法确认里面有没有中文（${frames.unknown.slice(0, 3).join("、")}）`);
    // RA-04：页面有中文，但渲染后在所有宽度下都看不见任何中文元素（例如加载时整页 visibility: hidden）
    if (st.hasCjk && visibleMax === 0) return incomplete(ctx, target, "no-visible-cjk", "完整档：页面有中文，但渲染后在所有宽度下都看不到中文元素，无法实测");

    for (const { f, widths } of merged.values()) {
      if (widths.length > 1) f.message += `【出现在 ${widths.join("、")}px 宽度下】`;
      outcome.findings.push(f);
    }
    for (const [rule, sels] of omitted) {
      const first = outcome.findings.find((f) => f.rule === rule);
      outcome.findings.push({ rule: rule as RuleId, severity: first?.severity ?? "warn", file: target.file, message: `同一条规则在本页另有 ${sels.size} 处，已省略`, evidence: first?.evidence, fix_hint: fixHint(rule) });
    }

    // 基础档里要保留的 error 也要有截图：回到第一个宽度，按选择器找元素，找不到就截首屏
    const keep = st.errors.filter((f) => !staticVerdict(f, st, outcome, config).drop);
    if (keep.some((f) => !f.evidence)) await page.setViewportSize({ width: ctx.widths[0], height: ctx.viewportHeight });
    for (const f of keep) if (!f.evidence) f.evidence = await screenshot(page, world, ctx, f.rule, { selector: f.selector });
    if (ctx.hooks) await ctx.hooks.afterMeasure(page, pageWorld);
    outcome.ok = true;
  };
  try {
    const r = await withDeadline(run(), renderBudgetMs(), () => {
      context.close().catch(() => undefined);
    });
    if (r === "timeout") {
      ctx.acc.skipped.push({ file: target.file, reason: "timeout" });
      ctx.acc.incomplete = true;
      return { ...outcome, ok: false };
    }
    return outcome;
  } catch (e) {
    if (e instanceof UsageError) throw e;
    // 页面打不开（例如 localhost 没有在监听），或者测量中途文档被换掉：如实记录为 unreadable，整体结果为 incomplete
    incomplete(ctx, target, "unreadable", `完整档渲染失败：${String((e as Error).message ?? e).split("\n")[0].slice(0, 300)}`);
    return { ...outcome, ok: false };
  } finally {
    await closeWithin(context.close());
  }
}

// 基础档的这条结论要不要被完整档取代（RA-04、RB-02、RB-05、RC-01、RD-01）：按规则、按元素判断。
// 元素的身份是「选择器 + 文字指纹」：
// ① 浏览器里有身份完全相同的元素：它在任一宽度下做过这条规则的检查，就以完整档的实测为准（取代）；没做过就保留；
// ② 身份对不上（浏览器补 <tbody>、脚本改了结构）：只有这个文字指纹在浏览器里恰好对应一个元素、并且它做过检查时才取代。
// 不再用「同一选择器或同一文字」去匹配别的元素，也不再看完整档报的是 warn 还是 error（那会删掉不可见元素的 error）
const NOT_CHECKED = "完整档在所有宽度下都没有对这个元素检查这条规则（元素不可见、竖排或在代码块里），保留基础档结论";
const NO_MATCH = "完整档没能在浏览器里对应到这个元素（文字被脚本改掉或元素被移除），保留基础档结论";
const AMBIGUOUS = "浏览器里有多个文字相同的元素，无法确认是哪一个，保留基础档结论";
const SAME_NOT_ALL = "浏览器里有多个选择器和文字都相同的元素，其中有的没做这条规则的检查（例如不可见），无法确认是哪一个，保留基础档结论";
function staticVerdict(f: Finding, st: StaticInfo, out: PageOutcome, config: MeasureConfig): { drop: boolean; note?: string } {
  const replaced = REPLACED_BY_RENDER.has(f.rule) || (f.rule === "T02" && config.spacing === "css" && out.autospaceSupported);
  if (!replaced && f.rule !== "T08") return { drop: false };
  if (f.selector === undefined) return { drop: replaced }; // 没有选择器的是「另有 N 处」汇总，完整档会给自己的
  let t = elText(f);
  if (t === undefined) {
    const texts = [...new Set(st.textsOf(f))];
    if (texts.length !== 1) return { drop: false, note: "选择器对应到多个元素，无法和完整档的结果一一对应，保留基础档结论" };
    t = texts[0];
  }
  const base = `${f.selector}\u0001${t}`;
  const id = `${base}\u0001${elOrd(f)}`;
  if (f.rule === "T08") return { drop: out.hits.has(`T08|${id}`) }; // T08 两边都检查，同一元素只留完整档那条
  const checked = out.checked.get(f.rule) ?? new Set<string>();
  // RF-01：序号是两边各自按文档顺序编的，脚本挪动或复制元素后会对错。所以「选择器 + 指纹」在源码或浏览器里出现不止一次时，
  // 不靠序号判断：浏览器里这个「选择器 + 指纹」的元素全部做过检查才取代，否则保留。只出现一次时，就按那一个元素判断
  if (!out.byBase || !out.byText) {
    out.byBase = new Map();
    out.byText = new Map();
    for (const x of out.ids) {
      const [sel, text] = x.split("\u0001");
      const b = `${sel}\u0001${text}`;
      if (!out.byBase.has(b)) out.byBase.set(b, []);
      out.byBase.get(b)!.push(x);
      if (!out.byText.has(text)) out.byText.set(text, []);
      out.byText.get(text)!.push(x);
    }
  }
  const same = out.byBase.get(base) ?? [];
  if (same.length > 0) {
    if (same.length === 1 && st.srcBaseCount(base) <= 1) return checked.has(same[0]) ? { drop: true } : { drop: false, note: NOT_CHECKED };
    return same.every((x) => checked.has(x)) ? { drop: true } : { drop: false, note: SAME_NOT_ALL };
  }
  if (!t) return { drop: false, note: NO_MATCH };
  const candidates = out.byText.get(t) ?? [];
  if (candidates.length === 0) return { drop: false, note: NO_MATCH };
  if (candidates.length > 1) return { drop: false, note: AMBIGUOUS };
  return checked.has(candidates[0]) ? { drop: true } : { drop: false, note: NOT_CHECKED };
}

// 两段文字最长公共片段的长度（文字指纹最多 24 个字符，直接两重循环）
function commonRun(a: string, b: string): number {
  let best = 0;
  for (let i = 0; i < a.length; i++) {
    for (let j = 0; j < b.length; j++) {
      let k = 0;
      while (i + k < a.length && j + k < b.length && a[i + k] === b[j + k]) k++;
      if (k > best) best = k;
    }
  }
  return best;
}

function mergePage(acc: Accum, file: string, out: PageOutcome, config: MeasureConfig, st: StaticInfo): void {
  const kept: Finding[] = [];
  for (const f of acc.findings) {
    if (f.file !== file) {
      kept.push(f);
      continue;
    }
    const v = staticVerdict(f, st, out, config);
    if (!v.drop) kept.push(v.note ? { ...f, message: `${f.message}（基础档结果：${v.note}）` } : f);
  }
  acc.findings = [...kept, ...out.findings];
}

export async function runRender(opts: RenderOptions): Promise<LintResult> {
  const startedAt = new Date().toISOString();
  const cwd = opts.cwd ?? process.cwd();
  const rootReal = realRoot(opts.root ?? cwd);
  const config = opts.config ?? defaultConfig();
  const allowRemote = opts.allowRemote ?? config.allow_remote;
  const widths = opts.widths ? validateWidths(opts.widths, "--widths") : config.widths ?? DEFAULT_WIDTHS;
  pageBudgetMs();
  renderBudgetMs();

  const urlInputs = opts.inputs.filter((i) => URL_INPUT.test(i));
  const pathInputs = opts.inputs.filter((i) => !URL_INPUT.test(i));
  const urls = urlInputs.map((i) => checkUrlInput(i, allowRemote));
  const { files, skipped } = pathInputs.length ? collectInputs(rootReal, pathInputs, cwd) : { files: [] as string[], skipped: [] };
  const evidence = evidenceTarget(rootReal, opts.evidenceDir ?? join(rootReal, "evidence"), cwd);

  const acc = newAccum(skipped);
  for (const real of files) if (extname(real).toLowerCase() === ".css") lintCssFile(acc, rootReal, real);
  const pages: Target[] = [
    ...files.filter((f) => extname(f).toLowerCase() !== ".css").map((real): Target => ({ kind: "file", url: pathToFileURL(real).href, file: rel(rootReal, real), real })),
    ...urlInputs.map((input, i): Target => ({ kind: "url", url: urls[i].href, file: input }))
  ];

  const ctx: RunCtx = { rootReal, viewportHeight: opts.card?.viewportHeight ?? VIEWPORT_HEIGHT, hooks: opts.card, config, widths, allowRemote, acc, evidence, shotCounter: new Map(), problems: [] };
  const browsers = new Map<Mode, { browser: Browser; label: string }>();
  try {
    for (const t of pages) {
      if (!browsers.has(t.kind)) browsers.set(t.kind, await launchBrowser(t.kind, allowRemote));
      let info: StaticInfo | undefined;
      const staticPass = (snapshot: string): StaticInfo => {
        // 基础档规则既查源码（带行号），也查浏览器渲染后的 DOM 快照（RA-03、RB-01）：
        // DOM 快照里、源码中没有的中文元素（脚本渲染出来的内容），它们的结论也要报出来，不带行号并注明来源。
        // URL 页面没有源码，只查 DOM 快照
        const dom = buildPage(rootReal, "", { src: snapshot, file: t.file });
        const src = t.kind === "file" ? buildPage(rootReal, t.real!) : undefined;
        const before = acc.findings.length;
        const srcCjk = src ? lintPageInto(acc, src, config) : false;
        const srcFindings = acc.findings.slice(before);
        const domAcc = newAccum();
        const domCjk = lintPageInto(domAcc, dom, config);
        // DOM 快照里的结论按「结论」判断要不要补报（RC-03、RD-02、RE-02、RE-03）：先找这个元素在源码里对应的元素，
        // 只有源码对对应元素报过同一条规则时才不补（源码那条带行号，留它）；源码没报过这条规则的一律补报。对应元素：
        // ① 选择器、文字、序号都相同；
        // ② 文字相同：只有 DOM 里这段文字的元素不比源码多时才算（脚本插入一个同文字的新元素，多出来的那个是新内容，RE-03）；
        // ③ 文字在源码里没有：同一选择器、并且源码文字（至少 2 个字）整段出现在 DOM 文字里（加了前缀、后缀，RE-02），
        //    或者两者有 6 个字以上的公共片段（脚本只改了一部分文字）。门槛固定，不随源码文字变短而降低（RD-02）
        const MIN_RUN = 6;
        const srcEls = (src?.cjkElements ?? []).map((el) => ({ sel: src!.selectorOf(el), text: src!.textOf(el), ord: src!.ordOf(el) }));
        const count = (texts: string[]) => {
          const c = new Map<string, number>();
          for (const x of texts) c.set(x, (c.get(x) ?? 0) + 1);
          return c;
        };
        const srcTextCount = count(srcEls.map((e) => e.text));
        const domTextCount = count(dom.cjkElements.map((el) => dom.textOf(el)));
        const key = (rule: string, e: { sel: string; text: string; ord: number }) => `${rule}|${e.sel}\u0001${e.text}\u0001${e.ord}`;
        const srcReported = new Set(srcFindings.map((f) => key(f.rule, { sel: f.selector ?? "", text: elText(f) ?? "", ord: elOrd(f) })));
        const srcKeys = new Set(srcFindings.map((f) => `${f.rule}|${f.selector}|${f.message}`));
        const srcRuleSel = new Set(srcFindings.map((f) => `${f.rule}|${f.selector}`));
        const srcAllSel = new Set<string>();
        const walkSel = (n: AnyNode) => {
          if ((n as Element).attribs !== undefined) srcAllSel.add(src!.selectorOf(n as Element));
          for (const c of ((n as Element).children ?? []) as AnyNode[]) walkSel(c);
        };
        if (src) walkSel(src.doc);
        const fresh = (f: Finding) => {
          if (!src || !srcCjk) return true;
          if (f.selector === undefined) return false;
          if (srcKeys.has(`${f.rule}|${f.selector}|${f.message}`)) return false;
          const t = elText(f) ?? "";
          // 没有直接文字的元素（例如文字都在子元素里的 label）：指纹为空，按选择器对应
          if (t === "") return !(srcAllSel.has(f.selector) && srcRuleSel.has(`${f.rule}|${f.selector}`));
          const me = { sel: f.selector, text: t, ord: elOrd(f) };
          let matches: typeof srcEls;
          if (srcEls.some((e) => e.sel === me.sel && e.text === me.text && e.ord === me.ord)) matches = [me];
          else if (srcTextCount.has(t)) matches = (domTextCount.get(t) ?? 0) <= (srcTextCount.get(t) ?? 0) ? srcEls.filter((e) => e.text === t) : [];
          else matches = srcEls.filter((e) => e.sel === me.sel && ((e.text.length >= 2 && t.includes(e.text)) || (e.text.length >= MIN_RUN && t.length >= MIN_RUN && commonRun(e.text, t) >= MIN_RUN)));
          return !matches.some((e) => srcReported.has(key(f.rule, e)));
        };
        const domFindings = domAcc.findings.filter(fresh);
        for (const f of domFindings) {
          delete f.line; // 行号对应的是 DOM 快照，不是源码，去掉
          if (src) f.message += "（按浏览器渲染后的 DOM 检查：这段内容在源码里没有，是脚本渲染出来的）";
        }
        acc.findings.push(...domFindings);
        for (const [k, v] of domAcc.fontUse) acc.fontUse.set(k, v);
        acc.sheetErrors.push(...(src ? [] : domAcc.sheetErrors));
        if (!srcCjk && domCjk) acc.cjkFiles++;

        // 结论没带文字指纹时，按选择器找元素：源码来的按源码模型找，DOM 来的按 DOM 模型找
        const fromDom = new Set(domFindings);
        const baseCounts = new Map<string, number>();
        for (const el of (src ?? dom).cjkElements) {
          const k = `${(src ?? dom).selectorOf(el)}\u0001${(src ?? dom).textOf(el)}`;
          baseCounts.set(k, (baseCounts.get(k) ?? 0) + 1);
        }
        const textsIn = (m: PageModel, selector: string) => m.cjkElements.filter((el) => m.selectorOf(el) === selector).map((el) => m.textOf(el));
        const lineOf = new Map<string, { line: number; text: string }>();
        const lineByText = new Map<string, number | null>();
        if (src) {
          for (const el of src.cjkElements) {
            const s = src.selectorOf(el);
            const l = src.lineOf(el);
            const text = src.textOf(el);
            if (l === undefined) continue;
            if (!lineOf.has(s)) lineOf.set(s, { line: l, text });
            if (text) lineByText.set(text, lineByText.has(text) ? null : l);
          }
        }
        const hasCjk = srcCjk || domCjk;
        info = {
          errors: hasCjk ? [...srcFindings, ...domFindings].filter((f) => f.severity === "error") : [],
          lineOf,
          lineByText,
          textsOf: (f) => (f.selector === undefined ? [] : textsIn(fromDom.has(f) || !src ? dom : src, f.selector)),
          domAdded: domFindings,
          srcBaseCount: (b) => baseCounts.get(b) ?? 0,
          hasCjk
        };
        return info;
      };
      const out = await renderOne(browsers.get(t.kind)!.browser, t, ctx, staticPass);
      if (!info && t.kind === "file") lintPageInto(acc, buildPage(rootReal, t.real!), config); // 渲染在静态检查之前就失败了：基础档的结果照样保留
      if (out.ok && info?.hasCjk) mergePage(acc, t.file, out, config, info);
    }
  } finally {
    for (const { browser } of browsers.values()) await closeWithin(browser.close());
  }

  const network: LintResult["run"]["network"] = urls.some((u) => !isLoopback(u.hostname)) ? "remote" : urls.length ? "localhost" : "offline";
  const result = finishResult(acc, {
    inputs: opts.inputs,
    files: files.length + urls.length,
    config,
    startedAt,
    mode: "render",
    network,
    render: {
      browser: browsers.size ? [...browsers.values()].map((b) => b.label).join("；") : "（没有需要渲染的页面）",
      widths,
      evidence_dir: rel(rootReal, evidence.path),
      problems: ctx.problems
    }
  });
  // RA-09：单独检查的样式表没有页面可截图，在消息里说明
  for (const f of result.findings) if (f.severity === "error" && !f.evidence && /\.css$/i.test(f.file)) f.message += "（单独检查的样式表，没有可截图的页面）";
  return result;
}
