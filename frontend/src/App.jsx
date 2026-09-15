import { useState } from 'react'
import './App.css'
import LoginPage from './pages/LoginPage'
import RegisterPage from './pages/RegisterPage'

function App() {
  const [vista, setVista] = useState('login')

  if (vista === 'register') {
    return <RegisterPage onSwitchToLogin={() => setVista('login')} />
  }

  return <LoginPage onSwitchToRegister={() => setVista('register')} />
}

export default App
