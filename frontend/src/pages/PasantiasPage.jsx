import { useEffect, useMemo, useState } from 'react'
import { apiFetch } from '../api'
import { useContador } from '../useContador'
import '../pagesCSS/PasantiasPage.css'

const RADIO = 54
const CIRCUNFERENCIA = 2 * Math.PI * RADIO
const HORAS_OBJETIVO = 150

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

// Misma regla que el servidor: (días entre las fechas, inclusive / 7) × horas por semana.
function calcularHoras(inicio, fin, horasPorSemana) {
  if (!inicio || !fin || !(horasPorSemana > 0)) return null
  const dias = (new Date(`${fin}T00:00:00Z`) - new Date(`${inicio}T00:00:00Z`)) / 86400000 + 1
  if (!Number.isFinite(dias) || dias < 1) return null
  return Math.round((dias / 7) * horasPorSemana * 100) / 100
}

function Anillo({ porcentaje }) {
  const n = useContador(Math.round(porcentaje))
  return (
    <div className="pg-anillo" role="progressbar" aria-valuenow={Math.round(porcentaje)} aria-valuemin={0} aria-valuemax={100} aria-label="Avance de las horas de pasantía">
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
        <span>de {HORAS_OBJETIVO} horas</span>
      </div>
    </div>
  )
}

function Dato({ valor, etiqueta }) {
  return (
    <div className="pg-dato">
      <strong>{formatearHoras(valor)}</strong>
      <span>{etiqueta}</span>
    </div>
  )
}

const FORM_PASANTIA_VACIO = { empresa: '', fecha_inicio: '', fecha_fin: '', creditos: '0', descripcion: '' }
const FORM_HORAS_VACIO = { pasantia_id: '', fecha_inicio: '', fecha_fin: '', horas_por_semana: '20', descripcion: '' }

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

  const horasCalculadas = useMemo(
    () => calcularHoras(formHoras.fecha_inicio, formHoras.fecha_fin, Number(formHoras.horas_por_semana)),
    [formHoras.fecha_inicio, formHoras.fecha_fin, formHoras.horas_por_semana]
  )

  const horasTotales = progreso?.horas_totales ?? 0
  const porcentaje = progreso?.porcentaje ?? 0
  const horasFaltantes = progreso?.horas_faltantes ?? HORAS_OBJETIVO

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

  async function cargarHoras(e) {
    e.preventDefault()
    setMensajeHoras(null)
    if (formHoras.fecha_fin < formHoras.fecha_inicio) {
      setMensajeHoras({ tipo: 'error', texto: 'La fecha de fin no puede ser anterior a la de inicio.' })
      return
    }
    setGuardandoHoras(true)
    try {
      const res = await apiFetch(`/api/pasantia/${pasantiaElegida}/horas`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fecha_inicio: formHoras.fecha_inicio,
          fecha_fin: formHoras.fecha_fin,
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
        <p>Cargá el período y las horas por semana: calculamos el total y lo sumamos a tu avance hacia las {HORAS_OBJETIVO} horas.</p>
      </header>

      <div className="pg-contenido">
        {errorCarga && <p className="pg-mensaje pg-mensaje--error" role="alert">{errorCarga}</p>}

        <section className="pg-resumen" aria-label="Progreso de horas">
          <Anillo porcentaje={porcentaje} />
          <div className="pg-datos pa-datos">
            <Dato valor={horasTotales} etiqueta="horas cargadas" />
            <Dato valor={horasFaltantes} etiqueta={`horas faltan para las ${HORAS_OBJETIVO}`} />
            <Dato valor={pasantias.length} etiqueta={pasantias.length === 1 ? 'pasantía registrada' : 'pasantías registradas'} />
          </div>
          {horasFaltantes === 0 && !cargando && (
            <p className="pa-meta">¡Completaste las {HORAS_OBJETIVO} horas de pasantía!</p>
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
                <p>Horas = (días del período ÷ 7) × horas por semana.</p>
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
                <div className="pa-fila">
                  <label className="pa-campo">
                    Desde
                    <input type="date" required value={formHoras.fecha_inicio} onChange={(e) => cambiarHoras('fecha_inicio', e.target.value)} />
                  </label>
                  <label className="pa-campo">
                    Hasta
                    <input type="date" required min={formHoras.fecha_inicio || undefined} value={formHoras.fecha_fin} onChange={(e) => cambiarHoras('fecha_fin', e.target.value)} />
                  </label>
                </div>
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
                    ? 'Completá las fechas para ver cuántas horas se van a sumar.'
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
              <p>Las horas acumuladas de cada una se suman en tu total.</p>
            </div>
          </div>
          {pasantias.length === 0 ? (
            <p className="pa-vacio">{cargando ? 'Cargando…' : 'Todavía no registraste ninguna pasantía.'}</p>
          ) : (
            <ul className="pa-lista">
              {pasantias.map((p) => (
                <li key={p.id} className="pa-item">
                  <div className="pa-item-principal">
                    <strong>{p.empresa}</strong>
                    <span>
                      {formatearFecha(p.fecha_inicio)} – {p.fecha_fin ? formatearFecha(p.fecha_fin) : 'en curso'}
                      {p.creditos > 0 ? ` · ${p.creditos} ${p.creditos === 1 ? 'crédito' : 'créditos'}` : ''}
                    </span>
                    {p.descripcion && <small>{p.descripcion}</small>}
                  </div>
                  <b className="pa-horas">{formatearHoras(p.horas_totales)} h</b>
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
