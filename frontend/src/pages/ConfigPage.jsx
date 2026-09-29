import { useMemo, useState } from 'react'

const CREDITOS_TOTALES_CARRERA = 355 // total ECTS del plan de estudio

function iniciales(nombre) {
  return nombre
    .split(' ')
    .map((p) => p[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()
}

function formatearMoneda(valor) {
  return new Intl.NumberFormat('es-UY', { style: 'currency', currency: 'UYU', maximumFractionDigits: 0 }).format(valor || 0)
}

function ConfigPage({ usuario = { nombre: 'Viky', email: 'viky@correo.um.edu.uy' }, onGuardar }) {
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
    <main className="setings-page">
      <section className="setings-card">
        <header className="setings-header">
          <div>
            <h1 className="setings-title">Configuración</h1>
            <p className="setings-subtitle">Tus datos y el presupuesto de tu carrera</p>
          </div>
        </header>

        <div className="setings-usuario">
          <div className="setings-avatar">{iniciales(usuario.nombre)}</div>
          <div>
            <p className="setings-usuario-nombre">{usuario.nombre}</p>
            <p className="setings-usuario-email">{usuario.email}</p>
          </div>
        </div>

        <form className="setings-form" onSubmit={manejarGuardar}>
          <h2 className="setings-seccion-titulo">Presupuesto de la carrera</h2>

          <div className="setings-campos">
            <div className="setings-campo">
              <label htmlFor="costoCredito">Costo del crédito</label>
              <div className="setings-input-wrapper">
                <span className="setings-input-prefijo">$</span>
                <input
                  id="costoCredito"
                  type="number"
                  min="0"
                  placeholder="0"
                  value={costoCredito}
                  onChange={(e) => setCostoCredito(e.target.value)}
                />
              </div>
            </div>

            <div className="setings-campo">
              <label htmlFor="beca">Beca</label>
              <div className="setings-input-wrapper">
                <input
                  id="beca"
                  type="number"
                  min="0"
                  max="100"
                  placeholder="0"
                  value={beca}
                  onChange={(e) => setBeca(e.target.value)}
                />
                <span className="setings-input-sufijo">%</span>
              </div>
            </div>

            <div className="setings-campo">
              <label htmlFor="presupuesto">Presupuesto disponible mensual</label>
              <div className="setings-input-wrapper">
                <span className="setings-input-prefijo">$</span>
                <input
                  id="presupuesto"
                  type="number"
                  min="0"
                  placeholder="0"
                  value={presupuesto}
                  onChange={(e) => setPresupuesto(e.target.value)}
                />
              </div>
            </div>
          </div>


          <button className="setings-guardar" type="submit">
            {guardado ? 'Guardado ✓' : 'Guardar cambios'}
          </button>
        </form>
      </section>
    </main>
  )
}

export default ConfigPage
