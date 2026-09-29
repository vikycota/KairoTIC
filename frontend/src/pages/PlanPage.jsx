import { useState } from 'react'

const DIAS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']

const HORAS = Array.from(
  { length: 18 },
  (_, i) => 6 + i
)

const COLORES = [
  'chip-violet',
  'chip-cyan',
  'chip-pink'
]

function claveCelda(diaIndex, hora) {
  return `${diaIndex}-${hora}`
}

function PlanPage() {
  const [eventos, setEventos] = useState({})
  const [celdaEditando, setCeldaEditando] = useState(null)
  const [borrador, setBorrador] = useState('')

  function abrirCelda(clave) {
    setCeldaEditando(clave)
    setBorrador(eventos[clave]?.titulo ?? '')
  }

  function guardarCelda(clave) {
    setEventos((prev) => {
      const siguiente = { ...prev }

      if (borrador.trim() === '') {
        delete siguiente[clave]
      } else {
        const color =
          prev[clave]?.color ??
          COLORES[Math.floor(Math.random() * COLORES.length)]

        siguiente[clave] = {
          titulo: borrador.trim(),
          color
        }
      }

      return siguiente
    })

    setCeldaEditando(null)
    setBorrador('')
  }

  function quitarEvento(clave, e) {
    e.stopPropagation()

    setEventos((prev) => {
      const siguiente = { ...prev }

      delete siguiente[clave]

      return siguiente
    })
  }

  return (
    <main className="plan-page">

      <section className="plan-card">

        <header className="plan-header">

          <div className="plan-header-text">

            <h1 className="plan-title">
              Planificador de horarios
            </h1>

            <p className="plan-subtitle">
              Ingresa los horarios disponibles de las materias
              y deja que el planificador te recomiende materias compatibles
            </p>

          </div>

          <div className="planificar-buttons">

            <button
              className="ingresar-horario-button"
              type="button"
            >
              Ingresar horarios
            </button>

            <button
              className="planificar-horario-button"
              type="button"
            >
              Planificar horario
            </button>

            <button
              className="agregar-bloque-button"
              type="button"
            >
              Agregar bloque
            </button>

          </div>

        </header>


        <div className="plan-grid-shell">

          <div className="plan-grid-wrapper">

            <div className="plan-grid">

              <div className="plan-cell plan-corner">
                Hora
              </div>

              {DIAS.map((dia) => (
                <div
                  key={dia}
                  className="plan-cell plan-day-head"
                >
                  <span className="plan-day-nombre">
                    {dia}
                  </span>
                </div>
              ))}


              {HORAS.map((hora) => (

                <div
                  className="plan-row"
                  key={hora}
                >

                  <div className="plan-cell plan-hora">
                    {`${String(hora).padStart(2, '0')}:00`}
                  </div>


                  {DIAS.map((_, diaIndex) => {

                    const clave =
                      claveCelda(diaIndex, hora)

                    const evento =
                      eventos[clave]

                    const editando =
                      celdaEditando === clave

                    return (

                      <div
                        key={clave}
                        className="plan-cell plan-slot"

                      >

                        {editando ? (

                          <input
                            className="plan-slot-input"
                            autoFocus
                            value={borrador}
                            placeholder="Nombre del evento"

                            onChange={(e) =>
                              setBorrador(e.target.value)
                            }

                            onBlur={() =>
                              guardarCelda(clave)
                            }

                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                guardarCelda(clave)
                              }

                              if (e.key === 'Escape') {
                                setCeldaEditando(null)
                              }
                            }}

                            onClick={(e) =>
                              e.stopPropagation()
                            }
                          />

                        ) : evento ? (

                          <span
                            className={`plan-chip ${evento.color}`}
                          >

                            <span className="plan-chip-texto">
                              {evento.titulo}
                            </span>

                            <button
                              className="plan-chip-cerrar"
                              type="button"
                              aria-label="Quitar evento"

                              onClick={(e) =>
                                quitarEvento(clave, e)
                              }
                            >
                              ×
                            </button>

                          </span>

                        ) : (

                          <span
                            className="plan-slot-mas"
                            aria-hidden="true"
                          >
                            +
                          </span>

                        )}

                      </div>
                    )
                  })}

                </div>
              ))}

            </div>

          </div>

        </div>

      </section>

    </main>
  )
}

export default PlanPage