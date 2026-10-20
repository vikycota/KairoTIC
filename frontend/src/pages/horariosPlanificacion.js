const ORDEN_DIAS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado']

export function claveMateria(nombre) {
  return String(nombre ?? '').trim()
}

export function agruparHorariosPorMateria(bloques = []) {
  const materias = Object.create(null)

  bloques.forEach((bloque) => {
    const materia = claveMateria(bloque.materia)
    if (!materia) return

    const grupo = String(bloque.grupo || 'General').trim() || 'General'
    materias[materia] ??= { grupos: Object.create(null) }
    materias[materia].grupos[grupo] ??= []
    materias[materia].grupos[grupo].push({
      dia: bloque.dia,
      hora_inicio: bloque.hora_inicio,
      hora_fin: bloque.hora_fin,
      docente: bloque.docente,
      tipo: bloque.tipo,
      opcional: bloque.opcional,
    })
  })

  Object.values(materias).forEach(({ grupos }) => {
    Object.values(grupos).forEach((horarios) => horarios.sort((a, b) => {
      const diaA = ORDEN_DIAS.indexOf(a.dia)
      const diaB = ORDEN_DIAS.indexOf(b.dia)
      return diaA - diaB || a.hora_inicio.localeCompare(b.hora_inicio)
    }))
  })

  return materias
}

export function obtenerMateriasCandidatas(planMaterias = [], horariosPorMateria = {}) {
  const candidatas = new Map()
  planMaterias.forEach((materia) => {
    const id = claveMateria(materia.nombre)
    if (id && horariosPorMateria[id] && !candidatas.has(id)) {
      candidatas.set(id, { id, materia, grupos: horariosPorMateria[id].grupos })
    }
  })
  return [...candidatas.values()]
}

export function obtenerMateriasSinOferta(planMaterias = [], horariosPorMateria = {}) {
  const sinOferta = new Map()
  planMaterias.forEach((materia) => {
    const id = claveMateria(materia.nombre)
    if (id && !horariosPorMateria[id] && !sinOferta.has(id)) sinOferta.set(id, materia)
  })
  return [...sinOferta.values()]
}
