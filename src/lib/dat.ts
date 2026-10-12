export interface DatRom {
  gameName: string;
  name: string;
  size: number;
  crc32?: string;
  md5?: string;
  sha1?: string;
  sha256?: string;
  status?: string;
}

type Dat = { name: string | null; format: "logiqx" | "clrmamepro"; roms: DatRom[] };
type Fields = Record<string, string>;
const MAX_BYTES = 5 * 1024 * 1024;
const MAX_ROMS = 20_000;
const MAX_DEPTH = 64;
const hashFields = ["crc32", "md5", "sha1", "sha256"] as const;
const hashLengths = { crc32: 8, md5: 32, sha1: 40, sha256: 64 };

function invalid(message: string): never {
  throw new Error(`Invalid DAT: ${message}`);
}

function xmlCharacter(code: number): boolean {
  return code === 9 || code === 10 || code === 13 ||
    (code >= 32 && code <= 0xd7ff) || (code >= 0xe000 && code <= 0xfffd) ||
    (code >= 0x10000 && code <= 0x10ffff);
}

function entities(value: string): string {
  const builtins: Fields = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'" };
  return value.replace(/&([^;]*);|&/g, (whole, entity: string | undefined) => {
    if (entity !== undefined && Object.prototype.hasOwnProperty.call(builtins, entity)) return builtins[entity];
    if (entity && /^(?:#[0-9]+|#x[0-9a-fA-F]+)$/.test(entity)) {
      const code = entity[1] === "x" ? parseInt(entity.slice(2), 16) : Number(entity.slice(1));
      if (xmlCharacter(code)) return String.fromCodePoint(code);
    }
    return invalid(`unsupported or invalid entity ${whole}`);
  });
}

function addRom(roms: DatRom[], gameName: string | undefined, fields: Fields): void {
  if (roms.length >= MAX_ROMS) invalid("ROM entries exceed limit");
  if (!gameName?.trim() || !fields.name?.trim()) invalid("ROM and game names are required");
  if (!/^[0-9]+$/.test(fields.size ?? "") || !Number.isSafeInteger(Number(fields.size))) invalid("invalid ROM size");
  const rom: DatRom = { gameName, name: fields.name, size: Number(fields.size) };
  if (fields.crc !== undefined && fields.crc32 !== undefined) invalid("duplicate CRC checksum");
  for (const key of hashFields) {
    const value = key === "crc32" ? fields.crc ?? fields.crc32 : fields[key];
    if (value !== undefined) {
      if (!new RegExp(`^[0-9a-fA-F]{${hashLengths[key]}}$`).test(value)) invalid(`invalid ${key} checksum`);
      rom[key] = value.toLowerCase();
    }
  }
  if (fields.status !== undefined || fields.flags !== undefined) rom.status = (fields.status ?? fields.flags).toLowerCase();
  roms.push(rom);
}

/** Parses quoted XML attributes only; no DTD/entity resolver is involved. */
function attributes(body: string): Fields {
  const fields: Fields = Object.create(null);
  let at = 0;
  while (at < body.length) {
    const gap = /^[\t\r\n ]+/.exec(body.slice(at));
    if (!gap) invalid("XML attributes must be separated by whitespace");
    at += gap[0].length;
    if (at === body.length) break;
    const attr = /^([A-Za-z_][\w.:-]*)[\t\r\n ]*=[\t\r\n ]*(?:"([^"<]*)"|'([^'<]*)')/.exec(body.slice(at));
    if (!attr || Object.prototype.hasOwnProperty.call(fields, attr[1])) invalid("malformed or duplicate XML attribute");
    fields[attr[1]] = entities(attr[2] ?? attr[3]);
    at += attr[0].length;
  }
  return fields;
}

