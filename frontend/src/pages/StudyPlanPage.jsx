import { useEffect, useMemo, useState } from 'react'
import ImportarPlanModal from './ImportarPlanModal'
import { apiFetch } from '../api'
import '../pagesCSS/PlanEstudio.css'
const CATEGORIAS = [
  { id: 'basicas-comunes', nombre: 'C. Básicas comunes', color: 'cat-blue' },
  { id: 'basicas-especificas', nombre: 'C. Básicas específicas y Cs. de la Ingeniería', color: 'cat-lavender' },
  { id: 'ingenieria-aplicada', nombre: 'Ingeniería aplicada', color: 'cat-indigo' },
  { id: 'proyecto-integrador', nombre: 'Proyecto integrador', color: 'cat-coral' },
  { id: 'comunes-ingenieria', nombre: 'Comunes ingeniería', color: 'cat-mint' },
  { id: 'informatica-comunes', nombre: 'Informática comunes', color: 'cat-green' },
  { id: 'core-curriculum', nombre: 'Core curriculum', color: 'cat-sand' },
  { id: 'cs-sociales', nombre: 'Cs. sociales', color: 'cat-slate' },
  { id: 'electivas', nombre: 'Electivas', color: 'cat-teal' },
  { id: 'sin-categoria', nombre: 'Sin categoría', color: 'cat-slate' },
]



