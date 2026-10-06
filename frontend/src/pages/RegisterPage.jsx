import logoKairo from '../assets/logoKairo.jpeg';
import { useState } from 'react'
import eyeOpen from '../assets/openeye.png'
import eyeClosed from '../assets/closedeye2.png'

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
    <main className="register-page">
        <section className="box-register-page">
            <img className="register-logo" src={logoKairo} alt="Logo Kairo" />
            <div>
                <h1 className="register-title">Crea tu cuenta</h1>
                <p className="register-subtitle">Completá tus datos para registrarte</p>
            </div>

            <form className="register-form" onSubmit={handleSubmit}>
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
                    <button
                        type="button"
                        className="generate-password"
                        onClick={() => {
                            setPassword(generarPassword())
                            setMostrarPassword(true)
                        }}
                    >
                        Generar contraseña segura
                    </button>
                </div>

                {mensaje && (
                    <p style={{ color: mensaje.tipo === 'exito' ? 'green' : 'red', margin: 0 }}>
                        {mensaje.texto}
                    </p>
                )}

                <button className="register-button" type="submit" disabled={enviando}>
                    {enviando ? 'Registrando...' : 'Registrarme'}
                </button>
            </form>
            <div className="register-links">
                <div className="register-links-register">
                    <p>Ya tenés cuenta?</p>
                    <span className="register-links-separator" onClick={onSwitchToLogin}>Iniciar sesión</span>
                </div>
                <div className="register-links-register">
                    <p>Volver al inicio?</p>
                    <span className="register-links-separator" onClick={onSwitchToLogin}>Atrás</span>
                </div>
            </div>
        </section>
    </main>
  )
}

export default RegisterPage
