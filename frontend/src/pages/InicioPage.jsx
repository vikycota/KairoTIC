import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import ImportarPlanModal from './ImportarPlanModal'
import ScheduleImportPanel from './ScheduleImportPanel'
import { apiFetch, EVENTO_CARRERAS_ACTUALIZADAS } from '../api'
import '../pagesCSS/InicioPage.css'

const DIAS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']
const CLAVE_HORARIOS = 'kairo-horarios'
const CLAVE_TALLERES = 'kairo-talleres'

const PLANTILLAS = {
  horarios: {
    archivo: 'plantilla_horarios.csv',
    contenido: 'materia;dia;inicio;fin;salon;docente\nProgramación I;Lun;08:00;10:00;A101;Ana Pérez\nAnálisis Mat. I;Mar;10:00;12:00;B203;Luis Gómez\n',
  },
  talleres: {
    archivo: 'plantilla_talleres.csv',
    contenido: 'taller;dia;inicio;fin;salon;cupos\nTaller de Oratoria;Mié;18:00;20:00;C305;25\nTaller de Liderazgo;Vie;16:00;18:00;C101;30\n',
  },
}

/* ---------- utilidades de lectura de archivos ---------- */

function leerStorage(clave) {
  try {
    return JSON.parse(localStorage.getItem(clave)) ?? null
  } catch {
    return null
  }
}

function guardarStorage(clave, valor) {
  try {
    if (valor) localStorage.setItem(clave, JSON.stringify(valor))
    else localStorage.removeItem(clave)
  } catch { /* sin almacenamiento: los datos duran hasta recargar */ }
}

function clavePeriodoTaller(carrera, anio, semestre) {
  return JSON.stringify([carrera, String(anio), String(semestre)])
}

function parsearCsv(texto) {
  const limpio = texto.charCodeAt(0) === 0xFEFF ? texto.slice(1) : texto
  const primera = limpio.split(/\r?\n/, 1)[0] ?? ''
  const sep = (primera.match(/;/g) ?? []).length >= (primera.match(/,/g) ?? []).length ? ';' : ','
  const filas = []
  let fila = [], campo = '', comillas = false
  for (let i = 0; i < limpio.length; i++) {
    const c = limpio[i]
    if (comillas) {
      if (c === '"' && limpio[i + 1] === '"') { campo += '"'; i++ }
      else if (c === '"') comillas = false
      else campo += c
    } else if (c === '"') comillas = true
    else if (c === sep) { fila.push(campo.trim()); campo = '' }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && limpio[i + 1] === '\n') i++
      fila.push(campo.trim()); campo = ''
      if (fila.some(Boolean)) filas.push(fila)
      fila = []
    } else campo += c
  }
  fila.push(campo.trim())
  if (fila.some(Boolean)) filas.push(fila)
  return filas
}

function sinTildes(s) {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim()
}

function normalizarDia(valor) {
  const v = sinTildes(valor).slice(0, 3)
  const mapa = { lun: 'Lun', mar: 'Mar', mie: 'Mié', jue: 'Jue', vie: 'Vie', sab: 'Sáb', dom: 'Dom' }
  return mapa[v] ?? null
}

function normalizarHora(valor) {
  const m = /^(\d{1,2})(?::|\.|h)?(\d{2})?(?::\d{2}(?:\.\d+)?)?$/.exec(valor.trim())
  if (!m) return null
  const h = Number(m[1]), min = Number(m[2] ?? 0)
  if (h > 23 || min > 59) return null
  return `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`
}

