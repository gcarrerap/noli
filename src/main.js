// Arranque: suscripción al estado, entrada (teclado / control de la TV), puente con los juegos,
// cargar el catálogo y estar al tanto de versiones nuevas.
import { actions, state, subscribe, checkForUpdate, startUpdateChecks } from "./app/index.js";
import { render } from "./ui/render.js";
import { instalarEntrada, moverFoco, conTeclado } from "./ui/entrada.js";
import { instalarPuente } from "./ui/screens/jugando.js";
import { medirColumnas, enfocarTarjeta } from "./ui/screens/catalogo.js";
import { renderUpdateBar } from "./ui/components/update-bar.js";
import { renderCelebrar } from "./ui/components/celebrar.js";
import { renderNube, botonNube } from "./ui/components/nube.js";

let estaba = null; // para regresar el foco a la tarjeta del juego al salir
subscribe((what) => {
  renderNube();
  if (what === "nube") { if (!state.jugando) { const b = document.getElementById("nubeBtn"); if (b) b.outerHTML = botonNube(); const n = document.getElementById("nubeBtn"); if (n) n.onclick = actions.abrirNube; } return; }
  if (what === "foco") moverFoco(conTeclado);
  else {
    render();
    if (estaba && !state.jugando && conTeclado) enfocarTarjeta();
    estaba = state.jugando;
  }
  renderUpdateBar(); renderCelebrar();
});

instalarEntrada();
instalarPuente();
window.addEventListener("resize", () => { if (!state.jugando) medirColumnas(); });

render();
actions.iniciar();

startUpdateChecks();
checkForUpdate();
