import { describe, expect, it } from "vitest";
import { parseDat } from "@/lib/dat";

const crc = "cbf43926";
const md5 = "25f9e794323b453885f5181f1b624d0b";
const sha1 = "f7c3bc1d808e04732adf679965ccc34ca7ae3441";
const sha256 = "15e2b0d3c33891ebb0f1ef609ec419420c20e320ce94c65fbc8c3312448eb225";
const xmlRom = `<rom name="toy.bin" size="9" crc="${crc}" md5="${md5}" sha1="${sha1}" sha256="${sha256}"/>`;
const xml = (rom = xmlRom) => `<datafile><header><name>Toy DAT</name></header><game name="Toy (Rev 1)">${rom}</game></datafile>`;

describe("parseDat", () => {
  it("reads a Logiqx DAT and normalizes hashes without losing revision identity", () => {
    const source = `<?xml version="1.0" encoding="UTF-8"?>\n<!DOCTYPE datafile PUBLIC "-//Logiqx//DTD ROM Management Datafile//EN" "https://www.logiqx.com/Dats/datafile.dtd">\n${xml(xmlRom.replace(crc, crc.toUpperCase()))}`;
    expect(parseDat(source)).toEqual({ name: "Toy DAT", format: "logiqx", roms: [{ gameName: "Toy (Rev 1)", name: "toy.bin", size: 9, crc32: crc, md5, sha1, sha256 }] });
  });

  it("decodes built-in/numeric entities, single quotes, comments and CDATA", () => {
    expect(parseDat(`<!-- source --><datafile><header><name><![CDATA[Arcade & toys]]></name></header><machine name='A &amp; B &#x1F3AE;'><rom name='&quot;toy&quot; &lt;1&gt; &apos;x&apos; &#65;.bin' size='0' status='nodump'/></machine></datafile>`)).toEqual({
      name: "Arcade & toys", format: "logiqx", roms: [{ gameName: "A & B 🎮", name: '"toy" <1> \'x\' A.bin', size: 0, status: "nodump" }],
    });
  });

  it("reads conventional clrmamepro metadata, comments, escaped quotes and nested parentheses", () => {
    const source = String.raw`clrmamepro (
      name "Arcade \"toy\" DAT" description "Demo" version 1
    )
    // a revision
    game (
      name "Toy (Rev 1)" description "A toy"
      rom ( name "folder\\toy.bin" size 9 crc CBF43926 md5 ${md5} sha1 ${sha1} sha256 ${sha256} )
      /* no dump known */ rom ( name "missing.bin" size 0 flags nodump )
    ) # trailing comment`;
    expect(parseDat(source)).toEqual({ name: 'Arcade "toy" DAT', format: "clrmamepro", roms: [
      { gameName: "Toy (Rev 1)", name: "folder\\toy.bin", size: 9, crc32: crc, md5, sha1, sha256 },
      { gameName: "Toy (Rev 1)", name: "missing.bin", size: 0, status: "nodump" },
    ] });
  });

  it("accepts a conventional SYSTEM declaration without resolving its target", () => {
    expect(parseDat(`<!DOCTYPE datafile SYSTEM "file:///never/read/this.dtd">${xml()}`).roms).toHaveLength(1);
  });

  it("keeps quoted standalone parentheses as clrmamepro field values", () => {
    expect(parseDat('game ( name "(" rom ( name ")" size 0 flags nodump ) )').roms).toEqual([
      { gameName: "(", name: ")", size: 0, status: "nodump" },
    ]);
  });

  it.each(['game ( name"Toy" )', 'game ( name "Toy"description "bad" )'])("rejects adjacent clrmamepro quoted atoms", (source) => {
    expect(() => parseDat(source)).toThrow();
  });

  it.each([
    '<!DOCTYPE datafile [<!ENTITY x "expanded">]>',
    '<!DOCTYPE datafile [<!ENTITY x SYSTEM "file:///private">]>',
    '<!ENTITY x SYSTEM "https://example.invalid/entity">',
  ])("rejects custom entities or internal subsets: %s", (declaration) => {
    expect(() => parseDat(`${declaration}${xml()}`)).toThrow();
  });

  it.each(["&unknown;", "&amp", "&#0;", "&#xD800;", "&#1114112;", "&#xGG;", "a & b"])('rejects invalid entity "%s"', (value) => {
    expect(() => parseDat(xml(`<rom name="${value}" size="9" crc="${crc}"/>`))).toThrow();
  });

  it.each([
    '<datafile><game name="Toy"><rom name="toy" size="9"></game></datafile>',
    '<datafile><game name="Toy"><rom name="toy"name="evil" size="9"/></game></datafile>',
    '<datafile><game name="Toy"><rom name="toy" name="evil" size="9"/></game></datafile>',
    '<datafile><game name="Toy"><rom name=toy size="9"/></game></datafile>',
    '<datafile><game name="Toy"><rom name="a<b" size="9"/></game></datafile>',
    '<datafile/><datafile/>',
    '<datafile><!-- invalid -- comment --></datafile>',
    '<datafile><header><name>bad]]></name></header></datafile>',
    '<datafile><game><rom name="toy" size="9"/></game></datafile>',
    '<datafile><rom name="toy" size="9"/></datafile>',
    '<other/>',
    'not a DAT',
  ])("rejects malformed XML or an unsupported document", (source) => {
    expect(() => parseDat(source)).toThrow();
  });

  it.each(["-1", "1.5", "NaN", "Infinity", "9007199254740992", "", "1e3"])('rejects invalid size "%s" in either format', (size) => {
    expect(() => parseDat(xml(`<rom name="toy" size="${size}"/>`))).toThrow();
    expect(() => parseDat(`game ( name Toy rom ( name toy size "${size}" ) )`)).toThrow();
  });

  it.each([
    ["crc", "1234567"], ["crc", "ggf43926"], ["md5", "abcd"], ["sha1", "abcd"], ["sha256", "abcd"], ["crc", ""],
  ])("rejects malformed %s hashes in either format", (key, value) => {
    expect(() => parseDat(xml(`<rom name="toy" size="9" ${key}="${value}"/>`))).toThrow();
    expect(() => parseDat(`game ( name Toy rom ( name toy size 9 ${key} "${value}" ) )`)).toThrow();
  });

  it.each([
    'clrmamepro ( name "unterminated )',
    'game ( name Toy rom ( name toy size 9 )',
    'game ( name Toy rom ( name toy size 9 size 10 ) )',
    'game ( name Toy rom ( name toy size ) )',
    'game ( name Toy rom ( size 9 ) )',
    'game ( rom ( name toy size 9 ) )',
    'game ( name Toy ) /* unterminated',
  ])("rejects malformed clrmamepro structure", (source) => {
    expect(() => parseDat(source)).toThrow();
  });

  it("accepts exactly 5 MiB of UTF-8 and rejects one byte more", () => {
    const body = xml();
    const exact = body + " ".repeat(5 * 1024 * 1024 - Buffer.byteLength(body));
    expect(parseDat(exact).roms).toHaveLength(1);
    expect(() => parseDat(exact + " ")).toThrow(/size|large|limit/i);
  });

  it("counts UTF-8 bytes rather than UTF-16 characters for its limit", () => {
    expect(() => parseDat(xml() + "é".repeat(3 * 1024 * 1024))).toThrow(/size|large|limit/i);
  });

  it.each(["logiqx", "clrmamepro"])("accepts 20,000 ROMs and rejects 20,001 in %s", (format) => {
    const entry = format === "logiqx" ? '<rom name="toy" size="0" status="nodump"/>' : 'rom ( name toy size 0 flags nodump ) ';
    const document = (count: number) => format === "logiqx" ? `<datafile><game name="Toy">${entry.repeat(count)}</game></datafile>` : `game ( name Toy ${entry.repeat(count)} )`;
    expect(parseDat(document(20_000)).roms).toHaveLength(20_000);
    expect(() => parseDat(document(20_001))).toThrow(/entries|ROM|limit/i);
  });
});
