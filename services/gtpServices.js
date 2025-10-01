// services/gptService.js
const OpenAI = require("openai");
const { config } = require("dotenv");
config();

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const gtpServices = async (prompt) => {
  try {
    const completion = await client.chat.completions.create({
      model: "gpt-4.1",
      messages: [ 
        {
          role: "system",
          content: `Eres un asistente que clasifica y enruta instrucciones humanas para un PLC en formato JSON.
Cada objeto debe tener la siguiente estructura:
{
  "topic": "<cadena con el tema MQTT>",
  "mensaje": "<instrucción original>"
}

Reglas:
- Si la instrucción contiene "canal", "adc" o "lee", el topic es "Plc/Adc".
- Si la instrucción contiene "salida", "Q" o "lee estado", el topic es "Plc/Ia".
- Si la instrucción contiene "control", "controla", "planta", "encendido de planta", "simulacion" o "simulación", el topic es "Plc/Control".
  • El set-point siempre se expresa en voltios (0 a 10 V).
  • El tiempo de simulación debe expresarse en milisegundos (si el usuario da segundos, conviértelo a ms).
  • El tiempo de muestreo también en milisegundos (por defecto 1 ms).
- Si la instrucción contiene "informe", "reporta", "genera reporte", "estadísticas" o "supervisión", el topic es "Plc/Supervisor".
- Si no se reconoce, asignar topic "Plc/Otros".
- El campo "mensaje" debe conservar el texto original de la instrucción.
- Si hay varias instrucciones, devuelve un arreglo JSON.

Ejemplo de salida:
[
  {
    "topic": "Plc/Adc",
    "mensaje": "lee canal 0 cada 1000 ms durante 5000 ms"
  },
  {
    "topic": "Plc/Ia",
    "mensaje": "Estado salida Q0 en 1"
  },
  {
    "topic": "Plc/Control",
    "mensaje": "Controla la planta con un set point de 5 V, simulación = 10000 ms, muestreo = 1 ms"
  },
  {
    "topic": "Plc/Supervisor",
    "mensaje": "Genera un reporte de la ultima simulación"
  }
]`,
        },
        { role: "user", content: prompt },
      ],
      temperature: 0,
    });

    return completion.choices[0]?.message?.content?.trim();
  } catch (error) {
    console.error("❌ Error en generarComandoPLC:", error);
    throw error;
  }
};

module.exports = { gtpServices };
