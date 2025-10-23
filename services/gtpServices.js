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
    if (!prompt || typeof prompt.text !== "string") {
      return {
        tipo: "Error",
        conversacion: "El campo 'text' debe ser una cadena de texto válida.",
        resultado: [{ topic: "Plc/Error", mensaje: "" }],
      };
    }

    const promptLower = prompt.text.toLowerCase();

    // 🧩 1. Detección de intención
    const esIdentificacion = /\b(identifica|identificación|modelo\s*de\s*la\s*planta|identificar\s*modelo|determina\s*modelo)\b/.test(promptLower);
    const esPetri = /\b(petri|red\s*de\s*petri|transiciones|plaza|token|simulación\s*petri)\b/.test(promptLower);
    const esComparacion = /\b(compara(r)?\s*(el\s*)?modelo|comparación\s*de\s*modelo|comparar\s*modelo)\b/.test(promptLower);



    // ⚡ Si detecta instrucción compuesta
    if (esCicloCompleto) {
      return {
        tipo: "Plc",
        conversacion:
          "Se detectó una instrucción de ciclo completo: caracterización, identificación y control de la planta. Se ejecutará el proceso integral de IA.",
        resultado: [
          {
            topic: "Plc/ControlIA",
            mensaje: prompt.text, // el prompt completo como payload
          },
        ],
      };
    }

    // ⚡ Si detecta algo sobre Petri, devolvemos respuesta directa
    if (esPetri) {
      return {
        tipo: "Plc",
        conversacion: "Se detectó una instrucción relacionada con redes de Petri. Enviando payload al PLC.",
        resultado: [
          {
            topic: "Plc/Petri",
            mensaje: "Ejecución y análisis de red de Petri solicitado.",
            red: prompt.file || null,
          },
        ],
      };
    }

    // ⚡ Si detecta algo sobre comparación de modelos
    if (esComparacion) {
      const regexSecuencia = /(\d+(?:\.\d+)?)%\s*(?:durante|por|,|\s)(\d+(?:\.\d+)?)\s*(?:s|segundos?)/gi;
      const secuencia = [];
      let match;
      while ((match = regexSecuencia.exec(promptLower)) !== null) {
        const porcentaje = parseFloat(match[1]) / 100;
        const duracion = parseFloat(match[2]);
        secuencia.push({ porcentaje, duracion });
      }

      return {
        tipo: "Plc",
        conversacion:
          "Se detectó una solicitud de comparación de modelos. Se ejecutará la planta real con los rangos definidos para comparar con el modelo identificado.",
        resultado: [
          {
            topic: "Plc/Comparacion",
            mensaje: "Solicitud de comparación entre modelo y planta real.",
            secuencia: secuencia.length
              ? secuencia
              : [{ porcentaje: 0.5, duracion: 10 }], // valor por defecto
          },
        ],
      };
    }

    // 🧩 2. Detección SQL vs PLC (si no era Petri o ciclo completo)
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

    // 🧠 3. Prompt del sistema
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
      "Si contiene 'control', 'planta' o 'simulación', usa topic = 'Plc/Control'",
      "Si contiene 'informe' o 'reporte', usa topic = 'Plc/Supervisor'.",
      "Si contiene 'caracterizacion' o 'llevar', usa topic = 'Plc/Caracterizacion'",
      "Si contiene 'identifica' o 'modelo', usa topic = 'Plc/Identificacion'",
      "Si contiene 'compara el modelo', usa topic = 'Plc/Comparacion'",
      "Si no se reconoce el tipo, usa topic = 'Plc/Otros'."
    ]
  }
}
`;

    // 🧩 4. Construir mensajes con historial
    const mensajes = [
      { role: "system", content: systemPrompt },
      ...historialConversacion,
      { role: "user", content: prompt.text },
    ];

    // 🚀 5. Llamada al modelo solo si NO es Petri o ciclo completo
    const completion = await client.chat.completions.create({
      model: "gpt-4.1",
      messages: mensajes,
      temperature: 0.3,
      max_tokens: 200,
    });

    // 🧹 6. Validar salida
    let content = completion.choices[0]?.message?.content?.trim() || "";
    if (content.startsWith("```")) content = content.replace(/```(json)?/g, "").trim();

    let json;
    try {
      json = JSON.parse(content);
    } catch {
      json = esSQL
        ? { conversacion: "No se pudo generar una consulta SQL válida.", resultado: [{ sql: "", prueba: "desconocida" }] }
        : { conversacion: "No se pudo interpretar la instrucción para el PLC.", resultado: [{ topic: "Plc/Otros", mensaje: prompt.text }] };
    }

    // 🔖 7. Respuesta PLC de identificación
    const matchOrden = promptLower.match(/orden\s*(\d+)/);
    const ordenDetectado = matchOrden ? parseInt(matchOrden[1]) : 1;

    const matchId = promptLower.match(/\b(?:id|caracterizacion|caracterización)\s*(\d+)/);
    const idDetectado = matchId ? parseInt(matchId[1]) : null;

    const orden = prompt.orden || ordenDetectado || 1;
    const idCaracterizacion = prompt.idCaracterizacion || idDetectado || null;
    const numeroExplicito = prompt.numeroExplicito || idDetectado || null;
    const indiceCaracterizacion = prompt.indiceCaracterizacion || (idDetectado ? idDetectado : 1);

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
        {
          topic: "Plc/Identificacion",
          mensaje: sqlQuery,
          orden,
          id: idCaracterizacion || numeroExplicito || null,
        },
      ];

      if (idCaracterizacion || numeroExplicito) {
        json.conversacion = `Identificando la planta con la ${idCaracterizacion}ª caracterización registrada (modelo de orden ${orden}). Se procederá con la lectura del registro de id ${idCaracterizacion}.`;
      } else {
        json.conversacion = `Identificando la planta con la ${indiceCaracterizacion}ª caracterización registrada (modelo de orden ${orden}). Se procederá con la lectura del primer registro disponible.`;
      }
    } else {
      json.tipo = esSQL ? "Sql" : "Plc";
    }

    // 🧩 8. Actualizar historial
    historialConversacion.push({ role: "user", content: prompt.text });
    historialConversacion.push({ role: "assistant", content: JSON.stringify(json) });
    if (historialConversacion.length > 10) historialConversacion = historialConversacion.slice(-10);

    return json;
  } catch (error) {
    console.error("❌ Error en gtpServiceUniversal:", error);
    return {
      tipo: "Error",
      conversacion: "Ocurrió un error interno al procesar el prompt. Intenta de nuevo más tarde.",
      resultado: [{ topic: "Plc/Error", mensaje: prompt.text }],
    };
  }
};

module.exports = { gtpServiceUniversal };
