// 读字体文件里的名称（card 命令按它查授权表，PRD §5.4「卡片导出的字体」、F06）。
// 支持 TTF / OTF（sfnt）、TTC（字体集合）、WOFF 1.0、WOFF2（含集合）。只读 name 表和 OS/2 表，不解析字形。
// 格式依据：Microsoft OpenType 规范的 name、OS/2 章节；W3C WOFF 1.0、WOFF2 规范（2026-10-26 读取）。
// 字体文件是用户提供的不可信数据：所有偏移都做越界检查，解压设上限，出错时返回 error，不抛异常。
import { brotliDecompressSync, inflateSync } from "node:zlib";

export interface FontFace {
  names: string[]; // 去重后的全部名称：家族名（16、1）、全名（4）、本地化名，英文在前
  family: string; // 首选家族名：英文的 16 号，没有时用 1 号
  postscript: string; // 6 号
  weight: number; // OS/2 usWeightClass，读不到时 400
}

export interface ParsedFont {
  format: "ttf" | "otf" | "ttc" | "woff" | "woff2" | "unknown";
  faces: FontFace[];
  error?: string;
}

const MAX_DECOMPRESSED = 256 * 1024 * 1024;
// 解压按需（AUDIT_CARD CA-13）：name 表的字符串偏移是 16 位，整张表不会超过 1 MB；OS/2 表只有几十个字节。
// WOFF2 的解压大小按目录算准，并且不能超过压缩数据的 64 倍（真实字体通常是 2–4 倍），小文件撑不出大块内存
const MAX_NAME_TABLE = 1024 * 1024;
const MAX_RATIO = 64;

class Reader {
  constructor(readonly b: Buffer) {}
  need(off: number, len: number): void {
    if (off < 0 || len < 0 || off + len > this.b.length) throw new Error(`字体文件结构越界（偏移 ${off}，长度 ${len}）`);
  }
  u8(off: number): number {
    this.need(off, 1);
    return this.b.readUInt8(off);
  }
  u16(off: number): number {
    this.need(off, 2);
    return this.b.readUInt16BE(off);
  }
  u32(off: number): number {
    this.need(off, 4);
    return this.b.readUInt32BE(off);
  }
  tag(off: number): string {
    this.need(off, 4);
    return this.b.toString("latin1", off, off + 4);
  }
  slice(off: number, len: number): Buffer {
    this.need(off, len);
    return this.b.subarray(off, off + len);
  }
}

function utf16be(b: Buffer): string {
  const le = Buffer.alloc(b.length - (b.length % 2));
  for (let i = 0; i + 1 < b.length; i += 2) {
    le[i] = b[i + 1];
    le[i + 1] = b[i];
  }
  return le.toString("utf16le");
}

const clean = (s: string) => s.replace(/[\p{Cc}\p{Cf}]/gu, "").trim().slice(0, 128);

// name 表：Windows（3）和 Unicode（0）平台按 UTF-16BE；Mac Roman（1,0）按 latin1 近似
function parseName(name: Buffer): { family: string; postscript: string; names: string[] } {
  const r = new Reader(name);
  const count = r.u16(2);
  const storage = r.u16(4);
  const byId = new Map<number, { en: string[]; other: string[] }>();
  for (let i = 0; i < Math.min(count, 2000); i++) {
    const p = 6 + 12 * i;
    const platform = r.u16(p);
    const encoding = r.u16(p + 2);
    const lang = r.u16(p + 4);
    const id = r.u16(p + 6);
    if (![1, 4, 6, 16].includes(id)) continue;
    const len = r.u16(p + 8);
    const off = r.u16(p + 10);
    let s: string;
    if (platform === 3 || platform === 0) s = utf16be(r.slice(storage + off, len));
    else if (platform === 1 && encoding === 0) s = r.slice(storage + off, len).toString("latin1");
    else continue;
    s = clean(s);
    if (!s) continue;
    const english = (platform === 3 && lang === 0x409) || (platform === 1 && lang === 0) || platform === 0;
    if (!byId.has(id)) byId.set(id, { en: [], other: [] });
    (english ? byId.get(id)!.en : byId.get(id)!.other).push(s);
  }
  const first = (id: number) => byId.get(id)?.en[0] ?? byId.get(id)?.other[0] ?? "";
  const family = first(16) || first(1);
  const postscript = first(6);
  const names: string[] = [];
  for (const id of [16, 1, 4]) for (const s of [...(byId.get(id)?.en ?? []), ...(byId.get(id)?.other ?? [])]) if (!names.includes(s)) names.push(s);
  if (postscript && !names.includes(postscript)) names.push(postscript);
  if (!family) throw new Error("字体文件里没有家族名（name 表的 1、16 号）");
  return { family, postscript, names };
}

