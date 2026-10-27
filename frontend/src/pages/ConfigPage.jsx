import { useState } from 'react'

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
  const [guardado, setGuardado] = useState(false)

  function manejarGuardar(e) {
    e.preventDefault()
    onGuardar?.({
      costoCredito: Number(costoCredito) || 0,
      beca: Number(beca) || 0,
      presupuesto: Number(presupuesto) || 0,
    })
    setGuardado(true)
    setTimeout(() => setGuardado(false), 2000)
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

          <button className="config-guardar" type="submit">
            {guardado ? 'Guardado ✓' : 'Guardar cambios'}
          </button>
        </form>
      </div>
    </main>
  )
}

export default ConfigPage
