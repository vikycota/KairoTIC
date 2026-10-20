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

const DIAS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']
const DIAS_COMPLETOS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo']
const ALTURA_HORA = 44
const MAX_ALTERNATIVAS_VISIBLES = 10

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

function PlanPage({ emailUsuario }) {
  const [mostrarImportacionHorarios, setMostrarImportacionHorarios] = useState(false)
  const [planificacion, setPlanificacion] = useState(null)
  const [planificacionPendiente, setPlanificacionPendiente] = useState(false)
  const [alternativas, setAlternativas] = useState(null)
  const [alternativasTruncadas, setAlternativasTruncadas] = useState(false)
  const [alternativaVista, setAlternativaVista] = useState(null)
  const [mensajePlanificacion, setMensajePlanificacion] = useState('')
  const [carreras, setCarreras] = useState([])
  const [carrera, setCarrera] = useState('')
  const [anioLectivo, setAnioLectivo] = useState(String(new Date().getFullYear()))
  const [semestreLectivo, setSemestreLectivo] = useState(String(new Date().getMonth() >= 6 ? 2 : 1))
  const [planMaterias, setPlanMaterias] = useState([])
  const [bloquesOferta, setBloquesOferta] = useState([])
  const [respuestaAcademica, setRespuestaAcademica] = useState(null)
  const [materiasSeleccionadas, setMateriasSeleccionadas] = useState({})
  const [cargandoCarreras, setCargandoCarreras] = useState(true)
  const [cargandoPlan, setCargandoPlan] = useState(false)
  const [cargandoHorarios, setCargandoHorarios] = useState(false)
  const [errorCarreras, setErrorCarreras] = useState('')
  const [errorPlan, setErrorPlan] = useState('')
  const [errorHorarios, setErrorHorarios] = useState('')
  const [revisionHorarios, setRevisionHorarios] = useState(0)

  useEffect(() => {
    let vigente = true
    fetch('/api/carreras')
      .then(async (res) => {
        const json = await leerJson(res)
        if (!res.ok) throw new Error(json.error || 'No se pudieron cargar las carreras.')
        if (!vigente) return
        const disponibles = json.carreras ?? []
        setCarreras(disponibles)
        setCarrera((actual) => actual || disponibles[0]?.nombre || '')
        setCargandoPlan(Boolean(disponibles.length))
        setCargandoHorarios(Boolean(disponibles.length))
        setErrorCarreras('')
      })
      .catch((error) => vigente && setErrorCarreras(error.message || 'No se pudieron cargar las carreras.'))
      .finally(() => vigente && setCargandoCarreras(false))
    return () => { vigente = false }
  }, [])

  useEffect(() => {
    if (!carrera) return undefined
    let vigente = true
    fetch(`/api/plan?carrera=${encodeURIComponent(carrera)}`)
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
    fetch(`/api/horarios?${query}`)
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
    setErrorPlan('')
    setErrorHorarios('')
    setCargandoPlan(Boolean(valor))
    setCargandoHorarios(Boolean(valor && anioLectivo && semestreLectivo))
  }

  function cambiarPeriodo(campo, valor) {
    invalidarPlanificacion()
    if (campo === 'anio') setAnioLectivo(valor)
    else setSemestreLectivo(valor)
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

  function alImportarHorarios() {
    invalidarPlanificacion()
    setMostrarImportacionHorarios(false)
    setBloquesOferta([])
    setMateriasSeleccionadas({})
    setErrorHorarios('')
    setCargandoHorarios(Boolean(carrera))
    setRevisionHorarios((revision) => revision + 1)
  }

  function planificarHorario() {
    const seleccionadas = Object.entries(materiasSeleccionadas)
      .filter(([, estado]) => estado.seleccionada)

    if (seleccionadas.length === 0) {
      setMensajePlanificacion('Seleccioná al menos una materia para planificar.')
      return
    }

    const faltanGrupos = seleccionadas.some(([, estado]) => !estado.grupo)
    setAlternativaVista(null)
    setAlternativasTruncadas(false)

    if (faltanGrupos) {
      const resultado = generarCombinacionesHorario(materiasSeleccionadas, horariosPorMateria)
      setPlanificacion(null)
      setPlanificacionPendiente(false)
      if (resultado.combinaciones.length === 0) {
        setAlternativas([])
        setMensajePlanificacion('No existe una combinación de grupos sin superposiciones para las materias seleccionadas.')
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

    const bloques = obtenerBloquesSeleccionados(materiasSeleccionadas, horariosPorMateria)
      .map((bloque, indice) => ({ ...bloque, id: `${bloque.materia}-${bloque.grupo}-${indice}` }))
    const resultado = detectarConflictosHorario(bloques)
    setPlanificacion({ bloques, ...resultado })
    setPlanificacionPendiente(false)
    setMensajePlanificacion('')
  }

  function bloquesConIdentificadores(bloques) {
    return bloques.map((bloque, indice) => ({
      ...bloque,
      id: `${bloque.materia}-${bloque.grupo}-${indice}`,
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
              className="planificar-horario-button"
              type="button"
              onClick={planificarHorario}
            >
              Planificar horario
            </button>

            <button
              className="agregar-bloque-button"
              type="button"
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
                      <span><strong>{bloqueA.materia}</strong> · Grupo {bloqueA.grupo} · {bloqueA.dia} {bloqueA.hora_inicio}–{bloqueA.hora_fin}</span>
                      <span>se superpone con</span>
                      <span><strong>{bloqueB.materia}</strong> · Grupo {bloqueB.grupo} · {bloqueB.dia} {bloqueB.hora_inicio}–{bloqueB.hora_fin}</span>
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
                                className={`plan-event${bloquesEnConflicto.has(bloque.id) ? ' plan-event--conflict' : ''}`}
                                style={{ '--bloque-top': `${top}px`, '--bloque-altura': `${altura}px` }}
                                title={`${bloque.materia} - Grupo ${bloque.grupo} - ${bloque.hora_inicio}-${bloque.hora_fin}`}
                              >
                                <strong>{bloque.materia}</strong>
                                <span>Grupo {bloque.grupo}</span>
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

    </main>
  )
}

export default PlanPage
