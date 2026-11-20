// Construye la web estática en _site/ a partir de datos/ (RSS acumulado), contenido/ (lo que envía el estudio) y
// recursos/. Sin dependencias. Descarga las miniaturas de YouTube para servirlas desde la propia web.
// Uso: node generador/construir.mjs [--base=https://hiloymapa.github.io/] [--sin-red]
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { h, fechaLarga, fechaCorta, reloj, iso8601, minutos, leerDescripcion, dominio } from "./util.mjs";
import { pagina, reproductor, tarjetaCaso, tarjetaShort, ICONO } from "./plantillas.mjs";
import { mapa, hilo } from "./mapa.mjs";
import { proyectar } from "./proyeccion.mjs";

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SITE = path.join(RAIZ, "_site");
const op = (k) => process.argv.find((a) => a.startsWith(`--${k}=`))?.split("=").slice(1).join("=");
const BASE = (op("base") ?? process.env.BASE_URL ?? "http://localhost:8080/").replace(/\/?$/, "/");
const SIN_RED = process.argv.includes("--sin-red");
const leer = (f) => JSON.parse(fs.readFileSync(path.join(RAIZ, f), "utf8"));
const escribir = (rel, texto) => { const f = path.join(SITE, rel); fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, texto); };
const ANIO = new Date().getFullYear();

// ---------- datos ----------
const canal = leer("datos/canal.json");
const todos = Object.values(leer("datos/videos.json").videos);
const contenido = new Map();
for (const f of fs.existsSync(path.join(RAIZ, "contenido")) ? fs.readdirSync(path.join(RAIZ, "contenido")) : []) if (f.endsWith(".json")) { const c = leer(`contenido/${f}`); contenido.set(c.videoId, c); }

const shorts = todos.filter((v) => v.tipo === "short").map((v) => ({ ...v, ...leerDescripcion(v.descripcion) }));
const casos = todos.filter((v) => v.tipo === "largo").map((v) => {
  const d = leerDescripcion(v.descripcion), c = contenido.get(v.id) ?? {};
  const susShorts = shorts.filter((s) => s.padre === v.id || (c.shorts ?? []).includes(s.id)).sort((a, b) => a.publicado.localeCompare(b.publicado));
  return {
    ...v, ...d,
    fuentes: d.fuentes.length ? d.fuentes : c.fuentes ?? [], // si la descripción no las trae (Capone), las del estudio
    tituloCorto: v.titulo.split(" | ")[0],
    duracion: c.duracion ?? null,
    lugares: c.lugares ?? [],
    transcripcion: c.transcripcion ?? [],
    datosVerificados: c.datosVerificados ?? 0,
    shorts: susShorts,
    url: `${BASE}casos/${v.slug}/`,
    watch: `https://www.youtube.com/watch?v=${v.id}`,
  };
}).sort((a, b) => b.publicado.localeCompare(a.publicado));
if (!casos.length) { console.log("Sin vídeos en datos/videos.json: ejecuta antes generador/actualizar.mjs"); process.exit(1); }

const cifras = {
  casos: casos.length,
  shorts: shorts.length,
  lugares: new Set(casos.flatMap((c) => c.lugares.map((l) => l.texto))).size,
  fuentes: new Set(casos.flatMap((c) => c.fuentes)).size,
  datos: casos.reduce((a, c) => a + c.datosVerificados, 0),
  imagenes: casos.reduce((a, c) => a + c.imagenes.length, 0),
  minutos: Math.round(casos.reduce((a, c) => a + (c.duracion ?? 0), 0) / 60),
};

// ---------- limpieza y recursos ----------
fs.rmSync(SITE, { recursive: true, force: true });
fs.cpSync(path.join(RAIZ, "recursos"), path.join(SITE, "recursos"), { recursive: true });
fs.writeFileSync(path.join(SITE, ".nojekyll"), "");

// Miniaturas: de YouTube a la propia web (sin peticiones a Google al navegar; caché en .cache/ entre construcciones).
const CACHE = path.join(RAIZ, ".cache/miniaturas");
fs.mkdirSync(CACHE, { recursive: true });
fs.mkdirSync(path.join(SITE, "miniaturas"), { recursive: true });
for (const v of [...casos, ...shorts]) {
  const f = path.join(CACHE, `${v.id}.jpg`);
  if (!fs.existsSync(f) && !SIN_RED) {
    for (const n of v.tipo === "short" ? ["oar2.jpg", "hqdefault.jpg"] : ["maxresdefault.jpg", "sddefault.jpg", "hqdefault.jpg"]) {
      try { const r = await fetch(`https://i.ytimg.com/vi/${v.id}/${n}`); if (r.ok) { fs.writeFileSync(f, Buffer.from(await r.arrayBuffer())); break; } } catch {}
    }
  }
  if (fs.existsSync(f)) fs.copyFileSync(f, path.join(SITE, "miniaturas", `${v.id}.jpg`));
  else console.log(`  aviso: sin miniatura para ${v.id}`);
}

