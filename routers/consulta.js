const { Router } = require('express');
const { check } = require('express-validator');
const { validarCampos, validarJWT } = require('../middlewares');
const { publicarMensaje, suscribirseTopic, obtenerTopics, leerMensajes,publicarMensajeIA } = require('../controllers/mqttallcomp');
const { consultaIA } = require('../controllers/consulta');

const router = Router();

//////////////////////////////////////////////////
// Publicar un mensaje MQTT
// POST /api/mqtt
//////////////////////////////////////////////////
router.post('/',
    [
        validarCampos
    ],
    consultaIA
);
//////////////////////////////////////////////////

module.exports = router;
