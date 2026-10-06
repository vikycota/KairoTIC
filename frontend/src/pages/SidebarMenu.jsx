import { useEffect, useState } from 'react'
import logoKairo from '../assets/logoKairo.jpeg'


const ITEMS_MENU = [
  { id: 'calendario', etiqueta: 'Calendario' },
  {id : 'plan-estudio', etiqueta: 'Plan de estudio'},
  { id: 'progreso', etiqueta: 'Mi progreso' },
  { id: 'planificar', etiqueta: 'Planificar Semestre' },
  { id: 'ajustes', etiqueta: 'Configuración' },
]

function SidebarMenu({ itemActivo = 'calendario', onSeleccionar, onCerrarSesion }) {
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
          {!colapsado && <span className="sidebar-item-texto">Cerrar sesión</span>}
        </button>
      </div>
    </aside>
  )
}

export default SidebarMenu
