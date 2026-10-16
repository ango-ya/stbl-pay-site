// 計測用の静的サーバー。本番（Cloudflare）に近づけるため、テキストを brotli で圧縮して返す。
//   node scripts/perf/serve-br.mjs <配信するフォルダ> <ポート>
import http from "node:http"; import fs from "node:fs"; import path from "node:path"; import zlib from "node:zlib";
const [root, port] = process.argv.slice(2);
const types = { ".html": "text/html; charset=utf-8", ".css": "text/css", ".js": "text/javascript", ".webp": "image/webp", ".png": "image/png", ".mp4": "video/mp4", ".woff2": "font/woff2", ".ico": "image/x-icon", ".jpg": "image/jpeg", ".svg": "image/svg+xml", ".txt": "text/plain" };
http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split("?")[0]); if (p.endsWith("/")) p += "index.html";
  const f = path.join(root, p);
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
}).listen(Number(port));