/** Convierte un CSV en bloques {nombre, dia, inicio, fin, salon, extra}. */
function leerBloques(texto, tipo) {
  const filas = parsearCsv(texto)
  if (filas.length < 2) return { bloques: [], errores: ['El archivo no tiene filas de datos.'] }
  const cabecera = filas[0].map(sinTildes)
  const col = (...nombres) => cabecera.findIndex((c) => nombres.includes(c))
  const idx = {
    nombre: col('materia', 'taller', 'nombre', 'asignatura'),
    dia: col('dia', 'día'),
    inicio: col('inicio', 'desde', 'hora inicio', 'hora_inicio'),
    fin: col('fin', 'hasta', 'hora fin', 'hora_fin'),
    salon: col('salon', 'aula', 'lugar'),
    extra: tipo === 'horarios' ? col('docente', 'profesor') : col('cupos', 'cupo'),
  }
  const faltan = ['nombre', 'dia', 'inicio', 'fin'].filter((k) => idx[k] < 0)
  if (faltan.length) {
    const esperado = tipo === 'horarios' ? 'materia, dia, inicio, fin' : 'taller, dia, inicio, fin'
    return { bloques: [], errores: [`Faltan columnas obligatorias. Se esperan: ${esperado}.`] }
  }
  const bloques = [], errores = []
  filas.slice(1).forEach((f, i) => {
    const n = i + 2
    const dia = normalizarDia(f[idx.dia] ?? '')
    const inicio = normalizarHora(f[idx.inicio] ?? '')
    const fin = normalizarHora(f[idx.fin] ?? '')
    const nombre = (f[idx.nombre] ?? '').trim()
    if (!nombre) return errores.push(`Fila ${n}: falta el nombre.`)
    if (!dia) return errores.push(`Fila ${n} (${nombre}): día no válido.`)
    if (!inicio || !fin) return errores.push(`Fila ${n} (${nombre}): hora no válida (usá HH:MM).`)
    if (inicio >= fin) return errores.push(`Fila ${n} (${nombre}): la hora de fin debe ser posterior al inicio.`)
    bloques.push({
      nombre, dia, inicio, fin,
      salon: idx.salon >= 0 ? f[idx.salon] ?? '' : '',
      extra: idx.extra >= 0 ? f[idx.extra] ?? '' : '',
    })
  })
  return { bloques, errores }
}

function descargar(plantilla) {
  const url = URL.createObjectURL(new Blob(['﻿' + plantilla.contenido], { type: 'text/csv;charset=utf-8' }))
  const a = document.createElement('a')
  a.href = url
  a.download = plantilla.archivo
  a.click()
  URL.revokeObjectURL(url)
}

/* ---------- componentes ---------- */

function ZonaCarga({ id, aceptar, etiqueta, ayuda, disabled, onArchivo }) {
  const [arrastrando, setArrastrando] = useState(false)
  const entrada = useRef(null)

  function soltar(e) {
    e.preventDefault()
    setArrastrando(false)
    const f = e.dataTransfer.files[0]
    if (f && !disabled) onArchivo(f)
  }

  return (
    <label
      htmlFor={id}
      className={`inicio-zona ${arrastrando ? 'inicio-zona--activa' : ''} ${disabled ? 'inicio-zona--off' : ''}`}
      onDragOver={(e) => { e.preventDefault(); if (!disabled) setArrastrando(true) }}
      onDragLeave={() => setArrastrando(false)}
      onDrop={soltar}
    >
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M12 16V4m0 0l-4 4m4-4l4 4M4 16v3a1 1 0 001 1h14a1 1 0 001-1v-3" />
      </svg>
      <strong>{etiqueta}</strong>
      <span>{ayuda}</span>
      <input
        id={id}
        ref={entrada}
        type="file"
        accept={aceptar}
        disabled={disabled}
        onChange={(e) => {
          const f = e.target.files[0]
          if (f) onArchivo(f)
          e.target.value = ''
        }}
      />
    </label>
  )
}

