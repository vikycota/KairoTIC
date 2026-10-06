import { useEffect, useMemo, useState } from 'react'
import '../pagesCSS/ProgresoPage.css'

const NOTA_MAXIMA = 12
const CLAVE_EMAIL = 'kairo-email'

function hoy() {
  const d = new Date()
  const mes = String(d.getMonth() + 1).padStart(2, '0')
  const dia = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${mes}-${dia}`
}

function leerEmailGuardado() {
  try {
    return localStorage.getItem(CLAVE_EMAIL) ?? ''
  } catch {
    return ''
  }
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

function ProgresoPage({ emailUsuario = '' }) {
  const [emailEditable, setEmailEditable] = useState(leerEmailGuardado)
  const email = (emailUsuario || emailEditable).trim()

  const [carreras, setCarreras] = useState([])
  const [carrera, setCarrera] = useState('')
  const [planMaterias, setPlanMaterias] = useState([])
  const [completadas, setCompletadas] = useState([])
  const [cargando, setCargando] = useState(false)
  const [error, setError] = useState('')
  const [aviso, setAviso] = useState('')

  const [materia, setMateria] = useState('')
  const [nota, setNota] = useState('')
  const [fecha, setFecha] = useState(hoy)
  const [guardando, setGuardando] = useState(false)

  function guardarEmail(valor) {
    setEmailEditable(valor)
    try {
      localStorage.setItem(CLAVE_EMAIL, valor)
    } catch { /* sin almacenamiento: sigue funcionando en memoria */ }
  }

  useEffect(() => {
    fetch('/api/carreras')
      .then((res) => (res.ok ? res.json() : Promise.reject()))
      .then((data) => {
        setCarreras(data.carreras)
        setCarrera((actual) => actual || data.carreras[0]?.nombre || '')
      })
      .catch(() => setCarreras([]))
  }, [])

  useEffect(() => {
    if (!carrera) return
    let vigente = true
    fetch(`/api/plan?carrera=${encodeURIComponent(carrera)}`)
      .then((res) => (res.ok ? res.json() : Promise.reject()))
      .then((data) => vigente && setPlanMaterias(data.materias))
      .catch(() => vigente && setPlanMaterias([]))
    return () => { vigente = false }
  }, [carrera])

  function cargarCompletadas() {
    if (!email) {
      setCompletadas([])
      return () => {}
    }
    let vigente = true
    setCargando(true)
    fetch(`/api/materias-completadas?email=${encodeURIComponent(email)}`)
      .then(async (res) => {
        const json = await leerJson(res)
        if (!vigente) return
        if (res.ok) {
          setCompletadas(json.materias)
          setError('')
        } else {
          setCompletadas([])
          setError(json.error || 'No se pudo cargar tu progreso.')
        }
      })
      .catch(() => vigente && setError('No se pudo conectar con el servidor.'))
      .finally(() => vigente && setCargando(false))
    return () => { vigente = false }
  }

  // Espera a que termine de escribir el email antes de consultar.
  useEffect(() => {
    const espera = setTimeout(cargarCompletadas, 400)
    return () => clearTimeout(espera)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [email])

  const aprobadas = useMemo(() => new Set(completadas.map((c) => c.materia)), [completadas])
  const disponibles = planMaterias.filter((m) => !aprobadas.has(m.nombre))

  const creditosAprobados = completadas.reduce((acc, c) => acc + c.creditos, 0)
  const promedio = completadas.length
    ? completadas.reduce((acc, c) => acc + c.nota, 0) / completadas.length
    : null
  const creditosCarrera = carreras.find((c) => c.nombre === carrera)?.creditos ?? 0
  const porcentaje = creditosCarrera ? Math.min(100, Math.round((creditosAprobados / creditosCarrera) * 100)) : 0

  async function agregar(e) {
    e.preventDefault()
    setError('')
    setAviso('')
    setGuardando(true)
    try {
      const res = await fetch('/api/materias-completadas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, materia, nota: Number(nota), fecha }),
      })
      const json = await leerJson(res)
      if (res.ok) {
        setAviso(`${materia} guardada con nota ${Number(nota)}.`)
        setMateria('')
        setNota('')
        cargarCompletadas()
      } else {
        setError(json.error || 'No se pudo guardar la materia.')
      }
    } catch {
      setError('No se pudo conectar con el servidor.')
    }
    setGuardando(false)
  }

  async function quitar(nombre) {
    if (!window.confirm(`¿Quitar "${nombre}" de tus materias aprobadas?`)) return
    setError('')
    setAviso('')
    try {
      const res = await fetch('/api/materias-completadas', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, materia: nombre }),
      })
      if (res.ok) {
        cargarCompletadas()
      } else {
        setError((await leerJson(res)).error || 'No se pudo quitar la materia.')
      }
    } catch {
      setError('No se pudo conectar con el servidor.')
    }
  }

  const notaValida = nota !== '' && Number(nota) >= 0 && Number(nota) <= NOTA_MAXIMA
  const puedeGuardar = email && materia && notaValida && fecha && !guardando

  return (
    <main className="progreso-page">
      <section className="progreso-card">
        <header className="progreso-header">
          <h1 className="progreso-title">Mi progreso</h1>
          <p className="progreso-subtitle">Materias aprobadas hasta el momento y sus notas</p>
        </header>

        {!emailUsuario && (
          <label className="progreso-campo progreso-email">
            <span>Tu email</span>
            <input
              type="email"
              value={emailEditable}
              onChange={(e) => guardarEmail(e.target.value)}
              placeholder="alumno@correo.com"
            />
          </label>
        )}

        <div className="progreso-resumen">
          <div>
            <span className="progreso-resumen-etiqueta">Materias aprobadas</span>
            <span className="progreso-resumen-valor">{completadas.length}</span>
          </div>
          <div>
            <span className="progreso-resumen-etiqueta">Créditos aprobados</span>
            <span className="progreso-resumen-valor">
              {creditosAprobados}{creditosCarrera ? ` / ${creditosCarrera}` : ''}
            </span>
          </div>
          <div>
            <span className="progreso-resumen-etiqueta">Promedio</span>
            <span className="progreso-resumen-valor">{promedio === null ? '—' : promedio.toFixed(2)}</span>
          </div>
        </div>

        {creditosCarrera > 0 && (
          <div
            className="progreso-barra"
            role="progressbar"
            aria-valuenow={porcentaje}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label="Avance de la carrera"
          >
            <div className="progreso-barra-relleno" style={{ width: `${porcentaje}%` }} />
            <span className="progreso-barra-texto">{porcentaje}% de la carrera</span>
          </div>
        )}

        <form className="progreso-form" onSubmit={agregar}>
          <h2 className="progreso-seccion-titulo">Agregar materia aprobada</h2>

          {carreras.length === 0 ? (
            <p className="progreso-vacio">
              Todavía no hay planes de estudio cargados. Importá uno desde “Plan de estudio” para elegir tus materias.
            </p>
          ) : (
            <div className="progreso-campos">
              <label className="progreso-campo">
                <span>Carrera</span>
                <select value={carrera} onChange={(e) => { setCarrera(e.target.value); setMateria('') }}>
                  {carreras.map((c) => <option key={c.nombre} value={c.nombre}>{c.nombre}</option>)}
                </select>
              </label>

              <label className="progreso-campo progreso-campo-ancho">
                <span>Materia</span>
                <select value={materia} onChange={(e) => setMateria(e.target.value)} required>
                  <option value="">Elegí una materia</option>
                  {disponibles.map((m) => (
                    <option key={m.nombre} value={m.nombre}>
                      {m.nombre} ({m.creditos} créd.)
                    </option>
                  ))}
                </select>
              </label>

              <label className="progreso-campo">
                <span>Nota (0–{NOTA_MAXIMA})</span>
                <input
                  type="number"
                  min="0"
                  max={NOTA_MAXIMA}
                  step="0.01"
                  value={nota}
                  onChange={(e) => setNota(e.target.value)}
                  required
                />
              </label>

              <label className="progreso-campo">
                <span>Fecha</span>
                <input type="date" value={fecha} max={hoy()} onChange={(e) => setFecha(e.target.value)} required />
              </label>
            </div>
          )}

          <button type="submit" className="progreso-guardar" disabled={!puedeGuardar}>
            {guardando ? 'Guardando…' : 'Agregar materia'}
          </button>
          {!email && <p className="progreso-ayuda">Ingresá tu email para poder guardar.</p>}
        </form>

        {error && <p className="progreso-mensaje progreso-mensaje-error" role="alert">{error}</p>}
        {aviso && <p className="progreso-mensaje progreso-mensaje-ok" role="status">{aviso}</p>}

        <h2 className="progreso-seccion-titulo">Materias aprobadas</h2>
        {cargando ? (
          <p className="progreso-vacio">Cargando…</p>
        ) : completadas.length === 0 ? (
          <p className="progreso-vacio">Todavía no registraste materias aprobadas.</p>
        ) : (
          <div className="progreso-tabla-wrap">
            <table className="progreso-tabla">
              <thead>
                <tr>
                  <th>Materia</th>
                  <th>Créd.</th>
                  <th>Nota</th>
                  <th>Fecha</th>
                  <th><span className="progreso-solo-lectores">Acciones</span></th>
                </tr>
              </thead>
              <tbody>
                {completadas.map((c) => (
                  <tr key={c.materia}>
                    <td>{c.materia}</td>
                    <td>{c.creditos}</td>
                    <td><span className="progreso-nota">{c.nota}</span></td>
                    <td>{formatearFecha(c.fecha)}</td>
                    <td>
                      <button type="button" className="progreso-quitar" onClick={() => quitar(c.materia)}>
                        Quitar
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  )
}

export default ProgresoPage
