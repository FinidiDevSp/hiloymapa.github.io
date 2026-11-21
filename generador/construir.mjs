// Construye la web estática en _site/ a partir de datos/ (RSS acumulado), contenido/ (lo que envía el estudio) y
// recursos/. Sin dependencias. Descarga las miniaturas de YouTube para servirlas desde la propia web.
// Español en la raíz e inglés en /en/ (solo los casos que el estudio ha traducido).
// Uso: node generador/construir.mjs [--base=https://hiloymapa.github.io/] [--sin-red]
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { h, slug, fechaLarga, fechaCorta, fechaHito, reloj, iso8601, minutos, leerDescripcion, dominio } from "./util.mjs";
import { pagina, reproductor, tarjetaCaso, tarjetaShort, ICONO, TEXTOS, RUTAS, plural } from "./plantillas.mjs";
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
    creditos: d.imagenes, // créditos de imagen de la descripción (las imágenes de la galería vienen del estudio)
    tituloCorto: v.titulo.split(" | ")[0],
    subtitulo: v.titulo.split(" | ").slice(1).join(" · "),
    episodio: c.episodio ?? null,
    duracion: c.duracion ?? null,
    lugares: c.lugares ?? [],
    transcripcion: c.transcripcion ?? [],
    datosVerificados: c.datosVerificados ?? 0,
    comprobaciones: c.comprobaciones ?? [],
    cronologia: c.cronologia ?? [],
    preguntas: c.preguntas ?? [],
    temas: c.temas ?? [],
    imagenes: c.imagenes ?? [],
    en: c.en ?? null,
    shorts: susShorts,
    url: `${BASE}casos/${v.slug}/`,
    urlEn: c.en ? `${BASE}en/cases/${v.slug}/` : null,
    watch: `https://www.youtube.com/watch?v=${v.id}`,
  };
}).sort((a, b) => b.publicado.localeCompare(a.publicado));
if (!casos.length) { console.log("Sin vídeos en datos/videos.json: ejecuta antes generador/actualizar.mjs"); process.exit(1); }

/** Un caso visto en un idioma: en inglés, los textos traducidos por el estudio (contenido → en). */
const enIdioma = (c, lang) => {
  if (lang === "es") return { ...c, lang };
  const e = c.en;
  return {
    ...c, lang,
    titulo: e.titulo, tituloCorto: e.titulo.split(" | ")[0], subtitulo: e.titulo.split(" | ").slice(1).join(" · "), resumen: e.resumen,
    capitulos: c.capitulos.map((k, i) => ({ ...k, titulo: e.capitulos[i] ?? k.titulo })),
    transcripcion: c.transcripcion.map((p, i) => ({ ...p, texto: e.transcripcion[i] ?? p.texto })),
    cronologia: c.cronologia.map((x, i) => ({ ...x, texto: e.cronologia[i] ?? x.texto })),
    preguntas: c.preguntas.map((x, i) => ({ ...x, ...(e.preguntas[i] ?? {}) })),
    temas: e.temas ?? c.temas,
    imagenes: c.imagenes.map((x, i) => ({ ...x, pie: e.pies[i] ?? x.pie })),
    url: c.urlEn,
  };
};
const casosEn = casos.filter((c) => c.en);

// Temas y lugares: páginas que reúnen los casos (en español; en inglés se enlaza a ellas).
const temas = new Map(), lugares = new Map();
for (const c of casos) {
  c.temas.forEach((t, i) => { const s = slug(t); if (!temas.has(s)) temas.set(s, { nombre: t, en: c.en?.temas?.[i] ?? null, casos: [] }); temas.get(s).casos.push(c); });
  for (const l of c.lugares) { const s = slug(l.texto); if (!lugares.has(s)) lugares.set(s, { nombre: l.texto, lon: l.lon, lat: l.lat, casos: [] }); if (!lugares.get(s).casos.includes(c)) lugares.get(s).casos.push(c); }
}

// Un tema que también es un lugar («Chicago») no tiene página propia: se enlaza la del lugar (sin contenido duplicado).
for (const s of [...temas.keys()]) if (lugares.has(s)) temas.delete(s);
const rutaTema = (s) => (lugares.has(s) ? `lugares/${s}/` : `temas/${s}/`);
const cifras = {
  casos: casos.length, shorts: shorts.length,
  lugares: lugares.size,
  fuentes: new Set(casos.flatMap((c) => c.fuentes)).size,
  datos: casos.reduce((a, c) => a + c.datosVerificados, 0),
  comprobaciones: casos.reduce((a, c) => a + c.comprobaciones.length, 0),
  imagenes: casos.reduce((a, c) => a + c.imagenes.length, 0),
};

// ---------- limpieza, recursos, miniaturas e imágenes ----------
fs.rmSync(SITE, { recursive: true, force: true });
fs.cpSync(path.join(RAIZ, "recursos"), path.join(SITE, "recursos"), { recursive: true });
if (fs.existsSync(path.join(RAIZ, "contenido/imagenes"))) fs.cpSync(path.join(RAIZ, "contenido/imagenes"), path.join(SITE, "imagenes"), { recursive: true });
fs.writeFileSync(path.join(SITE, ".nojekyll"), "");
if (canal.indexnow) fs.writeFileSync(path.join(SITE, `${canal.indexnow}.txt`), canal.indexnow);

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
  "@type": "Organization", "@id": `${BASE}#organizacion`, name: "Hilo y Mapa", alternateName: "Hilo y Mapa (Thread and Map)", url: BASE,
  logo: { "@type": "ImageObject", url: `${BASE}recursos/marca/avatar-512.png`, width: 512, height: 512 },
  image: `${BASE}recursos/marca/banner.jpg`, description: canal.descripcion, slogan: canal.lema,
  sameAs: canal.redes ?? [canal.youtube], foundingDate: canal.fundado, knowsLanguage: "es",
  foundingLocation: { "@type": "Country", name: "España" },
};
const imagenLD = (c, im) => ({
  "@type": "ImageObject", "@id": `${BASE}imagenes/${im.archivo.replace(/^imagenes\//, "")}`, contentUrl: `${BASE}imagenes/${im.archivo.replace(/^imagenes\//, "")}`,
  caption: im.pie, name: im.titulo, width: im.ancho, height: im.alto,
  creditText: [im.autor, im.institucion].filter(Boolean).join(" / "),
  ...(im.autor ? { creator: { "@type": "Person", name: im.autor } } : {}),
  ...(im.urlLicencia ? { license: im.urlLicencia } : {}), ...(im.ficha ? { acquireLicensePage: im.ficha } : {}),
  copyrightNotice: im.licencia,
});
const videoLD = (c) => ({
  "@type": "VideoObject", "@id": `${c.url}#video`,
  name: c.titulo, description: c.resumen || c.titulo,
  thumbnailUrl: [`${BASE}miniaturas/${c.id}.jpg`, `https://i.ytimg.com/vi/${c.id}/maxresdefault.jpg`],
  uploadDate: c.publicado, ...(c.duracion ? { duration: iso8601(c.duracion) } : {}),
  embedUrl: `https://www.youtube-nocookie.com/embed/${c.id}`, url: c.watch, inLanguage: "es",
  publisher: { "@id": `${BASE}#organizacion` }, creator: { "@id": `${BASE}#organizacion` }, isFamilyFriendly: true,
  potentialAction: { "@type": "SeekToAction", target: `${c.watch}&t={seek_to_second_number}`, "startOffset-input": "required name=seek_to_second_number" },
  ...(c.capitulos.length ? { hasPart: c.capitulos.map((k, i) => ({ "@type": "Clip", name: k.titulo, startOffset: k.t, ...(c.capitulos[i + 1] ? { endOffset: c.capitulos[i + 1].t } : c.duracion ? { endOffset: c.duracion } : {}), url: `${c.watch}&t=${k.t}s` })) } : {}),
  ...(c.lugares.length ? { contentLocation: c.lugares.map((l) => ({ "@type": "Place", name: l.texto, geo: { "@type": "GeoCoordinates", latitude: l.lat, longitude: l.lon } })) } : {}),
  ...(c.temas.length ? { about: c.temas.map((t) => ({ "@type": "Thing", name: t })), keywords: c.temas.join(", ") } : {}),
  ...(c.fuentes.length ? { citation: c.fuentes.map((u) => ({ "@type": "CreativeWork", url: u })) } : {}),
  ...(c.transcripcion.length ? { transcript: c.transcripcion.map((p) => p.texto).join(" ") } : {}),
  ...(c.imagenes.length ? { image: c.imagenes.map((im) => ({ "@id": imagenLD(c, im)["@id"] })) } : {}),
});
const faqLD = (preguntas) => ({ "@type": "FAQPage", mainEntity: preguntas.map((p) => ({ "@type": "Question", name: p.pregunta, acceptedAnswer: { "@type": "Answer", text: p.respuesta } })) });

