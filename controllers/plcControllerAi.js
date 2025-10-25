// controllers/chatgptplc.js
const { gtpServiceUniversal } = require('../services/gtpServices');
const { identificarModeloIA } = require('../services/gtpServicesControl');

/**
 * 🧠 Procesa el prompt general (IA universal)
 */
const procesarPrompt = async (prompt) => {
  try {
    // 🔹 Validación del texto
    if (!prompt?.text || typeof prompt.text !== 'string' || !prompt.text.trim()) {
      return {
        tipo: 'Error',
        conversacion: "El campo 'prompt' debe ser una cadena de texto válida.",
        resultado: [{ topic: 'Plc/Error', mensaje: '' }]
      };
    }

    const textoLimpio = prompt.text.trim();
    console.log("🧠 Procesando prompt:", textoLimpio);

    // 🔹 Verificar si llegó un archivo
    if (prompt.file) {
      console.log("📄 Archivo recibido:", prompt.file);
      // Aquí podrías procesar el archivo PNML/XML si aplica.
      // const datosArchivo = procesarArchivoPNML(prompt.file);
    }

    // 🚀 Llamada al servicio GPT
    let respuestaIA = await gtpServiceUniversal({
      text: textoLimpio,
      file: prompt.file || null,
    });

    // 🧹 Limpieza preventiva para evitar estructuras circulares
    if (respuestaIA?.resultado) {
      respuestaIA.resultado = respuestaIA.resultado.map((r) => {
        const { mensaje, ...resto } = r;
        return {
          ...resto,
          mensaje:
            typeof mensaje === 'string'
              ? mensaje
              : (() => {
                  try {
                    return JSON.stringify(mensaje);
                  } catch {
                    return '[Objeto no serializable]';
                  }
                })(),
        };
      });
    }

    // 🧩 Clonado seguro (rompe referencias circulares)
    const respuestaIALimpia = JSON.parse(JSON.stringify(respuestaIA));

    console.log("🧠 Respuesta IA cruda:", respuestaIALimpia);

    const salida = {
      ok: true,
      tipo: respuestaIALimpia.tipo || "Desconocido",
      conversacion: respuestaIALimpia.conversacion || [],
    };

    // ⚙️ Caso 1: SQL detectado
    if (respuestaIALimpia.tipo === "Sql") {
      const resultado =
        Array.isArray(respuestaIALimpia.resultado) && respuestaIALimpia.resultado.length > 0
          ? respuestaIALimpia.resultado
          : respuestaIALimpia.sql
          ? [{ sql: respuestaIALimpia.sql }]
          : [];

      return {
        ...salida,
        tipo: "Sql",
        resultado,
        msg: "Consulta SQL detectada correctamente.",
      };
    }

    // ⚙️ Caso 2: Comandos PLC detectados
    if (Array.isArray(respuestaIALimpia.resultado) && respuestaIALimpia.resultado.length > 0) {
      return {
        ...salida,
        tipo: "Plc",
        resultado: respuestaIALimpia.resultado,
        msg: "Comandos PLC detectados correctamente.",
      };
    }

    // ⚙️ Caso 3: Desconocido
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

module.exports = {
  procesarPrompt,
};
