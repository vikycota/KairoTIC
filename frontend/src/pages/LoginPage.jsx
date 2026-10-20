import { useState } from 'react'
import { AuthShell, Campo } from './AuthShell'

function LoginPage({ onLogin, onSwitchToRegister, onBack }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [errores, setErrores] = useState({})   // { email?, password?, general? }
  const [enviando, setEnviando] = useState(false)

  async function handleSubmit(e) {
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

      if (res.ok) {
        onLogin(data.usuario)
        return
      }
      if (res.status >= 502) {
        setErrores({ general: 'El servidor no responde. Intentá de nuevo en unos minutos.' })
      } else if (data.campo === 'email' || data.campo === 'password') {
        setErrores({ [data.campo]: data.error })
        document.getElementById(`login-${data.campo}`)?.focus()
      } else {
        setErrores({ general: data.error || 'No se pudo iniciar sesión.' })
      }
    } catch {
      setErrores({ general: 'Error de conexión con el servidor.' })
    } finally {
      setEnviando(false)
    }
  }

  return (
    <AuthShell
      titulo="Iniciar sesión"
      subtitulo="Ingresá tus credenciales para acceder a tu cuenta."
      onVolver={onBack}
      pie={<>¿No tenés una cuenta? <button type="button" onClick={onSwitchToRegister}>Crear una cuenta</button></>}
    >
      <form className="auth-form" onSubmit={handleSubmit} noValidate>
        <Campo
          id="login-email"
          etiqueta="Email"
          tipo="email"
          autoComplete="email"
          placeholder="nombre@email.com"
          value={email}
          onChange={(e) => { setEmail(e.target.value); setErrores((x) => ({ ...x, email: '' })) }}
          error={errores.email}
          required
        />
        <Campo
          id="login-password"
          etiqueta="Contraseña"
          tipo="password"
          alternar
          autoComplete="current-password"
          placeholder="Tu contraseña"
          value={password}
          onChange={(e) => { setPassword(e.target.value); setErrores((x) => ({ ...x, password: '' })) }}
          error={errores.password}
          required
        />

        {errores.general && <p className="auth-alerta" role="alert">{errores.general}</p>}

        <button className="auth-boton" type="submit" disabled={enviando}>
          {enviando ? 'Ingresando…' : 'Ingresar'}
        </button>
      </form>
    </AuthShell>
  )
}

export default LoginPage
