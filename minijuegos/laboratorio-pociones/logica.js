// Lógica pura: ninguna dependencia del DOM ni de Noli.
export const INGREDIENTES = [
  { id:"flor", nombre:"Flor lunar", emoji:"🌸" },
  { id:"cristal", nombre:"Cristal", emoji:"💎" },
  { id:"hongo", nombre:"Hongo", emoji:"🍄" },
  { id:"pluma", nombre:"Pluma", emoji:"🪶" },
  { id:"hoja", nombre:"Hoja", emoji:"🍃" },
  { id:"estrella", nombre:"Estrella", emoji:"⭐" }
];
export const ETAPAS = [
  { nombre:"Aprendiz", opciones:4, longitud:2, meta:5 },
  { nombre:"Exploradora", opciones:4, longitud:3, meta:8 },
  { nombre:"Alquimista", opciones:5, longitud:3, meta:8 },
  { nombre:"Maestra", opciones:6, longitud:4, meta:10 }
];
export const TOTAL_MISIONES = 12;
export function configuracion(mision) {
  if (!Number.isInteger(mision) || mision<1 || mision>TOTAL_MISIONES) throw new RangeError("Misión inválida");
  return ETAPAS[Math.floor((mision-1)/3)];
}
export function generarReceta(mision, aleatorio=Math.random) {
  const {opciones,longitud}=configuracion(mision);
  const bolsa=INGREDIENTES.slice(0,opciones).map(x=>x.id);
  for(let i=bolsa.length-1;i>0;i--){const j=Math.floor(Math.min(Math.max(aleatorio(),0),0.999999999)* (i+1));[bolsa[i],bolsa[j]]=[bolsa[j],bolsa[i]];}
  return bolsa.slice(0,longitud);
}
export function evaluar(receta,intento) {
  if(!Array.isArray(receta)||!Array.isArray(intento)||receta.length!==intento.length||new Set(receta).size!==receta.length||new Set(intento).size!==intento.length) throw new Error("Receta o intento inválido");
  const verdes=intento.filter((id,i)=>id===receta[i]).length;
  const comunes=intento.filter(id=>receta.includes(id)).length;
  return {verdes,doradas:comunes-verdes,completa:verdes===receta.length};
}
export function estrellas(intentos,meta,ayuda=false) {
  return intentos<=meta?3:intentos<=meta+3?2:1;
}
