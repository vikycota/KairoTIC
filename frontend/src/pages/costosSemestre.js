// Cálculo del costo de un semestre. Misma fórmula que GET /api/costo-semestre:
//   costo_materias = créditos × valor del crédito × (1 − beca / 100)
//   costo_final    = costo_materias + gastos extra del semestre
//   presupuesto semestral = presupuesto mensual × meses (6 por defecto)

export const MESES_SEMESTRE = 6
const TOLERANCIA = 0.005

function numeroONulo(valor) {
  if (valor === null || valor === undefined || valor === '') return null
  const n = Number(valor)
  return Number.isFinite(n) ? n : null
}

function redondear(valor) {
  return Math.round(valor * 100) / 100
}

/** Etiqueta de semestre que espera el backend: "2026-2". Devuelve null si no es válida. */
export function etiquetaSemestre(anio, semestre) {
  const etiqueta = `${anio}-${semestre}`
  return /^\d{4}-[12]$/.test(etiqueta) ? etiqueta : null
}

/**
 * Deja la configuración económica lista para usar.
 * Si no hay valor de crédito, devuelve null (no se puede calcular costo).
 */
export function crearConfigCosto({ valorCredito, beca, presupuestoMensual, gastosExtra, meses = MESES_SEMESTRE } = {}) {
  const valor = numeroONulo(valorCredito)
  if (valor === null || valor <= 0) return null
  const becaNumero = Math.min(Math.max(numeroONulo(beca) ?? 0, 0), 100)
  const mensual = numeroONulo(presupuestoMensual)
  const extras = Math.max(numeroONulo(gastosExtra) ?? 0, 0)
  const presupuestoSemestral = mensual === null ? null : redondear(mensual * meses)
  return {
    valorCredito: valor,
    beca: becaNumero,
    presupuestoMensual: mensual,
    gastosExtra: extras,
    meses,
    presupuestoSemestral,
    // Lo que queda para materias una vez descontados los gastos extra (puede ser negativo).
    topeMaterias: presupuestoSemestral === null ? null : redondear(presupuestoSemestral - extras),
  }
}

export function costoDeCreditos(creditos, config) {
  return redondear(creditos * config.valorCredito * (1 - config.beca / 100))
}

export function calcularCostoSeleccion(creditos, config) {
  const costoMaterias = costoDeCreditos(creditos, config)
  const costoFinal = redondear(costoMaterias + config.gastosExtra)
  const tienePresupuesto = config.presupuestoSemestral !== null
  return {
    creditos,
    costoMaterias,
    gastosExtra: config.gastosExtra,
    costoFinal,
    presupuestoSemestral: config.presupuestoSemestral,
    diferencia: tienePresupuesto ? redondear(config.presupuestoSemestral - costoFinal) : null,
    dentroDelPresupuesto: tienePresupuesto ? costoFinal <= config.presupuestoSemestral + TOLERANCIA : null,
  }
}

/** ¿Un costo de materias entra en el tope? Sin presupuesto cargado, siempre entra. */
export function entraEnTope(costoMaterias, config) {
  if (!config || config.topeMaterias === null) return true
  return costoMaterias <= config.topeMaterias + TOLERANCIA
}

export function formatearMonto(valor) {
  return `$${Number(valor).toLocaleString('es-UY', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`
}