function Tarjeta({ numero, titulo, descripcion, estado, resumen, children }) {
  return (
    <section className={`inicio-paso ${estado === 'listo' ? 'inicio-paso--listo' : ''}`}>
      <header className="inicio-paso-cabecera">
        <span className="inicio-paso-numero" aria-hidden="true">{estado === 'listo' ? '✓' : numero}</span>
        <div className="inicio-paso-titulos">
          <h2>{titulo}</h2>
          <p>{descripcion}</p>
        </div>
        <span className={`inicio-estado inicio-estado--${estado}`}>
          {estado === 'listo' ? 'Cargado' : 'Pendiente'}
        </span>
      </header>
      {resumen && <p className="inicio-resumen">{resumen}</p>}
      {children}
    </section>
  )
}

function Mensajes({ errores, aviso }) {
  return (
    <>
      {errores?.length > 0 && (
        <div className="inicio-caja inicio-caja--error" role="alert">
          <strong>Revisá el archivo:</strong>
          <ul>{errores.slice(0, 5).map((t, i) => <li key={i}>{t}</li>)}</ul>
          {errores.length > 5 && <span>y {errores.length - 5} más…</span>}
        </div>
      )}
      {aviso && <div className="inicio-caja inicio-caja--aviso" role="status">{aviso}</div>}
    </>
  )
}

