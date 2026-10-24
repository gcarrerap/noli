import {Noli} from "../../kit/noli.js";
import {INGREDIENTES,configuracion,generarReceta,evaluar,estrellas,TOTAL_MISIONES} from "./logica.js";
const raiz=document.querySelector("#juego");
const criaturas=[
  {emoji:"🐉",nombre:"Chispita",problema:"¡Mi fuego se convirtió en burbujas!"},
  {emoji:"🦄",nombre:"Nube",problema:"¡Mis estrellas perdieron su brillo!"},
  {emoji:"🧚",nombre:"Lumi",problema:"¡Necesito iluminar el bosque!"},
  {emoji:"🐈",nombre:"Michi",problema:"¡Mi varita solo hace cosquillas!"}
];
let mision=1,receta=[],seleccion=[],historial=[],ayuda=false,completada=false,mejor={},pantalla="inicio",foco=0;
const escapar=s=>String(s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const ing=id=>INGREDIENTES.find(x=>x.id===id);
function botones(){return [...raiz.querySelectorAll("button:not(:disabled)")];}
function enfocar(delta){const bs=botones();if(!bs.length)return;const activo=bs.indexOf(document.activeElement);foco=((activo>=0?activo:foco)+delta+bs.length)%bs.length;bs[foco].focus();}
function mostrar(html){
 const anterior=document.activeElement;
 const accion=anterior?.dataset?.action, id=anterior?.dataset?.id, indice=anterior?.dataset?.index;
 const teniaFoco=raiz.contains(anterior);
 const indiceAnterior=teniaFoco?botones().indexOf(anterior):-1;
 raiz.innerHTML=html;
 const bs=botones();
 let siguiente=bs.find(b=>b.dataset.action===accion && (id===undefined||b.dataset.id===id) && (indice===undefined||b.dataset.index===indice));
 if(!siguiente&&teniaFoco&&bs.length)siguiente=bs[Math.min(Math.max(indiceAnterior,0),bs.length-1)];
 foco=siguiente?bs.indexOf(siguiente):0;
 if(siguiente)siguiente.focus({preventScroll:true});
}
function siguientePendiente(){return Array.from({length:TOTAL_MISIONES},(_,i)=>i+1).find(i=>!mejor[i])??null;}\nfunction inicio(){
 pantalla="inicio";
 mostrar(`<section class="panel"><div class="cauldron">🧙‍♀️🧪</div><h1>Laboratorio de Pociones</h1><p class="story">¡Bienvenida, alquimista! Descubre las recetas secretas. Cada experimento te dirá cuántos ingredientes están en el lugar correcto y cuántos están en otro lugar.</p><p class="progress">Misiones completadas: ${Object.keys(mejor).length} de ${TOTAL_MISIONES}</p><div class="actions"><button class="primary" data-action="seguir">${siguientePendiente()===null?"Elegir misión":"Jugar"}</button><button class="secondary" data-action="salir">Salir</button></div></section>`);
}
function elegirMision(){
 pantalla="elegir";
 mostrar(`<section class="panel"><h1>Elige una misión</h1><p class="story">¡Ya completaste las doce! Puedes repetir cualquiera y mejorar tus estrellas.</p><div class="ingredients">${Array.from({length:TOTAL_MISIONES},(_,i)=>`<button class="ingredient" data-action="elegida" data-index="${i+1}">🧪 <strong>Misión ${i+1}</strong><small>${"⭐".repeat(mejor[i+1]||0)}</small></button>`).join("")}</div><div class="actions"><button class="secondary" data-action="menu">Volver</button></div></section>`);
}
function empezar(n){
 mision=n;receta=generarReceta(n);seleccion=[];historial=[];ayuda=false;completada=false;pantalla="juego";dibujar();
}
function dibujar(){
 const cfg=configuracion(mision),criatura=criaturas[Math.floor((mision-1)/3)], disponibles=INGREDIENTES.slice(0,cfg.opciones);
 const casillas=Array.from({length:cfg.longitud},(_,i)=>`<button class="slot" data-action="quitar" data-index="${i}" aria-label="Posición ${i+1}: ${seleccion[i]?ing(seleccion[i]).nombre:"vacía"}">${seleccion[i]?ing(seleccion[i]).emoji:"❔"}</button>`).join("");
 const ingredientes=disponibles.map(x=>`<button class="ingredient" data-action="poner" data-id="${x.id}" ${seleccion.includes(x.id)||completada||seleccion.length===cfg.longitud?"disabled":""}><span class="emoji">${x.emoji}</span><small>${x.nombre}</small></button>`).join("");
 const intentos=historial.map((h,i)=>`<div class="attempt"><span>${i+1}. <span class="symbols">${h.intento.map(id=>ing(id).emoji).join(" ")}</span></span><span><b class="good">🟢 ${h.verdes}</b> &nbsp; <b class="gold">🟡 ${h.doradas}</b></span></div>`).reverse().join("");
 const mensaje=completada?`<p class="hint">🎉 ¡Receta descubierta! ${historial.length} experimentos. ${"⭐".repeat(estrellas(historial.length,cfg.meta,ayuda))}</p>`:historial.length?`<p class="muted">🟢 Correcto y en su lugar · 🟡 Correcto, en otro lugar</p>`:"";
 mostrar(`<section class="panel"><div class="head"><span class="progress">Misión ${mision}/${TOTAL_MISIONES} · ${cfg.nombre}</span><button class="secondary" data-action="menu">Menú</button></div><h1>${criatura.emoji} ${criatura.nombre}</h1><p class="story">«${criatura.problema}» Descubre la receta secreta de ${cfg.longitud} ingredientes.</p><div class="cauldron">🧪✨</div><div class="slots">${casillas}</div><div class="ingredients">${ingredientes}</div><div class="actions"><button class="primary" data-action="probar" ${seleccion.length!==cfg.longitud||completada?"disabled":""}>¡Mezclar!</button><button class="secondary" data-action="borrar" ${!seleccion.length||completada?"disabled":""}>Borrar último</button><button class="secondary" data-action="pista" ${completada?"disabled":""}>💡 Pista gratis</button></div>${ayuda?`<p class="hint">💡 ${pista()}</p>`:""}${mensaje}<h2>Libro de experimentos</h2><div class="history">${intentos||'<p class="muted">Tus pruebas aparecerán aquí.</p>'}</div>${completada?`<div class="actions"><button class="primary" data-action="siguiente">${mision===TOTAL_MISIONES?"Volver al inicio":"Siguiente misión"}</button><button class="secondary" data-action="repetir">Otra receta</button></div>`:""}</section>`);
}
function pista(){
 if(!historial.length)return "Prueba una combinación y observa las chispas. ¡Cada resultado es una pista!";
 const ultima=historial[historial.length-1];
 if(ultima.verdes===0&&ultima.doradas===0)return "Ninguno de los ingredientes de tu último intento está en la receta.";
 if(ultima.doradas>0)return "Al menos un ingrediente de tu última prueba debe cambiar de posición.";
 return "Compara los intentos: las chispas verdes indican posiciones correctas.";
}
function probar(){
 const cfg=configuracion(mision);if(completada||seleccion.length!==cfg.longitud)return;
 const intento=[...seleccion],resultado=evaluar(receta,intento);
 historial.push({intento,...resultado});seleccion=[];completada=resultado.completa;
 if(completada){
  const puntos=estrellas(historial.length,cfg.meta,ayuda);
  mejor[mision]=Math.max(mejor[mision]||0,puntos);
  Noli.guardar({version:1,mejor});
  Noli.terminar({estrellas:puntos});
 }
 dibujar();
}
function ejecutar(accion,el){
 if(accion==="seguir"){const pendiente=siguientePendiente();if(pendiente===null)elegirMision();else empezar(pendiente);}\n if(accion==="elegida")empezar(Number(el.dataset.index));
 if(accion==="salir")Noli.salir();
 if(accion==="menu")inicio();
 if(accion==="poner"&&seleccion.length<configuracion(mision).longitud&&!seleccion.includes(el.dataset.id)){seleccion.push(el.dataset.id);dibujar();}
 if(accion==="quitar"&&!completada){seleccion.splice(Number(el.dataset.index),1);dibujar();}
 if(accion==="borrar"&&!completada){seleccion.pop();dibujar();}
 if(accion==="pista"&&!completada){ayuda=true;dibujar();}
 if(accion==="probar")probar();
 if(accion==="siguiente"){if(mision===TOTAL_MISIONES)elegirMision();else empezar(mision+1);}
 if(accion==="repetir")empezar(mision);
}
raiz.addEventListener("click",e=>{const el=e.target.closest("button[data-action]");if(el&&!el.disabled)ejecutar(el.dataset.action,el);});
Noli.alEntrar(accion=>{
 if(accion==="atras"){if(pantalla!=="inicio"){inicio();return true;}return false;}
 if(accion==="izquierda"||accion==="arriba"){enfocar(-1);return true;}
 if(accion==="derecha"||accion==="abajo"){enfocar(1);return true;}
 if(accion==="ok"){const bs=botones();const activo=raiz.contains(document.activeElement)?document.activeElement:null;const b=activo&&!activo.disabled?activo:bs[foco];if(b)b.click();return true;}
 return false;
});
const datos=await Noli.datos;mejor=datos&&datos.version===1&&datos.mejor&&typeof datos.mejor==="object"?datos.mejor:{};inicio();
