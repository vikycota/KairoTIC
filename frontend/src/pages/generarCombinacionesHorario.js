import { detectarConflictosHorario } from './conflictosHorario.js'

const LIMITE_COMBINACIONES = 5000

export function generarCombinacionesHorario(
  materiasSeleccionadas,
  horariosPorMateria,
  limite = LIMITE_COMBINACIONES,
) {
  const materias = Object.entries(materiasSeleccionadas)
    .filter(([, estado]) => estado.seleccionada)
    .map(([nombre]) => ({
      nombre,
      grupos: Object.keys(horariosPorMateria[nombre]?.grupos ?? {})
        .sort((a, b) => a.localeCompare(b, 'es', { numeric: true, sensitivity: 'base' })),
    }))

  const cantidadTotal = materias.reduce((total, materia) => total * materia.grupos.length, 1)
  if (!materias.length || materias.some(({ grupos }) => grupos.length === 0)) {
    return { combinaciones: [], cantidadTotal: 0, truncado: false }
  }

  const combinaciones = []
  let truncado = false

  function buscar(indice, gruposElegidos, bloquesElegidos) {
    if (combinaciones.length >= limite) {
      truncado = true
      return
    }
    if (indice === materias.length) {
      combinaciones.push({ grupos: { ...gruposElegidos }, bloques: [...bloquesElegidos] })
      return
    }

    const materia = materias[indice]
    for (const grupo of materia.grupos) {
      const nuevosBloques = (horariosPorMateria[materia.nombre].grupos[grupo] ?? [])
        .map((bloque) => ({ ...bloque, materia: materia.nombre, grupo }))
      const bloquesParciales = [...bloquesElegidos, ...nuevosBloques]
      if (!detectarConflictosHorario(bloquesParciales).compatible) continue

      buscar(
        indice + 1,
        { ...gruposElegidos, [materia.nombre]: grupo },
        bloquesParciales,
      )
      if (truncado) return
    }
  }

  buscar(0, {}, [])
  return { combinaciones, cantidadTotal, truncado }
}
