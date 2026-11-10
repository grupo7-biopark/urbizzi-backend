import clipping from 'polygon-clipping';
import {
  InvalidInputError,
  BusinessRuleError,
} from '../../../../shared/domain/errors/domain.error.js';

/** Pares [latitude, longitude], sem repetir o primeiro vértice no final. */
export type Vertices = [number, number][];
export const MAX_VERTICES_GEOGRAFICOS = 500;
const EPS = 1e-14;
const cross = (a: number[], b: number[], c: number[]) =>
  (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
function onSegment(a: number[], b: number[], p: number[]) {
  return (
    Math.abs(cross(a, b, p)) < EPS &&
    p[0] >= Math.min(a[0], b[0]) &&
    p[0] <= Math.max(a[0], b[0]) &&
    p[1] >= Math.min(a[1], b[1]) &&
    p[1] <= Math.max(a[1], b[1])
  );
}
function intersects(a: number[], b: number[], c: number[], d: number[]) {
  return (
    (cross(a, b, c) * cross(a, b, d) < 0 &&
      cross(c, d, a) * cross(c, d, b) < 0) ||
    onSegment(a, b, c) ||
    onSegment(a, b, d) ||
    onSegment(c, d, a) ||
    onSegment(c, d, b)
  );
}
function ringArea(r: number[][]) {
  // Translação evita cancelamento numérico em lotes pequenos longe da origem.
  const o = r[0];
  return (
    Math.abs(r.reduce((s, a, i) => s + cross(o, a, r[(i + 1) % r.length]), 0)) /
    2
  );
}
function area(polygons: clipping.MultiPolygon) {
  return polygons.reduce(
    (s, p) =>
      s + ringArea(p[0]) - p.slice(1).reduce((v, r) => v + ringArea(r), 0),
    0,
  );
}
export function validarVertices(input: unknown): Vertices {
  const fail = () => {
    throw new InvalidInputError(
      'AREA_GEOGRAFICA_INVALIDA',
      `Informe de 3 a ${MAX_VERTICES_GEOGRAFICOS} vértices distintos de latitude e longitude, formando uma área sem cruzamentos.`,
    );
  };
  if (
    !Array.isArray(input) ||
    input.length < 3 ||
    input.length > MAX_VERTICES_GEOGRAFICOS
  )
    return fail();
  for (const p of input) {
    if (
      !Array.isArray(p) ||
      p.length !== 2 ||
      !p.every((v) => typeof v === 'number' && Number.isFinite(v)) ||
      Math.abs(p[0]) > 85 ||
      Math.abs(p[1]) > 180
    )
      return fail();
  }
  const v = input as Vertices;
  if (
    new Set(v.map((p) => p.join(','))).size !== v.length ||
    ringArea(v) <= EPS
  )
    return fail();
  // Este editor cadastral não admite áreas cruzando o antimeridiano.
  if (Math.max(...v.map((p) => p[1])) - Math.min(...v.map((p) => p[1])) > 180)
    return fail();
  for (let i = 0; i < v.length; i++)
    for (let j = i + 1; j < v.length; j++) {
      if (j === i + 1 || (i === 0 && j === v.length - 1)) continue;
      if (intersects(v[i], v[(i + 1) % v.length], v[j], v[(j + 1) % v.length]))
        return fail();
    }
  // Rejeita também a dobra sobre a aresta adjacente.
  for (let i = 0; i < v.length; i++) {
    const a = v[i],
      b = v[(i + 1) % v.length],
      c = v[(i + 2) % v.length];
    if (onSegment(a, b, c) || onSegment(b, c, a)) return fail();
  }
  return v.map((p) => [...p]);
}
export function exigirDentro(
  vertices: Vertices,
  limite: Vertices,
  code = 'LOTE_FORA_DO_LOTEAMENTO',
  message = 'A demarcação deve ficar totalmente dentro do loteamento.',
) {
  if (area(clipping.difference([vertices], [limite])) > EPS)
    throw new BusinessRuleError(code, message);
}
export function exigirSemSobreposicao(
  vertices: Vertices,
  outros: Vertices[],
  code = 'LOTES_SOBREPOSTOS',
  message = 'A demarcação ocupa a área de outro lote. Divisas compartilhadas são permitidas.',
) {
  if (outros.some((v) => area(clipping.intersection([vertices], [v])) > EPS))
    throw new BusinessRuleError(code, message);
}