function parseXml(source: string): Dat {
  const dat: Dat = { name: null, format: "logiqx", roms: [] };
  const stack: { tag: string; attrs: Fields; text: string }[] = [];
  let at = 0;
  let rootSeen = false;
  let doctypeSeen = false;
  let declarationSeen = false;
  const text = (value: string, cdata = false) => {
    if (!cdata && value.includes("]]>")) invalid("invalid XML character data");
    const decoded = cdata ? value : entities(value);
    if (stack.length === 0 && decoded.trim()) invalid("text outside XML root");
    const frame = stack[stack.length - 1];
    if (frame?.tag === "name" && stack[stack.length - 2]?.tag === "header") frame.text += decoded;
    if (frame?.tag === "rom" && decoded.trim()) invalid("ROM elements must be empty");
  };
  while (at < source.length) {
    if (source[at] !== "<") {
      const end = source.indexOf("<", at);
      text(source.slice(at, end < 0 ? source.length : end));
      at = end < 0 ? source.length : end;
      continue;
    }
    if (source.startsWith("<!--", at)) {
      const end = source.indexOf("-->", at + 4);
      if (end < 0 || source.slice(at + 4, end).includes("--") || source[end - 1] === "-") invalid("malformed XML comment");
      at = end + 3;
      continue;
    }
    if (source.startsWith("<![CDATA[", at)) {
      const end = source.indexOf("]]>", at + 9);
      if (end < 0 || stack.length === 0) invalid("malformed CDATA");
      text(source.slice(at + 9, end), true);
      at = end + 3;
      continue;
    }
    if (source.startsWith("<?", at)) {
      const end = source.indexOf("?>", at + 2);
      if (end < 0) invalid("unclosed processing instruction");
      const instruction = source.slice(at + 2, end);
      const target = /^([A-Za-z_][\w.:-]*)([\s\S]*)$/.exec(instruction);
      if (!target) invalid("malformed processing instruction");
      if (target[1].toLowerCase() === "xml") {
        if (target[1] !== "xml" || at !== 0 || declarationSeen) invalid("misplaced XML declaration");
        const attrs = attributes(target[2]);
        if (attrs.version !== "1.0" || (attrs.encoding && attrs.encoding.toLowerCase() !== "utf-8") ||
          (attrs.standalone && !["yes", "no"].includes(attrs.standalone)) || Object.keys(attrs).some((key) => !["version", "encoding", "standalone"].includes(key))) invalid("unsupported XML declaration");
        declarationSeen = true;
      } else if (target[2] && !/^\s/.test(target[2])) invalid("malformed processing instruction");
      at = end + 2;
      continue;
    }
    let quote = "";
    let end = at + 1;
    for (; end < source.length; end++) {
      const character = source[end];
      if (quote) { if (character === quote) quote = ""; }
      else if (character === '"' || character === "'") quote = character;
      else if (character === ">") break;
    }
    if (end === source.length) invalid("unclosed XML markup");
    const body = source.slice(at + 1, end);
    if (body.startsWith("!DOCTYPE")) {
      // Common external declarations are inert metadata. Internal subsets are never accepted.
      const literal = '(?:"[^"<>]*"|\'[^\'<>]*\')';
      const allowed = new RegExp(`^!DOCTYPE[\\t\\r\\n ]+datafile(?:[\\t\\r\\n ]+SYSTEM[\\t\\r\\n ]+${literal}|[\\t\\r\\n ]+PUBLIC[\\t\\r\\n ]+${literal}[\\t\\r\\n ]+${literal})?[\\t\\r\\n ]*$`);
      if (rootSeen || doctypeSeen || body.includes("[") || body.includes("]") || !allowed.test(body)) invalid("unsupported DOCTYPE or internal subset");
      doctypeSeen = true;
    } else if (body.startsWith("/")) {
      const closing = /^\/([A-Za-z_][\w.:-]*)[\t\r\n ]*$/.exec(body);
      if (!closing || stack.length === 0 || stack[stack.length - 1].tag !== closing[1]) invalid("mismatched XML closing tag");
      const frame = stack.pop()!;
      if (frame.tag === "name" && stack[stack.length - 1]?.tag === "header") dat.name = frame.text.trim() || null;
    } else {
      const selfClosing = body.endsWith("/");
      const open = /^([A-Za-z_][\w.:-]*)([\s\S]*)$/.exec(selfClosing ? body.slice(0, -1) : body);
      if (!open) invalid("malformed XML tag");
      const tag = open[1];
      const attrs = attributes(open[2]);
      const parent = stack[stack.length - 1];
      if (stack.length === 0) {
        if (tag !== "datafile" || rootSeen) invalid("expected a single datafile root");
        rootSeen = true;
      }
      if (parent?.tag === "rom") invalid("ROM elements must be empty");
      if ((tag === "game" || tag === "machine") && (parent?.tag !== "datafile" || !attrs.name?.trim())) invalid("invalid game element");
      if (tag === "rom") {
        if (parent?.tag !== "game" && parent?.tag !== "machine") invalid("ROM has no owning game");
        addRom(dat.roms, parent.attrs.name, attrs);
      }
      if (!selfClosing) {
        if (stack.length >= MAX_DEPTH) invalid("XML nesting exceeds limit");
        stack.push({ tag, attrs, text: "" });
      }
    }
    at = end + 1;
  }
  if (!rootSeen || stack.length) invalid("missing or unclosed XML root");
  return dat;
}

