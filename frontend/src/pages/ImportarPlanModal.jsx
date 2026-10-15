import { useEffect, useState } from 'react'
import { apiFetch } from '../api'
import '../pagesCSS/ImportarPlan.css'

async function leerJson(res) {
  try {
    return await res.json()
  } catch {
    return {}
  }
}

const esArchivoPdf = (archivo) => Boolean(archivo) && /\.pdf$/i.test(archivo.name)

/** Da al resultado del PDF la misma forma que la vista previa de /plan/preview. */
function revisionDesdePdf(plan, nombreCarrera) {
  if (!plan) return null
  const materias = (plan.semestres ?? []).flatMap((s) =>
    (s.materias ?? []).map((m) => ({
      semestre: s.numero,
      nombre: m.nombre ?? '',
      creditos: Number(m.creditos) || 0,
      categoria: m.categoria ?? null,
      previas: [],
    }))
  )
  return {
    carrera: nombreCarrera.trim() || plan.carrera || '',
    valido: materias.length > 0,
    errores: materias.length ? [] : ['No se detectaron materias en el PDF.'],
    avisos: materias.length ? ['El PDF no incluye las previas: quedan vacías. Podés completarlas luego con un CSV.'] : [],
    materias,
    resumen: {
      materias: materias.length,
      creditos_total: materias.reduce((a, m) => a + m.creditos, 0),
      semestres: new Set(materias.map((m) => m.semestre)).size,
      con_previas: 0,
      total_previas: 0,
      categorias: new Set(materias.map((m) => m.categoria).filter(Boolean)).size,
      sin_semestre: 0,
    },
  }
}

function csvDesdeMaterias(materias) {
  const celda = (t) => `"${String(t ?? '').replace(/"/g, '""')}"`
  const filas = ['semestre;materia;creditos;categoria;previas']
  for (const m of materias) filas.push([m.semestre, celda(m.nombre), m.creditos, celda(m.categoria), ''].join(';'))
  return String.fromCharCode(0xFEFF) + filas.join(String.fromCharCode(13, 10))
}

function ImportarPlanModal({ abierto, archivoInicial = null, onCerrar, onImportado }) {
  const [archivo, setArchivo] = useState(archivoInicial)
  const [carrera, setCarrera] = useState('')
  const [revisionApi, setRevision] = useState(null)   // respuesta de /plan/preview (CSV, XLSX, JSON)
  const [planPdf, setPlanPdf] = useState(null)         // respuesta de /study-plan/import (PDF)
  const [arrastrando, setArrastrando] = useState(false)
  const [error, setError] = useState('')           // error de lectura o de red
  const [revisando, setRevisando] = useState(Boolean(archivoInicial))
  const [guardando, setGuardando] = useState(false)

  function limpiar() {
    setArchivo(null)
    setCarrera('')
    setRevision(null)
    setPlanPdf(null)
    setError('')
    setRevisando(false)
    setGuardando(false)
  }

  const esPdf = esArchivoPdf(archivo)
  const revision = esPdf ? revisionDesdePdf(planPdf, carrera) : revisionApi

  function elegirArchivo(elegido) {
    setArchivo(elegido)
    setRevision(null)
    setPlanPdf(null)
    setError('')
    setRevisando(Boolean(elegido))
  }

  function cerrar() {
    limpiar()
    onCerrar()
  }

  // Revisa el archivo (sin guardar nada) cada vez que cambia el archivo o el nombre de la carrera.
  useEffect(() => {
    if (!abierto || !archivo || esArchivoPdf(archivo)) return
    let vigente = true
    const espera = setTimeout(async () => {
      const datos = new FormData()
      datos.append('archivo', archivo)
      if (carrera.trim()) datos.append('carrera', carrera.trim())
      try {
        const res = await apiFetch('/api/plan/preview', { method: 'POST', body: datos })
        const json = await leerJson(res)
        if (!vigente) return
        if (!res.ok) {
          setRevision(null)
          setError(res.status >= 502 ? 'El servidor no responde. Verificá que el backend esté encendido.' : json.error || 'No se pudo leer el archivo.')
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

  // Un PDF se analiza una sola vez por archivo (puede tardar), sin repetirlo al cambiar el nombre.
  useEffect(() => {
    if (!abierto || !esArchivoPdf(archivo)) return
    let vigente = true
    ;(async () => {
      const datos = new FormData()
      datos.append('pdf', archivo)
      try {
        const res = await fetch('/api/study-plan/import', { method: 'POST', body: datos })
        const json = await leerJson(res)
        if (!vigente) return
        if (!res.ok) {
          setError(res.status >= 502 ? 'El servidor no responde. Verificá que el backend esté encendido.' : json.error || 'No se pudo leer el PDF.')
        } else {
          setPlanPdf(json)
        }
      } catch {
        if (vigente) setError('No se pudo conectar con el servidor.')
      } finally {
        if (vigente) setRevisando(false)
      }
    })()
    return () => { vigente = false }
  }, [abierto, archivo])

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
    if (esPdf) {
      // El PDF se guarda igual que un CSV: así el plan queda en la base y se ve en el selector de carreras.
      datos.append('archivo', new Blob([csvDesdeMaterias(revision.materias)], { type: 'text/csv' }), 'plan.csv')
      datos.append('carrera', revision.carrera || archivo.name.replace(/\.pdf$/i, ''))
    } else {
      datos.append('archivo', archivo)
      datos.append('carrera', revision.carrera)
    }
    try {
      const res = await apiFetch('/api/plan/importar', { method: 'POST', body: datos })
      const json = await leerJson(res)
      if (res.ok) {
        const nombre = json.carrera
        limpiar()
        onImportado(nombre)
        return
      }
      if (res.status === 422 && !esPdf) setRevision(json)
      else if (res.status === 422) setError(json.errores?.[0] || 'El plan detectado no es válido.')
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
            Subí tu plan en <strong>PDF</strong>, <strong>.csv</strong>, <strong>.xlsx</strong> o <strong>.json</strong>.
            Con CSV, XLSX o JSON, cada fila es una materia: semestre, materia, créditos, categoría y previas
            (varias previas se separan con “;”). Guardar reemplaza el plan anterior de esa carrera.
          </p>
          <p className="importar-plantillas">
            Plantillas: <a href="/api/plan/plantilla.csv">CSV para Excel</a> · <a href="/api/plan/plantilla.json">JSON</a>
          </p>

          <div className="importar-campos">
            <label
              className={`importar-archivo ${arrastrando ? 'importar-archivo--activo' : ''}`}
              onDragOver={(e) => { e.preventDefault(); setArrastrando(true) }}
              onDragLeave={() => setArrastrando(false)}
              onDrop={(e) => {
                e.preventDefault()
                setArrastrando(false)
                elegirArchivo(e.dataTransfer.files[0] ?? null)
              }}
            >
              <input
                type="file"
                accept=".pdf,.csv,.xlsx,.json"
                onChange={(e) => elegirArchivo(e.target.files[0] ?? null)}
              />
              <span>{archivo ? archivo.name : 'Elegir o arrastrar archivo'}</span>
            </label>

            <label className="importar-carrera">
              <span>Nombre de la carrera</span>
              <input
                type="text"
                value={carrera}
                maxLength={100}
                onChange={(e) => {
                  setCarrera(e.target.value)
                  if (archivo && !esPdf) setRevisando(true)
                }}
                placeholder={revision?.carrera || 'Si el archivo no lo trae'}
              />
            </label>
          </div>

          {revisando && <p className="importar-estado">{esPdf ? 'Analizando PDF… puede tardar unos segundos.' : 'Revisando archivo…'}</p>}
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
