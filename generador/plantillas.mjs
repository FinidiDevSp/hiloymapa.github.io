// Plantillas HTML de la web. Todas las rutas internas son relativas (r = prefijo hasta la raíz): la web funciona igual
// en finididevsp.github.io/hiloymapa.github.io/, en hiloymapa.github.io y en el dominio propio.
import { h, fechaCorta, minutos } from "./util.mjs";

const ICONO = {
  youtube: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M23 7.2a3 3 0 0 0-2.1-2.1C19 4.6 12 4.6 12 4.6s-7 0-8.9.5A3 3 0 0 0 1 7.2 31 31 0 0 0 .5 12a31 31 0 0 0 .5 4.8 3 3 0 0 0 2.1 2.1c1.9.5 8.9.5 8.9.5s7 0 8.9-.5a3 3 0 0 0 2.1-2.1 31 31 0 0 0 .5-4.8 31 31 0 0 0-.5-4.8zM9.7 15.1V8.9l5.8 3.1-5.8 3.1z"/></svg>`,
  play: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5.5v13l11-6.5z"/></svg>`,
  rss: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 3a16 16 0 0 1 16 16h-3A13 13 0 0 0 5 6zm0 6a10 10 0 0 1 10 10h-3a7 7 0 0 0-7-7zm2 6a2 2 0 1 1 0 4 2 2 0 0 1 0-4z"/></svg>`,
  flecha: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M13 5l7 7-7 7-1.4-1.4 4.6-4.6H4v-2h12.2l-4.6-4.6z"/></svg>`,
};
export { ICONO };

/** «1 fuente», «16 fuentes»; vacío si es 0. */
export const plural = (n, uno, varios = uno + "s") => (n ? `${n} ${n === 1 ? uno : varios}` : "");

export const logo = (r) => `<a class="logo" href="${r}./" aria-label="Hilo y Mapa, inicio">
<svg viewBox="0 0 64 40" aria-hidden="true"><path class="logo-hilo" d="M2 32 H22 C27 32 29 30 31 26 L38 12 C40 7 34 3 32 3 C30 3 24 7 26 12 L33 26 C35 30 37 32 42 32 H62"/><circle class="logo-pin" cx="32" cy="4" r="3.6"/></svg>
<span>Hilo <i>y</i> Mapa</span></a>`;

export const cabecera = (r, canal, activo = "") => `<a class="saltar" href="#contenido">Saltar al contenido</a>
<header class="cabecera"><div class="ancho">
${logo(r)}
<nav aria-label="Principal"><ul>
<li><a href="${r}./#casos"${activo === "casos" ? ' aria-current="page"' : ""}>Casos</a></li>
<li><a href="${r}./#shorts">Shorts</a></li>
<li><a href="${r}./#mapa">Mapa</a></li>
<li><a href="${r}sobre/"${activo === "sobre" ? ' aria-current="page"' : ""}>El método</a></li>
</ul></nav>
<a class="boton boton-rojo boton-peque" href="${h(canal.suscribirse)}" rel="noopener" target="_blank">${ICONO.youtube}<span>Suscribirse</span></a>
</div></header>`;

export const pie = (r, canal, anio) => `<footer class="pie"><div class="ancho">
<div class="pie-marca">${logo(r)}<p>${h(canal.lema)}.</p></div>
<nav aria-label="Pie"><ul>
<li><a href="${h(canal.youtube)}" rel="noopener" target="_blank">Canal de YouTube</a></li>
<li><a href="${r}sobre/">El método</a></li>
<li><a href="${r}sobre/#preguntas">Preguntas</a></li>
<li><a href="${r}sobre/#privacidad">Privacidad</a></li>
<li><a href="${r}feed.xml">${ICONO.rss} RSS</a></li>
</ul></nav>
<p class="pie-legal">© ${anio} Hilo y Mapa · Web oficial del canal. Las imágenes de archivo pertenecen a sus autores y se usan según las licencias indicadas en cada caso. Mapas: datos de Natural Earth y de los colaboradores de OpenStreetMap (ODbL).</p>
</div></footer>`;

