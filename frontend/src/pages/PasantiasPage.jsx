import { useEffect, useMemo, useState } from 'react'
import { apiFetch } from '../api'
import { useContador } from '../useContador'
import '../pagesCSS/PasantiasPage.css'

const RADIO = 54
const CIRCUNFERENCIA = 2 * Math.PI * RADIO

async function leerJson(res) {
  try {
    return await res.json()
  } catch {
    return {}
  }
}

function mensajeDe(res, json, porDefecto) {
  return res.status >= 502 ? 'El servidor no responde. Verificá que el backend esté encendido.' : json.error || porDefecto
}

function formatearHoras(valor) {
  return Number(valor).toLocaleString('es-UY', { maximumFractionDigits: 2 })
}

function formatearFecha(iso) {
  const [anio, mes, dia] = iso.split('-')
  return `${dia}/${mes}/${anio}`
}

function hoyISO() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

// Misma regla que el servidor: (días entre las fechas, inclusive / 7) × horas por semana.
function calcularHoras(inicio, fin, horasPorSemana) {
  if (!inicio || !fin || !(horasPorSemana > 0)) return null
  const dias = (new Date(`${fin}T00:00:00Z`) - new Date(`${inicio}T00:00:00Z`)) / 86400000 + 1
  if (!Number.isFinite(dias) || dias < 1) return null
  return Math.round((dias / 7) * horasPorSemana * 100) / 100
}

function Anillo({ porcentaje, objetivo }) {
  const n = useContador(Math.round(porcentaje))
  return (
    <div className="pg-anillo" role="progressbar" aria-valuenow={Math.round(porcentaje)} aria-valuemin={0} aria-valuemax={100} aria-label="Avance de las horas de pasantía">
      <svg viewBox="0 0 132 132" aria-hidden="true">
        <defs>
          <linearGradient id="pg-grad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" style={{ stopColor: 'var(--pa-c1)' }} />
            <stop offset="100%" style={{ stopColor: 'var(--pa-c2)' }} />
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
        <span>{objetivo ? `de ${formatearHoras(objetivo)} horas` : 'sin meta definida'}</span>
      </div>
    </div>
  )
}

function Dato({ valor, etiqueta }) {
  return (
    <div className="pg-dato">
      <strong>{typeof valor === 'number' ? formatearHoras(valor) : valor}</strong>
      <span>{etiqueta}</span>
    </div>
  )
}

const FORM_PASANTIA_VACIO = { empresa: '', fecha_inicio: '', fecha_fin: '', creditos: '0', descripcion: '' }
const FORM_HORAS_VACIO = { pasantia_id: '', horas_por_semana: '20', descripcion: '' }
const FORM_EXTRA_VACIO = { horas: '', descripcion: '' }

