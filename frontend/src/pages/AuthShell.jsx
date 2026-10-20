import { useState } from 'react'
import logoKairo from '../assets/logoKairo.jpeg'
import eyeOpen from '../assets/openeye.png'
import eyeClosed from '../assets/closedeye2.png'
import '../pagesCSS/AuthPages.css'

const PUNTOS = [
  'Plan de estudio, horarios y talleres en un solo lugar',
  'Seguimiento de créditos y materias aprobadas',
  'Planificación del semestre sin superposiciones',
]

export function AuthShell({ titulo, subtitulo, onVolver, pie, children }) {
  return (
    <main className="auth">
      <aside className="auth-marca">
        <div className="auth-logo">
          <img src={logoKairo} alt="" />
          <span>KAIRO</span>
        </div>
        <div className="auth-marca-cuerpo">
          <h2>Planificá tu carrera con información clara.</h2>
          <ul>
            {PUNTOS.map((p) => (
              <li key={p}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12l5 5L20 7" /></svg>
                {p}
              </li>
            ))}
          </ul>
        </div>
        <small>© {new Date().getFullYear()} Kairo</small>
      </aside>

      <section className="auth-panel">
        <div className="auth-caja">
          {onVolver && (
            <button type="button" className="auth-volver" onClick={onVolver}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M15 6l-6 6 6 6" /></svg>
              Volver al inicio
            </button>
          )}
          <h1>{titulo}</h1>
          <p className="auth-sub">{subtitulo}</p>
          {children}
          <p className="auth-pie">{pie}</p>
        </div>
      </section>
    </main>
  )
}

/** Campo con etiqueta y mensaje de error asociado al input. */
export function Campo({ id, etiqueta, error, tipo = 'text', alternar = false, ayuda, visible, onVisible, children, ...props }) {
  const [verLocal, setVerLocal] = useState(false)
  const ver = visible ?? verLocal
  const setVer = onVisible ?? setVerLocal
  const idError = `${id}-error`
  const esPassword = tipo === 'password'

  return (
    <div className={`auth-campo ${error ? 'auth-campo--error' : ''}`}>
      <label htmlFor={id}>{etiqueta}</label>
      <div className="auth-entrada">
        <input
          id={id}
          type={esPassword && ver ? 'text' : tipo}
          aria-invalid={error ? 'true' : undefined}
          aria-describedby={error ? idError : undefined}
          {...props}
        />
        {esPassword && alternar && (
          <button
            type="button"
            className="auth-ojo"
            onClick={() => setVer((v) => !v)}
            aria-label={ver ? 'Ocultar contraseña' : 'Mostrar contraseña'}
            aria-pressed={ver}
          >
            <img src={ver ? eyeOpen : eyeClosed} alt="" />
          </button>
        )}
      </div>
      {error && <p className="auth-error" id={idError} role="alert">{error}</p>}
      {!error && ayuda && <p className="auth-ayuda">{ayuda}</p>}
      {children}
    </div>
  )
}
