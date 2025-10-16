const express = require('express');
const cors = require('cors');
const fileUpload = require('express-fileupload');
const http = require('http');
const { dbConnection } = require('../database/config');
const { mqttClient } = require('../mqtt/conectMqtt'); 
const OpcServer = require('../services/OpcServer');
const OpcClient = require('../services/OpcClient'); // Cliente OPC mejorado
const { Server: SocketIOServer } = require('socket.io');
const Sockets = require('./socket');

class Server {
    constructor() {
        this.app = express();
        this.port = process.env.PORT || 3000;

        this.paths = {
            consulta: '/api/consulta',
            mqttallcomp: '/api/mqttallcomp',
        };

        this.middlewares();
        this.routes();
        this.initServices();        
        this.BrokerMqtt();

        // Crear servidor HTTP y Socket.IO
        this.server = http.createServer(this.app);
        this.io = new SocketIOServer(this.server, {
            cors: { origin: '*' }
        });

        this.configurarSockets();
    }

    async initServices() { 
        // Iniciar servidor OPC UA
        this.opcServer = new OpcServer();
        await this.opcServer.start();
        const endpointUrl = this.opcServer.server.endpoints[0].endpointDescriptions()[0].endpointUrl;
        console.log("Servidor OPC UA corriendo en:", endpointUrl);

        // Iniciar cliente OPC UA
        this.opcClient = new OpcClient();
        await this.opcClient.connect(endpointUrl);

        // Iniciar lectura continua
        this.startOpcReading();
    } 

    async startOpcReading() {
        if (!this.opcClient) return;

        const nodoADC = "ns=1;s=ADC";

        const callback = (valor) => {
          //  console.log("Valor ADC recibido:", valor);

            // Publicar en MQTT (opcional)
            // mqttClient.publish("Plc/Resultado", valor.toString(), { qos: 0 });

            // Enviar a todos los clientes WebSocket conectados
            // if (this.io) {
            //     this.io.emit('adc', valor);
            // }
        };

        await this.opcClient.subscribe(nodoADC, callback, 500);
    }

    async conectarDB() {
        await dbConnection();
        console.log('Base de datos conectada');
    }

BrokerMqtt() {
  mqttClient.on('message', (topic, message) => {
    try {
      // Convertir el buffer recibido a string
      const msgString = message.toString();

      // Inicializar msgJSON como null
      let msgJSON = null;
 
      // Intentar parsear el mensaje como JSON
      try {
        msgJSON = JSON.parse(msgString);
      } catch (err) {
        console.warn('⚠️ Mensaje no es JSON válido, se enviará como texto.');
        msgJSON = { raw: msgString };
      }

      // Manejo específico para el topic Plc/Respuesta
      if (topic === 'Plc/Respuesta') {
        // console.log('📩 Recibido Plc/Respuesta:', msgJSON);

        // Reenviar a todos los clientes WebSocket (como JSON)
        if (this.io) {
          this.io.emit('respuestaPlc', msgJSON);
        }
      }

    } catch (error) {
      console.error('❌ Error al procesar mensaje MQTT:', error);
    }
  });
}


    middlewares() {
        this.app.use(cors());
        this.app.use(express.json());
        this.app.use(express.static('public'));
        this.app.use(fileUpload({
            useTempFiles: true,
            tempFileDir: '/tmp/',
            createParentPath: true
        }));
    }

        configurarSockets() {
        this.sockets = new Sockets(this.io);
        this.app.locals.sockets = this.sockets;
        }
    routes() {
        this.app.use(this.paths.consulta, require('../routers/consulta'));
        this.app.use(this.paths.mqttallcomp, require('../routers/mqttallcomp'));
    }

    listen() {
        this.server.listen(this.port, () => {
            console.log('Servidor corriendo en puerto', this.port);
        });
    }
}

module.exports = Server;
