// Plantillas HTML de la web, en español (raíz) e inglés (/en/). Todas las rutas internas son relativas (r = prefijo
// hasta la raíz): la web funciona igual en hiloymapa.github.io, en una subcarpeta o en un dominio propio.
import { h, fechaCorta, minutos } from "./util.mjs";

export const ICONO = {
  youtube: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M23 7.2a3 3 0 0 0-2.1-2.1C19 4.6 12 4.6 12 4.6s-7 0-8.9.5A3 3 0 0 0 1 7.2 31 31 0 0 0 .5 12a31 31 0 0 0 .5 4.8 3 3 0 0 0 2.1 2.1c1.9.5 8.9.5 8.9.5s7 0 8.9-.5a3 3 0 0 0 2.1-2.1 31 31 0 0 0 .5-4.8 31 31 0 0 0-.5-4.8zM9.7 15.1V8.9l5.8 3.1-5.8 3.1z"/></svg>`,
  play: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5.5v13l11-6.5z"/></svg>`,
  rss: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 3a16 16 0 0 1 16 16h-3A13 13 0 0 0 5 6zm0 6a10 10 0 0 1 10 10h-3a7 7 0 0 0-7-7zm2 6a2 2 0 1 1 0 4 2 2 0 0 1 0-4z"/></svg>`,
  flecha: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M13 5l7 7-7 7-1.4-1.4 4.6-4.6H4v-2h12.2l-4.6-4.6z"/></svg>`,
  check: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9.5 16.2 5.3 12l-1.4 1.4 5.6 5.6L20.1 8.4 18.7 7z"/></svg>`,
};

/** Textos de la interfaz. */
export const TEXTOS = {
  es: {
    lang: "es", locale: "es_ES", saltar: "Saltar al contenido", inicio: "Inicio", casos: "Casos", shorts: "Shorts", mapa: "Mapa", metodo: "El método", temas: "Temas",
    suscribirse: "Suscribirse", canalYT: "Canal de YouTube", preguntas: "Preguntas", privacidad: "Privacidad", otroIdioma: "English", otroIdiomaLargo: "Read in English",
    legal: "Web oficial del canal. Las imágenes de archivo pertenecen a sus autores y se usan según las licencias indicadas en cada caso. Mapas: datos de Natural Earth y de los colaboradores de OpenStreetMap (ODbL).",
    reproducir: (t) => `Reproducir «${t}»`, avisoYT: "Al reproducir se carga YouTube (sin cookies hasta entonces).",
    fuente: ["fuente", "fuentes"], dato: ["dato verificado", "datos verificados"], short: ["Short", "Shorts"],
    inicioAria: "Hilo y Mapa, inicio", principal: "Principal", pieAria: "Pie", feedTitulo: "Hilo y Mapa: casos",
  },
  en: {
    lang: "en", locale: "en_US", saltar: "Skip to content", inicio: "Home", casos: "Cases", shorts: "Shorts", mapa: "Map", metodo: "Our method", temas: "Topics",
    suscribirse: "Subscribe", canalYT: "YouTube channel", preguntas: "FAQ", privacidad: "Privacy", otroIdioma: "Español", otroIdiomaLargo: "Leer en español",
    legal: "Official website of the channel. Archival images belong to their authors and are used under the licenses listed for each case. Maps: Natural Earth and OpenStreetMap contributors (ODbL).",
    reproducir: (t) => `Play “${t}”`, avisoYT: "Playing loads YouTube (no cookies until then).",
    fuente: ["source", "sources"], dato: ["verified fact", "verified facts"], short: ["Short", "Shorts"],
    inicioAria: "Hilo y Mapa, home", principal: "Main", pieAria: "Footer", feedTitulo: "Hilo y Mapa: cases",
  },
};

/** Rutas relativas a la raíz de la web, por idioma. */
export const RUTAS = {
  es: { inicio: "", caso: (s) => `casos/${s}/`, sobre: "sobre/", temas: "temas/" },
  en: { inicio: "en/", caso: (s) => `en/cases/${s}/`, sobre: "en/about/", temas: "temas/" },
};

/** «1 fuente», «16 fuentes»; vacío si es 0. */
export const plural = (n, [uno, varios]) => (n ? `${n} ${n === 1 ? uno : varios}` : "");

export const logo = (r, t, lang) => `<a class="logo" href="${r}${RUTAS[lang].inicio || "./"}" aria-label="${t.inicioAria}">
<svg viewBox="0 0 64 40" aria-hidden="true"><path class="logo-hilo" d="M2 32 H22 C27 32 29 30 31 26 L38 12 C40 7 34 3 32 3 C30 3 24 7 26 12 L33 26 C35 30 37 32 42 32 H62"/><circle class="logo-pin" cx="32" cy="4" r="3.6"/></svg>
<span>Hilo <i>y</i> Mapa</span></a>`;