// ---------- schema.org ----------
const ORG = {
  "@type": "Organization", "@id": `${BASE}#organizacion`, name: "Hilo y Mapa", url: BASE,
  logo: { "@type": "ImageObject", url: `${BASE}recursos/marca/avatar-512.png`, width: 512, height: 512 },
  image: `${BASE}recursos/marca/banner.jpg`, description: canal.descripcion, slogan: canal.lema,
  sameAs: [canal.youtube, `https://www.youtube.com/channel/${canal.canalId}`],
  foundingDate: canal.fundado, knowsLanguage: "es",
};
const videoLD = (c) => ({
  "@type": "VideoObject", "@id": `${c.url}#video`,
  name: c.titulo, description: c.resumen || c.titulo,
  thumbnailUrl: [`${BASE}miniaturas/${c.id}.jpg`, `https://i.ytimg.com/vi/${c.id}/maxresdefault.jpg`],
  uploadDate: c.publicado, ...(c.duracion ? { duration: iso8601(c.duracion) } : {}),
  embedUrl: `https://www.youtube-nocookie.com/embed/${c.id}`, url: c.watch, inLanguage: "es",
  publisher: { "@id": `${BASE}#organizacion` }, creator: { "@id": `${BASE}#organizacion` },
  isFamilyFriendly: true,
  ...(c.capitulos.length ? { hasPart: c.capitulos.map((k, i) => ({ "@type": "Clip", name: k.titulo, startOffset: k.t, ...(c.capitulos[i + 1] ? { endOffset: c.capitulos[i + 1].t } : c.duracion ? { endOffset: c.duracion } : {}), url: `${c.watch}&t=${k.t}s` })) } : {}),
  ...(c.lugares.length ? { contentLocation: c.lugares.map((l) => ({ "@type": "Place", name: l.texto, geo: { "@type": "GeoCoordinates", latitude: l.lat, longitude: l.lon } })) } : {}),
  ...(c.fuentes.length ? { citation: c.fuentes.map((u) => ({ "@type": "CreativeWork", url: u })) } : {}),
  ...(c.transcripcion.length ? { transcript: c.transcripcion.map((p) => p.texto).join(" ") } : {}),
  ...(c.etiquetas.length ? { keywords: c.etiquetas.map((e) => e.slice(1)).join(", ") } : {}),
});