// ---------- textos de las páginas ----------
const X = {
  es: {
    antetitulo: "Canal documental · En español", lema: canal.lema, entrada: canal.descripcionCorta,
    verUltimo: "Ver el último caso", suscribirseYT: "Suscribirse en YouTube",
    cifras: ["Casos", "Lugares", "Fuentes citadas", "Datos verificados"],
    ultimo: "Último caso", recorrido: "de recorrido", fuentesF: "fuentes", datosF: "datos verificados", lugaresF: "lugares",
    abrir: "Abrir el caso", verYT: "Ver en YouTube",
    archivo: "Archivo", todos: "Todos los casos", todosP: "Cada caso es un único recorrido continuo por el mapa, con fotos y documentos reales y las fuentes a la vista.",
    vertical: "En vertical", shortsP: "Un minuto, una pieza del caso. Cada Short lleva al documental completo.",
    geografia: "Geografía", mapaT: "El mapa de los casos", mapaP: "Cada hilo es un caso. Pasa por encima de uno para ver su recorrido; pulsa una chincheta para abrirlo.",
    como: "Cómo trabajamos", metodoT: "El método",
    pilares: [["Un solo recorrido", "Sin cortes de montaje: una cámara continua recorre el mapa del caso, de lugar en lugar, en el orden en que ocurrió."], ["Solo imágenes reales", "Fotografías y documentos de archivo. Lo que no existe no se inventa; lo reconstruido se marca como «RECREACIÓN»."], ["Cada dato, con fuente", "Cada afirmación del guion tiene su fuente y pasa una verificación independiente antes de grabarse."], ["Todo acreditado", "Fuentes, imágenes y licencias, en la descripción de cada vídeo y en la página de cada caso."]],
    metodoMas: "Leer el método completo", sigue: "Sigue el hilo", sigueP: "Un caso nuevo en cuanto está listo, con sus Shorts los días siguientes.", suscribirseA: "Suscribirse a Hilo y Mapa",
    capitulos: "Capítulos", transcripcion: "Transcripción", leerNarracion: "Leer la narración completa", palabras: "palabras", lectura: "de lectura en voz alta",
    cronologia: "Cronología", preguntas: "Preguntas sobre el caso", comprobaciones: "Comprobaciones",
    comprobacionesP: (n) => `Cada frase de la narración pasó una verificación independiente antes de grabarse. Estas ${n} son las que quedaron confirmadas, con lo que dice cada fuente.`,
    queDice: "Lo que dice", verMas: (n) => `Ver las ${n} comprobaciones`,
    documentos: "Documentos y fotografías", fuentesT: "Fuentes", fuentesP: (n) => `${n ? `El guion se apoya en ${n} datos verificados. ` : ""}Estas son las fuentes principales, tal como aparecen en el vídeo.`,
    creditos: "Imágenes y mapas", enMapa: "En el mapa", ficha: "Ficha", publicado: "Publicado", duracion: "Duración", nCapitulos: "Capítulos", nFuentes: "Fuentes", nDatos: "Datos verificados", nImagenes: "Imágenes acreditadas", nComprobaciones: "Comprobaciones",
    shortsCaso: "Shorts del caso", otros: "Otros casos", temasT: "Temas", migas: "Migas de pan", lugaresCaso: (l) => `Lugares del caso: ${l}`, licencia: "Licencia", verFicha: "ficha",
  },
  en: {
    antetitulo: "Documentary channel · In Spanish", lema: canal.lemaEn, entrada: canal.descripcionCortaEn,
    verUltimo: "Watch the latest case", suscribirseYT: "Subscribe on YouTube",
    cifras: ["Cases", "Places", "Sources cited", "Verified facts"],
    ultimo: "Latest case", recorrido: "long", fuentesF: "sources", datosF: "verified facts", lugaresF: "places",
    abrir: "Open the case", verYT: "Watch on YouTube",
    archivo: "Archive", todos: "All cases", todosP: "Each case is a single continuous journey across the map, with real photos and documents and every source in plain sight. Videos are narrated in Spanish, with captions.",
    vertical: "Vertical", shortsP: "One minute, one piece of the case. Each Short leads to the full documentary.",
    geografia: "Geography", mapaT: "The map of the cases", mapaP: "Each thread is a case. Hover over one to see its route; click a pin to open it.",
    como: "How we work", metodoT: "Our method",
    pilares: [["One single journey", "No editing cuts: one continuous camera travels the map of the case, place by place, in the order things happened."], ["Only real images", "Archival photographs and documents. Nothing that doesn't exist is made up; reconstructions are labelled “RECREACIÓN” (recreation)."], ["Every fact, sourced", "Every statement in the script has a source and passes an independent check before it is recorded."], ["Everything credited", "Sources, images and licenses, in each video's description and on each case page."]],
    metodoMas: "Read our full method", sigue: "Follow the thread", sigueP: "A new case as soon as it's ready, with its Shorts over the following days.", suscribirseA: "Subscribe to Hilo y Mapa",
    capitulos: "Chapters", transcripcion: "Transcript", leerNarracion: "Read the full narration (English translation)", palabras: "words", lectura: "read aloud",
    cronologia: "Timeline", preguntas: "Questions about the case", comprobaciones: "Fact checks",
    comprobacionesP: (n) => `Every sentence of the narration passed an independent check before recording. ${n} were confirmed; they are listed, in Spanish, on the Spanish page.`,
    queDice: "What it says", verMas: (n) => `See the ${n} fact checks`,
    documentos: "Documents and photographs", fuentesT: "Sources", fuentesP: (n) => `${n ? `The script relies on ${n} verified facts. ` : ""}These are the main sources, as listed in the video.`,
    creditos: "Images and maps", enMapa: "On the map", ficha: "Fact sheet", publicado: "Published", duracion: "Length", nCapitulos: "Chapters", nFuentes: "Sources", nDatos: "Verified facts", nImagenes: "Credited images", nComprobaciones: "Fact checks",
    shortsCaso: "Shorts from this case", otros: "More cases", temasT: "Topics", migas: "Breadcrumb", lugaresCaso: (l) => `Places in this case: ${l}`, licencia: "License", verFicha: "source",
  },
};

