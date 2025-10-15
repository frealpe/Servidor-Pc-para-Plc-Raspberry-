const { dbConnection } = require("../database/config");
const { gtpServiceUniversal } = require("../services/gtpServices");

const consultaIA = async (req, res) => {
  try {
    const { prompt } = req.body;

    // 1️⃣ Generar la consulta SQL con GPT
    const comandos = await gtpServiceUniversal(prompt);
    console.log("🧠 Consulta SQL generada por IA:", comandos);
    const pool = dbConnection();
    const result = await pool.query(comandos);

    // 2️⃣ Retornar solo "rows"
    res.json(result.rows);

  } catch (error) {
    console.error("❌ Error en consultaIA:", error);
    res.status(500).json({ error: "Error al ejecutar la consulta SQL" });
  }
};

module.exports = {
  consultaIA
};
