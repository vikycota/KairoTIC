import logoKairo from '../assets/logokairo.jpeg';
import { useState } from 'react'
import eyeOpen from '../assets/openeye.png'
import eyeClosed from '../assets/closedeye2.png'

function LoginPage() {
    const [mostrarPassword, setMostrarPassword] = useState(false)
  return (
    <main className="login-page">
        <section className="box-login-page">
            <img className="login-logo" src={logoKairo} alt="Logo Kairo" />
            <div >
                <h1 className="login-title">Inicia Sesión</h1>
                <p className="login-subtitle">Ingresa tus credenciales para continuar</p>
            </div>
            
            <form className="login-form">
                <div className="user-input">
                    <label> Usuario</label>
                    <input className='username-input' type="text" placeholder="Usuario" />
                </div>
                <div className="user-input">
                    <label> Contraseña</label>
                    <div className="password-wrapper">
                        <input className="password-input" type={mostrarPassword ? "text" : "password"} placeholder="Contraseña" />
                        <button className='eye' type="button" onClick={() => setMostrarPassword(!mostrarPassword)}>
                            <img
                                src={mostrarPassword ? eyeOpen : eyeClosed}
                                alt="Mostrar u ocultar contraseña"
                                />
                        </button>
                    </div>
                </div>
                
                <button className="login-button" type="submit">Ingresar</button>
            </form>
            <div className="login-links">
                <div className="login-links-back">
                    <p>Volver al inicio</p>
                    <span className="login-links-back">Atrás</span>
                </div>
                <div className="login-links-register">
                    <p>No tienes usuario?</p> 
                    <span className="login-links-separator">Crear una cuenta</span>
                </div>
            </div>
        </section>
    </main>
  )
}

export default LoginPage