// ---------- portada ----------
const portada = (lang) => {
  const t = TEXTOS[lang], x = X[lang], R = RUTAS[lang];
  const r = lang === "es" ? "" : "../";
  const lista = (lang === "es" ? casos : casosEn).map((c) => enIdioma(c, lang));
  if (!lista.length) return;
  const cronologico = [...lista].reverse();
  const lugaresTodos = cronologico.flatMap((c) => c.lugares.map((l) => ({ ...l, url: `${r}${R.caso(c.slug)}` })));
  const ultimo = lista[0];
  const rutas = cronologico.filter((c) => c.lugares.length).map((c, i) => ({ c, i, pts: c.lugares.map((l) => proyectar(l.lon, l.lat)) }));
  const mapaCasos = mapa(lugaresTodos, { r, clase: "mapa-casos", aspecto: 2, margen: 0.12, minAncho: 300, animado: false, hiloDe: [], px: 1240, titulo: x.mapaT })
    .replace('<g class="pines">', `<g class="rutas">${rutas.map(({ c, i, pts }) => `<path class="ruta" data-caso="${h(c.slug)}" d="${hilo(pts, { caida: 0.12 })}" style="--i:${i}"/>`).join("")}</g><g class="pines">`);
  const cuerpo = `
<section class="portada" aria-labelledby="titulo-portada">
<div class="portada-mapa" aria-hidden="true">${mapa(lugaresTodos.filter((l) => l.lon > -100 && l.lon < 34), { r, clase: "mapa-portada", aspecto: 16 / 9, vista: [[-100, 18], [34, 62]], minAncho: 380, conNudo: true, px: 1440, titulo: "" })}</div>
<div class="portada-velo"></div>
<div class="ancho portada-texto">
<p class="antetitulo">${x.antetitulo}</p>
<h1 id="titulo-portada" class="marca-grande">Hilo <span>y</span> Mapa</h1>
<p class="lema">${h(x.lema)}</p>
<p class="entrada">${h(x.entrada)}</p>
<div class="acciones">
<a class="boton boton-rojo" href="${r}${R.caso(ultimo.slug)}">${ICONO.play}<span>${x.verUltimo}</span></a>
<a class="boton boton-linea" href="${h(canal.suscribirse)}" rel="noopener" target="_blank">${ICONO.youtube}<span>${x.suscribirseYT}</span></a>
</div>
</div>
<dl class="ancho portada-cifras">${[cifras.casos, cifras.lugares, cifras.fuentes, cifras.datos].map((n, i) => `<div><dt>${x.cifras[i]}</dt><dd>${n}</dd></div>`).join("")}</dl>
</section>

<section class="seccion ultimo" aria-labelledby="titulo-ultimo"><div class="ancho ultimo-rejilla">
${reproductor(ultimo, r, { clase: "revelar", lang, titulo: ultimo.titulo })}
<div class="ultimo-texto revelar">
<p class="antetitulo"><span class="punto-vivo"></span>${x.ultimo} · <time datetime="${h(ultimo.publicado)}">${fechaCorta(ultimo.publicado, lang)}</time></p>
<h2 id="titulo-ultimo">${h(ultimo.tituloCorto)}</h2>
<p class="resumen-grande">${h(ultimo.resumen)}</p>
<ul class="fichas">${[ultimo.duracion && `<li><b>${minutos(ultimo.duracion)}</b>${x.recorrido}</li>`, ultimo.fuentes.length && `<li><b>${ultimo.fuentes.length}</b>${x.fuentesF}</li>`, ultimo.datosVerificados && `<li><b>${ultimo.datosVerificados}</b>${x.datosF}</li>`, ultimo.lugares.length && `<li><b>${ultimo.lugares.length}</b>${x.lugaresF}</li>`].filter(Boolean).join("")}</ul>
<div class="acciones"><a class="boton boton-rojo" href="${r}${R.caso(ultimo.slug)}"><span>${x.abrir}</span>${ICONO.flecha}</a><a class="boton boton-linea" href="${h(ultimo.watch)}" rel="noopener" target="_blank">${ICONO.youtube}<span>${x.verYT}</span></a></div>
</div></div></section>

<section class="seccion" id="casos" aria-labelledby="titulo-casos"><div class="ancho">
<header class="seccion-cabecera revelar"><p class="antetitulo">${x.archivo}</p><h2 id="titulo-casos">${x.todos}</h2><p>${x.todosP}</p></header>
<div class="rejilla-casos">${lista.map((c) => tarjetaCaso(c, r, { lang })).join("\n")}</div>
</div></section>

${shorts.length ? `<section class="seccion seccion-shorts" id="shorts" aria-labelledby="titulo-shorts"><div class="ancho">
<header class="seccion-cabecera revelar"><p class="antetitulo">${x.vertical}</p><h2 id="titulo-shorts">Shorts</h2><p>${x.shortsP}</p></header>
</div><ul class="carril" role="list">${shorts.map((s) => tarjetaShort(s, r)).join("")}</ul></section>` : ""}

<section class="seccion seccion-mapa" id="mapa" aria-labelledby="titulo-mapa"><div class="ancho">
<header class="seccion-cabecera revelar"><p class="antetitulo">${x.geografia}</p><h2 id="titulo-mapa">${x.mapaT}</h2><p>${x.mapaP}</p></header>
<div class="mapa-casos-marco revelar">${mapaCasos}</div>
<ol class="leyenda">${rutas.slice().reverse().map(({ c }) => `<li><a href="${r}${R.caso(c.slug)}" data-caso="${h(c.slug)}"><span class="leyenda-hilo"></span><b>${h(c.tituloCorto)}</b><small>${h(c.lugares.map((l) => l.texto).join(" → "))}</small></a></li>`).join("")}</ol>
${lang === "es" && temas.size ? `<p class="chips-titulo">${x.temasT}</p><ul class="chips">${[...temas].map(([s, tm]) => `<li><a href="temas/${h(s)}/">${h(tm.nombre)}</a></li>`).join("")}</ul>` : ""}
</div></section>

<section class="seccion metodo" aria-labelledby="titulo-metodo"><div class="ancho">
<header class="seccion-cabecera revelar"><p class="antetitulo">${x.como}</p><h2 id="titulo-metodo">${x.metodoT}</h2></header>
<ol class="pilares">${x.pilares.map(([a, b], i) => `<li class="revelar"><span>0${i + 1}</span><h3>${a}</h3><p>${b}</p></li>`).join("")}</ol>
<p class="metodo-mas revelar"><a href="${r}${R.sobre}">${x.metodoMas} ${ICONO.flecha}</a></p>
</div></section>

<section class="llamada" aria-labelledby="titulo-llamada"><div class="ancho revelar">
<h2 id="titulo-llamada">${x.sigue}</h2>
<p>${x.sigueP}</p>
<a class="boton boton-rojo boton-grande" href="${h(canal.suscribirse)}" rel="noopener" target="_blank">${ICONO.youtube}<span>${x.suscribirseA}</span></a>
</div></section>`;
  const url = `${BASE}${R.inicio}`;
  escribir(`${R.inicio}index.html`, pagina({
    titulo: `Hilo y Mapa · ${x.lema}`, descripcion: x.entrada, canonical: url, r, base: BASE, canal, anio: ANIO, cuerpo, clase: "inicio", lang,
    alternas: casosEn.length ? { es: BASE, en: `${BASE}en/` } : null, otra: casosEn.length ? `${r}${lang === "es" ? "en/" : ""}` : null,
    jsonld: [{ "@context": "https://schema.org", "@graph": [
      ORG,
      { "@type": "WebSite", "@id": `${BASE}#web`, url: BASE, name: "Hilo y Mapa", inLanguage: ["es", ...(casosEn.length ? ["en"] : [])], publisher: { "@id": `${BASE}#organizacion` }, description: canal.descripcionCorta },
      { "@type": "ItemList", name: lang === "es" ? "Casos de Hilo y Mapa" : "Hilo y Mapa cases", itemListOrder: "https://schema.org/ItemListOrderDescending", numberOfItems: lista.length, itemListElement: lista.map((c, i) => ({ "@type": "ListItem", position: i + 1, url: c.url, name: c.titulo })) },
    ] }],
  }));
};
portada("es");
portada("en");