// ---------- portada ----------
{
  const r = "";
  const cronologico = [...casos].reverse();
  const lugaresTodos = cronologico.flatMap((c) => c.lugares.map((l) => ({ ...l, url: `casos/${c.slug}/` })));
  const ultimo = casos[0];
  // Mapa interactivo: una ruta por caso; la leyenda resalta la suya.
  const rutas = cronologico.filter((c) => c.lugares.length).map((c, i) => ({ c, i, pts: c.lugares.map((l) => proyectar(l.lon, l.lat)) }));
  const mapaCasos = (() => {
    const base = mapa(lugaresTodos, { r, clase: "mapa-casos", aspecto: 2, margen: 0.12, minAncho: 300, animado: false, hiloDe: [], px: 1240, titulo: "Mapa de todos los casos" });
    const capas = rutas.map(({ c, i, pts }) => `<path class="ruta" data-caso="${h(c.slug)}" d="${hilo(pts, { caida: 0.12 })}" style="--i:${i}"/>`).join("");
    return base.replace('<g class="pines">', `<g class="rutas">${capas}</g><g class="pines">`);
  })();
  const cuerpo = `
<section class="portada" aria-labelledby="titulo-portada">
<div class="portada-mapa" aria-hidden="true">${mapa(lugaresTodos.filter((l) => l.lon > -100 && l.lon < 34), { r, clase: "mapa-portada", aspecto: 16 / 9, vista: [[-100, 18], [34, 62]], minAncho: 380, conNudo: true, px: 1440, titulo: "" })}</div>
<div class="portada-velo"></div>
<div class="ancho portada-texto">
<p class="antetitulo">Canal documental · En español</p>
<h1 id="titulo-portada" class="marca-grande">Hilo <span>y</span> Mapa</h1>
<p class="lema">${h(canal.lema)}</p>
<p class="entrada">${h(canal.descripcionCorta)}</p>
<div class="acciones">
<a class="boton boton-rojo" href="casos/${h(ultimo.slug)}/">${ICONO.play}<span>Ver el último caso</span></a>
<a class="boton boton-linea" href="${h(canal.suscribirse)}" rel="noopener" target="_blank">${ICONO.youtube}<span>Suscribirse en YouTube</span></a>
</div>
</div>
<dl class="ancho portada-cifras">
<div><dt>Casos</dt><dd>${cifras.casos}</dd></div>
<div><dt>Lugares</dt><dd>${cifras.lugares}</dd></div>
<div><dt>Fuentes citadas</dt><dd>${cifras.fuentes}</dd></div>
<div><dt>Datos verificados</dt><dd>${cifras.datos}</dd></div>
</dl>
</section>

<section class="seccion ultimo" aria-labelledby="titulo-ultimo"><div class="ancho ultimo-rejilla">
${reproductor(ultimo, r, { clase: "revelar", prioridad: false })}
<div class="ultimo-texto revelar">
<p class="antetitulo"><span class="punto-vivo"></span>Último caso · <time datetime="${h(ultimo.publicado)}">${fechaCorta(ultimo.publicado)}</time></p>
<h2 id="titulo-ultimo">${h(ultimo.tituloCorto)}</h2>
<p class="resumen-grande">${h(ultimo.resumen)}</p>
<ul class="fichas">${[ultimo.duracion && `<li><b>${minutos(ultimo.duracion)}</b>de recorrido</li>`, ultimo.fuentes.length && `<li><b>${ultimo.fuentes.length}</b>fuentes</li>`, ultimo.datosVerificados && `<li><b>${ultimo.datosVerificados}</b>datos verificados</li>`, ultimo.lugares.length && `<li><b>${ultimo.lugares.length}</b>lugares</li>`].filter(Boolean).join("")}</ul>
<div class="acciones"><a class="boton boton-rojo" href="casos/${h(ultimo.slug)}/"><span>Abrir el caso</span>${ICONO.flecha}</a><a class="boton boton-linea" href="${h(ultimo.watch)}" rel="noopener" target="_blank">${ICONO.youtube}<span>Ver en YouTube</span></a></div>
</div></div></section>

<section class="seccion" id="casos" aria-labelledby="titulo-casos"><div class="ancho">
<header class="seccion-cabecera revelar"><p class="antetitulo">Archivo</p><h2 id="titulo-casos">Todos los casos</h2><p>Cada caso es un único recorrido continuo por el mapa, con fotos y documentos reales y las fuentes a la vista.</p></header>
<div class="rejilla-casos">${casos.map((c) => tarjetaCaso(c, r)).join("\n")}</div>
</div></section>

${shorts.length ? `<section class="seccion seccion-shorts" id="shorts" aria-labelledby="titulo-shorts"><div class="ancho">
<header class="seccion-cabecera revelar"><p class="antetitulo">En vertical</p><h2 id="titulo-shorts">Shorts</h2><p>Un minuto, una pieza del caso. Cada Short lleva al documental completo.</p></header>
</div><ul class="carril" role="list">${shorts.map((s) => tarjetaShort(s, r)).join("")}</ul></section>` : ""}

<section class="seccion seccion-mapa" id="mapa" aria-labelledby="titulo-mapa"><div class="ancho">
<header class="seccion-cabecera revelar"><p class="antetitulo">Geografía</p><h2 id="titulo-mapa">El mapa de los casos</h2><p>Cada hilo es un caso. Pasa por encima de uno para ver su recorrido; pulsa una chincheta para abrirlo.</p></header>
<div class="mapa-casos-marco revelar">${mapaCasos}</div>
<ol class="leyenda">${rutas.slice().reverse().map(({ c }) => `<li><a href="casos/${h(c.slug)}/" data-caso="${h(c.slug)}"><span class="leyenda-hilo"></span><b>${h(c.tituloCorto)}</b><small>${h(c.lugares.map((l) => l.texto).join(" → "))}</small></a></li>`).join("")}</ol>
</div></section>

<section class="seccion metodo" aria-labelledby="titulo-metodo"><div class="ancho">
<header class="seccion-cabecera revelar"><p class="antetitulo">Cómo trabajamos</p><h2 id="titulo-metodo">El método</h2></header>
<ol class="pilares">
<li class="revelar"><span>01</span><h3>Un solo recorrido</h3><p>Sin cortes de montaje: una cámara continua recorre el mapa del caso, de lugar en lugar, en el orden en que ocurrió.</p></li>
<li class="revelar"><span>02</span><h3>Solo imágenes reales</h3><p>Fotografías y documentos de archivo. Lo que no existe no se inventa; lo reconstruido se marca como «RECREACIÓN».</p></li>
<li class="revelar"><span>03</span><h3>Cada dato, con fuente</h3><p>Cada afirmación del guion tiene su fuente y pasa una verificación independiente antes de grabarse.</p></li>
<li class="revelar"><span>04</span><h3>Todo acreditado</h3><p>Fuentes, imágenes y licencias, en la descripción de cada vídeo y en la página de cada caso.</p></li>
</ol>
<p class="metodo-mas revelar"><a href="sobre/">Leer el método completo ${ICONO.flecha}</a></p>
</div></section>

<section class="llamada" aria-labelledby="titulo-llamada"><div class="ancho revelar">
<h2 id="titulo-llamada">Sigue el hilo</h2>
<p>Un caso nuevo en cuanto está listo, con sus Shorts los días siguientes.</p>
<a class="boton boton-rojo boton-grande" href="${h(canal.suscribirse)}" rel="noopener" target="_blank">${ICONO.youtube}<span>Suscribirse a Hilo y Mapa</span></a>
</div></section>`;
  escribir("index.html", pagina({
    titulo: `Hilo y Mapa · ${canal.lema}`, descripcion: canal.descripcionCorta, canonical: BASE, r, base: BASE, canal, anio: ANIO, cuerpo, clase: "inicio",
    jsonld: [{ "@context": "https://schema.org", "@graph": [
      ORG,
      { "@type": "WebSite", "@id": `${BASE}#web`, url: BASE, name: "Hilo y Mapa", inLanguage: "es", publisher: { "@id": `${BASE}#organizacion` }, description: canal.descripcionCorta },
      { "@type": "ItemList", name: "Casos de Hilo y Mapa", itemListOrder: "https://schema.org/ItemListOrderDescending", numberOfItems: casos.length, itemListElement: casos.map((c, i) => ({ "@type": "ListItem", position: i + 1, url: c.url, name: c.titulo })) },
    ] }],
  }));
}

