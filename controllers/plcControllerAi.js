// controllers/chatgptplc.js
const { gtpServices } = require('../services/gtpServices');

// ⚡ Procesa el prompt y enruta al PLC según el topic
const procesarPrompt = async (prompt) => {
  try {
    if (!prompt) {
      return { ok: false, msg: "El campo 'prompt' es obligatorio" };
    }

    console.log("📥 Prompt recibido:", prompt);

    // GPT devuelve un string con formato JSON
    const comandoStr = await gtpServices(prompt);

    let comandos;
    try {
      comandos = JSON.parse(comandoStr); // ✅ Intentar parsear
    } catch (err) {
      console.error("❌ Error al parsear JSON:", err.message);
      return { ok: false, msg: "❌ Error al parsear JSON de GPT", raw: comandoStr };
    }

    // Asegurar que sea un array
    if (!Array.isArray(comandos)) {
      comandos = [comandos];
    }

    return { ok: true, comandos };
  } catch (error) {
    console.error("Error en procesarPrompt:", error.message);
    return { ok: false, msg: "Error al procesar la consulta con GPT", error: error.message };
  }
};



module.exports = { procesarPrompt };
