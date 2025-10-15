// controllers/chatgptplc.js
const { gtpServiceUniversal } = require('../services/gtpServices');

const procesarPrompt = async (prompt) => {
  try {
    if (!prompt?.trim()) {
      return { ok: false, msg: "El campo 'prompt' es obligatorio" };
    }

    // 🚀 Llamada al servicio GPT universal
    const respuestaIA = await gtpServiceUniversal(prompt);
    console.log("Respuesta IA cruda:", respuestaIA);

    // 🧠 Estructura base
    const salida = {
      ok: true,
      conversacion: respuestaIA.conversacion || [],
      tipo: respuestaIA.tipo || "Desconocido",
    };

    // ⚙️ Caso 1: SQL detectado
    if (respuestaIA.tipo === "Sql") {
      const resultado =
        Array.isArray(respuestaIA.resultado) && respuestaIA.resultado.length > 0
          ? respuestaIA.resultado
          : respuestaIA.sql
          ? [{ sql: respuestaIA.sql }]
          : [];

      return {
        ...salida,
        tipo: "Sql",
        resultado,
      };
    }

    // ⚙️ Caso 2: Comandos PLC detectados
    if (Array.isArray(respuestaIA.resultado) && respuestaIA.resultado.length > 0) {
      return {
        ...salida,
        tipo: "Plc",
        resultado: respuestaIA.resultado,
      };
    }

    // ⚙️ Caso 3: Desconocido
    return {
      ...salida,
      msg: "No se detectó ni consulta SQL ni comando PLC.",
    };

  } catch (error) {
    console.error("❌ Error en procesarPrompt:", error);
    return {
      ok: false,
      msg: "Error al procesar el prompt con GPT",
      error: error.message,
    };
  }
};

module.exports = { procesarPrompt };
