import { useEffect, useRef, useState } from 'react'
import logoKairo from '../assets/logoKairo.jpeg'
import eyeOpen from '../assets/openeye.png'
import eyeClosed from '../assets/closedeye2.png'
import '../pagesCSS/BienvenidaPage.css'

const PALABRAS = ['semestre a semestre', 'materia a materia', 'crédito a crédito']

const FUNCIONES = [
  {
    clase: 'land-bento--grande',
    titulo: 'Tu plan de estudio, claro',
    texto: 'Importá tu carrera desde PDF, CSV, XLSX o JSON y verla ordenada por semestre, categoría y créditos.',
    icono: 'M4 5h16M4 12h16M4 19h10',
  },
  {
    titulo: 'Horarios y talleres',
    texto: 'Cargá los horarios del semestre y los talleres que se dictan, agrupados por día.',
    icono: 'M8 3v3m8-3v3M4 9h16M5 5h14a1 1 0 011 1v13a1 1 0 01-1 1H5a1 1 0 01-1-1V6a1 1 0 011-1z',
  },
  {
    titulo: 'Seguí tu progreso',
    texto: 'Registrá las materias aprobadas y los créditos completados para saber cuánto te falta.',
    icono: 'M4 19V9m6 10V5m6 14v-7m4 7H2',
  },
  {
    clase: 'land-bento--grande',
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

const MATERIAS = [
  { nombre: 'Historia Moderna', cred: 6, tono: 'lila' },
  { nombre: 'Historia de América II', cred: 6, tono: 'rosa' },
  { nombre: 'Historia del Uruguay I', cred: 6, tono: 'menta' },
  { nombre: 'Fuentes y Métodos II', cred: 6, tono: 'arena' },
  { nombre: 'Teoría Política', cred: 6, tono: 'lila' },
]

/** Marca los elementos con data-reveal cuando entran en pantalla. */
function useRevelar() {
  const raiz = useRef(null)
  useEffect(() => {
    const nodos = raiz.current?.querySelectorAll('[data-reveal]') ?? []
    if (!('IntersectionObserver' in window)) {
      nodos.forEach((n) => n.classList.add('visible'))
      return
    }
    const obs = new IntersectionObserver((entradas) => {
      entradas.forEach((e) => {
        if (e.isIntersecting) {
          e.target.classList.add('visible')
          obs.unobserve(e.target)
        }
      })
    }, { threshold: 0.2 })
    nodos.forEach((n) => obs.observe(n))
    return () => obs.disconnect()
  }, [])
  return raiz
}

function BienvenidaPage({ onLogin, onSwitchToRegister }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [verPassword, setVerPassword] = useState(false)
  const [errores, setErrores] = useState({})
  const [enviando, setEnviando] = useState(false)
  const [palabra, setPalabra] = useState(0)
  const raiz = useRevelar()

  // La frase del título rota sola, salvo que la persona prefiera menos movimiento.
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const t = setInterval(() => setPalabra((p) => (p + 1) % PALABRAS.length), 2800)
    return () => clearInterval(t)
  }, [])

  async function enviar(e) {
    e.preventDefault()
    setErrores({})
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
      else if (res.status >= 502) setErrores({ general: 'El servidor no responde. Intentá de nuevo en unos minutos.' })
      else if (data.campo === 'email' || data.campo === 'password') {
        setErrores({ [data.campo]: data.error })
        document.getElementById(data.campo === 'email' ? 'land-email' : 'land-pass')?.focus()
      } else setErrores({ general: data.error || 'No se pudo iniciar sesión.' })
    } catch {
      setErrores({ general: 'Error de conexión con el servidor.' })
    } finally {
      setEnviando(false)
    }
  }

  function irAIngresar() {
    document.getElementById('land-email')?.focus()
  }

  // Luz que sigue al cursor en las tarjetas.
  function seguirCursor(e) {
    const r = e.currentTarget.getBoundingClientRect()
    e.currentTarget.style.setProperty('--x', `${e.clientX - r.left}px`)
    e.currentTarget.style.setProperty('--y', `${e.clientY - r.top}px`)
  }

  return (
    <div className="land" ref={raiz}>
      <header className="land-nav">
        <div className="land-marca">
          <img src={logoKairo} alt="" />
          <span>KAIRO</span>
        </div>
        <nav aria-label="Principal">
          <a href="#funciones">Funciones</a>
          <a href="#como-funciona">Cómo funciona</a>
          <button type="button" className="land-btn land-btn--vidrio" onClick={onSwitchToRegister}>Crear cuenta</button>
        </nav>
      </header>

      <main>
        <section className="land-hero">
          <span className="land-blob land-blob--1" aria-hidden="true" />
          <span className="land-blob land-blob--2" aria-hidden="true" />
          <span className="land-grilla" aria-hidden="true" />

          <div className="land-hero-texto">
            <span className="land-etiqueta"><i aria-hidden="true" /> Planificación académica</span>
            <h1>
              Organizá tu carrera,
              <span className="land-rota" aria-live="off">
                <em key={palabra}>{PALABRAS[palabra]}</em>
              </span>
            </h1>
            <p>
              Kairo reúne tu plan de estudio, los horarios y los talleres en un solo lugar,
              para que decidas qué cursar con toda la información a la vista.
            </p>
            <div className="land-hero-botones">
              <button type="button" className="land-btn land-btn--rosa" onClick={irAIngresar}>Iniciar sesión</button>
              <button type="button" className="land-btn land-btn--vidrio" onClick={onSwitchToRegister}>Crear una cuenta</button>
            </div>

            <div className="land-tablero" aria-hidden="true">
              <div className="land-tablero-cab">
                <strong>Tercer semestre</strong>
                <span>30 ECTS</span>
              </div>
              <div className="land-tablero-chips">
                {MATERIAS.map((m, i) => (
                  <span key={m.nombre} className={`land-chip land-chip--${m.tono}`} style={{ '--i': i }}>
                    {m.nombre}<b>{m.cred}</b>
                  </span>
                ))}
              </div>
              <div className="land-tablero-barra"><span /></div>
            </div>
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
              onChange={(e) => { setEmail(e.target.value); setErrores((x) => ({ ...x, email: '' })) }}
              aria-invalid={errores.email ? 'true' : undefined}
              aria-describedby={errores.email ? 'land-email-error' : undefined}
              required
            />
            {errores.email && <p className="land-error land-error--campo" id="land-email-error" role="alert">{errores.email}</p>}

            <label htmlFor="land-pass">Contraseña</label>
            <div className="land-pass">
              <input
                id="land-pass"
                type={verPassword ? 'text' : 'password'}
                autoComplete="current-password"
                placeholder="Tu contraseña"
                value={password}
                onChange={(e) => { setPassword(e.target.value); setErrores((x) => ({ ...x, password: '' })) }}
                aria-invalid={errores.password ? 'true' : undefined}
                aria-describedby={errores.password ? 'land-pass-error' : undefined}
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

            {errores.password && <p className="land-error land-error--campo" id="land-pass-error" role="alert">{errores.password}</p>}
            {errores.general && <p className="land-error" role="alert">{errores.general}</p>}

            <button type="submit" className="land-btn land-btn--primario" disabled={enviando}>
              {enviando ? 'Ingresando…' : 'Ingresar'}
            </button>

            <p className="land-registro">
              ¿No tenés usuario?{' '}
              <button type="button" onClick={onSwitchToRegister}>Crear una cuenta</button>
            </p>
          </form>
        </section>

        <div className="land-cinta" aria-label="Formatos admitidos">
          <div className="land-cinta-pista" aria-hidden="true">
            {[0, 1].map((k) => (
              <ul key={k}>
                {['PDF', 'CSV', 'XLSX', 'JSON', 'Plan de estudio', 'Horarios', 'Talleres', 'Progreso'].map((t) => <li key={t}>{t}</li>)}
              </ul>
            ))}
          </div>
          <span className="land-sr">Admite archivos PDF, CSV, XLSX y JSON</span>
        </div>

        <section className="land-seccion" id="funciones">
          <h2 data-reveal>Todo lo que necesitás para tu semestre</h2>
          <div className="land-bento">
            {FUNCIONES.map((f, i) => (
              <article
                className={`land-bento-item ${f.clase ?? ''}`}
                key={f.titulo}
                data-reveal
                style={{ '--d': `${i * 90}ms` }}
                onMouseMove={seguirCursor}
              >
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
          <h2 data-reveal>Cómo funciona</h2>
          <ol className="land-pasos" data-reveal>
            {PASOS.map((p, i) => (
              <li key={p.titulo} style={{ '--d': `${i * 160}ms` }}>
                <span className="land-paso-num">{i + 1}</span>
                <h3>{p.titulo}</h3>
                <p>{p.texto}</p>
              </li>
            ))}
          </ol>
        </section>

        <section className="land-final" data-reveal>
          <h2>Tu próximo semestre, mejor organizado</h2>
          <p>Creá tu cuenta y cargá tu plan de estudio en minutos.</p>
          <button type="button" className="land-btn land-btn--rosa" onClick={onSwitchToRegister}>Empezar ahora</button>
        </section>
      </main>

      <footer className="land-pie">
        <span>© {new Date().getFullYear()} Kairo</span>
        <button type="button" onClick={irAIngresar}>Iniciar sesión</button>
      </footer>
    </div>
  )
}

export default BienvenidaPage