function face(tables: Map<string, Buffer>): FontFace {
  const name = tables.get("name");
  if (!name) throw new Error("字体文件里没有 name 表");
  const n = parseName(name);
  const os2 = tables.get("OS/2");
  const weight = os2 && os2.length >= 6 ? os2.readUInt16BE(4) || 400 : 400;
  return { ...n, weight };
}

// 一个 sfnt（可能在 TTC 里的某个偏移）：读表目录，取 name 和 OS/2
function sfntAt(r: Reader, base: number): FontFace {
  const n = r.u16(base + 4);
  if (n === 0 || n > 512) throw new Error(`表的个数不合理：${n}`);
  const tables = new Map<string, Buffer>();
  for (let i = 0; i < n; i++) {
    const p = base + 12 + 16 * i;
    const tag = r.tag(p);
    if (tag !== "name" && tag !== "OS/2") continue;
    tables.set(tag, r.slice(r.u32(p + 8), r.u32(p + 12)));
  }
  return face(tables);
}

function woff(r: Reader): FontFace {
  const n = r.u16(12);
  if (n === 0 || n > 512) throw new Error(`表的个数不合理：${n}`);
  const tables = new Map<string, Buffer>();
  for (let i = 0; i < n; i++) {
    const p = 44 + 20 * i;
    const tag = r.tag(p);
    if (tag !== "name" && tag !== "OS/2") continue;
    const off = r.u32(p + 4);
    const comp = r.u32(p + 8);
    const orig = r.u32(p + 12);
    const raw = r.slice(off, comp);
    if (orig > MAX_NAME_TABLE) throw new Error(`${tag} 表声称有 ${orig} 字节，不合理`);
    tables.set(tag, comp < orig ? inflateSync(raw, { maxOutputLength: orig }) : raw);
  }
  return face(tables);
}

const KNOWN = ["cmap", "head", "hhea", "hmtx", "maxp", "name", "OS/2", "post", "cvt ", "fpgm", "glyf", "loca", "prep", "CFF ", "VORG", "EBDT", "EBLC", "gasp", "hdmx", "kern", "LTSH", "PCLT", "VDMX", "vhea", "vmtx", "BASE", "GDEF", "GPOS", "GSUB", "EBSC", "JSTF", "MATH", "CBDT", "CBLC", "COLR", "CPAL", "SVG ", "sbix", "acnt", "avar", "bdat", "bloc", "bsln", "cvar", "fdsc", "feat", "fmtx", "fvar", "gvar", "hsty", "just", "lcar", "mort", "morx", "opbd", "prop", "trak", "Zapf", "Silf", "Glat", "Gloc", "Feat", "Sill"];

