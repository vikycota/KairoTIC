import { useEffect, useState } from 'react'
import logoKairo from '../assets/logoKairo.jpeg'

const GRUPOS = [
  {
    titulo: 'Mi carrera',
    items: [
      { id: 'inicio', etiqueta: 'Cargas', icono: 'M12 16V4m0 0l-4 4m4-4l4 4M4 16v3a1 1 0 001 1h14a1 1 0 001-1v-3' },
      { id: 'plan-estudio', etiqueta: 'Plan de estudio', icono: 'M12 3L2 8l10 5 10-5-10-5zM6 10.5V15c0 1.5 3 3 6 3s6-1.5 6-3v-4.5' },
      { id: 'progreso', etiqueta: 'Mi progreso', icono: 'M4 19V9m6 10V5m6 14v-7m4 7H2' },
      { id: 'pasantias', etiqueta: 'Pasantías', icono: 'M4 8h16a1 1 0 011 1v9a1 1 0 01-1 1H4a1 1 0 01-1-1V9a1 1 0 011-1zM9 8V6a1 1 0 011-1h4a1 1 0 011 1v2M3 13h18' },
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

const CONSULTA_MOVIL = '(max-width: 720px)'

function useEsMovil() {
  const [esMovil, setEsMovil] = useState(() => typeof window !== 'undefined' && window.matchMedia(CONSULTA_MOVIL).matches)
  useEffect(() => {
    const consulta = window.matchMedia(CONSULTA_MOVIL)
    const alCambiar = (evento) => setEsMovil(evento.matches)
    consulta.addEventListener('change', alCambiar)
    return () => consulta.removeEventListener('change', alCambiar)
  }, [])
  return esMovil
}

function SidebarMenu({ itemActivo = 'inicio', usuario, onSeleccionar, onCerrarSesion }) {
  const esMovil = useEsMovil()
  const [menuAbierto, setMenuAbierto] = useState(false)
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

  // En celular el menú es un panel lateral que se abre con el botón de la barra superior: siempre muestra los textos.
  const compacto = colapsado && !esMovil
  const cerrarMenu = () => setMenuAbierto(false)

  useEffect(() => {
    if (!esMovil || !menuAbierto) return undefined
    const alTeclear = (evento) => { if (evento.key === 'Escape') setMenuAbierto(false) }
    window.addEventListener('keydown', alTeclear)
    return () => window.removeEventListener('keydown', alTeclear)
  }, [esMovil, menuAbierto])

  const nombreCompleto = [usuario?.nombre, usuario?.apellido].filter(Boolean).join(' ')

  return (
    <>
      <header className="sidebar-topbar">
        <button type="button" className="sidebar-hamburguesa" onClick={() => setMenuAbierto(true)} aria-label="Abrir menú" aria-expanded={menuAbierto}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M4 7h16M4 12h16M4 17h16" /></svg>
        </button>
        <span className="sidebar-marca">KAIRO</span>
      </header>
      {menuAbierto && <div className="sidebar-fondo" onClick={cerrarMenu} aria-hidden="true" />}
    <aside className={`sidebar ${compacto ? 'sidebar--colapsado' : ''} ${menuAbierto ? 'sidebar--abierto' : ''}`}>
      <div className="sidebar-header">
        <span className="sidebar-logo-marco">
          <img className="sidebar-logo" src={logoKairo} alt="Logo Kairo" />
        </span>
        {!compacto && <span className="sidebar-marca">KAIRO</span>}

        <button
          className="sidebar-toggle"
          type="button"
          onClick={() => (esMovil ? cerrarMenu() : setColapsado((valor) => !valor))}
          aria-label={esMovil ? 'Cerrar menú' : compacto ? 'Expandir menú' : 'Colapsar menú'}
          aria-expanded={!compacto}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d={compacto ? 'M9 6l6 6-6 6' : 'M15 6l-6 6 6 6'} />
          </svg>
        </button>
      </div>

      <nav className="sidebar-nav" aria-label="Secciones">
        {GRUPOS.map((grupo) => (
          <div className="sidebar-grupo" key={grupo.titulo}>
            {compacto ? <hr className="sidebar-separador" /> : <span className="sidebar-grupo-titulo">{grupo.titulo}</span>}
            {grupo.items.map((item) => {
              const activo = itemActivo === item.id
              return (
                <button
                  key={item.id}
                  type="button"
                  className={`sidebar-item ${activo ? 'sidebar-item--activo' : ''}`}
                  onClick={() => { onSeleccionar?.(item.id); cerrarMenu() }}
                  aria-current={activo ? 'page' : undefined}
                  aria-label={compacto ? item.etiqueta : undefined}
                  title={compacto ? item.etiqueta : undefined}
                >
                  <Icono ruta={item.icono} />
                  {!compacto && (
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
          <div className="sidebar-usuario" title={compacto ? `${nombreCompleto} · ${usuario.email}` : undefined}>
            <span className="sidebar-avatar" aria-hidden="true">{iniciales(usuario)}</span>
            {!compacto && (
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
          onClick={() => { cerrarMenu(); onCerrarSesion?.() }}
          aria-label={compacto ? 'Cerrar sesión' : undefined}
          title={compacto ? 'Cerrar sesión' : undefined}
        >
          <Icono ruta="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9" />
          {!compacto && <span className="sidebar-item-texto">Cerrar sesión</span>}
        </button>
      </div>
    </aside>
    </>
  )
}

export default SidebarMenu
