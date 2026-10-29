import { useEffect, useMemo, useState } from 'react'
import { useContador } from '../useContador'
import { apiFetch } from '../api'
import { calcularCostoSeleccion, crearConfigCosto, etiquetaSemestre, formatearMonto } from './costosSemestre'
import '../pagesCSS/Calendario.css'
import '../pagesCSS/CalendarioPago.css'

const DIAS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']
const DIAS_LARGOS = ['lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado', 'domingo']
const PX_HORA = 56
const TIPOS = {
  clase: { etiqueta: 'Clases', singular: 'Clase' },
  taller: { etiqueta: 'Talleres', singular: 'Taller' },
  bloque: { etiqueta: 'Bloques', singular: 'Bloque personal' },
  personal: { etiqueta: 'Personal', singular: 'Evento personal' },
}

/* ---------- utilidades de tiempo ---------- */

const aMin = (hhmm) => {
  const [h, m] = hhmm.split(':').map(Number)
  return h * 60 + m
}

const aHHMM = (min) => `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`

function bloqueOcurreEnFecha(bloque, fecha) {
  const inicio = new Date(`${bloque.fecha_inicio || '1900-01-01'}T00:00:00`)
  const fechaActual = new Date(fecha)
  inicio.setHours(0, 0, 0, 0)
  fechaActual.setHours(0, 0, 0, 0)
  if (fechaActual < inicio) return false
  if (bloque.repeticion === 'diaria') return true

  const diaObjetivo = DIAS.indexOf(bloque.dia)
  if (diaObjetivo < 0 || (fechaActual.getDay() + 6) % 7 !== diaObjetivo) return false
  if (bloque.repeticion === 'quincenal') {
    const lunesInicio = new Date(inicio)
    lunesInicio.setDate(inicio.getDate() - (inicio.getDay() + 6) % 7)
    const lunesActual = new Date(fechaActual)
    lunesActual.setDate(fechaActual.getDate() - (fechaActual.getDay() + 6) % 7)
    const semanas = Math.round((Date.UTC(lunesActual.getFullYear(), lunesActual.getMonth(), lunesActual.getDate())
      - Date.UTC(lunesInicio.getFullYear(), lunesInicio.getMonth(), lunesInicio.getDate())) / 604800000)
    return semanas % 2 === 0
  }
  if (bloque.repeticion === 'mensual' || bloque.repeticion === 'alternado') {
    const meses = (fechaActual.getFullYear() - inicio.getFullYear()) * 12 + fechaActual.getMonth() - inicio.getMonth()
    if (bloque.repeticion === 'alternado' && meses % 2 !== 0) return false
    const primeroDelMes = new Date(fechaActual.getFullYear(), fechaActual.getMonth(), 1)
    const diaPrimero = (primeroDelMes.getDay() + 6) % 7
    const primerDiaElegido = 1 + (diaObjetivo - diaPrimero + 7) % 7
    return fechaActual.getDate() === primerDiaElegido
  }
  return true
}

function etiquetaRepeticion(repeticion) {
  return ({
    diaria: 'Todos los días',
    semanal: 'Cada semana',
    quincenal: 'Cada dos semanas',
    mensual: 'Una vez al mes',
    alternado: 'Mes sí, mes no',
  })[repeticion] ?? 'Bloque recurrente'
}

function aISO(fecha) {
  const mes = String(fecha.getMonth() + 1).padStart(2, '0')
  const dia = String(fecha.getDate()).padStart(2, '0')
  return `${fecha.getFullYear()}-${mes}-${dia}`
}

function lunesDeSemana(offset) {
  const hoy = new Date()
  const dia = (hoy.getDay() + 6) % 7 // 0 = lunes
  const lunes = new Date(hoy)
  lunes.setDate(hoy.getDate() - dia + offset * 7)
  lunes.setHours(0, 0, 0, 0)
  return lunes
}