const SEMESTRES = [
  { numero: 1, nombre: 'Primer', creditos: 32, materias: [
    { cat: 'basicas-comunes', nombre: 'Análisis Mat. I', creditos: 10 },
    { cat: 'basicas-comunes', nombre: 'Álgebra Lineal', creditos: 10 },
    { cat: 'informatica-comunes', nombre: 'Programación I', creditos: 6 },
    { cat: 'comunes-ingenieria', nombre: 'Taller de Ingeniería', creditos: 4 },
    { cat: 'electivas', nombre: 'Taller', creditos: 2 },
  ]},
  { numero: 2, nombre: 'Segundo', creditos: 36, materias: [
    { cat: 'basicas-comunes', nombre: 'Análisis Mat. II', creditos: 10 },
    { cat: 'basicas-comunes', nombre: 'Álg. Lineal numérica', creditos: 8 },
    { cat: 'basicas-comunes', nombre: 'Física', creditos: 8 },
    { cat: 'informatica-comunes', nombre: 'Diseño de Base de Datos I', creditos: 6 },
    { cat: 'core-curriculum', nombre: 'Antropología', creditos: 3 },
    { cat: 'electivas', nombre: 'Taller', creditos: 1 },
  ]},
  { numero: 3, nombre: 'Tercer', creditos: 36, materias: [
    { cat: 'basicas-especificas', nombre: 'Matemática Discreta', creditos: 8 },
    { cat: 'basicas-especificas', nombre: 'Lógica', creditos: 4 },
    { cat: 'ingenieria-aplicada', nombre: 'Programación II', creditos: 6 },
    { cat: 'ingenieria-aplicada', nombre: 'Diseño de Base de Datos II', creditos: 6 },
    { cat: 'ingenieria-aplicada', nombre: 'Sistemas Digitales', creditos: 8 },
    { cat: 'core-curriculum', nombre: 'Economía', creditos: 3 },
    { cat: 'electivas', nombre: 'Taller', creditos: 1 },
  ]},
  { numero: 4, nombre: 'Cuarto', creditos: 36, materias: [
    { cat: 'basicas-especificas', nombre: 'Análisis y Diseño de Algoritmos', creditos: 6 },
    { cat: 'ingenieria-aplicada', nombre: 'Teoría de la Computación', creditos: 6 },
    { cat: 'ingenieria-aplicada', nombre: 'Redes de Datos I', creditos: 6 },
    { cat: 'proyecto-integrador', nombre: 'Proyecto TIC I', creditos: 6 },
    { cat: 'core-curriculum', nombre: 'Historia contemporánea', creditos: 3 },
    { cat: 'electivas', nombre: 'Taller', creditos: 3 },
  ]},
  { numero: 5, nombre: 'Quinto', creditos: 36, materias: [
    { cat: 'basicas-comunes', nombre: 'Probabilidad', creditos: 6 },
    { cat: 'ingenieria-aplicada', nombre: 'Ingeniería de Software I', creditos: 6 },
    { cat: 'ingenieria-aplicada', nombre: 'Arquitectura y Diseño de Apl.', creditos: 8 },
    { cat: 'ingenieria-aplicada', nombre: 'Infraestructura Informática', creditos: 6 },
    { cat: 'ingenieria-aplicada', nombre: 'Sistemas Operativos', creditos: 8 },
    { cat: 'core-curriculum', nombre: 'Ética General', creditos: 2 },
  ]},
  { numero: 6, nombre: 'Sexto', creditos: 30, materias: [
    { cat: 'ingenieria-aplicada', nombre: 'Ingeniería de Software II', creditos: 8 },
    { cat: 'ingenieria-aplicada', nombre: 'Sistemas Distribuidos', creditos: 6 },
    { cat: 'comunes-ingenieria', nombre: 'Investigación Operativa', creditos: 4 },
    { cat: 'comunes-ingenieria', nombre: 'Creatividad e Innovación', creditos: 4 },
    { cat: 'comunes-ingenieria', nombre: 'Análisis de Datos', creditos: 4 },
    { cat: 'cs-sociales', nombre: 'Contabilidad y Costos', creditos: 3 },
    { cat: 'electivas', nombre: 'Taller', creditos: 1 },
  ]},
  { numero: 7, nombre: 'Séptimo', creditos: 32, materias: [
    { cat: 'ingenieria-aplicada', nombre: 'Programación Avanzada', creditos: 6 },
    { cat: 'ingenieria-aplicada', nombre: 'Seguridad Informática', creditos: 6 },
    { cat: 'ingenieria-aplicada', nombre: 'Gestión Avanzada de Datos', creditos: 6 },
    { cat: 'ingenieria-aplicada', nombre: 'UI/UX', creditos: 4 },
    { cat: 'ingenieria-aplicada', nombre: 'Testing - QA Automatizado', creditos: 4 },
    { cat: 'comunes-ingenieria', nombre: 'Metodología de la Investigación', creditos: 2 },
    { cat: 'comunes-ingenieria', nombre: 'Estadística Aplicada', creditos: 2 },
    { cat: 'cs-sociales', nombre: 'Cuestiones de Teología', creditos: 2 },
  ]},
  { numero: 8, nombre: 'Octavo', especial: 'Semestre Internacional', creditosElectivos: 30 },
  { numero: 9, nombre: 'Noveno', creditos: 30, materias: [
    { cat: 'comunes-ingenieria', nombre: 'Gestión de Tecnologías y la Info.', creditos: 4 },
    { cat: 'proyecto-integrador', nombre: 'Proyecto Final de la Carrera', creditos: 6 },
    { cat: 'comunes-ingenieria', nombre: 'Gestión y Planificación de Proyecto', creditos: 3 },
    { cat: 'cs-sociales', nombre: 'Elementos de Gestión Empresarial', creditos: 3 },
    { cat: 'electivas', nombre: 'Específica I', creditos: 4 },
    { cat: 'electivas', nombre: 'Específica II', creditos: 4 },
    { cat: 'electivas', nombre: 'Específica III', creditos: 6 },
  ]},
  { numero: 10, nombre: 'Décimo', creditos: 30, materias: [
    { cat: 'cs-sociales', nombre: 'Derecho Informático', creditos: 4 },
    { cat: 'proyecto-integrador', nombre: 'Proyecto Final de la Carrera', creditos: 14 },
    { cat: 'comunes-ingenieria', nombre: 'Liderazgo y Gestión de Personas', creditos: 3 },
    { cat: 'cs-sociales', nombre: 'Finanzas y Proyectos de Inversión', creditos: 3 },
    { cat: 'electivas', nombre: 'Diploma', creditos: 6 },
  ]},
]

const EXTRAS = [
  { nombre: 'Pasantía', creditos: 20 },
  { nombre: 'Actividades sociales', creditos: 5 },
]
const NOMBRES_SEMESTRE = [
  '',
  'Primer',
  'Segundo',
  'Tercer',
  'Cuarto',
  'Quinto',
  'Sexto',
  'Séptimo',
  'Octavo',
  'Noveno',
  'Décimo',
]

const COLORES = CATEGORIAS.map((c) => c.color)
const PLAN_EJEMPLO = { nombre: 'Plan de ejemplo', categorias: CATEGORIAS, semestres: SEMESTRES, extras: EXTRAS }

