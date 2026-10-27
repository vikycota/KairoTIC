import { useCallback, useEffect, useState } from 'react'
import '../pagesCSS/ScheduleImportPanel.css'
import { apiFetch, EVENTO_CARRERAS_ACTUALIZADAS } from '../api'

async function leerJson(res) {
  try { return await res.json() } catch { return {} }
}

function ScheduleImportPanel({
  onImported,
  carrerasDisponibles,
  carreraInicial = '',
  anioInicial = new Date().getFullYear(),
  semestreInicial = String(new Date().getMonth() >= 6 ? 2 : 1),
  consultarHorariosExistentes = true,
  onSchedulesLoaded,
  permitirEliminar = false,
  onSchedulesDeleted,
}) {
  const [carrerasRemotas, setCarrerasRemotas] = useState([])
  const carreras = carrerasDisponibles ?? carrerasRemotas
  const [carrera, setCarrera] = useState(carreraInicial)
  const carreraActiva = carrera || carreras[0]?.nombre || ''
  const [anio, setAnio] = useState(String(anioInicial))
  const [semestre, setSemestre] = useState(String(semestreInicial))
  const [archivo, setArchivo] = useState(null)
  const [preview, setPreview] = useState(null)
  const [error, setError] = useState('')
  const [mensaje, setMensaje] = useState('')
  const [analizando, setAnalizando] = useState(false)
  const [guardando, setGuardando] = useState(false)
  const [eliminando, setEliminando] = useState(false)
  const [bloques, setBloques] = useState([])
  const [cargando, setCargando] = useState(false)
  const [errorCarga, setErrorCarga] = useState('')

  const actualizarCarreras = useCallback(async (carreraImportada = '') => {
    if (carrerasDisponibles) return
    try {
      const res = await apiFetch('/api/carreras', { cache: 'no-store' })
      const json = await leerJson(res)
      if (!res.ok) throw new Error(json.error || 'No se pudieron cargar las carreras.')
      let disponibles = json.carreras ?? []
      if (carreraImportada && !disponibles.some((item) => item.nombre === carreraImportada)) {
        disponibles = [...disponibles, { nombre: carreraImportada }].sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'))
      }
      setCarrerasRemotas(disponibles)
      if (carreraImportada) setCarrera(carreraImportada)
      setError('')
    } catch (err) {
      setError(err.message || 'No se pudieron cargar las carreras.')
    }
  }, [carrerasDisponibles])

  useEffect(() => {
    if (carrerasDisponibles) return undefined
    const inicioCarga = window.setTimeout(() => actualizarCarreras(), 0)
    const alActualizar = (event) => actualizarCarreras(event.detail?.carrera ?? '')
    window.addEventListener(EVENTO_CARRERAS_ACTUALIZADAS, alActualizar)
    return () => {
      window.clearTimeout(inicioCarga)
      window.removeEventListener(EVENTO_CARRERAS_ACTUALIZADAS, alActualizar)
    }
  }, [actualizarCarreras, carrerasDisponibles])

  const cargarHorarios = useCallback(async () => {
    if (!carreraActiva || !anio || !semestre) { setBloques([]); return }
    setCargando(true)
    try {
      const query = new URLSearchParams({ carrera: carreraActiva, anio_lectivo: anio, semestre_lectivo: semestre })
      const res = await apiFetch(`/api/horarios?${query}`)
      const json = await leerJson(res)
      if (!res.ok) throw new Error(json.error || 'No se pudieron cargar los horarios.')
      setBloques(json.bloques ?? [])
      onSchedulesLoaded?.(json)
      setErrorCarga('')
    } catch (err) {
      setBloques([])
      setErrorCarga(err.message || 'No se pudieron cargar los horarios.')
    } finally {
      setCargando(false)
    }
  }, [carreraActiva, anio, semestre, onSchedulesLoaded])

  useEffect(() => {
    if (!consultarHorariosExistentes) return undefined
    const temporizador = window.setTimeout(cargarHorarios, 0)
    return () => window.clearTimeout(temporizador)
  }, [cargarHorarios, consultarHorariosExistentes])

  function formulario() {
    const data = new FormData()
    data.append('archivo', archivo)
    data.append('carrera', carreraActiva)
    data.append('anio_lectivo', anio)
    data.append('semestre_lectivo', semestre)
    return data
  }

  async function analizar(e) {
    e.preventDefault()
    setError('')
    setMensaje('')
    if (!carreraActiva) { setError('No seleccionaste una carrera.'); return }
    if (!archivo) { setError('Elegí un archivo .csv, .xlsx o .json.'); return }
    setAnalizando(true)
    try {
      const res = await apiFetch('/api/horarios/preview', { method: 'POST', body: formulario() })
      const json = await leerJson(res)
      if (!res.ok) throw new Error(json.error || json.errores?.join(' ') || 'No se pudo analizar el archivo.')
      setPreview(json)
    } catch (err) {
      setPreview(null)
      setError(err.message || 'No se pudo conectar con el servidor.')
    } finally { setAnalizando(false) }
  }

  async function guardar() {
    setGuardando(true)
    setError('')
    try {
      const res = await apiFetch('/api/horarios/importar', { method: 'POST', body: formulario() })
      const json = await leerJson(res)
      if (!res.ok) {
        if (res.status === 422) setPreview(json)
        throw new Error(json.error || json.errores?.join(' ') || 'No se pudieron guardar los horarios.')
      }
      setPreview(null)
      setMensaje(json.mensaje || 'Horarios guardados correctamente.')
      if (consultarHorariosExistentes) await cargarHorarios()
      onImported?.(json)
    } catch (err) {
      setError(err.message || 'No se pudo conectar con el servidor.')
    } finally { setGuardando(false) }
  }

  async function eliminarHorarios() {
    if (!bloques.length || !carreraActiva || !window.confirm(`¿Eliminar todos los horarios de ${carreraActiva}, ${anio}, semestre ${semestre}?`)) return
    setEliminando(true)
    setError('')
    setMensaje('')
    try {
      const query = new URLSearchParams({ carrera: carreraActiva, anio_lectivo: anio, semestre_lectivo: semestre })
      const res = await apiFetch(`/api/horarios?${query}`, { method: 'DELETE' })
      const json = await leerJson(res)
      if (!res.ok) throw new Error(json.error || 'No se pudieron eliminar los horarios.')
      setBloques([])
      setPreview(null)
      setMensaje(json.mensaje || 'Se eliminaron los horarios del período seleccionado.')
      onSchedulesDeleted?.({ carrera: carreraActiva, anio_lectivo: anio, semestre_lectivo: semestre })
    } catch (err) {
      setError(err.message || 'No se pudo conectar con el servidor.')
    } finally {
      setEliminando(false)
    }
  }

  const puedeGuardar = preview?.valido && !analizando && !guardando

  return (
    <section className="schedule-import-card" aria-labelledby="schedule-import-title">
      <header className="schedule-import-heading">
        <div>
          <h2 id="schedule-import-title">Horarios de cursada</h2>
          <p>Importá y consultá los bloques de una carrera y período académico.</p>
        </div>
      </header>
      <form className="schedule-import-form" onSubmit={analizar}>
        <label>
          <span>Carrera</span>
          <select value={carreraActiva} onChange={(e) => { setCarrera(e.target.value); setPreview(null) }}>
            <option value="">Seleccionar carrera</option>
            {carreras.map((item) => <option key={item.nombre} value={item.nombre}>{item.nombre}</option>)}
          </select>
        </label>
        <label>
          <span>Año lectivo</span>
          <input type="number" min="1900" max="9999" value={anio} onChange={(e) => { setAnio(e.target.value); setPreview(null) }} />
        </label>
        <label>
          <span>Semestre</span>
          <select value={semestre} onChange={(e) => { setSemestre(e.target.value); setPreview(null) }}>
            <option value="1">1</option><option value="2">2</option>
          </select>
        </label>
        <label className="schedule-file-field">
          <span>Archivo</span>
          <input type="file" accept=".csv,.xlsx,.json" onChange={(e) => { setArchivo(e.target.files?.[0] ?? null); setPreview(null); setError(''); setMensaje('') }} />
        </label>
        <button className="schedule-primary" type="submit" disabled={analizando}>
          {analizando ? 'Analizando…' : 'Analizar horarios'}
        </button>
      </form>
      <p className="schedule-help">Subí un archivo .csv, .xlsx o .json con una fila por bloque horario: materia, año de carrera, grupo, día, hora de inicio, hora de fin, docente, tipo y opcional. Guardar reemplaza los horarios anteriores de esa carrera y período.</p>
      <p className="schedule-templates">Plantillas: <a href="/api/horarios/plantilla.csv">CSV para Excel</a> · <a href="/api/horarios/plantilla.xlsx">XLSX</a> · <a href="/api/horarios/plantilla.json">JSON</a></p>
      {error && <p className="schedule-message schedule-error" role="alert">{error}</p>}
      {mensaje && <p className="schedule-message schedule-success" role="status">{mensaje}</p>}

      {preview && <section className="schedule-preview" aria-label="Vista previa de horarios">
        <div className="schedule-preview-summary">
          <strong>{preview.carrera} · {preview.anio_lectivo} · Semestre {preview.semestre_lectivo}</strong>
          <span>{preview.resumen?.materias ?? 0} materias · {preview.resumen?.bloques ?? 0} bloques · {preview.resumen?.grupos ?? 0} grupos</span>
        </div>
        {preview.errores?.length > 0 && <div className="schedule-message schedule-error"><strong>Corregí estos problemas:</strong><ul>{preview.errores.map((item, i) => <li key={i}>{item}</li>)}</ul></div>}
        {preview.avisos?.length > 0 && <div className="schedule-message"><ul>{preview.avisos.map((item, i) => <li key={i}>{item}</li>)}</ul></div>}
        {preview.bloques?.length > 0 && <div className="schedule-table-wrap"><table className="schedule-table"><thead><tr><th>Materia</th><th>Grupo</th><th>Día</th><th>Horario</th><th>Tipo</th><th>Docente</th><th>Opcional</th></tr></thead><tbody>
          {preview.bloques.map((b, i) => <tr key={`${b.fila}-${i}`}><td>{b.materia}</td><td>{b.grupo}</td><td>{b.dia}</td><td>{b.hora_inicio}–{b.hora_fin}</td><td>{b.tipo}</td><td>{b.docente || '—'}</td><td>{b.opcional ? 'Sí' : 'No'}</td></tr>)}
        </tbody></table></div>}
        <div className="schedule-preview-actions">
          <button type="button" className="schedule-secondary" onClick={() => setPreview(null)} disabled={guardando}>Cancelar</button>
          <button type="button" className="schedule-primary" onClick={guardar} disabled={!puedeGuardar}>{guardando ? 'Guardando…' : 'Guardar horarios'}</button>
        </div>
      </section>}

      {consultarHorariosExistentes && <div className="schedule-current">
        <h3>Horarios guardados · {carreraActiva || 'Seleccioná una carrera'} · {anio} · Semestre {semestre}</h3>
        {errorCarga && <p className="schedule-message schedule-error" role="alert">{errorCarga}</p>}
        {cargando ? <p>Cargando horarios…</p> : bloques.length === 0 ? <p>No hay horarios guardados para este período.</p> : (
          <div className="schedule-table-wrap"><table className="schedule-table"><thead><tr><th>Materia</th><th>Grupo</th><th>Día</th><th>Horario</th><th>Tipo</th><th>Docente</th><th>Opcional</th></tr></thead><tbody>
          {bloques.map((b, i) => <tr key={`${b.materia}-${b.dia}-${b.hora_inicio}-${i}`}><td>{b.materia}</td><td>{b.grupo}</td><td>{b.dia}</td><td>{b.hora_inicio}–{b.hora_fin}</td><td>{b.tipo}</td><td>{b.docente || '—'}</td><td>{b.opcional ? 'Sí' : 'No'}</td></tr>)}
          </tbody></table></div>
        )}
        {permitirEliminar && bloques.length > 0 && <div className="schedule-current-actions">
          <button type="button" className="schedule-danger" onClick={eliminarHorarios} disabled={eliminando || cargando}>
            {eliminando ? 'Eliminando…' : `Eliminar horarios de este semestre (${semestre})`}
          </button>
        </div>}
      </div>}
    </section>
  )
}

export default ScheduleImportPanel