function formatearRango(lunes) {
  const domingo = new Date(lunes)
  domingo.setDate(lunes.getDate() + 6)
  const opciones = { day: 'numeric', month: 'long' }
  const inicio = lunes.toLocaleDateString('es-UY', opciones)
  const fin = domingo.toLocaleDateString('es-UY', { ...opciones, year: 'numeric' })
  return `${inicio} – ${fin}`
}

/* ---------- datos guardados (por cuenta) ---------- */

function leerStorage(clave) {
  try {
    return JSON.parse(localStorage.getItem(clave))
  } catch {
    return null
  }
}

function guardarStorage(clave, valor) {
  try {
    localStorage.setItem(clave, JSON.stringify(valor))
  } catch { /* sin almacenamiento: los eventos duran hasta recargar */ }
}

/** Reparte en carriles los eventos que se superponen para que se vean lado a lado. */
function distribuir(eventos) {
  const orden = [...eventos].sort((a, b) => a.ini - b.ini || b.fin - a.fin)
  const resultado = []
  let grupo = []
  let carriles = []
  let finGrupo = -1

  const cerrar = () => {
    for (const e of grupo) resultado.push({ ...e, carriles: carriles.length })
    grupo = []
    carriles = []
  }

  for (const e of orden) {
    if (grupo.length && e.ini >= finGrupo) cerrar()
    let carril = carriles.findIndex((fin) => fin <= e.ini)
    if (carril === -1) {
      carril = carriles.length
      carriles.push(e.fin)
    } else {
      carriles[carril] = e.fin
    }
    grupo.push({ ...e, carril })
    finGrupo = Math.max(finGrupo, e.fin)
  }
  cerrar()
  return resultado
}

function Dato({ valor, etiqueta }) {
  const n = useContador(valor)
  return (
    <div className="cal-dato">
      <strong>{n}</strong>
      <span>{etiqueta}</span>
    </div>
  )
}

