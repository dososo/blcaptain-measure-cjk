// 测试用的「方框字体」生成器（用户拍板 D-C5）：在测试的临时目录里生成最小的合法 TrueType 字体，
// 只有一个方框字形，覆盖指定的全部字符；name 表写成指定的字体名（可以是授权表里的真实字体名），
// 用来测 card 命令的授权判定、署名提示和回退检测。仓库里不提交任何字体文件（硬约束 H3）。
// 格式依据：Microsoft OpenType 规范（head、hhea、maxp、OS/2、hmtx、cmap、loca、glyf、name、post 各章节）、
// W3C WOFF 1.0 和 WOFF2 规范。只用 Node 自带模块。
import { brotliCompressSync, deflateSync } from "node:zlib";

const u16 = (n) => { const b = Buffer.alloc(2); b.writeUInt16BE(n & 0xffff); return b; };
const i16 = (n) => { const b = Buffer.alloc(2); b.writeInt16BE(n); return b; };
const u32 = (n) => { const b = Buffer.alloc(4); b.writeUInt32BE(n >>> 0); return b; };
const i64zero = () => Buffer.alloc(8);
const cat = (...xs) => Buffer.concat(xs);
const pad4 = (b) => (b.length % 4 ? cat(b, Buffer.alloc(4 - (b.length % 4))) : b);

function checksum(buf) {
  const b = pad4(buf);
  let sum = 0;
  for (let i = 0; i < b.length; i += 4) sum = (sum + b.readUInt32BE(i)) >>> 0;
  return sum;
}

function utf16be(s) {
  const le = Buffer.from(s, "utf16le");
  const be = Buffer.alloc(le.length);
  for (let i = 0; i < le.length; i += 2) { be[i] = le[i + 1]; be[i + 1] = le[i]; }
  return be;
}

// name 表：Windows 平台（3,1），英文（0x409）；localized 里的名字用简体中文（0x804）
function nameTable({ family, subfamily = "Regular", full, postscript, typographicFamily, localizedFamily }) {
  const recs = [];
  const add = (lang, id, s) => recs.push({ lang, id, data: utf16be(s) });
  add(0x409, 1, family);
  add(0x409, 2, subfamily);
  add(0x409, 4, full ?? `${family} ${subfamily}`);
  add(0x409, 6, postscript ?? `${family.replace(/[^A-Za-z0-9-]/g, "") || "TestFont"}-${subfamily}`);
  if (typographicFamily) add(0x409, 16, typographicFamily);
  if (localizedFamily) { add(0x804, 1, localizedFamily); add(0x804, 4, `${localizedFamily} ${subfamily}`); }
  recs.sort((a, b) => a.lang - b.lang || a.id - b.id);
  let off = 0;
  const records = [];
  const storage = [];
  for (const r of recs) {
    records.push(cat(u16(3), u16(1), u16(r.lang), u16(r.id), u16(r.data.length), u16(off)));
    storage.push(r.data);
    off += r.data.length;
  }
  return cat(u16(0), u16(recs.length), u16(6 + 12 * recs.length), ...records, ...storage);
}

// cmap：(3,1) format 4 覆盖 BMP，(3,10) format 12 覆盖全部；所有字符都映射到 1 号字形（方框）
function cmapTable(codes) {
  const bmp = codes.filter((c) => c <= 0xffff).sort((a, b) => a - b);
  const segs = [...bmp.map((c) => ({ start: c, end: c, delta: (1 - c) & 0xffff })), { start: 0xffff, end: 0xffff, delta: 1 }];
  const n = segs.length;
  let search = 1, sel = 0;
  while (search * 2 <= n) { search *= 2; sel++; }
  const f4body = cat(
    u16(n * 2), u16(search * 2), u16(sel), u16(n * 2 - search * 2),
    ...segs.map((s) => u16(s.end)), u16(0), ...segs.map((s) => u16(s.start)), ...segs.map((s) => u16(s.delta)), ...segs.map(() => u16(0))
  );
  const f4 = cat(u16(4), u16(6 + f4body.length), u16(0), f4body);
  const all = [...new Set(codes)].sort((a, b) => a - b);
  const f12 = cat(u16(12), u16(0), u32(16 + 12 * all.length), u32(0), u32(all.length), ...all.map((c) => cat(u32(c), u32(c), u32(1))));
  const hdr = cat(u16(0), u16(2), u16(3), u16(1), u32(4 + 16), u16(3), u16(10), u32(4 + 16 + f4.length));
  return cat(hdr, f4, f12);
}

