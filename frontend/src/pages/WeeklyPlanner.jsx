import { useMemo, useState } from 'react'
import '../PagesCSS/WeeklyPlanner.css'

const DIAS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']
const HORAS = Array.from({ length: 18 }, (_, i) => 6 + i) //array de 18 hs comenzando de las 6 am hasta las 23 pm
const COLORES = ['chip-violet', 'chip-cyan', 'chip-pink']

function getLunesDeSemana(offset) {
  const hoy = new Date()
  const dia = (hoy.getDay() + 6) % 7 // 0 = lunes
  const lunes = new Date(hoy)
  lunes.setDate(hoy.getDate() - dia + offset * 7)
  lunes.setHours(0, 0, 0, 0)
  return lunes
}

function formatearRango(lunes) {
  const domingo = new Date(lunes)
  domingo.setDate(lunes.getDate() + 6)
  const opciones = { day: 'numeric', month: 'short' }
  const inicio = lunes.toLocaleDateString('es-UY', opciones)
  const fin = domingo.toLocaleDateString('es-UY', opciones)
  return `${inicio} — ${fin}`
}

function claveCelda(diaIndex, hora) {
  return `${diaIndex}-${hora}`
}

const EVENTOS_INICIALES = {
  '0-9': { titulo: 'Reunión de equipo', color: 'chip-violet' },
  '1-14': { titulo: 'Gimnasio', color: 'chip-cyan' },
  '2-11': { titulo: 'Entrega TP', color: 'chip-pink' },
  '4-16': { titulo: 'Clase de inglés', color: 'chip-violet' },
}

function WeeklyPlanner() {
  const [weekOffset, setWeekOffset] = useState(0)
  const [eventos, setEventos] = useState(EVENTOS_INICIALES)
  const [celdaEditando, setCeldaEditando] = useState(null)
  const [borrador, setBorrador] = useState('')

  const lunes = useMemo(() => getLunesDeSemana(weekOffset), [weekOffset])
  const fechas = useMemo(
    () => DIAS.map((_, i) => {
      const f = new Date(lunes)
      f.setDate(lunes.getDate() + i)
      return f
    }),
    [lunes]
  )
  const hoyISO = new Date().toDateString()

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
        const color = prev[clave]?.color ?? COLORES[Math.floor(Math.random() * COLORES.length)]
        siguiente[clave] = { titulo: borrador.trim(), color }
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
    <main className="planner-page">

      <section className="planner-card">
        <header className="planner-header">
          <div>
            <h1 className="planner-title">Planificador semanal</h1>
            <p className="planner-subtitle">{formatearRango(lunes)}</p>
          </div>

          <div className="planner-nav">
            <button
              className="planner-nav-btn"
              type="button"
              onClick={() => setWeekOffset((w) => w - 1)}
              aria-label="Semana anterior"
            >
              ‹
            </button>
            <button
              className="planner-nav-btn"
              type="button"
              onClick={() => setWeekOffset(0)}
            >
              Hoy
            </button>
            <button
              className="planner-nav-btn"
              type="button"
              onClick={() => setWeekOffset((w) => w + 1)}
              aria-label="Semana siguiente"
            >
              ›
            </button>
          </div>
        </header>
        <div className="planner-grid-shell">
            <div className="planner-grid-wrapper">
                <div className="planner-grid">
                    <div className="planner-cell planner-corner">Hora</div>
                    {DIAS.map((dia, i) => {
                    const esHoy = fechas[i].toDateString() === hoyISO
                    return (
                        <div
                        key={dia}
                        className={`planner-cell planner-day-head ${esHoy ? 'planner-day-head--today' : ''}`}
                        >
                        <span className="planner-day-nombre">{dia}</span>
                        <span className="planner-day-numero">{fechas[i].getDate()}</span>
                        </div>
                    )
                    })}

                    {HORAS.map((hora) => (
                    <div className="planner-row" key={hora}>
                        <div className="planner-cell planner-hora">{`${String(hora).padStart(2, '0')}:00`}</div>
                        {DIAS.map((_, diaIndex) => {
                        const clave = claveCelda(diaIndex, hora)
                        const evento = eventos[clave]
                        const editando = celdaEditando === clave

                        return (
                            <div
                            key={clave}
                            className="planner-cell planner-slot"
                            onClick={() => !editando && abrirCelda(clave)}
                            >
                            {editando ? (
                                <input
                                className="planner-slot-input"
                                autoFocus
                                value={borrador}
                                placeholder="Nombre del evento"
                                onChange={(e) => setBorrador(e.target.value)}
                                onBlur={() => guardarCelda(clave)}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') guardarCelda(clave)
                                    if (e.key === 'Escape') setCeldaEditando(null)
                                }}
                                onClick={(e) => e.stopPropagation()}
                                />
                            ) : evento ? (
                                <span className={`planner-chip ${evento.color}`}>
                                <span className="planner-chip-texto">{evento.titulo}</span>
                                <button
                                    className="planner-chip-cerrar"
                                    type="button"
                                    aria-label="Quitar evento"
                                    onClick={(e) => quitarEvento(clave, e)}
                                >
                                    ×
                                </button>
                                </span>
                            ) : (
                                <span className="planner-slot-mas" aria-hidden="true">+</span>
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

export default WeeklyPlanner
