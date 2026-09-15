import { useState } from 'react'
import './PagesCSS/LoginPage.css'
import './PagesCSS/RegisterPage.css'
import './PagesCSS/SidebarMenu.css'


import LoginPage from './pages/LoginPage'
import RegisterPage from './pages/RegisterPage'
import WeeklyPlanner from './pages/WeeklyPlanner'
import SidebarMenu from './pages/SidebarMenu'

function App() {
  const [vista, setVista] = useState('login')

  // Pantalla de login
  if (vista === 'login') {
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
  }

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
          <h1>Inicio</h1>
        )}

        {vista === 'perfil' && (
          <h1>Perfil</h1>
        )}

        {vista === 'ajustes' && (
          <h1>Configuración</h1>
        )}
      </main>

    </div>
  )
}

export default App