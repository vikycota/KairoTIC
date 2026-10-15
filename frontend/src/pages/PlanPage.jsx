import { useEffect, useMemo, useState } from 'react'
import { apiFetch } from '../api'
import { useContador } from '../useContador'
import { DIAS, duracionHoras, generarSugerencia } from '../planificador'
import '../pagesCSS/Planificador.css'

const MAX_POR_DEFECTO = 36
const PX_HORA = 30

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
  } catch { /* sin almacenamiento: las elecciones duran hasta recargar */ }
}

const claveBloque = (nombre, b) => `${nombre}|${b.dia}|${b.inicio}`

function Dato({ valor, etiqueta }) {
  const n = useContador(valor)
  return (
    <div className="pl-dato">
      <strong>{n}</strong>
      <span>{etiqueta}</span>
    </div>
  )
}

/** Vista semanal compacta de lo que quedó elegido. */
function VistaSemana({ items, resaltada, onElegir }) {
  const bloques = items.flatMap((it) => it.bloques.map((b) => ({ ...b, nombre: it.nombre, tipo: it.tipo })))
  const horaIni = Math.min(8, ...bloques.map((b) => Math.floor(b.ini / 60)))
  const horaFin = Math.max(20, ...bloques.map((b) => Math.ceil(b.finMin / 60)))
  const horas = Array.from({ length: horaFin - horaIni }, (_, i) => horaIni + i)
  const dias = bloques.some((b) => b.dia === 'Dom') ? DIAS : DIAS.slice(0, 6)
  const alto = (horaFin - horaIni) * PX_HORA

  return (
    <div className="pl-semana" style={{ '--cols': dias.length }}>
      <div className="pl-semana-cab">
        <span />
        {dias.map((d) => <span key={d}>{d}</span>)}
      </div>
      <div className="pl-semana-cuerpo" style={{ height: alto }}>
        <div className="pl-semana-horas">
          {horas.map((h) => <span key={h} style={{ top: (h - horaIni) * PX_HORA }}>{String(h).padStart(2, '0')}</span>)}
        </div>
        {dias.map((d) => (
          <div className="pl-semana-col" key={d} style={{ '--px': `${PX_HORA}px` }}>
            {bloques.filter((b) => b.dia === d).map((b) => (
              <button
                type="button"
                key={claveBloque(b.nombre, b)}
                className={`pl-bloque pl-tipo--${b.tipo} ${resaltada === b.nombre ? 'pl-bloque--sel' : ''}`}
                style={{ top: (b.ini / 60 - horaIni) * PX_HORA + 1, height: Math.max(20, ((b.finMin - b.ini) / 60) * PX_HORA - 2) }}
                title={`${b.nombre} · ${b.inicio}–${b.fin}`}
                onClick={() => onElegir(b.nombre)}
              >
                <strong>{b.nombre}</strong>
              </button>
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}

function PlanPage({ emailUsuario, onIr }) {
  const [carreras, setCarreras] = useState([])
  const [carreraListas, setCarreraListas] = useState(false)
  const [carrera, setCarrera] = useState('')
  const [planMaterias, setPlanMaterias] = useState([])
  const [aprobadas, setAprobadas] = useState(() => new Set())
  const [cargaListas, setCargaListas] = useState(false)

  const [maxCreditos, setMaxCreditos] = useState(MAX_POR_DEFECTO)
  const [excluidas, setExcluidas] = useState(() => new Set())          // materias o talleres que la persona sacó
  const [bloquesQuitados, setBloquesQuitados] = useState(() => new Set())
  const [resaltada, setResaltada] = useState(null)
  const [verDescartadas, setVerDescartadas] = useState(false)

  const horarios = useMemo(() => leerStorage(`kairo-horarios:${emailUsuario}`)?.bloques ?? [], [emailUsuario])
  const talleres = useMemo(() => leerStorage(`kairo-talleres:${emailUsuario}`)?.bloques ?? [], [emailUsuario])

  useEffect(() => {
    apiFetch('/api/progreso')
      .then((res) => (res.ok ? res.json() : Promise.reject()))
      .then((data) => {
        setCarreras(data.carreras.map((c) => c.nombre))
        setCarrera((actual) => actual || data.carreras[0]?.nombre || '')
      })
      .catch(() => setCarreras([]))
      .finally(() => setCarreraListas(true))
  }, [])

  // Al cambiar de carrera: su plan, lo aprobado y las elecciones guardadas para esa carrera.
  useEffect(() => {
    if (!carrera) return
    let vigente = true
    const pedido = encodeURIComponent(carrera)
    Promise.all([
      apiFetch(`/api/plan?carrera=${pedido}`).then((res) => (res.ok ? res.json() : Promise.reject())),
      apiFetch(`/api/examenes?carrera=${pedido}`).then((res) => (res.ok ? res.json() : Promise.reject())),
    ])
      .then(([plan, ex]) => {
        if (!vigente) return
        setPlanMaterias(plan.materias)
        setAprobadas(new Set(ex.examenes.filter((e) => e.aprobada).map((e) => e.materia)))
        const guardado = leerStorage(`kairo-planificador:${emailUsuario}:${carrera}`)
        setMaxCreditos(guardado?.maxCreditos ?? MAX_POR_DEFECTO)
        setExcluidas(new Set(guardado?.excluidas ?? []))
        setBloquesQuitados(new Set(guardado?.bloquesQuitados ?? []))
      })
      .catch(() => {
        if (vigente) {
          setPlanMaterias([])
          setAprobadas(new Set())
        }
      })
      .finally(() => vigente && setCargaListas(true))
    return () => { vigente = false }
  }, [carrera, emailUsuario])

  const sugerencia = useMemo(
    () => generarSugerencia({ materias: planMaterias, aprobadas, horarios, talleres, excluidas, maxCreditos }),
    [planMaterias, aprobadas, horarios, talleres, excluidas, maxCreditos]
  )

  // Lo que queda en pie después de que la persona saque bloques.
  const conBloques = (nombre, bloques) => bloques.filter((b) => !bloquesQuitados.has(claveBloque(nombre, b)))
  const materiasVisibles = sugerencia.materias.map((m) => ({ ...m, restantes: conBloques(m.materia, m.bloques) }))
  const talleresVisibles = sugerencia.talleres.map((t) => ({ ...t, restantes: conBloques(t.nombre, t.bloques) }))

  const activas = materiasVisibles.filter((m) => m.restantes.length > 0)
  const creditos = activas.reduce((acc, m) => acc + m.creditos, 0)
  const horas = Math.round(
    [...activas.map((m) => m.restantes), ...talleresVisibles.map((t) => t.restantes)].reduce((acc, b) => acc + duracionHoras(b), 0)
  )
  const talleresActivos = talleresVisibles.filter((t) => t.restantes.length > 0)

  const itemsSemana = [
    ...activas.map((m) => ({ nombre: m.materia, bloques: m.restantes, tipo: 'materia' })),
    ...talleresActivos.map((t) => ({ nombre: t.nombre, bloques: t.restantes, tipo: 'taller' })),
  ]

  const hayCambios = excluidas.size > 0 || bloquesQuitados.size > 0
  const aprobadasCant = planMaterias.filter((m) => aprobadas.has(m.nombre)).length
  const sinHorarios = horarios.length === 0

  /* ---------- acciones (se guardan por carrera) ---------- */

  function guardar(siguiente) {
    const estado = {
      maxCreditos: siguiente.maxCreditos ?? maxCreditos,
      excluidas: [...(siguiente.excluidas ?? excluidas)],
      bloquesQuitados: [...(siguiente.bloquesQuitados ?? bloquesQuitados)],
    }
    guardarStorage(`kairo-planificador:${emailUsuario}:${carrera}`, estado)
  }

  function quitarMateria(nombre) {
    const sig = new Set(excluidas).add(nombre)
    setExcluidas(sig)
    guardar({ excluidas: sig })
    if (resaltada === nombre) setResaltada(null)
  }

  function quitarBloque(nombre, bloque) {
    const sig = new Set(bloquesQuitados).add(claveBloque(nombre, bloque))
    setBloquesQuitados(sig)
    guardar({ bloquesQuitados: sig })
  }

  function restaurarBloques(nombre, bloques) {
    const sig = new Set(bloquesQuitados)
    for (const b of bloques) sig.delete(claveBloque(nombre, b))
    setBloquesQuitados(sig)
    guardar({ bloquesQuitados: sig })
  }

  function restaurarExcluida(nombre) {
    const sig = new Set(excluidas)
    sig.delete(nombre)
    setExcluidas(sig)
    guardar({ excluidas: sig })
  }

  function cambiarMax(valor) {
    setMaxCreditos(valor)
    guardar({ maxCreditos: valor })
  }

  function reiniciar() {
    setExcluidas(new Set())
    setBloquesQuitados(new Set())
    guardar({ excluidas: new Set(), bloquesQuitados: new Set() })
  }

  const elegir = (nombre) => setResaltada((actual) => (actual === nombre ? null : nombre))

  return (
    <main className="pl-page">
      <header className="pl-hero">
        <span className="pl-blob pl-blob--1" aria-hidden="true" />
        <span className="pl-blob pl-blob--2" aria-hidden="true" />

        <div className="pl-hero-fila">
          <div>
            <span className="pl-etiqueta">Planificar semestre</span>
            <h1>Tu semestre ideal</h1>
            <p>
              Armamos una propuesta con lo que ya aprobaste y los horarios que cargaste.
              Sacá lo que no te convenza y ajustala a tu gusto.
            </p>
          </div>

          {carreras.length > 1 && (
            <select className="pl-select" value={carrera} onChange={(e) => setCarrera(e.target.value)} aria-label="Carrera" title={carrera}>
              {carreras.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          )}
        </div>

        {carrera && (
          <div className="pl-datos">
            <Dato valor={creditos} etiqueta={`de ${maxCreditos} créditos`} />
            <Dato valor={activas.length} etiqueta="materias" />
            <Dato valor={horas} etiqueta="horas por semana" />
            <Dato valor={talleresActivos.length} etiqueta="talleres" />
          </div>
        )}
      </header>

      <div className="pl-contenido">
        {carreraListas && carreras.length === 0 && (
          <section className="pl-vacio">
            <div className="pl-vacio-icono" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M9 6h11M9 12h11M9 18h11M3.5 6l1 1 2-2M3.5 12l1 1 2-2M3.5 18l1 1 2-2" /></svg>
            </div>
            <h2>Primero necesitamos tu plan de estudio</h2>
            <p>Con tu plan y tus materias aprobadas podemos sugerirte qué cursar.</p>
            <button type="button" className="pl-btn pl-btn--primario" onClick={() => onIr?.('plan-estudio')}>Cargar un plan de estudio</button>
          </section>
        )}

        {carrera && cargaListas && sinHorarios && (
          <section className="pl-vacio">
            <div className="pl-vacio-icono" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M8 3v3m8-3v3M4 9h16M5 5h14a1 1 0 011 1v13a1 1 0 01-1 1H5a1 1 0 01-1-1V6a1 1 0 011-1z" /></svg>
            </div>
            <h2>Faltan los horarios del semestre</h2>
            <p>Para armar un semestre sin superposiciones necesitamos saber cuándo se dicta cada materia.</p>
            <button type="button" className="pl-btn pl-btn--primario" onClick={() => onIr?.('inicio')}>Cargar horarios</button>
          </section>
        )}

        {carrera && cargaListas && !sinHorarios && (
          <>
            <section className="pl-ajustes" aria-label="Ajustes">
              <div className="pl-escolaridad">
                <strong>Tu escolaridad</strong>
                <span>{aprobadasCant} de {planMaterias.length} materias aprobadas</span>
              </div>

              <label className="pl-max">
                <span>Créditos máximos del semestre: <b>{maxCreditos}</b></span>
                <input type="range" min="12" max="48" step="2" value={maxCreditos} onChange={(e) => cambiarMax(Number(e.target.value))} />
              </label>

              {hayCambios && (
                <button type="button" className="pl-btn pl-btn--claro" onClick={reiniciar}>Volver a la sugerencia original</button>
              )}
            </section>

            {activas.length === 0 && talleresActivos.length === 0 ? (
              <section className="pl-vacio pl-vacio--chico">
                <h2>No hay nada para sugerir</h2>
                <p>
                  {planMaterias.length > 0 && aprobadasCant === planMaterias.length
                    ? '¡Ya aprobaste todas las materias de este plan!'
                    : 'Ninguna materia disponible encaja con tus horarios. Mirá abajo por qué se descartaron, o subí el máximo de créditos.'}
                </p>
              </section>
            ) : (
              <div className="pl-principal">
                <section aria-label="Materias sugeridas">
                  <h2 className="pl-titulo">Materias sugeridas</h2>
                  <p className="pl-ayuda">Ordenadas por lo que más conviene cursar primero. Si sacás una, buscamos otra que ocupe su lugar.</p>

                  <ul className="pl-lista">
                    {materiasVisibles.map((m, i) => {
                      const sacados = m.bloques.length - m.restantes.length
                      return (
                        <li
                          key={m.materia}
                          className={`pl-tarjeta pl-tipo--materia ${m.restantes.length === 0 ? 'pl-tarjeta--sin' : ''} ${resaltada === m.materia ? 'pl-tarjeta--sel' : ''}`}
                          style={{ '--i': i }}
                        >
                          <div className="pl-tarjeta-cab">
                            <button type="button" className="pl-tarjeta-nombre" onClick={() => elegir(m.materia)} aria-pressed={resaltada === m.materia}>
                              {m.materia}
                            </button>
                            <span className="pl-creditos">{m.creditos} créd.</span>
                            <button type="button" className="pl-quitar" onClick={() => quitarMateria(m.materia)} aria-label={`Sacar ${m.materia} de la sugerencia`}>
                              Sacar
                            </button>
                          </div>

                          <ul className="pl-motivos">
                            {m.motivos.map((t) => <li key={t}>{t}</li>)}
                          </ul>

                          <div className="pl-horarios">
                            {m.restantes.map((b) => (
                              <span className="pl-horario" key={claveBloque(m.materia, b)}>
                                {b.dia} {b.inicio}–{b.fin}{b.salon ? ` · ${b.salon}` : ''}
                                <button type="button" onClick={() => quitarBloque(m.materia, b)} aria-label={`Quitar el bloque del ${b.dia} ${b.inicio}`}>×</button>
                              </span>
                            ))}
                            {sacados > 0 && (
                              <button type="button" className="pl-deshacer" onClick={() => restaurarBloques(m.materia, m.bloques)}>
                                Restaurar {sacados === 1 ? 'el bloque quitado' : `${sacados} bloques quitados`}
                              </button>
                            )}
                          </div>
                          {m.restantes.length === 0 && <p className="pl-aviso-sin">Quitaste todos sus horarios: no la vas a cursar este semestre.</p>}
                        </li>
                      )
                    })}

                    {talleresVisibles.map((t, i) => {
                      const sacados = t.bloques.length - t.restantes.length
                      return (
                        <li
                          key={t.nombre}
                          className={`pl-tarjeta pl-tipo--taller ${t.restantes.length === 0 ? 'pl-tarjeta--sin' : ''} ${resaltada === t.nombre ? 'pl-tarjeta--sel' : ''}`}
                          style={{ '--i': materiasVisibles.length + i }}
                        >
                          <div className="pl-tarjeta-cab">
                            <button type="button" className="pl-tarjeta-nombre" onClick={() => elegir(t.nombre)} aria-pressed={resaltada === t.nombre}>
                              {t.nombre}
                            </button>
                            <span className="pl-creditos pl-creditos--taller">Taller</span>
                            <button type="button" className="pl-quitar" onClick={() => quitarMateria(`taller:${t.nombre}`)} aria-label={`Sacar ${t.nombre} de la sugerencia`}>
                              Sacar
                            </button>
                          </div>
                          <ul className="pl-motivos"><li>Entra en un hueco libre de tu semana</li></ul>
                          <div className="pl-horarios">
                            {t.restantes.map((b) => (
                              <span className="pl-horario" key={claveBloque(t.nombre, b)}>
                                {b.dia} {b.inicio}–{b.fin}{b.salon ? ` · ${b.salon}` : ''}
                                <button type="button" onClick={() => quitarBloque(t.nombre, b)} aria-label={`Quitar el bloque del ${b.dia} ${b.inicio}`}>×</button>
                              </span>
                            ))}
                            {sacados > 0 && (
                              <button type="button" className="pl-deshacer" onClick={() => restaurarBloques(t.nombre, t.bloques)}>Restaurar bloques</button>
                            )}
                          </div>
                        </li>
                      )
                    })}
                  </ul>
                </section>

                <aside className="pl-lateral" aria-label="Vista semanal">
                  <h2 className="pl-titulo">Tu semana</h2>
                  <VistaSemana items={itemsSemana} resaltada={resaltada} onElegir={elegir} />
                  <div className="pl-leyenda">
                    <span><i className="pl-punto pl-punto--materia" />Materias</span>
                    <span><i className="pl-punto pl-punto--taller" />Talleres</span>
                  </div>
                </aside>
              </div>
            )}

            {(excluidas.size > 0 || sugerencia.descartadas.length > 0) && (
              <section className="pl-extra" aria-label="Otras materias">
                {excluidas.size > 0 && (
                  <div className="pl-quitadas">
                    <h3>Sacaste</h3>
                    <div>
                      {[...excluidas].map((n) => (
                        <button type="button" key={n} className="pl-chip-quitada" onClick={() => restaurarExcluida(n)} title="Volver a incluirla">
                          {n.replace(/^taller:/, '')} <span>Volver a incluir</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {sugerencia.descartadas.length > 0 && (
                  <div className="pl-descartadas">
                    <button type="button" className="pl-desplegar" aria-expanded={verDescartadas} onClick={() => setVerDescartadas((v) => !v)}>
                      Por qué no se incluyeron otras materias ({sugerencia.descartadas.length})
                      <span aria-hidden="true">{verDescartadas ? '▴' : '▾'}</span>
                    </button>
                    {verDescartadas && (
                      <ul>
                        {sugerencia.descartadas.map((d) => (
                          <li key={d.nombre}>
                            <strong>{d.nombre}</strong>
                            <span>{d.razon}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}
              </section>
            )}

            <p className="pl-nota">
              Esta propuesta se calcula con tu plan, tus materias aprobadas y los horarios que cargaste.
              Las elecciones que hagas se guardan para esta carrera.
            </p>
          </>
        )}
      </div>
    </main>
  )
}

export default PlanPage
