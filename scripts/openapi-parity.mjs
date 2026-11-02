// 日本語版（正本）と英語版の OpenAPI の仕様書が、訳してよい文以外で食い違っていないかを調べる。
// 訳してよいのは、仕様書としての説明（description・summary・title）、info.contact.name、タグの名前だけ。
// 例・既定値・const・enum の中は API が扱う値そのものなので、description などのキーでも完全一致を求める。
const TEXT_KEYS = new Set(["description", "summary", "title"]);
const DATA_KEYS = new Set(["example", "default", "const", "enum"]);

export function diffSpecs(ja, en) {
  // タグの名前は訳すので、操作の tags は対応表で日本語の名前に戻して比べる
  const tagName = new Map((ja.tags ?? []).map((t, i) => [en.tags?.[i]?.name, t.name]));
  const errors = [];
  function compare(a, b, path, key, inData) {
    if (!inData && typeof a === "string" && typeof b === "string") {
      if (TEXT_KEYS.has(key) || path === "/info/contact/name" || /^\/tags\/\d+\/name$/.test(path)) return;
      // 問い合わせ先は英語版の docs を指す
      if (path === "/info/contact/url" && b === a.replace("/docs/", "/docs/en/")) return;
    }
    if (!inData && key === "tags" && path !== "/tags" && Array.isArray(b)) b = b.map((n) => tagName.get(n) ?? n);
    if (a === null || b === null || typeof a !== "object" || typeof b !== "object") {
      if (a !== b) errors.push(`${path}: ${JSON.stringify(a)} ≠ ${JSON.stringify(b)}`);
      return;
    }
    if (Array.isArray(a) !== Array.isArray(b)) return errors.push(`${path}: 配列かどうかが違う`);
    for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) {
      if (!(k in a)) { errors.push(`${path}/${k}: 日本語版に無い`); continue; }
      if (!(k in b)) { errors.push(`${path}/${k}: 英語版に無い`); continue; }
      const childKey = Array.isArray(a) ? key : k;
      // responses の default は既定の応答の名前で、値ではない。
      // examples は、配列（JSON Schema）なら値そのもの、対応表（OpenAPI）なら各例の value が値
      const data = inData || (!Array.isArray(a) && ((DATA_KEYS.has(k) && !path.endsWith("/responses")) || (k === "examples" && Array.isArray(a[k])) || (k === "value" && /\/examples\/[^/]+$/.test(path))));
      compare(a[k], b[k], `${path}/${k}`, childKey, data);
    }
  }
  compare(ja, en, "", "", false);
  return errors;
}
