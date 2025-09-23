const express = require('express');
const cors = require('cors');
const { dbConnection } = require('../database/config');
const fileUpload = require('express-fileupload');

const { mqttClient } = require('../mqtt/conectMqtt'); 
class Server {
    /////////////////////////////////////////////////
    constructor() {
        this.app = express();
        this.port = process.env.PORT;

        this.paths = {
            auth:           '/api/auth',
            usuarios:       '/api/usuarios',
            mqttallcomp:    '/api/mqttallcomp',

        }
        //Conectar la base de datos
        this.conectarDB();
        //Middlewares
        this.middlewares();
        //Rutas de aplicación
        this.routes();
        //Broker MQTT
        this.BrokerMqtt();
    }
    /////////////////////////////////////////////////
    async conectarDB() {

        await dbConnection();

    }
    /////////////////////////////////////////////////
    BrokerMqtt() {
        // Solo aseguramos que el cliente se conecte al broker
        mqttClient.on('connect', () => {
            console.log('Conectado al broker MQTT desde Server.js');
        });

        mqttClient.on('error', (err) => {
            console.error('Error MQTT:', err);
        });
    }

    /////////////////////////////////////////////////
    middlewares() {
        //CORS
        this.app.use(cors());
        //Parseo del body
        this.app.use(express.json());
        //Directorio publico
        this.app.use(express.static('public'));
        //Carpeta para guardar archivos
        this.app.use(fileUpload({
            useTempFiles : true,
            tempFileDir : '/tmp/',
            createParentPath:true
        }));  

    }
    /////////////////////////////////////////////////
    routes() {
        this.app.use(this.paths.auth, require('../routers/auth'));
        this.app.use(this.paths.usuarios, require('../routers/usuarios'));
        this.app.use(this.paths.mqttallcomp, require('../routers/mqttallcomp'));
    }
    //////////////////////////////////////////////////
    listen() {
        this.app.listen(this.port, () => {
            console.log('Servidor Corriendo', this.port);
        });
    }
}
/////////////////////////////////////////////////
module.exports = Server;