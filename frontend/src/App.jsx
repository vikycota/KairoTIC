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
  const [vista, setVista] = useState('calendario')

  // Pantalla de login
  /*if (vista === 'login') {
    return (
      <LoginPage
        onLogin={() => setVista('calendario')}
        onSwitchToRegister={() => setVista('register')}
      />
    )
  }

  // Pantalla de registro
  if (vista === 'register') {
    return (
      <RegisterPage
        onSwitchToLogin={() => setVista('login')}
      />
    )
  }*/

  // Aplicación después de iniciar sesión
  return (
    <div className="app-layout">

      <SidebarMenu
        itemActivo={vista}
        onSeleccionar={setVista}
        onCerrarSesion={() => setVista('login')}
      />

      <main className="app-content">
        {vista === 'calendario' && <WeeklyPlanner />}

        {vista === 'plan-estudio' && <StudyPlanPage />}

        {vista === 'progreso' && <ProgresoPage />}

        {vista === 'planificar' && <PlanPage />}
          
        {vista === 'ajustes' && <ConfigPage />}
      </main>

    </div>
  )

   
}

export default App