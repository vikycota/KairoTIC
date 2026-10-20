import { minutosDesdeHora } from './conflictosHorario.js'

function compararTextoNatural(a, b) {
  return a.localeCompare(b, 'es', { numeric: true, sensitivity: 'base' })
}

export function calcularMetricasHorario(bloques) {
  const porDia = new Map()
  bloques.forEach((bloque) => {
    if (!porDia.has(bloque.dia)) porDia.set(bloque.dia, [])
    porDia.get(bloque.dia).push({
      inicio: minutosDesdeHora(bloque.hora_inicio),
      fin: minutosDesdeHora(bloque.hora_fin),
    })
  })

  let minutosHuecoTotal = 0
  let amplitudTotalMinutos = 0
  porDia.forEach((eventos) => {
    eventos.sort((a, b) => a.inicio - b.inicio || a.fin - b.fin)
    const inicioDia = eventos[0].inicio
    let finAnterior = eventos[0].fin
    for (let i = 1; i < eventos.length; i += 1) {
      const evento = eventos[i]
      if (evento.inicio > finAnterior) minutosHuecoTotal += evento.inicio - finAnterior
      finAnterior = Math.max(finAnterior, evento.fin)
    }
    amplitudTotalMinutos += finAnterior - inicioDia
  })

  return {
    minutos_hueco_total: minutosHuecoTotal,
    dias_con_clase: porDia.size,
    amplitud_total_minutos: amplitudTotalMinutos,
  }
}

function compararDesempate(a, b) {
  const gruposA = Object.entries(a.grupos).sort(([materiaA], [materiaB]) => compararTextoNatural(materiaA, materiaB))
  const gruposB = Object.entries(b.grupos).sort(([materiaA], [materiaB]) => compararTextoNatural(materiaA, materiaB))
  for (let i = 0; i < Math.min(gruposA.length, gruposB.length); i += 1) {
    const materia = compararTextoNatural(gruposA[i][0], gruposB[i][0])
    if (materia !== 0) return materia
    const grupo = compararTextoNatural(gruposA[i][1], gruposB[i][1])
    if (grupo !== 0) return grupo
  }
  return gruposA.length - gruposB.length
}

export function ordenarCombinacionesHorario(combinaciones) {
  return combinaciones
    .map((combinacion) => ({
      ...combinacion,
      metricas: calcularMetricasHorario(combinacion.bloques),
    }))
    .sort((a, b) => (
      a.metricas.minutos_hueco_total - b.metricas.minutos_hueco_total
      || a.metricas.dias_con_clase - b.metricas.dias_con_clase
      || a.metricas.amplitud_total_minutos - b.metricas.amplitud_total_minutos
      || compararDesempate(a, b)
    ))
}

export function formatearDuracion(minutos) {
  const horas = Math.floor(minutos / 60)
  const resto = minutos % 60
  if (horas && resto) return `${horas} h ${resto} min`
  if (horas) return `${horas} h`
  return `${resto} min`
}
