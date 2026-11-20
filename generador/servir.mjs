// Servidor local para revisar _site/ (sin dependencias). Uso: node generador/servir.mjs [puerto]
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const SITE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../_site");
const TIPOS = { ".html": "text/html; charset=utf-8", ".css": "text/css", ".js": "text/javascript", ".svg": "image/svg+xml", ".jpg": "image/jpeg", ".png": "image/png", ".woff2": "font/woff2", ".xml": "application/xml", ".txt": "text/plain; charset=utf-8", ".webmanifest": "application/manifest+json" };
const puerto = +(process.argv[2] ?? 8080);
http.createServer((req, res) => {
  let f = path.join(SITE, decodeURIComponent(new URL(req.url, "http://x").pathname));
  if (!f.startsWith(SITE)) { res.writeHead(403); return res.end(); }
  if (fs.existsSync(f) && fs.statSync(f).isDirectory()) f = path.join(f, "index.html");
  if (!fs.existsSync(f)) { res.writeHead(404, { "content-type": TIPOS[".html"] }); return res.end(fs.readFileSync(path.join(SITE, "404.html"))); }
  res.writeHead(200, { "content-type": TIPOS[path.extname(f)] ?? "application/octet-stream" });
  fs.createReadStream(f).pipe(res);
}).listen(puerto, () => console.log(`http://localhost:${puerto}/`));
