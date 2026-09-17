import { useEffect, useState } from 'react'
import logoKairo from '../assets/logokairo.jpeg'


const ICONOS = {
  inicio: (
    <path d="M4 11.5 12 4l8 7.5M6 10v9a1 1 0 0 0 1 1h4v-5h2v5h4a1 1 0 0 0 1-1v-9" />
  ),
  calendario: (
    <>
      <rect x="4" y="5.5" width="16" height="15" rx="2" />
      <path d="M4 10h16M8 3v4M16 3v4" />
    </>
  ),
  perfil: (
    <>
      <circle cx="12" cy="8.5" r="3.5" />
      <path d="M5 20c1.2-3.6 4-5.5 7-5.5s5.8 1.9 7 5.5" />
    </>
  ),
  ajustes: (
    <>
      <circle cx="12" cy="12" r="3" />
      <path d="M19 12a7 7 0 0 0-.1-1.1l2-1.5-2-3.4-2.3.9a7 7 0 0 0-1.9-1.1L14.3 3H9.7l-.4 2.8a7 7 0 0 0-1.9 1.1l-2.3-.9-2 3.4 2 1.5a7 7 0 0 0 0 2.2l-2 1.5 2 3.4 2.3-.9a7 7 0 0 0 1.9 1.1l.4 2.8h4.6l.4-2.8a7 7 0 0 0 1.9-1.1l2.3.9 2-3.4-2-1.5c.07-.36.1-.73.1-1.1Z" />
    </>
  ),
  salir: (
    <>
      <path d="M9 4H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h3" />
      <path d="M15 8l4 4-4 4M19 12H9" />
    </>
  ),
}

const ITEMS_MENU = [
  { id: 'inicio', etiqueta: 'Inicio' },
  { id: 'calendario', etiqueta: 'Calendario' },
  {id : 'plan-estudio', etiqueta: 'Plan de estudio'},
  { id: 'perfil', etiqueta: 'Perfil' },
  { id: 'ajustes', etiqueta: 'Configuración' },
]

function Icono({ nombre }) {
  return (
    <svg
      className="sidebar-icon"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {ICONOS[nombre]}
    </svg>
  )
}

function SidebarMenu({ itemActivo = 'inicio', onSeleccionar, onCerrarSesion }) {
  const [colapsado, setColapsado] = useState(() => {
    return localStorage.getItem('kairo-sidebar-colapsado') === 'true'
  })

  useEffect(() => {
    localStorage.setItem('kairo-sidebar-colapsado', String(colapsado))
  }, [colapsado])

  return (
    <aside className={`sidebar ${colapsado ? 'sidebar--colapsado' : ''}`}>
      <div className="sidebar-header">
        <img className="sidebar-logo" src={logoKairo} alt="Logo Kairo" />
        {!colapsado && <span className="sidebar-marca">KAIRO</span>}

        <button
          className="sidebar-toggle"
          type="button"
          onClick={() => setColapsado((valor) => !valor)}
          aria-label={colapsado ? 'Expandir menú' : 'Colapsar menú'}
          aria-expanded={!colapsado}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d={colapsado ? 'M9 6l6 6-6 6' : 'M15 6l-6 6 6 6'} />
          </svg>
        </button>
      </div>

      <nav className="sidebar-nav">
        {ITEMS_MENU.map((item) => (
          <button
            key={item.id}
            type="button"
            className={`sidebar-item ${itemActivo === item.id ? 'sidebar-item--activo' : ''}`}
            onClick={() => onSeleccionar?.(item.id)}
            title={colapsado ? item.etiqueta : undefined}
          >
            <Icono nombre={item.id} />
            {!colapsado && <span className="sidebar-item-texto">{item.etiqueta}</span>}
          </button>
        ))}
      </nav>

      <div className="sidebar-footer">
        <button
          type="button"
          className="sidebar-item sidebar-item--salir"
          onClick={onCerrarSesion}
          title={colapsado ? 'Cerrar sesión' : undefined}
        >
          <Icono nombre="salir" />
          {!colapsado && <span className="sidebar-item-texto">Cerrar sesión</span>}
        </button>
      </div>
    </aside>
  )
}

export default SidebarMenu
