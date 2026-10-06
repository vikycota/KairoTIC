
import { useEffect, useMemo, useState } from 'react'
import ImportarPlanModal from './ImportarPlanModal'
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

function normalizarCategoria(categoria) {
  if (!categoria) return 'sin-categoria'

  const valor = categoria.trim().toLowerCase()

  // Si Ollama ya devolvió directamente el id
  const porId = CATEGORIAS.find(
    (cat) => cat.id.toLowerCase() === valor
  )

  if (porId) return porId.id

  // Si devolvió el nombre visible
  const porNombre = CATEGORIAS.find(
    (cat) => cat.nombre.toLowerCase() === valor
  )

  if (porNombre) return porNombre.id

  // Algunas variantes posibles
  if (valor.includes('básicas específicas')) {
    return 'basicas-especificas'
  }

  if (valor.includes('básicas comunes')) {
    return 'basicas-comunes'
  }

  if (valor.includes('ingeniería aplicada')) {
    return 'ingenieria-aplicada'
  }

  if (valor.includes('proyecto')) {
    return 'proyecto-integrador'
  }

  if (valor.includes('informática')) {
    return 'informatica-comunes'
  }

  if (valor.includes('social')) {
    return 'cs-sociales'
  }

  if (valor.includes('electiv')) {
    return 'electivas'
  }

  return 'sin-categoria'
}

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

