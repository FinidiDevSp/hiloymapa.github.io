// Utilidades sin dependencias del generador de la web.

/** «Al Capone: los tres papeles…» → «al-capone-los-tres-papeles…» (máx. ~60 caracteres, corta en palabra). */
export const slug = (t) => {
  const s = t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().split("|")[0]
    .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  if (s.length <= 60) return s;
  return s.slice(0, 61).replace(/-[^-]*$/, "");
};

/** Escapa texto para HTML (contenido y atributos). */
export const h = (s) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");

const MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
const ZONA = "Europe/Madrid";
const partes = (iso) => Object.fromEntries(new Intl.DateTimeFormat("en-CA", { timeZone: ZONA, year: "numeric", month: "numeric", day: "numeric" }).formatToParts(new Date(iso)).map((p) => [p.type, p.value]));
/** «20 de noviembre de 2026» */
export const fechaLarga = (iso) => { const p = partes(iso); return `${p.day} de ${MESES[p.month - 1]} de ${p.year}`; };
/** «20 NOV 2026» */
export const fechaCorta = (iso) => { const p = partes(iso); return `${p.day} ${MESES[p.month - 1].slice(0, 3).toUpperCase()} ${p.year}`; };

/** 675 → «11:15»; 3725 → «1:02:05» */
export const reloj = (s) => {
  s = Math.round(s); const hh = Math.floor(s / 3600), mm = Math.floor(s / 60) % 60, ss = s % 60;
  return hh ? `${hh}:${String(mm).padStart(2, "0")}:${String(ss).padStart(2, "0")}` : `${mm}:${String(ss).padStart(2, "0")}`;
};
/** 675 → «PT11M15S» (ISO 8601, para schema.org y el sitemap de vídeo) */
export const iso8601 = (s) => { s = Math.round(s); const hh = Math.floor(s / 3600), mm = Math.floor(s / 60) % 60, ss = s % 60; return `PT${hh ? hh + "H" : ""}${mm ? mm + "M" : ""}${ss || (!hh && !mm) ? ss + "S" : ""}`; };
/** «11 min» */
export const minutos = (s) => `${Math.max(1, Math.round(s / 60))} min`;

/** «4:34» o «1:02:05» → segundos */
const aSegundos = (t) => t.split(":").map(Number).reduce((a, v) => a * 60 + v, 0);

/**
 * La descripción la escribe el estudio siempre igual (motor/publicacion): resumen, llamada «▸», CAPÍTULOS, FUENTES,
 * IMÁGENES, aviso y etiquetas. En los Shorts, la llamada lleva el enlace youtu.be del vídeo largo.
 */
export const leerDescripcion = (d = "") => {
  const lineas = d.replace(/\r/g, "").split("\n");
  const out = { resumen: "", capitulos: [], fuentes: [], imagenes: [], etiquetas: [], padre: null, aviso: "" };
  let seccion = "resumen";
  const resumen = [];
  for (const l of lineas) {
    const t = l.trim();
    if (/^CAP[IÍ]TULOS$/i.test(t)) { seccion = "capitulos"; continue; }
    if (/^FUENTES$/i.test(t)) { seccion = "fuentes"; continue; }
    if (/^IM[AÁ]GENES$/i.test(t)) { seccion = "imagenes"; continue; }
    const yb = t.match(/^https:\/\/youtu\.be\/([A-Za-z0-9_-]{11})/);
    if (yb) { out.padre = yb[1]; continue; }
    if (/^[▸▶►]/.test(t)) { seccion = seccion === "resumen" ? "llamada" : seccion; continue; }
    if (/^#\S/.test(t)) { out.etiquetas = t.split(/\s+/).filter((x) => x.startsWith("#")); continue; }
    if (!t) { if (seccion === "imagenes" || seccion === "fuentes" || seccion === "capitulos") seccion = "fin"; continue; }
    if (seccion === "resumen") resumen.push(t);
    else if (seccion === "capitulos") { const m = t.match(/^((?:\d+:)?\d{1,2}:\d{2})\s+(.+)$/); if (m) out.capitulos.push({ t: aSegundos(m[1]), marca: m[1], titulo: m[2] }); }
    else if (seccion === "fuentes") { const m = t.match(/https?:\/\/\S+/); if (m) out.fuentes.push(m[0]); }
    else if (seccion === "imagenes") out.imagenes.push(t.replace(/^[·•]\s*/, ""));
    else if (seccion === "fin" && /RECREACI[OÓ]N|fuentes p[uú]blicas/i.test(t)) out.aviso = t;
  }
  out.resumen = resumen.join(" ");
  return out;
};

/** «https://www.theguardian.com/…» → «theguardian.com» */
export const dominio = (u) => { try { return new URL(u).hostname.replace(/^www\./, ""); } catch { return u; } };