// ---------- páginas de caso ----------
const paginaCaso = (cEs, lang) => {
  const c = enIdioma(cEs, lang), t = TEXTOS[lang], x = X[lang], R = RUTAS[lang];
  const r = lang === "es" ? "../../" : "../../../";
  const otros = (lang === "es" ? casos : casosEn).filter((o) => o.id !== c.id).slice(0, 3).map((o) => enIdioma(o, lang));
  const palabras = c.transcripcion.reduce((a, p) => a + p.texto.split(/\s+/).length, 0);
  const capitulo = (s) => { let k = -1; c.capitulos.forEach((q, i) => { if (q.t <= s) k = i; }); return k; };
  let ultimoCap = -1;
  const transcripcion = c.transcripcion.map((p) => {
    const k = p.t !== null ? capitulo(p.t) : -1;
    const cab = k > ultimoCap && c.capitulos[k] ? `<h3 id="t-${c.capitulos[k].t}"><a href="${h(c.watch)}&amp;t=${c.capitulos[k].t}s" data-t="${c.capitulos[k].t}">${h(c.capitulos[k].marca)}</a> ${h(c.capitulos[k].titulo)}</h3>` : "";
    if (k > ultimoCap) ultimoCap = k;
    return `${cab}<p>${p.t !== null ? `<a class="marca-t" href="${h(c.watch)}&amp;t=${Math.floor(p.t)}s" data-t="${Math.floor(p.t)}">${reloj(p.t)}</a> ` : ""}${h(p.texto)}</p>`;
  }).join("\n");
  const comprobacion = (q) => `<li><p class="comprobacion-frase">${ICONO.check}${q.t !== null ? `<a class="marca-t" href="${h(c.watch)}&amp;t=${Math.floor(q.t)}s" data-t="${Math.floor(q.t)}">${reloj(q.t)}</a> ` : ""}«${h(q.texto)}»</p>
<ul class="comprobacion-fuentes">${q.fuentes.map((f) => `<li><a href="${h(f.url)}" rel="noopener" target="_blank">${h(dominio(f.url))}</a>${f.dice ? ` — ${h(f.dice)}` : ""}</li>`).join("")}</ul></li>`;
  const temasCaso = c.temas.map((tm, i) => ({ nombre: tm, slug: slug(cEs.temas[i] ?? tm) }));
  const cuerpo = `
<article class="caso">
<header class="caso-cabecera">
${c.lugares.length ? `<div class="caso-mapa" aria-hidden="true">${mapa(c.lugares, { r, clase: "mapa-caso", aspecto: 16 / 10, margen: 0.5, minAncho: 190, px: 1440, desplazar: 0.3, titulo: "" })}</div>` : ""}
<div class="caso-velo"></div>
<div class="ancho caso-titular">
<nav class="migas" aria-label="${x.migas}"><ol><li><a href="${r}${R.inicio}">${t.inicio}</a></li><li><a href="${r}${R.inicio}#casos">${t.casos}</a></li><li aria-current="page">${h(c.tituloCorto)}</li></ol></nav>
<p class="antetitulo"><time datetime="${h(c.publicado)}">${fechaLarga(c.publicado, lang)}</time>${c.duracion ? ` · ${reloj(c.duracion)}` : ""}${c.lugares.length ? ` · ${h(c.lugares.map((l) => l.texto).join(" · "))}` : ""}</p>
<h1>${h(c.tituloCorto)}${c.subtitulo ? `<span class="subtitulo">${h(c.subtitulo)}</span>` : ""}</h1>
<p class="resumen-grande">${h(c.resumen)}</p>
${temasCaso.length ? `<ul class="chips chips-cabecera">${temasCaso.map((tm) => `<li><a href="${r}${rutaTema(tm.slug)}"${lang === "en" ? ' hreflang="es"' : ""}>${h(tm.nombre)}</a></li>`).join("")}</ul>` : ""}
</div>
</header>

<div class="ancho caso-rejilla">
<div class="caso-principal">
${reproductor(c, r, { prioridad: true, clase: "reproductor-caso", lang, titulo: c.titulo })}
<div class="acciones"><a class="boton boton-rojo" href="${h(c.watch)}" rel="noopener" target="_blank">${ICONO.youtube}<span>${x.verYT}</span></a><a class="boton boton-linea" href="${h(canal.suscribirse)}" rel="noopener" target="_blank"><span>${t.suscribirse}</span></a></div>

${c.capitulos.length ? `<section class="bloque" aria-labelledby="h-capitulos"><h2 id="h-capitulos">${x.capitulos}</h2>
<ol class="capitulos">${c.capitulos.map((k) => `<li><a href="${h(c.watch)}&amp;t=${k.t}s" data-t="${k.t}"><span class="capitulo-t">${h(k.marca)}</span><span>${h(k.titulo)}</span></a></li>`).join("")}</ol></section>` : ""}

${c.cronologia.length ? `<section class="bloque" aria-labelledby="h-cronologia"><h2 id="h-cronologia">${x.cronologia}</h2>
<ol class="cronologia">${c.cronologia.map((q) => `<li><time datetime="${h(q.fecha)}">${h(fechaHito(q.fecha, lang))}</time><p>${h(q.texto)}</p></li>`).join("")}</ol></section>` : ""}

${c.imagenes.length ? `<section class="bloque" aria-labelledby="h-documentos"><h2 id="h-documentos">${x.documentos}</h2>
<div class="galeria">${c.imagenes.map((im) => `<figure><a href="${r}imagenes/${h(im.archivo.replace(/^imagenes\//, ""))}" target="_blank"><img src="${r}imagenes/${h(im.archivo.replace(/^imagenes\//, ""))}" alt="${h(im.pie)}" width="${im.ancho}" height="${im.alto}" loading="lazy" decoding="async"></a>
<figcaption>${h(im.pie)}<small>${h([im.autor, im.institucion].filter(Boolean).join(" · "))} · ${im.urlLicencia ? `<a href="${h(im.urlLicencia)}" rel="noopener license" target="_blank">${h(im.licencia)}</a>` : h(im.licencia)}${im.ficha ? ` · <a href="${h(im.ficha)}" rel="noopener" target="_blank">${x.verFicha}</a>` : ""}</small></figcaption></figure>`).join("")}</div></section>` : ""}

${c.preguntas.length ? `<section class="bloque" aria-labelledby="h-preguntas"><h2 id="h-preguntas">${x.preguntas}</h2>
<div class="preguntas">${c.preguntas.map((p, i) => `<details${i === 0 ? " open" : ""}><summary>${h(p.pregunta)}</summary><p>${h(p.respuesta)}</p></details>`).join("")}</div></section>` : ""}

${c.transcripcion.length ? `<section class="bloque" aria-labelledby="h-transcripcion"><h2 id="h-transcripcion">${x.transcripcion}</h2>
<details class="transcripcion"><summary>${x.leerNarracion} <small>${palabras} ${x.palabras} · ${minutos(c.duracion ?? palabras / 2.2)} ${x.lectura}</small></summary>
<div class="transcripcion-texto">${transcripcion}</div></details></section>` : ""}

${c.comprobaciones.length ? `<section class="bloque" aria-labelledby="h-comprobaciones"><h2 id="h-comprobaciones">${x.comprobaciones}</h2>
<p class="nota">${x.comprobacionesP(c.comprobaciones.length)}</p>
${lang === "es" ? `<ol class="comprobaciones">${c.comprobaciones.slice(0, 5).map(comprobacion).join("")}</ol>
${c.comprobaciones.length > 5 ? `<details class="mas"><summary>${x.verMas(c.comprobaciones.length)}</summary><ol class="comprobaciones" start="6">${c.comprobaciones.slice(5).map(comprobacion).join("")}</ol></details>` : ""}` : `<p><a href="${r}casos/${h(c.slug)}/#h-comprobaciones" hreflang="es">${x.verMas(c.comprobaciones.length)} (español) ${ICONO.flecha}</a></p>`}</section>` : ""}

${c.fuentes.length ? `<section class="bloque" aria-labelledby="h-fuentes"><h2 id="h-fuentes">${x.fuentesT}</h2>
<p class="nota">${x.fuentesP(c.datosVerificados)}</p>
<ol class="fuentes">${c.fuentes.map((u) => `<li><a href="${h(u)}" rel="noopener" target="_blank"><b>${h(dominio(u))}</b><span>${h((() => { try { return decodeURI(u.replace(/^https?:\/\/(www\.)?[^/]+/, "")) || "/"; } catch { return u; } })())}</span></a></li>`).join("")}</ol></section>` : ""}

${c.creditos.length ? `<section class="bloque" aria-labelledby="h-creditos"><h2 id="h-creditos">${x.creditos}</h2>
<ul class="creditos">${c.creditos.map((q) => `<li>${h(q)}</li>`).join("")}</ul>${c.aviso ? `<p class="nota">${h(c.aviso)}</p>` : ""}</section>` : ""}
</div>

<aside class="caso-lateral">
${c.lugares.length ? `<section class="bloque bloque-mapa"><h2>${x.enMapa}</h2>${mapa(c.lugares, { r, clase: "mapa-lateral", aspecto: 4 / 3, margen: 0.35, minAncho: 90, px: 290, escalaTexto: 0.85, titulo: x.lugaresCaso(c.lugares.map((l) => l.texto).join(", ")) })}
<ol class="lugares">${c.lugares.map((l) => `<li>${lang === "es" ? `<a href="${r}lugares/${h(slug(l.texto))}/">${h(l.texto)}</a>` : h(l.texto)}</li>`).join("")}</ol></section>` : ""}
<section class="bloque"><h2>${x.ficha}</h2><dl class="ficha">
<div><dt>${x.publicado}</dt><dd>${fechaLarga(c.publicado, lang)}</dd></div>
${c.duracion ? `<div><dt>${x.duracion}</dt><dd>${reloj(c.duracion)}</dd></div>` : ""}
${c.capitulos.length ? `<div><dt>${x.nCapitulos}</dt><dd>${c.capitulos.length}</dd></div>` : ""}
<div><dt>${x.nFuentes}</dt><dd>${c.fuentes.length}</dd></div>
${c.datosVerificados ? `<div><dt>${x.nDatos}</dt><dd>${c.datosVerificados}</dd></div>` : ""}
${c.comprobaciones.length ? `<div><dt>${x.nComprobaciones}</dt><dd>${c.comprobaciones.length}</dd></div>` : ""}
<div><dt>${x.nImagenes}</dt><dd>${c.creditos.length || c.imagenes.length}</dd></div>
</dl></section>
${c.shorts.length ? `<section class="bloque"><h2>${x.shortsCaso}</h2><ul class="carril carril-lateral" role="list">${c.shorts.map((s) => tarjetaShort(s, r)).join("")}</ul></section>` : ""}
</aside>
</div>

${otros.length ? `<section class="seccion"><div class="ancho"><header class="seccion-cabecera"><p class="antetitulo">${x.sigue}</p><h2>${x.otros}</h2></header>
<div class="rejilla-casos">${otros.map((o) => tarjetaCaso(o, r, { lang })).join("\n")}</div></div></section>` : ""}
</article>`;
  const ld = { ...videoLD(c), inLanguage: "es" };
  escribir(`${R.caso(c.slug)}index.html`, pagina({
    titulo: `${c.tituloCorto} · Hilo y Mapa`, descripcion: (c.resumen || c.titulo).slice(0, 300), canonical: c.url, r, base: BASE, canal, anio: ANIO, cuerpo, clase: "pagina-caso", lang,
    alternas: cEs.urlEn ? { es: cEs.url, en: cEs.urlEn } : null, otra: cEs.urlEn ? `${r}${RUTAS[lang === "es" ? "en" : "es"].caso(c.slug)}` : null,
    og: { tipo: "video.other", imagen: `${BASE}miniaturas/${c.id}.jpg`, ancho: 1280, alto: 720, titulo: c.titulo, alt: c.titulo, video: c.watch },
    precarga: [`${r}miniaturas/${c.id}.jpg`],
    jsonld: [{ "@context": "https://schema.org", "@graph": [
      ORG, ld,
      ...c.imagenes.map((im) => imagenLD(c, im)),
      { "@type": "WebPage", "@id": c.url, url: c.url, name: c.titulo, inLanguage: lang, isPartOf: { "@id": `${BASE}#web` }, primaryImageOfPage: `${BASE}miniaturas/${c.id}.jpg`, mainEntity: { "@id": `${c.url}#video` }, datePublished: c.publicado, ...(c.temas.length ? { about: c.temas.map((tm) => ({ "@type": "Thing", name: tm })) } : {}) },
      ...(c.preguntas.length ? [faqLD(c.preguntas)] : []),
      { "@type": "BreadcrumbList", itemListElement: [{ "@type": "ListItem", position: 1, name: t.inicio, item: `${BASE}${R.inicio}` }, { "@type": "ListItem", position: 2, name: t.casos, item: `${BASE}${R.inicio}#casos` }, { "@type": "ListItem", position: 3, name: c.tituloCorto, item: c.url }] },
    ] }],
  }));
};
for (const c of casos) paginaCaso(c, "es");
for (const c of casosEn) paginaCaso(c, "en");

