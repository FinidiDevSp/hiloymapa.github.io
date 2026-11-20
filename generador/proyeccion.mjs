// Proyección Equal Earth (Šavrič, Patterson y Jenny, 2018) para el mapa de la web oficial.
// Sin dependencias: la misma copia vive en el repositorio de la web (generador/proyeccion.mjs) para colocar los
// lugares sobre recursos/mundo.svg. Si cambia aquí, cambia allí (lo copia «recursos.mjs»).
const A1 = 1.340264, A2 = -0.081106, A3 = 0.000893, A4 = 0.003796, M = Math.sqrt(3) / 2;
export const ESCALA = 180, ANCHO = 1000, ALTO = 500, CX = ANCHO / 2, CY = 268;

/** [x, y] en el lienzo de 1000 × 500 del mapa (y hacia abajo). */
export const proyectar = (lon, lat) => {
  const l = (lon * Math.PI) / 180, p = (lat * Math.PI) / 180;
  const t = Math.asin(M * Math.sin(p)), t2 = t * t, t6 = t2 * t2 * t2;
  const x = (2 * Math.sqrt(3) * l * Math.cos(t)) / (3 * (9 * A4 * t6 * t2 + 7 * A3 * t6 + 3 * A2 * t2 + A1));
  const y = t * (A1 + A2 * t2 + t6 * (A3 + A4 * t2));
  return [+(CX + x * ESCALA).toFixed(2), +(CY - y * ESCALA).toFixed(2)];
};
