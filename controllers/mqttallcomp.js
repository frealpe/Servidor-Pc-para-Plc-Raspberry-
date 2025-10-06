const { mqttClient, publicarMQTT, mensajesPorTopic } = require('../mqtt/conectMqtt');
const { procesarPrompt } = require('./plcControllerAi');

// Publicar un mensaje en un topic
const publicarMensaje = (req, res) => {
    const { topic, mensaje } = req.body;
    console.log(`Publicando en ${topic}: ${mensaje}`);
    publicarMQTT(topic, mensaje);
    res.json({ msg: `Mensaje publicado en ${topic}` });
};

// Publicar un mensaje en un topic
// Publicar un mensaje en un topic
const publicarMensajeIA = async (req, res) => {
  //console.log(req);
  try {
    const { mensaje } = req.body;

    const { comandos, ok } = await procesarPrompt(mensaje); 

    console.log("Resultado de procesarPrompt:", comandos);

    if (ok && comandos?.length) {
      for (const cmd of comandos) {
        console.log(`📤 Publicando en ${cmd.topic}: ${cmd.mensaje}`);
        publicarMQTT(cmd.topic, cmd.mensaje);
        console.log(`✅ Publicado en ${cmd.topic}: ${cmd.mensaje}`);
      }
      res.json({ msg: "✅ Mensajes publicados correctamente", comandos });
    } else {
      console.log("⚠️ No se generaron comandos válidos");
      res.status(400).json({ msg: "⚠️ No se generaron comandos válidos", comandos });
    }
  } catch (error) {
    console.error("❌ Error en publicarMensajeIA:", error); 
    res.status(500).json({ error: "Error al publicar mensaje IA" });
  }
};



// Suscribirse a un nuevo topic dinámicamente
const suscribirseTopic = (req, res) => {
    const { topic } = req.body;
    mqttClient.subscribe(topic, { qos: 1 }, (err) => {
        if (err) return res.status(500).json({ msg: `Error suscribiéndose a ${topic}`, err });
        // Inicializar buffer si no existe
        if (!mensajesPorTopic[topic]) mensajesPorTopic[topic] = [];
        res.json({ msg: `Suscrito a ${topic}` });
    });
};

// Obtener lista de topics y últimos mensajes
const obtenerTopics = (req, res) => {
    if (!mqttClient) return res.status(500).json({ msg: 'Cliente MQTT no inicializado' });
    res.json({ 
        clientId: mqttClient.options.clientId, 
        topics: Object.keys(mensajesPorTopic),
        ultimosMensajes: mensajesPorTopic
    });
};

// Leer los últimos mensajes de un topic específico
const leerMensajes = (req, res) => {
    const { topic } = req.params;
    if (!topic) return res.status(400).json({ msg: 'Debes enviar un topic' });

    const mensajes = mensajesPorTopic[topic] || [];
    if (mensajes.length === 0) return res.status(404).json({ msg: 'No hay mensajes para este topic o no existe' });

    res.json({ topic, mensajes });
};

module.exports = {
    publicarMensaje,
    publicarMensajeIA,
    suscribirseTopic,
    obtenerTopics,
    leerMensajes
};
