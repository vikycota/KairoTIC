import { useState } from 'react'
import './PagesCSS/LoginPage.css'
import './PagesCSS/RegisterPage.css'
import './PagesCSS/SidebarMenu.css'
import './PagesCSS/StudyPlanPage.css'
import './App.css'
import './PagesCSS/PlanPage.css'


import LoginPage from './pages/LoginPage'
import RegisterPage from './pages/RegisterPage'
import WeeklyPlanner from './pages/WeeklyPlanner'
import SidebarMenu from './pages/SidebarMenu'
import StudyPlanPage from './pages/StudyPlanPAge'
import easteregg from './assets/easteregg.webp'
import PlanPage from './pages/PlanPage'

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

        {vista === 'inicio' && (
          <img className="easter-egg" src={easteregg} alt="Easter Egg" />
        )}

        {vista === 'plan-estudio' && <StudyPlanPage />}

        {vista === 'planificar' && <PlanPage />}
          
        {vista === 'ajustes' && (
          <img className="easter-egg" src={easteregg} alt="Easter Egg" />
        )}
      </main>

    </div>
  )

   
}

export default App