import { useState } from 'react'
import logoKairo from '../assets/logoKairo.jpeg'
import eyeOpen from '../assets/openeye.png'
import eyeClosed from '../assets/closedeye2.png'
import '../pagesCSS/BienvenidaPage.css'

const FUNCIONES = [
  {
    titulo: 'Tu plan de estudio, claro',
    texto: 'Importá tu carrera desde PDF, CSV, XLSX o JSON y verla ordenada por semestre, categoría y créditos.',
    icono: 'M4 5h16M4 12h16M4 19h10',
  },
  {
    titulo: 'Horarios y talleres',
    texto: 'Cargá los horarios del semestre y los talleres que se dictan, y mirá todo agrupado por día.',
    icono: 'M8 3v3m8-3v3M4 9h16M5 5h14a1 1 0 011 1v13a1 1 0 01-1 1H5a1 1 0 01-1-1V6a1 1 0 011-1z',
  },
  {
    titulo: 'Seguí tu progreso',
    texto: 'Registrá las materias aprobadas y los créditos que ya completaste para saber cuánto te falta.',
    icono: 'M4 19V9m6 10V5m6 14v-7m4 7H2',
  },
  {
    titulo: 'Planificá el semestre',
    texto: 'Armá tu semana en un calendario y organizá tus clases sin que se superpongan.',
    icono: 'M5 12l5 5L20 7',
  },
]

const PASOS = [
  { titulo: 'Creá tu cuenta', texto: 'Registrate con tu email en menos de un minuto.' },
  { titulo: 'Cargá tu información', texto: 'Subí tu plan de estudio, los horarios y los talleres del semestre.' },
  { titulo: 'Organizá tu semestre', texto: 'Elegí materias y armá un horario que funcione para vos.' },
]

function BienvenidaPage({ onLogin, onSwitchToRegister }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [verPassword, setVerPassword] = useState(false)
  const [error, setError] = useState('')
  const [enviando, setEnviando] = useState(false)

  async function enviar(e) {
    e.preventDefault()
    setError('')
    setEnviando(true)
    try {
      const res = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      })
      let data = {}
      try { data = await res.json() } catch { /* respuesta sin JSON */ }
      if (res.ok) onLogin(data.usuario)
      else setError(res.status >= 502 ? 'El servidor no responde. Intentá de nuevo en unos minutos.' : data.error || 'No se pudo iniciar sesión.')
    } catch {
      setError('Error de conexión con el servidor.')
    } finally {
      setEnviando(false)
    }
  }

  function irAIngresar() {
    document.getElementById('land-email')?.focus()
  }

  return (
    <div className="land">
      <header className="land-nav">
        <div className="land-marca">
          <img src={logoKairo} alt="" />
          <span>KAIRO</span>
        </div>
        <nav aria-label="Principal">
          <a href="#funciones">Funciones</a>
          <a href="#como-funciona">Cómo funciona</a>
          <button type="button" className="land-btn land-btn--borde" onClick={onSwitchToRegister}>Crear cuenta</button>
        </nav>
      </header>

      <main>
        <section className="land-hero">
          <div className="land-hero-texto">
            <span className="land-etiqueta">Planificación académica</span>
            <h1>Organizá tu carrera, <em>semestre a semestre</em>.</h1>
            <p>
              Kairo reúne tu plan de estudio, los horarios y los talleres en un solo lugar,
              para que decidas qué cursar con toda la información a la vista.
            </p>
            <div className="land-hero-botones">
              <button type="button" className="land-btn land-btn--blanco" onClick={irAIngresar}>Iniciar sesión</button>
              <button type="button" className="land-btn land-btn--borde-blanco" onClick={onSwitchToRegister}>Crear una cuenta</button>
            </div>
            <ul className="land-formatos" aria-label="Formatos admitidos">
              <li>PDF</li><li>CSV</li><li>XLSX</li><li>JSON</li>
            </ul>
          </div>

          <form className="land-login" onSubmit={enviar} aria-labelledby="land-login-titulo">
            <h2 id="land-login-titulo">Iniciá sesión</h2>
            <p className="land-login-sub">Ingresá tus credenciales para continuar</p>

            <label htmlFor="land-email">Email</label>
            <input
              id="land-email"
              type="email"
              autoComplete="email"
              placeholder="tu@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />

            <label htmlFor="land-pass">Contraseña</label>
            <div className="land-pass">
              <input
                id="land-pass"
                type={verPassword ? 'text' : 'password'}
                autoComplete="current-password"
                placeholder="Tu contraseña"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
              <button
                type="button"
                onClick={() => setVerPassword((v) => !v)}
                aria-label={verPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                aria-pressed={verPassword}
              >
                <img src={verPassword ? eyeOpen : eyeClosed} alt="" />
              </button>
            </div>

            {error && <p className="land-error" role="alert">{error}</p>}

            <button type="submit" className="land-btn land-btn--primario" disabled={enviando}>
              {enviando ? 'Ingresando…' : 'Ingresar'}
            </button>

            <p className="land-registro">
              ¿No tenés usuario?{' '}
              <button type="button" onClick={onSwitchToRegister}>Crear una cuenta</button>
            </p>
          </form>
        </section>

        <section className="land-seccion" id="funciones">
          <h2>Todo lo que necesitás para tu semestre</h2>
          <div className="land-funciones">
            {FUNCIONES.map((f) => (
              <article className="land-funcion" key={f.titulo}>
                <span className="land-icono" aria-hidden="true">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d={f.icono} />
                  </svg>
                </span>
                <h3>{f.titulo}</h3>
                <p>{f.texto}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="land-seccion land-seccion--pasos" id="como-funciona">
          <h2>Cómo funciona</h2>
          <ol className="land-pasos">
            {PASOS.map((p, i) => (
              <li key={p.titulo}>
                <span className="land-paso-num">{i + 1}</span>
                <h3>{p.titulo}</h3>
                <p>{p.texto}</p>
              </li>
            ))}
          </ol>
        </section>
      </main>

      <footer className="land-pie">
        <span>© {new Date().getFullYear()} Kairo</span>
        <button type="button" onClick={onSwitchToRegister}>Crear una cuenta</button>
      </footer>
    </div>
  )
}

export default BienvenidaPage
