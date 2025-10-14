const { mqttClient, publicarMQTT, mensajesPorTopic } = require('../mqtt/conectMqtt');
const { procesarPrompt } = require('./plcControllerAi');
const { dbConnection } = require("../database/config");
// Publicar un mensaje en un topic
const publicarMensaje = (req, res) => {
    const { topic, mensaje } = req.body;
    // console.log(`Publicando en ${topic}: ${mensaje}`);
    publicarMQTT(topic, mensaje);
    res.json({ msg: `Mensaje publicado en ${topic}` });
};

// Publicar un mensaje en un topic
// Publicar un mensaje en un topic
// controllers/mqttallcomp.js
const publicarMensajeIA = async (req, res) => {
  try {
    const { mensaje } = req.body;

    // ✅ Validación de entrada
    if (!mensaje?.trim()) {
      return res.status(400).json({ error: "El campo 'mensaje' es obligatorio" });
    }

    // 🧠 Procesar prompt con IA
    const { ok, conversacion, tipo, resultado } = await procesarPrompt(mensaje);
    if (!ok) {
      return res.status(400).json({ error: "Error al procesar el prompt con IA" });
    }

    // ======================================================
    // 🧩 CASO SQL → Ejecutar consulta en PostgreSQL
    // ======================================================
    if (tipo === "Sql") {
      const query = resultado?.[0]?.sql;
      if (!query) {
        return res.status(400).json({
          ok: false,
          tipo: "Sql",
          error: "No se encontró una consulta SQL válida.",
        });
      }

      try {
        const pool = await dbConnection();
        const result = await pool.query(query);

        // 🔹 Extraer solo los datos limpios
        const data = result.rows?.length === 1
          ? result.rows[0]
          : result.rows;

        console.log("✅ Consulta SQL ejecutada:", query);
        // console.log("📊 Resultado limpio:", data);

        return res.json({
          ok: true,
          tipo: "Sql",
          conversacion,
          query,
          filas: result.rowCount,
          resultado: data, // 🔹 Solo los datos relevantes
        });
      } catch (sqlErr) {
        console.error("❌ Error ejecutando SQL:", sqlErr);
        return res.status(500).json({
          ok: false,
          tipo: "Sql",
          error: sqlErr.message,
        });
      }
    }

    // ======================================================
    // 🧩 CASO PLC → Publicar mensaje MQTT
    // ======================================================
    if (tipo === "Plc") {
      if (!Array.isArray(resultado) || resultado.length === 0) {
        return res.status(400).json({
          ok: false,
          tipo: "Plc",
          error: "No se encontró contenido válido en resultado para PLC.",
        });
      }

      for (const { topic, mensaje: msgPLC } of resultado) {
        if (!topic || !msgPLC) continue;

        try {
          // Intentar convertir el mensaje a JSON
          let payload;
          try {
            payload = JSON.stringify(JSON.parse(msgPLC));
          } catch {
            payload = msgPLC.toString();
          }

          // Publicar en MQTT
          mqttClient.publish(topic, payload, { qos: 1 }, (err) => {
            if (err) console.error(`❌ Error publicando en ${topic}:`, err.message);
            else console.log(`📡 Publicado en ${topic}:`, payload);
          });
        } catch (pubErr) {
          console.error("❌ Error durante publicación MQTT:", pubErr);
        }
      }

      // ✅ Respuesta limpia
      return res.json({
        ok: true,
        tipo: "Plc",
        conversacion,
        resultado,
      });
    }

    // ======================================================
    // 🧩 CASO DESCONOCIDO
    // ======================================================
    return res.json({
      ok: true,
      tipo: "Desconocido",
      conversacion,
    });

  } catch (error) {
    console.error("❌ Error en publicarMensajeIA:", error);

    if (!res.headersSent) {
      return res.status(500).json({
        ok: false,
        error: "Error interno al publicar mensaje IA",
        detalle: error.message,
      });
    }
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
