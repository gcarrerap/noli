import test from "node:test";
import assert from "node:assert/strict";
import {generarReceta,configuracion,evaluar,estrellas,TOTAL_MISIONES} from "./logica.js";
test("todas las misiones generan recetas válidas sin repetidos",()=>{
 for(let m=1;m<=TOTAL_MISIONES;m++){const cfg=configuracion(m);for(let n=0;n<20;n++){const r=generarReceta(m);assert.equal(r.length,cfg.longitud);assert.equal(new Set(r).size,r.length);}}
});
test("evaluación exacta y desplazada",()=>{
 assert.deepEqual(evaluar(["a","b","c"],["a","c","d"]),{verdes:1,doradas:1,completa:false});
 assert.deepEqual(evaluar(["a","b","c"],["b","c","a"]),{verdes:0,doradas:3,completa:false});
 assert.deepEqual(evaluar(["a","b"],["a","b"]),{verdes:2,doradas:0,completa:true});
});
test("rechaza ingredientes repetidos",()=>assert.throws(()=>evaluar(["a","b"],["a","a"])));
test("estrellas y ayuda",()=>{assert.equal(estrellas(5,5),3);assert.equal(estrellas(7,5),2);assert.equal(estrellas(12,5),1);assert.equal(estrellas(2,5,true),1);});
