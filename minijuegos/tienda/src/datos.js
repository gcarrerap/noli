// Revisa y ordena los JSON de la tienda. No sabe de dólares ni de pesos: solo el formato.
export const MODOS = ["contar", "cambio", "dos", "alcanza"];

export function revisarDatos(d) {
  const errores = [];
  const mal = (m) => errores.push(m);
  if (!d?.config || !Array.isArray(d.config.monedas) || !d.config.monedas.length) mal("config.monedas vacío");
  if (!d?.config?.monedaInicial || !d.config.monedas?.includes(d.config.monedaInicial)) mal("monedaInicial no está en monedas");
  if (!(d.config?.clientesPorDia >= 1)) mal("clientesPorDia");
  if (!Array.isArray(d.config?.mejoras)) mal("faltan mejoras");
  for (const id of d.config?.monedas || []) {
    const m = d.monedas?.[id];
    if (!m) { mal(`falta la moneda ${id}`); continue; }
    revisarMoneda(m, id, mal);
  }
  if (!Array.isArray(d.productos) || d.productos.length < 2) mal("hacen falta productos");
  else if (new Set(d.productos.map((p) => p.id)).size !== d.productos.length) mal("productos con id repetido");
  if (!Array.isArray(d.clientes) || d.clientes.length < 2) mal("hacen falta clientes");
  const orden = d.retos?.orden;
  if (!Array.isArray(orden) || orden.length < 3) mal("retos.orden");
  for (const tipo of orden || []) if (!d.retos[tipo]?.nombre) mal(`reto sin nombre: ${tipo}`);
  if (!d.retos?.plantillas?.contar?.length || !d.retos?.plantillas?.cambio?.length) mal("faltan plantillas");
  return errores;
}

function revisarMoneda(m, id, mal) {
  if (m.id !== id) mal(`${id}: el id del archivo no coincide`);
  if (!m.simbolo || !m.mayor?.uno || !m.mayor?.muchos) mal(`${id}: falta cómo se nombra`);
  if (!Array.isArray(m.piezas) || m.piezas.length < 2) mal(`${id}: faltan piezas`);
  const ids = new Set();
  const valores = new Set();
  for (const p of m.piezas || []) {
    if (!p.id || ids.has(p.id)) mal(`${id}: pieza repetida o sin id`);
    ids.add(p.id);
    if (!Number.isInteger(p.valor) || p.valor <= 0) mal(`${id}: valor inválido en ${p.id}`);
    if (valores.has(p.valor)) mal(`${id}: dos piezas con valor ${p.valor}`);
    valores.add(p.valor);
    if (p.tipo !== "moneda" && p.tipo !== "billete") mal(`${id}: tipo de ${p.id}`);
    if (!p.nombre || !p.etiqueta || !p.color) mal(`${id}: ${p.id} sin nombre, etiqueta o color`);
  }
  if (!m.piezas?.some((p) => p.tipo === "moneda") || !m.piezas?.some((p) => p.tipo === "billete")) mal(`${id}: hacen falta monedas y billetes`);
  if (!m.caja || typeof m.caja !== "object") mal(`${id}: falta la caja`);
  for (const [pid, n] of Object.entries(m.caja || {})) {
    if (!ids.has(pid) || !Number.isInteger(n) || n < 0) mal(`${id}: caja ${pid}`);
  }
  if (!Number.isInteger(m.cambioMax) || m.cambioMax < 1) mal(`${id}: cambioMax`);
  if (!Array.isArray(m.niveles) || m.niveles.length !== 7) mal(`${id}: se esperan 7 niveles`);
  m.niveles?.forEach((n, i) => {
    if (n.n !== i + 1) mal(`${id}: nivel ${n.n} fuera de orden`);
    if (!MODOS.includes(n.modo)) mal(`${id}: modo desconocido en nivel ${n.n}`);
    if (!n.nombre) mal(`${id}: nivel ${n.n} sin nombre`);
    for (const pid of [...(n.piezas || []), ...(n.billetes || [])]) if (!ids.has(pid)) mal(`${id}: nivel ${n.n} usa ${pid}`);
  });
}

export function indexar(d) {
  const monedas = {};
  for (const [id, m] of Object.entries(d.monedas)) {
    monedas[id] = { ...m, porId: Object.fromEntries(m.piezas.map((p) => [p.id, p])) };
  }
  return { ...d, monedas };
}