function totalCreditosPlan(plan) {
  return plan.semestres.reduce((acc, s) => acc + totalCreditos(s), 0) +
    plan.extras.reduce((acc, e) => acc + e.creditos, 0)
}

function planDesdeApi(data) {
  const categorias = []
  for (const materia of data.materias) {
    const nombre = materia.categoria || 'Sin categoria'
    if (!categorias.some((categoria) => categoria.id === nombre)) {
      categorias.push({ id: nombre, nombre, color: COLORES[categorias.length % COLORES.length] })
    }
  }
  const cantidad = Math.max(0, ...data.materias.map((materia) => materia.semestre || 0))
  const semestres = Array.from({ length: cantidad }, (_, i) => ({
    numero: i + 1,
    nombre: NOMBRES_SEMESTRE[i + 1] || `Semestre ${i + 1}`,
    materias: [],
  }))
  const extras = []
  for (const materia of data.materias) {
    if (materia.semestre) {
      semestres[materia.semestre - 1]?.materias.push({
        cat: materia.categoria || 'Sin categoria', nombre: materia.nombre,
        creditos: materia.creditos, previas: materia.previas,
      })
    } else {
      extras.push({ nombre: materia.nombre, creditos: materia.creditos })
    }
  }
  return { nombre: data.carrera, categorias, semestres, extras }
}

function materiasDe(semestre, catId) {
  return semestre.materias?.filter((m) => m.cat === catId) ?? []
}

function totalCreditos(semestre) {
  if (semestre.especial) return semestre.creditosElectivos
  return semestre.materias.reduce((acc, m) => acc + m.creditos, 0)
}


function sinTildes(texto) {
  return texto.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim()
}

/** Número que sube de 0 al valor al aparecer (sin animación si la persona prefiere menos movimiento). */
function useContador(objetivo) {
  const reducido = typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
  const [valor, setValor] = useState(0)
  useEffect(() => {
    if (reducido) return
    let cuadro
    const inicio = performance.now()
    const paso = (ahora) => {
      const t = Math.min(1, (ahora - inicio) / 900)
      setValor(Math.round(objetivo * (1 - (1 - t) ** 3)))
      if (t < 1) cuadro = requestAnimationFrame(paso)
    }
    cuadro = requestAnimationFrame(paso)
    return () => cancelAnimationFrame(cuadro)
  }, [objetivo, reducido])
  return reducido ? objetivo : valor
}

function Dato({ valor, etiqueta }) {
  const n = useContador(valor)
  return (
    <div className="pe-dato">
      <strong>{n}</strong>
      <span>{etiqueta}</span>
    </div>
  )
}

const FORMATOS = [
  { etiqueta: 'PDF', texto: 'El plan que te dio la facultad' },
  { etiqueta: 'CSV', texto: 'Una fila por materia, desde Excel' },
  { etiqueta: 'XLSX', texto: 'Planilla de Excel' },
  { etiqueta: 'JSON', texto: 'Para quienes ya lo tienen armado' },
]

const PASOS_VACIO = [
  { titulo: 'Subí tu archivo', texto: 'Arrastralo acá o elegilo desde tu computadora.' },
  { titulo: 'Revisá la vista previa', texto: 'Verificás materias, créditos y previas antes de guardar.' },
  { titulo: 'Explorá tu carrera', texto: 'Tablero por semestre, categorías y qué materia habilita a cuál.' },
]

// Columnas decorativas: cada chip es [categoría, ancho del texto en %]
const ARTE = [
  { sem: 1, chips: [['cat-blue', 70], ['cat-mint', 55], ['cat-sand', 80]] },
  { sem: 2, chips: [['cat-lavender', 60], ['cat-coral', 75], ['cat-blue', 50]] },
  { sem: 3, chips: [['cat-green', 65], ['cat-teal', 80]] },
]

