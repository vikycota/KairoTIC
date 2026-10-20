export function minutosDesdeHora(hora) {
  const match = /^(\d{2}):(\d{2})$/.exec(hora ?? '')
  if (!match) throw new Error(`Hora inválida: ${hora}`)
  const horas = Number(match[1])
  const minutosHora = Number(match[2])
  if (horas > 23 || minutosHora > 59) throw new Error(`Hora inválida: ${hora}`)
  return horas * 60 + minutosHora
}

export function obtenerBloquesSeleccionados(seleccion, horariosPorMateria) {
  return Object.entries(seleccion)
    .filter(([, estado]) => estado.seleccionada)
    .flatMap(([materia, estado]) => {
      const bloques = horariosPorMateria[materia]?.grupos?.[estado.grupo] ?? []
      return bloques.map((bloque) => ({ ...bloque, materia, grupo: estado.grupo }))
    })
}

export function detectarConflictosHorario(bloques) {
  const conflictos = []
  const tiempos = bloques.map((bloque) => ({
    bloque,
    inicio: minutosDesdeHora(bloque.hora_inicio),
    fin: minutosDesdeHora(bloque.hora_fin),
  }))

  for (let i = 0; i < tiempos.length; i += 1) {
    for (let j = i + 1; j < tiempos.length; j += 1) {
      const a = tiempos[i]
      const b = tiempos[j]
      if (
        a.bloque.dia === b.bloque.dia
        && a.inicio < b.fin
        && b.inicio < a.fin
      ) {
        conflictos.push({ bloqueA: a.bloque, bloqueB: b.bloque })
      }
    }
  }

  return { compatible: conflictos.length === 0, conflictos }
}