// ---------- páginas de caso ----------
for (const c of casos) {
  const r = "../../";
  const otros = casos.filter((o) => o.id !== c.id).slice(0, 3);
  const palabras = c.transcripcion.reduce((a, p) => a + p.texto.split(/\s+/).length, 0);
  const capitulo = (t) => { let k = -1; c.capitulos.forEach((x, i) => { if (x.t <= t) k = i; }); return k; };
  // Transcripción con los títulos de capítulo intercalados (más legible y mejor para buscadores y asistentes).
  let ultimoCap = -1;
  const transcripcion = c.transcripcion.map((p) => {
    const k = p.t !== null ? capitulo(p.t) : -1;
    const cab = k > ultimoCap && c.capitulos[k] ? `<h3 id="t-${c.capitulos[k].t}"><a href="${h(c.watch)}&amp;t=${c.capitulos[k].t}s" data-t="${c.capitulos[k].t}">${h(c.capitulos[k].marca)}</a> ${h(c.capitulos[k].titulo)}</h3>` : "";
    if (k > ultimoCap) ultimoCap = k;
    return `${cab}<p>${p.t !== null ? `<a class="marca-t" href="${h(c.watch)}&amp;t=${Math.floor(p.t)}s" data-t="${Math.floor(p.t)}">${reloj(p.t)}</a> ` : ""}${h(p.texto)}</p>`;
  }).join("\n");
  const cuerpo = `
<article class="caso" itemscope itemtype="https://schema.org/VideoObject">
<header class="caso-cabecera">
${c.lugares.length ? `<div class="caso-mapa" aria-hidden="true">${mapa(c.lugares, { r, clase: "mapa-caso", aspecto: 16 / 10, margen: 0.5, minAncho: 190, px: 1440, desplazar: 0.3, titulo: "" })}</div>` : ""}
<div class="caso-velo" style="--fondo:url('${r}miniaturas/${h(c.id)}.jpg')"></div>
<div class="ancho caso-titular">
<nav class="migas" aria-label="Migas de pan"><ol><li><a href="${r}">Inicio</a></li><li><a href="${r}#casos">Casos</a></li><li aria-current="page">${h(c.tituloCorto)}</li></ol></nav>
<p class="antetitulo"><time datetime="${h(c.publicado)}" itemprop="uploadDate" content="${h(c.publicado)}">${fechaLarga(c.publicado)}</time>${c.duracion ? ` · ${reloj(c.duracion)}` : ""}${c.lugares.length ? ` · ${h(c.lugares.map((l) => l.texto).join(" · "))}` : ""}</p>
<h1 itemprop="name" content="${h(c.titulo)}">${h(c.tituloCorto)}${c.titulo.includes(" | ") ? `<span class="subtitulo">${h(c.titulo.split(" | ").slice(1).join(" · "))}</span>` : ""}</h1>
<p class="resumen-grande" itemprop="description">${h(c.resumen)}</p>
</div>
</header>

<div class="ancho caso-rejilla">
<div class="caso-principal">
${reproductor(c, r, { prioridad: true, clase: "reproductor-caso" })}
<div class="acciones"><a class="boton boton-rojo" href="${h(c.watch)}" rel="noopener" target="_blank">${ICONO.youtube}<span>Ver en YouTube</span></a><a class="boton boton-linea" href="${h(canal.suscribirse)}" rel="noopener" target="_blank"><span>Suscribirse</span></a></div>

${c.capitulos.length ? `<section class="bloque" aria-labelledby="h-capitulos"><h2 id="h-capitulos">Capítulos</h2>
<ol class="capitulos">${c.capitulos.map((k) => `<li><a href="${h(c.watch)}&amp;t=${k.t}s" data-t="${k.t}"><span class="capitulo-t">${h(k.marca)}</span><span>${h(k.titulo)}</span></a></li>`).join("")}</ol></section>` : ""}

${c.transcripcion.length ? `<section class="bloque" aria-labelledby="h-transcripcion"><h2 id="h-transcripcion">Transcripción</h2>
<details class="transcripcion"><summary>Leer la narración completa <small>${palabras} palabras · ${minutos(c.duracion ?? palabras / 2.2)} de lectura en voz alta</small></summary>
<div class="transcripcion-texto">${transcripcion}</div></details></section>` : ""}

${c.fuentes.length ? `<section class="bloque" aria-labelledby="h-fuentes"><h2 id="h-fuentes">Fuentes</h2>
<p class="nota">${c.datosVerificados ? `El guion se apoya en ${c.datosVerificados} datos verificados. ` : ""}Estas son las fuentes principales, tal como aparecen en el vídeo.</p>
<ol class="fuentes">${c.fuentes.map((u) => `<li><a href="${h(u)}" rel="noopener" target="_blank"><b>${h(dominio(u))}</b><span>${h(decodeURI(u.replace(/^https?:\/\/(www\.)?[^/]+/, "")) || "/")}</span></a></li>`).join("")}</ol></section>` : ""}

${c.imagenes.length ? `<section class="bloque" aria-labelledby="h-imagenes"><h2 id="h-imagenes">Imágenes y mapas</h2>
<ul class="creditos">${c.imagenes.map((t) => `<li>${h(t)}</li>`).join("")}</ul>${c.aviso ? `<p class="nota">${h(c.aviso)}</p>` : ""}</section>` : ""}
</div>

<aside class="caso-lateral">
${c.lugares.length ? `<section class="bloque bloque-mapa"><h2>En el mapa</h2>${mapa(c.lugares, { r, clase: "mapa-lateral", aspecto: 4 / 3, margen: 0.35, minAncho: 90, px: 290, escalaTexto: 0.85, titulo: `Lugares del caso: ${c.lugares.map((l) => l.texto).join(", ")}` })}
<ol class="lugares">${c.lugares.map((l) => `<li>${h(l.texto)}</li>`).join("")}</ol></section>` : ""}
<section class="bloque"><h2>Ficha</h2><dl class="ficha">
<div><dt>Publicado</dt><dd>${fechaLarga(c.publicado)}</dd></div>
${c.duracion ? `<div><dt>Duración</dt><dd>${reloj(c.duracion)}</dd></div>` : ""}
${c.capitulos.length ? `<div><dt>Capítulos</dt><dd>${c.capitulos.length}</dd></div>` : ""}
<div><dt>Fuentes</dt><dd>${c.fuentes.length}</dd></div>
${c.datosVerificados ? `<div><dt>Datos verificados</dt><dd>${c.datosVerificados}</dd></div>` : ""}
<div><dt>Imágenes acreditadas</dt><dd>${c.imagenes.length}</dd></div>
</dl></section>
${c.shorts.length ? `<section class="bloque"><h2>Shorts del caso</h2><ul class="carril carril-lateral" role="list">${c.shorts.map((s) => tarjetaShort(s, r)).join("")}</ul></section>` : ""}
</aside>
</div>

${otros.length ? `<section class="seccion"><div class="ancho"><header class="seccion-cabecera"><p class="antetitulo">Sigue el hilo</p><h2>Otros casos</h2></header>
<div class="rejilla-casos">${otros.map((o) => tarjetaCaso(o, r)).join("\n")}</div></div></section>` : ""}
</article>`;
  escribir(`casos/${c.slug}/index.html`, pagina({
    titulo: `${c.tituloCorto} · Hilo y Mapa`, descripcion: (c.resumen || c.titulo).slice(0, 300), canonical: c.url, r, base: BASE, canal, anio: ANIO, cuerpo, clase: "pagina-caso",
    og: { tipo: "video.other", imagen: `${BASE}miniaturas/${c.id}.jpg`, ancho: 1280, alto: 720, titulo: c.titulo, alt: c.titulo, video: c.watch },
    precarga: [`${r}miniaturas/${c.id}.jpg`],
    jsonld: [{ "@context": "https://schema.org", "@graph": [
      ORG,
      { ...videoLD(c) },
      { "@type": "WebPage", "@id": c.url, url: c.url, name: c.titulo, inLanguage: "es", isPartOf: { "@id": `${BASE}#web` }, primaryImageOfPage: `${BASE}miniaturas/${c.id}.jpg`, mainEntity: { "@id": `${c.url}#video` }, datePublished: c.publicado },
      { "@type": "BreadcrumbList", itemListElement: [{ "@type": "ListItem", position: 1, name: "Inicio", item: BASE }, { "@type": "ListItem", position: 2, name: "Casos", item: `${BASE}#casos` }, { "@type": "ListItem", position: 3, name: c.tituloCorto, item: c.url }] },
    ] }],
  }));
}

