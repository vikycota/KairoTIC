import { useEffect, useMemo, useState } from 'react'
import ScheduleImportPanel from './ScheduleImportPanel'
import MateriasDisponibles from './MateriasDisponibles'
import {
  agruparHorariosPorMateria,
  obtenerMateriasCandidatas,
  obtenerMateriasSinOferta,
} from './horariosPlanificacion'
import {
  detectarConflictosHorario,
  minutosDesdeHora,
  obtenerBloquesSeleccionados,
} from './conflictosHorario'
import { generarCombinacionesHorario } from './generarCombinacionesHorario'
import { formatearDuracion, ordenarCombinacionesHorario } from './rankingHorarios'
import { apiFetch, EVENTO_CARRERAS_ACTUALIZADAS } from '../api'

const DIAS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']
const DIAS_COMPLETOS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo']
const DIAS_CALENDARIO = { Lunes: 'Lun', Martes: 'Mar', Miércoles: 'Mié', Jueves: 'Jue', Viernes: 'Vie', Sábado: 'Sáb', Domingo: 'Dom' }
const DIAS_COMPLETOS_TALLER = { Lun: 'Lunes', Mar: 'Martes', Mié: 'Miércoles', Jue: 'Jueves', Vie: 'Viernes', Sáb: 'Sábado', Dom: 'Domingo' }
const ALTURA_HORA = 44
const MAX_ALTERNATIVAS_VISIBLES = 10
const REPETICIONES_BLOQUE = {
  diaria: 'Diaria',
  semanal: 'Semanal',
  quincenal: 'Bimensual (cada dos semanas)',
  mensual: 'Mensual',
  alternado: 'Mes sí, mes no',
}

const HORAS = Array.from(
  { length: 18 },
  (_, i) => 6 + i
)

function claveCelda(diaIndex, hora) {
  return `${diaIndex}-${hora}`
}

async function leerJson(res) {
  try { return await res.json() } catch { return {} }
}

function leerPeriodoGuardado(emailUsuario, campo, valorPredeterminado) {
  try {
    const guardado = JSON.parse(localStorage.getItem(`kairo-horarios:${emailUsuario}`) || 'null')
    if (guardado?.[campo] != null) return guardado[campo]
    const talleres = JSON.parse(localStorage.getItem(`kairo-talleres:${emailUsuario}`) || 'null')
    const campoTalleres = campo === 'semestre_lectivo' ? 'semestre' : campo
    return talleres?.[campoTalleres] ?? valorPredeterminado
  } catch {
    return valorPredeterminado
  }
}

function leerTalleresGuardados(emailUsuario) {
  try {
    return JSON.parse(localStorage.getItem(`kairo-talleres:${emailUsuario}`) || 'null') ?? {}
  } catch {
    return {}
  }
}

function leerBloquesManuales(emailUsuario) {
  try {
    return JSON.parse(localStorage.getItem(`kairo-bloques-manuales:${emailUsuario}`) || 'null') ?? { por_periodo: {} }
  } catch {
    return { por_periodo: {} }
  }
}

function leerPlanificacionesGuardadas(emailUsuario) {
  try {
    return JSON.parse(localStorage.getItem(`kairo-planificaciones:${emailUsuario}`) || 'null') ?? { por_periodo: {} }
  } catch {
    return { por_periodo: {} }
  }
}

function leerPlanificacionPeriodo(emailUsuario, carrera, anio, semestre) {
  const planes = leerPlanificacionesGuardadas(emailUsuario)
  const periodo = clavePeriodo(carrera, anio, semestre)
  return planes.por_periodo?.[periodo] ?? null
}

function leerPlanificacionActiva(emailUsuario) {
  const planes = leerPlanificacionesGuardadas(emailUsuario)
  return planes.por_periodo?.[planes.activo] ?? null
}

function prepararPlanGuardado(guardado) {
  if (!guardado) return { materias: {}, talleres: {}, planificacion: null }
  const bloques = guardado.bloques_planificacion ?? (guardado.bloques ?? []).map((bloque, indice) => ({
    id: `guardado-${indice}`,
    materia: bloque.nombre,
    grupo: bloque.grupo ?? '',
    dia: DIAS_COMPLETOS_TALLER[bloque.dia] ?? bloque.dia,
    hora_inicio: bloque.inicio,
    hora_fin: bloque.fin,
    tipo: bloque.tipo === 'taller' ? 'Taller' : 'Clase',
  }))
  const materias = guardado.materias_seleccionadas ?? Object.fromEntries(
    bloques
      .filter((bloque) => bloque.tipo !== 'Taller' && bloque.tipo !== 'Manual')
      .map((bloque) => [bloque.materia, { seleccionada: true, grupo: bloque.grupo }])
  )
  const talleres = guardado.talleres_seleccionados ?? [...new Set(
    bloques.filter((bloque) => bloque.tipo === 'Taller').map((bloque) => bloque.materia)
  )]
  return {
    materias,
    talleres: Object.fromEntries(talleres.map((nombre) => [nombre, true])),
    planificacion: bloques.length ? { bloques, ...detectarConflictosHorario(bloques) } : null,
  }
}

function clavePeriodo(carrera, anio, semestre) {
  return JSON.stringify([carrera, String(anio), String(semestre)])
}

function horaValida(hora) {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(hora)
}

