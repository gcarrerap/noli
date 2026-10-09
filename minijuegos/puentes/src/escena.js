// Escenas en SVG. La comparación usa diferencia.svg y linea-punteada.svg
// igual que «¿Cuántos más?» de Safari: alineado al inicio, línea en el
// extremo corto y la diferencia sombreada. Aquí el largo va en horizontal.

export function svgInline(texto) {
  if (!texto) return "";
  return String(texto)
    .replace(/<\?xml[^>]*>/g, "")
    .replace(/(<(?:tspan|text)\b[^>]*\bclass="unidad"[^>]*>)\s*in(\s*<\/(?:tspan|text)>)/g, "$1 pulg.$2")
    .trim();
}

export function conBrillo(svg, { brillo = false, marca = null } = {}) {
  let s = svgInline(svg);
  if (!s) return "";
  if (brillo) s = s.replace(/class="brillo-cero"/g, 'class="brillo-cero encendido"');
  if (marca != null) {
    const n = String(marca);
    s = s.replace(`class="marca" data-n="${n}"`, `class="marca encendida" data-n="${n}"`);
  }
  return s;
}

// Los dos troncos comparten el borde izquierdo. El porcentaje es el corto
// respecto al largo, así la diferencia ocupa solo lo que sobra.
export function htmlComparar({ corto, largo, svgCorto, svgLargo, svgDif, svgLinea, etCorto = "", etLargo = "", flecha = "" }) {
  const mayor = Math.max(largo, 1);
  const cortoPct = Math.max(0, Math.min(100, (corto / mayor) * 100));
  const difPct = Math.max(0, 100 - cortoPct);
  const eti = (texto) => `<span class="comp-eti">${texto || ""}</span>`;
  const columna = etLargo || etCorto ? `<div class="comp-etis">${eti(etLargo)}${eti(etCorto)}</div>` : "";
  return `<div class="comparar" data-estilo="cuantos-mas">
    <div class="comp-cols">
      ${columna}
      <div class="comp-lienzo">
        <div class="comp-fila"><div class="comp-barra larga" style="width:100%">${svgInline(svgLargo)}</div></div>
        <div class="comp-fila">
          <div class="comp-barra corta" style="width:${cortoPct}%">${svgInline(svgCorto)}</div>
          <div class="comp-dif" style="width:${difPct}%">${svgInline(svgDif)}${flecha}</div>
        </div>
        <div class="comp-punteo" style="left:${cortoPct}%">${svgInline(svgLinea)}</div>
      </div>
    </div>
  </div>`;
}

export function htmlFalta({ puesto, hueco, svgPuesto, svgDif }) {
  const total = Math.max(hueco, 1);
  const a = Math.max(0, Math.min(100, (puesto / total) * 100));
  const b = Math.max(0, 100 - a);
  return `<div class="falta"><div class="falta-puesta" style="width:${a}%">${svgInline(svgPuesto)}</div><div class="falta-dif" style="width:${b}%">${svgInline(svgDif)}</div></div>`;
}

export function htmlBloques(cubos, svgNormal, svgCoral, alto) {
  const span = cubos.length ? Math.max(...cubos.map((c) => c.x)) + 1 : 1;
  const piezas = cubos.map((c) => {
    const izq = (c.x / span) * 100;
    const ancho = (1 / span) * 100;
    return `<span class="cubo${c.coral ? " coral" : ""}" style="left:${izq}%;width:${ancho}%">${svgInline(c.coral ? svgCoral : svgNormal)}</span>`;
  }).join("");
  const altoCss = alto ? `height:${alto}px;` : "";
  return `<div class="bloques" style="${altoCss}--span:${span}">${piezas}</div>`;
}

export function posicionRegla({ anchoVb, cero = 26, gapU, desplaza = 0, unidadU }) {
  const left = Math.max(0, (anchoVb - gapU) / 2);
  const x = left + (desplaza * unidadU) - cero;
  return { left, x, gapU };
}
