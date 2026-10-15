/*
 * Sugerencia de semestre.
 *
 * Hoy se calcula acá, en el navegador, a partir de datos reales del alumno:
 *   - el plan de la carrera (créditos, semestre y previas de cada materia),
 *   - sus materias aprobadas (escolaridad),
 *   - los horarios y talleres que cargó.
 *
 * Es un criterio simple y explicable, no un modelo predictivo. Cuando exista el motor de
 * predicción del backend, alcanza con reemplazar `generarSugerencia` por una llamada a la API
 * que devuelva esta misma forma y la pantalla no necesita cambios.
 *
 * Forma del resultado:
 *   { materias: [{ materia, creditos, semestre, bloques, motivos }],
 *     talleres: [{ nombre, bloques }],
 *     descartadas: [{ nombre, creditos, razon, tipo }],
 *     creditos }
 *   bloque: { dia, inicio, fin, ini, finMin, salon, extra }
 */

export const DIAS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']

export const aMin = (hhmm) => {
  const [h, m] = hhmm.split(':').map(Number)
  return h * 60 + m
}

const normalizar = (texto) => texto.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim()

const aBloque = (b) => ({
  dia: b.dia,
  inicio: b.inicio,
  fin: b.fin,
  ini: aMin(b.inicio),
  finMin: aMin(b.fin),
  salon: b.salon ?? '',
  extra: b.extra ?? '',
})

const solapan = (a, b) => a.dia === b.dia && a.ini < b.finMin && b.ini < a.finMin

const chocaCon = (bloques, elegidos) => elegidos.find((e) => bloques.some((b) => solapan(b, e.bloque)))

/** Agrupa los bloques cargados por nombre (una materia o taller puede tener varios). */
function agrupar(lista) {
  const grupos = new Map()
  for (const b of lista) {
    const clave = normalizar(b.nombre)
    if (!grupos.has(clave)) grupos.set(clave, { nombre: b.nombre, bloques: [] })
    grupos.get(clave).bloques.push(aBloque(b))
  }
  return grupos
}

export function generarSugerencia({ materias, aprobadas, horarios, talleres, excluidas, maxCreditos }) {
  const horariosPorMateria = agrupar(horarios)
  const resultado = { materias: [], talleres: [], descartadas: [], creditos: 0 }
  const candidatas = []

  for (const m of materias) {
    if (aprobadas.has(m.nombre) || excluidas.has(m.nombre)) continue

    const faltan = (m.previas ?? []).filter((p) => !aprobadas.has(p))
    if (faltan.length) {
      resultado.descartadas.push({ nombre: m.nombre, creditos: m.creditos, tipo: 'previas', razon: `Falta aprobar: ${faltan.join(', ')}` })
      continue
    }

    const horario = horariosPorMateria.get(normalizar(m.nombre))
    if (!horario) {
      resultado.descartadas.push({ nombre: m.nombre, creditos: m.creditos, tipo: 'horario', razon: 'No está en los horarios que cargaste' })
      continue
    }

    const habilita = materias.filter((x) => x.previas?.includes(m.nombre)).length
    const motivos = []
    if (m.semestre) motivos.push(`Es del semestre ${m.semestre} de tu plan`)
    if (habilita) motivos.push(`Es previa de ${habilita} ${habilita === 1 ? 'materia' : 'materias'}`)
    if (m.previas?.length) motivos.push('Ya aprobaste sus previas')
    else motivos.push('No tiene previas')
    candidatas.push({ m, bloques: horario.bloques, habilita, motivos })
  }

  // Primero lo que corresponde antes en el plan, y dentro de eso lo que destraba más materias.
  candidatas.sort((a, b) =>
    (a.m.semestre ?? 99) - (b.m.semestre ?? 99) ||
    b.habilita - a.habilita ||
    b.m.creditos - a.m.creditos ||
    a.m.nombre.localeCompare(b.m.nombre, 'es')
  )

  const elegidos = []   // [{ nombre, bloque }]
  for (const c of candidatas) {
    if (resultado.creditos + c.m.creditos > maxCreditos) {
      resultado.descartadas.push({ nombre: c.m.nombre, creditos: c.m.creditos, tipo: 'creditos', razon: `Superaría el máximo de ${maxCreditos} créditos` })
      continue
    }
    const choque = chocaCon(c.bloques, elegidos)
    if (choque) {
      resultado.descartadas.push({ nombre: c.m.nombre, creditos: c.m.creditos, tipo: 'choque', razon: `Se superpone con ${choque.nombre}` })
      continue
    }
    resultado.materias.push({ materia: c.m.nombre, creditos: c.m.creditos, semestre: c.m.semestre, bloques: c.bloques, motivos: c.motivos })
    resultado.creditos += c.m.creditos
    for (const b of c.bloques) elegidos.push({ nombre: c.m.nombre, bloque: b })
  }

  // Talleres: se proponen los que entran en los huecos que quedaron, sin pasar de dos.
  for (const [, t] of agrupar(talleres)) {
    if (excluidas.has(`taller:${t.nombre}`) || resultado.talleres.length >= 2) continue
    if (chocaCon(t.bloques, elegidos)) continue
    resultado.talleres.push(t)
    for (const b of t.bloques) elegidos.push({ nombre: t.nombre, bloque: b })
  }

  return resultado
}

export const duracionHoras = (bloques) => bloques.reduce((acc, b) => acc + (b.finMin - b.ini), 0) / 60
