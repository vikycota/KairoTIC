import { useEffect, useState } from 'react'
import logoKairo from '../assets/logoKairo.jpeg'

const GRUPOS = [
  {
    titulo: 'Mi carrera',
    items: [
      { id: 'inicio', etiqueta: 'Inicio', icono: 'M3 11l9-8 9 8M5 10v10h5v-6h4v6h5V10' },
      { id: 'plan-estudio', etiqueta: 'Plan de estudio', icono: 'M12 3L2 8l10 5 10-5-10-5zM6 10.5V15c0 1.5 3 3 6 3s6-1.5 6-3v-4.5' },
      { id: 'progreso', etiqueta: 'Mi progreso', icono: 'M4 19V9m6 10V5m6 14v-7m4 7H2' },
    ],
  },
  {
    titulo: 'Semestre',
    items: [
      { id: 'calendario', etiqueta: 'Calendario', icono: 'M8 3v3m8-3v3M4 9h16M5 5h14a1 1 0 011 1v13a1 1 0 01-1 1H5a1 1 0 01-1-1V6a1 1 0 011-1z' },
      { id: 'planificar', etiqueta: 'Planificar semestre', icono: 'M9 6h11M9 12h11M9 18h11M3.5 6l1 1 2-2M3.5 12l1 1 2-2M3.5 18l1 1 2-2' },
    ],
  },
  {
    titulo: 'Cuenta',
    items: [
      { id: 'ajustes', etiqueta: 'Configuración', icono: 'M4 6h10M18 6h2M4 12h4M12 12h8M4 18h12M20 18h0M14 4v4M8 10v4M16 16v4' },
    ],
  },
]

function Icono({ ruta }) {
  return (
    <svg className="sidebar-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={ruta} />
    </svg>
  )
}

function iniciales(usuario) {
  const letras = [usuario?.nombre, usuario?.apellido].map((t) => (t ?? '').trim().charAt(0).toUpperCase())
  return letras.join('') || '?'
}

function SidebarMenu({ itemActivo = 'inicio', usuario, onSeleccionar, onCerrarSesion }) {
  const [colapsado, setColapsado] = useState(() => {
    try {
      return localStorage.getItem('kairo-sidebar-colapsado') === 'true'
    } catch {
      return false
    }
  })

  useEffect(() => {
    try {
      localStorage.setItem('kairo-sidebar-colapsado', String(colapsado))
    } catch { /* sin almacenamiento: se recuerda solo en esta sesión */ }
  }, [colapsado])

  const nombreCompleto = [usuario?.nombre, usuario?.apellido].filter(Boolean).join(' ')

  return (
    <aside className={`sidebar ${colapsado ? 'sidebar--colapsado' : ''}`}>
      <div className="sidebar-header">
        <span className="sidebar-logo-marco">
          <img className="sidebar-logo" src={logoKairo} alt="Logo Kairo" />
        </span>
        {!colapsado && <span className="sidebar-marca">KAIRO</span>}

        <button
          className="sidebar-toggle"
          type="button"
          onClick={() => setColapsado((valor) => !valor)}
          aria-label={colapsado ? 'Expandir menú' : 'Colapsar menú'}
          aria-expanded={!colapsado}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d={colapsado ? 'M9 6l6 6-6 6' : 'M15 6l-6 6 6 6'} />
          </svg>
        </button>
      </div>

      <nav className="sidebar-nav" aria-label="Secciones">
        {GRUPOS.map((grupo) => (
          <div className="sidebar-grupo" key={grupo.titulo}>
            {colapsado ? <hr className="sidebar-separador" /> : <span className="sidebar-grupo-titulo">{grupo.titulo}</span>}
            {grupo.items.map((item) => {
              const activo = itemActivo === item.id
              return (
                <button
                  key={item.id}
                  type="button"
                  className={`sidebar-item ${activo ? 'sidebar-item--activo' : ''}`}
                  onClick={() => onSeleccionar?.(item.id)}
                  aria-current={activo ? 'page' : undefined}
                  aria-label={colapsado ? item.etiqueta : undefined}
                  title={colapsado ? item.etiqueta : undefined}
                >
                  <Icono ruta={item.icono} />
                  {!colapsado && (
                    <span className="sidebar-item-texto">{item.etiqueta}</span>
                  )}
                </button>
              )
            })}
          </div>
        ))}
      </nav>

      <div className="sidebar-footer">
        {usuario && (
          <div className="sidebar-usuario" title={colapsado ? `${nombreCompleto} · ${usuario.email}` : undefined}>
            <span className="sidebar-avatar" aria-hidden="true">{iniciales(usuario)}</span>
            {!colapsado && (
              <span className="sidebar-usuario-datos">
                <strong>{nombreCompleto}</strong>
                <span>{usuario.email}</span>
              </span>
            )}
          </div>
        )}
        <button
          type="button"
          className="sidebar-item sidebar-item--salir"
          onClick={onCerrarSesion}
          aria-label={colapsado ? 'Cerrar sesión' : undefined}
          title={colapsado ? 'Cerrar sesión' : undefined}
        >
          <Icono ruta="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9" />
          {!colapsado && <span className="sidebar-item-texto">Cerrar sesión</span>}
        </button>
      </div>
    </aside>
  )
}

export default SidebarMenu
