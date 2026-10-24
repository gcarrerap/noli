// Lote: junta muchas piezas que no se mueven (edificios, plataformas, caminos) en UNA malla por material. En las TVs
// pesa más el número de dibujos por cuadro que los triángulos (ver minijuegos/pasarela/docs/RENDIMIENTO.md); así un
// edificio de 30 piezas cuesta 3 o 4 dibujos en lugar de 30.
//
//   const lote = crearLote();
//   lote.poner(new THREE.BoxGeometry(1, 1, 1), "#ff7eb6", { pos: [0, 0.5, 0] });
//   lote.cerrar(grupo);   // agrega las mallas juntas al grupo
import * as THREE from "./vendor/three.module.min.js";
import { mergeGeometries } from "./vendor/BufferGeometryUtils.js";
import { material } from "./materiales.js";

const RAD = Math.PI / 180;

export function crearLote() {
  const porMaterial = new Map(); // clave → { hex, op, geos }
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), v = new THREE.Vector3(), s = new THREE.Vector3();
  return {
    /**
     * Agrega una pieza (la geometría se copia: se puede reusar la misma para varias piezas).
     * @param {THREE.BufferGeometry} geom
     * @param {string} hex color
     * @param {{ pos?: number[], rot?: number[], esc?: number[]|number, op?: object, padre?: THREE.Matrix4 }} [o]
     *   rot en grados (orden XYZ); op: opciones de materiales.js (brillo, emisivo, opacidad, dobleCara, mapa); padre: matriz
     *   del grupo al que pertenece (por ejemplo, un edificio girado). Con op.mapa (una textura que se repite, #176) la
     *   pieza lleva coordenadas de textura proyectadas en metros del mundo: op.uvMundo = repeticiones por metro (0.25 = la
     *   textura cada 4 m). Así todas las rocas de una isla comparten la textura sin costuras raras y se juntan en un lote.
     */
    poner(geom, hex, o = {}) {
      const r = o.rot || [0, 0, 0], es = o.esc == null ? [1, 1, 1] : typeof o.esc === "number" ? [o.esc, o.esc, o.esc] : o.esc;
      m.compose(v.fromArray(o.pos || [0, 0, 0]), q.setFromEuler(e.set(r[0] * RAD, r[1] * RAD, r[2] * RAD)), s.fromArray(es));
      if (o.padre) m.premultiply(o.padre);
      let g = geom.index ? geom.toNonIndexed() : geom.clone();
      for (const k of Object.keys(g.attributes)) if (k !== "position" && k !== "normal") g.deleteAttribute(k);
      g.applyMatrix4(m);
      const op = o.op || {};
      if (op.mapa) uvMundo(g, op.uvMundo || 0.3);
      const clave = [hex, op.brillo ? 1 : 0, op.opacidad || 1, op.dobleCara ? 1 : 0, op.emisivo || 0, op.mapa ? op.mapa.uuid : "", op.tinte ? 1 : 0].join("|");
      let x = porMaterial.get(clave);
      if (!x) porMaterial.set(clave, (x = { hex, op, geos: [] }));
      x.geos.push(g);
    },
    /** Junta todo y lo agrega al grupo. Devuelve las mallas creadas. */
    cerrar(grupo) {
      const mallas = [];
      for (const { hex, op, geos } of porMaterial.values()) {
        const junta = mergeGeometries(geos, false);
        for (const g of geos) g.dispose();
        if (!junta) continue;
        const malla = new THREE.Mesh(junta, material(hex, op));
        malla.matrixAutoUpdate = false;
        grupo.add(malla); mallas.push(malla);
      }
      porMaterial.clear();
      return mallas;
    },
  };
}

/**
 * Coordenadas de textura proyectadas desde el mundo (como una caja): cada triángulo toma el plano al que más mira (piso
 * → x, z; paredes → x, y o z, y). `k` = repeticiones por metro. La geometría ya debe estar en coordenadas del mundo y
 * sin índices (cada 3 vértices, un triángulo).
 */
export function uvMundo(g, k) {
  const p = g.attributes.position.array, uv = new Float32Array((p.length / 3) * 2);
  for (let t = 0; t < p.length; t += 9) {
    const ax = p[t + 3] - p[t], ay = p[t + 4] - p[t + 1], az = p[t + 5] - p[t + 2];
    const bx = p[t + 6] - p[t], by = p[t + 7] - p[t + 1], bz = p[t + 8] - p[t + 2];
    const nx = Math.abs(ay * bz - az * by), ny = Math.abs(az * bx - ax * bz), nz = Math.abs(ax * by - ay * bx);
    for (let v = 0; v < 3; v++) {
      const i = t + v * 3, j = (t / 3 + v) * 2, x = p[i], y = p[i + 1], z = p[i + 2];
      if (ny >= nx && ny >= nz) { uv[j] = x * k; uv[j + 1] = z * k; }
      else if (nx >= nz) { uv[j] = z * k; uv[j + 1] = y * k; }
      else { uv[j] = x * k; uv[j + 1] = y * k; }
    }
  }
  g.setAttribute("uv", new THREE.BufferAttribute(uv, 2));
}