const cabecera = (r, canal, lang, activo, otra) => {
  const t = TEXTOS[lang], R = RUTAS[lang], ini = `${r}${R.inicio || "./"}`;
  return `<a class="saltar" href="#contenido">${t.saltar}</a>
<header class="cabecera"><div class="ancho">
${logo(r, t, lang)}
<nav aria-label="${t.principal}"><ul>
<li><a href="${ini}#casos"${activo === "casos" ? ' aria-current="page"' : ""}>${t.casos}</a></li>
<li><a href="${ini}#shorts">${t.shorts}</a></li>
<li><a href="${ini}#mapa">${t.mapa}</a></li>
${lang === "es" ? `<li><a href="${r}temas/"${activo === "temas" ? ' aria-current="page"' : ""}>${t.temas}</a></li>` : ""}
<li><a href="${r}${R.sobre}"${activo === "sobre" ? ' aria-current="page"' : ""}>${t.metodo}</a></li>
</ul></nav>
${otra ? `<a class="idioma" href="${h(otra)}" hreflang="${lang === "es" ? "en" : "es"}" lang="${lang === "es" ? "en" : "es"}" title="${t.otroIdiomaLargo}">${lang === "es" ? "EN" : "ES"}</a>` : ""}
<a class="boton boton-rojo boton-peque" href="${h(canal.suscribirse)}" rel="noopener" target="_blank">${ICONO.youtube}<span>${t.suscribirse}</span></a>
</div></header>`;
};

const pie = (r, canal, anio, lang) => {
  const t = TEXTOS[lang], R = RUTAS[lang];
  return `<footer class="pie"><div class="ancho">
<div class="pie-marca">${logo(r, t, lang)}<p>${h(lang === "es" ? canal.lema : canal.lemaEn)}.</p></div>
<nav aria-label="${t.pieAria}"><ul>
<li><a href="${h(canal.youtube)}" rel="noopener" target="_blank">${t.canalYT}</a></li>
<li><a href="${r}${R.sobre}">${t.metodo}</a></li>
<li><a href="${r}${R.sobre}#preguntas">${t.preguntas}</a></li>
<li><a href="${r}${R.sobre}#privacidad">${t.privacidad}</a></li>
${lang === "es" ? `<li><a href="${r}temas/">${t.temas}</a></li>` : ""}
<li><a href="${r}${lang === "es" ? "en/" : ""}" hreflang="${lang === "es" ? "en" : "es"}">${t.otroIdioma}</a></li>
<li><a href="${r}feed.xml">${ICONO.rss} RSS</a></li>
</ul></nav>
<p class="pie-legal">© ${anio} Hilo y Mapa · ${t.legal}</p>
</div></footer>`;
};

/** Analítica sin cookies (datos/canal.json → analitica). */
const analitica = (a) => {
  if (a?.proveedor === "cloudflare" && a.token) return `<script defer src="https://static.cloudflareinsights.com/beacon.min.js" data-cf-beacon='{"token": "${h(a.token)}"}'></script>`;
  if (a?.proveedor === "goatcounter" && a.codigo) return `<script data-goatcounter="https://${h(a.codigo)}.goatcounter.com/count" async src="https://gc.zgo.at/count.js"></script>`;
  return "";
};

/**
 * Página completa. og: { imagen (absoluta), tipo }. jsonld: lista de objetos schema.org.
 * alternas: { es: URL absoluta, en: URL absoluta } para hreflang; otra: ruta relativa a la versión en el otro idioma.
 */
