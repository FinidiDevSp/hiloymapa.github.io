// Mapas en SVG sobre recursos/mundo.svg (Equal Earth, 1000 × 500): encuadre, hilo y chinchetas.
import { proyectar, ANCHO, ALTO } from "./proyeccion.mjs";
import { h } from "./util.mjs";

/** Encuadre [x, y, w, h] que contiene los puntos con margen, con la proporción pedida y un ancho mínimo. */
export const encuadre = (pts, { aspecto = 16 / 9, margen = 0.25, minAncho = 110 } = {}) => {
  if (!pts.length) return [0, 0, ANCHO, ALTO];
  const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]);
  let [x0, x1, y0, y1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
  let w = Math.max(minAncho, (x1 - x0) * (1 + 2 * margen)), hh = Math.max(w / aspecto, (y1 - y0) * (1 + 2 * margen));
  w = Math.max(w, hh * aspecto); hh = w / aspecto;
  if (w > ANCHO) { w = ANCHO; hh = w / aspecto; }
  const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
  const x = Math.min(Math.max(cx - w / 2, 0), ANCHO - w), y = Math.min(Math.max(cy - hh / 2, -40), ALTO - hh + 40);
  return [x, y, w, hh].map((v) => +v.toFixed(2));
};

/** Hilo que cuelga entre chinchetas: un arco con caída entre cada par de puntos (como el hilo del banner). */
export const hilo = (pts, { caida = 0.16, entrada = null, salida = null } = {}) => {
  const p = [...(entrada ? [entrada] : []), ...pts, ...(salida ? [salida] : [])];
  if (p.length < 2) return "";
  let d = `M${p[0][0].toFixed(1)} ${p[0][1].toFixed(1)}`;
  for (let i = 1; i < p.length; i++) {
    const [ax, ay] = p[i - 1], [bx, by] = p[i], dist = Math.hypot(bx - ax, by - ay);
    d += ` Q${((ax + bx) / 2).toFixed(1)} ${((ay + by) / 2 + dist * caida).toFixed(1)} ${bx.toFixed(1)} ${by.toFixed(1)}`;
  }
  return d;
};

/** El nudo del logo (el hilo sube, da la vuelta en la chincheta y cruza): trozo de trayecto centrado en (x, y). */
export const nudo = (x, y, s) => {
  const p = (dx, dy) => `${(x + dx * s).toFixed(1)} ${(y + dy * s).toFixed(1)}`;
  return ` L${p(-10, 0)} C${p(-5, 0)} ${p(-3, -2)} ${p(-1, -6)} L${p(6, -20)} C${p(8, -25)} ${p(2, -29)} ${p(0, -29)} C${p(-2, -29)} ${p(-8, -25)} ${p(-6, -20)} L${p(1, -6)} C${p(3, -2)} ${p(5, 0)} ${p(10, 0)}`;
};

/** Hilo de oeste a este por los puntos, con el nudo del logo en el hueco más ancho (el Atlántico, como en el banner). */
export const hiloConNudo = (pts, s, { entrada, salida, caida = 0.12 } = {}) => {
  // Una ola de oeste a este: un punto entra en el hilo si no obliga a subir o bajar más de lo que avanza.
  const p = [];
  for (const q of [...pts].sort((a, b) => a[0] - b[0])) { const u = p.at(-1); if (!u || Math.abs(q[1] - u[1]) <= Math.max(q[0] - u[0], 0) * 0.9) p.push(q); }
  let gap = 0, k = 0;
  for (let i = 1; i < p.length; i++) if (p[i][0] - p[i - 1][0] > gap) { gap = p[i][0] - p[i - 1][0]; k = i; }
  const mx = (p[k - 1][0] + p[k][0]) / 2, my = (p[k - 1][1] + p[k][1]) / 2 + s * 4;
  const tramo = (q) => q.slice(1).map((b, i) => { const a = q[i], d = Math.hypot(b[0] - a[0], b[1] - a[1]); return ` Q${((a[0] + b[0]) / 2).toFixed(1)} ${((a[1] + b[1]) / 2 + d * caida).toFixed(1)} ${b[0].toFixed(1)} ${b[1].toFixed(1)}`; }).join("");
  const oeste = [entrada, ...p.slice(0, k)], este = [[mx + 10 * s, my], ...p.slice(k), salida];
  const antes = [...oeste, [mx - 10 * s, my]];
  return { d: `M${antes[0][0].toFixed(1)} ${antes[0][1].toFixed(1)}${tramo(antes)}${nudo(mx, my, s).replace(/^ L[^C]+/, "")}${tramo(este)}`, pin: [mx, my - 29 * s] };
};

