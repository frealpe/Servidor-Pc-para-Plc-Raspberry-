const { Router } = require('express');
const { check } = require('express-validator');
const { validarCampos, validarJWT } = require('../middlewares');
const { publicarMensaje, suscribirseTopic, obtenerTopics, leerMensajes } = require('../controllers/mqttallcomp');

const router = Router();

//////////////////////////////////////////////////
// Publicar un mensaje MQTT
// POST /api/mqtt
router.post('/',
    [
        //validarJWT,  // Descomenta si quieres validar token
        check('topic', 'El topic es obligatorio').not().isEmpty(),
        check('mensaje', 'El mensaje es obligatorio').not().isEmpty(),
        validarCampos
    ],
    publicarMensaje
);

//////////////////////////////////////////////////
// Suscribirse a un topic dinámicamente
// POST /api/mqtt/subscribe
router.post('/subscribe',
    [
        //validarJWT,
        check('topic', 'El topic es obligatorio').not().isEmpty(),
        validarCampos
    ],
    suscribirseTopic
);

//////////////////////////////////////////////////
// Obtener topics a los que está suscrito
// GET /api/mqtt/topics
router.get('/topics',
    //validarJWT,
    obtenerTopics
);

//////////////////////////////////////////////////
// Leer el último mensaje de un topic específico
// GET /api/mqtt/leer/:topic
router.get('/leer/:topic',
    //validarJWT,
    leerMensajes
);

module.exports = router;
