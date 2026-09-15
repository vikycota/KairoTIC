import logoKairo from '../assets/logokairo.jpeg';
import { useState } from 'react'
import eyeOpen from '../assets/openeye.png'
import eyeClosed from '../assets/closedeye2.png'

function RegisterPage() {
    const [mostrarPassword, setMostrarPassword] = useState(false)
  return (
    <main className="register-page">
        <section className="box-register-page">
            <div className="register-header">
                <img className="register-logo" src={logoKairo} alt="Logo Kairo" />
                <div>
                    <h1 className="register-title">Registro</h1>
                    <p className="register-subtitle">Ingresa tus datos para continuar</p>
                </div>
            </div>

            <form className="register-form">
                <div className="user-input">
                    <label>Email</label>
                    <input className="username-input" type="email" placeholder="Ingresa su email" />
                </div>

                <div className="user-input">
                    <label>Contraseña</label>
                    <div className="password-wrapper">
                        <input className="password-input" type={mostrarPassword ? "text" : "password"} placeholder="Contraseña" />
                        <button className="eye" type="button" onClick={() => setMostrarPassword(!mostrarPassword)}>
                            <img
                                src={mostrarPassword ? eyeOpen : eyeClosed}
                                alt="Mostrar u ocultar contraseña"
                                />
                        </button>
                    </div>
                </div>

                <div className="user-input">
                    <label>Nombre</label>
                    <input className="name-input" type="text" placeholder="Nombre" />
                </div>

                <div className="user-input">
                    <label>Apellido</label>
                    <input className="lastname-input" type="text" placeholder="Apellido" />
                </div>

                <button className="register-button" type="submit">Ingresar</button>
            </form>

            <div className="register-links">
                <p>
                    Ya tienes usuario? <span className="register-links-highlight">Ingresar</span>
                </p>
                <p>
                    Volver al inicio <span className="register-links-highlight">Atrás</span>
                </p>
            </div>
        </section>
    </main>
  )
}

export default RegisterPage
