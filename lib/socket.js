// sockets.js
class Sockets {
  constructor(io) {
    this.io = io;
    this.clientes = new Map(); // Guardar los sockets conectados
    this.socketEvents();
  }

  socketEvents() {
    this.io.on('connection', (socket) => {
      console.log('🟢 Cliente conectado:', socket.id);  
      this.clientes.set(socket.id, socket);

      // Escuchar mensaje "adcPlc" desde React
      socket.on('adcPlc', (msg) => {
        console.log('📩 Mensaje recibido del cliente (adcPlc):', msg);
        this.enviarMensaje('adcPlc', msg); // Reenviar a todos
      });

            // Escuchar mensaje "adcPlc" desde React
      socket.on('resetPlc', (msg) => {
        console.log('📩 Mensaje recibido del cliente (resetPlc):', msg);
        this.enviarMensaje('resetPlc', msg); // Reenviar a todos
      });

      socket.on('disconnect', () => {
        console.log('🔴 Cliente desconectado:', socket.id);
        this.clientes.delete(socket.id);
      });
    });
  }

  /**
   * Enviar mensaje a todos los clientes o a uno específico
   * @param {string} evento Nombre del evento
   * @param {any} data Datos a enviar
   * @param {string|null} socketId ID del socket (opcional)
   */
  enviarMensaje(evento, data, socketId = null) {
    if (socketId) {
      const socket = this.clientes.get(socketId);
      if (socket) socket.emit(evento, data);
    } else if (this.clientes.size > 0) {
      // Enviar a todos los clientes conectados
      for (const socket of this.clientes.values()) {
        socket.emit(evento, data);
      }
    }
  }
}

// Exportar como CommonJS (si tu proyecto usa require)
module.exports = Sockets;

// Si tu proyecto usa ESM (import/export), puedes usar:
// export default Sockets;
