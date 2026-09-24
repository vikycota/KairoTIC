
import { useRef, useState } from 'react'
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

function materiasDe(semestre, catId) {
  return semestre.materias?.filter((m) => m.cat === catId) ?? []
}

function totalCreditos(semestre) {
  if (semestre.especial) return semestre.creditosElectivos
  return semestre.materias.reduce((acc, m) => acc + m.creditos, 0)
}

const TOTAL_CARRERA =
  SEMESTRES.reduce((acc, s) => acc + totalCreditos(s), 0) +
  EXTRAS.reduce((acc, e) => acc + e.creditos, 0)

function StudyPlanPage() {
    const gridRef = useRef(null)
    const [creditosCompletados, setCreditosCompletados] = useState({})
    function moverPlan(direccion) {
      gridRef.current?.scrollBy({
          left: direccion * 450,
          behavior: 'smooth',
      })
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
    <main className="plan-page">
      <section className="plan-card">
        <header className="plan-header">
            <div className="plan-header-text">
                <h1 className="plan-title">Plan de estudio</h1>
                <p className="plan-subtitle">
                Materias por semestre y créditos ECTS
                </p>
            </div>

            <div className="plan-header-buttons">
                <div className="add-plan-button">
                    <button >
                        Agregar plan de estudio
                    </button>
                </div>

                <div className="plan-nav">
                    <button
                    type="button"
                    onClick={() => moverPlan(-1)}
                    aria-label="Mover plan hacia la izquierda"
                    >
                    ‹
                    </button>

                    <button
                    type="button"
                    onClick={() => moverPlan(1)}
                    aria-label="Mover plan hacia la derecha"
                    >
                    ›
                    </button>
                </div>
                </div>
            </header>

        <div className="plan-grid-wrapper" ref={gridRef}>
          <div
            className="plan-grid"
            style={{ gridTemplateColumns: `200px repeat(${SEMESTRES.length}, minmax(150px, 1fr)) 100px` }}
          >
            <div className="plan-cell plan-corner">Área</div>
            {SEMESTRES.map((s) => (
              <div className="plan-cell plan-sem-head" key={s.numero}>
                <span className="plan-sem-nombre">{s.nombre}</span>
                <span className="plan-sem-creditos">{totalCreditos(s)} ECTS</span>
              </div>
            ))}
            <div className="plan-cell plan-sem-head plan-resumen-head">Resumen</div>

            {CATEGORIAS.map((cat) => {
              const totalCat = SEMESTRES.reduce(
                (acc, s) => acc + materiasDe(s, cat.id).reduce((a, m) => a + m.creditos, 0),
                0
              )
              return (
                <div className="plan-row" key={cat.id}>
                  <div className={`plan-cell plan-cat ${cat.color}`}>{cat.nombre}</div>
                  {SEMESTRES.map((s) => (
                    <div className="plan-cell plan-slot" key={s.numero}>
                      {s.especial ? (
                        cat.id === 'electivas' && (
                          <span className="plan-chip plan-chip-internacional">
                            {s.creditosElectivos} créd. electivos
                          </span>
                        )
                      ) : (
                        materiasDe(s, cat.id).map((m) => (
                          <span className={`plan-chip ${cat.color}`} key={m.nombre}>
                            <span className="plan-chip-texto">{m.nombre}</span>
                            <span className="plan-chip-creditos">{m.creditos}</span>
                          </span>
                        ))
                      )}
                    </div>
                  ))}
                  <div className="plan-cell plan-total">{totalCat || '—'}</div>
                </div>
              )
            })}
          </div>
        </div>

        <div className="plan-extras">
          {EXTRAS.map((e) => {
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
            <span className="plan-extra-creditos">{TOTAL_CARRERA} ECTS</span>
          </div>
        </div>
      </section>
    </main>
  )
}

export default StudyPlanPage