function PasantiasPage({ emailUsuario }) {
  const [pasantias, setPasantias] = useState([])
  const [progreso, setProgreso] = useState(null)
  const [cargando, setCargando] = useState(true)
  const [errorCarga, setErrorCarga] = useState('')
  const [revision, setRevision] = useState(0)

  const [formPasantia, setFormPasantia] = useState(FORM_PASANTIA_VACIO)
  const [guardandoPasantia, setGuardandoPasantia] = useState(false)
  const [mensajePasantia, setMensajePasantia] = useState(null)

  const [formHoras, setFormHoras] = useState(FORM_HORAS_VACIO)
  const [guardandoHoras, setGuardandoHoras] = useState(false)
  const [mensajeHoras, setMensajeHoras] = useState(null)

  const [editandoMeta, setEditandoMeta] = useState(false)
  const [metaInput, setMetaInput] = useState('')
  const [guardandoMeta, setGuardandoMeta] = useState(false)
  const [mensajeMeta, setMensajeMeta] = useState(null)

  const [extraAbierta, setExtraAbierta] = useState(null)
  const [formExtra, setFormExtra] = useState(FORM_EXTRA_VACIO)
  const [guardandoExtra, setGuardandoExtra] = useState(false)
  const [mensajeExtra, setMensajeExtra] = useState(null)

  const email = encodeURIComponent(emailUsuario ?? '')

  // Carga la lista y el progreso; se vuelve a ejecutar cuando cambia `revision` (después de guardar algo).
  useEffect(() => {
    let vigente = true
    Promise.all([
      apiFetch(`/api/persona/${email}/pasantias`),
      apiFetch(`/api/persona/${email}/progreso-pasantia`),
    ])
      .then(async ([resLista, resProgreso]) => {
        const [jsonLista, jsonProgreso] = await Promise.all([leerJson(resLista), leerJson(resProgreso)])
        if (!vigente) return
        if (!resLista.ok) throw new Error(mensajeDe(resLista, jsonLista, 'No se pudieron cargar tus pasantías.'))
        if (!resProgreso.ok) throw new Error(mensajeDe(resProgreso, jsonProgreso, 'No se pudo cargar tu progreso.'))
        setPasantias(jsonLista.pasantias ?? [])
        setProgreso(jsonProgreso)
        setErrorCarga('')
      })
      .catch((error) => vigente && setErrorCarga(error.message || 'No se pudo conectar con el servidor.'))
      .finally(() => vigente && setCargando(false))
    return () => { vigente = false }
  }, [email, revision])

  // Pasantía elegida para cargar horas: si la guardada ya no existe (o todavía no hay), se usa la primera.
  const pasantiaElegida = pasantias.some((p) => String(p.id) === formHoras.pasantia_id)
    ? formHoras.pasantia_id
    : String(pasantias[0]?.id ?? '')

  // El período sale de la pasantía elegida; si sigue en curso (sin fecha de fin) se cuenta hasta hoy.
  const pasantiaActual = pasantias.find((p) => String(p.id) === pasantiaElegida)
  const periodoInicio = pasantiaActual?.fecha_inicio ?? ''
  const periodoFin = pasantiaActual ? pasantiaActual.fecha_fin ?? hoyISO() : ''

  const horasCalculadas = useMemo(
    () => calcularHoras(periodoInicio, periodoFin, Number(formHoras.horas_por_semana)),
    [periodoInicio, periodoFin, formHoras.horas_por_semana]
  )

  const horasTotales = progreso?.horas_totales ?? 0
  const objetivo = progreso?.horas_objetivo ?? null
  const porcentaje = progreso?.porcentaje ?? 0
  const horasFaltantes = progreso?.horas_faltantes ?? 0
  const mostrarFormMeta = editandoMeta || (!cargando && !errorCarga && !objetivo)

  function cambiarPasantia(campo, valor) {
    setFormPasantia((actual) => ({ ...actual, [campo]: valor }))
  }

  function cambiarHoras(campo, valor) {
    setFormHoras((actual) => ({ ...actual, [campo]: valor }))
  }

  async function agregarPasantia(e) {
    e.preventDefault()
    setMensajePasantia(null)
    if (formPasantia.fecha_fin && formPasantia.fecha_fin < formPasantia.fecha_inicio) {
      setMensajePasantia({ tipo: 'error', texto: 'La fecha de fin no puede ser anterior a la de inicio.' })
      return
    }
    setGuardandoPasantia(true)
    try {
      const res = await apiFetch('/api/pasantia', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: emailUsuario,
          empresa: formPasantia.empresa,
          fecha_inicio: formPasantia.fecha_inicio,
          fecha_fin: formPasantia.fecha_fin || null,
          creditos: Number.parseInt(formPasantia.creditos, 10) || 0,
          descripcion: formPasantia.descripcion,
        }),
      })
      const json = await leerJson(res)
      if (res.ok) {
        setMensajePasantia({ tipo: 'ok', texto: `Pasantía en ${formPasantia.empresa.trim()} agregada. Ya podés cargarle horas.` })
        setFormPasantia(FORM_PASANTIA_VACIO)
        if (json.id !== undefined) setFormHoras((actual) => ({ ...actual, pasantia_id: String(json.id) }))
        setRevision((actual) => actual + 1)
      } else {
        setMensajePasantia({ tipo: 'error', texto: mensajeDe(res, json, 'No se pudo guardar la pasantía.') })
      }
    } catch {
      setMensajePasantia({ tipo: 'error', texto: 'No se pudo conectar con el servidor.' })
    }
    setGuardandoPasantia(false)
  }

  function empezarEditarMeta() {
    setMetaInput(objetivo ? String(objetivo) : '')
    setMensajeMeta(null)
    setEditandoMeta(true)
  }

  async function guardarMeta(e) {
    e.preventDefault()
    setMensajeMeta(null)
    const valor = Number(metaInput)
    if (!Number.isInteger(valor) || valor < 1 || valor > 10000) {
      setMensajeMeta({ tipo: 'error', texto: 'Ingresá un número entero de horas entre 1 y 10000.' })
      return
    }
    setGuardandoMeta(true)
    try {
      const res = await apiFetch(`/api/persona/${email}/horas-objetivo-pasantia`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ horas_objetivo: valor }),
      })
      const json = await leerJson(res)
      if (res.ok) {
        setEditandoMeta(false)
        setMetaInput('')
        setRevision((actual) => actual + 1)
      } else {
        setMensajeMeta({ tipo: 'error', texto: mensajeDe(res, json, 'No se pudo guardar la meta.') })
      }
    } catch {
      setMensajeMeta({ tipo: 'error', texto: 'No se pudo conectar con el servidor.' })
    }
    setGuardandoMeta(false)
  }

  function abrirExtra(id) {
    setMensajeExtra(null)
    setFormExtra(FORM_EXTRA_VACIO)
    setExtraAbierta(id)
  }

  async function agregarExtra(e) {
    e.preventDefault()
    setMensajeExtra(null)
    const horas = Number(formExtra.horas)
    if (!(horas > 0)) {
      setMensajeExtra({ tipo: 'error', texto: 'Ingresá una cantidad de horas mayor a 0.' })
      return
    }
    setGuardandoExtra(true)
    try {
      const res = await apiFetch(`/api/pasantia/${extraAbierta}/horas-extra`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ horas, descripcion: formExtra.descripcion }),
      })
      const json = await leerJson(res)
      if (res.ok) {
        setMensajeHoras({ tipo: 'ok', texto: `Se sumaron ${formatearHoras(json.horas_agregadas)} horas extra a tu progreso.` })
        setExtraAbierta(null)
        setFormExtra(FORM_EXTRA_VACIO)
        setRevision((actual) => actual + 1)
      } else {
        setMensajeExtra({ tipo: 'error', texto: mensajeDe(res, json, 'No se pudieron agregar las horas.') })
      }
    } catch {
      setMensajeExtra({ tipo: 'error', texto: 'No se pudo conectar con el servidor.' })
    }
    setGuardandoExtra(false)
  }

  async function cargarHoras(e) {
    e.preventDefault()
    setMensajeHoras(null)
    setGuardandoHoras(true)
    try {
      const res = await apiFetch(`/api/pasantia/${pasantiaElegida}/horas`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fecha_inicio: periodoInicio,
          fecha_fin: periodoFin,
          horas_por_semana: Number(formHoras.horas_por_semana),
          descripcion: formHoras.descripcion,
        }),
      })
      const json = await leerJson(res)
      if (res.ok) {
        setMensajeHoras({ tipo: 'ok', texto: `Se sumaron ${formatearHoras(json.horas_agregadas)} horas a tu progreso.` })
        setFormHoras({ ...FORM_HORAS_VACIO, pasantia_id: pasantiaElegida })
        setRevision((actual) => actual + 1)
      } else {
        setMensajeHoras({ tipo: 'error', texto: mensajeDe(res, json, 'No se pudieron cargar las horas.') })
      }
    } catch {
      setMensajeHoras({ tipo: 'error', texto: 'No se pudo conectar con el servidor.' })
    }
    setGuardandoHoras(false)
  }

  return (
    <section className="pg-page pa-page">
      <header className="pg-hero">
        <span className="pg-blob pg-blob--1" aria-hidden="true" />
        <span className="pg-blob pg-blob--2" aria-hidden="true" />
        <span className="pg-etiqueta">Pasantías</span>
        <h1>Tus horas de pasantía</h1>
        <p>Registrá tus pasantías y las horas por semana: calculamos el total y lo sumamos a tu avance hacia tu meta de horas.</p>
      </header>

      <div className="pg-contenido">
        {errorCarga && <p className="pg-mensaje pg-mensaje--error" role="alert">{errorCarga}</p>}

        <section className="pg-resumen" aria-label="Progreso de horas">
          <Anillo porcentaje={porcentaje} objetivo={objetivo} />
          <div className="pg-datos pa-datos">
            <Dato valor={horasTotales} etiqueta="horas cargadas" />
            {objetivo
              ? <Dato valor={horasFaltantes} etiqueta={`horas faltan para las ${formatearHoras(objetivo)}`} />
              : <Dato valor="—" etiqueta="definí tu meta de horas" />}
            <Dato valor={pasantias.length} etiqueta={pasantias.length === 1 ? 'pasantía registrada' : 'pasantías registradas'} />
          </div>
          {objetivo && horasFaltantes === 0 && !cargando && (
            <p className="pa-meta">¡Completaste las {formatearHoras(objetivo)} horas de pasantía!</p>
          )}
          {mostrarFormMeta ? (
            <form className="pa-meta-form" onSubmit={guardarMeta}>
              <label className="pa-campo pa-campo--chico">
                {objetivo ? 'Horas de pasantía a cumplir' : '¿Cuántas horas de pasantía tenés que cumplir?'}
                <input type="number" required min="1" max="10000" step="1" placeholder="Ej: 150" value={metaInput} onChange={(e) => setMetaInput(e.target.value)} />
              </label>
              <div className="pa-meta-botones">
                <button type="submit" className="pg-btn pg-btn--primario pg-btn--chico" disabled={guardandoMeta}>
                  {guardandoMeta ? 'Guardando…' : 'Guardar meta'}
                </button>
                {objetivo && (
                  <button type="button" className="pg-btn pg-btn--claro pg-btn--chico" onClick={() => setEditandoMeta(false)}>Cancelar</button>
                )}
              </div>
            </form>
          ) : (
            objetivo && (
              <button type="button" className="pg-btn pg-btn--claro pg-btn--chico pa-editar-meta" onClick={empezarEditarMeta}>
                Editar meta de horas
              </button>
            )
          )}
          {mensajeMeta && (
            <p className={`pg-mensaje pg-mensaje--${mensajeMeta.tipo}`} role={mensajeMeta.tipo === 'error' ? 'alert' : 'status'}>{mensajeMeta.texto}</p>
          )}
        </section>

        <div className="pa-columnas">
          <section className="pg-panel" aria-labelledby="pa-titulo-agregar">
            <div className="pg-panel-cabecera">
              <div>
                <h2 id="pa-titulo-agregar">Agregar pasantía</h2>
                <p>Registrá la empresa y el período. Las horas se cargan aparte.</p>
              </div>
            </div>
            <form className="pg-form pa-form" onSubmit={agregarPasantia}>
              <label className="pa-campo">
                Empresa
                <input type="text" required minLength={2} maxLength={150} value={formPasantia.empresa} onChange={(e) => cambiarPasantia('empresa', e.target.value)} />
              </label>
              <div className="pa-fila">
                <label className="pa-campo">
                  Fecha de inicio
                  <input type="date" required value={formPasantia.fecha_inicio} onChange={(e) => cambiarPasantia('fecha_inicio', e.target.value)} />
                </label>
                <label className="pa-campo">
                  Fecha de fin <small>(opcional)</small>
                  <input type="date" min={formPasantia.fecha_inicio || undefined} value={formPasantia.fecha_fin} onChange={(e) => cambiarPasantia('fecha_fin', e.target.value)} />
                </label>
              </div>
              <label className="pa-campo pa-campo--chico">
                Créditos
                <input type="number" min="0" step="1" value={formPasantia.creditos} onChange={(e) => cambiarPasantia('creditos', e.target.value)} />
              </label>
              <label className="pa-campo">
                Descripción <small>(opcional)</small>
                <textarea rows={3} maxLength={500} value={formPasantia.descripcion} onChange={(e) => cambiarPasantia('descripcion', e.target.value)} />
              </label>
              {mensajePasantia && (
                <p className={`pg-mensaje pg-mensaje--${mensajePasantia.tipo}`} role={mensajePasantia.tipo === 'error' ? 'alert' : 'status'}>{mensajePasantia.texto}</p>
              )}
              <button type="submit" className="pg-btn pg-btn--primario" disabled={guardandoPasantia}>
                {guardandoPasantia ? 'Guardando…' : 'Guardar pasantía'}
              </button>
            </form>
          </section>

          <section className="pg-panel" aria-labelledby="pa-titulo-horas">
            <div className="pg-panel-cabecera">
              <div>
                <h2 id="pa-titulo-horas">Cargar horas</h2>
                <p>Usamos el período de la pasantía: horas = (días ÷ 7) × horas por semana.</p>
              </div>
            </div>
            {pasantias.length === 0 ? (
              <p className="pa-vacio">{cargando ? 'Cargando…' : 'Primero agregá una pasantía para poder cargarle horas.'}</p>
            ) : (
              <form className="pg-form pa-form" onSubmit={cargarHoras}>
                <label className="pa-campo">
                  Pasantía
                  <select required value={pasantiaElegida} onChange={(e) => cambiarHoras('pasantia_id', e.target.value)}>
                    {pasantias.map((p) => (
                      <option key={p.id} value={p.id}>{p.empresa} · desde {formatearFecha(p.fecha_inicio)}</option>
                    ))}
                  </select>
                </label>
                <p className="pa-periodo">
                  Período: <strong>{formatearFecha(periodoInicio)} – {pasantiaActual?.fecha_fin ? formatearFecha(periodoFin) : 'hoy (en curso)'}</strong>
                </p>
                <label className="pa-campo pa-campo--chico">
                  Horas por semana
                  <input type="number" required min="0.5" step="0.5" value={formHoras.horas_por_semana} onChange={(e) => cambiarHoras('horas_por_semana', e.target.value)} />
                </label>
                <label className="pa-campo">
                  Descripción <small>(opcional)</small>
                  <input type="text" maxLength={255} value={formHoras.descripcion} onChange={(e) => cambiarHoras('descripcion', e.target.value)} />
                </label>
                <p className="pa-calculo" aria-live="polite">
                  {horasCalculadas === null
                    ? 'Revisá las horas por semana para ver cuántas horas se van a sumar.'
                    : <>Se van a sumar <strong>{formatearHoras(horasCalculadas)} horas</strong>.</>}
                </p>
                {mensajeHoras && (
                  <p className={`pg-mensaje pg-mensaje--${mensajeHoras.tipo}`} role={mensajeHoras.tipo === 'error' ? 'alert' : 'status'}>{mensajeHoras.texto}</p>
                )}
                <button type="submit" className="pg-btn pg-btn--primario" disabled={guardandoHoras}>
                  {guardandoHoras ? 'Guardando…' : 'Cargar horas'}
                </button>
              </form>
            )}
          </section>
        </div>

        <section className="pg-panel" aria-labelledby="pa-titulo-lista">
          <div className="pg-panel-cabecera">
            <div>
              <h2 id="pa-titulo-lista">Mis pasantías</h2>
              <p>Las horas acumuladas de cada una se suman en tu total. Con «Agregar horas extra» sumás horas a mano.</p>
            </div>
          </div>
          {pasantias.length === 0 ? (
            <p className="pa-vacio">{cargando ? 'Cargando…' : 'Todavía no registraste ninguna pasantía.'}</p>
          ) : (
            <ul className="pa-lista">
              {pasantias.map((p) => (
                <li key={p.id} className="pa-item">
                  <div className="pa-item-fila">
                    <div className="pa-item-principal">
                      <strong>{p.empresa}</strong>
                      <span>
                        {formatearFecha(p.fecha_inicio)} – {p.fecha_fin ? formatearFecha(p.fecha_fin) : 'en curso'}
                        {p.creditos > 0 ? ` · ${p.creditos} ${p.creditos === 1 ? 'crédito' : 'créditos'}` : ''}
                      </span>
                      {p.descripcion && <small>{p.descripcion}</small>}
                    </div>
                    <div className="pa-item-horas">
                      <b className="pa-horas">{formatearHoras(p.horas_totales)} h</b>
                      <button
                        type="button"
                        className="pg-btn pg-btn--claro pg-btn--chico"
                        aria-expanded={extraAbierta === p.id}
                        onClick={() => (extraAbierta === p.id ? setExtraAbierta(null) : abrirExtra(p.id))}
                      >
                        Agregar horas extra
                      </button>
                    </div>
                  </div>
                  {extraAbierta === p.id && (
                    <form className="pa-extra" onSubmit={agregarExtra}>
                      <label className="pa-campo pa-campo--chico">
                        Horas a sumar
                        <input type="number" required min="0.25" max="9999" step="0.25" autoFocus value={formExtra.horas} onChange={(e) => setFormExtra((actual) => ({ ...actual, horas: e.target.value }))} />
                      </label>
                      <label className="pa-campo">
                        Descripción <small>(opcional)</small>
                        <input type="text" maxLength={255} placeholder="Ej: guardia de fin de semana" value={formExtra.descripcion} onChange={(e) => setFormExtra((actual) => ({ ...actual, descripcion: e.target.value }))} />
                      </label>
                      {mensajeExtra && (
                        <p className={`pg-mensaje pg-mensaje--${mensajeExtra.tipo}`} role={mensajeExtra.tipo === 'error' ? 'alert' : 'status'}>{mensajeExtra.texto}</p>
                      )}
                      <div className="pa-extra-botones">
                        <button type="submit" className="pg-btn pg-btn--primario pg-btn--chico" disabled={guardandoExtra}>
                          {guardandoExtra ? 'Guardando…' : 'Sumar horas'}
                        </button>
                        <button type="button" className="pg-btn pg-btn--claro pg-btn--chico" onClick={() => setExtraAbierta(null)}>Cancelar</button>
                      </div>
                    </form>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </section>
  )
}

export default PasantiasPage