// Redirecciones: las descripciones de YouTube enlazan a casos/<slug del episodio>/; si el vídeo tiene otro slug (el
// estudio envió su contenido después de que el RSS lo viera), esa ruta lleva al bueno.
for (const c of casos) if (c.episodio && c.episodio !== c.slug && !casos.some((o) => o.slug === c.episodio)) {
  escribir(`casos/${c.episodio}/index.html`, `<!doctype html><html lang="es"><head><meta charset="utf-8"><title>${h(c.tituloCorto)}</title><link rel="canonical" href="${h(c.url)}"><meta name="robots" content="noindex"><meta http-equiv="refresh" content="0; url=../${h(c.slug)}/"></head><body><a href="../${h(c.slug)}/">${h(c.titulo)}</a></body></html>\n`);
}

// ---------- temas y lugares ----------
const hub = ({ titulo, antetitulo, intro, lista, rel, lugar = null, descripcion }) => {
  const r = "../../";
  const cuerpo = `<section class="pagina-texto pagina-hub"><div class="ancho">
<nav class="migas" aria-label="Migas de pan"><ol><li><a href="${r}">Inicio</a></li><li><a href="${r}temas/">Temas y lugares</a></li><li aria-current="page">${h(titulo)}</li></ol></nav>
<p class="antetitulo">${antetitulo}</p><h1>${h(titulo)}</h1><p class="resumen-grande">${h(intro)}</p>
${lugar ? `<div class="hub-mapa">${mapa([lugar], { r, clase: "mapa-hub", aspecto: 3, margen: 0.3, minAncho: 140, px: 1240, titulo: `${titulo} en el mapa` })}</div>` : ""}
<h2 class="casos-hub">${lista.length === 1 ? "El caso" : "Los casos"}</h2>
<div class="rejilla-casos">${lista.map((c) => tarjetaCaso(c, r)).join("\n")}</div>
</div></section>`;
  escribir(`${rel}index.html`, pagina({
    titulo: `${titulo} · Hilo y Mapa`, descripcion, canonical: `${BASE}${rel}`, r, base: BASE, canal, anio: ANIO, cuerpo, activo: "temas", clase: "pagina-hub",
    jsonld: [{ "@context": "https://schema.org", "@graph": [ORG, { "@type": "CollectionPage", "@id": `${BASE}${rel}`, url: `${BASE}${rel}`, name: titulo, inLanguage: "es", isPartOf: { "@id": `${BASE}#web` }, about: lugar ? { "@type": "Place", name: titulo, geo: { "@type": "GeoCoordinates", latitude: lugar.lat, longitude: lugar.lon } } : { "@type": "Thing", name: titulo }, hasPart: lista.map((c) => ({ "@id": `${c.url}#video` })) },
      { "@type": "BreadcrumbList", itemListElement: [{ "@type": "ListItem", position: 1, name: "Inicio", item: BASE }, { "@type": "ListItem", position: 2, name: "Temas y lugares", item: `${BASE}temas/` }, { "@type": "ListItem", position: 3, name: titulo, item: `${BASE}${rel}` }] }] }],
  }));
};
const casosDe = (n) => `${n} ${n === 1 ? "caso" : "casos"}`;
for (const [s, tm] of temas) hub({ titulo: tm.nombre, antetitulo: `Tema · ${casosDe(tm.casos.length)}`, intro: `Los casos de Hilo y Mapa sobre ${tm.nombre}: cada uno, un recorrido por el mapa con fotos de archivo, cronología y fuentes.`, lista: tm.casos, rel: `temas/${s}/`, descripcion: `${tm.nombre}: documentales de Hilo y Mapa con mapa, cronología, fuentes y transcripción.` });
for (const [s, l] of lugares) hub({ titulo: l.nombre, antetitulo: `Lugar · ${casosDe(l.casos.length)}`, intro: `Los casos de Hilo y Mapa que pasan por ${l.nombre}.`, lista: l.casos, rel: `lugares/${s}/`, lugar: { texto: l.nombre, lon: l.lon, lat: l.lat }, descripcion: `${l.nombre} en los documentales de Hilo y Mapa: casos reales con mapa, fuentes y transcripción.` });
{
  const r = "../";
  const cuerpo = `<section class="pagina-texto"><div class="ancho">
<nav class="migas" aria-label="Migas de pan"><ol><li><a href="${r}">Inicio</a></li><li aria-current="page">Temas y lugares</li></ol></nav>
<p class="antetitulo">Índice</p><h1>Temas y lugares</h1><p class="resumen-grande">Las personas, los lugares y los tipos de caso que recorre Hilo y Mapa, con todos sus casos.</p>
<h2>Temas</h2><ul class="chips chips-grandes">${[...temas].sort((a, b) => a[1].nombre.localeCompare(b[1].nombre, "es")).map(([s, tm]) => `<li><a href="${s}/">${h(tm.nombre)} <small>${tm.casos.length}</small></a></li>`).join("")}</ul>
<h2>Lugares</h2><ul class="chips chips-grandes">${[...lugares].sort((a, b) => a[1].nombre.localeCompare(b[1].nombre, "es")).map(([s, l]) => `<li><a href="${r}lugares/${s}/">${h(l.nombre)} <small>${l.casos.length}</small></a></li>`).join("")}</ul>
</div></section>`;
  escribir("temas/index.html", pagina({ titulo: "Temas y lugares · Hilo y Mapa", descripcion: "Índice de las personas, lugares y temas de los documentales de Hilo y Mapa.", canonical: `${BASE}temas/`, r, base: BASE, canal, anio: ANIO, cuerpo, activo: "temas", clase: "pagina-hub", jsonld: [{ "@context": "https://schema.org", "@graph": [ORG, { "@type": "CollectionPage", "@id": `${BASE}temas/`, url: `${BASE}temas/`, name: "Temas y lugares", inLanguage: "es", isPartOf: { "@id": `${BASE}#web` } }] }] }));
}

