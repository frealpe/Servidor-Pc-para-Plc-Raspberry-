// controllers/chatgptplc.js
const { gtpServiceUniversal } = require('../services/gtpServices');
const { identificarModeloIA } = require('../services/gtpServicesControl');

/**
 * 🧠 Procesa el prompt general (IA universal)
 */
const procesarPrompt = async (prompt) => {
  try {
    if (!prompt?.trim()) {
      return {
        ok: false,
        tipo: "Error",
        resultado: [],
        msg: "El campo 'prompt' es obligatorio.",
      };
    }

    // 🚀 Llamada al servicio GPT universal
    const respuestaIA = await gtpServiceUniversal(prompt);
    console.log("🧠 Respuesta IA cruda:", respuestaIA);

    const salida = {
      ok: true,
      tipo: respuestaIA.tipo || "Desconocido",
      conversacion: respuestaIA.conversacion || [],
    };

    // ⚙️ Caso 1: Identificación de modelo
    if (respuestaIA.tipo === "Identificacion") {
      console.log("🧩 Caso Identificacion detectado → identificarModeloIA()");
      const resultado =
        Array.isArray(respuestaIA.resultado) && respuestaIA.resultado.length > 0
          ? respuestaIA.resultado
          : respuestaIA.sql
          ? [{ sql: respuestaIA.sql }]
          : [];

      return {
        ...salida,
        tipo: "Identificacion",
        resultado,
        msg: "Consulta SQL generada para identificación de modelo.",
      };
    }

    // ⚙️ Caso 2: SQL detectado
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
        msg: "Consulta SQL detectada correctamente.",
      };
    }

    // ⚙️ Caso 3: Comandos PLC detectados
    if (Array.isArray(respuestaIA.resultado) && respuestaIA.resultado.length > 0) {
      return {
        ...salida,
        tipo: "Plc",
        resultado: respuestaIA.resultado,
        msg: "Comandos PLC detectados correctamente.",
      };
    }

    // ⚙️ Caso 4: Desconocido
    return {
      ...salida,
      tipo: "Desconocido",
      resultado: [],
      msg: "No se detectó ni consulta SQL ni comando PLC.",
    };

  } catch (error) {
    console.error("❌ Error en procesarPrompt:", error);
    return {
      ok: false,
      tipo: "Error",
      resultado: [],
      msg: "Error al procesar el prompt con GPT.",
      error: error.message,
    };
  }
};

/**
 * 🤖 Procesa el prompt para controladores (IA Control)
 */
const procesarPromptControlador = async ({ data, mensaje, conversacion = [] }) => {
  try {
    if (!data || !Array.isArray(data)) {
      return {
        ok: false,
        tipo: "Identificacion",
        resultado: [],
        msg: "El parámetro 'data' debe ser un array válido.",
      };
    }

    if (!mensaje?.trim()) {
      return {
        ok: false,
        tipo: "Identificacion",
        resultado: [],
        msg: "El campo 'mensaje' es obligatorio.",
      };
    }

    console.log("🧩 Datos para IA Control:", conversacion);
    const respuestaIA = await identificarModeloIA({ data, mensaje, conversacion });

    console.log("🧩 Respuesta IA Control cruda:", respuestaIA);

    return {
      ok: respuestaIA.ok,
      tipo: "Identificacion",
      //coeficientes: respuestaIA.coeficientes || {},
      conversacionid: respuestaIA.conversacion || [],
      error: respuestaIA.error || null,
    };

  } catch (error) {
    console.error("❌ Error en procesarPromptControlador:", error);
    return {
      ok: false,
      tipo: "Identificacion",
      coeficientes: {},
      conversacionid,
      error: error.message,
    };
  }
};

module.exports = {
  procesarPrompt,
  procesarPromptControlador,
};
