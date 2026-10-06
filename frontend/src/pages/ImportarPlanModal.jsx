import { useEffect, useState } from 'react'
import '../pagesCSS/ImportarPlan.css'

async function leerJson(res) {
  try {
    return await res.json()
  } catch {
    return {}
  }
}

function ImportarPlanModal({ abierto, onCerrar, onImportado }) {
  const [archivo, setArchivo] = useState(null)
  const [carrera, setCarrera] = useState('')
  const [revision, setRevision] = useState(null)   // respuesta de /plan/preview
  const [error, setError] = useState('')           // error de lectura o de red
  const [revisando, setRevisando] = useState(false)
  const [guardando, setGuardando] = useState(false)

  function limpiar() {
    setArchivo(null)
    setCarrera('')
    setRevision(null)
    setError('')
    setRevisando(false)
    setGuardando(false)
  }

  function cerrar() {
    limpiar()
    onCerrar()
  }

  // Revisa el archivo (sin guardar nada) cada vez que cambia el archivo o el nombre de la carrera.
  useEffect(() => {
    if (!abierto || !archivo) return
    let vigente = true
    const espera = setTimeout(async () => {
      const datos = new FormData()
      datos.append('archivo', archivo)
      if (carrera.trim()) datos.append('carrera', carrera.trim())
      try {
        const res = await fetch('/api/plan/preview', { method: 'POST', body: datos })
        const json = await leerJson(res)
        if (!vigente) return
        if (!res.ok) {
          setRevision(null)
          setError(json.error || 'No se pudo leer el archivo.')
        } else {
          setRevision(json)
          setError('')
        }
      } catch {
        if (vigente) setError('No se pudo conectar con el servidor.')
      } finally {
        if (vigente) setRevisando(false)
      }
    }, 350)
    return () => {
      vigente = false
      clearTimeout(espera)
    }
  }, [abierto, archivo, carrera])

  // Escape cierra el modal
  useEffect(() => {
    if (!abierto) return
    const alTeclear = (e) => e.key === 'Escape' && !guardando && cerrar()
    window.addEventListener('keydown', alTeclear)
    return () => window.removeEventListener('keydown', alTeclear)
  })

  async function guardar() {
    setGuardando(true)
    setError('')
    const datos = new FormData()
    datos.append('archivo', archivo)
    datos.append('carrera', revision.carrera)
    try {
      const res = await fetch('/api/plan/importar', { method: 'POST', body: datos })
      const json = await leerJson(res)
      if (res.ok) {
        const nombre = json.carrera
        limpiar()
        onImportado(nombre)
        return
      }
      if (res.status === 422) setRevision(json)
      else setError(json.error || 'No se pudo guardar el plan.')
    } catch {
      setError('No se pudo conectar con el servidor.')
    }
    setGuardando(false)
  }

  if (!abierto) return null

  const puedeGuardar = revision?.valido && !revisando && !guardando

  return (
    <div className="importar-fondo" onMouseDown={(e) => e.target === e.currentTarget && !guardando && cerrar()}>
      <div className="importar-modal" role="dialog" aria-modal="true" aria-labelledby="importar-titulo">
        <header className="importar-cabecera">
          <h2 id="importar-titulo">Agregar plan de estudio</h2>
          <button type="button" className="importar-cerrar" onClick={cerrar} aria-label="Cerrar" disabled={guardando}>
            ×
          </button>
        </header>

        <div className="importar-cuerpo">
          <p className="importar-ayuda">
            Subí un archivo <strong>.csv</strong>, <strong>.xlsx</strong> o <strong>.json</strong> con una fila por
            materia: semestre, materia, créditos, categoría y previas (varias previas se separan con “;”).
            Guardar reemplaza el plan anterior de esa carrera.
          </p>
          <p className="importar-plantillas">
            Plantillas: <a href="/api/plan/plantilla.csv">CSV para Excel</a> · <a href="/api/plan/plantilla.json">JSON</a>
          </p>

          <div className="importar-campos">
            <label className="importar-archivo">
              <input
                type="file"
                accept=".csv,.xlsx,.json"
                onChange={(e) => {
                  const elegido = e.target.files[0] ?? null
                  setArchivo(elegido)
                  setRevision(null)
                  setError('')
                  setRevisando(Boolean(elegido))
                }}
              />
              <span>{archivo ? archivo.name : 'Elegir archivo'}</span>
            </label>

            <label className="importar-carrera">
              <span>Nombre de la carrera</span>
              <input
                type="text"
                value={carrera}
                maxLength={100}
                onChange={(e) => {
                  setCarrera(e.target.value)
                  if (archivo) setRevisando(true)
                }}
                placeholder={revision?.carrera || 'Si el archivo no lo trae'}
              />
            </label>
          </div>

          {revisando && <p className="importar-estado">Revisando archivo…</p>}
          {error && <p className="importar-caja importar-caja-error" role="alert">{error}</p>}

          {revision && !revisando && (
            <div className="importar-resultado">
              <p className="importar-resumen">
                <strong>{revision.carrera || 'Sin nombre de carrera'}</strong>
                {' — '}
                {revision.resumen.materias} materias, {revision.resumen.creditos_total} créditos,{' '}
                {revision.resumen.semestres} semestres, {revision.resumen.con_previas} con previas ({revision.resumen.total_previas} en total), {revision.resumen.categorias} categorías
                {revision.resumen.sin_semestre > 0 && `, ${revision.resumen.sin_semestre} fuera de semestre`}
              </p>

              {revision.errores.length > 0 && (
                <div className="importar-caja importar-caja-error" role="alert">
                  <strong>Corregí esto y volvé a subir el archivo:</strong>
                  <ul>{revision.errores.map((t, i) => <li key={i}>{t}</li>)}</ul>
                </div>
              )}

              {revision.avisos.length > 0 && (
                <div className="importar-caja importar-caja-aviso">
                  <strong>Avisos (no impiden guardar):</strong>
                  <ul>{revision.avisos.map((t, i) => <li key={i}>{t}</li>)}</ul>
                </div>
              )}

              {revision.materias.length > 0 && (
                <div className="importar-tabla-wrap">
                  <table className="importar-tabla">
                    <thead>
                      <tr>
                        <th>Sem.</th>
                        <th>Materia</th>
                        <th>Créd.</th>
                        <th>Categoría</th>
                        <th>Previas</th>
                      </tr>
                    </thead>
                    <tbody>
                      {revision.materias.map((m) => (
                        <tr key={m.nombre}>
                          <td>{m.semestre ?? '—'}</td>
                          <td>{m.nombre}</td>
                          <td>{m.creditos}</td>
                          <td>{m.categoria ?? '—'}</td>
                          <td>{m.previas.length ? m.previas.join(', ') : '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>

        <footer className="importar-pie">
          <button type="button" className="importar-secundario" onClick={cerrar} disabled={guardando}>
            Cancelar
          </button>
          <button type="button" className="importar-primario" onClick={guardar} disabled={!puedeGuardar}>
            {guardando ? 'Guardando…' : 'Guardar plan'}
          </button>
        </footer>
      </div>
    </div>
  )
}

export default ImportarPlanModal
