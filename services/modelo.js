const coeficientes = {
  a1: 1.566,
  a2: -0.670,
  b1: 0.000838,
  b2: 0.000749
};

export function modeloPlanta(u) {
  const N = u.length;
  const y = Array(N).fill(0);
  for (let k = 2; k < N; ++k) {
    y[k] = coeficientes.a1 * y[k - 1] + coeficientes.a2 * y[k - 2]
         + coeficientes.b1 * u[k - 1] + coeficientes.b2 * u[k - 2];
  }
  return y;
}

export function modeloIdentificado() {
  const entrada = Array(50).fill(410).concat(Array(50).fill(2048));
  const salida = modeloPlanta(entrada);
  console.log("🟢 Coeficientes del modelo:", coeficientes);
  console.log("📈 Salida simulada del modelo:", salida.slice(0,100), "...");
  return salida;
}