/** Página completa. og: { imagen (absoluta), tipo }. jsonld: lista de objetos schema.org. */
export const pagina = ({ titulo, descripcion, canonical, r, base, og = {}, jsonld = [], cuerpo, canal, anio, activo, clase = "", precarga = [] }) => `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${h(titulo)}</title>
<meta name="description" content="${h(descripcion)}">
<link rel="canonical" href="${h(canonical)}">
<meta name="robots" content="index, follow, max-image-preview:large, max-video-preview:-1, max-snippet:-1">
<meta name="theme-color" content="#0A1118">
<meta name="color-scheme" content="dark">
<meta property="og:site_name" content="Hilo y Mapa">
<meta property="og:locale" content="es_ES">
<meta property="og:type" content="${og.tipo ?? "website"}">
<meta property="og:title" content="${h(og.titulo ?? titulo)}">
<meta property="og:description" content="${h(descripcion)}">
<meta property="og:url" content="${h(canonical)}">
<meta property="og:image" content="${h(og.imagen ?? base + "recursos/marca/redes.jpg")}">
<meta property="og:image:width" content="${og.ancho ?? 1200}">
<meta property="og:image:height" content="${og.alto ?? 630}">
<meta property="og:image:alt" content="${h(og.alt ?? "Hilo y Mapa: historias reales, sobre el mapa")}">
${og.video ? `<meta property="og:video" content="${h(og.video)}">\n<meta property="og:video:type" content="text/html">` : ""}
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${h(og.titulo ?? titulo)}">
<meta name="twitter:description" content="${h(descripcion)}">
<meta name="twitter:image" content="${h(og.imagen ?? base + "recursos/marca/redes.jpg")}">
<link rel="icon" href="${r}recursos/marca/avatar-32.png" sizes="32x32">
<link rel="icon" href="${r}recursos/marca/avatar-192.png" sizes="192x192">
<link rel="apple-touch-icon" href="${r}recursos/marca/avatar-192.png">
<link rel="manifest" href="${r}manifest.webmanifest">
<link rel="alternate" type="application/atom+xml" title="Hilo y Mapa: casos" href="${r}feed.xml">
<link rel="preload" href="${r}recursos/fuentes/bebas-neue.woff2" as="font" type="font/woff2" crossorigin>
<link rel="preload" href="${r}recursos/fuentes/source-serif-4.woff2" as="font" type="font/woff2" crossorigin>
${precarga.map((p) => `<link rel="preload" href="${h(p)}" as="image" fetchpriority="high">`).join("\n")}
<script>document.documentElement.classList.add("js")</script>
<link rel="stylesheet" href="${r}recursos/estilos.css">
${jsonld.map((j) => `<script type="application/ld+json">${JSON.stringify(j).replace(/</g, "\\u003c")}</script>`).join("\n")}
</head>
<body class="${clase}">
${cabecera(r, canal, activo)}
<main id="contenido">
${cuerpo}
</main>
${pie(r, canal, anio)}
<script src="${r}recursos/app.js" defer></script>
</body>
</html>
`;

/** Reproductor de YouTube que no carga nada de YouTube hasta que se pulsa (sin cookies ni rastreo antes del clic). */
export const reproductor = (v, r, { clase = "", prioridad = false } = {}) => `<div class="reproductor ${clase}" data-id="${h(v.id)}" data-titulo="${h(v.titulo)}">
<img src="${r}miniaturas/${h(v.id)}.jpg" alt="${h(v.titulo)}" width="1280" height="720"${prioridad ? ' fetchpriority="high"' : ' loading="lazy" decoding="async"'}>
<button type="button" class="reproducir" aria-label="Reproducir «${h(v.titulo)}»">${ICONO.play}</button>
<p class="aviso-yt">Al reproducir se carga YouTube (sin cookies hasta entonces).</p>
</div>`;

/** Tarjeta de un caso (vídeo largo). */
export const tarjetaCaso = (v, r, { destacado = false } = {}) => `<article class="tarjeta${destacado ? " destacada" : ""} revelar">
<a href="${r}casos/${h(v.slug)}/" class="tarjeta-enlace">
<div class="tarjeta-imagen"><img src="${r}miniaturas/${h(v.id)}.jpg" alt="" width="1280" height="720" loading="lazy" decoding="async">${v.duracion ? `<span class="duracion">${minutos(v.duracion)}</span>` : ""}</div>
<div class="tarjeta-texto">
<p class="antetitulo"><time datetime="${h(v.publicado)}">${fechaCorta(v.publicado)}</time>${v.lugares?.length ? ` · ${h(v.lugares.slice(0, 3).map((l) => l.texto).join(" · "))}` : ""}</p>
<h3>${h(v.tituloCorto)}</h3>
<p class="resumen">${h(v.resumen)}</p>
<p class="tarjeta-datos">${[plural(v.fuentes.length, "fuente"), plural(v.datosVerificados, "dato verificado", "datos verificados"), plural(v.shorts.length, "Short")].filter(Boolean).map((t) => `<span>${t}</span>`).join("")}</p>
</div></a></article>`;

/** Tarjeta vertical de un Short (abre YouTube). */
export const tarjetaShort = (s, r) => `<li class="short revelar"><a href="https://www.youtube.com/shorts/${h(s.id)}" rel="noopener" target="_blank">
<img src="${r}miniaturas/${h(s.id)}.jpg" alt="" width="405" height="720" loading="lazy" decoding="async">
<span class="short-titulo">${h(s.titulo)}</span><span class="short-marca">${ICONO.play} Short</span></a></li>`;