function WeeklyPlanner({ emailUsuario, onIr }) {
  const claveEventos = `kairo-eventos:${emailUsuario}`
  const [semana, setSemana] = useState(0)
  const [personales, setPersonales] = useState(() => leerStorage(claveEventos)?.eventos ?? [])
  const [filtros, setFiltros] = useState({ clase: true, taller: true, bloque: true, personal: true })
  const [panel, setPanel] = useState(null)       // { tipo: 'ver', evento } | { tipo: 'form', borrador }
  const [error, setError] = useState('')
  const [ahora, setAhora] = useState(() => new Date())
  const [pagoMensual, setPagoMensual] = useState(null)
  const [cargandoPago, setCargandoPago] = useState(false)
  const [revisionPlan, setRevisionPlan] = useState(0)
  useEffect(() => {
    const actualizarPlan = () => setRevisionPlan((revision) => revision + 1)
    window.addEventListener('kairo-planificacion-actualizada', actualizarPlan)
    return () => window.removeEventListener('kairo-planificacion-actualizada', actualizarPlan)
  }, [])

  // El último plan guardado se muestra en el calendario; si no existe, se usan las cargas.
  const planGuardado = useMemo(() => {
    const guardado = leerStorage(`kairo-planificaciones:${emailUsuario}`)
    return guardado?.por_periodo?.[guardado.activo] ?? null
  }, [emailUsuario, revisionPlan])
  useEffect(() => {
    if (!emailUsuario || !planGuardado) {
      setPagoMensual(null)
      setCargandoPago(false)
      return undefined
    }
    let vigente = true
    setCargandoPago(true)
    const semestre = etiquetaSemestre(planGuardado.anio_lectivo, planGuardado.semestre_lectivo)
    const consultaGastos = semestre
      ? apiFetch(`/api/gastos-extra?semestre=${semestre}`).then((res) => (res.ok ? res.json() : null)).catch(() => null)
      : Promise.resolve(null)
    Promise.all([
      apiFetch('/api/presupuesto').then((res) => (res.ok ? res.json() : null)).catch(() => null),
      consultaGastos,
    ]).then(([presupuesto, gastos]) => {
      if (!vigente) return
      const seleccionadas = planGuardado.materias_seleccionadas
        ? Object.entries(planGuardado.materias_seleccionadas).filter(([, estado]) => estado?.seleccionada).map(([nombre]) => nombre)
        : [...new Set((planGuardado.bloques ?? []).filter((bloque) => bloque.tipo === 'clase').map((bloque) => bloque.nombre))]
      const creditosPorMateria = new Map(Object.entries(planGuardado.creditos_materias ?? {}).map(([nombre, creditos]) => [nombre.trim(), Number(creditos) || 0]))
      const creditos = seleccionadas.reduce((total, nombre) => total + (creditosPorMateria.get(nombre.trim()) ?? 0), 0)
      const config = crearConfigCosto({ valorCredito: planGuardado.valor_credito, beca: presupuesto?.beca, gastosExtra: gastos?.total ?? 0 })
      const costo = config && creditos > 0 ? calcularCostoSeleccion(creditos, config).costoFinal : null
      setPagoMensual(costo === null ? null : costo / config.meses)
    }).finally(() => vigente && setCargandoPago(false))
    return () => { vigente = false }
  }, [emailUsuario, planGuardado])
  const horarios = useMemo(() => (
    planGuardado
      ? planGuardado.bloques.filter((bloque) => bloque.tipo === 'clase')
      : leerStorage(`kairo-horarios:${emailUsuario}`)?.bloques ?? []
  ), [emailUsuario, planGuardado])
  const talleres = useMemo(() => (
    planGuardado
      ? planGuardado.bloques.filter((bloque) => bloque.tipo === 'taller')
      : leerStorage(`kairo-talleres:${emailUsuario}`)?.bloques ?? []
  ), [emailUsuario, planGuardado])
  const bloques = useMemo(() => (
    planGuardado?.bloques?.filter((bloque) => bloque.tipo === 'bloque') ?? []
  ), [planGuardado])

  useEffect(() => {
    const t = setInterval(() => setAhora(new Date()), 60000)
    return () => clearInterval(t)
  }, [])

  const lunes = useMemo(() => lunesDeSemana(semana), [semana])
  const fechas = useMemo(
    () => DIAS.map((_, i) => {
      const f = new Date(lunes)
      f.setDate(lunes.getDate() + i)
      return f
    }),
    [lunes]
  )
  const hoyISO = aISO(ahora)

  // Eventos de cada día de la semana mostrada, con su tipo y filtros aplicados.
  const porDia = useMemo(() => {
    return DIAS.map((dia, i) => {
      const iso = aISO(fechas[i])
      const lista = [
        ...horarios.filter((b) => b.dia === dia).map((b, k) => ({
          id: `c-${dia}-${k}`, tipo: 'clase', titulo: b.nombre, ini: aMin(b.inicio), fin: aMin(b.fin), salon: b.salon, extra: b.extra, grupo: b.grupo, dia,
        })),
        ...talleres.filter((b) => b.dia === dia).map((b, k) => ({
          id: `t-${dia}-${k}`, tipo: 'taller', titulo: b.nombre, ini: aMin(b.inicio), fin: aMin(b.fin), salon: b.salon, extra: b.extra, dia,
        })),
        ...bloques.filter((bloque) => bloqueOcurreEnFecha(bloque, fechas[i])).map((bloque, k) => ({
          id: `b-${dia}-${bloque.id ?? k}`, tipo: 'bloque', titulo: bloque.nombre, ini: aMin(bloque.inicio), fin: aMin(bloque.fin), dia,
          repeticion: bloque.repeticion, fecha_inicio: bloque.fecha_inicio,
        })),
        ...personales.filter((p) => p.fecha === iso).map((p) => ({
          id: p.id, tipo: 'personal', titulo: p.titulo, ini: aMin(p.inicio), fin: aMin(p.fin), fecha: p.fecha,
        })),
      ].filter((e) => filtros[e.tipo])
      return distribuir(lista)
    })
  }, [fechas, horarios, talleres, bloques, personales, filtros])

  const todos = porDia.flat()
  const horaInicio = Math.max(0, Math.min(7, ...todos.map((e) => Math.floor(e.ini / 60))))
  const horaFin = Math.min(24, Math.max(21, ...todos.map((e) => Math.ceil(e.fin / 60))))
  const horas = Array.from({ length: horaFin - horaInicio }, (_, i) => horaInicio + i)
  const alto = (horaFin - horaInicio) * PX_HORA

  const cuenta = (tipo) => todos.filter((e) => e.tipo === tipo).length
  const horasOcupadas = Math.round(todos.reduce((acc, e) => acc + (e.fin - e.ini), 0) / 60)
  const sinCargas = horarios.length === 0 && talleres.length === 0 && bloques.length === 0

  const minutosAhora = ahora.getHours() * 60 + ahora.getMinutes()
  const lineaAhora = (minutosAhora / 60 - horaInicio) * PX_HORA

  /* ---------- acciones ---------- */

  function guardarPersonales(siguiente) {
    setPersonales(siguiente)
    guardarStorage(claveEventos, { eventos: siguiente })
  }

  function nuevoEvento(fecha, inicio) {
    const fin = Math.min(24 * 60 - 1, aMin(inicio) + 60)
    setError('')
    setPanel({ tipo: 'form', borrador: { titulo: '', fecha, inicio, fin: aHHMM(fin) } })
  }

  function clicEnColumna(e, i) {
    if (e.target !== e.currentTarget) return
    const y = e.clientY - e.currentTarget.getBoundingClientRect().top
    const minutos = Math.floor(((y / PX_HORA) + horaInicio) * 2) * 30
    nuevoEvento(aISO(fechas[i]), aHHMM(Math.max(0, Math.min(minutos, 23 * 60 + 30))))
  }

  function abrir(evento) {
    setError('')
    if (evento.tipo === 'personal') {
      const p = personales.find((x) => x.id === evento.id)
      if (p) setPanel({ tipo: 'form', borrador: { ...p } })
    } else {
      setPanel({ tipo: 'ver', evento })
    }
  }

  function cambiar(campo, valor) {
    setError('')
    setPanel((p) => ({ ...p, borrador: { ...p.borrador, [campo]: valor } }))
  }

  function guardarEvento(e) {
    e.preventDefault()
    const b = panel.borrador
    if (!b.titulo.trim()) return setError('Escribí un nombre para el evento.')
    if (!b.fecha) return setError('Elegí una fecha.')
    if (aMin(b.fin) <= aMin(b.inicio)) return setError('La hora de fin debe ser posterior a la de inicio.')
    const evento = { ...b, titulo: b.titulo.trim(), id: b.id ?? `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}` }
    guardarPersonales(b.id ? personales.map((p) => (p.id === b.id ? evento : p)) : [...personales, evento])
    setPanel(null)
  }

  function eliminarEvento() {
    guardarPersonales(personales.filter((p) => p.id !== panel.borrador.id))
    setPanel(null)
  }

  const bordes = porDia.map((lista) => lista.length)

  return (
    <main className="cal-page">
      <header className="cal-hero">
        <span className="cal-blob cal-blob--1" aria-hidden="true" />
        <span className="cal-blob cal-blob--2" aria-hidden="true" />

        <div className="cal-hero-fila">
          <div>
            <span className="cal-etiqueta">Calendario</span>
            <h1>{formatearRango(lunes)}</h1>
          <p>{planGuardado
            ? `Plan guardado · ${planGuardado.carrera} · ${planGuardado.anio_lectivo} · Semestre ${planGuardado.semestre_lectivo}. Clases, talleres y bloques.`
            : 'Tu semana de un vistazo: clases, talleres y tus propios eventos.'}</p>
          </div>

          <div className="cal-acciones">
            <div className="cal-nav" role="group" aria-label="Cambiar de semana">
              <button type="button" onClick={() => setSemana((s) => s - 1)} aria-label="Semana anterior">‹</button>
              <button type="button" onClick={() => setSemana(0)} disabled={semana === 0}>Hoy</button>
              <button type="button" onClick={() => setSemana((s) => s + 1)} aria-label="Semana siguiente">›</button>
            </div>
            <button type="button" className="cal-btn cal-btn--rosa" onClick={() => nuevoEvento(hoyISO, aHHMM(Math.min(23 * 60, Math.max(horaInicio * 60, Math.ceil(minutosAhora / 60) * 60))))}>
              Nuevo evento
            </button>
          </div>
        </div>

        <div className="cal-datos">
          <Dato valor={cuenta('clase')} etiqueta="clases" />
          <Dato valor={cuenta('taller')} etiqueta="talleres" />
          <Dato valor={cuenta('bloque')} etiqueta="bloques" />
          <Dato valor={cuenta('personal')} etiqueta="eventos personales" />
          <Dato valor={horasOcupadas} etiqueta="horas ocupadas" />
        </div>
      </header>

      <div className="cal-contenido">
        {sinCargas && (
          <div className="cal-aviso" role="status">
            <span>Todavía no cargaste tus horarios ni talleres. Cargalos en Cargas y van a aparecer acá todas las semanas.</span>
            <button type="button" className="cal-btn cal-btn--primario" onClick={() => onIr?.('inicio')}>Ir a Cargas</button>
          </div>
        )}

        <div className="cal-filtros" role="group" aria-label="Qué mostrar">
          {Object.entries(TIPOS).map(([tipo, { etiqueta }]) => (
            <button
              type="button"
              key={tipo}
              className={`cal-filtro cal-filtro--${tipo} ${filtros[tipo] ? '' : 'cal-filtro--off'}`}
              aria-pressed={filtros[tipo]}
              onClick={() => setFiltros((f) => ({ ...f, [tipo]: !f[tipo] }))}
            >
              <i aria-hidden="true" />
              {etiqueta}
            </button>
          ))}
        </div>

        {panel?.tipo === 'ver' && (
          <aside className="cal-panel" aria-live="polite">
            <div className={`cal-panel-marca cal-tipo--${panel.evento.tipo}`} aria-hidden="true" />
            <div className="cal-panel-cuerpo">
              <span className="cal-panel-tipo">{TIPOS[panel.evento.tipo].singular}</span>
              <h2>{panel.evento.titulo}</h2>
              <p>
                {DIAS_LARGOS[DIAS.indexOf(panel.evento.dia)]} · {aHHMM(panel.evento.ini)} – {aHHMM(panel.evento.fin)}
                {panel.evento.salon ? ` · Salón ${panel.evento.salon}` : ''}
                {panel.evento.grupo ? ` · Grupo ${panel.evento.grupo}` : ''}
                {panel.evento.extra ? ` · ${panel.evento.tipo === 'clase' ? `Docente: ${panel.evento.extra}` : `${panel.evento.extra} cupos`}` : ''}
              </p>
              <small>{panel.evento.tipo === 'bloque'
                ? `${etiquetaRepeticion(panel.evento.repeticion)}${panel.evento.fecha_inicio ? ` desde ${panel.evento.fecha_inicio}` : ''}.`
                : planGuardado ? 'Viene del semestre que guardaste desde Planificar semestre.' : 'Viene de los horarios que cargaste en Cargas y se repite todas las semanas.'}</small>
            </div>
            <button type="button" className="cal-cerrar" onClick={() => setPanel(null)} aria-label="Cerrar">×</button>
          </aside>
        )}

        {panel?.tipo === 'form' && (
          <form className="cal-panel cal-form" onSubmit={guardarEvento} aria-label="Evento">
            <div className="cal-panel-marca cal-tipo--personal" aria-hidden="true" />
            <div className="cal-panel-cuerpo">
              <h2>{panel.borrador.id ? 'Editar evento' : 'Nuevo evento'}</h2>
              <div className="cal-campos">
                <label className="cal-campo cal-campo--ancho">
                  <span>Nombre</span>
                  <input type="text" value={panel.borrador.titulo} maxLength={60} autoFocus placeholder="Ej: Reunión de proyecto" onChange={(e) => cambiar('titulo', e.target.value)} />
                </label>
                <label className="cal-campo">
                  <span>Fecha</span>
                  <input type="date" value={panel.borrador.fecha} onChange={(e) => cambiar('fecha', e.target.value)} />
                </label>
                <label className="cal-campo">
                  <span>Desde</span>
                  <input type="time" value={panel.borrador.inicio} onChange={(e) => cambiar('inicio', e.target.value)} />
                </label>
                <label className="cal-campo">
                  <span>Hasta</span>
                  <input type="time" value={panel.borrador.fin} onChange={(e) => cambiar('fin', e.target.value)} />
                </label>
              </div>
              {error && <p className="cal-error" role="alert">{error}</p>}
              <div className="cal-form-botones">
                <button type="submit" className="cal-btn cal-btn--primario">Guardar</button>
                <button type="button" className="cal-btn cal-btn--claro" onClick={() => setPanel(null)}>Cancelar</button>
                {panel.borrador.id && (
                  <button type="button" className="cal-btn cal-btn--peligro" onClick={eliminarEvento}>Eliminar</button>
                )}
              </div>
            </div>
          </form>
        )}

        <div className="cal-grilla-marco">
          <div className="cal-grilla-scroll">
            <div className="cal-grilla">
              <div className="cal-esquina" />
              {DIAS.map((dia, i) => {
                const esHoy = aISO(fechas[i]) === hoyISO
                return (
                  <div key={dia} className={`cal-dia-cab ${esHoy ? 'cal-dia-cab--hoy' : ''}`}>
                    <span>{dia}</span>
                    <strong>{fechas[i].getDate()}</strong>
                    {bordes[i] > 0 && <i aria-label={`${bordes[i]} actividades`} />}
                  </div>
                )
              })}

              <div className="cal-horas" style={{ height: alto }}>
                {horas.map((h) => (
                  <span key={h} style={{ top: (h - horaInicio) * PX_HORA }}>{String(h).padStart(2, '0')}:00</span>
                ))}
              </div>

              {DIAS.map((dia, i) => {
                const esHoy = aISO(fechas[i]) === hoyISO
                return (
                  <div
                    key={dia}
                    className={`cal-columna ${esHoy ? 'cal-columna--hoy' : ''}`}
                    style={{ height: alto, '--px': `${PX_HORA}px` }}
                    onClick={(e) => clicEnColumna(e, i)}
                    role="presentation"
                  >
                    {esHoy && lineaAhora >= 0 && lineaAhora <= alto && <span className="cal-ahora" style={{ top: lineaAhora }} aria-hidden="true" />}
                    {porDia[i].map((ev) => (
                      <button
                        type="button"
                        key={ev.id}
                        className={`cal-evento cal-tipo--${ev.tipo}`}
                        style={{
                          top: ((ev.ini / 60) - horaInicio) * PX_HORA + 1,
                          height: Math.max(24, ((ev.fin - ev.ini) / 60) * PX_HORA - 2),
                          left: `calc(${(ev.carril / ev.carriles) * 100}% + 3px)`,
                          width: `calc(${100 / ev.carriles}% - 6px)`,
                        }}
                        onClick={() => abrir(ev)}
                        title={`${ev.titulo} · ${aHHMM(ev.ini)}–${aHHMM(ev.fin)}`}
                      >
                        <strong>{ev.titulo}</strong>
                        <span>{aHHMM(ev.ini)}–{aHHMM(ev.fin)}{ev.salon ? ` · ${ev.salon}` : ''}</span>
                      </button>
                    ))}
                  </div>
                )
              })}
            </div>
          </div>
        </div>
        <p className="cal-pista">Tocá un espacio libre para agregar un evento, o un bloque para ver el detalle.</p>
      <section className="cal-pago-mensual" aria-live="polite" aria-label="Pago mensual estimado">
        <div>
          <span>Pago mensual estimado</span>
          <p>Materias del semestre, beca y gastos extra prorrateados en 6 meses.</p>
        </div>
        <strong>{cargandoPago ? 'Calculando...' : pagoMensual === null ? 'Guarda de nuevo tu semestre para calcular' : formatearMonto(pagoMensual)}</strong>
      </section>
      </div>
    </main>
  )
}

export default WeeklyPlanner