/** Vista semanal compacta: bloques agrupados por día. */
function VistaSemana({ bloques, tipo }) {
  const porDia = useMemo(
    () => DIAS.map((d) => ({
      dia: d,
      items: bloques.filter((b) => b.dia === d).sort((a, b) => a.inicio.localeCompare(b.inicio)),
    })).filter((d) => d.items.length),
    [bloques]
  )
  return (
    <div className="inicio-semana">
      {porDia.map(({ dia, items }) => (
        <div className="inicio-dia" key={dia}>
          <span className="inicio-dia-nombre">{dia}</span>
          <ul>
            {items.map((b, i) => (
              <li key={i} className={tipo === 'talleres' ? 'inicio-bloque inicio-bloque--taller' : 'inicio-bloque'}>
                <strong>{b.nombre}</strong>
                <span>
                  {b.inicio}–{b.fin}
                  {b.salon && ` · ${b.salon}`}
                  {b.extra && ` · ${tipo === 'horarios' ? b.extra : `${b.extra} cupos`}`}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  )
}

function CargadorBloques({ tipo, clave, titulo, descripcion, numero, etiqueta, onListo }) {
  const guardadoInicial = leerStorage(clave) ?? {}
  const [bloques, setBloques] = useState(() => guardadoInicial.bloques ?? [])
  const [nombreArchivo, setNombreArchivo] = useState(() => guardadoInicial.archivo ?? '')
  const [carreras, setCarreras] = useState([])
  const [carrera, setCarrera] = useState(() => guardadoInicial.carrera ?? '')
  const [anio, setAnio] = useState(() => String(guardadoInicial.anio_lectivo ?? new Date().getFullYear()))
  const [semestre, setSemestre] = useState(() => String(
    guardadoInicial.semestre ?? guardadoInicial.semestre_lectivo ?? (new Date().getMonth() >= 6 ? 2 : 1)
  ))
  const [errores, setErrores] = useState([])
  const [archivoSeleccionado, setArchivoSeleccionado] = useState(null)
  const [vistaPrevia, setVistaPrevia] = useState(null)
  const entradaArchivo = useRef(null)

  const actualizarCarreras = useCallback(async (carreraImportada = '') => {
    if (tipo !== 'talleres') return
    try {
      const res = await apiFetch('/api/carreras', { cache: 'no-store' })
      if (!res.ok) throw new Error('No se pudieron cargar las carreras.')
      let disponibles = (await res.json()).carreras ?? []
      if (carreraImportada && !disponibles.some((item) => item.nombre === carreraImportada)) {
        disponibles = [...disponibles, { nombre: carreraImportada }].sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'))
      }
      setCarreras(disponibles)
      if (carreraImportada) setCarrera(carreraImportada)
    } catch {
      setErrores(['No se pudieron cargar las carreras.'])
    }
  }, [tipo])

  useEffect(() => {
    if (tipo !== 'talleres') return undefined
    const inicioCarga = window.setTimeout(() => actualizarCarreras(), 0)
    const alActualizar = (event) => actualizarCarreras(event.detail?.carrera ?? '')
    window.addEventListener(EVENTO_CARRERAS_ACTUALIZADAS, alActualizar)
    return () => {
      window.clearTimeout(inicioCarga)
      window.removeEventListener(EVENTO_CARRERAS_ACTUALIZADAS, alActualizar)
    }
  }, [tipo, actualizarCarreras])

  const carreraActiva = carrera || carreras[0]?.nombre || ''

  function periodoGuardado(guardado, carreraDestino, anioDestino) {
    if (guardado.por_periodo) {
      return {
        porPeriodo: { ...guardado.por_periodo },
        archivos: { ...(guardado.archivos_por_periodo ?? {}) },
      }
    }
    const porPeriodo = {}
    const archivos = {}
    Object.entries(guardado.por_semestre ?? {}).forEach(([semestreGuardado, items]) => {
      const key = clavePeriodoTaller(guardado.carrera || carreraDestino, guardado.anio_lectivo || anioDestino, semestreGuardado)
      porPeriodo[key] = items
      if (guardado.archivos_por_semestre?.[semestreGuardado]) archivos[key] = guardado.archivos_por_semestre[semestreGuardado]
    })
    if (!Object.keys(porPeriodo).length && guardado.bloques?.length) {
      const semestreGuardado = String(guardado.semestre ?? guardado.semestre_lectivo ?? semestre)
      const key = clavePeriodoTaller(guardado.carrera || carreraDestino, guardado.anio_lectivo || anioDestino, semestreGuardado)
      porPeriodo[key] = guardado.bloques
      if (guardado.archivo) archivos[key] = guardado.archivo
    }
    return { porPeriodo, archivos }
  }

  function actualizarPeriodo(campo, valor) {
    const siguienteCarrera = campo === 'carrera' ? valor : carreraActiva
    const siguienteAnio = campo === 'anio' ? valor : anio
    const siguienteSemestre = campo === 'semestre' ? valor : semestre
    if (campo === 'carrera') setCarrera(valor)
    if (campo === 'anio') setAnio(valor)
    if (campo === 'semestre') setSemestre(valor)
    setErrores([])
    setVistaPrevia(null)
    if (tipo !== 'talleres') return
    if (!siguienteCarrera || !siguienteAnio || !siguienteSemestre) {
      setBloques([])
      setNombreArchivo('')
      return
    }
    const guardado = leerStorage(clave) ?? {}
    const { porPeriodo, archivos } = periodoGuardado(guardado, siguienteCarrera, siguienteAnio)
    const key = clavePeriodoTaller(siguienteCarrera, siguienteAnio, siguienteSemestre)
    const seleccionados = porPeriodo[key] ?? []
    const archivoSeleccionado = archivos[key] ?? ''
    setBloques(seleccionados)
    setNombreArchivo(archivoSeleccionado)
    guardarStorage(clave, {
      ...guardado,
      carrera: siguienteCarrera,
      anio_lectivo: siguienteAnio,
      semestre: siguienteSemestre,
      bloques: seleccionados,
      archivo: archivoSeleccionado,
      por_periodo: porPeriodo,
      archivos_por_periodo: archivos,
    })
  }

  function alElegir(archivo) {
    setErrores([])
    if (!archivo) return
    if (!/\.csv$/i.test(archivo.name)) {
      setArchivoSeleccionado(null)
      setVistaPrevia(null)
      return setErrores(['El archivo debe ser .csv (podés guardar tu Excel como CSV).'])
    }
    setArchivoSeleccionado(archivo)
    setVistaPrevia(null)
  }

  async function analizar(event) {
    event.preventDefault()
    setErrores([])
    setVistaPrevia(null)
    if (tipo === 'talleres' && (!carreraActiva || !anio || !semestre)) {
      setErrores(['Seleccioná la carrera, el año lectivo y el semestre de estos talleres.'])
      return
    }
    if (!archivoSeleccionado) {
      setErrores(['Elegí un archivo .csv para analizar los talleres.'])
      return
    }
    const { bloques: nuevos, errores: fallos } = leerBloques(await archivoSeleccionado.text(), tipo)
    setErrores(fallos)
    if (nuevos.length) setVistaPrevia({ bloques: nuevos, archivo: archivoSeleccionado.name })
  }

  function guardarAnalisis() {
    if (!vistaPrevia || !carreraActiva || !anio || !semestre) return
    const guardado = leerStorage(clave) ?? {}
    const { porPeriodo, archivos } = periodoGuardado(guardado, carreraActiva, anio)
    const key = clavePeriodoTaller(carreraActiva, anio, semestre)
    porPeriodo[key] = vistaPrevia.bloques
    archivos[key] = vistaPrevia.archivo
    const nuevoGuardado = {
      ...guardado,
      carrera: carreraActiva,
      anio_lectivo: anio,
      bloques: vistaPrevia.bloques,
      archivo: vistaPrevia.archivo,
      semestre,
      por_periodo: porPeriodo,
      archivos_por_periodo: archivos,
    }
    guardarStorage(clave, nuevoGuardado)
    setBloques(vistaPrevia.bloques)
    setNombreArchivo(vistaPrevia.archivo)
    setArchivoSeleccionado(null)
    if (entradaArchivo.current) entradaArchivo.current.value = ''
    setVistaPrevia(null)
    setErrores([])
  }

  function quitar() {
    setBloques([])
    setNombreArchivo('')
    setErrores([])
    if (tipo === 'talleres') {
      const guardado = leerStorage(clave) ?? {}
      const { porPeriodo, archivos } = periodoGuardado(guardado, carreraActiva, anio)
      const key = clavePeriodoTaller(carreraActiva, anio, semestre)
      delete porPeriodo[key]
      delete archivos[key]
      guardarStorage(clave, { ...guardado, carrera: carreraActiva, anio_lectivo: anio, semestre, bloques: [], archivo: '', por_periodo: porPeriodo, archivos_por_periodo: archivos })
    } else {
      guardarStorage(clave, null)
    }
  }

  const listo = bloques.length > 0
  useEffect(() => { onListo(listo) }, [listo, onListo])
  const resumen = listo
    ? `${nombreArchivo} · ${tipo === 'talleres' ? `${carreraActiva} · ${anio} · Semestre ${semestre} · ${new Set(bloques.map((b) => b.nombre)).size} talleres · ` : ''}${bloques.length} bloques en ${new Set(bloques.map((b) => b.dia)).size} días`
    : ''

  return (
    <Tarjeta numero={numero} titulo={titulo} descripcion={descripcion} estado={listo ? 'listo' : 'pendiente'} resumen={resumen}>
      {tipo === 'talleres' && (
        <>
          <form className="schedule-import-form inicio-talleres-periodo" onSubmit={analizar}>
            <label>
              <span>Carrera</span>
              <select value={carreraActiva} onChange={(event) => actualizarPeriodo('carrera', event.target.value)}>
                <option value="">Seleccionar carrera</option>
                {carreras.map((item) => <option key={item.nombre} value={item.nombre}>{item.nombre}</option>)}
              </select>
            </label>
            <label>
              <span>Año lectivo</span>
              <input type="number" min="1900" max="9999" value={anio} onChange={(event) => actualizarPeriodo('anio', event.target.value)} />
            </label>
            <label>
              <span>Semestre</span>
              <select value={semestre} onChange={(event) => actualizarPeriodo('semestre', event.target.value)}>
                <option value="1">1</option>
                <option value="2">2</option>
              </select>
            </label>
            <label className="schedule-file-field">
              <span>Archivo</span>
              <input ref={entradaArchivo} type="file" accept=".csv,text/csv" onChange={(event) => alElegir(event.target.files?.[0])} />
            </label>
            <button className="schedule-primary" type="submit">Analizar talleres</button>
          </form>
          {archivoSeleccionado && <p className="schedule-help">Archivo seleccionado: {archivoSeleccionado.name}</p>}
          <p className="schedule-help">Subí un archivo .csv con una fila por bloque: taller, día, inicio, fin, salón y cupos.</p>
          <Mensajes errores={errores} aviso={errores.length && listo ? 'Se mantuvieron los talleres guardados anteriormente.' : ''} />
          {vistaPrevia && <section className="schedule-preview" aria-label="Vista previa de talleres">
            <div className="schedule-preview-summary">
              <strong>{vistaPrevia.archivo} · {carreraActiva} · {anio} · Semestre {semestre}</strong>
              <span>{new Set(vistaPrevia.bloques.map((bloque) => bloque.nombre)).size} talleres · {vistaPrevia.bloques.length} bloques</span>
            </div>
            <div className="schedule-table-wrap"><table className="schedule-table"><thead><tr><th>Taller</th><th>Día</th><th>Horario</th><th>Salón</th><th>Cupos</th></tr></thead><tbody>
              {vistaPrevia.bloques.map((bloque, indice) => <tr key={`${bloque.nombre}-${bloque.dia}-${bloque.inicio}-${indice}`}><td>{bloque.nombre}</td><td>{bloque.dia}</td><td>{bloque.inicio}–{bloque.fin}</td><td>{bloque.salon || '—'}</td><td>{bloque.extra || '—'}</td></tr>)}
            </tbody></table></div>
            <div className="schedule-preview-actions">
              <button type="button" className="schedule-secondary" onClick={() => setVistaPrevia(null)}>Cancelar</button>
              <button type="button" className="schedule-primary" onClick={guardarAnalisis}>Guardar talleres</button>
            </div>
          </section>}
          {listo && <div className="schedule-current">
            <h3>Talleres guardados · {carreraActiva} · {anio} · Semestre {semestre}</h3>
            <div className="schedule-table-wrap"><table className="schedule-table"><thead><tr><th>Taller</th><th>Día</th><th>Horario</th><th>Salón</th><th>Cupos</th></tr></thead><tbody>
              {bloques.map((bloque, indice) => <tr key={`${bloque.nombre}-${bloque.dia}-${bloque.inicio}-${indice}`}><td>{bloque.nombre}</td><td>{bloque.dia}</td><td>{bloque.inicio}–{bloque.fin}</td><td>{bloque.salon || '—'}</td><td>{bloque.extra || '—'}</td></tr>)}
            </tbody></table></div>
          </div>}
        </>
      )}
      {tipo !== 'talleres' && <ZonaCarga
        id={`carga-${tipo}`}
        aceptar=".csv"
        etiqueta={listo ? 'Reemplazar archivo' : etiqueta}
        ayuda="Arrastrá un .csv acá o hacé clic para elegirlo"
        onArchivo={alElegir}
      />}
      {tipo !== 'talleres' && <Mensajes errores={errores} aviso={errores.length && listo ? 'Se mantuvo el archivo cargado anteriormente.' : ''} />}
      {tipo !== 'talleres' && listo && <VistaSemana bloques={bloques} tipo={tipo} />}
      <footer className="inicio-acciones">
        <button type="button" className="inicio-enlace" onClick={() => descargar(PLANTILLAS[tipo])}>
          Descargar plantilla
        </button>
        {listo && <button type="button" className="inicio-enlace inicio-enlace--peligro" onClick={quitar}>{tipo === 'talleres' ? 'Quitar talleres de este semestre' : 'Quitar'}</button>}
      </footer>
    </Tarjeta>
  )
}

const DIAS_CALENDARIO = {
  Lunes: 'Lun', Martes: 'Mar', Miércoles: 'Mié', Jueves: 'Jue',
  Viernes: 'Vie', Sábado: 'Sáb', Domingo: 'Dom',
}

function CargadorHorarios({ clave, titulo, descripcion, numero, onListo }) {
  const [bloques, setBloques] = useState(() => leerStorage(clave)?.bloques ?? [])
  const [nombreArchivo, setNombreArchivo] = useState(() => leerStorage(clave)?.archivo ?? '')

  const sincronizarCalendario = useCallback((resultado) => {
    if (!resultado?.bloques?.length) return
    const nuevos = resultado.bloques.map((bloque) => ({
      nombre: bloque.materia,
      dia: DIAS_CALENDARIO[bloque.dia] ?? bloque.dia,
      inicio: String(bloque.hora_inicio ?? '').slice(0, 5),
      fin: String(bloque.hora_fin ?? '').slice(0, 5),
      salon: bloque.salon ?? '',
      extra: bloque.docente ?? '',
    }))
    setBloques(nuevos)
    setNombreArchivo(`${resultado.carrera} · ${resultado.anio_lectivo} · Semestre ${resultado.semestre_lectivo}`)
    guardarStorage(clave, {
      bloques: nuevos,
      archivo: `${resultado.carrera} · ${resultado.anio_lectivo} · Semestre ${resultado.semestre_lectivo}`,
      carrera: resultado.carrera,
      anio_lectivo: resultado.anio_lectivo,
      semestre_lectivo: resultado.semestre_lectivo,
    })
  }, [clave])

  const listo = bloques.length > 0
  useEffect(() => { onListo(listo) }, [listo, onListo])
  const resumen = listo
    ? `${nombreArchivo} · ${bloques.length} clases en ${new Set(bloques.map((b) => b.dia)).size} días`
    : ''

  return (
    <Tarjeta numero={numero} titulo={titulo} descripcion={descripcion} estado={listo ? 'listo' : 'pendiente'} resumen={resumen}>
      <div className="inicio-horarios-importador">
        <ScheduleImportPanel
          onImported={sincronizarCalendario}
          onSchedulesLoaded={sincronizarCalendario}
        />
      </div>
      {listo && <VistaSemana bloques={bloques} tipo="horarios" />}
    </Tarjeta>
  )
}

function CargadorPlan({ onVerPlan, onListo }) {
  const [modalAbierto, setModalAbierto] = useState(false)
  const [planes, setPlanes] = useState([])   // solo los planes de esta cuenta
  const [archivoModal, setArchivoModal] = useState(null)
  const [errores, setErrores] = useState([])

  function cargarPlanes() {
    apiFetch('/api/carreras', { cache: 'no-store' })
      .then((res) => res.ok ? res.json() : Promise.reject())
      .then((data) => setPlanes((data.carreras ?? []).map((c) => c.nombre)))
      .catch(() => {})
  }

  useEffect(cargarPlanes, [])

  // PDF, CSV, XLSX y JSON pasan por el mismo modal de revisión y guardado.
  function alElegir(archivo) {
    setErrores([])
    if (!archivo) return
    if (/\.(pdf|csv|xlsx|json)$/i.test(archivo.name)) {
      setArchivoModal(archivo)
    } else {
      setErrores(['Formato no admitido. Usá PDF, CSV, XLSX o JSON.'])
    }
  }

  const listo = planes.length > 0
  useEffect(() => { onListo(listo) }, [listo, onListo])

  return (
    <Tarjeta
      numero={1}
      titulo="Plan de estudio"
      descripcion="Tu carrera: materias, créditos y previas."
      estado={listo ? 'listo' : 'pendiente'}
      resumen={listo ? `${planes.length === 1 ? 'Plan' : 'Planes'}: ${planes.join(', ')}` : ''}
    >
      <ZonaCarga
        id="carga-plan"
        aceptar=".pdf,.csv,.xlsx,.json"
        etiqueta={listo ? 'Cargar otro plan' : 'Subir plan de estudio'}
        ayuda="PDF, CSV, XLSX o JSON. Arrastrá el archivo o hacé clic"
        onArchivo={alElegir}
      />

      <Mensajes errores={errores} />

      <footer className="inicio-acciones">
        {listo && <button type="button" className="inicio-enlace" onClick={onVerPlan}>Ver plan →</button>}
        <button
          type="button"
          className="inicio-btn"
          disabled={!archivoModal}
          onClick={() => setModalAbierto(true)}
        >
          Guardar plan
        </button>
      </footer>

      {archivoModal && <p className="inicio-resumen">Archivo seleccionado: {archivoModal.name}</p>}

      {modalAbierto && (
        <ImportarPlanModal
          abierto
          archivoInicial={archivoModal}
          onCerrar={() => setModalAbierto(false)}
          onImportado={() => { setModalAbierto(false); setArchivoModal(null); cargarPlanes() }}
        />
      )}
    </Tarjeta>
  )
}

function InicioPage({ nombreUsuario, emailUsuario, onIr }) {
  const [listos, setListos] = useState({ plan: false, horarios: false, talleres: false })
  const marcar = useMemo(() => ({
    plan: (v) => setListos((l) => (l.plan === v ? l : { ...l, plan: v })),
    horarios: (v) => setListos((l) => (l.horarios === v ? l : { ...l, horarios: v })),
    talleres: (v) => setListos((l) => (l.talleres === v ? l : { ...l, talleres: v })),
  }), [])
  const progreso = Object.values(listos).filter(Boolean).length

  return (
    <div className="inicio-page">
      <header className="inicio-hero">
        <span className="inicio-blob inicio-blob--1" aria-hidden="true" />
        <span className="inicio-blob inicio-blob--2" aria-hidden="true" />
        <span className="inicio-etiqueta">Cargas del semestre</span>
        <h1>{nombreUsuario ? `Hola, ${nombreUsuario}` : 'Bienvenido a Kairo'}</h1>
        <p>Cargá tu información en tres pasos y empezá a planificar tu semestre.</p>

        <div className="inicio-datos">
          <div className="inicio-dato">
            <strong>{progreso}/3</strong>
            <span>Pasos listos</span>
          </div>
          <div className="inicio-dato inicio-dato--barra" aria-label={`${progreso} de 3 pasos completados`}>
            <span>Avance</span>
            <div className="inicio-avance-barra"><span style={{ width: `${(progreso / 3) * 100}%` }} /></div>
          </div>
        </div>
      </header>

      <div className="inicio-contenido">
        <div className="inicio-grilla">
          <CargadorPlan onVerPlan={() => onIr?.('plan-estudio')} onListo={marcar.plan} />
          <CargadorHorarios
            clave={`${CLAVE_HORARIOS}:${emailUsuario}`}
            numero={2}
            titulo="Horarios del semestre"
            descripcion="Días y horas de cada materia que se dicta."
            onListo={marcar.horarios}
          />
          <CargadorBloques
            tipo="talleres"
            clave={`${CLAVE_TALLERES}:${emailUsuario}`}
            numero={3}
            titulo="Talleres del semestre"
            descripcion="Talleres disponibles con su horario y cupos."
            etiqueta="Subir talleres"
            onListo={marcar.talleres}
          />
        </div>

        <footer className="inicio-pie">
          <button type="button" className="inicio-btn" disabled={!listos.plan || !listos.horarios} onClick={() => onIr?.('planificar')}>
            Planificar semestre →
          </button>
          {(!listos.plan || !listos.horarios) && <span>Cargá al menos el plan y los horarios para continuar.</span>}
        </footer>
      </div>
    </div>
  )
}

export default InicioPage
