import { detectarConflictosHorario } from './conflictosHorario.js'
import { ordenarCombinacionesHorario } from './rankingHorarios.js'
import { entraEnTope } from './costosSemestre.js'

const LIMITE_NODOS = 12000
const MAX_OPCIONES = 3

function ordenarNatural(a, b) {
  return a.localeCompare(b, 'es', { numeric: true, sensitivity: 'base' })
}

// Busca las combinaciones sin choques de horario que agregan más materias.
// Si hay `config` con presupuesto, descarta toda combinación que se pase del tope.
function buscar({ materiasPorAgregar, obligatorias, gruposFijos, bloquesFijos, horariosPorMateria, costoPorMateria, costoInicial, config }) {
  let mejorCantidad = -1
  let nodos = 0
  let mejores = []

  function recorrer(indice, grupos, bloques, cantidadAgregada, costoActual) {
    nodos += 1
    if (nodos > LIMITE_NODOS || cantidadAgregada + materiasPorAgregar.length - indice < mejorCantidad) return
    if (indice === materiasPorAgregar.length) {
      if (obligatorias.size > 0 && [...obligatorias].some((nombre) => !grupos[nombre])) return
      if (cantidadAgregada === 0) return
      if (cantidadAgregada < mejorCantidad) return
      if (cantidadAgregada > mejorCantidad) {
        mejorCantidad = cantidadAgregada
        mejores = []
      }
      mejores.push({ grupos: { ...gruposFijos, ...grupos }, bloques: [...bloques] })
      if (mejores.length >= 30) mejores = ordenarCombinacionesHorario(mejores).slice(0, MAX_OPCIONES)
      return
    }

    const materia = materiasPorAgregar[indice]
    const costoMateria = costoPorMateria?.get(materia.id) ?? 0
    // Si agregar esta materia se pasa del presupuesto, solo queda la rama que la deja afuera.
    const entra = entraEnTope(costoActual + costoMateria, config)
    if (entra) {
      const gruposMateria = Object.keys(materia.grupos).sort(ordenarNatural)
      for (const grupo of gruposMateria) {
        const nuevosBloques = (horariosPorMateria[materia.id].grupos[grupo] ?? [])
          .map((bloque) => ({ ...bloque, materia: materia.id, grupo }))
        const bloquesParciales = [...bloques, ...nuevosBloques]
        if (detectarConflictosHorario(bloquesParciales).compatible) {
          recorrer(indice + 1, { ...grupos, [materia.id]: grupo }, bloquesParciales, cantidadAgregada + 1, costoActual + costoMateria)
        }
      }
    }
    if (!obligatorias.has(materia.id)) recorrer(indice + 1, grupos, bloques, cantidadAgregada, costoActual)
  }

  recorrer(0, {}, bloquesFijos, 0, costoInicial)
  return { opciones: ordenarCombinacionesHorario(mejores).slice(0, MAX_OPCIONES), nodosExcedidos: nodos > LIMITE_NODOS }
}

/**
 * Devuelve { opciones, estado, nodosExcedidos }.
 * estado:
 *   'ok'              → opciones que entran en el presupuesto (o no hay presupuesto cargado)
 *   'sin-presupuesto' → ninguna opción entra; se devuelve la más barata, marcada con fueraDePresupuesto
 *   'fijas-exceden'   → las materias ya elegidas por sí solas superan el presupuesto; no se agrega nada
 *   'sin-opciones'    → no hay combinación compatible (por horarios)
 */
export function buscarOpcionesSeleccion({
  materiasPorAgregar,
  obligatorias = new Set(),
  gruposFijos = {},
  bloquesFijos = [],
  horariosPorMateria,
  creditosPorMateria = new Map(),
  config = null,
}) {
  const costoPorMateria = config
    ? new Map([...creditosPorMateria].map(([id, creditos]) => [id, creditos * config.valorCredito * (1 - config.beca / 100)]))
    : null
  const costoInicial = config
    ? Object.keys(gruposFijos).reduce((suma, id) => suma + (costoPorMateria.get(id) ?? 0), 0)
    : 0

  if (config && config.topeMaterias !== null && !entraEnTope(costoInicial, config)) {
    return { opciones: [], estado: 'fijas-exceden', nodosExcedidos: false }
  }

  const base = { materiasPorAgregar, obligatorias, gruposFijos, bloquesFijos, horariosPorMateria, costoPorMateria, costoInicial }
  const principal = buscar({ ...base, config })
  if (principal.opciones.length > 0) return { ...principal, estado: 'ok' }

  // Sin presupuesto cargado no hay nada que relajar: simplemente no hay combinación compatible.
  if (!config || config.topeMaterias === null) return { ...principal, estado: 'sin-opciones' }

  // Ninguna combinación entra en el presupuesto: mostramos la opción más barata, marcada.
  const costo = (materia) => costoPorMateria.get(materia.id) ?? 0
  const intentos = obligatorias.size > 0
    ? [materiasPorAgregar.filter((materia) => obligatorias.has(materia.id))]
    : [...materiasPorAgregar]
      .sort((a, b) => costo(a) - costo(b) || ordenarNatural(a.id, b.id))
      .map((materia) => [materia])
  for (const subconjunto of intentos) {
    const resultado = buscar({ ...base, materiasPorAgregar: subconjunto, config: null })
    if (resultado.opciones.length > 0) {
      return {
        opciones: [{ ...resultado.opciones[0], fueraDePresupuesto: true }],
        estado: 'sin-presupuesto',
        nodosExcedidos: resultado.nodosExcedidos,
      }
    }
  }
  return { opciones: [], estado: 'sin-opciones', nodosExcedidos: principal.nodosExcedidos }
}
