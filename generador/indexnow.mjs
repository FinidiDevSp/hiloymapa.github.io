// Avisa a los buscadores con IndexNow (Bing, Yandex, Seznam, Naver…) de las URL de la web tras cada publicación.
// La clave está en datos/canal.json → indexnow y la web la sirve en /<clave>.txt. Lee la lista de la web ya publicada.
// Uso: node generador/indexnow.mjs https://hiloymapa.github.io/
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const base = (process.argv[2] ?? "").replace(/\/?$/, "/");
const { indexnow: clave } = JSON.parse(fs.readFileSync(path.join(RAIZ, "datos/canal.json"), "utf8"));
if (!clave || !/^https:\/\//.test(base)) { console.log("IndexNow: sin clave o sin URL base; no se avisa"); process.exit(0); }
const r = await fetch(`${base}urls.txt`);
if (!r.ok) { console.log(`IndexNow: ${base}urls.txt no responde (${r.status})`); process.exit(0); }
const urlList = (await r.text()).split("\n").filter(Boolean);
const host = new URL(base).host;
const res = await fetch("https://api.indexnow.org/indexnow", {
  method: "POST", headers: { "content-type": "application/json; charset=utf-8" },
  body: JSON.stringify({ host, key: clave, keyLocation: `${base}${clave}.txt`, urlList }),
});
console.log(`IndexNow: ${urlList.length} URL → HTTP ${res.status}`); // 200 o 202: recibido
