/** Primera letra de cada palabra en mayúscula; el resto se respeta. */
export function capitalizar(valor) {
  return valor.replace(/(^|\s)(\p{L})/gu, (_, espacio, letra) => espacio + letra.toLocaleUpperCase('es'))
}
