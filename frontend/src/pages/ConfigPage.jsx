import { useEffect, useState } from 'react'
import { apiFetch } from '../api'

function iniciales(nombre) {
  return nombre
    .split(' ')
    .map((p) => p[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()
}

function ConfigPage({ usuario = { nombre: 'Viky', email: 'viky@correo.um.edu.uy' }, onGuardar, tema = 'claro', degradado = 'original', onCambiarTema, onCambiarDegradado }) {
  const [costoCredito, setCostoCredito] = useState('')
  const [beca, setBeca] = useState('')
  const [presupuesto, setPresupuesto] = useState('')
  const [carrera, setCarrera] = useState('')
  const [carreras, setCarreras] = useState([])
  const [cargando, setCargando] = useState(true)
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState('')
  const [guardado, setGuardado] = useState(false)

  useEffect(() => {
    let vigente = true
    Promise.all([
      apiFetch('/api/presupuesto').then((res) => (res.ok ? res.json() : null)).catch(() => null),
      apiFetch('/api/carreras').then((res) => (res.ok ? res.json() : null)).catch(() => null),
    ]).then(([presupuestoGuardado, carrerasGuardadas]) => {
      if (!vigente) return
      setPresupuesto(presupuestoGuardado?.presupuesto_mensual == null ? '' : String(presupuestoGuardado.presupuesto_mensual))
      setBeca(presupuestoGuardado?.beca == null ? '' : String(presupuestoGuardado.beca))
      const disponibles = carrerasGuardadas?.carreras ?? []
      setCarreras(disponibles)
      setCarrera(disponibles[0]?.nombre ?? '')
      setCostoCredito(disponibles[0]?.valor_credito == null ? '' : String(disponibles[0].valor_credito))
      setCargando(false)
    })
    return () => { vigente = false }
  }, [])

  async function manejarGuardar(e) {
    e.preventDefault()
    setError('')
    if (costoCredito !== '' && !carrera) {
      setError('Elegí una carrera para guardar el costo del crédito.')
      return
    }
    setGuardando(true)
    try {
      const res = await apiFetch('/api/presupuesto', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          presupuesto_mensual: presupuesto === '' ? null : Number(presupuesto),
          beca: beca === '' ? 0 : Number(beca),
          ...(costoCredito === '' ? {} : { costo_credito: Number(costoCredito), carrera }),
        }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(json.error || 'No se pudieron guardar los datos.')
      onGuardar?.({ costoCredito: Number(costoCredito) || 0, beca: Number(beca) || 0, presupuesto: Number(presupuesto) || 0 })
      setGuardado(true)
      setTimeout(() => setGuardado(false), 2000)
    } catch (e) {
      setError(e.message || 'No se pudieron guardar los datos.')
    } finally {
      setGuardando(false)
    }
  }

  return (
    <main className="config-page">
      <header className="config-hero">
        <span className="config-blob config-blob--uno" aria-hidden="true" />
        <span className="config-blob config-blob--dos" aria-hidden="true" />
        <div className="config-hero-contenido">
          <span className="config-etiqueta">Tu espacio personal</span>
          <h1>Configuración</h1>
          <p>Administra tus datos y el presupuesto de tu carrera.</p>
        </div>
      </header>

      <div className="config-contenido">
        <section className="config-card config-apariencia" aria-labelledby="config-apariencia-titulo">
          <div className="config-seccion-cabecera">
            <div>
              <span className="config-seccion-etiqueta">Personalización</span>
              <h2 id="config-apariencia-titulo">Apariencia</h2>
            </div>
            <p>Elegí cómo se ve Kairo. Tus preferencias quedan guardadas en este dispositivo.</p>
          </div>

          <fieldset className="config-opciones">
            <legend>Modo de color</legend>
            <label className={`config-opcion ${tema === 'claro' ? 'config-opcion--activa' : ''}`}>
              <input type="radio" name="tema" value="claro" checked={tema === 'claro'} onChange={() => onCambiarTema?.('claro')} />
              <span className="config-opcion-muestra config-muestra-clara" aria-hidden="true" />
              <span><strong>Claro</strong><small>Fondos claros y texto oscuro</small></span>
            </label>
            <label className={`config-opcion ${tema === 'oscuro' ? 'config-opcion--activa' : ''}`}>
              <input type="radio" name="tema" value="oscuro" checked={tema === 'oscuro'} onChange={() => onCambiarTema?.('oscuro')} />
              <span className="config-opcion-muestra config-muestra-oscura" aria-hidden="true" />
              <span><strong>Oscuro</strong><small>Fondos oscuros y texto claro</small></span>
            </label>
          </fieldset>

          <fieldset className="config-opciones config-degradados">
            <legend>Degradado de fondo</legend>
            <label className={`config-opcion ${degradado === 'original' ? 'config-opcion--activa' : ''}`}>
              <input type="radio" name="degradado" value="original" checked={degradado === 'original'} onChange={() => onCambiarDegradado?.('original')} />
              <span className="config-opcion-muestra config-muestra-original" aria-hidden="true" />
              <span><strong>Original</strong><small>Violeta y rosa</small></span>
            </label>
            <label className={`config-opcion ${degradado === 'azul-verde' ? 'config-opcion--activa' : ''}`}>
              <input type="radio" name="degradado" value="azul-verde" checked={degradado === 'azul-verde'} onChange={() => onCambiarDegradado?.('azul-verde')} />
              <span className="config-opcion-muestra config-muestra-azul-verde" aria-hidden="true" />
              <span><strong>Azul y verde</strong><small>Degradado frío</small></span>
            </label>
            <label className={`config-opcion ${degradado === 'rojo-naranja' ? 'config-opcion--activa' : ''}`}>
              <input type="radio" name="degradado" value="rojo-naranja" checked={degradado === 'rojo-naranja'} onChange={() => onCambiarDegradado?.('rojo-naranja')} />
              <span className="config-opcion-muestra config-muestra-rojo-naranja" aria-hidden="true" />
              <span><strong>Rojo y naranja</strong><small>Degradado cálido</small></span>
            </label>
          </fieldset>
        </section>

        <section className="config-card" aria-labelledby="config-perfil-titulo">
          <div className="config-seccion-cabecera">
            <div>
              <span className="config-seccion-etiqueta">Cuenta</span>
              <h2 id="config-perfil-titulo">Tu perfil</h2>
            </div>
          </div>
          <div className="config-usuario">
            <div className="config-avatar">{iniciales(usuario.nombre)}</div>
            <div className="config-usuario-datos">
              <p className="config-usuario-nombre">{usuario.nombre}</p>
              <p className="config-usuario-email">{usuario.email}</p>
            </div>
          </div>
        </section>

        <form className="config-card config-form" onSubmit={manejarGuardar}>
          <div className="config-seccion-cabecera">
            <div>
              <span className="config-seccion-etiqueta">Planificación</span>
              <h2>Presupuesto de la carrera</h2>
            </div>
            <p>Estos datos te ayudan a organizar los costos de estudio.</p>
          </div>

          <div className="config-campos">
            <div className="config-campo">
              <label htmlFor="carreraCosto">Carrera</label>
              <div className="config-select-wrapper">
                <select
                  id="carreraCosto"
                  className="config-select"
                  value={carrera}
                  onChange={(e) => {
                    const seleccionada = carreras.find((item) => item.nombre === e.target.value)
                    setCarrera(e.target.value)
                    setCostoCredito(seleccionada?.valor_credito == null ? '' : String(seleccionada.valor_credito))
                  }}
                  disabled={cargando || carreras.length === 0}
                  aria-describedby="carreraCostoAyuda"
                >
                  <option value="">{cargando ? 'Cargando carreras…' : 'Seleccionar carrera'}</option>
                  {carreras.map((item) => <option key={item.nombre} value={item.nombre}>{item.nombre}</option>)}
                </select>
                <span className="config-select-flecha" aria-hidden="true" />
              </div>
              <small className="config-campo-ayuda" id="carreraCostoAyuda">
                {carreras.length ? 'El costo del crédito se guardará para esta carrera.' : 'Primero agregá una carrera desde Plan de estudio.'}
              </small>
            </div>

            <div className="config-campo">
              <label htmlFor="costoCredito">Costo del crédito</label>
              <div className="config-input-wrapper">
                <span className="config-input-prefijo">$</span>
                <input id="costoCredito" type="number" min="0" placeholder="0" value={costoCredito} onChange={(e) => setCostoCredito(e.target.value)} />
              </div>
            </div>

            <div className="config-campo">
              <label htmlFor="beca">Beca</label>
              <div className="config-input-wrapper">
                <input id="beca" type="number" min="0" max="100" placeholder="0" value={beca} onChange={(e) => setBeca(e.target.value)} />
                <span className="config-input-sufijo">%</span>
              </div>
            </div>

            <div className="config-campo">
              <label htmlFor="presupuesto">Presupuesto disponible mensual</label>
              <div className="config-input-wrapper">
                <span className="config-input-prefijo">$</span>
                <input id="presupuesto" type="number" min="0" placeholder="0" value={presupuesto} onChange={(e) => setPresupuesto(e.target.value)} />
              </div>
            </div>
          </div>

          {error && <p className="config-error" role="alert">{error}</p>}
          <button className="config-guardar" type="submit" disabled={guardando || cargando}>
            {guardado ? 'Guardado ✓' : 'Guardar cambios'}
          </button>
        </form>
      </div>
    </main>
  )
}

export default ConfigPage