// 方框字形：外框 100..900 × -100..780
function glyfLoca() {
  const xs = [100, 900, 900, 100];
  const ys = [-100, -100, 780, 780];
  let px = 0, py = 0;
  const dx = xs.map((x) => { const d = x - px; px = x; return i16(d); });
  const dy = ys.map((y) => { const d = y - py; py = y; return i16(d); });
  const box = cat(i16(1), i16(100), i16(-100), i16(900), i16(780), u16(3), u16(0), Buffer.from([1, 1, 1, 1]), ...dx, ...dy);
  const g1 = box.length % 2 ? cat(box, Buffer.alloc(1)) : box;
  const glyf = g1;
  const loca = cat(u16(0), u16(0), u16(g1.length / 2)); // 短格式：偏移 ÷ 2；0 号字形为空
  return { glyf, loca, bbox: [100, -100, 900, 780] };
}

export function makeTtf({ family, chars, weight = 400, subfamily = "Regular", full, postscript, typographicFamily, localizedFamily, sfntVersion = 0x00010000 }) {
  // 空格总要有；去重，否则 cmap 里会有重复的段，Chrome 的字体清洗器（OTS）会拒绝加载（RULING-08）
  const codes = [...new Set([...[...chars].map((c) => c.codePointAt(0)), 0x20])];
  const { glyf, loca, bbox } = glyfLoca();
  const head = cat(u32(0x00010000), u32(0x00010000), u32(0), u32(0x5f0f3cf5), u16(0x000b), u16(1000), i64zero(), i64zero(),
    i16(bbox[0]), i16(bbox[1]), i16(bbox[2]), i16(bbox[3]), u16(0), u16(8), i16(2), i16(0), i16(0));
  // hhea：版本、ascender、descender、lineGap、advanceWidthMax、minLSB、minRSB、xMaxExtent、caretSlopeRise、caretSlopeRun、caretOffset、保留 ×4、metricDataFormat、numberOfHMetrics（共 36 字节）
  const hhea = cat(u32(0x00010000), i16(880), i16(-120), i16(0), u16(1000), i16(0), i16(0), i16(900), i16(1), i16(0), i16(0), i16(0), i16(0), i16(0), i16(0), i16(0), u16(2));
  const maxp = cat(u32(0x00010000), u16(2), u16(4), u16(1), u16(0), u16(0), u16(1), u16(0), u16(0), u16(0), u16(0), u16(0), u16(0), u16(0), u16(0));
  const os2 = cat(u16(4), i16(1000), u16(weight), u16(5), u16(0),
    i16(650), i16(600), i16(0), i16(75), i16(650), i16(600), i16(0), i16(350), i16(50), i16(259),
    i16(0), Buffer.alloc(10), u32(1), u32(0x28000000), u32(0), u32(0), Buffer.from("TEST"),
    u16(0x40), u16(0x20), u16(0xffff), i16(880), i16(-120), i16(0), u16(1000), u16(200), u32(0x00040001), u32(0),
    i16(500), i16(700), u16(0), u16(0x20), u16(0));
  const hmtx = cat(u16(1000), i16(0), u16(1000), i16(100));
  const post = cat(u32(0x00030000), u32(0), i16(-100), i16(50), u32(0), u32(0), u32(0), u32(0), u32(0));
  const tables = {
    "OS/2": os2, cmap: cmapTable(codes), glyf, head, hhea, hmtx, loca, maxp,
    name: nameTable({ family, subfamily, full, postscript, typographicFamily, localizedFamily }), post
  };
  return sfnt(tables, sfntVersion);
}

function sfnt(tables, sfntVersion) {
  const tags = Object.keys(tables).sort();
  const n = tags.length;
  let search = 1, sel = 0;
  while (search * 2 <= n) { search *= 2; sel++; }
  const header = cat(u32(sfntVersion), u16(n), u16(search * 16), u16(sel), u16(n * 16 - search * 16));
  let offset = 12 + 16 * n;
  const dir = [];
  const bodies = [];
  for (const t of tags) {
    const data = tables[t];
    dir.push(cat(Buffer.from(t.padEnd(4, " "), "latin1"), u32(checksum(data)), u32(offset), u32(data.length)));
    bodies.push(pad4(data));
    offset += pad4(data).length;
  }
  const font = cat(header, ...dir, ...bodies);
  // head.checkSumAdjustment = 0xB1B0AFBA - 整个字体的校验和
  const headOff = font.readUInt32BE(12 + 16 * tags.indexOf("head") + 8);
  font.writeUInt32BE((0xb1b0afba - checksum(font)) >>> 0, headOff + 8);
  return font;
}

