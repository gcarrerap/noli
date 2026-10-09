// Números de Ñoño para la colección de Brumitos. Un solo objeto:
// si cambia un precio o una rareza, la simulación de las pruebas lo nota.
// Las probabilidades se dicen en pantalla como «3 de cada 4», nunca como porcentaje.

export const CONFIG = {
  costoCaja: 5,
  limiteDiario: 2,
  piezas: { comun: 16, rara: 6, ultra: 2 },
  pesos: { comun: 75, rara: 20, ultra: 5 },
  garantiaRara: 8,
  garantiaUltra: 25,
  sinRepetir: 10,
  polvoDuplicado: { comun: 1, rara: 3, ultra: 10 },
  polvoPrecio: { comun: 5, rara: 15, ultra: 40 },
};

export const RAREZAS = ["comun", "rara", "ultra"];
export const LIMITE_MIN = 0;
export const LIMITE_MAX = 4;
export const HISTORIAL_MAX = 60;
