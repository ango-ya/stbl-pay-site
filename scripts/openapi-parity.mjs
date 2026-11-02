// 日本語版（正本）と英語版の OpenAPI の仕様書が、訳してよい文以外で食い違っていないかを調べる。
// 訳してよいのは、仕様書としての説明（description・summary・title）、info.contact.name、タグの名前だけ。
// 例・既定値・const・enum の中は API が扱う値そのものなので、description などのキーでも完全一致を求める。
// properties や responses などの対応表のキーは名前（`default` という名前のプロパティなど）なので、意味を読まない。
const TEXT_KEYS = new Set(["description", "summary", "title"]);
const DATA_KEYS = new Set(["example", "default", "const", "enum"]);
// 子のキーが名前になる対応表。mapping の値はスキーマへの参照なので、説明文として扱わない
const MAP_KEYS = new Set([
  "paths", "webhooks", "callbacks", "properties", "patternProperties", "$defs", "dependentSchemas",
  "schemas", "responses", "parameters", "requestBodies", "headers", "securitySchemes", "links",
  "content", "encoding", "variables", "mapping", "examples", "pathItems",
]);
// 説明文を区別せず、まるごと値として比べるもの。拡張（x-）は任意のデータ、security は要求するスコープ、
// links は送る値を持つ。shortcut: Link の description や OAuth の scopes の説明も訳せない。使うようになったら場所を足す
const EXACT_KEYS = new Set(["security", "links", "flows"]);

export function diffSpecs(ja, en) {
  // タグの名前は訳すので、操作の tags は対応表で日本語の名前に戻して比べる
  const tagName = new Map((ja.tags ?? []).map((t, i) => [en.tags?.[i]?.name, t.name]));
  const errors = [];

  function leaf(a, b, path) {
    if (a !== b) errors.push(`${path}: ${JSON.stringify(a)} ≠ ${JSON.stringify(b)}`);
  }

  function keys(a, b, path) {
    if (Array.isArray(a) !== Array.isArray(b)) {
      errors.push(`${path}: 配列かどうかが違う`);
      return [];
    }
    const out = [];
    for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) {
      if (!(k in a)) errors.push(`${path}/${k}: 日本語版に無い`);
      else if (!(k in b)) errors.push(`${path}/${k}: 英語版に無い`);
      else out.push(k);
    }
    return out;
  }

  // kind: "obj"（仕様書の部品）・"map"（キーが名前の対応表。examples のときは "examples"）・"data"（値そのもの）
  function compare(a, b, path, kind) {
    if (a === null || b === null || typeof a !== "object" || typeof b !== "object") return leaf(a, b, path);
    for (const k of keys(a, b, path)) {
      const p = `${path}/${k}`;
      const [x, y] = [a[k], b[k]];
      if (kind === "data") compare(x, y, p, "data");
      else if (kind === "map" || kind === "examples") compare(x, y, p, kind === "examples" ? "example" : "obj");
      else if (Array.isArray(a)) compare(x, y, p, "obj");
      else if (typeof x === "string" && typeof y === "string" && (TEXT_KEYS.has(k) || p === "/info/contact/name" || /^\/tags\/\d+\/name$/.test(p))) continue;
      // 問い合わせ先は英語版の docs を指す
      else if (p === "/info/contact/url" && typeof x === "string" && y === x.replace("/docs/", "/docs/en/")) continue;
      else if (k.startsWith("x-") || EXACT_KEYS.has(k)) compare(x, y, p, "data");
      // タグの名前を戻すのは、操作（paths・webhooks の下のメソッド）の tags だけ
      else if (k === "tags" && /^\/(paths|webhooks)\/.+\/(get|put|post|delete|options|head|patch|trace)$/.test(path) && Array.isArray(y)) compare(x, y.map((n) => tagName.get(n) ?? n), p, "data");
      // Example Object の value、JSON Schema の examples（配列）は値そのもの
      else if (DATA_KEYS.has(k) || (kind === "example" && k === "value") || (k === "examples" && Array.isArray(x))) compare(x, y, p, "data");
      else if (MAP_KEYS.has(k) && x && typeof x === "object" && !Array.isArray(x)) compare(x, y, p, k === "examples" ? "examples" : "map");
      else compare(x, y, p, "obj");
    }
  }

  compare(ja, en, "", "obj");
  return errors;
}
