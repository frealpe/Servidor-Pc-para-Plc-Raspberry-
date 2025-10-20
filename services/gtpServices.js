const OpenAI = require("openai");
const { config } = require("dotenv");
config();

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// 🧠 Historial conversacional global (máx. 10 mensajes)
let historialConversacion = [];

/**
 * Servicio universal para interpretar prompts en lenguaje natural
 * y generar comandos SQL o PLC según contexto.
 */
const gtpServiceUniversal = async (prompt) => {
  try {
    if (!prompt || typeof prompt !== "string") {
      return {
        tipo: "Error",
        conversacion: "El campo 'prompt' debe ser una cadena de texto válida.",
        resultado: [{ topic: "Plc/Error", mensaje: "" }],
      };
    }

    const promptLower = prompt.toLowerCase();

    // 🧩 1. Detección de intención
    const esIdentificacion = /\b(identifica|identificación|modelo\s*de\s*la\s*planta|identificar\s*modelo|determina\s*modelo)\b/.test(promptLower);

    const esSQL = (() => {
      if (esIdentificacion) return true;

      const esConsulta = /\b(select|from|where|consulta|consultar|promedio|filtra|voltaje|error|tiempo|jsonb|datalogger|base\s*de\s*datos|conteo|cuenta|cuántas|cuantos|total|registros|prueba|pruebas|última|ultima|reciente|muestra|dame|ver|listar|enséñame|muéstrame)\b/.test(promptLower);
      const esComandoPLC = /\b(control|controla|planta|simulacion|simulación|set\s*point|muestreo|adc|canal|salida|q\d?|ejecuta|realiza|lleva|inicia|empieza|arranca|haz|corre|realizar)\b/.test(promptLower);

      if (promptLower.includes("caracterizacion") || promptLower.includes("caracterización")) {
        if (/\b(dame|muestra|ver|listar|enséñame|última|ultima|reciente)\b/.test(promptLower)) return true;
        if (/\b(ejecuta|realiza|lleva|inicia|empieza|arranca|haz|corre|realizar)\b/.test(promptLower)) return false;
      }

      return esConsulta && !esComandoPLC;
    })();

    // 🧠 2. Prompt del sistema (lo que tú mencionaste)
    const systemPrompt = `
{
  "modo": "inteligente",
  "descripcion": "El asistente actúa como experto dual en SQL para PostgreSQL o traductor técnico PLC, según el contexto del prompt.",
  "reglas_generales": [
    "Devuelve SIEMPRE un JSON válido y limpio, sin texto adicional.",
    "Si el prompt menciona SELECT, tabla, caracterización, datalogger, consulta o SQL, activa el modo SQL.",
    "Si menciona control, simulación, canal, ADC, salida o modelo, activa el modo PLC.",
    "El campo 'conversacion' debe ser claro, técnico y amable."
  ],
  "modo_SQL": {
    "estructura_salida": {
      "conversacion": "<explicación técnica y amable>",
      "resultado": [
        { "sql": "<consulta SQL ejecutable>", "prueba": "<nombre de tabla: caracterizacion o datalogger>" }
      ]
    },
    "reglas": [
      "Tabla 'caracterizacion': id, prueba, resultado (jsonb con 'tiempo', 'voltaje', 'pwm').",
      "Tabla 'datalogger': id, prueba, resultado (jsonb con 'tiempo', 'Voltaje', 'error').",
      "Para conteos: COUNT(prueba).",
      "Para valores JSON: jsonb_array_elements(resultado).",
      "Última medición: SELECT * FROM datalogger ORDER BY prueba DESC LIMIT 1;",
      "Última caracterización: SELECT * FROM caracterizacion ORDER BY prueba DESC LIMIT 1;",
      "Si pide identificar la planta, usa la tabla caracterizacion y toma la última prueba si no especifica id."
    ]
  },
  "modo_PLC": {
    "estructura_salida": {
      "conversacion": "<explicación amable y clara>",
      "resultado": [
        { "topic": "<tema MQTT>", "mensaje": "<instrucción o payload>" }
      ]
    },
    "reglas": [
      "Si contiene 'canal', 'adc' o 'lee', usa topic = 'Plc/Adc'.",
      "Si contiene 'salida' o 'Q', usa topic = 'Plc/Ia'.",
      "Si contiene 'control', 'planta' o 'simulación', usa topic = 'Plc/Control'.",
      "Si contiene 'informe' o 'reporte', usa topic = 'Plc/Supervisor'.",
      "Si contiene 'caracterizacion' o 'llevar', usa topic = 'Plc/Caracterizacion'",
      "Si contiene 'identifica' o 'modelo', usa topic = 'Plc/Identificacion'.",
      "Si no se reconoce el tipo, usa topic = 'Plc/Otros'."
    ]
  }
}
`;

    // 🧩 3. Construir mensajes con historial
    const mensajes = [
      { role: "system", content: systemPrompt },
      ...historialConversacion,
      { role: "user", content: prompt },
    ];

    // 🚀 4. Llamada al modelo
    const completion = await client.chat.completions.create({
      model: "gpt-4.1",
      messages: mensajes,
      temperature: 0.3,
      max_tokens: 500,
    });

    // 🧹 5. Validar salida
    let content = completion.choices[0]?.message?.content?.trim() || "";
    if (content.startsWith("```")) content = content.replace(/```(json)?/g, "").trim();

    let json;
    try {
      json = JSON.parse(content);
    } catch {
      console.warn("⚠️ GPT no devolvió JSON válido. Aplicando estructura fallback.");
      json = esSQL
        ? { conversacion: "No se pudo generar una consulta SQL válida.", resultado: [{ sql: "", prueba: "desconocida" }] }
        : { conversacion: "No se pudo interpretar la instrucción para el PLC.", resultado: [{ topic: "Plc/Otros", mensaje: prompt }] };
    }

    // 🧩 6. Detección de parámetros
    let orden = 1;
    const matchOrden = promptLower.match(/\borden\s*(\d+)/);
    if (matchOrden) orden = Math.max(parseInt(matchOrden[1]) || 1, 1);

    let idCaracterizacion = null;
    const matchId = promptLower.match(/\bid\s*(\d+)\b/);
    if (matchId) idCaracterizacion = parseInt(matchId[1]);

    let numeroExplicito = null;
    const matchNumero = promptLower.match(/\b(número|numero)\s*(\d+)\b/);
    if (matchNumero) numeroExplicito = parseInt(matchNumero[2]);

    let indiceCaracterizacion = 1;
    const matchIndice = promptLower.match(/\b(primer[ao]|segund[ao]|tercer[ao]|cuart[ao]|quint[ao]|sext[ao]|séptim[ao]|octav[ao]|noven[ao]|décim[ao])\b/);
    if (matchIndice) {
      const mapa = { primero:1, segunda:2, tercero:3, cuarta:4, quinta:5, sexta:6, séptima:7, septima:7, octava:8, novena:9, décima:10, decima:10 };
      indiceCaracterizacion = mapa[matchIndice[0]] || 1;
    }

    // 🔖 7. Respuesta PLC de identificación
    if (esIdentificacion) {
      json.tipo = "Plc";
      let sqlQuery;

      if (idCaracterizacion) {
        sqlQuery = `SELECT * FROM caracterizacion WHERE id = ${idCaracterizacion};`;
      } else if (numeroExplicito) {
        sqlQuery = `SELECT * FROM caracterizacion WHERE id = ${numeroExplicito};`;
      } else {
        sqlQuery = `SELECT * FROM caracterizacion ORDER BY id ASC OFFSET ${indiceCaracterizacion - 1} LIMIT 1;`;
      }

      json.resultado = [
        { topic: "Plc/Identificacion", mensaje: sqlQuery, orden, id: idCaracterizacion || numeroExplicito || null }
      ];

      json.conversacion =
        idCaracterizacion || numeroExplicito
          ? `Identificando la planta con la caracterización de id ${idCaracterizacion || numeroExplicito} (modelo de orden ${orden}).`
          : `Identificando la planta con la ${indiceCaracterizacion}ª caracterización registrada (modelo de orden ${orden}).`;
    } else {
      json.tipo = esSQL ? "Sql" : "Plc";
    }

    // 🧩 8. Actualizar historial
    historialConversacion.push({ role: "user", content: prompt });
    historialConversacion.push({ role: "assistant", content: JSON.stringify(json) });
    if (historialConversacion.length > 10) historialConversacion = historialConversacion.slice(-10);

    return json;
  } catch (error) {
    console.error("❌ Error en gtpServiceUniversal:", error);
    return {
      tipo: "Error",
      conversacion: "Ocurrió un error interno al procesar el prompt. Intenta de nuevo más tarde.",
      resultado: [{ topic: "Plc/Error", mensaje: prompt }],
    };
  }
};

module.exports = { gtpServiceUniversal };