/**
 * SVG de un mapa con lugares. lugares: [{ texto, lon, lat, url? }] en orden de recorrido.
 * r: prefijo relativo hasta la raíz de la web. clase: para el CSS. etiquetas: todas, o solo las que no se pisan.
 */
export const mapa = (lugares, { r = "", clase = "mapa", aspecto = 16 / 9, margen = 0.3, minAncho = 110, animado = true, hiloDe = null, titulo = "Mapa", vista = null, conNudo = false, escalaTexto = 1, px = 1000, desplazar = 0 } = {}) => {
  const pts = lugares.map((l) => ({ ...l, p: proyectar(l.lon, l.lat) }));
  let [x, y, w, hh] = vista ? encuadre(vista.map(([lon, lat]) => proyectar(lon, lat)), { aspecto, margen: 0, minAncho }) : encuadre(pts.map((q) => q.p), { aspecto, margen, minAncho });
  x = +(x - w * desplazar).toFixed(2); // desplazar > 0: los lugares quedan a la derecha (el titular va a la izquierda)
  const k = w / px; // unidades del encuadre por píxel de pantalla (px = ancho con el que se suele ver el mapa)
  const fuente = 12 * k * escalaTexto, radio = 5 * k;
  // Etiquetas sin solaparse: por orden, se salta la que pisaría a otra ya puesta.
  const cajas = [];
  const etiquetas = pts.map((q, i) => {
    const t = q.texto.toUpperCase(), anchoT = t.length * fuente * 0.62 + fuente, alto = fuente * 1.3;
    const caja = [q.p[0] - anchoT / 2, q.p[1] - radio * 2.6 - alto, anchoT, alto];
    const pisa = cajas.some(([a, b, c, d]) => caja[0] < a + c && caja[0] + caja[2] > a && caja[1] < b + d && caja[1] + caja[3] > b);
    if (pisa) return "";
    cajas.push(caja);
    return `<text x="${q.p[0].toFixed(2)}" y="${(q.p[1] - radio * 2.6).toFixed(2)}" font-size="${fuente.toFixed(3)}" stroke-width="${(fuente * 0.28).toFixed(3)}" style="--i:${i}">${h(t)}</text>`;
  });
  const recorrido = hiloDe ?? pts.map((q) => q.p);
  let d, pinNudo = null;
  if (conNudo && recorrido.length > 1) {
    const sorted = [...recorrido].sort((a, b) => a[0] - b[0]);
    const n = hiloConNudo(recorrido, 2.4 * k, { entrada: [x - w * 0.05, sorted[0][1] + hh * 0.12], salida: [x + w * 1.05, sorted.at(-1)[1] + hh * 0.1] });
    d = n.d; pinNudo = n.pin;
  } else d = hilo(recorrido, { entrada: hiloDe ? null : [x - w * 0.1, (recorrido[0]?.[1] ?? y + hh / 2) + hh * 0.08], salida: hiloDe ? null : [x + w * 1.1, (recorrido.at(-1)?.[1] ?? y + hh / 2) + hh * 0.1] });
  const pines = pts.map((q, i) => {
    const pin = `<circle cx="${q.p[0].toFixed(1)}" cy="${q.p[1].toFixed(1)}" r="${radio.toFixed(2)}" style="--i:${i}"/>`;
    return q.url ? `<a href="${h(q.url)}" aria-label="${h(q.texto)}">${pin}</a>` : pin;
  });
  if (pinNudo) pines.push(`<circle class="pin-nudo" cx="${pinNudo[0].toFixed(1)}" cy="${pinNudo[1].toFixed(1)}" r="${(radio * 1.5).toFixed(2)}" style="--i:${pts.length}"/>`);
  return `<svg class="${clase}${animado ? " animado" : ""}" viewBox="${x} ${y} ${w} ${hh}" preserveAspectRatio="xMidYMid slice" role="img" aria-label="${h(titulo)}">
<use href="${r}recursos/mundo.svg#tierra" x="0" y="0" width="${ANCHO}" height="${ALTO}" class="tierra"/>
${d ? `<path class="hilo-sombra" d="${d}" pathLength="1"/><path class="hilo" d="${d}" pathLength="1"/>` : ""}
<g class="pines">${pines.join("")}</g>
<g class="etiquetas">${etiquetas.join("")}</g>
</svg>`;
};
