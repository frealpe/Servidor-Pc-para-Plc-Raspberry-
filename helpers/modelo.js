const coeficientes = {
  a1: -1.618,
  a2: 0.670,
  b1: 0.00102,
  b2: 0.000,
  d: 1
};

export function modeloPlanta(u) {
  const y = [];
  const n = u.length;
  y[0] = 4.432;
  y[1] = 3.548;
  for (let k = 2; k < n; k++) {
    const uk1 = u[k - coeficientes.d] !== undefined ? u[k - coeficientes.d] : u[0];
    const uk2 = u[k - coeficientes.d - 1] !== undefined ? u[k - coeficientes.d - 1] : u[0];
    y[k] = -coeficientes.a1 * y[k - 1] - coeficientes.a2 * y[k - 2] + coeficientes.b1 * uk1 + coeficientes.b2 * uk2;
  }
  return y;
}

if (require.main === module) {
  const entrada = [];
  for (let i = 0; i < 50; i++) entrada.push(410);
  for (let i = 50; i < 100; i++) entrada.push(2048);
  const salida = modeloPlanta(entrada);
  console.log(salida);
}

module.exports = { modeloPlanta, coeficientes };

export default modeloPlanta;