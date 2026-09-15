import logoKairo from '../assets/logoKairo.jpeg';
import { useState } from 'react'
import eyeOpen from '../assets/openeye.png'
import eyeClosed from '../assets/closedeye2.png'

function RegisterPage({ onSwitchToLogin }) {
    const [mostrarPassword, setMostrarPassword] = useState(false)
    const [nombre, setNombre] = useState('')
    const [apellido, setApellido] = useState('')
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [mensaje, setMensaje] = useState(null)
    const [enviando, setEnviando] = useState(false)

    async function handleSubmit(e) {
        e.preventDefault()
        setMensaje(null)
        setEnviando(true)

        try {
            const res = await fetch('/api/register', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ nombre, apellido, email, password }),
            })
            const data = await res.json()

            if (res.ok) {
                setMensaje({ tipo: 'exito', texto: data.message })
                setNombre('')
                setApellido('')
                setEmail('')
                setPassword('')
            } else {
                setMensaje({ tipo: 'error', texto: data.error })
            }
        } catch (err) {
            setMensaje({ tipo: 'error', texto: 'Error de conexión con el servidor.' })
        } finally {
            setEnviando(false)
        }
    }

  return (
    <main className="login-page">
        <section className="box-login-page">
            <img className="login-logo" src={logoKairo} alt="Logo Kairo" />
            <div>
                <h1 className="login-title">Crea tu cuenta</h1>
                <p className="login-subtitle">Completá tus datos para registrarte</p>
            </div>

            <form className="login-form" onSubmit={handleSubmit}>
                <div className="user-input">
                    <label> Nombre</label>
                    <input
                        className='username-input'
                        type="text"
                        placeholder="Nombre"
                        value={nombre}
                        onChange={(e) => setNombre(e.target.value)}
                        required
                    />
                </div>
                <div className="user-input">
                    <label> Apellido</label>
                    <input
                        className='username-input'
                        type="text"
                        placeholder="Apellido"
                        value={apellido}
                        onChange={(e) => setApellido(e.target.value)}
                        required
                    />
                </div>
                <div className="user-input">
                    <label> Email</label>
                    <input
                        className='username-input'
                        type="email"
                        placeholder="Email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                    />
                </div>
                <div className="user-input">
                    <label> Contraseña</label>
                    <div className="password-wrapper">
                        <input
                            className="password-input"
                            type={mostrarPassword ? "text" : "password"}
                            placeholder="Contraseña"
                            minLength={8}
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            required
                        />
                        <button className='eye' type="button" onClick={() => setMostrarPassword(!mostrarPassword)}>
                            <img
                                src={mostrarPassword ? eyeOpen : eyeClosed}
                                alt="Mostrar u ocultar contraseña"
                                />
                        </button>
                    </div>
                </div>

                {mensaje && (
                    <p style={{ color: mensaje.tipo === 'exito' ? 'green' : 'red', margin: 0 }}>
                        {mensaje.texto}
                    </p>
                )}

                <button className="login-button" type="submit" disabled={enviando}>
                    {enviando ? 'Registrando...' : 'Registrarme'}
                </button>
            </form>
            <div className="login-links">
                <div className="login-links-register">
                    <p>Ya tenés cuenta?</p>
                    <span className="login-links-separator" onClick={onSwitchToLogin}>Iniciar sesión</span>
                </div>
            </div>
        </section>
    </main>
  )
}

export default RegisterPage