// ---------- el método (sobre / about) ----------
const SOBRE = {
  es: {
    ruta: "sobre/", titulo: "El método de Hilo y Mapa", ante: "Sobre el canal", desc: "Cómo se hacen los documentales de Hilo y Mapa: un único recorrido por el mapa, solo imágenes reales, cada dato con fuente y verificación independiente.",
    quien: ["Quién hace Hilo y Mapa", "Hilo y Mapa es un canal documental independiente, hecho en España y en español. Lo firma el equipo de Hilo y Mapa: los vídeos se presentan con el nombre del canal, no con el de una persona. Respondemos de cada vídeo en sus comentarios de YouTube."],
    bloques: [
      ["Un único recorrido por el mapa", "Cada documental es una sola toma: una cámara continua recorre un mundo único —un mapa o una mesa de investigación— y se detiene en cada lugar cuando la narración lo nombra. Las fotografías y los documentos aparecen sobre el mapa, unidos por un hilo rojo que sigue el caso de principio a fin."],
    ],
    normasT: "Normas editoriales",
    normas: [["Fuentes para todo.", "Cada afirmación del guion está documentada con su fuente y su nivel de confianza. Si las fuentes discrepan, no se elige una: se cuenta lo que comparten o se omite el dato."], ["Verificación independiente.", "Antes de grabar la voz, una revisión separada intenta refutar cada frase del guion. Lo que no se sostiene se corrige o se quita. Las frases confirmadas se publican, con sus fuentes, en la página de cada caso."], ["Solo imágenes reales.", "Fotografías y documentos de archivo, con autor y licencia. Las reconstrucciones se marcan como «RECREACIÓN». Las imágenes sensibles se velan en el vídeo y no se publican en esta web."], ["Equidad.", "Cuando un caso sigue abierto o hay posturas enfrentadas, se atribuye cada una a quien la sostiene y no se da por probado lo que no lo está."], ["Créditos completos.", "Fuentes, imágenes y mapas se acreditan en la descripción de cada vídeo y en esta web."]],
    correccionesT: "Correcciones", correcciones: "Si encuentras un error, escríbelo en los comentarios del vídeo. Si se confirma, se corrige en la descripción y en la página del caso, y se indica qué ha cambiado.",
    cifrasT: "En cifras", cifras: [["Casos publicados", cifras.casos], ["Shorts", cifras.shorts], ["Lugares en el mapa", cifras.lugares], ["Fuentes citadas", cifras.fuentes], ["Datos verificados", cifras.datos], ["Comprobaciones publicadas", cifras.comprobaciones]],
    preguntasT: "Preguntas frecuentes",
    preguntas: [
      ["¿Qué es Hilo y Mapa?", "Un canal documental en español sobre casos reales —mafias, crímenes, golpes, fraudes y espionaje—. Cada vídeo cuenta un caso como un único recorrido continuo por el mapa donde ocurrió, con fotografías y documentos de archivo."],
      ["¿Las imágenes son reales?", "Sí. Se usan fotografías y documentos de archivo con su autor y su licencia. Lo que no existe no se sustituye por otra imagen. Cuando un documento se reconstruye para explicar algo, aparece marcado como «RECREACIÓN». Las imágenes sensibles se muestran veladas y poco tiempo."],
      ["¿Cómo se comprueban los datos?", "Cada afirmación del guion se apoya en fuentes documentadas y con un nivel de confianza. Antes de grabar, una revisión independiente intenta refutar el guion entero; lo que no se sostiene se corrige o se quita. Las comprobaciones confirmadas, con lo que dice cada fuente, están en la página de cada caso."],
      ["¿Dónde están las fuentes de cada vídeo?", "En la descripción del vídeo en YouTube y, ordenadas, en la página de cada caso de esta web, junto a la cronología, las comprobaciones y los créditos de las imágenes y los mapas."],
      ["¿Cada cuánto se publica?", "Cuando un caso está listo. Con cada documental salen tres Shorts: el primero a la vez y los otros dos en los días siguientes, a las 12:00 (hora de España)."],
      ["¿De dónde salen los mapas?", "De Natural Earth y de los datos de OpenStreetMap (© colaboradores de OpenStreetMap, licencia ODbL), dibujados para cada caso."],
    ],
    privT: "Privacidad",
  },
  en: {
    ruta: "en/about/", titulo: "The Hilo y Mapa method", ante: "About the channel", desc: "How Hilo y Mapa documentaries are made: one single journey across the map, only real images, every fact sourced and independently checked.",
    quien: ["Who makes Hilo y Mapa", "Hilo y Mapa (“Thread and Map”) is an independent documentary channel, made in Spain and narrated in Spanish. It is signed by the Hilo y Mapa team: videos go out under the channel's name, not a person's. We answer for every video in its YouTube comments."],
    bloques: [["One single journey across the map", "Each documentary is one single shot: a continuous camera travels through a single world —a map or an investigation desk— and stops at each place when the narration names it. Photographs and documents appear on the map, joined by a red thread that follows the case from start to finish."]],
    normasT: "Editorial standards",
    normas: [["Sources for everything.", "Every statement in the script is documented with its source and confidence level. When sources disagree, we don't pick one: we say what they share or leave the detail out."], ["Independent checking.", "Before the voice is recorded, a separate review tries to refute every sentence of the script. Whatever doesn't hold up is corrected or removed. Confirmed sentences are published, with their sources, on each case page."], ["Only real images.", "Archival photographs and documents, with author and license. Reconstructions are labelled “RECREACIÓN” (recreation). Sensitive images are veiled in the video and not published on this website."], ["Fairness.", "When a case is still open or there are opposing positions, each is attributed to whoever holds it, and nothing unproven is presented as proven."], ["Full credits.", "Sources, images and maps are credited in each video's description and on this website."]],
    correccionesT: "Corrections", correcciones: "If you find a mistake, write it in the video's comments. If it's confirmed, we correct the description and the case page and say what changed.",
    cifrasT: "In numbers", cifras: [["Published cases", cifras.casos], ["Shorts", cifras.shorts], ["Places on the map", cifras.lugares], ["Sources cited", cifras.fuentes], ["Verified facts", cifras.datos], ["Published fact checks", cifras.comprobaciones]],
    preguntasT: "Frequently asked questions",
    preguntas: [
      ["What is Hilo y Mapa?", "A Spanish-language documentary channel about real cases —mafias, crimes, heists, frauds and espionage. Each video tells one case as a single continuous journey across the map where it happened, with archival photographs and documents."],
      ["Are the images real?", "Yes. We use archival photographs and documents, credited with their author and license. Nothing that doesn't exist is replaced with another image. When a document is reconstructed to explain something, it is labelled “RECREACIÓN” (recreation). Sensitive images are shown veiled and briefly."],
      ["How are the facts checked?", "Every statement in the script relies on documented sources with a confidence level. Before recording, an independent review tries to refute the whole script; whatever doesn't hold up is corrected or removed. Confirmed checks, with what each source says, are on each case page."],
      ["Are the videos in English?", "The videos are narrated in Spanish. This website offers English pages with the summary, chapters, timeline, questions and a translated transcript of each case."],
      ["Where do the maps come from?", "From Natural Earth and OpenStreetMap data (© OpenStreetMap contributors, ODbL license), drawn for each case."],
    ],
    privT: "Privacy",
  },
};
const PRIVACIDAD = (lang) => {
  const a = canal.analitica?.proveedor && (canal.analitica.token || canal.analitica.codigo);
  return lang === "es"
    ? `Esta web no usa cookies ni publicidad.${a ? ` Cuenta las visitas de forma anónima y sin cookies (${canal.analitica.proveedor === "cloudflare" ? "Cloudflare Web Analytics" : "GoatCounter"}): no guarda datos personales ni te sigue entre webs.` : " Tampoco analítica."} Las miniaturas y las imágenes se sirven desde la propia web. Los vídeos se cargan desde YouTube (en su versión sin cookies, youtube-nocookie.com) solo cuando pulsas «reproducir»; a partir de ese momento se aplica la <a href="https://policies.google.com/privacy" rel="noopener" target="_blank">política de privacidad de Google</a>.`
    : `This website uses no cookies and no advertising.${a ? ` Visits are counted anonymously and without cookies (${canal.analitica.proveedor === "cloudflare" ? "Cloudflare Web Analytics" : "GoatCounter"}): no personal data is stored and you are not tracked across websites.` : " No analytics either."} Thumbnails and images are served from this website. Videos load from YouTube (its no-cookie version, youtube-nocookie.com) only when you press “play”; from then on <a href="https://policies.google.com/privacy" rel="noopener" target="_blank">Google's privacy policy</a> applies.`;
};
for (const lang of ["es", "en"]) {
  const s = SOBRE[lang], R = RUTAS[lang], t = TEXTOS[lang], x = X[lang];
  const r = lang === "es" ? "../" : "../../";
  const cuerpo = `
<article class="pagina-texto"><div class="ancho estrecho">
<nav class="migas" aria-label="${x.migas}"><ol><li><a href="${r}${R.inicio}">${t.inicio}</a></li><li aria-current="page">${t.metodo}</li></ol></nav>
<p class="antetitulo">${s.ante}</p>
<h1>${s.titulo}</h1>
<p class="resumen-grande">${h(lang === "es" ? canal.descripcion : canal.descripcionEn)}</p>
<h2>${s.quien[0]}</h2><p>${s.quien[1]}</p>
${s.bloques.map(([a, b]) => `<h2>${a}</h2><p>${b}</p>`).join("")}
<h2>${s.normasT}</h2>
<ul class="lista-normas">${s.normas.map(([a, b]) => `<li><b>${a}</b> ${b}</li>`).join("")}</ul>
<h2>${s.correccionesT}</h2><p>${s.correcciones}</p>
<h2>${s.cifrasT}</h2>
<dl class="cifras-texto">${s.cifras.map(([a, n]) => `<div><dt>${a}</dt><dd>${n}</dd></div>`).join("")}</dl>
<h2 id="preguntas">${s.preguntasT}</h2>
<div class="preguntas">${s.preguntas.map(([p, rsp]) => `<details><summary>${h(p)}</summary><p>${h(rsp)}</p></details>`).join("")}</div>
<h2 id="privacidad">${s.privT}</h2>
<p>${PRIVACIDAD(lang)}</p>
<div class="acciones"><a class="boton boton-rojo" href="${h(canal.suscribirse)}" rel="noopener" target="_blank">${ICONO.youtube}<span>${x.suscribirseYT}</span></a><a class="boton boton-linea" href="${r}${R.inicio}#casos"><span>${x.todos}</span></a></div>
</div></article>`;
  escribir(`${s.ruta}index.html`, pagina({
    titulo: `${t.metodo} · Hilo y Mapa`, descripcion: s.desc, canonical: `${BASE}${s.ruta}`, r, base: BASE, canal, anio: ANIO, cuerpo, activo: "sobre", clase: "pagina-sobre", lang,
    alternas: { es: `${BASE}sobre/`, en: `${BASE}en/about/` }, otra: `${r}${SOBRE[lang === "es" ? "en" : "es"].ruta}`,
    jsonld: [{ "@context": "https://schema.org", "@graph": [
      ORG,
      { "@type": "AboutPage", "@id": `${BASE}${s.ruta}`, url: `${BASE}${s.ruta}`, name: s.titulo, inLanguage: lang, about: { "@id": `${BASE}#organizacion` }, isPartOf: { "@id": `${BASE}#web` } },
      faqLD(s.preguntas.map(([pregunta, respuesta]) => ({ pregunta, respuesta }))),
    ] }],
  }));
}

