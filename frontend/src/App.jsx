import { useEffect, useState } from 'react'
import { EVENTO_SESION_VENCIDA } from './api'
import './pagesCSS/SidebarMenu.css'
import './App.css'
import './pagesCSS/PlanPage.css'
import "./pagesCSS/ConfigPage.css"

import BienvenidaPage from './pages/BienvenidaPage'
import LoginPage from './pages/LoginPage'
import RegisterPage from './pages/RegisterPage'
import WeeklyPlanner from './pages/WeeklyPlanner'
import SidebarMenu from './pages/SidebarMenu'
import StudyPlanPage from './pages/StudyPlanPage'
import PlanPage from './pages/PlanPage'
import ProgresoPage from './pages/ProgresoPage'
import ConfigPage from "./pages/ConfigPage"
import InicioPage from './pages/InicioPage'
import PasantiasPage from './pages/PasantiasPage'

function leerPreferencia(clave, valorPorDefecto) {
  try {
    return localStorage.getItem(clave) || valorPorDefecto
  } catch {
    return valorPorDefecto
  }
}

function App() {
  const [tema, setTema] = useState(() => leerPreferencia('kairo-tema', 'claro'))
  const [degradado, setDegradado] = useState(() => leerPreferencia('kairo-degradado', 'original'))
  const [usuario, setUsuario] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('kairo-usuario'))
    } catch {
      return null
    }
  })
  const [vista, setVista] = useState(usuario ? 'inicio' : 'bienvenida')

  useEffect(() => {
    document.documentElement.dataset.tema = tema
    document.documentElement.dataset.degradado = degradado
    try {
      localStorage.setItem('kairo-tema', tema)
      localStorage.setItem('kairo-degradado', degradado)
    } catch { /* las preferencias siguen aplicadas hasta recargar */ }
  }, [tema, degradado])

  function iniciarSesion(datos) {
    setUsuario(datos)
    try {
      localStorage.setItem('kairo-usuario', JSON.stringify(datos))
    } catch { /* sin almacenamiento: la sesión dura hasta recargar */ }
    setVista('inicio')
  }

  function cerrarSesion() {
    setUsuario(null)
    try {
      localStorage.removeItem('kairo-usuario')
    } catch { /* nada que limpiar */ }
    setVista('bienvenida')
  }

  // Si el servidor rechaza el token (vencido, o sesión anterior sin token), se vuelve a la portada.
  useEffect(() => {
    window.addEventListener(EVENTO_SESION_VENCIDA, cerrarSesion)
    return () => window.removeEventListener(EVENTO_SESION_VENCIDA, cerrarSesion)
  })

  // Pantallas públicas: portada, login y registro
  if (!usuario && vista === 'login') {
    return (
      <LoginPage
        onLogin={iniciarSesion}
        onSwitchToRegister={() => setVista('register')}
        onBack={() => setVista('bienvenida')}
      />
    )
  }

  if (!usuario && vista === 'register') {
    return (
      <RegisterPage
        onRegistrado={iniciarSesion}
        onSwitchToLogin={() => setVista('login')}
        onBack={() => setVista('bienvenida')}
      />
    )
  }

  if (!usuario) {
    return (
      <BienvenidaPage
        onLogin={iniciarSesion}
        onSwitchToRegister={() => setVista('register')}
      />
    )
  }

  // Aplicación después de iniciar sesión
  return (
    <div className="app-layout">

      <SidebarMenu
        itemActivo={vista}
        usuario={usuario}
        onSeleccionar={setVista}
        onCerrarSesion={cerrarSesion}
      />
        

      <main className="app-content">
        {vista === 'inicio' && <InicioPage nombreUsuario={usuario.nombre} emailUsuario={usuario.email} onIr={setVista} />}

        {vista === 'calendario' && <WeeklyPlanner emailUsuario={usuario.email} onIr={setVista} />}

        {vista === 'plan-estudio' && <StudyPlanPage />}

        {vista === 'progreso' && <ProgresoPage onIr={setVista} />}

        {vista === 'pasantias' && <PasantiasPage emailUsuario={usuario.email} />}

        {vista === 'planificar' && <PlanPage emailUsuario={usuario.email} onIr={setVista} />}
          
        {vista === 'ajustes' && <ConfigPage tema={tema} degradado={degradado} onCambiarTema={setTema} onCambiarDegradado={setDegradado} />}
      </main>

    </div>
  )

   
}

export default App