export const pagina = ({ titulo, descripcion, canonical, r, base, og = {}, jsonld = [], cuerpo, canal, anio, activo, clase = "", precarga = [], lang = "es", alternas = null, otra = null, robots = "index, follow" }) => `<!doctype html>
<html lang="${lang}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${h(titulo)}</title>
<meta name="description" content="${h(descripcion)}">
<link rel="canonical" href="${h(canonical)}">
${alternas ? Object.entries(alternas).map(([l, u]) => `<link rel="alternate" hreflang="${l}" href="${h(u)}">`).join("\n") + `\n<link rel="alternate" hreflang="x-default" href="${h(alternas.es)}">` : ""}
<meta name="robots" content="${robots}, max-image-preview:large, max-video-preview:-1, max-snippet:-1">
${canal.verificacion?.google ? `<meta name="google-site-verification" content="${h(canal.verificacion.google)}">` : ""}
${canal.verificacion?.bing ? `<meta name="msvalidate.01" content="${h(canal.verificacion.bing)}">` : ""}
<meta name="theme-color" content="#0A1118">
<meta name="color-scheme" content="dark">
<meta property="og:site_name" content="Hilo y Mapa">
<meta property="og:locale" content="${TEXTOS[lang].locale}">
${alternas ? `<meta property="og:locale:alternate" content="${lang === "es" ? "en_US" : "es_ES"}">` : ""}
<meta property="og:type" content="${og.tipo ?? "website"}">
<meta property="og:title" content="${h(og.titulo ?? titulo)}">
<meta property="og:description" content="${h(descripcion)}">
<meta property="og:url" content="${h(canonical)}">
<meta property="og:image" content="${h(og.imagen ?? base + "recursos/marca/redes.jpg")}">
<meta property="og:image:width" content="${og.ancho ?? 1200}">
<meta property="og:image:height" content="${og.alto ?? 630}">
<meta property="og:image:alt" content="${h(og.alt ?? "Hilo y Mapa")}">
${og.video ? `<meta property="og:video" content="${h(og.video)}">\n<meta property="og:video:type" content="text/html">` : ""}
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${h(og.titulo ?? titulo)}">
<meta name="twitter:description" content="${h(descripcion)}">
<meta name="twitter:image" content="${h(og.imagen ?? base + "recursos/marca/redes.jpg")}">
<link rel="icon" href="${r}recursos/marca/avatar-32.png" sizes="32x32">
<link rel="icon" href="${r}recursos/marca/avatar-192.png" sizes="192x192">
<link rel="apple-touch-icon" href="${r}recursos/marca/avatar-192.png">
<link rel="manifest" href="${r}manifest.webmanifest">
<link rel="alternate" type="application/atom+xml" title="${TEXTOS[lang].feedTitulo}" href="${r}feed.xml">
<link rel="preload" href="${r}recursos/fuentes/bebas-neue.woff2" as="font" type="font/woff2" crossorigin>
<link rel="preload" href="${r}recursos/fuentes/source-serif-4.woff2" as="font" type="font/woff2" crossorigin>
${precarga.map((p) => `<link rel="preload" href="${h(p)}" as="image" fetchpriority="high">`).join("\n")}
<script>document.documentElement.classList.add("js")</script>
<link rel="stylesheet" href="${r}recursos/estilos.css">
${jsonld.map((j) => `<script type="application/ld+json">${JSON.stringify(j).replace(/</g, "\\u003c")}</script>`).join("\n")}
${analitica(canal.analitica)}
</head>
<body class="${clase}">
${cabecera(r, canal, lang, activo, otra)}
<main id="contenido">
${cuerpo}
</main>
${pie(r, canal, anio, lang)}
<script src="${r}recursos/app.js" defer></script>
</body>
</html>
`.replace(/\n{2,}/g, "\n");

/** Reproductor de YouTube que no carga nada de YouTube hasta que se pulsa (sin cookies ni rastreo antes del clic). */
export const reproductor = (v, r, { clase = "", prioridad = false, lang = "es", titulo = v.titulo } = {}) => `<div class="reproductor ${clase}" data-id="${h(v.id)}" data-titulo="${h(titulo)}">
<img src="${r}miniaturas/${h(v.id)}.jpg" alt="${h(titulo)}" width="1280" height="720"${prioridad ? ' fetchpriority="high"' : ' loading="lazy" decoding="async"'}>
<button type="button" class="reproducir" aria-label="${h(TEXTOS[lang].reproducir(titulo))}">${ICONO.play}</button>
<p class="aviso-yt">${TEXTOS[lang].avisoYT}</p>
</div>`;

/** Tarjeta de un caso (vídeo largo). v trae, en inglés, tituloCorto/resumen ya traducidos. */
export const tarjetaCaso = (v, r, { lang = "es" } = {}) => {
  const t = TEXTOS[lang];
  return `<article class="tarjeta revelar">
<a href="${r}${RUTAS[lang].caso(v.slug)}" class="tarjeta-enlace">
<div class="tarjeta-imagen"><img src="${r}miniaturas/${h(v.id)}.jpg" alt="" width="1280" height="720" loading="lazy" decoding="async">${v.duracion ? `<span class="duracion">${minutos(v.duracion)}</span>` : ""}</div>
<div class="tarjeta-texto">
<p class="antetitulo"><time datetime="${h(v.publicado)}">${fechaCorta(v.publicado, lang)}</time>${v.lugares?.length ? ` · ${h(v.lugares.slice(0, 3).map((l) => l.texto).join(" · "))}` : ""}</p>
<h3>${h(v.tituloCorto)}</h3>
<p class="resumen">${h(v.resumen)}</p>
<p class="tarjeta-datos">${[plural(v.fuentes.length, t.fuente), plural(v.datosVerificados, t.dato), plural(v.shorts.length, t.short)].filter(Boolean).map((x) => `<span>${x}</span>`).join("")}</p>
</div></a></article>`;
};

/** Tarjeta vertical de un Short (abre YouTube). */
export const tarjetaShort = (s, r) => `<li class="short revelar"><a href="https://www.youtube.com/shorts/${h(s.id)}" rel="noopener" target="_blank">
<img src="${r}miniaturas/${h(s.id)}.jpg" alt="" width="405" height="720" loading="lazy" decoding="async">
<span class="short-titulo">${h(s.titulo)}</span><span class="short-marca">${ICONO.play} Short</span></a></li>`;