function nuevoIdBloqueManual() {
  return `manual-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

function etiquetaBloque(bloque) {
  if (bloque.tipo === 'Taller') return 'Taller'
  if (bloque.tipo === 'Manual') return REPETICIONES_BLOQUE[bloque.repeticion] ?? 'Bloque manual'
  return `Grupo ${bloque.grupo}`
}

function expandirBloquesManuales(bloques) {
  return bloques.flatMap((bloque) => (
    bloque.repeticion === 'diaria'
      ? DIAS_COMPLETOS.map((dia) => ({ ...bloque, id: `${bloque.id}-${dia}`, dia }))
      : [bloque]
  ))
}

function PlanPage({ emailUsuario, onIr }) {
  const planActivoInicial = leerPlanificacionActiva(emailUsuario)
  const periodoInicial = planActivoInicial ?? {}
  const estadoPlanInicial = prepararPlanGuardado(planActivoInicial)
  const [mostrarImportacionHorarios, setMostrarImportacionHorarios] = useState(false)
  const [mostrarMaterias, setMostrarMaterias] = useState(false)
  const [mostrarTalleres, setMostrarTalleres] = useState(false)
  const [mostrarAgregarBloque, setMostrarAgregarBloque] = useState(false)
  const [opcionesSeleccionAutomatica, setOpcionesSeleccionAutomatica] = useState([])
  const [mensajeSeleccionAutomatica, setMensajeSeleccionAutomatica] = useState('')
  const [errorBloqueManual, setErrorBloqueManual] = useState('')
  const [bloqueManualNuevo, setBloqueManualNuevo] = useState({ nombre: '', dia: 'Lunes', hora_inicio: '08:00', hora_fin: '09:00', repeticion: 'semanal', fecha_inicio: '' })
  const [planificacion, setPlanificacion] = useState(estadoPlanInicial.planificacion)
  const [planificacionPendiente, setPlanificacionPendiente] = useState(false)
  const [alternativas, setAlternativas] = useState(null)
  const [alternativasTruncadas, setAlternativasTruncadas] = useState(false)
  const [alternativaVista, setAlternativaVista] = useState(null)
  const [mensajePlanificacion, setMensajePlanificacion] = useState('')
  const [mensajeGuardar, setMensajeGuardar] = useState('')
  const [carreras, setCarreras] = useState([])
  const [revisionCarreras, setRevisionCarreras] = useState(0)
  const [carreraRecienImportada, setCarreraRecienImportada] = useState('')
  const [carrera, setCarrera] = useState(() => periodoInicial.carrera ?? leerPeriodoGuardado(emailUsuario, 'carrera', ''))
  const [anioLectivo, setAnioLectivo] = useState(() => String(periodoInicial.anio_lectivo ?? leerPeriodoGuardado(emailUsuario, 'anio_lectivo', new Date().getFullYear())))
  const [semestreLectivo, setSemestreLectivo] = useState(() => {
    if (periodoInicial.semestre_lectivo != null) return String(periodoInicial.semestre_lectivo)
    const guardado = leerPeriodoGuardado(emailUsuario, 'semestre_lectivo', null)
    if (guardado != null) return String(guardado)
    const talleres = leerTalleresGuardados(emailUsuario)
    return String(talleres.semestre ?? (new Date().getMonth() >= 6 ? 2 : 1))
  })
  const [planMaterias, setPlanMaterias] = useState([])
  const [bloquesOferta, setBloquesOferta] = useState([])
  const [respuestaAcademica, setRespuestaAcademica] = useState(null)
  const [materiasSeleccionadas, setMateriasSeleccionadas] = useState(estadoPlanInicial.materias)
  const [talleresSeleccionados, setTalleresSeleccionados] = useState(estadoPlanInicial.talleres)
  const [talleresGuardados] = useState(() => leerTalleresGuardados(emailUsuario))
  const [bloquesManualesGuardados, setBloquesManualesGuardados] = useState(() => leerBloquesManuales(emailUsuario))
  const [cargandoCarreras, setCargandoCarreras] = useState(true)
  const [cargandoPlan, setCargandoPlan] = useState(false)
  const [cargandoHorarios, setCargandoHorarios] = useState(false)
  const [errorCarreras, setErrorCarreras] = useState('')
  const [errorPlan, setErrorPlan] = useState('')
  const [errorHorarios, setErrorHorarios] = useState('')
  const [revisionHorarios, setRevisionHorarios] = useState(0)

  useEffect(() => {
    const alActualizar = (event) => {
      setCarreraRecienImportada(event.detail?.carrera ?? '')
      setRevisionCarreras((revision) => revision + 1)
    }
    window.addEventListener(EVENTO_CARRERAS_ACTUALIZADAS, alActualizar)
    return () => window.removeEventListener(EVENTO_CARRERAS_ACTUALIZADAS, alActualizar)
  }, [])

  useEffect(() => {
    let vigente = true
    apiFetch('/api/carreras', { cache: 'no-store' })
      .then(async (res) => {
        const json = await leerJson(res)
        if (!res.ok) throw new Error(json.error || 'No se pudieron cargar las carreras.')
        if (!vigente) return
        let disponibles = json.carreras ?? []
        if (carreraRecienImportada && !disponibles.some((item) => item.nombre === carreraRecienImportada)) {
          disponibles = [...disponibles, { nombre: carreraRecienImportada }].sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'))
        }
        setCarreras(disponibles)
        setCarrera((actual) => carreraRecienImportada || (disponibles.some((item) => item.nombre === actual) ? actual : disponibles[0]?.nombre || ''))
        setCargandoPlan(Boolean(disponibles.length))
        setCargandoHorarios(Boolean(disponibles.length))
        setErrorCarreras('')
      })
      .catch((error) => vigente && setErrorCarreras(error.message || 'No se pudieron cargar las carreras.'))
      .finally(() => vigente && setCargandoCarreras(false))
    return () => { vigente = false }
  }, [revisionCarreras, carreraRecienImportada])

  useEffect(() => {
    if (!carrera) return undefined
    let vigente = true
    apiFetch(`/api/plan?carrera=${encodeURIComponent(carrera)}`)
      .then(async (res) => {
        const json = await leerJson(res)
        if (!res.ok) throw new Error(json.error || 'No se pudo cargar el plan de esta carrera.')
        if (vigente) {
          setPlanMaterias(json.materias ?? [])
          setErrorPlan('')
        }
      })
      .catch((error) => vigente && setErrorPlan(error.message || 'No se pudo cargar el plan de esta carrera.'))
      .finally(() => vigente && setCargandoPlan(false))
    return () => { vigente = false }
  }, [carrera])

  useEffect(() => {
    if (!carrera || !emailUsuario) return undefined
    let vigente = true
    const clave = `${emailUsuario}|${carrera}`
    const query = new URLSearchParams({ carrera, email: emailUsuario })
    fetch(`/api/materias-habilitadas?${query}`)
      .then(async (res) => {
        const json = await leerJson(res)
        if (!res.ok) throw new Error(json.error || 'No se pudo cargar tu estado académico.')
        if (vigente) setRespuestaAcademica({ clave, estado: json, error: '' })
      })
      .catch((error) => vigente && setRespuestaAcademica({ clave, estado: null, error: error.message || 'No se pudo cargar tu estado académico.' }))
    return () => { vigente = false }
  }, [carrera, emailUsuario])

  useEffect(() => {
    if (!carrera || !anioLectivo || !semestreLectivo) return undefined
    let vigente = true
    const query = new URLSearchParams({
      carrera,
      anio_lectivo: anioLectivo,
      semestre_lectivo: semestreLectivo,
    })
    apiFetch(`/api/horarios?${query}`)
      .then(async (res) => {
        const json = await leerJson(res)
        if (!res.ok) throw new Error(json.error || 'No se pudieron cargar los horarios de este período.')
        if (vigente) {
          setBloquesOferta(json.bloques ?? [])
          setErrorHorarios('')
        }
      })
      .catch((error) => vigente && setErrorHorarios(error.message || 'No se pudieron cargar los horarios de este período.'))
      .finally(() => vigente && setCargandoHorarios(false))
    return () => { vigente = false }
  }, [carrera, anioLectivo, semestreLectivo, revisionHorarios])

  const horariosPorMateria = useMemo(() => agruparHorariosPorMateria(bloquesOferta), [bloquesOferta])
  const talleresOferta = useMemo(() => {
    if (talleresGuardados.por_periodo) {
      const clave = JSON.stringify([carrera, String(anioLectivo), String(semestreLectivo)])
      return talleresGuardados.por_periodo[clave] ?? []
    }
    if (talleresGuardados.carrera && talleresGuardados.carrera !== carrera) return []
    if (talleresGuardados.anio_lectivo && String(talleresGuardados.anio_lectivo) !== String(anioLectivo)) return []
    if (talleresGuardados.por_semestre) {
      return talleresGuardados.por_semestre[String(semestreLectivo)] ?? []
    }
    if (talleresGuardados.semestre && String(talleresGuardados.semestre) !== String(semestreLectivo)) return []
    return talleresGuardados.bloques ?? []
  }, [talleresGuardados, carrera, anioLectivo, semestreLectivo])
  const talleresDisponibles = useMemo(() => {
    const porNombre = new Map()
    talleresOferta.forEach((bloque) => {
      const nombre = String(bloque.nombre ?? bloque.taller ?? '').trim()
      const dia = DIAS_COMPLETOS_TALLER[bloque.dia] ?? bloque.dia
      const horaInicio = String(bloque.inicio ?? bloque.hora_inicio ?? '').slice(0, 5)
      const horaFin = String(bloque.fin ?? bloque.hora_fin ?? '').slice(0, 5)
      if (!nombre || !dia || !horaInicio || !horaFin) return
      if (!porNombre.has(nombre)) porNombre.set(nombre, { nombre, bloques: [] })
      porNombre.get(nombre).bloques.push({
        materia: nombre,
        grupo: 'Taller',
        dia,
        hora_inicio: horaInicio,
        hora_fin: horaFin,
        tipo: 'Taller',
      })
    })
    return [...porNombre.values()]
  }, [talleresOferta])
  const bloquesManuales = useMemo(
    () => bloquesManualesGuardados.por_periodo?.[clavePeriodo(carrera, anioLectivo, semestreLectivo)] ?? [],
    [bloquesManualesGuardados, carrera, anioLectivo, semestreLectivo]
  )
  const bloquesTalleresSeleccionados = useMemo(
    () => talleresDisponibles
      .filter(({ nombre }) => talleresSeleccionados[nombre])
      .flatMap(({ bloques }) => bloques),
    [talleresDisponibles, talleresSeleccionados]
  )
  const claveAcademica = `${emailUsuario ?? ''}|${carrera}`
  const respuestaAcademicaActual = respuestaAcademica?.clave === claveAcademica
  const estadoAcademico = respuestaAcademicaActual ? respuestaAcademica.estado : null
  const cargandoEstado = Boolean(carrera && emailUsuario && !respuestaAcademicaActual)
  const errorEstado = respuestaAcademicaActual ? respuestaAcademica.error : ''
  const materiasCandidatas = useMemo(
    () => {
      if (!estadoAcademico) return []
      const habilitadas = new Set(estadoAcademico.habilitadas)
      return obtenerMateriasCandidatas(planMaterias, horariosPorMateria)
        .filter(({ id }) => habilitadas.has(id))
    },
    [planMaterias, horariosPorMateria, estadoAcademico]
  )
  const materiasBloqueadas = useMemo(
    () => (estadoAcademico?.bloqueadas ?? [])
      .filter(({ nombre }) => horariosPorMateria[nombre]),
    [estadoAcademico, horariosPorMateria]
  )
  const materiasSinOferta = useMemo(
    () => obtenerMateriasSinOferta(planMaterias, horariosPorMateria),
    [planMaterias, horariosPorMateria]
  )
  const bloquesPorCelda = useMemo(() => {
    const porCelda = Object.create(null)
    for (const bloque of planificacion?.bloques ?? []) {
      const diaIndex = DIAS_COMPLETOS.indexOf(bloque.dia)
      const hora = Math.floor(minutosDesdeHora(bloque.hora_inicio) / 60)
      if (diaIndex < 0 || hora < 6 || hora >= 24) continue
      const clave = claveCelda(diaIndex, hora)
      porCelda[clave] ??= []
      porCelda[clave].push(bloque)
    }
    return porCelda
  }, [planificacion])
  const bloquesEnConflicto = useMemo(
    () => new Set((planificacion?.conflictos ?? []).flatMap(({ bloqueA, bloqueB }) => [bloqueA.id, bloqueB.id])),
    [planificacion]
  )
  const puedeGuardarPlan = Boolean(
    planificacion?.compatible
    && !planificacionPendiente
    && carrera
    && planificacion.bloques.some((bloque) => bloque.tipo !== 'Taller' && bloque.tipo !== 'Manual')
    && planificacion.bloques
      .filter((bloque) => bloque.tipo !== 'Taller' && bloque.tipo !== 'Manual')
      .every((bloque) => {
        const estado = materiasSeleccionadas[bloque.materia]
        return estado?.seleccionada && String(estado.grupo) === String(bloque.grupo)
      })
  )
  const errorDisponibilidad = [errorCarreras, errorPlan, errorHorarios, errorEstado].filter(Boolean).join(' ')

  useEffect(() => {
    if (!mostrarImportacionHorarios) return undefined
    const cerrarConEscape = (event) => {
      if (event.key === 'Escape') setMostrarImportacionHorarios(false)
    }
    window.addEventListener('keydown', cerrarConEscape)
    return () => window.removeEventListener('keydown', cerrarConEscape)
  }, [mostrarImportacionHorarios])

  useEffect(() => {
    if (!mostrarMaterias) return undefined
    const cerrarConEscape = (event) => {
      if (event.key === 'Escape') setMostrarMaterias(false)
    }
    window.addEventListener('keydown', cerrarConEscape)
    return () => window.removeEventListener('keydown', cerrarConEscape)
  }, [mostrarMaterias])

  useEffect(() => {
    if (!mostrarTalleres) return undefined
    const cerrarConEscape = (event) => {
      if (event.key === 'Escape') setMostrarTalleres(false)
    }
    window.addEventListener('keydown', cerrarConEscape)
    return () => window.removeEventListener('keydown', cerrarConEscape)
  }, [mostrarTalleres])

  useEffect(() => {
    if (!mostrarAgregarBloque) return undefined
    const cerrarConEscape = (event) => {
      if (event.key === 'Escape') setMostrarAgregarBloque(false)
    }
    window.addEventListener('keydown', cerrarConEscape)
    return () => window.removeEventListener('keydown', cerrarConEscape)
  }, [mostrarAgregarBloque])

  function invalidarPlanificacion() {
    setMensajeGuardar('')
    if (planificacion) {
      setPlanificacion(null)
      setPlanificacionPendiente(true)
    }
    setAlternativas(null)
    setAlternativasTruncadas(false)
    setAlternativaVista(null)
    setOpcionesSeleccionAutomatica([])
    setMensajeSeleccionAutomatica('')
    setMensajePlanificacion('')
  }

  function restaurarPlanPeriodo(carreraDestino, anioDestino, semestreDestino) {
    const estado = prepararPlanGuardado(
      leerPlanificacionPeriodo(emailUsuario, carreraDestino, anioDestino, semestreDestino)
    )
    setMateriasSeleccionadas(estado.materias)
    setTalleresSeleccionados(estado.talleres)
    setPlanificacion(estado.planificacion)
    setPlanificacionPendiente(false)
    setMensajePlanificacion('')
  }

  function guardarYEnviarACalendario() {
    if (!puedeGuardarPlan) return
    const periodo = clavePeriodo(carrera, anioLectivo, semestreLectivo)
    const bloques = [
      ...planificacion.bloques.filter((bloque) => bloque.tipo !== 'Manual'),
      ...bloquesManuales,
    ].map((bloque) => ({
        id: bloque.id,
        nombre: bloque.materia,
        dia: DIAS_CALENDARIO[bloque.dia] ?? bloque.dia,
        inicio: bloque.hora_inicio,
        fin: bloque.hora_fin,
        tipo: bloque.tipo === 'Taller' ? 'taller' : bloque.tipo === 'Manual' ? 'bloque' : 'clase',
        grupo: bloque.grupo,
        repeticion: bloque.repeticion,
        fecha_inicio: bloque.fecha_inicio,
      }))
    try {
      const clave = `kairo-planificaciones:${emailUsuario}`
      const guardado = JSON.parse(localStorage.getItem(clave) || 'null') ?? { por_periodo: {} }
      const siguiente = {
        ...guardado,
        activo: periodo,
        por_periodo: {
          ...(guardado.por_periodo ?? {}),
          [periodo]: {
            carrera,
            anio_lectivo: String(anioLectivo),
            semestre_lectivo: String(semestreLectivo),
            bloques,
            bloques_planificacion: planificacion.bloques,
            materias_seleccionadas: Object.fromEntries(
              Object.entries(materiasSeleccionadas)
                .filter(([, estado]) => estado.seleccionada)
                .map(([nombre, estado]) => [nombre, { seleccionada: true, grupo: estado.grupo }])
            ),
            talleres_seleccionados: Object.entries(talleresSeleccionados)
              .filter(([, seleccionado]) => seleccionado)
              .map(([nombre]) => nombre),
          },
        },
      }
      localStorage.setItem(clave, JSON.stringify(siguiente))
      setMensajeGuardar('Semestre guardado. Abriendo Calendario…')
      onIr?.('calendario')
    } catch {
      setMensajeGuardar('No se pudo guardar el semestre en este navegador.')
    }
  }

  function generarSeleccionAutomatica() {
    setMensajeSeleccionAutomatica('')
    const seleccionadas = Object.entries(materiasSeleccionadas)
      .filter(([, estado]) => estado.seleccionada)
    const gruposFijos = Object.fromEntries(seleccionadas.filter(([, estado]) => estado.grupo).map(([nombre, estado]) => [nombre, estado.grupo]))
    const pendientesObligatorias = new Set(seleccionadas.filter(([, estado]) => !estado.grupo).map(([nombre]) => nombre))
    const candidatasPorNombre = new Map(materiasCandidatas.map((materia) => [materia.id, materia]))
    if ([...pendientesObligatorias].some((nombre) => !candidatasPorNombre.has(nombre))) {
      setOpcionesSeleccionAutomatica([])
      setMensajeSeleccionAutomatica('Hay materias seleccionadas sin grupo que no tienen oferta habilitada en este período.')
      return
    }

    const bloquesFijos = [
      ...obtenerBloquesSeleccionados(materiasSeleccionadas, horariosPorMateria),
      ...bloquesTalleresSeleccionados,
      ...expandirBloquesManuales(bloquesManuales),
    ]
    if (!detectarConflictosHorario(bloquesFijos).compatible) {
      setOpcionesSeleccionAutomatica([])
      setMensajeSeleccionAutomatica('Los grupos, talleres o bloques actuales ya tienen conflictos. Ajustalos y recalculá.')
      return
    }

    const materiasPorAgregar = materiasCandidatas.filter(({ id }) => !Object.hasOwn(gruposFijos, id))
    if (!materiasPorAgregar.length) {
      setOpcionesSeleccionAutomatica([])
      setMensajeSeleccionAutomatica('Ya están seleccionadas todas las materias habilitadas con horarios disponibles.')
      return
    }

    let mejorCantidad = -1
    let nodos = 0
    const limiteNodos = 12000
    let mejores = []
    const gruposIniciales = { ...gruposFijos }

    function buscar(indice, grupos, bloques, cantidadAgregada) {
      nodos += 1
      if (nodos > limiteNodos || cantidadAgregada + materiasPorAgregar.length - indice < mejorCantidad) return
      if (indice === materiasPorAgregar.length) {
        if (pendientesObligatorias.size > 0 && [...pendientesObligatorias].some((nombre) => !grupos[nombre])) return
        if (cantidadAgregada === 0) return
        if (cantidadAgregada < mejorCantidad) return
        if (cantidadAgregada > mejorCantidad) {
          mejorCantidad = cantidadAgregada
          mejores = []
        }
        mejores.push({ grupos: { ...gruposIniciales, ...grupos }, bloques: [...bloques] })
        if (mejores.length >= 30) mejores = ordenarCombinacionesHorario(mejores).slice(0, 3)
        return
      }

      const materia = materiasPorAgregar[indice]
      const gruposMateria = Object.keys(materia.grupos)
        .sort((a, b) => a.localeCompare(b, 'es', { numeric: true, sensitivity: 'base' }))
      for (const grupo of gruposMateria) {
        const nuevosBloques = (horariosPorMateria[materia.id].grupos[grupo] ?? [])
          .map((bloque) => ({ ...bloque, materia: materia.id, grupo }))
        const bloquesParciales = [...bloques, ...nuevosBloques]
        if (detectarConflictosHorario(bloquesParciales).compatible) {
          buscar(indice + 1, { ...grupos, [materia.id]: grupo }, bloquesParciales, cantidadAgregada + 1)
        }
      }
      if (!pendientesObligatorias.has(materia.id)) buscar(indice + 1, grupos, bloques, cantidadAgregada)
    }

    buscar(0, {}, bloquesFijos, 0)
    setOpcionesSeleccionAutomatica(ordenarCombinacionesHorario(mejores).slice(0, 3))
    if (mejores.length === 0) {
      setMensajeSeleccionAutomatica('No encontré una combinación compatible con los bloques y materias seleccionados.')
    } else if (nodos > limiteNodos) {
      setMensajeSeleccionAutomatica('Mostrando las mejores opciones compatibles encontradas. Podés recalcular para buscar otras combinaciones.')
    }
  }

  function aceptarSeleccionAutomatica(opcion) {
    const siguientes = { ...materiasSeleccionadas }
    Object.entries(opcion.grupos).forEach(([materia, grupo]) => {
      siguientes[materia] = { seleccionada: true, grupo }
    })
    setMateriasSeleccionadas(siguientes)
    const resultado = detectarConflictosHorario(bloquesConIdentificadores(opcion.bloques))
    setPlanificacion({ bloques: bloquesConIdentificadores(opcion.bloques), ...resultado })
    setPlanificacionPendiente(false)
    setAlternativas(null)
    setAlternativasTruncadas(false)
    setMensajePlanificacion('Selección automática aplicada.')
    setOpcionesSeleccionAutomatica([])
    setMensajeSeleccionAutomatica('')
  }

  function bloquesTalleresPara(seleccion) {
    return talleresDisponibles
      .filter(({ nombre }) => seleccion[nombre])
      .flatMap(({ bloques }) => bloques)
  }

  function cambiarCarrera(valor) {
    invalidarPlanificacion()
    setCarrera(valor)
    setPlanMaterias([])
    setBloquesOferta([])
    restaurarPlanPeriodo(valor, anioLectivo, semestreLectivo)
    setErrorPlan('')
    setErrorHorarios('')
    setCargandoPlan(Boolean(valor))
    setCargandoHorarios(Boolean(valor && anioLectivo && semestreLectivo))
  }

  function cambiarPeriodo(campo, valor) {
    invalidarPlanificacion()
    const anioDestino = campo === 'anio' ? valor : anioLectivo
    const semestreDestino = campo === 'semestre' ? valor : semestreLectivo
    if (campo === 'anio') setAnioLectivo(valor)
    else setSemestreLectivo(valor)
    setBloquesOferta([])
    restaurarPlanPeriodo(carrera, anioDestino, semestreDestino)
    setErrorHorarios('')
    setCargandoHorarios(Boolean(carrera && valor))
  }

  function seleccionarMateria(nombre, seleccionada) {
    invalidarPlanificacion()
    const siguientes = { ...materiasSeleccionadas }
    if (seleccionada) siguientes[nombre] = { seleccionada: true, grupo: '' }
    else delete siguientes[nombre]
    setMateriasSeleccionadas(siguientes)
    actualizarPlanificacion(siguientes, bloquesTalleresSeleccionados, bloquesManuales)
  }

  function seleccionarGrupo(nombre, grupo) {
    invalidarPlanificacion()
    const siguientes = {
      ...materiasSeleccionadas,
      [nombre]: { seleccionada: true, grupo },
    }
    setMateriasSeleccionadas(siguientes)
    actualizarPlanificacion(siguientes, bloquesTalleresSeleccionados, bloquesManuales)
  }

  function seleccionarTaller(nombre, seleccionado) {
    invalidarPlanificacion()
    const siguientes = { ...talleresSeleccionados, [nombre]: seleccionado }
    setTalleresSeleccionados(siguientes)
    actualizarPlanificacion(materiasSeleccionadas, bloquesTalleresPara(siguientes), bloquesManuales)
  }

  function abrirAgregarBloque() {
    const fechaInicio = `${anioLectivo}-${String(semestreLectivo) === '2' ? '07' : '01'}-01`
    setBloqueManualNuevo({ nombre: '', dia: 'Lunes', hora_inicio: '08:00', hora_fin: '09:00', repeticion: 'semanal', fecha_inicio: fechaInicio })
    setErrorBloqueManual('')
    setMostrarAgregarBloque(true)
  }

  function guardarBloqueManual(event) {
    event.preventDefault()
    const nombre = bloqueManualNuevo.nombre.trim()
    if (!nombre) return setErrorBloqueManual('Ingresá el nombre del bloque.')
    if (!horaValida(bloqueManualNuevo.hora_inicio) || !horaValida(bloqueManualNuevo.hora_fin)
      || bloqueManualNuevo.hora_fin <= bloqueManualNuevo.hora_inicio) {
      return setErrorBloqueManual('La hora de fin debe ser posterior a la hora de inicio.')
    }
    if (!bloqueManualNuevo.fecha_inicio) return setErrorBloqueManual('Elegí la fecha de inicio de la repetición.')

    invalidarPlanificacion()
    const bloque = {
      id: nuevoIdBloqueManual(),
      materia: nombre,
      grupo: 'Manual',
      dia: bloqueManualNuevo.dia,
      hora_inicio: bloqueManualNuevo.hora_inicio,
      hora_fin: bloqueManualNuevo.hora_fin,
      tipo: 'Manual',
      repeticion: bloqueManualNuevo.repeticion,
      fecha_inicio: bloqueManualNuevo.fecha_inicio,
    }
    const key = clavePeriodo(carrera, anioLectivo, semestreLectivo)
    const siguientes = {
      ...bloquesManualesGuardados,
      por_periodo: {
        ...(bloquesManualesGuardados.por_periodo ?? {}),
        [key]: [...(bloquesManualesGuardados.por_periodo?.[key] ?? []), bloque],
      },
    }
    setBloquesManualesGuardados(siguientes)
    localStorage.setItem(`kairo-bloques-manuales:${emailUsuario}`, JSON.stringify(siguientes))
    setMostrarAgregarBloque(false)
    actualizarPlanificacion(materiasSeleccionadas, bloquesTalleresSeleccionados, siguientes.por_periodo[key])
  }

  function quitarBloqueManual(id) {
    invalidarPlanificacion()
    const key = clavePeriodo(carrera, anioLectivo, semestreLectivo)
    const siguientes = {
      ...bloquesManualesGuardados,
      por_periodo: {
        ...(bloquesManualesGuardados.por_periodo ?? {}),
        [key]: bloquesManuales.filter((bloque) => bloque.id !== id),
      },
    }
    setBloquesManualesGuardados(siguientes)
    localStorage.setItem(`kairo-bloques-manuales:${emailUsuario}`, JSON.stringify(siguientes))
    actualizarPlanificacion(materiasSeleccionadas, bloquesTalleresSeleccionados, siguientes.por_periodo[key])
  }

  function alImportarHorarios(resultado) {
    const carreraImportada = resultado?.carrera || carrera
    const anioImportado = resultado?.anio_lectivo || anioLectivo
    const semestreImportado = resultado?.semestre_lectivo || semestreLectivo

    invalidarPlanificacion()
    setMostrarImportacionHorarios(false)
    setCarrera(carreraImportada)
    setAnioLectivo(String(anioImportado))
    setSemestreLectivo(String(semestreImportado))
    setBloquesOferta(resultado?.bloques ?? [])
    setMateriasSeleccionadas({})
    setErrorHorarios('')
    setCargandoHorarios(Boolean(carreraImportada))
    setRevisionHorarios((revision) => revision + 1)
  }

  function actualizarPlanificacion(seleccion, bloquesTalleres, bloquesManualesPeriodo) {
    const seleccionadas = Object.entries(seleccion)
      .filter(([, estado]) => estado.seleccionada)

    if (seleccionadas.length === 0 && bloquesTalleres.length === 0 && bloquesManualesPeriodo.length === 0) {
      setPlanificacion(null)
      setPlanificacionPendiente(false)
      setAlternativas(null)
      setAlternativasTruncadas(false)
      setAlternativaVista(null)
      setMensajePlanificacion('')
      return
    }

    const faltanGrupos = seleccionadas.some(([, estado]) => !estado.grupo)
    setAlternativaVista(null)
    setAlternativasTruncadas(false)

    if (faltanGrupos) {
      const resultado = generarCombinacionesHorario(
        seleccion,
        horariosPorMateria,
        undefined,
        [...bloquesTalleres, ...expandirBloquesManuales(bloquesManualesPeriodo)],
      )
      setPlanificacionPendiente(false)
      if (resultado.combinaciones.length === 0) {
        setPlanificacion(null)
        setAlternativas([])
        setMensajePlanificacion('No existe una combinación sin superposiciones para las materias y talleres seleccionados.')
        return
      }
      const ordenadas = ordenarCombinacionesHorario(resultado.combinaciones)
      setAlternativas(ordenadas)
      setAlternativasTruncadas(resultado.truncado)
      setAlternativaVista(0)
      const bloquesSugeridos = bloquesConIdentificadores(ordenadas[0].bloques)
      setPlanificacion({ bloques: bloquesSugeridos, ...detectarConflictosHorario(bloquesSugeridos) })
      setMensajePlanificacion('')
      return
    }

    setAlternativas(null)
    setAlternativasTruncadas(false)
    const faltaOferta = seleccionadas.some(([materia, estado]) => (
      !(horariosPorMateria[materia]?.grupos?.[estado.grupo]?.length)
    ))
    if (faltaOferta) {
      setPlanificacion(null)
      setPlanificacionPendiente(false)
      setAlternativas(null)
      setMensajePlanificacion('No se encontraron bloques para uno o más grupos seleccionados. Revisá la oferta.')
      return
    }

    const bloques = [
      ...obtenerBloquesSeleccionados(seleccion, horariosPorMateria),
      ...bloquesTalleres,
      ...expandirBloquesManuales(bloquesManualesPeriodo),
    ]
      .map((bloque, indice) => ({ ...bloque, id: bloque.id ?? `${bloque.tipo ?? 'Clase'}-${bloque.materia}-${bloque.grupo ?? ''}-${indice}` }))
    const resultado = detectarConflictosHorario(bloques)
    setPlanificacion({ bloques, ...resultado })
    setPlanificacionPendiente(false)
    setMensajePlanificacion('')
  }

  function bloquesConIdentificadores(bloques) {
    return bloques.map((bloque, indice) => ({
      ...bloque,
      id: bloque.id ?? `${bloque.tipo ?? 'Clase'}-${bloque.materia}-${bloque.grupo ?? ''}-${indice}`,
    }))
  }

  function previsualizarAlternativa(alternativa, indice) {
    const bloques = bloquesConIdentificadores(alternativa.bloques)
    const resultado = detectarConflictosHorario(bloques)
    setPlanificacion({ bloques, ...resultado })
    setPlanificacionPendiente(false)
    setAlternativaVista(indice)
  }

  function elegirAlternativa(alternativa, indice) {
    const siguientes = { ...materiasSeleccionadas }
    Object.entries(alternativa.grupos).forEach(([materia, grupo]) => {
      siguientes[materia] = { seleccionada: true, grupo }
    })
    setMateriasSeleccionadas(siguientes)
    previsualizarAlternativa(alternativa, indice)
    setMensajePlanificacion('Opción elegida. Los grupos seleccionados ya están actualizados.')
  }

  return (
    <main className="plan-page">

      <section className="plan-card">

        <header className="plan-header">

          <div className="plan-header-text">

            <span className="plan-etiqueta">Planificación académica</span>

            <h1 className="plan-title">
              Planificador de horarios
            </h1>

            <p className="plan-subtitle">
              Ingresa los horarios disponibles de las materias
              y deja que el planificador te recomiende materias compatibles
            </p>

          </div>

          <div className="planificar-buttons">

            <button
              className="ingresar-horario-button"
              type="button"
              onClick={() => setMostrarImportacionHorarios(true)}
            >
              Ingresar horarios
            </button>

            <button
              className="seleccionar-materias-button"
              type="button"
              onClick={() => setMostrarMaterias(true)}
            >
              Seleccionar materias
            </button>

            <button
              className="seleccionar-talleres-button"
              type="button"
              onClick={() => setMostrarTalleres(true)}
              disabled={talleresDisponibles.length === 0}
            >
              Seleccionar talleres
            </button>

            <button
              className="seleccion-automatica-button"
              type="button"
              onClick={generarSeleccionAutomatica}
              disabled={cargandoCarreras || cargandoPlan || cargandoHorarios || cargandoEstado}
            >
              {opcionesSeleccionAutomatica.length ? 'Recalcular opciones' : 'Selección automática'}
            </button>

            <button
              className="agregar-bloque-button"
              type="button"
              onClick={abrirAgregarBloque}
            >
              Agregar bloque
            </button>

          </div>

        </header>

        <div className="plan-periodo-selector">
          <label>
            <span>Carrera</span>
            <select value={carrera} onChange={(event) => cambiarCarrera(event.target.value)} disabled={cargandoCarreras}>
              <option value="">Seleccionar carrera</option>
              {carreras.map((item) => <option key={item.nombre} value={item.nombre}>{item.nombre}</option>)}
            </select>
          </label>
          <label>
            <span>Año lectivo</span>
            <input type="number" min="1900" max="9999" value={anioLectivo} onChange={(event) => cambiarPeriodo('anio', event.target.value)} />
          </label>
          <label>
            <span>Semestre</span>
            <select value={semestreLectivo} onChange={(event) => cambiarPeriodo('semestre', event.target.value)}>
              <option value="1">1</option>
              <option value="2">2</option>
            </select>
          </label>
        </div>

        <section className="materias-resumen" aria-labelledby="materias-resumen-titulo">
          <h2 id="materias-resumen-titulo">Materias seleccionadas</h2>
          {Object.entries(materiasSeleccionadas).filter(([, estado]) => estado.seleccionada).length > 0 ? (
            <ul>
              {Object.entries(materiasSeleccionadas)
                .filter(([, estado]) => estado.seleccionada)
                .map(([nombre, estado]) => (
                  <li key={nombre}>{nombre} · Grupo {estado.grupo || 'pendiente'}</li>
                ))}
            </ul>
          ) : (
            <p>Todavía no seleccionaste materias.</p>
          )}
        </section>

        <section className="materias-resumen talleres-resumen" aria-labelledby="talleres-resumen-titulo">
          <h2 id="talleres-resumen-titulo">Talleres seleccionados</h2>
          {Object.entries(talleresSeleccionados).some(([, seleccionado]) => seleccionado) ? (
            <ul>
              {Object.entries(talleresSeleccionados)
                .filter(([, seleccionado]) => seleccionado)
                .map(([nombre]) => <li key={nombre}>{nombre} · Taller</li>)}
            </ul>
          ) : (
            <p>{talleresDisponibles.length ? 'Todavía no seleccionaste talleres.' : 'Cargá talleres desde la sección Cargas para poder seleccionarlos.'}</p>
          )}
        </section>

        <section className="materias-resumen bloques-manuales-resumen" aria-labelledby="bloques-manuales-titulo">
          <h2 id="bloques-manuales-titulo">Bloques agregados</h2>
          {bloquesManuales.length > 0 ? (
            <ul>
              {bloquesManuales.map((bloque) => (
                <li key={bloque.id}>
                  {bloque.materia} · {bloque.repeticion === 'diaria' ? 'Todos los días' : bloque.dia} {bloque.hora_inicio}–{bloque.hora_fin} · {etiquetaBloque(bloque)}
                  <button type="button" onClick={() => quitarBloqueManual(bloque.id)} aria-label={`Quitar ${bloque.materia}`}>
                    Quitar
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p>Todavía no agregaste bloques manuales.</p>
          )}
        </section>

        {(opcionesSeleccionAutomatica.length > 0 || mensajeSeleccionAutomatica) && (
          <section className="planificacion-alternativas seleccion-automatica-opciones" aria-labelledby="seleccion-automatica-titulo">
            <div className="seleccion-automatica-encabezado">
              <div>
                <h2 id="seleccion-automatica-titulo">Opciones de selección automática</h2>
                <p>Elegí una opción para aplicar sus materias y grupos. Se muestran hasta tres combinaciones compatibles.</p>
              </div>
              <button type="button" onClick={generarSeleccionAutomatica}>Recalcular</button>
            </div>
            {mensajeSeleccionAutomatica && <p className="seleccion-automatica-mensaje" role="status">{mensajeSeleccionAutomatica}</p>}
            {opcionesSeleccionAutomatica.length > 0 && (
              <ol>
                {opcionesSeleccionAutomatica.map((opcion, indice) => (
                  <li className={indice === 0 ? 'planificacion-alternativa-recomendada' : ''} key={JSON.stringify(opcion.grupos)}>
                    <h3>Opción {indice + 1}</h3>
                    {indice === 0 && <span className="planificacion-recomendada">Más materias compatibles</span>}
                    <ul>
                      {Object.entries(opcion.grupos).map(([materia, grupo]) => {
                        const horarios = opcion.bloques
                          .filter((bloque) => bloque.materia === materia && String(bloque.grupo) === String(grupo))
                          .map((bloque) => `${bloque.dia} ${bloque.hora_inicio}–${bloque.hora_fin}`)
                        return <li key={materia}><strong>{materia} · Grupo {grupo}</strong>{horarios.length > 0 && <span className="seleccion-automatica-horarios">{horarios.join(' · ')}</span>}</li>
                      })}
                    </ul>
                    <button className="seleccion-automatica-aplicar" type="button" onClick={() => aceptarSeleccionAutomatica(opcion)}>
                      Aceptar opción
                    </button>
                  </li>
                ))}
              </ol>
            )}
          </section>
        )}

        {alternativas?.length > 0 && (
          <section className="planificacion-alternativas" aria-labelledby="planificacion-alternativas-titulo">
            <h2 id="planificacion-alternativas-titulo">Combinaciones compatibles</h2>
            {alternativas.length > MAX_ALTERNATIVAS_VISIBLES && (
              <p>Se encontraron {alternativas.length} combinaciones compatibles. Mostrando las 10 mejores.</p>
            )}
            {alternativasTruncadas && (
              <p>La búsqueda alcanzó el límite interno de 5.000 combinaciones compatibles.</p>
            )}
            <ol>
              {alternativas.slice(0, MAX_ALTERNATIVAS_VISIBLES).map((alternativa, indice) => (
                <li className={indice === 0 ? 'planificacion-alternativa-recomendada' : ''} key={JSON.stringify(alternativa.grupos)}>
                  <h3>Opción {indice + 1}</h3>
                  {indice === 0 && <span className="planificacion-recomendada">Recomendada</span>}
                  <ul>
                    {Object.entries(alternativa.grupos).map(([materia, grupo]) => (
                      <li key={materia}>{materia} — Grupo {grupo}</li>
                    ))}
                    {[...new Set(alternativa.bloques.filter((bloque) => bloque.tipo === 'Taller').map((bloque) => bloque.materia))]
                      .map((nombre) => <li key={`taller-${nombre}`}>{nombre} · Taller</li>)}
                  </ul>
                  <div className="planificacion-metricas">
                    <span>{alternativa.metricas.minutos_hueco_total === 0
                      ? 'Sin huecos'
                      : `${formatearDuracion(alternativa.metricas.minutos_hueco_total)} de huecos`}</span>
                    <span>{alternativa.metricas.dias_con_clase} {alternativa.metricas.dias_con_clase === 1 ? 'día' : 'días'} de clase</span>
                    <span>Amplitud semanal: {formatearDuracion(alternativa.metricas.amplitud_total_minutos)}</span>
                  </div>
                  <div className="planificacion-alternativa-acciones">
                    <button
                      type="button"
                      aria-pressed={alternativaVista === indice}
                      onClick={() => previsualizarAlternativa(alternativa, indice)}
                    >
                      Ver horario
                    </button>
                    <button type="button" onClick={() => elegirAlternativa(alternativa, indice)}>
                      Elegir esta opción
                    </button>
                  </div>
                </li>
              ))}
            </ol>
          </section>
        )}

        <div className="planificacion-feedback" aria-live="polite">
          {planificacionPendiente && (
            <p className="planificacion-pendiente">Modificaste la selección. Volvé a planificar el horario.</p>
          )}
          {mensajePlanificacion && <p className="planificacion-error" role="alert">{mensajePlanificacion}</p>}
          {planificacion && (
            <>
              <p className={planificacion.compatible ? 'planificacion-compatible' : 'planificacion-conflicto'}>
                {planificacion.compatible ? '✓ Horario compatible' : '⚠ Se encontraron conflictos de horario'}
              </p>
              {planificacion.conflictos.length > 0 && (
                <ul className="planificacion-conflictos">
                  {planificacion.conflictos.map(({ bloqueA, bloqueB }, indice) => (
                    <li key={`${bloqueA.id}-${bloqueB.id}-${indice}`}>
                      <span><strong>{bloqueA.materia}</strong> · {etiquetaBloque(bloqueA)} · {bloqueA.dia} {bloqueA.hora_inicio}–{bloqueA.hora_fin}</span>
                      <span>se superpone con</span>
                      <span><strong>{bloqueB.materia}</strong> · {etiquetaBloque(bloqueB)} · {bloqueB.dia} {bloqueB.hora_inicio}–{bloqueB.hora_fin}</span>
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}
        </div>

        <div className="plan-grid-shell">

          <div className="plan-grid-wrapper">

            <div className="plan-grid">

              <div className="plan-cell plan-corner">
                Hora
              </div>

              {DIAS.map((dia) => (
                <div
                  key={dia}
                  className="plan-cell plan-day-head"
                >
                  <span className="plan-day-nombre">
                    {dia}
                  </span>
                </div>
              ))}


              {HORAS.map((hora) => (

                <div
                  className="plan-row"
                  key={hora}
                >

                  <div className="plan-cell plan-hora">
                    {`${String(hora).padStart(2, '0')}:00`}
                  </div>


                  {DIAS.map((_, diaIndex) => {

                    const clave =
                      claveCelda(diaIndex, hora)

                    const bloquesCelda = bloquesPorCelda[clave] ?? []

                    return (

                      <div
                        key={clave}
                        className="plan-cell plan-slot"

                      >

                        {bloquesCelda.length > 0 ? (
                          bloquesCelda.map((bloque) => {
                            const inicio = minutosDesdeHora(bloque.hora_inicio)
                            const fin = minutosDesdeHora(bloque.hora_fin)
                            const top = ((inicio % 60) / 60) * ALTURA_HORA
                            const altura = ((fin - inicio) / 60) * ALTURA_HORA
                            return (
                              <article
                                key={bloque.id}
                                className={`plan-event${bloque.tipo === 'Taller' ? ' plan-event--taller' : ''}${bloque.tipo === 'Manual' ? ' plan-event--manual' : ''}${bloquesEnConflicto.has(bloque.id) ? ' plan-event--conflict' : ''}`}
                                style={{ '--bloque-top': `${top}px`, '--bloque-altura': `${altura}px` }}
                                title={`${bloque.materia} - ${etiquetaBloque(bloque)} - ${bloque.hora_inicio}-${bloque.hora_fin}${bloque.fecha_inicio ? ` - Desde ${bloque.fecha_inicio}` : ''}`}
                              >
                                <strong>{bloque.materia}</strong>
                                <span>{etiquetaBloque(bloque)}</span>
                                <small>{bloque.hora_inicio}-{bloque.hora_fin}</small>
                              </article>
                            )
                          })
                        ) : (
                          <span
                            className="plan-slot-mas"
                            aria-hidden="true"
                          >
                            +
                          </span>
                        )}

                      </div>
                    )
                  })}

                </div>
              ))}

            </div>

          </div>

        </div>

        <footer className="plan-guardar-footer">
          <div aria-live="polite">
            {mensajeGuardar && <p role="status">{mensajeGuardar}</p>}
          </div>
          <button type="button" onClick={guardarYEnviarACalendario} disabled={!puedeGuardarPlan}>
            Guardar y mandar a Calendario
          </button>
        </footer>

      </section>

      {mostrarImportacionHorarios && (
        <div
          className="horarios-import-modal-overlay"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setMostrarImportacionHorarios(false)
          }}
        >
          <section className="horarios-import-modal" role="dialog" aria-modal="true" aria-labelledby="horarios-import-title">
            <header className="horarios-import-modal-header">
              <h2 id="horarios-import-title">Ingresar horarios</h2>
              <button
                type="button"
                className="horarios-import-modal-close"
                aria-label="Cerrar importación de horarios"
                onClick={() => setMostrarImportacionHorarios(false)}
              >
                ×
              </button>
            </header>
            <div className="horarios-import-modal-body">
              <ScheduleImportPanel
                onImported={alImportarHorarios}
                carrerasDisponibles={carreras}
                carreraInicial={carrera}
                anioInicial={anioLectivo}
                semestreInicial={semestreLectivo}
                consultarHorariosExistentes={false}
              />
            </div>
            <footer className="horarios-import-modal-footer">
              <button type="button" onClick={() => setMostrarImportacionHorarios(false)}>Cancelar</button>
            </footer>
          </section>
        </div>
      )}

      {mostrarMaterias && (
        <div
          className="materias-modal-overlay"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setMostrarMaterias(false)
          }}
        >
          <section className="materias-modal" role="dialog" aria-modal="true" aria-labelledby="materias-modal-titulo">
            <header className="materias-modal-header">
              <h2 id="materias-modal-titulo">Seleccionar materias</h2>
              <button
                type="button"
                className="materias-modal-close"
                aria-label="Cerrar selección de materias"
                onClick={() => setMostrarMaterias(false)}
              >
                ×
              </button>
            </header>
            <div className="materias-modal-body">
              <MateriasDisponibles
                materias={materiasCandidatas}
                materiasSinOferta={materiasSinOferta}
                materiasBloqueadas={materiasBloqueadas}
                seleccionadas={materiasSeleccionadas}
                cargando={cargandoCarreras || cargandoPlan || cargandoHorarios || cargandoEstado}
                error={errorDisponibilidad}
                carrera={carrera}
                onSeleccionar={seleccionarMateria}
                onSeleccionarGrupo={seleccionarGrupo}
              />
            </div>
            <footer className="materias-modal-footer">
              <button type="button" className="materias-modal-cancelar" onClick={() => setMostrarMaterias(false)}>Cancelar</button>
              <button type="button" className="materias-modal-aplicar" onClick={() => setMostrarMaterias(false)}>Aplicar selección</button>
            </footer>
          </section>
        </div>
      )}

      {mostrarTalleres && (
        <div
          className="materias-modal-overlay"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setMostrarTalleres(false)
          }}
        >
          <section className="materias-modal" role="dialog" aria-modal="true" aria-labelledby="talleres-modal-titulo">
            <header className="materias-modal-header">
              <h2 id="talleres-modal-titulo">Seleccionar talleres</h2>
              <button
                type="button"
                className="materias-modal-close"
                aria-label="Cerrar selección de talleres"
                onClick={() => setMostrarTalleres(false)}
              >
                ×
              </button>
            </header>
            <div className="materias-modal-body">
              {talleresDisponibles.length === 0 ? (
                <p className="materias-disponibles-vacio">No hay talleres cargados. Subilos desde Cargas.</p>
              ) : (
                <ul className="talleres-disponibles-lista">
                  {talleresDisponibles.map(({ nombre, bloques }) => (
                    <li key={nombre}>
                      <label>
                        <input
                          type="checkbox"
                          checked={Boolean(talleresSeleccionados[nombre])}
                          onChange={(event) => seleccionarTaller(nombre, event.target.checked)}
                        />
                        <span className="taller-disponible-detalle">
                          <strong>{nombre}</strong>
                          <small>{bloques.map((bloque) => `${bloque.dia} ${bloque.hora_inicio}–${bloque.hora_fin}`).join(' · ')}</small>
                        </span>
                      </label>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <footer className="materias-modal-footer">
              <button type="button" className="materias-modal-cancelar" onClick={() => setMostrarTalleres(false)}>Cancelar</button>
              <button type="button" className="materias-modal-aplicar" onClick={() => setMostrarTalleres(false)}>Aplicar selección</button>
            </footer>
          </section>
        </div>
      )}

      {mostrarAgregarBloque && (
        <div
          className="materias-modal-overlay"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setMostrarAgregarBloque(false)
          }}
        >
          <section className="materias-modal bloque-manual-modal" role="dialog" aria-modal="true" aria-labelledby="bloque-manual-titulo">
            <header className="materias-modal-header">
              <h2 id="bloque-manual-titulo">Agregar bloque</h2>
              <button type="button" className="materias-modal-close" aria-label="Cerrar" onClick={() => setMostrarAgregarBloque(false)}>×</button>
            </header>
            <form onSubmit={guardarBloqueManual}>
              <div className="materias-modal-body bloque-manual-form">
                <label>
                  <span>Nombre</span>
                  <input autoFocus value={bloqueManualNuevo.nombre} onChange={(event) => setBloqueManualNuevo((actual) => ({ ...actual, nombre: event.target.value }))} placeholder="Ej. Trabajo, estudio, consulta" />
                </label>
                <label>
                  <span>Repetición</span>
                  <select value={bloqueManualNuevo.repeticion} onChange={(event) => setBloqueManualNuevo((actual) => ({ ...actual, repeticion: event.target.value }))}>
                    {Object.entries(REPETICIONES_BLOQUE).map(([valor, etiqueta]) => <option key={valor} value={valor}>{etiqueta}</option>)}
                  </select>
                </label>
                {bloqueManualNuevo.repeticion !== 'diaria' && (
                  <label>
                    <span>Día</span>
                    <select value={bloqueManualNuevo.dia} onChange={(event) => setBloqueManualNuevo((actual) => ({ ...actual, dia: event.target.value }))}>
                      {DIAS_COMPLETOS.map((dia) => <option key={dia} value={dia}>{dia}</option>)}
                    </select>
                  </label>
                )}
                <div className="bloque-manual-horas">
                  <label>
                    <span>Hora de inicio</span>
                    <input type="time" value={bloqueManualNuevo.hora_inicio} onChange={(event) => setBloqueManualNuevo((actual) => ({ ...actual, hora_inicio: event.target.value }))} />
                  </label>
                  <label>
                    <span>Hora de fin</span>
                    <input type="time" value={bloqueManualNuevo.hora_fin} onChange={(event) => setBloqueManualNuevo((actual) => ({ ...actual, hora_fin: event.target.value }))} />
                  </label>
                </div>
                <label>
                  <span>Fecha de inicio</span>
                  <input type="date" value={bloqueManualNuevo.fecha_inicio} onChange={(event) => setBloqueManualNuevo((actual) => ({ ...actual, fecha_inicio: event.target.value }))} />
                </label>
                <p className="bloque-manual-ayuda">El bloque ocupa ese día y horario en la grilla. La fecha y la repetición indican desde cuándo y con qué frecuencia ocurre.</p>
                {errorBloqueManual && <p className="bloque-manual-error" role="alert">{errorBloqueManual}</p>}
              </div>
              <footer className="materias-modal-footer">
                <button type="button" className="materias-modal-cancelar" onClick={() => setMostrarAgregarBloque(false)}>Cancelar</button>
                <button type="submit" className="materias-modal-aplicar">Agregar bloque</button>
              </footer>
            </form>
          </section>
        </div>
      )}

    </main>
  )
}

export default PlanPage
