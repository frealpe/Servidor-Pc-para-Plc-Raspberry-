import fs from "fs";
import path from "path";
import OpenAI from "openai";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function identificarModeloIA({ data, mensaje = "", conversacion = "" }) {
  try {
    const muestras = data.slice(0, 1000);
    const textoDatos = JSON.stringify(muestras, null, 2);

const prompt = `
Actúa como un ingeniero experto en identificación de sistemas discretos.

Instrucciones del usuario:
"${mensaje}"

Con base en los siguientes datos experimentales (entrada u[k], salida y[k]),
identifica el modelo discreto más adecuado para la planta.

Devuelve únicamente un archivo JavaScript compatible con ES Modules que:
1️⃣ Defina 'const coeficientes' con los coeficientes del modelo.
2️⃣ Defina la función 'modeloPlanta(u)' para simular la respuesta discreta.
3️⃣ Incluya **solo y exclusivamente** la función de prueba como:
   export function modeloIdentificado() {
     const entrada = Array(50).fill(410).concat(Array(50).fill(2048));
     const salida = modeloPlanta(entrada);
     console.log("🟢 Coeficientes del modelo:", coeficientes);
     console.log("📈 Salida simulada del modelo:", salida.slice(0,100), "...");
     return salida;
   }
4️⃣ No definas la función 'modeloIdentificado' sin 'export'.
5️⃣ No uses 'module.exports' ni 'export default'.
6️⃣ No agregues comentarios ni texto adicional fuera del código.

Datos experimentales (primeras muestras):
${textoDatos}
`;


    console.log("🤖 Solicitando a GPT la identificación del modelo...");

    const respuesta = await openai.chat.completions.create({
      model: "gpt-4.1",
      messages: [
        { role: "system", content: "Eres un ingeniero en control automático especializado en identificación de sistemas discretos." },
        { role: "user", content: prompt },
      ],
      temperature: 0.2,
    });

    let codigoModelo = respuesta.choices[0].message.content.trim();
    codigoModelo = codigoModelo
      .replace(/```(javascript)?/g, "")
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/\/\/.*$/gm, "")
      .trim();

    // Asegurar que la función modeloPlanta tenga export
    if (!codigoModelo.includes("export function modeloPlanta") && codigoModelo.includes("function modeloPlanta")) {
      codigoModelo = codigoModelo.replace(/function modeloPlanta/, "export function modeloPlanta");
    }

    // Extraer coeficientes
    let coeficientes = {};
    const matchObject = codigoModelo.match(/coeficientes\s*=\s*(\{[^}]*\})/);
    try {
      if (matchObject) {
        coeficientes = JSON.parse(matchObject[1].replace(/(\w+):/g, '"$1":').replace(/,\s*}/g, "}"));
      }
    } catch {
      coeficientes = {};
    }

    // ✅ Agregar función modeloIdentificado solo si no existe
    if (!/export function modeloIdentificado/.test(codigoModelo)) {
      codigoModelo += `
export function modeloIdentificado() {
  const entrada = Array(50).fill(410).concat(Array(50).fill(2048));
  const salida = modeloPlanta(entrada);
  console.log("🟢 Coeficientes del modelo:", coeficientes);
  console.log("📈 Salida simulada del modelo:", salida.slice(0, 10), "...");
  return salida;
}`;
    }

    // Guardar archivo en /services
    const rutaArchivo = path.join(process.cwd(), "services", "modelo.js");
    fs.writeFileSync(rutaArchivo, codigoModelo);

    const respuestaUsuario = `✅ Modelo identificado correctamente.\n🔢 Coeficientes: ${JSON.stringify(coeficientes)}\n📘 Ajustados según los datos experimentales.`;

    const conversacionActualizada = typeof conversacion === "string"
      ? `${conversacion}\n${respuestaUsuario}`
      : [
          ...(Array.isArray(conversacion) ? conversacion : []),
          { role: "user", content: mensaje },
          { role: "assistant", content: respuestaUsuario },
        ];

    return { ok: true, error: null, coeficientes, conversacion: conversacionActualizada };
  } catch (error) {
    console.error("❌ Error al identificar el modelo:", error);
    const conversacionError = typeof conversacion === "string"
      ? `${conversacion}\n❌ Error durante la identificación del modelo: ${error.message}`
      : [...(conversacion || []), { role: "assistant", content: `❌ Error durante la identificación del modelo: ${error.message}` }];
    return { ok: false, error: error.message, coeficientes: {}, conversacion: conversacionError };
  }
}