function EstadoVacio({ error, onCargar, onEjemplo, onArchivo }) {
  const [arrastrando, setArrastrando] = useState(false)

  return (
    <section className="pe-vacio">
      {error && <p className="pe-alerta" role="alert">{error}</p>}

      <div className="pe-vacio-principal">
        <div className="pe-vacio-texto">
          <span className="pe-vacio-sello">Empezá por acá</span>
          <h2>Armá el mapa de tu carrera</h2>
          <p>
            Cargá tu plan de estudio y Kairo lo convierte en un tablero por semestre: créditos,
            categorías y qué materia es previa de cuál, todo a la vista.
          </p>
          <div className="pe-vacio-botones">
            <button type="button" className="pe-btn pe-btn--primario" onClick={onCargar}>Cargar mi plan</button>
            <button type="button" className="pe-btn pe-btn--claro" onClick={onEjemplo}>Ver un ejemplo</button>
          </div>
        </div>

        <div
          className={`pe-arte ${arrastrando ? 'pe-arte--activo' : ''}`}
          onDragOver={(e) => { e.preventDefault(); setArrastrando(true) }}
          onDragLeave={() => setArrastrando(false)}
          onDrop={(e) => {
            e.preventDefault()
            setArrastrando(false)
            const archivo = e.dataTransfer.files[0]
            if (archivo) onArchivo(archivo)
          }}
        >
          <div className="pe-arte-cols">
            {ARTE.map((col, c) => (
              <div className="pe-arte-col" key={col.sem} aria-hidden="true">
                <span className="pe-arte-sem">{col.sem}</span>
                {col.chips.map(([cat, ancho], i) => (
                  <span className={`pe-arte-chip ${cat}`} key={i} style={{ '--d': `${(c * 3 + i) * 0.35}s` }}>
                    <i style={{ width: `${ancho}%` }} />
                  </span>
                ))}
              </div>
            ))}
            <button type="button" className="pe-arte-mas" onClick={onCargar}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 16V4m0 0l-4 4m4-4l4 4M4 16v3a1 1 0 001 1h14a1 1 0 001-1v-3" /></svg>
              <span>{arrastrando ? 'Soltá el archivo' : 'Soltá tu plan acá'}</span>
            </button>
          </div>
          <span className="pe-flota pe-flota--1" aria-hidden="true">PDF</span>
          <span className="pe-flota pe-flota--2" aria-hidden="true">CSV</span>
          <span className="pe-flota pe-flota--3" aria-hidden="true">XLSX</span>
        </div>
      </div>

      <ul className="pe-formatos" aria-label="Formatos admitidos">
        {FORMATOS.map((f) => (
          <li key={f.etiqueta}>
            <strong>{f.etiqueta}</strong>
            <span>{f.texto}</span>
          </li>
        ))}
      </ul>

      <ol className="pe-vacio-pasos">
        {PASOS_VACIO.map((p, i) => (
          <li key={p.titulo}>
            <span>{i + 1}</span>
            <div>
              <strong>{p.titulo}</strong>
              <p>{p.texto}</p>
            </div>
          </li>
        ))}
      </ol>
    </section>
  )
}

