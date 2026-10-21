// 計測用の静的サーバー。本番（Cloudflare）に近づけるため、テキストを brotli で圧縮して返す。
//   node scripts/perf/serve-br.mjs <配信するフォルダ> <ポート>
import http from "node:http"; import fs from "node:fs"; import path from "node:path"; import zlib from "node:zlib";
const [root, port] = process.argv.slice(2);
const types = { ".html": "text/html; charset=utf-8", ".css": "text/css", ".js": "text/javascript", ".webp": "image/webp", ".png": "image/png", ".mp4": "video/mp4", ".woff2": "font/woff2", ".ico": "image/x-icon", ".jpg": "image/jpeg", ".svg": "image/svg+xml", ".txt": "text/plain" };
const base = path.resolve(root);
http.createServer((req, res) => {
  let p;
  try { p = decodeURIComponent(req.url.split("?")[0]); } catch { res.writeHead(400); return res.end(); }
  if (p.endsWith("/")) p += "index.html";
  // 配信するフォルダの外（/%2e%2e/ など）は読ませない
  const f = path.resolve(base, "." + p);
  if (!f.startsWith(base + path.sep)) { res.writeHead(403); return res.end(); }
  if (!fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end(); }
  const ext = path.extname(f); const type = types[ext] || "application/octet-stream";
  const body = fs.readFileSync(f);
  if (/text|javascript|svg|icon/.test(type) && /br/.test(req.headers["accept-encoding"] || "")) {
    const z = zlib.brotliCompressSync(body);
    res.writeHead(200, { "Content-Type": type, "Content-Encoding": "br", "Content-Length": z.length });
    return res.end(z);
  }
  res.writeHead(200, { "Content-Type": type, "Content-Length": body.length });
  res.end(body);
}).listen(Number(port), "127.0.0.1"); // 手元からだけ受ける
