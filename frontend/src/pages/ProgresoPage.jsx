import { useEffect, useMemo, useState } from 'react'
import { apiFetch } from '../api'
import { useContador } from '../useContador'
import '../pagesCSS/ProgresoPage.css'

const NOTA_MAXIMA = 12
const NOTAS = Array.from({ length: NOTA_MAXIMA + 1 }, (_, i) => i)
const RADIO = 54
const CIRCUNFERENCIA = 2 * Math.PI * RADIO

function hoy() {
  const d = new Date()
  const mes = String(d.getMonth() + 1).padStart(2, '0')
  const dia = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${mes}-${dia}`
}

async function leerJson(res) {
  try {
    return await res.json()
  } catch {
    return {}
  }
}

function formatearFecha(iso) {
  const [anio, mes, dia] = iso.split('-')
  return `${dia}/${mes}/${anio}`
}

function mensajeDe(res, json, porDefecto) {
  return res.status >= 502 ? 'El servidor no responde. Verificá que el backend esté encendido.' : json.error || porDefecto
}

function Anillo({ porcentaje }) {
  const n = useContador(porcentaje)
  return (
    <div className="pg-anillo" role="progressbar" aria-valuenow={porcentaje} aria-valuemin={0} aria-valuemax={100} aria-label="Avance de la carrera">
      <svg viewBox="0 0 132 132" aria-hidden="true">
        <defs>
          <linearGradient id="pg-grad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#7c5cfc" />
            <stop offset="100%" stopColor="#de6ade" />
          </linearGradient>
        </defs>
        <circle cx="66" cy="66" r={RADIO} className="pg-anillo-fondo" />
        <circle
          cx="66"
          cy="66"
          r={RADIO}
          className="pg-anillo-valor"
          strokeDasharray={CIRCUNFERENCIA}
          strokeDashoffset={CIRCUNFERENCIA * (1 - porcentaje / 100)}
        />
      </svg>
      <div className="pg-anillo-texto">
        <strong>{n}%</strong>
        <span>de la carrera</span>
      </div>
    </div>
  )
}

function Dato({ valor, etiqueta, decimales = 0 }) {
  const n = useContador(Math.round(valor * 10 ** decimales))
  const texto = decimales ? (n / 10 ** decimales).toFixed(decimales) : n
  return (
    <div className="pg-dato">
      <strong>{texto}</strong>
      <span>{etiqueta}</span>
    </div>
  )
}

function ProgresoPage({ onIr }) {
  const [resumen, setResumen] = useState([])          // avance de cada carrera, por separado
  const [resumenListo, setResumenListo] = useState(false)
  const [carrera, setCarrera] = useState('')
  const [planMaterias, setPlanMaterias] = useState([])
  const [examenes, setExamenes] = useState([])        // todos los intentos, solo de esta carrera
  const [notaAprobacion, setNotaAprobacion] = useState(6)
  const [error, setError] = useState('')
  const [aviso, setAviso] = useState('')

  const [materiaSel, setMateriaSel] = useState(null)
  const [nota, setNota] = useState(null)
  const [fecha, setFecha] = useState(hoy)
  const [guardando, setGuardando] = useState(false)
  const [quitarFecha, setQuitarFecha] = useState(null)   // fecha del examen que se está por quitar

  function cargarResumen() {
    apiFetch('/api/progreso')
      .then((res) => (res.ok ? res.json() : Promise.reject()))
      .then((data) => {
        setResumen(data.carreras)
        if (data.nota_aprobacion !== undefined) setNotaAprobacion(data.nota_aprobacion)
        setCarrera((actual) => (data.carreras.some((c) => c.nombre === actual) ? actual : data.carreras[0]?.nombre ?? ''))
      })
      .catch(() => setResumen([]))
      .finally(() => setResumenListo(true))
  }

  useEffect(cargarResumen, [])

  // Al cambiar de carrera se carga su plan y SOLO los exámenes de las materias de ese plan.
  function cargarCarrera(nombre) {
    let vigente = true
    const pedido = encodeURIComponent(nombre)
    apiFetch(`/api/plan?carrera=${pedido}`)
      .then((res) => (res.ok ? res.json() : Promise.reject()))
      .then((data) => vigente && setPlanMaterias(data.materias))
      .catch(() => vigente && setPlanMaterias([]))
    apiFetch(`/api/examenes?carrera=${pedido}`)
      .then((res) => (res.ok ? res.json() : Promise.reject()))
      .then((data) => {
        if (!vigente) return
        setExamenes(data.examenes)
        if (data.nota_aprobacion !== undefined) setNotaAprobacion(data.nota_aprobacion)
      })
      .catch(() => vigente && setExamenes([]))
    return () => { vigente = false }
  }

  useEffect(() => (carrera ? cargarCarrera(carrera) : undefined), [carrera])

  // Una materia está aprobada si algún examen superó la nota de aprobación.
  const aprobadas = useMemo(() => {
    const mapa = new Map()
    for (const e of examenes) {
      if (e.aprobada && (!mapa.has(e.materia) || e.nota > mapa.get(e.materia).nota)) mapa.set(e.materia, e)
    }
    return mapa
  }, [examenes])

  const intentos = useMemo(() => {
    const mapa = new Map()
    for (const e of examenes) mapa.set(e.materia, [...(mapa.get(e.materia) ?? []), e])
    return mapa
  }, [examenes])

  const semestres = useMemo(() => {
    const grupos = new Map()
    for (const m of planMaterias) {
      const clave = m.semestre ?? 0
      if (!grupos.has(clave)) grupos.set(clave, [])
      grupos.get(clave).push(m)
    }
    return [...grupos.entries()]
      .sort(([a], [b]) => (a || 99) - (b || 99))
      .map(([numero, materias]) => ({
        numero,
        materias,
        creditos: materias.reduce((acc, m) => acc + m.creditos, 0),
        aprobados: materias.reduce((acc, m) => acc + (aprobadas.has(m.nombre) ? m.creditos : 0), 0),
      }))
  }, [planMaterias, aprobadas])

  // Los créditos solo se acreditan por las materias aprobadas.
  const creditosCarrera = planMaterias.reduce((acc, m) => acc + m.creditos, 0)
  const creditosAprobados = planMaterias.reduce((acc, m) => acc + (aprobadas.has(m.nombre) ? m.creditos : 0), 0)
  const cantAprobadas = planMaterias.filter((m) => aprobadas.has(m.nombre)).length
  const promedio = aprobadas.size ? [...aprobadas.values()].reduce((acc, e) => acc + e.nota, 0) / aprobadas.size : null
  const porcentaje = creditosCarrera ? Math.min(100, Math.round((creditosAprobados / creditosCarrera) * 100)) : 0

  const materiaActual = planMaterias.find((m) => m.nombre === materiaSel) ?? null
  const aprobacion = materiaSel ? aprobadas.get(materiaSel) : null
  const examenesDeMateria = materiaSel ? intentos.get(materiaSel) ?? [] : []

  function elegir(nombre) {
    setError('')
    setAviso('')
    setQuitarFecha(null)
    setNota(null)
    setFecha(hoy())
    setMateriaSel((actual) => (actual === nombre ? null : nombre))
  }

  function cambiarCarrera(nombre) {
    setCarrera(nombre)
    setMateriaSel(null)
    setError('')
    setAviso('')
  }

  async function agregarExamen(e) {
    e.preventDefault()
    setError('')
    setAviso('')
    setGuardando(true)
    try {
      const res = await apiFetch('/api/examenes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ materia: materiaSel, nota, fecha, carrera }),
      })
      const json = await leerJson(res)
      if (res.ok) {
        setAviso(
          json.aprobada
            ? `¡${materiaSel} aprobada con ${json.nota}! Se acreditaron sus créditos.`
            : `Examen guardado: ${json.nota} no alcanza para aprobar (hace falta más de ${notaAprobacion}).`
        )
        setNota(null)
        cargarCarrera(carrera)
        cargarResumen()
      } else {
        setError(mensajeDe(res, json, 'No se pudo guardar el examen.'))
      }
    } catch {
      setError('No se pudo conectar con el servidor.')
    }
    setGuardando(false)
  }

  async function quitarExamen(fechaExamen) {
    setError('')
    setAviso('')
    try {
      const res = await apiFetch('/api/examenes', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ materia: materiaSel, fecha: fechaExamen }),
      })
      if (res.ok) {
        setQuitarFecha(null)
        cargarCarrera(carrera)
        cargarResumen()
      } else {
        setError(mensajeDe(res, await leerJson(res), 'No se pudo quitar el examen.'))
      }
    } catch {
      setError('No se pudo conectar con el servidor.')
    }
  }

  const puedeGuardar = nota !== null && fecha && !guardando

  return (
    <main className="pg-page">
      <header className="pg-hero">
        <span className="pg-blob pg-blob--1" aria-hidden="true" />
        <span className="pg-blob pg-blob--2" aria-hidden="true" />
        <span className="pg-etiqueta">Mi progreso</span>
        <h1>{carrera || 'Tu avance en la carrera'}</h1>
        <p>Cada carrera lleva su propio avance. Una materia acredita sus créditos cuando la aprobás con más de {notaAprobacion}.</p>
      </header>

      <div className="pg-contenido">
        {resumenListo && resumen.length === 0 && (
          <section className="pg-vacio">
            <div className="pg-vacio-icono" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M4 19V9m6 10V5m6 14v-7m4 7H2" /></svg>
            </div>
            <h2>Todavía no hay nada que medir</h2>
            <p>Para registrar tus exámenes primero necesitás cargar un plan de estudio.</p>
            <button type="button" className="pg-btn pg-btn--primario" onClick={() => onIr?.('plan-estudio')}>Cargar un plan de estudio</button>
          </section>
        )}

        {resumen.length > 1 && (
          <section className="pg-carreras" aria-label="Tus carreras">
            {resumen.map((c) => {
              const pct = c.creditos ? Math.round((c.creditos_aprobados / c.creditos) * 100) : 0
              return (
                <button
                  type="button"
                  key={c.nombre}
                  className={`pg-carrera ${c.nombre === carrera ? 'pg-carrera--activa' : ''}`}
                  aria-pressed={c.nombre === carrera}
                  onClick={() => cambiarCarrera(c.nombre)}
                >
                  <span className="pg-carrera-nombre">{c.nombre}</span>
                  <span className="pg-carrera-datos">{c.creditos_aprobados} / {c.creditos} créditos · {pct}%</span>
                  <span className="pg-carrera-barra"><i style={{ width: `${pct}%` }} /></span>
                </button>
              )
            })}
          </section>
        )}

        {carrera && (
          <>
            <section className="pg-resumen">
              <Anillo porcentaje={porcentaje} />
              <div className="pg-datos">
                <Dato valor={cantAprobadas} etiqueta={`de ${planMaterias.length} materias aprobadas`} />
                <Dato valor={creditosAprobados} etiqueta={`de ${creditosCarrera} créditos acreditados`} />
                <Dato valor={promedio ?? 0} decimales={2} etiqueta={promedio === null ? 'promedio (sin aprobadas aún)' : 'promedio de aprobadas'} />
                <Dato valor={examenes.length} etiqueta="exámenes rendidos" />
              </div>
            </section>

            {error && <p className="pg-mensaje pg-mensaje--error" role="alert">{error}</p>}
            {aviso && <p className="pg-mensaje pg-mensaje--ok" role="status">{aviso}</p>}

            {materiaActual && (
              <aside className="pg-panel" aria-live="polite">
                <div className="pg-panel-cabecera">
                  <div>
                    <h2>{materiaActual.nombre}</h2>
                    <p>
                      {materiaActual.creditos} créditos
                      {materiaActual.categoria ? ` · ${materiaActual.categoria}` : ''}
                      {materiaActual.previas?.length ? ` · Previas: ${materiaActual.previas.join(', ')}` : ''}
                    </p>
                  </div>
                  <button type="button" className="pg-cerrar" onClick={() => setMateriaSel(null)} aria-label="Cerrar">×</button>
                </div>

                {aprobacion && (
                  <div className="pg-aprobada">
                    <div className="pg-sello">
                      <strong>{aprobacion.nota}</strong>
                      <span>nota</span>
                    </div>
                    <p>
                      <strong>Materia aprobada</strong> el {formatearFecha(aprobacion.fecha)}.
                      Ya acreditó {materiaActual.creditos} créditos y no admite más exámenes.
                    </p>
                  </div>
                )}

                {examenesDeMateria.length > 0 && (
                  <div className="pg-historial">
                    <h3>Exámenes rendidos ({examenesDeMateria.length})</h3>
                    <ul>
                      {examenesDeMateria.map((x) => (
                        <li key={x.fecha}>
                          <b className={x.aprobada ? 'pg-badge pg-badge--ok' : 'pg-badge pg-badge--no'}>{x.nota}</b>
                          <span className="pg-historial-fecha">{formatearFecha(x.fecha)}</span>
                          <span className="pg-historial-estado">{x.aprobada ? 'Aprobó' : 'No alcanzó'}</span>
                          {quitarFecha === x.fecha ? (
                            <span className="pg-confirmar">
                              <button type="button" className="pg-btn pg-btn--rojo pg-btn--chico" onClick={() => quitarExamen(x.fecha)}>Quitar</button>
                              <button type="button" className="pg-btn pg-btn--claro pg-btn--chico" onClick={() => setQuitarFecha(null)}>Cancelar</button>
                            </span>
                          ) : (
                            <button type="button" className="pg-quitar" onClick={() => setQuitarFecha(x.fecha)} aria-label={`Quitar el examen del ${formatearFecha(x.fecha)}`}>Quitar</button>
                          )}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {!aprobacion && (
                  <form className="pg-form" onSubmit={agregarExamen}>
                    <fieldset>
                      <legend>Agregar un examen · ¿qué nota sacaste?</legend>
                      <div className="pg-notas">
                        {NOTAS.map((n) => (
                          <button
                            type="button"
                            key={n}
                            className={`pg-nota ${nota === n ? 'pg-nota--activa' : ''} ${n > notaAprobacion ? 'pg-nota--pasa' : ''}`}
                            aria-pressed={nota === n}
                            onClick={() => setNota(n)}
                          >
                            {n}
                          </button>
                        ))}
                      </div>
                      <p className="pg-pista">Se aprueba con una nota mayor a {notaAprobacion}. Podés cargar todos tus intentos.</p>
                    </fieldset>
                    <label className="pg-fecha">
                      <span>Fecha del examen</span>
                      <input type="date" value={fecha} max={hoy()} onChange={(e) => setFecha(e.target.value)} required />
                    </label>
                    <button type="submit" className="pg-btn pg-btn--primario" disabled={!puedeGuardar}>
                      {guardando ? 'Guardando…' : 'Agregar examen'}
                    </button>
                  </form>
                )}
              </aside>
            )}

            <section aria-label="Avance por semestre">
              <h2 className="pg-titulo">Tu avance por semestre</h2>
              <p className="pg-ayuda">Tocá una materia para cargar un examen o ver su historial. Las aprobadas ya no admiten más exámenes.</p>
              <div className="pg-tablero">
                {semestres.map((s, i) => {
                  const pct = s.creditos ? Math.round((s.aprobados / s.creditos) * 100) : 0
                  return (
                    <section className="pg-semestre" key={s.numero} style={{ '--i': i }}>
                      <header>
                        <span className="pg-sem-num">{s.numero || '–'}</span>
                        <div>
                          <strong>{s.numero ? `Semestre ${s.numero}` : 'Sin semestre'}</strong>
                          <span>{s.aprobados} / {s.creditos} créditos</span>
                        </div>
                        <div className="pg-sem-barra" aria-hidden="true"><i style={{ width: `${pct}%` }} /></div>
                      </header>
                      <div className="pg-materias">
                        {s.materias.map((m) => {
                          const hecha = aprobadas.get(m.nombre)
                          const cantIntentos = intentos.get(m.nombre)?.length ?? 0
                          const estado = hecha ? 'pg-materia--ok' : cantIntentos ? 'pg-materia--intentos' : ''
                          return (
                            <button
                              type="button"
                              key={m.nombre}
                              className={`pg-materia ${estado} ${m.nombre === materiaSel ? 'pg-materia--sel' : ''}`}
                              aria-pressed={m.nombre === materiaSel}
                              onClick={() => elegir(m.nombre)}
                            >
                              <span className="pg-check" aria-hidden="true">
                                {hecha && <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12l5 5L20 7" /></svg>}
                              </span>
                              <span className="pg-materia-nombre">{m.nombre}</span>
                              {hecha ? (
                                <b className="pg-materia-nota">{hecha.nota}</b>
                              ) : cantIntentos ? (
                                <span className="pg-materia-intentos" title="Exámenes rendidos sin aprobar">{cantIntentos}×</span>
                              ) : (
                                <span className="pg-materia-cred">{m.creditos}</span>
                              )}
                            </button>
                          )
                        })}
                      </div>
                    </section>
                  )
                })}
              </div>
            </section>

            {examenes.length > 0 && (
              <section aria-label="Últimos exámenes">
                <h2 className="pg-titulo">Últimos exámenes</h2>
                <ul className="pg-recientes">
                  {examenes.slice(0, 5).map((x) => (
                    <li key={`${x.materia}-${x.fecha}`}>
                      <span>{x.materia}</span>
                      <span>{formatearFecha(x.fecha)}</span>
                      <b className={x.aprobada ? 'pg-badge pg-badge--ok' : 'pg-badge pg-badge--no'}>{x.nota}</b>
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </>
        )}
      </div>
    </main>
  )
}

export default ProgresoPage
