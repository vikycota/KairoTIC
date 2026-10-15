import { useState } from 'react'
import { AuthShell, Campo } from './AuthShell'
import { capitalizar } from './textos'

const CARACTERES = {
  minusculas: 'abcdefghijkmnopqrstuvwxyz',
  mayusculas: 'ABCDEFGHJKLMNPQRSTUVWXYZ',
  numeros: '23456789',
  simbolos: '!@#$%&*?-_',
}

// Contraseña aleatoria de 16 caracteres con al menos uno de cada tipo (usa el generador seguro del navegador).
function generarPassword(largo = 16) {
  const grupos = Object.values(CARACTERES)
  const todos = grupos.join('')
  const azar = (max) => {
    const limite = Math.floor(0x100000000 / max) * max
    const buffer = new Uint32Array(1)
    do { crypto.getRandomValues(buffer) } while (buffer[0] >= limite)
    return buffer[0] % max
  }
  const letras = grupos.map((g) => g[azar(g.length)])
  while (letras.length < largo) letras.push(todos[azar(todos.length)])
  for (let i = letras.length - 1; i > 0; i--) {
    const j = azar(i + 1);
    [letras[i], letras[j]] = [letras[j], letras[i]]
  }
  return letras.join('')
}

const NIVELES = ['Muy débil', 'Débil', 'Aceptable', 'Buena', 'Fuerte']

function fortaleza(p) {
  if (!p) return -1
  let puntos = 0
  if (p.length >= 8) puntos++
  if (p.length >= 12) puntos++
  if (/[a-z]/.test(p) && /[A-Z]/.test(p)) puntos++
  if (/\d/.test(p)) puntos++
  if (/[^A-Za-z0-9]/.test(p)) puntos++
  return Math.min(4, Math.max(0, puntos - 1))
}

function RegisterPage({ onRegistrado, onSwitchToLogin, onBack }) {
  const [nombre, setNombre] = useState('')
  const [apellido, setApellido] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [verPassword, setVerPassword] = useState(false)
  const [errores, setErrores] = useState({})
  const [enviando, setEnviando] = useState(false)
  const CAMPOS = ['nombre', 'apellido', 'email', 'password']

  const nivel = fortaleza(password)
  const barras = nivel < 0 ? 0 : Math.max(1, nivel)

  function cambiar(campo, setter, transformar = (v) => v) {
    return (e) => {
      setter(transformar(e.target.value))
      setErrores((x) => ({ ...x, [campo]: '' }))
    }
  }

  async function iniciarSesionConCredenciales() {
    try {
      const res = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      })
      const json = await res.json()
      return res.ok ? json.usuario : null
    } catch {
      return null
    }
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setErrores({})
    setEnviando(true)
    try {
      const res = await fetch('/api/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nombre: nombre.trim(), apellido: apellido.trim(), email, password }),
      })
      let data = {}
      try { data = await res.json() } catch { /* respuesta sin JSON */ }

      if (res.ok) {
        // Cuenta creada: se inicia la sesión directamente, sin pasar por el login.
        // Si el backend no devuelve el usuario (versión anterior), se inicia sesión con las credenciales.
        const usuario = data.usuario ?? await iniciarSesionConCredenciales()
        if (usuario) {
          onRegistrado(usuario)
        } else {
          onSwitchToLogin()
        }
        return
      }
      if (res.status >= 502) {
        setErrores({ general: 'El servidor no responde. Intentá de nuevo en unos minutos.' })
      } else if (CAMPOS.includes(data.campo)) {
        setErrores({ [data.campo]: data.error })
        document.getElementById(`reg-${data.campo}`)?.focus()
      } else {
        setErrores({ general: data.error || 'No se pudo crear la cuenta.' })
      }
    } catch {
      setErrores({ general: 'Error de conexión con el servidor.' })
    } finally {
      setEnviando(false)
    }
  }

  return (
    <AuthShell
      titulo="Crear cuenta"
      subtitulo="Completá tus datos. Al registrarte vas a ingresar automáticamente."
      onVolver={onBack}
      pie={<>¿Ya tenés una cuenta? <button type="button" onClick={onSwitchToLogin}>Iniciar sesión</button></>}
    >
      <form className="auth-form" onSubmit={handleSubmit} noValidate>
        <div className="auth-fila">
          <Campo
            id="reg-nombre"
            etiqueta="Nombre"
            autoComplete="given-name"
            autoCapitalize="words"
            placeholder="María"
            value={nombre}
            onChange={cambiar('nombre', setNombre, capitalizar)}
            error={errores.nombre}
            required
          />
          <Campo
            id="reg-apellido"
            etiqueta="Apellido"
            autoComplete="family-name"
            autoCapitalize="words"
            placeholder="González"
            value={apellido}
            onChange={cambiar('apellido', setApellido, capitalizar)}
            error={errores.apellido}
            required
          />
        </div>

        <Campo
          id="reg-email"
          etiqueta="Email"
          tipo="email"
          autoComplete="email"
          placeholder="nombre@email.com"
          value={email}
          onChange={cambiar('email', setEmail)}
          error={errores.email}
          required
        />

        <Campo
          id="reg-password"
          etiqueta="Contraseña"
          tipo="password"
          alternar
          visible={verPassword}
          onVisible={setVerPassword}
          autoComplete="new-password"
          placeholder="Mínimo 8 caracteres"
          value={password}
          onChange={cambiar('password', setPassword)}
          error={errores.password}
          ayuda="Usá al menos 8 caracteres. Combinar mayúsculas, números y símbolos la fortalece."
          required
        >
          <div className="auth-fuerza" data-nivel={nivel} aria-live="polite">
            <div className="auth-fuerza-barras" aria-hidden="true">
              {[0, 1, 2, 3].map((i) => <span key={i} className={i < barras ? 'on' : ''} />)}
            </div>
            <span>{nivel >= 0 ? NIVELES[nivel] : ''}</span>
          </div>
          <button
            type="button"
            className="auth-enlace"
            onClick={() => {
              setPassword(generarPassword())
              setVerPassword(true)
              setErrores((x) => ({ ...x, password: '' }))
            }}
          >
            Generar contraseña segura
          </button>
        </Campo>

        {errores.general && <p className="auth-alerta" role="alert">{errores.general}</p>}

        <button className="auth-boton" type="submit" disabled={enviando}>
          {enviando ? 'Creando cuenta…' : 'Crear cuenta'}
        </button>
      </form>
    </AuthShell>
  )
}

export default RegisterPage
