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

function clavePeriodo(carrera, anio, semestre) {
  return JSON.stringify([carrera, String(anio), String(semestre)])
}

function horaValida(hora) {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(hora)
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

function PlanPage({ emailUsuario }) {
  const [mostrarImportacionHorarios, setMostrarImportacionHorarios] = useState(false)
  const [mostrarMaterias, setMostrarMaterias] = useState(false)
  const [mostrarTalleres, setMostrarTalleres] = useState(false)
  const [mostrarAgregarBloque, setMostrarAgregarBloque] = useState(false)
  const [errorBloqueManual, setErrorBloqueManual] = useState('')
  const [bloqueManualNuevo, setBloqueManualNuevo] = useState({ nombre: '', dia: 'Lunes', hora_inicio: '08:00', hora_fin: '09:00', repeticion: 'semanal', fecha_inicio: '' })
  const [planificacion, setPlanificacion] = useState(null)
  const [planificacionPendiente, setPlanificacionPendiente] = useState(false)
  const [alternativas, setAlternativas] = useState(null)
  const [alternativasTruncadas, setAlternativasTruncadas] = useState(false)
  const [alternativaVista, setAlternativaVista] = useState(null)
  const [mensajePlanificacion, setMensajePlanificacion] = useState('')
  const [carreras, setCarreras] = useState([])
  const [revisionCarreras, setRevisionCarreras] = useState(0)
  const [carreraRecienImportada, setCarreraRecienImportada] = useState('')
  const [carrera, setCarrera] = useState(() => leerPeriodoGuardado(emailUsuario, 'carrera', ''))
  const [anioLectivo, setAnioLectivo] = useState(() => String(leerPeriodoGuardado(emailUsuario, 'anio_lectivo', new Date().getFullYear())))
  const [semestreLectivo, setSemestreLectivo] = useState(() => {
    const guardado = leerPeriodoGuardado(emailUsuario, 'semestre_lectivo', null)
    if (guardado != null) return String(guardado)
    const talleres = leerTalleresGuardados(emailUsuario)
    return String(talleres.semestre ?? (new Date().getMonth() >= 6 ? 2 : 1))
  })
  const [planMaterias, setPlanMaterias] = useState([])
  const [bloquesOferta, setBloquesOferta] = useState([])
  const [respuestaAcademica, setRespuestaAcademica] = useState(null)
  const [materiasSeleccionadas, setMateriasSeleccionadas] = useState({})
  const [talleresSeleccionados, setTalleresSeleccionados] = useState({})
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
    if (planificacion) {
      setPlanificacion(null)
      setPlanificacionPendiente(true)
    }
    setAlternativas(null)
    setAlternativasTruncadas(false)
    setAlternativaVista(null)
    setMensajePlanificacion('')
  }

  function cambiarCarrera(valor) {
    invalidarPlanificacion()
    setCarrera(valor)
    setPlanMaterias([])
    setBloquesOferta([])
    setMateriasSeleccionadas({})
    setTalleresSeleccionados({})
    setErrorPlan('')
    setErrorHorarios('')
    setCargandoPlan(Boolean(valor))
    setCargandoHorarios(Boolean(valor && anioLectivo && semestreLectivo))
  }

  function cambiarPeriodo(campo, valor) {
    invalidarPlanificacion()
    if (campo === 'anio') setAnioLectivo(valor)
    else setSemestreLectivo(valor)
    setTalleresSeleccionados({})
    setBloquesOferta([])
    setMateriasSeleccionadas({})
    setErrorHorarios('')
    setCargandoHorarios(Boolean(carrera && valor))
  }

  function seleccionarMateria(nombre, seleccionada) {
    invalidarPlanificacion()
    setMateriasSeleccionadas((actuales) => {
      const siguientes = { ...actuales }
      if (seleccionada) siguientes[nombre] = { seleccionada: true, grupo: '' }
      else delete siguientes[nombre]
      return siguientes
    })
  }

  function seleccionarGrupo(nombre, grupo) {
    invalidarPlanificacion()
    setMateriasSeleccionadas((actuales) => ({
      ...actuales,
      [nombre]: { seleccionada: true, grupo },
    }))
  }

  function seleccionarTaller(nombre, seleccionado) {
    invalidarPlanificacion()
    setTalleresSeleccionados((actuales) => ({ ...actuales, [nombre]: seleccionado }))
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
      id: `manual-${Date.now()}`,
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
    setMensajePlanificacion('Bloque agregado al horario.')
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

  function planificarHorario() {
    const seleccionadas = Object.entries(materiasSeleccionadas)
      .filter(([, estado]) => estado.seleccionada)

    if (seleccionadas.length === 0 && bloquesTalleresSeleccionados.length === 0 && bloquesManuales.length === 0) {
      setMensajePlanificacion('Seleccioná una materia, un taller o agregá un bloque manual para planificar.')
      return
    }

    const faltanGrupos = seleccionadas.some(([, estado]) => !estado.grupo)
    setAlternativaVista(null)
    setAlternativasTruncadas(false)

    if (faltanGrupos) {
      const resultado = generarCombinacionesHorario(
        materiasSeleccionadas,
        horariosPorMateria,
        undefined,
        [...bloquesTalleresSeleccionados, ...expandirBloquesManuales(bloquesManuales)],
      )
      setPlanificacion(null)
      setPlanificacionPendiente(false)
      if (resultado.combinaciones.length === 0) {
        setAlternativas([])
        setMensajePlanificacion('No existe una combinación sin superposiciones para las materias y talleres seleccionados.')
        return
      }
      setAlternativas(ordenarCombinacionesHorario(resultado.combinaciones))
      setAlternativasTruncadas(resultado.truncado)
      setMensajePlanificacion('')
      return
    }

    setAlternativas(null)
    setAlternativasTruncadas(false)
    const faltaOferta = seleccionadas.some(([materia, estado]) => (
      !(horariosPorMateria[materia]?.grupos?.[estado.grupo]?.length)
    ))
    if (faltaOferta) {
      setMensajePlanificacion('No se encontraron bloques para uno o más grupos seleccionados. Revisá la oferta.')
      return
    }

    const bloques = [
      ...obtenerBloquesSeleccionados(materiasSeleccionadas, horariosPorMateria),
      ...bloquesTalleresSeleccionados,
      ...expandirBloquesManuales(bloquesManuales),
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
              className="planificar-horario-button"
              type="button"
              onClick={planificarHorario}
            >
              Planificar horario
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
