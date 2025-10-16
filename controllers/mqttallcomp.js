const { mqttClient, publicarMQTT, mensajesPorTopic } = require('../mqtt/conectMqtt');
const { procesarPrompt, procesarPromptControlador } = require('./plcControllerAi');
const { dbConnection } = require("../database/config");
const Sockets = require("../lib/socket");

// Publicar un mensaje en un topic
const publicarMensaje = (req, res) => {
    const { topic, mensaje } = req.body;
    // console.log(`Publicando en ${topic}: ${mensaje}`);
    publicarMQTT(topic, mensaje);
    res.json({ msg: `Mensaje publicado en ${topic}` });
};


const publicarMensajeIA = async (req, res) => {
  try {
    const { mensaje } = req.body;
    const pool = await dbConnection();
    // ✅ Validación
    if (!mensaje?.trim()) {
      return res.status(400).json({ error: "El campo 'mensaje' es obligatorio" });
    }

    // 🧠 Procesamiento con IA
    const { ok, conversacion, tipo, resultado } = await procesarPrompt(mensaje);
    if (!ok) {
      return res.status(400).json({ error: "Error al procesar el prompt con IA" });
    }

    console.log("Define el Tipo ", tipo);
    console.log("Resultado IA:", resultado);

// ======================================================
// 🧩 CASO IDENTIFICACION
// ======================================================
   if (tipo === "Identificacion") {
      try {
        if (!Array.isArray(resultado) || resultado.length === 0 || !resultado[0]?.sql) {
          return res.status(400).json({
            ok: false,
            tipo: "Identificacion",
            error: "No se encontró una consulta SQL válida en la respuesta de la IA.",
          });
        }

        const query = resultado[0].sql;
        console.log("🧩 Ejecutando consulta de identificación:", query);

        const resQuery = await pool.query(query);

        if (resQuery.rowCount === 0) {
          return res.status(404).json({
            ok: false,
            tipo: "Identificacion",
            error: "No se encontró ningún registro para el criterio solicitado.",
          });
        }

        const registro = resQuery.rows[0];
        console.log("📄 Registro encontrado:", registro);

        const data = registro.resultado;
        if (!Array.isArray(data)) {
          return res.status(400).json({
            ok: false,
            tipo: "Identificacion",
            error: "El campo 'resultado' no contiene un array válido.",
          });
        }

        console.log("📦 Datos enviados a IA Control:", data);

        // 🤖 Procesar el mensaje con la IA para identificación del modelo
        const {ok,tipo,conversacionid} = await procesarPromptControlador({
          data,
          mensaje: "Identifica el modelo de la planta con estos datos.",
          conversacion,
        });

        if (!ok) {
          return res.status(500).json({
            ok: false,
            tipo: tipo,
            error: resultadoControl.error || "Error al procesar la identificación del modelo.",
          });
        }
// 🟢 Ejecutar el modelo IA generado
          try {
            const { modeloIdentificado } = await import('../services/modelo.js');
            const salida = modeloIdentificado();
            const sockets = req.app.locals.sockets;
            salida.slice(0,100).forEach((valor, k) => {
              console.log(`🔵 Enviando valor ${k}:`, valor);
              sockets.enviarMensaje('adcPlc', {
                canal: 0,
                conversion: valor,
                tiempo: k
              });
            });

            console.log("📈 Salida del modelo IA:", salida.slice(0, 1000), "...");
          } catch (err) {
            console.error("❌ Error al ejecutar modelo.js:", err);
          }


        console.log("✅ Identificación completada.");

        return res.json({
          ok: true,
          tipo: "Identificacion",        
          conversacion: conversacionid,
        });

      } catch (error) {
        console.error("❌ Error durante la identificación:", error);
        return res.status(500).json({
          ok: false,
          tipo: "Identificacion",
          conversacion, // ✅ corregido: antes era 'conversacionc'
          error: error.message || "Error interno al procesar la identificación.",
        });
      }
    }

// ======================================================
// 🧩 CASO SQL (una o varias consultas)
// ======================================================
if (tipo === "Sql") {
  if (!Array.isArray(resultado) || resultado.length === 0) {
    return res.status(400).json({
      ok: false,
      tipo: "Sql",
      error: "No se encontró una consulta SQL válida.",
    });
  }

  try {


    // Ejecutar todas las consultas en paralelo
    const resultadosSQL = await Promise.all(
      resultado.map(async (item) => {
        const query = item.sql;
        const nombre = item.prueba || "consulta";
        if (!query) return { nombre, error: "Consulta SQL vacía" };

        try {
          const resQuery = await pool.query(query);
          console.log(`✅ Ejecutado ${nombre}:`, query);
          return {
            nombre,
            query,
            filas: resQuery.rowCount,
            datos: resQuery.rows || [],
          };
        } catch (err) {
          console.error(`❌ Error ejecutando ${nombre}:`, err.message);
          return {
            nombre,
            query,
            error: err.message,
            datos: [],
          };
        }
      })
    );

    // Respuesta final con todos los resultados
    return res.json({
      ok: true,
      tipo: "Sql",
      conversacion,
      resultado: {
        totalConsultas: resultadosSQL.length,
        resultados: resultadosSQL,
      },
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
    // 🧩 CASO PLC
    // ======================================================
    if (tipo === "Plc") {
      if (!Array.isArray(resultado) || resultado.length === 0) {
        return res.status(400).json({
          ok: false,
          tipo: "Plc",
          error: "No se encontró contenido válido en resultado para PLC.",
        });
      }

      const datosNormalizados = resultado.map(({ topic, mensaje: msgPLC }) => {
        let payload;
        try {
          payload = JSON.parse(msgPLC);
        } catch {
          payload = msgPLC;
        }

        // Publicación MQTT
        if (topic && msgPLC) {
          mqttClient.publish(topic, JSON.stringify(payload), { qos: 1 }, (err) => {
            if (err) console.error(`❌ Error publicando en ${topic}:`, err.message);
            else console.log(`📡 Publicado en ${topic}:`, payload);
          });
        }

        return { topic, mensaje: payload };
      });

      return res.json({
        ok: true,
        tipo: "Plc",
        conversacion,
        resultado: {
          datos: datosNormalizados,
          resumen: {
            total: datosNormalizados.length,
          },
        },
      });
    }

    // ======================================================
    // 🧩 CASO DESCONOCIDO
    // ======================================================
    return res.json({
      ok: true,
      tipo: "Desconocido",
      conversacion,
      resultado: {
        datos: [],
        resumen: { nota: "Tipo de mensaje no reconocido" },
      },
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
