// services/gtpServiceUniversal.js
const OpenAI = require("openai");
const { config } = require("dotenv");
config();

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// 🔹 Historial de conversación (en memoria)
let historialConversacion = [];

const gtpServiceUniversal = async (prompt) => {
  try {
    // ✅ Detectar si es SQL o comando PLC
    const esSQL =
      /\b(select|from|where|consulta|consultar|promedio|filtra|voltaje|error|tiempo|jsonb|datalogger|base\s*de\s*datos|conteo|cuenta|cuántas|cuantos|total|registros|prueba|pruebas|última|ultima|reciente)\b/i.test(
        prompt
      ) &&
      !/\b(control|controla|planta|simulacion|simulación|set\s*point|muestreo|adc|canal|salida|q\d?)\b/i.test(
        prompt
      );

    const systemPrompt = esSQL
      ? `
Eres un asistente experto en SQL para PostgreSQL. Genera consultas limpias y ejecutables sobre la tabla 'datalogger'.

La tabla 'datalogger' tiene los campos:
- id (serial)
- prueba (timestamp) → almacena la fecha y hora de cada prueba.
- resultado (jsonb) → contiene un array de objetos con las claves "tiempo", "Voltaje" y "error".

Reglas:
1. Devuelve solo un JSON con los campos:
   {
     "conversacion": "<explicación amable y detallada>",
     "sql": "<consulta SQL limpia y ejecutable>"
   }
2. Si el usuario pide conteos, usa COUNT(prueba).
3. Si pide valores del campo resultado, usa jsonb_array_elements(resultado).
4. Si pide la última medición o el registro más reciente, usa:
   SELECT * FROM datalogger ORDER BY prueba DESC LIMIT 1;
5. No agregues texto fuera del JSON.
6. Si el usuario hace una nueva pregunta relacionada, usa el contexto de la conversación previa.
`
      : `
Eres un asistente técnico que traduce instrucciones humanas a comandos estructurados para un sistema PLC usando formato JSON.

Tu salida debe tener esta estructura:
{
  "conversacion": "<explicación amable y clara>",
  "resultado": [
    { "topic": "<tema MQTT>", "mensaje": "<instrucción>" }
  ]
}

Reglas:
- Explica siempre la acción en lenguaje natural.
- Si contiene "canal", "adc" o "lee", usa "Plc/Adc".
- Si contiene "salida" o "Q", usa "Plc/Ia".
- Si contiene "control", "planta" o "simulación", usa "Plc/Control".
- Si contiene "informe" o "reporte", usa "Plc/Supervisor".
- Si contiene "caracterizacion", usa "Plc/Caracterizacion" y genera un solo mensaje JSON que describa toda la secuencia de pasos (por ejemplo, porcentajes y duraciones).
- No dividas la instrucción en varios mensajes. Debe ser un bloque único que resuma toda la caracterización.
- Si no se reconoce, usa "Plc/Otros".

`;

    // 🧠 Crear contexto conversacional
    const mensajes = [
      { role: "system", content: systemPrompt },
      ...historialConversacion,
      { role: "user", content: prompt },
    ];

    const completion = await client.chat.completions.create({
      model: "gpt-4.1",
      messages: mensajes,
      temperature: 0.3,
    });

    let content = completion.choices[0]?.message?.content?.trim() || "";
    if (content.startsWith("```")) content = content.replace(/```(json)?/g, "").trim();

    let json;
    try {
      json = JSON.parse(content);
    } catch {
      console.warn("⚠️ GPT no devolvió JSON válido, aplicando estructura de respaldo.");
      json = esSQL
        ? {
            conversacion: "No se pudo generar una consulta SQL válida.",
            sql: "",
          }
        : {
            conversacion: "No se pudo interpretar la instrucción.",
            resultado: [{ topic: "Plc/Otros", mensaje: prompt }],
          };
    }

    // 🔒 Limpieza
    if (esSQL) delete json.resultado;
    else delete json.sql;

    json.tipo = esSQL ? "Sql" : "Plc";

    // 🧩 Actualizar historial
    historialConversacion.push({ role: "user", content: prompt });
    historialConversacion.push({ role: "assistant", content: JSON.stringify(json) });

    // 🧹 Limitar historial a los últimos 10 mensajes
    if (historialConversacion.length > 10)
      historialConversacion = historialConversacion.slice(-10);

    return json;
  } catch (error) {
    console.error("❌ Error en gtpServiceUniversal:", error);
    return {
      conversacion:
        "Ocurrió un error interno al procesar el prompt. Intenta de nuevo más tarde.",
      resultado: [{ topic: "Plc/Error", mensaje: prompt }],
      tipo: "Error",
    };
  }
};

module.exports = { gtpServiceUniversal };
