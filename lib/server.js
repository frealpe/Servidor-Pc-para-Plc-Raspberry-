const express = require('express');
const cors = require('cors');
const fileUpload = require('express-fileupload');
const { dbConnection } = require('../database/config');
const { mqttClient } = require('../mqtt/conectMqtt'); 
const OpcServer = require('../services/OpcServer');
const OpcClient = require('../services/OpcClient'); // Cliente OPC mejorado
// const { WebSocketServer } = require('ws'); // 👉 WebSocket

class Server {
    constructor() {
        this.app = express();
        this.port = process.env.PORT || 3000;

        this.paths = {
            auth: '/api/auth',
            usuarios: '/api/usuarios',
            mqttallcomp: '/api/mqttallcomp',
        };

        this.middlewares();
        this.routes();
        this.BrokerMqtt();

        this.initServices(); // Iniciamos servicios asíncronos
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

        // Nodo que quieres leer
        const nodoADC = "ns=1;s=ADC";

        // Callback que se ejecuta cada vez que cambia el valor
        const callback = (valor) => {
            console.log("Valor ADC recibido:", valor);

            // Publicar en MQTT
            mqttClient.publish("Plc/Result", valor.toString(), { qos: 0 }, (err) => {
                if (err) console.error("Error publicando ADC en MQTT:", err);
            });

            // Enviar a todos los clientes WebSocket conectados
            if (this.wss) {
                this.wss.clients.forEach((client) => {
                    if (client.readyState === 1) {
                        client.send(JSON.stringify({ adc: valor }));
                    }
                });
            }
        };

        // Crear suscripción
        await this.opcClient.subscribe(nodoADC, callback, 500); // cada 500ms
    }

    async conectarDB() {
        await dbConnection();
        console.log('Base de datos conectada');
    }

    BrokerMqtt() {
        mqttClient.on('connect', () => {
            console.log('Conectado al broker MQTT desde Server.js');
        });

        mqttClient.on('error', (err) => {
            console.error('Error MQTT:', err);
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

    routes() {
        this.app.use(this.paths.auth, require('../routers/auth'));
        this.app.use(this.paths.usuarios, require('../routers/usuarios'));
        this.app.use(this.paths.mqttallcomp, require('../routers/mqttallcomp'));
    }

    listen() {
        // Levantamos servidor HTTP
        const server = this.app.listen(this.port, () => {
            console.log('Servidor corriendo en puerto', this.port);
        });

        // Levantamos servidor WebSocket sobre el mismo puerto
        // this.wss = new WebSocketServer({ server });
        // console.log('Servidor WebSocket habilitado');

        // this.wss.on('connection', (ws) => {
        //     console.log('🔗 Cliente WebSocket conectado');

        //     ws.on('message', (message) => {
        //         console.log('📩 Mensaje recibido del cliente:', message.toString());
        //         ws.send(`Echo desde servidor: ${message}`);
        //     });

        //     ws.on('close', () => {
        //         console.log('❌ Cliente WebSocket desconectado');
        //     });
        // });
    }
}

module.exports = Server;