function woff2(r: Reader): FontFace[] {
  const flavor = r.tag(4);
  const n = r.u16(12);
  const compressed = r.u32(20);
  if (n === 0 || n > 512) throw new Error(`表的个数不合理：${n}`);
  let p = 48;
  const base128 = (): number => {
    let v = 0;
    for (let i = 0; i < 5; i++) {
      const byte = r.u8(p++);
      if (i === 0 && byte === 0x80) throw new Error("UIntBase128 有前导零");
      v = v * 128 + (byte & 0x7f);
      if (!(byte & 0x80)) return v;
    }
    throw new Error("UIntBase128 超过 5 个字节");
  };
  const u255 = (): number => {
    const code = r.u8(p++);
    if (code === 253) {
      const v = r.u16(p);
      p += 2;
      return v;
    }
    if (code === 255) return r.u8(p++) + 253;
    if (code === 254) return r.u8(p++) + 253 * 2;
    return code;
  };
  const entries: { tag: string; offset: number; length: number }[] = [];
  let offset = 0;
  for (let i = 0; i < n; i++) {
    const flags = r.u8(p++);
    const k = flags & 0x3f;
    let tag: string;
    if (k === 63) {
      tag = r.tag(p);
      p += 4;
    } else tag = KNOWN[k];
    const version = flags >> 6;
    const orig = base128();
    // 规范：glyf、loca 的版本 3 是空变换；hmtx 的版本 0 是空变换；其余表版本 0 是空变换。非空变换时才有 transformLength
    const transformed = tag === "glyf" || tag === "loca" ? version !== 3 : version !== 0;
    const length = transformed ? base128() : orig;
    entries.push({ tag, offset, length });
    offset += length;
  }
  const faces: number[][] = [];
  if (flavor === "ttcf") {
    p += 4; // collection version
    const numFonts = u255();
    for (let f = 0; f < numFonts && f < 256; f++) {
      const count = u255();
      p += 4; // flavor
      const idx: number[] = [];
      for (let i = 0; i < count; i++) idx.push(u255());
      faces.push(idx);
    }
  } else faces.push(entries.map((_, i) => i));
  // 解压后的长度就是目录里各表长度之和；超过上限或者和压缩数据极不相称，按异常文件处理
  if (offset > MAX_DECOMPRESSED || offset > Math.max(compressed * MAX_RATIO, 1024 * 1024)) throw new Error(`WOFF2 解压后声称有 ${offset} 字节，压缩数据只有 ${compressed} 字节，不合理`);
  const stream = brotliDecompressSync(r.slice(p, compressed), { maxOutputLength: Math.max(1, offset) });
  const out: FontFace[] = [];
  for (const idx of faces) {
    const tables = new Map<string, Buffer>();
    for (const i of idx) {
      const e = entries[i];
      if (!e) throw new Error("集合目录里的表序号越界");
      if (e.tag !== "name" && e.tag !== "OS/2") continue;
      if (e.offset + e.length > stream.length) throw new Error("WOFF2 解压后的数据比目录记录的短");
      tables.set(e.tag, stream.subarray(e.offset, e.offset + e.length));
    }
    out.push(face(tables));
  }
  return out;
}

export function parseFontFile(buf: Buffer): ParsedFont {
  let format: ParsedFont["format"] = "unknown";
  try {
    const r = new Reader(buf);
    const sig = r.tag(0);
    if (sig === "wOFF") {
      format = "woff";
      return { format, faces: [woff(r)] };
    }
    if (sig === "wOF2") {
      format = "woff2";
      return { format, faces: woff2(r) };
    }
    if (sig === "ttcf") {
      format = "ttc";
      const num = r.u32(8);
      if (num === 0 || num > 256) throw new Error(`集合里的字体个数不合理：${num}`);
      const faces: FontFace[] = [];
      for (let i = 0; i < num; i++) faces.push(sfntAt(r, r.u32(12 + 4 * i)));
      return { format, faces };
    }
    const v = r.u32(0);
    if (v === 0x00010000 || sig === "true") {
      format = "ttf";
      return { format, faces: [sfntAt(r, 0)] };
    }
    if (sig === "OTTO") {
      format = "otf";
      return { format, faces: [sfntAt(r, 0)] };
    }
    throw new Error("不是可识别的字体文件（TTF、OTF、TTC、WOFF、WOFF2）");
  } catch (e) {
    return { format, faces: [], error: String((e as Error).message ?? e) };
  }
}
