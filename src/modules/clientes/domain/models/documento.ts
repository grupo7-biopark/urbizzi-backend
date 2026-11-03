export function normalizarDocumento(valor: string): string {
  return valor.replace(/[./\s-]/g, '');
}
export function documentoValido(valor: string): boolean {
  const documento = normalizarDocumento(valor);
  if (!/^(\d{11}|\d{14})$/.test(documento) || /^(\d)\1+$/.test(documento))
    return false;
  const calcular = (base: string, peso: number) => {
    let soma = 0;
    for (const digito of base) {
      soma += Number(digito) * peso;
      peso = peso === 2 ? 9 : peso - 1;
    }
    const resto = soma % 11;
    return resto < 2 ? 0 : 11 - resto;
  };
  if (documento.length === 11) {
    const digito = (base: string) => {
      const resto =
        [...base].reduce(
          (s, n, i) => s + Number(n) * (base.length + 1 - i),
          0,
        ) % 11;
      return resto < 2 ? 0 : 11 - resto;
    };
    return (
      digito(documento.slice(0, 9)) === Number(documento[9]) &&
      digito(documento.slice(0, 10)) === Number(documento[10])
    );
  }
  return (
    calcular(documento.slice(0, 12), 5) === Number(documento[12]) &&
    calcular(documento.slice(0, 13), 6) === Number(documento[13])
  );
}