function StudyPlanPage() {
  const [carreras, setCarreras] = useState([])
  const [seleccion, setSeleccion] = useState('')
  const [planApi, setPlanApi] = useState(null)
  const [errorPlan, setErrorPlan] = useState('')
  const [modalAbierto, setModalAbierto] = useState(false)
  const [confirmarBorrado, setConfirmarBorrado] = useState(false)
  const [eliminando, setEliminando] = useState(false)
  const [creditosCompletados, setCreditosCompletados] = useState({})
  const [busqueda, setBusqueda] = useState('')
  const [catActiva, setCatActiva] = useState(null)
  const [materiaSel, setMateriaSel] = useState(null)   // nombre de la materia elegida
  const [carrerasListas, setCarrerasListas] = useState(false)
  const [verEjemplo, setVerEjemplo] = useState(false)
  const [archivoModal, setArchivoModal] = useState(null)

  useEffect(() => {
    apiFetch('/api/carreras')
      .then((res) => res.ok ? res.json() : Promise.reject())
      .then((data) => {
        const lista = data.carreras ?? []
        setCarreras(lista)
        if (lista.length) setSeleccion((actual) => actual || lista[0].nombre)
      })
      .catch(() => setCarreras([]))
      .finally(() => setCarrerasListas(true))
  }, [])

  useEffect(() => {
    if (!seleccion) return
    let vigente = true
    apiFetch(`/api/plan?carrera=${encodeURIComponent(seleccion)}`)
      .then((res) => res.ok ? res.json() : Promise.reject())
      .then((data) => {
        if (vigente) { setPlanApi(data); setErrorPlan('') }
      })
      .catch(() => vigente && setErrorPlan('No se pudo cargar el plan de esa carrera.'))
    return () => { vigente = false }
  }, [seleccion])

  const plan = useMemo(() => {
    if (seleccion && planApi?.carrera === seleccion) return planDesdeApi(planApi)
    return seleccion ? PLAN_EJEMPLO : { nombre: 'Plan de ejemplo', categorias: CATEGORIAS, semestres: SEMESTRES, extras: EXTRAS }
  }, [seleccion, planApi])

  const vacio = carrerasListas && carreras.length === 0 && !verEjemplo
  const sinPlan = !carrerasListas || vacio
  const total = totalCreditosPlan(plan)
  const nombrePlan = (plan.nombre || 'Plan de ejemplo').replace(/^\p{L}/u, (l) => l.toLocaleUpperCase('es'))
  const todasLasMaterias = plan.semestres.flatMap((s) => s.materias ?? [])
  const maxSemestre = Math.max(1, ...plan.semestres.map(totalCreditos))
  const q = sinTildes(busqueda)

  const seleccionada = todasLasMaterias.find((m) => m.nombre === materiaSel) ?? null
  const habilita = seleccionada
    ? todasLasMaterias.filter((m) => m.previas?.includes(seleccionada.nombre)).map((m) => m.nombre)
    : []
  const semestreDeSel = seleccionada
    ? plan.semestres.find((s) => s.materias?.includes(seleccionada))
    : null
  const catSel = seleccionada ? plan.categorias.find((c) => c.id === seleccionada.cat) : null

  const categoriasConCreditos = plan.categorias
    .map((cat) => ({
      cat,
      creditos: plan.semestres.reduce((acc, s) => acc + materiasDe(s, cat.id).reduce((a, m) => a + m.creditos, 0), 0),
    }))
    .filter(({ creditos }) => creditos > 0)

  function alImportar(nombre) {
    setModalAbierto(false)
    cargarCarreras()
    setVerEjemplo(false)
    setSeleccion(nombre)
  }

  function cargarCarreras(elegirPrimera = false) {
    apiFetch('/api/carreras')
      .then((res) => res.ok ? res.json() : Promise.reject())
      .then((data) => {
        const lista = data.carreras ?? []
        setCarreras(lista)
        if (elegirPrimera && lista.length) setSeleccion((actual) => actual || lista[0].nombre)
      })
      .catch(() => {})
  }

  function abrirCarga(archivo = null) {
    setArchivoModal(archivo)
    setModalAbierto(true)
  }

  async function eliminarPlan() {
    setEliminando(true)
    setErrorPlan('')
    try {
      const res = await apiFetch(`/api/plan?carrera=${encodeURIComponent(seleccion)}`, { method: 'DELETE' })
      if (!res.ok) {
        let json = {}
        try { json = await res.json() } catch { /* sin JSON */ }
        throw new Error(res.status >= 502 ? 'El servidor no responde. Verificá que el backend esté encendido.' : json.error || 'No se pudo eliminar el plan.')
      }
      setConfirmarBorrado(false)
      setPlanApi(null)
      setMateriaSel(null)
      setSeleccion('')
      cargarCarreras(true)
    } catch (e) {
      setErrorPlan(e.message === 'Failed to fetch' ? 'No se pudo conectar con el servidor.' : e.message)
      setConfirmarBorrado(false)
    } finally {
      setEliminando(false)
    }
  }

  function cambiarCredito(nombre, maximo, delta) {
    setCreditosCompletados((anteriores) => ({
      ...anteriores,
      [nombre]: Math.min(maximo, Math.max(0, (anteriores[nombre] ?? 0) + delta)),
    }))
  }

  return (
    <main className="pe-page">
      {/* ---------- Cabecera ---------- */}
      <header className="pe-hero">
        <span className="pe-blob pe-blob--1" aria-hidden="true" />
        <span className="pe-blob pe-blob--2" aria-hidden="true" />

        <div className="pe-hero-fila">
          <div>
            <span className="pe-etiqueta">Plan de estudio</span>
            <h1>{sinPlan ? 'Tu plan de estudio' : nombrePlan}</h1>
            <p>
              {sinPlan
                ? 'Todavía no cargaste ninguno. Empezá subiendo el de tu carrera.'
                : 'Materias por semestre y créditos ECTS. Tocá una materia para ver sus previas.'}
            </p>
          </div>

          <div className="pe-acciones">
            {carreras.length > 0 && (
              <select className="pe-select" value={seleccion} onChange={(e) => setSeleccion(e.target.value)} aria-label="Carrera" title={seleccion || 'Plan de ejemplo'}>
                <option value="" disabled={!verEjemplo}>Plan de ejemplo</option>
                {carreras.map((item) => <option key={item.nombre} value={item.nombre}>{item.nombre}</option>)}
              </select>
            )}
            <button type="button" className="pe-btn pe-btn--rosa" onClick={() => abrirCarga()}>
              Cargar plan de estudio
            </button>
            {seleccion && !sinPlan && (
              <button type="button" className="pe-btn pe-btn--peligro" onClick={() => setConfirmarBorrado(true)}>
                Eliminar plan
              </button>
            )}
          </div>
        </div>

        {!sinPlan && <div className="pe-datos">
          <Dato valor={total} etiqueta="ECTS en total" />
          <Dato valor={plan.semestres.length} etiqueta="semestres" />
          <Dato valor={todasLasMaterias.length} etiqueta="materias" />
          <Dato valor={categoriasConCreditos.length} etiqueta="categorías" />
        </div>}
      </header>

      {!carrerasListas && (
        <div className="pe-contenido pe-esqueleto" aria-busy="true" aria-label="Cargando">
          <span /><span /><span />
        </div>
      )}

      {vacio && (
        <EstadoVacio
          error={errorPlan}
          onCargar={() => abrirCarga()}
          onEjemplo={() => { setVerEjemplo(true); setSeleccion('') }}
          onArchivo={(archivo) => abrirCarga(archivo)}
        />
      )}

      {!sinPlan && (
      <div className="pe-contenido">
        {verEjemplo && carreras.length === 0 && (
          <div className="pe-ejemplo" role="status">
            <span>Estás viendo un plan de ejemplo.</span>
            <div>
              <button type="button" className="pe-btn pe-btn--primario" onClick={() => abrirCarga()}>Cargar mi plan</button>
              <button type="button" className="pe-btn pe-btn--claro" onClick={() => setVerEjemplo(false)}>Volver</button>
            </div>
          </div>
        )}
        {errorPlan && <p className="pe-alerta" role="alert">{errorPlan}</p>}

        {/* ---------- Búsqueda y filtros ---------- */}
        <section className="pe-filtros" aria-label="Filtros">
          <label className="pe-buscar">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="M20 20l-3.5-3.5" /></svg>
            <input
              type="search"
              placeholder="Buscar materia…"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              aria-label="Buscar materia"
            />
          </label>

          <div className="pe-leyenda">
            {categoriasConCreditos.map(({ cat, creditos }) => (
              <button
                type="button"
                key={cat.id}
                className={`pe-cat ${cat.color} ${catActiva === cat.id ? 'pe-cat--activa' : ''}`}
                aria-pressed={catActiva === cat.id}
                onClick={() => setCatActiva((a) => (a === cat.id ? null : cat.id))}
              >
                <i aria-hidden="true" />
                {cat.nombre} <strong>{creditos}</strong>
              </button>
            ))}
          </div>
        </section>

        {/* ---------- Detalle de la materia elegida ---------- */}
        {seleccionada && (
          <aside className="pe-detalle" aria-live="polite">
            <div className={`pe-detalle-marca ${catSel?.color ?? ''}`} aria-hidden="true" />
            <div className="pe-detalle-cuerpo">
              <h2>{seleccionada.nombre}</h2>
              <p>
                {semestreDeSel?.nombre} semestre · {seleccionada.creditos} ECTS{catSel ? ` · ${catSel.nombre}` : ''}
              </p>
              <div className="pe-detalle-listas">
                <div>
                  <span>Previas</span>
                  {seleccionada.previas?.length
                    ? <ul>{seleccionada.previas.map((p) => <li className="pe-prev" key={p}>{p}</li>)}</ul>
                    : <em>Sin previas</em>}
                </div>
                <div>
                  <span>Habilita</span>
                  {habilita.length
                    ? <ul>{habilita.map((p) => <li className="pe-sig" key={p}>{p}</li>)}</ul>
                    : <em>No es previa de otras materias</em>}
                </div>
              </div>
            </div>
            <button type="button" className="pe-cerrar" onClick={() => setMateriaSel(null)} aria-label="Cerrar detalle">×</button>
          </aside>
        )}

        {/* ---------- Tablero por semestre ---------- */}
        <div className="pe-tablero" lang="es">
          {plan.semestres.map((s, i) => (
            <section className="pe-semestre" key={s.numero} style={{ '--i': i }}>
              <header>
                <span className="pe-sem-num">{s.numero}</span>
                <div className="pe-sem-titulo">
                  <strong>{s.nombre}</strong>
                  <span>{totalCreditos(s)} ECTS</span>
                </div>
                <div className="pe-sem-barra" aria-hidden="true">
                  <span style={{ width: `${(totalCreditos(s) / maxSemestre) * 100}%` }} />
                </div>
              </header>

              <div className="pe-materias">
                {s.especial ? (
                  <span className="pe-internacional">
                    {s.especial}: {s.creditosElectivos} créd. electivos
                  </span>
                ) : (
                  s.materias.map((m) => {
                    const cat = plan.categorias.find((c) => c.id === m.cat)
                    const visible = (!catActiva || m.cat === catActiva) && (!q || sinTildes(m.nombre).includes(q))
                    const estado = m.nombre === materiaSel
                      ? 'pe-materia--sel'
                      : seleccionada?.previas?.includes(m.nombre)
                        ? 'pe-materia--previa'
                        : habilita.includes(m.nombre)
                          ? 'pe-materia--siguiente'
                          : ''
                    return (
                      <button
                        type="button"
                        key={m.nombre}
                        className={`pe-materia ${cat?.color ?? ''} ${estado} ${visible ? '' : 'pe-materia--tenue'}`}
                        aria-pressed={m.nombre === materiaSel}
                        title={cat?.nombre}
                        onClick={() => setMateriaSel((a) => (a === m.nombre ? null : m.nombre))}
                      >
                        <span className="pe-materia-nombre">{m.nombre}</span>
                        <span className="pe-materia-cred">{m.creditos}</span>
                      </button>
                    )
                  })
                )}
              </div>
            </section>
          ))}
        </div>

        {/* ---------- Extras y total ---------- */}
        <section className="pe-extras" aria-label="Créditos adicionales">
          {plan.extras.map((e) => {
            const completados = creditosCompletados[e.nombre] ?? 0
            return (
              <div className="pe-extra" key={e.nombre}>
                <div className="pe-extra-cab">
                  <strong>{e.nombre}</strong>
                  <span>{completados}/{e.creditos} ECTS</span>
                </div>
                <div className="pe-extra-barra"><span style={{ width: `${(completados / e.creditos) * 100}%` }} /></div>
                <div className="pe-extra-botones">
                  <button type="button" onClick={() => cambiarCredito(e.nombre, e.creditos, -1)} aria-label={`Quitar un crédito de ${e.nombre}`}>−</button>
                  <button type="button" onClick={() => cambiarCredito(e.nombre, e.creditos, 1)} aria-label={`Sumar un crédito a ${e.nombre}`}>+</button>
                </div>
              </div>
            )
          })}
          <div className="pe-extra pe-extra--total">
            <div className="pe-extra-cab">
              <strong>Total de la carrera</strong>
              <span>{total} ECTS</span>
            </div>
          </div>
        </section>
      </div>
      )}

      {confirmarBorrado && (
        <div className="pe-modal-fondo" onMouseDown={(e) => e.target === e.currentTarget && !eliminando && setConfirmarBorrado(false)}>
          <div className="pe-modal pe-modal--confirmar" role="alertdialog" aria-modal="true" aria-labelledby="pe-borrar-titulo" aria-describedby="pe-borrar-texto">
            <header>
              <h2 id="pe-borrar-titulo">¿Eliminar este plan?</h2>
            </header>
            <p id="pe-borrar-texto" className="pe-confirmar-texto">
              Se va a eliminar <strong>{seleccion}</strong> con todas sus materias. Esta acción no se puede deshacer.
            </p>
            <footer>
              <button type="button" className="pe-btn pe-btn--claro" onClick={() => setConfirmarBorrado(false)} disabled={eliminando}>Cancelar</button>
              <button type="button" className="pe-btn pe-btn--rojo" onClick={eliminarPlan} disabled={eliminando}>
                {eliminando ? 'Eliminando…' : 'Eliminar plan'}
              </button>
            </footer>
          </div>
        </div>
      )}

      {modalAbierto && (
        <ImportarPlanModal abierto archivoInicial={archivoModal} onCerrar={() => setModalAbierto(false)} onImportado={alImportar} />
      )}
    </main>
  )
}

export default StudyPlanPage