type CmpBlock = { key: string; fields: Fields; children: CmpBlock[] };
type CmpToken = { value: string; kind: "atom" | "string" | "(" | ")" };

function parseCmp(source: string): Dat {
  const dat: Dat = { name: null, format: "clrmamepro", roms: [] };
  let at = 0;
  let romCount = 0;
  let headerSeen = false;
  const next = (): CmpToken | null => {
    while (at < source.length) {
      if (/\s/.test(source[at])) { at++; continue; }
      if (source.startsWith("/*", at)) {
        const end = source.indexOf("*/", at + 2);
        if (end < 0) invalid("unclosed clrmamepro comment");
        at = end + 2;
        continue;
      }
      if (source.startsWith("//", at) || source[at] === "#" || source[at] === ";") {
        const end = source.indexOf("\n", at);
        at = end < 0 ? source.length : end + 1;
        continue;
      }
      break;
    }
    if (at === source.length) return null;
    const first = source[at++];
    if (first === "(" || first === ")") return { value: first, kind: first };
    if (first === '"') {
      let value = "";
      while (at < source.length) {
        const char = source[at++];
        if (char === '"') {
          if (at < source.length && !/[\s()#;]/.test(source[at]) && !source.startsWith("//", at) && !source.startsWith("/*", at)) invalid("unseparated clrmamepro quoted atom");
          return { value, kind: "string" };
        }
        if (char === "\\" && (source[at] === '"' || source[at] === "\\")) value += source[at++];
        else value += char;
      }
      return invalid("unclosed clrmamepro quoted string");
    }
    const start = at - 1;
    while (at < source.length && !/[\s()"#;]/.test(source[at]) && !source.startsWith("//", at) && !source.startsWith("/*", at)) at++;
    if (source[at] === '"') invalid("unseparated clrmamepro quoted atom");
    return { value: source.slice(start, at), kind: "atom" };
  };
  const block = (key: string, depth: number): CmpBlock => {
    if (depth > MAX_DEPTH) invalid("clrmamepro nesting exceeds limit");
    if (key === "rom" && ++romCount > MAX_ROMS) invalid("ROM entries exceed limit");
    const result: CmpBlock = { key, fields: Object.create(null), children: [] };
    while (true) {
      const field = next();
      if (field?.kind === ")") return result;
      if (field === null || field.kind !== "atom" || !/^[A-Za-z_][\w.-]*$/.test(field.value)) invalid("invalid clrmamepro field");
      const value = next();
      if (value === null || value.kind === ")") invalid("missing clrmamepro field value");
      if (value.kind === "(") result.children.push(block(field.value, depth + 1));
      else {
        if (Object.prototype.hasOwnProperty.call(result.fields, field.value)) invalid("duplicate clrmamepro field");
        result.fields[field.value] = value.value;
      }
    }
  };
  let root: CmpToken | null;
  let rootSeen = false;
  while ((root = next()) !== null) {
    if (root.kind !== "atom" || !["clrmamepro", "game", "machine"].includes(root.value) || next()?.kind !== "(") invalid("unsupported clrmamepro root");
    rootSeen = true;
    const parsed = block(root.value, 1);
    if (root.value === "clrmamepro") {
      if (headerSeen || parsed.children.length) invalid("invalid clrmamepro header");
      headerSeen = true;
      dat.name = parsed.fields.name?.trim() || null;
    } else {
      if (!parsed.fields.name?.trim()) invalid("game name is required");
      for (const child of parsed.children) {
        if (child.key === "rom") {
          if (child.children.length) invalid("invalid nested ROM block");
          addRom(dat.roms, parsed.fields.name, child.fields);
        }
      }
    }
  }
  if (!rootSeen) invalid("empty document");
  return dat;
}

/** Strict bounded DAT parsing; identifiers are metadata, never filesystem paths. */
export function parseDat(source: string): Dat {
  if (typeof source !== "string" || Buffer.byteLength(source, "utf8") > MAX_BYTES) invalid("source size exceeds limit");
  for (let i = 0; i < source.length; i++) {
    const code = source.codePointAt(i)!;
    if (!xmlCharacter(code)) invalid("invalid source character");
    if (code > 0xffff) i++;
  }
  const clean = source.replace(/^\uFEFF/, "");
  return clean.trimStart().startsWith("<") ? parseXml(clean) : parseCmp(clean);
}
