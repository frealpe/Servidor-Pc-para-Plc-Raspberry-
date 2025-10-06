// sockets.js
class Sockets {
  constructor(io) {
    this.io = io;
    this.socketEvents();
  }

  socketEvents() {
    this.io.on('connection', (socket) => {
      console.log('🟢 Cliente conectado:', socket.id);

      // Escuchar mensaje "adcPlc" desde React
      socket.on('adcPlc', (msg) => {
        console.log('📩 Mensaje recibido del cliente (adcPlc):', msg);

        // Aquí puedes reenviar al PLC, MQTT, o a otros clientes
        // Por ejemplo:
        // mqttClient.publish("Plc/ComandoADC", JSON.stringify(msg));

        // O reenviar a todos los clientes conectados:
        this.io.emit('adcPlc', { ...msg});
      });

      // (Opcional) Si el cliente se desconecta
      socket.on('disconnect', () => {
        console.log('🔴 Cliente desconectado:', socket.id);
      });
    });
  }
}

module.exports = Sockets;
