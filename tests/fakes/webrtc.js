// WebRTC de mentira para las pruebas del control remoto: conexiones que "se conectan" en el mismo proceso cuando
// la oferta y la respuesta llegan a su lugar, con un RTCDataChannel que entrega los mensajes al otro lado.
// red.bloqueada = true imita una red donde WebRTC nunca conecta (CGNAT): todo pasa pero el canal no abre.

export function fakeWebRTC() {
  const registro = new Map();
  const red = { bloqueada: false, conexiones: [] };
  let n = 0;

  class FakeDC {
    constructor(label) { this.label = label; this.readyState = "connecting"; this.peer = null; this.enviados = []; }
    send(data) {
      if (this.readyState !== "open") throw new Error("InvalidStateError");
      this.enviados.push(data);
      const p = this.peer;
      queueMicrotask(() => { if (p && p.readyState === "open" && p.onmessage) p.onmessage({ data }); });
    }
    _abrir() { if (this.readyState === "connecting") { this.readyState = "open"; if (this.onopen) this.onopen(); } }
    close() {
      if (this.readyState === "closed") return;
      this.readyState = "closed";
      if (this.onclose) this.onclose();
      if (this.peer) this.peer.close();
    }
  }

  class FakePC {
    constructor(cfg) {
      this.cfg = cfg; this.id = "pc" + ++n; registro.set(this.id, this); red.conexiones.push(this);
      this.signalingState = "stable"; this.connectionState = "new";
      this.localDescription = null; this.remoteDescription = null;
      this.candidatos = []; this.canales = []; this.cerrada = false;
    }
    createDataChannel(label) { const dc = new FakeDC(label); this.canales.push(dc); return dc; }
    async createOffer() { return { type: "offer", sdp: this.id }; }
    async createAnswer() { if (this.signalingState !== "have-remote-offer") throw new Error("sin oferta"); return { type: "answer", sdp: this.id }; }
    async setLocalDescription(d) {
      this.localDescription = d;
      this.signalingState = d.type === "offer" ? "have-local-offer" : "stable";
      queueMicrotask(() => { if (!this.cerrada && this.onicecandidate) this.onicecandidate({ candidate: { toJSON: () => ({ candidate: "c-" + this.id }) } }); });
    }
    async setRemoteDescription(d) {
      this.remoteDescription = d;
      this.otro = d.sdp;
      this.signalingState = d.type === "offer" ? "have-remote-offer" : "stable";
      if (d.type === "answer") queueMicrotask(() => this._conectar());
    }
    async addIceCandidate(c) { this.candidatos.push(c); }
    _estado(s) { if (this.connectionState !== s) { this.connectionState = s; if (this.onconnectionstatechange) this.onconnectionstatechange(); } }
    // Quien ofreció recibió la respuesta: si la red lo permite, se abren los canales de los dos lados
    _conectar() {
      const otro = registro.get(this.otro);
      if (red.bloqueada || !otro || otro.cerrada || this.cerrada) return;
      this._estado("connected"); otro._estado("connected");
      for (const dc of this.canales) {
        const remoto = new FakeDC(dc.label);
        dc.peer = remoto; remoto.peer = dc;
        otro.canales.push(remoto);
        if (otro.ondatachannel) otro.ondatachannel({ channel: remoto });
        queueMicrotask(() => { remoto._abrir(); dc._abrir(); });
      }
    }
    close() {
      if (this.cerrada) return;
      this.cerrada = true; this.connectionState = "closed"; this.signalingState = "closed";
      for (const dc of this.canales) dc.close();
    }
  }

  return { RTCPeerConnection: FakePC, red, registro };
}