// ---------- el método (sobre) ----------
const PREGUNTAS = [
  ["¿Qué es Hilo y Mapa?", `Un canal documental en español sobre casos reales —mafias, crímenes, golpes, fraudes y espionaje—. Cada vídeo cuenta un caso como un único recorrido continuo por el mapa donde ocurrió, con fotografías y documentos de archivo.`],
  ["¿Las imágenes son reales?", "Sí. Se usan fotografías y documentos de archivo con su autor y su licencia. Lo que no existe no se sustituye por otra imagen. Cuando un documento se reconstruye para explicar algo, aparece marcado como «RECREACIÓN». Las imágenes sensibles se muestran veladas y poco tiempo."],
  ["¿Cómo se comprueban los datos?", "Cada afirmación del guion se apoya en fuentes documentadas y con un nivel de confianza. Antes de grabar, una revisión independiente intenta refutar el guion entero; lo que no se sostiene se corrige o se quita. Las fuentes principales están en la descripción de cada vídeo y en la página de cada caso."],
  ["¿Dónde están las fuentes de cada vídeo?", "En la descripción del vídeo en YouTube y, ordenadas, en la página de cada caso de esta web, junto a los créditos de las imágenes y los mapas."],
  ["¿Cada cuánto se publica?", "Cuando un caso está listo. Con cada documental salen tres Shorts: el primero a la vez y los otros dos en los días siguientes, a las 12:00 (hora de España)."],
  ["¿De dónde salen los mapas?", "De Natural Earth y de los datos de OpenStreetMap (© colaboradores de OpenStreetMap, licencia ODbL), dibujados para cada caso."],
];
{
  const r = "../";
  const cuerpo = `
<article class="pagina-texto"><div class="ancho estrecho">
<nav class="migas" aria-label="Migas de pan"><ol><li><a href="${r}">Inicio</a></li><li aria-current="page">El método</li></ol></nav>
<p class="antetitulo">Sobre el canal</p>
<h1>El método de Hilo y Mapa</h1>
<p class="resumen-grande">${h(canal.descripcion)}</p>

<h2>Un único recorrido por el mapa</h2>
<p>Cada documental es una sola toma: una cámara continua recorre un mundo único —un mapa o una mesa de investigación— y se detiene en cada lugar cuando la narración lo nombra. Las fotografías y los documentos aparecen sobre el mapa, unidos por un hilo rojo que sigue el caso de principio a fin.</p>

<h2>Normas editoriales</h2>
<ul class="lista-normas">
<li><b>Fuentes para todo.</b> Cada afirmación del guion está documentada con su fuente y su nivel de confianza. Si las fuentes discrepan, no se elige una: se cuenta lo que comparten o se omite el dato.</li>
<li><b>Verificación independiente.</b> Antes de grabar la voz, una revisión separada intenta refutar cada frase del guion. Lo que no se sostiene se corrige o se quita.</li>
<li><b>Solo imágenes reales.</b> Fotografías y documentos de archivo, con autor y licencia. Las reconstrucciones se marcan como «RECREACIÓN». Las imágenes sensibles se velan.</li>
<li><b>Equidad.</b> Cuando un caso sigue abierto o hay posturas enfrentadas, se atribuye cada una a quien la sostiene y no se da por probado lo que no lo está.</li>
<li><b>Créditos completos.</b> Fuentes, imágenes y mapas se acreditan en la descripción de cada vídeo y en esta web.</li>
</ul>

<h2>Correcciones</h2>
<p>Si encuentras un error, escríbelo en los comentarios del vídeo. Si se confirma, se corrige en la descripción y en la página del caso, y se indica qué ha cambiado.</p>

<h2>En cifras</h2>
<dl class="cifras-texto">
<div><dt>Casos publicados</dt><dd>${cifras.casos}</dd></div>
<div><dt>Shorts</dt><dd>${cifras.shorts}</dd></div>
<div><dt>Lugares en el mapa</dt><dd>${cifras.lugares}</dd></div>
<div><dt>Fuentes citadas</dt><dd>${cifras.fuentes}</dd></div>
<div><dt>Datos verificados</dt><dd>${cifras.datos}</dd></div>
<div><dt>Imágenes acreditadas</dt><dd>${cifras.imagenes}</dd></div>
</dl>

<h2 id="preguntas">Preguntas frecuentes</h2>
<div class="preguntas">${PREGUNTAS.map(([p, rsp]) => `<details><summary>${h(p)}</summary><p>${h(rsp)}</p></details>`).join("")}</div>

<h2 id="privacidad">Privacidad</h2>
<p>Esta web no usa cookies, ni analítica, ni publicidad. Las miniaturas se sirven desde la propia web. Los vídeos se cargan desde YouTube (en su versión sin cookies, youtube-nocookie.com) solo cuando pulsas «reproducir»; a partir de ese momento se aplica la <a href="https://policies.google.com/privacy" rel="noopener" target="_blank">política de privacidad de Google</a>.</p>

<div class="acciones"><a class="boton boton-rojo" href="${h(canal.suscribirse)}" rel="noopener" target="_blank">${ICONO.youtube}<span>Suscribirse en YouTube</span></a><a class="boton boton-linea" href="${r}#casos"><span>Ver los casos</span></a></div>
</div></article>`;
  escribir("sobre/index.html", pagina({
    titulo: "El método · Hilo y Mapa", descripcion: "Cómo se hacen los documentales de Hilo y Mapa: un único recorrido por el mapa, solo imágenes reales, cada dato con fuente y verificación independiente.", canonical: `${BASE}sobre/`, r, base: BASE, canal, anio: ANIO, cuerpo, activo: "sobre", clase: "pagina-sobre",
    jsonld: [{ "@context": "https://schema.org", "@graph": [
      ORG,
      { "@type": "AboutPage", "@id": `${BASE}sobre/`, url: `${BASE}sobre/`, name: "El método de Hilo y Mapa", inLanguage: "es", about: { "@id": `${BASE}#organizacion` }, isPartOf: { "@id": `${BASE}#web` } },
      { "@type": "FAQPage", mainEntity: PREGUNTAS.map(([p, rsp]) => ({ "@type": "Question", name: p, acceptedAnswer: { "@type": "Answer", text: rsp } })) },
    ] }],
  }));
}

