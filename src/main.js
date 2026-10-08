// Arranque: suscripción al estado, entrada (teclado / control de la TV), puente con los juegos,
// cargar el catálogo y estar al tanto de versiones nuevas.
import { actions, state, subscribe, checkForUpdate, startUpdateChecks, remoto, alRemoto } from "./app/index.js";
import { render } from "./ui/render.js";
import { instalarEntrada, aplicarAccion, moverFoco, conTeclado } from "./ui/entrada.js";
import { instalarPuente } from "./ui/screens/jugando.js";
import { medirColumnas, enfocarTarjeta } from "./ui/screens/catalogo.js";
import { renderUpdateBar } from "./ui/components/update-bar.js";
import { renderCelebrar } from "./ui/components/celebrar.js";
import { renderNube, botonNube } from "./ui/components/nube.js";
import { renderRemoto } from "./ui/components/remoto.js";

let estaba = null; // para regresar el foco a la tarjeta del juego al salir
subscribe((what) => {
  if (what === "remoto") return renderRemoto(); // solo el botón y el recuadro: el catálogo no se redibuja
  renderNube();
  if (what === "nube") { if (!state.jugando) { const b = document.getElementById("nubeBtn"); if (b) b.outerHTML = botonNube(); const n = document.getElementById("nubeBtn"); if (n) n.onclick = actions.abrirNube; } return; }
  if (what === "foco") moverFoco(conTeclado);
  else {
    render();
    if (estaba && !state.jugando && conTeclado) enfocarTarjeta();
    estaba = state.jugando;
  }
  renderUpdateBar(); renderCelebrar(); renderRemoto();
});

instalarEntrada();
instalarPuente();
alRemoto(aplicarAccion); // las acciones del teléfono entran igual que las teclas
window.addEventListener("resize", () => { if (!state.jugando) medirColumnas(); });

render();
actions.iniciar();
remoto.retomar(); // en la TV: si el control remoto estaba prendido antes de recargar, se vuelve a prender

startUpdateChecks();
checkForUpdate();