// ---------- 404 ----------
escribir("404.html", pagina({
  titulo: "Aquí se pierde el hilo · Hilo y Mapa", descripcion: "Esta página no existe.", canonical: `${BASE}404.html`, r: BASE, base: BASE, canal, anio: ANIO, clase: "pagina-404", robots: "noindex, follow",
  cuerpo: `<section class="error"><div class="ancho estrecho"><p class="antetitulo">Error 404</p><h1 class="marca-grande">Aquí se pierde el hilo</h1><p class="resumen-grande">La página que buscas no está en el mapa. <span lang="en">This page is not on the map.</span></p><div class="acciones"><a class="boton boton-rojo" href="${BASE}">Volver al inicio</a><a class="boton boton-linea" href="${BASE}en/" hreflang="en">English</a></div></div></section>`,
}));

// ---------- archivos para buscadores, asistentes y lectores ----------
const xml = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const alt = (es, en) => (en ? `<xhtml:link rel="alternate" hreflang="es" href="${es}"/><xhtml:link rel="alternate" hreflang="en" href="${en}"/>` : "");
const ultimaFecha = casos[0].publicado;
const urlsSitemap = [];
const entrada = (loc, extra = "", lastmod = ultimaFecha) => { urlsSitemap.push(loc); return `<url><loc>${loc}</loc><lastmod>${lastmod}</lastmod>${extra}</url>`; };
escribir("sitemap.xml", `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:video="http://www.google.com/schemas/sitemap-video/1.1" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1" xmlns:xhtml="http://www.w3.org/1999/xhtml">
${entrada(BASE, `${alt(BASE, casosEn.length ? `${BASE}en/` : null)}<image:image><image:loc>${BASE}recursos/marca/banner.jpg</image:loc></image:image>`)}
${casosEn.length ? entrada(`${BASE}en/`, alt(BASE, `${BASE}en/`)) : ""}
${entrada(`${BASE}sobre/`, alt(`${BASE}sobre/`, `${BASE}en/about/`))}
${entrada(`${BASE}en/about/`, alt(`${BASE}sobre/`, `${BASE}en/about/`))}
${entrada(`${BASE}temas/`)}
${[...temas.keys()].map((s) => entrada(`${BASE}temas/${s}/`)).join("\n")}
${[...lugares.keys()].map((s) => entrada(`${BASE}lugares/${s}/`)).join("\n")}
${[...casos.map((c) => [c, "es"]), ...casosEn.map((c) => [c, "en"])].map(([c, lang]) => {
  const v = enIdioma(c, lang);
  return entrada(v.url, `${alt(c.url, c.urlEn)}${c.imagenes.map((im) => `<image:image><image:loc>${BASE}imagenes/${im.archivo.replace(/^imagenes\//, "")}</image:loc></image:image>`).join("")}<video:video><video:thumbnail_loc>${BASE}miniaturas/${c.id}.jpg</video:thumbnail_loc><video:title>${xml(v.titulo)}</video:title><video:description>${xml((v.resumen || v.titulo).slice(0, 2000))}</video:description><video:player_loc>https://www.youtube-nocookie.com/embed/${c.id}</video:player_loc>${c.duracion ? `<video:duration>${c.duracion}</video:duration>` : ""}<video:publication_date>${c.publicado}</video:publication_date><video:family_friendly>yes</video:family_friendly><video:live>no</video:live></video:video>`, c.publicado);
}).join("\n")}
</urlset>
`);
escribir("urls.txt", urlsSitemap.join("\n") + "\n"); // para IndexNow (generador/indexnow.mjs)

escribir("robots.txt", `# Hilo y Mapa: web oficial. Todo el contenido es público y se puede citar enlazando la fuente.
User-agent: *
Allow: /