// 把 sfnt 拆回各个表（供 WOFF、WOFF2、TTC 封装）
function tablesOf(font) {
  const n = font.readUInt16BE(4);
  const out = [];
  for (let i = 0; i < n; i++) {
    const p = 12 + 16 * i;
    const tag = font.toString("latin1", p, p + 4);
    const off = font.readUInt32BE(p + 8);
    const len = font.readUInt32BE(p + 12);
    out.push({ tag, checksum: font.readUInt32BE(p + 4), data: font.subarray(off, off + len) });
  }
  return out;
}

// WOFF 1.0：每个表单独 zlib 压缩
export function toWoff(font) {
  const ts = tablesOf(font);
  let offset = 44 + 20 * ts.length;
  const dir = [];
  const bodies = [];
  for (const t of ts) {
    const z = deflateSync(t.data);
    const use = z.length < t.data.length ? z : t.data;
    dir.push(cat(Buffer.from(t.tag, "latin1"), u32(offset), u32(use.length), u32(t.data.length), u32(t.checksum)));
    bodies.push(pad4(use));
    offset += pad4(use).length;
  }
  const header = cat(Buffer.from("wOFF"), u32(font.readUInt32BE(0)), u32(offset), u16(ts.length), u16(0), u32(font.length), u16(1), u16(0), u32(0), u32(0), u32(0), u32(0), u32(0));
  return cat(header, ...dir, ...bodies);
}

const KNOWN = ["cmap", "head", "hhea", "hmtx", "maxp", "name", "OS/2", "post", "cvt ", "fpgm", "glyf", "loca", "prep", "CFF ", "VORG", "EBDT", "EBLC", "gasp", "hdmx", "kern", "LTSH", "PCLT", "VDMX", "vhea", "vmtx", "BASE", "GDEF", "GPOS", "GSUB", "EBSC", "JSTF", "MATH", "CBDT", "CBLC", "COLR", "CPAL", "SVG ", "sbix", "acnt", "avar", "bdat", "bloc", "bsln", "cvar", "fdsc", "feat", "fmtx", "fvar", "gvar", "hsty", "just", "lcar", "mort", "morx", "opbd", "prop", "trak", "Zapf", "Silf", "Glat", "Gloc", "Feat", "Sill"];

function base128(n) {
  const bytes = [];
  do { bytes.unshift(n & 0x7f); n = Math.floor(n / 128); } while (n > 0);
  for (let i = 0; i < bytes.length - 1; i++) bytes[i] |= 0x80;
  return Buffer.from(bytes);
}

// WOFF2：glyf、loca 用空变换（版本 3），其余表版本 0（空变换），整体一个 Brotli 流
export function toWoff2(font) {
  const ts = tablesOf(font);
  const dir = [];
  for (const t of ts) {
    const k = KNOWN.indexOf(t.tag);
    const ver = t.tag === "glyf" || t.tag === "loca" ? 3 : 0;
    const flags = ((ver & 3) << 6) | (k >= 0 ? k : 63);
    dir.push(cat(Buffer.from([flags]), k >= 0 ? Buffer.alloc(0) : Buffer.from(t.tag, "latin1"), base128(t.data.length)));
  }
  const data = brotliCompressSync(cat(...ts.map((t) => t.data)));
  const dirBuf = cat(...dir);
  const total = pad4(cat(Buffer.alloc(48), dirBuf, data)).length;
  const header = cat(Buffer.from("wOF2"), u32(font.readUInt32BE(0)), u32(total), u16(ts.length), u16(0), u32(font.length), u32(data.length), u16(1), u16(0), u32(0), u32(0), u32(0), u32(0), u32(0));
  return pad4(cat(header, dirBuf, data));
}

// TTC：多个字体各自完整存放（不共享表），足够测试解析
export function toTtc(fonts) {
  const headerLen = 12 + 4 * fonts.length;
  const offsets = [];
  const bodies = [];
  let off = headerLen;
  for (const f of fonts) {
    // sfnt 内部偏移是相对文件开头的，整体平移
    const ts = tablesOf(f);
    const n = ts.length;
    const dirLen = 12 + 16 * n;
    let o = off + dirLen;
    const dir = [];
    const bs = [];
    for (const t of ts) {
      dir.push(cat(Buffer.from(t.tag, "latin1"), u32(t.checksum), u32(o), u32(t.data.length)));
      bs.push(pad4(t.data));
      o += pad4(t.data).length;
    }
    const block = cat(f.subarray(0, 12), ...dir, ...bs);
    offsets.push(off);
    bodies.push(block);
    off += block.length;
  }
  return cat(Buffer.from("ttcf"), u32(0x00010000), u32(fonts.length), ...offsets.map(u32), ...bodies);
}