function StudyPlanPage() {

  
  const [archivoPlan, setArchivoPlan] = useState(null)
  const [analizandoPlan, setAnalizandoPlan] = useState(false)
  const [planImportado, setPlanImportado] = useState(null)
  const [semestres, setSemestres] = useState(SEMESTRES)
  const [carrera, setCarrera] = useState('')
  const [carreras, setCarreras] = useState([])
  const [seleccion, setSeleccion] = useState('')
  const [planApi, setPlanApi] = useState(null)
  const [errorPlan, setErrorPlan] = useState('')
  const [modalAbierto, setModalAbierto] = useState(false)
    useEffect(() => {
      fetch('/api/carreras')
        .then((res) => res.ok ? res.json() : Promise.reject())
        .then((data) => setCarreras(data.carreras ?? []))
        .catch(() => setCarreras([]))
    }, [])

    useEffect(() => {
      if (!seleccion) return
      let vigente = true
      fetch(`/api/plan?carrera=${encodeURIComponent(seleccion)}`)
        .then((res) => res.ok ? res.json() : Promise.reject())
        .then((data) => {
          if (vigente) { setPlanApi(data); setErrorPlan('') }
        })
        .catch(() => vigente && setErrorPlan('No se pudo cargar el plan de esa carrera.'))
      return () => { vigente = false }
    }, [seleccion])

    const plan = useMemo(() => {
      if (seleccion && planApi?.carrera === seleccion) return planDesdeApi(planApi)
      return seleccion ? PLAN_EJEMPLO : { nombre: carrera || 'Plan de ejemplo', categorias: CATEGORIAS, semestres, extras: EXTRAS }
    }, [seleccion, planApi, carrera, semestres])
    const total = totalCreditosPlan(plan)

    function alImportar(nombre) {
      setModalAbierto(false)
      fetch('/api/carreras').then((res) => res.json()).then((data) => setCarreras(data.carreras ?? [])).catch(() => {})
      setSeleccion(nombre)
    }

    const [creditosCompletados, setCreditosCompletados] = useState({})
  async function importarPlan() {
    if (!archivoPlan) {return}
    setAnalizandoPlan(true)
    try {
      const formData = new FormData()
      formData.append(
        'pdf',
        archivoPlan)
      const respuesta = await fetch(
        '/api/study-plan/import',
        {
          method: 'POST',
          body: formData
        }
      )
      const datos = await respuesta.json()
      if (!respuesta.ok) {
        throw new Error(
          datos.error ??
          'No se pudo importar el plan')}
      setPlanImportado(datos)
      console.log(datos)
    } catch (error) {
      console.error(error)
    } finally {
      setAnalizandoPlan(false)
    }
  }
  function cancelarImportacion() {
    setPlanImportado(null)
  }
  function confirmarPlan() {
    if (!planImportado) return

    setCarrera(planImportado.carrera ?? '')

    const nuevosSemestres = planImportado.semestres.map((semestre) => ({
      numero: semestre.numero,

      nombre:
        NOMBRES_SEMESTRE[semestre.numero] ??
        `Semestre ${semestre.numero}`,

      materias: semestre.materias.map((materia) => ({
        cat: normalizarCategoria(materia.categoria),
        codigo: materia.codigo ?? '',
        nombre: materia.nombre ?? '',

        creditos: Number(materia.creditos) || 0,
      })),
    }))

    setSemestres(nuevosSemestres)
    setSeleccion('')

    setPlanImportado(null)
    setArchivoPlan(null)
  }


  function agregarCredito(nombre, maximo) {
    setCreditosCompletados((anteriores) => {
      const actuales = anteriores[nombre] ?? 0

      return {
        ...anteriores,
        [nombre]: Math.min(actuales + 1, maximo)
      }
    })
  }

  function quitarCredito(nombre, maximo) {
    setCreditosCompletados((anteriores) => {
      const actuales = anteriores[nombre] ?? 0

      return {
        ...anteriores,
        [nombre]: Math.max(actuales - 1, 0)
      }
    })
  }
  return (
    <main className="estudio-page">
      <section className="estudio-card">
        <header className="estudio-header">
            <div className="estudio-header-text">
                <h1 className="estudio-title">Plan de estudio</h1>
                <p className="estudio-subtitle">
                Materias por semestre y créditos ECTS
                </p>
            </div>

            <div className="estudio-header-buttons">
                <div className="add-plan-button">
                    {carreras.length > 0 && (
                      <select className="plan-select" value={seleccion} onChange={(e) => setSeleccion(e.target.value)} aria-label="Carrera">
                        <option value="">Plan de ejemplo</option>
                        {carreras.map((item) => <option key={item.nombre} value={item.nombre}>{item.nombre}</option>)}
                      </select>
                    )}
                    <button type="button" onClick={() => setModalAbierto(true)}>Agregar plan de estudio</button>
                    <input
                      type="file"
                      accept=".pdf"
                      onChange={(e) => {
                        setArchivoPlan(e.target.files[0])
                      }}
                    />

                    <button
                      type="button"
                      onClick={importarPlan}
                      disabled={!archivoPlan || analizandoPlan}
                    >
                      {analizandoPlan
                        ? 'Analizando...'
                        : 'Importar plan'}
                    </button>

                </div>
                </div>
            </header>

        {errorPlan && <p className="plan-error" role="alert">{errorPlan}</p>}

        <div className="plan-tablero" style={{ '--semestres': plan.semestres.length }}>
          {plan.semestres.map((s) => (
            <section className="plan-semestre" key={s.numero}>
              <header className="plan-semestre-cabecera">
                <span className="plan-sem-nombre">{s.nombre}</span>
                <span className="plan-sem-creditos">{totalCreditos(s)} ECTS</span>
              </header>
              <div className="plan-semestre-materias">
                {s.especial ? (
                  <span className="estudio-chip plan-chip-internacional">
                    {s.especial}: {s.creditosElectivos} créd. electivos
                  </span>
                ) : (
                  s.materias.map((m) => {
                    const cat = plan.categorias.find((c) => c.id === m.cat)
                    const ayuda = [
                      cat?.nombre,
                      m.previas?.length ? `Previas: ${m.previas.join(', ')}` : null,
                    ].filter(Boolean).join(' · ')
                    return (
                      <span
                        className={`estudio-chip ${cat?.color ?? ''}`}
                        key={m.codigo || m.nombre}
                        title={ayuda || undefined}
                      >
                        <span className="estudio-chip-texto">{m.codigo || m.nombre}</span>
                        <span className="plan-chip-creditos">{m.creditos}</span>
                      </span>
                    )
                  })
                )}
              </div>
            </section>
          ))}
        </div>

        <div className="plan-leyenda">
          {plan.categorias.map((cat) => ({
            cat,
            creditos: plan.semestres.reduce(
              (acc, s) => acc + materiasDe(s, cat.id).reduce((a, m) => a + m.creditos, 0),
              0
            ),
          })).filter(({ creditos }) => creditos > 0).map(({ cat, creditos }) => (
            <span className={`plan-leyenda-item ${cat.color}`} key={cat.id}>
              {cat.nombre} <strong>{creditos}</strong>
            </span>
          ))}
        </div>

        <div className="plan-extras">
          {plan.extras.map((e) => {
            const completados = creditosCompletados[e.nombre] ?? 0

            return (
              <div className="plan-extra-card" key={e.nombre}>
                <span className="plan-extra-nombre">
                  {e.nombre}
                </span>

                <div className="plan-extra-progreso">
                  <span className="plan-extra-creditos">
                    {completados}/{e.creditos} ECTS
                  </span>

                  <button
                    type="button"
                    className="plan-extra-button"
                    onClick={() => agregarCredito(e.nombre, e.creditos)}
                  >
                    +
                  </button>

                  <button
                    type="button"
                    className="plan-extra-button"
                    onClick={() => quitarCredito(e.nombre, e.creditos)}
                  >
                    -
                  </button>
                </div>
              </div>
            )
          })}
          <div className="plan-extra-card plan-extra-total">
            <span className="plan-extra-nombre">Total de la carrera</span>
            <span className="plan-extra-creditos">{total} ECTS</span>
          </div>
        </div>
      </section>

      {planImportado && (
        <div className="plan-modal-overlay">

          <div className="plan-modal">

            <div className="plan-modal-header">

              <div>
                <h2 className="plan-modal-title">
                  Plan de estudio detectado
                </h2>

                <p className="plan-modal-carrera">
                  {planImportado.carrera ?? 'Carrera no identificada'}
                </p>
              </div>

              <button
                type="button"
                className="plan-modal-cerrar"
                onClick={cancelarImportacion}
                aria-label="Cerrar"
              >
                ×
              </button>

            </div>


            <div className="plan-modal-content">

              {planImportado.semestres?.map((semestre) => (

                <div
                  className="plan-modal-semestre"
                  key={semestre.numero}
                >

                  <h3>
                    Semestre {semestre.numero}
                  </h3>

                  <div className="plan-modal-materias">

                    {semestre.materias?.map((materia, index) => (

                      <div
                        className="plan-modal-materia"
                        key={`${semestre.numero}-${index}`}
                      >

                        <div className="plan-modal-materia-info">

                          <span className="plan-modal-materia-nombre">
                            {materia.nombre}
                          </span>

                          {materia.categoria && (
                            <span className="plan-modal-materia-categoria">
                              {materia.categoria}
                            </span>
                          )}

                        </div>

                        <span className="plan-modal-materia-creditos">
                          {materia.creditos} ECTS
                        </span>

                      </div>

                    ))}

                  </div>

                </div>

              ))}

            </div>


            <div className="plan-modal-actions">

              <button
                type="button"
                className="plan-modal-cancelar"
                onClick={cancelarImportacion}
              >
                Cancelar
              </button>

              <button
                type="button"
                className="plan-modal-confirmar"
                onClick={confirmarPlan}
              >
                Confirmar plan
              </button>

            </div>

          </div>

        </div>
      )}
      <ImportarPlanModal abierto={modalAbierto} onCerrar={() => setModalAbierto(false)} onImportado={alImportar} />
    </main>
  )
}

export default StudyPlanPage