// ---------- 404 ----------
escribir("404.html", pagina({
  titulo: "Aquí se pierde el hilo · Hilo y Mapa", descripcion: "Esta página no existe.", canonical: `${BASE}404.html`, r: BASE, base: BASE, canal, anio: ANIO, clase: "pagina-404",
  cuerpo: `<section class="error"><div class="ancho estrecho"><p class="antetitulo">Error 404</p><h1 class="marca-grande">Aquí se pierde el hilo</h1><p class="resumen-grande">La página que buscas no está en el mapa.</p><div class="acciones"><a class="boton boton-rojo" href="${BASE}">Volver al inicio</a><a class="boton boton-linea" href="${BASE}#casos">Ver los casos</a></div></div></section>`,
}).replace('<meta name="robots" content="index, follow', '<meta name="robots" content="noindex, follow'));

// ---------- archivos para buscadores, asistentes y lectores ----------
const xml = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const hoy = new Date().toISOString();
escribir("sitemap.xml", `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:video="http://www.google.com/schemas/sitemap-video/1.1" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">
<url><loc>${BASE}</loc><lastmod>${casos[0].publicado}</lastmod><image:image><image:loc>${BASE}recursos/marca/banner.jpg</image:loc></image:image></url>
<url><loc>${BASE}sobre/</loc><lastmod>${casos[0].publicado}</lastmod></url>
${casos.map((c) => `<url><loc>${c.url}</loc><lastmod>${c.publicado}</lastmod>
<video:video><video:thumbnail_loc>${BASE}miniaturas/${c.id}.jpg</video:thumbnail_loc><video:title>${xml(c.titulo)}</video:title><video:description>${xml((c.resumen || c.titulo).slice(0, 2000))}</video:description><video:player_loc>https://www.youtube-nocookie.com/embed/${c.id}</video:player_loc>${c.duracion ? `<video:duration>${c.duracion}</video:duration>` : ""}<video:publication_date>${c.publicado}</video:publication_date><video:family_friendly>yes</video:family_friendly><video:live>no</video:live></video:video></url>`).join("\n")}
</urlset>
`);

// robots.txt: todo abierto, también a los rastreadores de asistentes (es lo que se quiere: que citen el canal).
escribir("robots.txt", `# Hilo y Mapa: web oficial. Todo el contenido es público y se puede citar enlazando la fuente.
User-agent: *
Allow: /

# Buscadores y asistentes de IA: bienvenidos.
${["Googlebot", "Bingbot", "Google-Extended", "GPTBot", "OAI-SearchBot", "ChatGPT-User", "ClaudeBot", "Claude-SearchBot", "Claude-User", "PerplexityBot", "Perplexity-User", "Applebot", "Applebot-Extended", "DuckAssistBot", "CCBot", "meta-externalagent", "MistralAI-User"].map((b) => `User-agent: ${b}\nAllow: /`).join("\n\n")}

Sitemap: ${BASE}sitemap.xml
`);

// llms.txt (llmstxt.org): resumen del sitio para asistentes, con enlace a cada caso. llms-full.txt: todo el texto.
const linea = (c) => `- [${c.tituloCorto}](${c.url}): ${c.resumen} (${fechaLarga(c.publicado)}${c.duracion ? `, ${reloj(c.duracion)}` : ""}${c.lugares.length ? `; lugares: ${c.lugares.map((l) => l.texto).join(", ")}` : ""}; vídeo: ${c.watch})`;
escribir("llms.txt", `# Hilo y Mapa

> ${canal.descripcion}

Canal de YouTube: ${canal.youtube} (${canal.handle}). Idioma: español (España). Cada caso tiene en esta web su resumen, capítulos, transcripción completa, fuentes y créditos de imágenes.

## Casos

${casos.map(linea).join("\n")}

## Sobre el canal

- [El método](${BASE}sobre/): cómo se hacen los documentales, normas editoriales, verificación y preguntas frecuentes.

## Optional

- [Texto completo de todos los casos](${BASE}llms-full.txt): resúmenes, capítulos, transcripciones y fuentes en un solo archivo.
`);
escribir("llms-full.txt", `# Hilo y Mapa: texto completo de los casos

${canal.descripcion}
Canal: ${canal.youtube}

${casos.map((c) => `---

## ${c.titulo}

- Página: ${c.url}
- Vídeo: ${c.watch}
- Publicado: ${fechaLarga(c.publicado)}${c.duracion ? `\n- Duración: ${reloj(c.duracion)}` : ""}${c.lugares.length ? `\n- Lugares: ${c.lugares.map((l) => `${l.texto} (${l.lat}, ${l.lon})`).join("; ")}` : ""}

${c.resumen}
${c.capitulos.length ? `\n### Capítulos\n\n${c.capitulos.map((k) => `- ${k.marca} ${k.titulo}`).join("\n")}\n` : ""}${c.transcripcion.length ? `\n### Transcripción\n\n${c.transcripcion.map((p) => p.texto).join("\n\n")}\n` : ""}${c.fuentes.length ? `\n### Fuentes\n\n${c.fuentes.map((u) => `- ${u}`).join("\n")}\n` : ""}`).join("\n")}
`);

escribir("feed.xml", `<?xml version="1.0" encoding="utf-8"?>
<feed xmlns="http://www.w3.org/2005/Atom" xml:lang="es">
<title>Hilo y Mapa: casos</title>
<subtitle>${xml(canal.lema)}</subtitle>
<link href="${BASE}" rel="alternate"/>
<link href="${BASE}feed.xml" rel="self"/>
<id>${BASE}</id>
<updated>${casos[0].publicado}</updated>
<author><name>Hilo y Mapa</name><uri>${canal.youtube}</uri></author>
<icon>${BASE}recursos/marca/avatar-192.png</icon>
${casos.map((c) => `<entry><title>${xml(c.titulo)}</title><link href="${c.url}" rel="alternate"/><id>${c.url}</id><published>${c.publicado}</published><updated>${c.publicado}</updated><summary>${xml(c.resumen)}</summary><content type="html">${xml(`<p><img src="${BASE}miniaturas/${c.id}.jpg" alt=""></p><p>${h(c.resumen)}</p><p><a href="${c.watch}">Ver en YouTube</a></p>`)}</content></entry>`).join("\n")}
</feed>
`);

escribir("manifest.webmanifest", JSON.stringify({
  name: "Hilo y Mapa", short_name: "Hilo y Mapa", description: canal.descripcionCorta, lang: "es", start_url: "./", display: "standalone",
  background_color: "#0A1118", theme_color: "#0A1118",
  icons: [{ src: "recursos/marca/avatar-192.png", sizes: "192x192", type: "image/png" }, { src: "recursos/marca/avatar-512.png", sizes: "512x512", type: "image/png" }],
}, null, 1));

console.log(`Web en _site/ (base ${BASE}): ${casos.length} casos, ${shorts.length} Shorts, ${cifras.lugares} lugares, ${cifras.fuentes} fuentes, ${cifras.datos} datos verificados`);
