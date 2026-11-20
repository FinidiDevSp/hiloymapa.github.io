// Lee el RSS público del canal y acumula los vídeos en datos/videos.json (el RSS solo trae los 15 últimos: lo que sale
// de él se conserva). Sin claves ni dependencias. Si YouTube no responde, no toca nada y la web se construye con lo
// que ya había. El slug de cada vídeo se fija la primera vez y no cambia aunque cambie el título (pruebas A/B).
// Uso: node generador/actualizar.mjs
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { slug } from "./util.mjs";

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const canal = JSON.parse(fs.readFileSync(path.join(RAIZ, "datos/canal.json"), "utf8"));
const fVideos = path.join(RAIZ, "datos/videos.json");
const datos = fs.existsSync(fVideos) ? JSON.parse(fs.readFileSync(fVideos, "utf8")) : { videos: {} };

const entidades = (s) => s.replace(/&(#x?[0-9a-f]+|amp|lt|gt|quot|apos);/gi, (m, e) => {
  if (e[0] === "#") return String.fromCodePoint(e[1].toLowerCase() === "x" ? parseInt(e.slice(2), 16) : +e.slice(1));
  return { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'" }[e.toLowerCase()];
});
const campo = (xml, re) => { const m = xml.match(re); return m ? entidades(m[1]).trim() : null; };

let xml;
try {
  const r = await fetch(`https://www.youtube.com/feeds/videos.xml?channel_id=${canal.canalId}`, { headers: { "user-agent": "hiloymapa-web (+https://github.com)" } });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  xml = await r.text();
} catch (e) {
  console.log(`RSS no disponible (${e.message}): se mantiene datos/videos.json`);
  process.exit(0);
}

const contenidos = new Map(); // videoId → episodio (slug del estudio), si el estudio ya lo envió
for (const f of fs.existsSync(path.join(RAIZ, "contenido")) ? fs.readdirSync(path.join(RAIZ, "contenido")) : []) {
  if (!f.endsWith(".json")) continue;
  const c = JSON.parse(fs.readFileSync(path.join(RAIZ, "contenido", f), "utf8"));
  contenidos.set(c.videoId, c.episodio);
}

const usados = new Set(Object.values(datos.videos).map((v) => v.slug));
let nuevos = 0, cambiados = 0;
for (const [, e] of xml.matchAll(/<entry>([\s\S]*?)<\/entry>/g)) {
  const id = campo(e, /<yt:videoId>([^<]+)<\/yt:videoId>/);
  if (!id) continue;
  const enlace = campo(e, /<link rel="alternate" href="([^"]+)"/) ?? "";
  const v = {
    id,
    tipo: enlace.includes("/shorts/") ? "short" : "largo",
    titulo: campo(e, /<title>([\s\S]*?)<\/title>/),
    publicado: campo(e, /<published>([^<]+)<\/published>/),
    descripcion: campo(e, /<media:description>([\s\S]*?)<\/media:description>/) ?? "",
    vistas: +(campo(e, /<media:statistics views="(\d+)"/) ?? 0),
  };
  const antes = datos.videos[id];
  if (!antes) {
    let s = contenidos.get(id) ?? slug(v.titulo);
    while (usados.has(s)) s += "-" + id.slice(0, 4).toLowerCase().replace(/[^a-z0-9]/g, "x");
    usados.add(s);
    datos.videos[id] = { ...v, slug: s, visto: new Date().toISOString() };
    nuevos++;
    console.log(`nuevo ${v.tipo}: ${v.titulo} → ${s}`);
  } else if (antes.titulo !== v.titulo || antes.descripcion !== v.descripcion || antes.tipo !== v.tipo) {
    datos.videos[id] = { ...antes, ...v, slug: antes.slug };
    cambiados++;
    console.log(`cambia: ${v.titulo}`);
  } else datos.videos[id].vistas = v.vistas; // las vistas solo cuentan para ordenar; no fuerzan un commit por sí solas
}

const orden = Object.fromEntries(Object.entries(datos.videos).sort(([, a], [, b]) => b.publicado.localeCompare(a.publicado)));
const salida = { nota: "Lo escribe generador/actualizar.mjs a partir del RSS del canal. Los slugs no se cambian a mano: romperían enlaces.", videos: orden };
const texto = JSON.stringify(salida, null, 1) + "\n";
// Las vistas cambian a cada hora: solo se reescribe el archivo si hay vídeos nuevos o cambiados (o si no existía).
if (nuevos || cambiados || !fs.existsSync(fVideos)) fs.writeFileSync(fVideos, texto);
console.log(`${Object.keys(datos.videos).length} vídeos (${nuevos} nuevos, ${cambiados} cambiados)`);
