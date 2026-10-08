import { useState } from 'react'
import './pagesCSS/LoginPage.css'
import './pagesCSS/RegisterPage.css'
import './pagesCSS/SidebarMenu.css'
import './pagesCSS/StudyPlanPage.css'
import './App.css'
import './PagesCSS/PlanPage.css'
import "./pagesCSS/ConfigPage.css"
import "./pagesCSS/WeeklyPlanner.css"

import LoginPage from './pages/LoginPage'
import RegisterPage from './pages/RegisterPage'
import WeeklyPlanner from './pages/WeeklyPlanner'
import SidebarMenu from './pages/SidebarMenu'
import StudyPlanPage from './pages/StudyPlanPage'
import easteregg from './assets/easteregg.webp'
import PlanPage from './pages/PlanPage'
import ProgresoPage from './pages/ProgresoPage'
import ConfigPage from "./pages/ConfigPage"

function App() {
  const [usuario, setUsuario] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('kairo-usuario'))
    } catch {
      return null
    }
  })
  const [vista, setVista] = useState(usuario ? 'calendario' : 'login')

  function iniciarSesion(datos) {
    setUsuario(datos)
    try {
      localStorage.setItem('kairo-usuario', JSON.stringify(datos))
    } catch { /* sin almacenamiento: la sesión dura hasta recargar */ }
    setVista('calendario')
  }

  function cerrarSesion() {
    setUsuario(null)
    try {
      localStorage.removeItem('kairo-usuario')
    } catch { /* nada que limpiar */ }
    setVista('login')
  }

  // Pantalla de login
  if (!usuario && vista !== 'register') {
    return (
      <LoginPage
        onLogin={iniciarSesion}
        onSwitchToRegister={() => setVista('register')}
      />
    )
  }

  // Pantalla de registro
  if (!usuario) {
    return (
      <RegisterPage
        onSwitchToLogin={() => setVista('login')}
      />
    )
  }

  // Aplicación después de iniciar sesión
  return (
    <div className="app-layout">

      <SidebarMenu
        itemActivo={vista}
        onSeleccionar={setVista}
        onCerrarSesion={cerrarSesion}
      />
        

      <main className="app-content">
        {vista === 'calendario' && <WeeklyPlanner />}

        {vista === 'plan-estudio' && <StudyPlanPage />}

        {vista === 'progreso' && <ProgresoPage emailUsuario={usuario.email} />}

        {vista === 'planificar' && <PlanPage />}
          
        {vista === 'ajustes' && <ConfigPage />}
      </main>

    </div>
  )

   
}

export default App