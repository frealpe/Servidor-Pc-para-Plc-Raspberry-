const coeficientes = {
  a1: -1.561,
  a2: 0.607,
  b0: 0.00108,
  b1: 0.00102
};

export function modeloPlanta(u) {
  const N = u.length;
  const y = Array(N).fill(0);
  for (let k = 0; k < N; k++) {
    const uk = u[k] ?? 0;
    const uk1 = u[k - 1] ?? 0;
    const yk1 = y[k - 1] ?? 0;
    const yk2 = y[k - 2] ?? 0;
    y[k] = -coeficientes.a1 * yk1 - coeficientes.a2 * yk2 + coeficientes.b0 * uk + coeficientes.b1 * uk1;
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