# Buscadores y asistentes de IA: bienvenidos.
${["Googlebot", "Bingbot", "Google-Extended", "GPTBot", "OAI-SearchBot", "ChatGPT-User", "ClaudeBot", "Claude-SearchBot", "Claude-User", "PerplexityBot", "Perplexity-User", "Applebot", "Applebot-Extended", "DuckAssistBot", "CCBot", "meta-externalagent", "MistralAI-User"].map((b) => `User-agent: ${b}\nAllow: /`).join("\n\n")}

Sitemap: ${BASE}sitemap.xml
`);

const linea = (c) => `- [${c.tituloCorto}](${c.url}): ${c.resumen} (${fechaLarga(c.publicado)}${c.duracion ? `, ${reloj(c.duracion)}` : ""}${c.lugares.length ? `; lugares: ${c.lugares.map((l) => l.texto).join(", ")}` : ""}${c.temas.length ? `; temas: ${c.temas.join(", ")}` : ""}; vídeo: ${c.watch})`;
escribir("llms.txt", `# Hilo y Mapa

> ${canal.descripcion}

Canal de YouTube: ${canal.youtube} (${canal.handle}). Idioma: español (España); páginas en inglés en ${BASE}en/. Cada caso tiene en esta web su resumen, cronología, preguntas frecuentes, capítulos, transcripción completa, comprobaciones (las frases del guion confirmadas por una verificación independiente, con lo que dice cada fuente), fuentes y créditos de imágenes.

## Casos

${casos.map(linea).join("\n")}

## Temas y lugares

${[...temas].map(([s, tm]) => `- [${tm.nombre}](${BASE}temas/${s}/): ${casosDe(tm.casos.length)}`).join("\n")}
${[...lugares].map(([s, l]) => `- [${l.nombre}](${BASE}lugares/${s}/): ${casosDe(l.casos.length)}`).join("\n")}

## Sobre el canal

- [El método](${BASE}sobre/): cómo se hacen los documentales, normas editoriales, verificación y preguntas frecuentes.
- [Our method (English)](${BASE}en/about/)

## Optional

- [Texto completo de todos los casos](${BASE}llms-full.txt): resúmenes, cronologías, preguntas, transcripciones, comprobaciones y fuentes en un solo archivo.
`);
escribir("llms-full.txt", `# Hilo y Mapa: texto completo de los casos

${canal.descripcion}
Canal: ${canal.youtube}

${casos.map((c) => `---

## ${c.titulo}

- Página: ${c.url}${c.urlEn ? `\n- English page: ${c.urlEn}` : ""}
- Vídeo: ${c.watch}
- Publicado: ${fechaLarga(c.publicado)}${c.duracion ? `\n- Duración: ${reloj(c.duracion)}` : ""}${c.lugares.length ? `\n- Lugares: ${c.lugares.map((l) => `${l.texto} (${l.lat}, ${l.lon})`).join("; ")}` : ""}${c.temas.length ? `\n- Temas: ${c.temas.join(", ")}` : ""}

${c.resumen}
${c.cronologia.length ? `\n### Cronología\n\n${c.cronologia.map((q) => `- ${fechaHito(q.fecha)}: ${q.texto}`).join("\n")}\n` : ""}${c.preguntas.length ? `\n### Preguntas\n\n${c.preguntas.map((p) => `**${p.pregunta}** ${p.respuesta}`).join("\n\n")}\n` : ""}${c.capitulos.length ? `\n### Capítulos\n\n${c.capitulos.map((k) => `- ${k.marca} ${k.titulo}`).join("\n")}\n` : ""}${c.transcripcion.length ? `\n### Transcripción\n\n${c.transcripcion.map((p) => p.texto).join("\n\n")}\n` : ""}${c.comprobaciones.length ? `\n### Comprobaciones (frases del guion confirmadas por una verificación independiente)\n\n${c.comprobaciones.map((q) => `- «${q.texto}» — ${q.fuentes.map((f) => `${f.url}${f.dice ? ` («${f.dice}»)` : ""}`).join("; ")}`).join("\n")}\n` : ""}${c.fuentes.length ? `\n### Fuentes\n\n${c.fuentes.map((u) => `- ${u}`).join("\n")}\n` : ""}`).join("\n")}
`);

escribir("feed.xml", `<?xml version="1.0" encoding="utf-8"?>
<feed xmlns="http://www.w3.org/2005/Atom" xml:lang="es">
<title>Hilo y Mapa: casos</title>
<subtitle>${xml(canal.lema)}</subtitle>
<link href="${BASE}" rel="alternate"/>
<link href="${BASE}feed.xml" rel="self"/>
<id>${BASE}</id>
<updated>${ultimaFecha}</updated>
<author><name>Hilo y Mapa</name><uri>${canal.youtube}</uri></author>
<icon>${BASE}recursos/marca/avatar-192.png</icon>
${casos.map((c) => `<entry><title>${xml(c.titulo)}</title><link href="${c.url}" rel="alternate"/><id>${c.url}</id><published>${c.publicado}</published><updated>${c.publicado}</updated><summary>${xml(c.resumen)}</summary>${c.temas.map((tm) => `<category term="${xml(tm)}"/>`).join("")}<content type="html">${xml(`<p><img src="${BASE}miniaturas/${c.id}.jpg" alt=""></p><p>${h(c.resumen)}</p><p><a href="${c.watch}">Ver en YouTube</a></p>`)}</content></entry>`).join("\n")}
</feed>
`);

escribir("manifest.webmanifest", JSON.stringify({
  name: "Hilo y Mapa", short_name: "Hilo y Mapa", description: canal.descripcionCorta, lang: "es", start_url: "./", display: "standalone",
  background_color: "#0A1118", theme_color: "#0A1118",
  icons: [{ src: "recursos/marca/avatar-192.png", sizes: "192x192", type: "image/png" }, { src: "recursos/marca/avatar-512.png", sizes: "512x512", type: "image/png" }],
}, null, 1));

console.log(`Web en _site/ (base ${BASE}): ${casos.length} casos (${casosEn.length} en inglés), ${shorts.length} Shorts, ${temas.size} temas, ${lugares.size} lugares, ${cifras.fuentes} fuentes, ${cifras.datos} datos verificados, ${cifras.comprobaciones} comprobaciones, ${cifras.imagenes} imágenes, ${urlsSitemap.length} URL en el sitemap`);
