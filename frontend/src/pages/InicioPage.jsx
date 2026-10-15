import { useEffect, useMemo, useRef, useState } from 'react'
import ImportarPlanModal from './ImportarPlanModal'
import { apiFetch } from '../api'
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
  const m = /^(\d{1,2})(?::|\.|h)?(\d{2})?$/.exec(valor.trim())
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
  const [bloques, setBloques] = useState(() => leerStorage(clave)?.bloques ?? [])
  const [nombreArchivo, setNombreArchivo] = useState(() => leerStorage(clave)?.archivo ?? '')
  const [errores, setErrores] = useState([])

  async function alElegir(archivo) {
    setErrores([])
    if (!/\.csv$/i.test(archivo.name)) {
      return setErrores(['El archivo debe ser .csv (podés guardar tu Excel como CSV).'])
    }
    const { bloques: nuevos, errores: fallos } = leerBloques(await archivo.text(), tipo)
    setErrores(fallos)
    if (!nuevos.length) return
    setBloques(nuevos)
    setNombreArchivo(archivo.name)
    guardarStorage(clave, { bloques: nuevos, archivo: archivo.name })
  }

  function quitar() {
    setBloques([])
    setNombreArchivo('')
    setErrores([])
    guardarStorage(clave, null)
  }

  const listo = bloques.length > 0
  useEffect(() => { onListo(listo) }, [listo, onListo])
  const resumen = listo
    ? `${nombreArchivo} · ${bloques.length} ${tipo === 'horarios' ? 'clases' : 'talleres'} en ${new Set(bloques.map((b) => b.dia)).size} días`
    : ''

  return (
    <Tarjeta numero={numero} titulo={titulo} descripcion={descripcion} estado={listo ? 'listo' : 'pendiente'} resumen={resumen}>
      <ZonaCarga
        id={`carga-${tipo}`}
        aceptar=".csv"
        etiqueta={listo ? 'Reemplazar archivo' : etiqueta}
        ayuda="Arrastrá un .csv acá o hacé clic para elegirlo"
        onArchivo={alElegir}
      />
      <Mensajes errores={errores} aviso={errores.length && listo ? 'Se mantuvo el archivo cargado anteriormente.' : ''} />
      {listo && <VistaSemana bloques={bloques} tipo={tipo} />}
      <footer className="inicio-acciones">
        <button type="button" className="inicio-enlace" onClick={() => descargar(PLANTILLAS[tipo])}>
          Descargar plantilla
        </button>
        {listo && <button type="button" className="inicio-enlace inicio-enlace--peligro" onClick={quitar}>Quitar</button>}
      </footer>
    </Tarjeta>
  )
}

function CargadorPlan({ onVerPlan, onListo }) {
  const [modalAbierto, setModalAbierto] = useState(false)
  const [planes, setPlanes] = useState([])   // solo los planes de esta cuenta
  const [archivoModal, setArchivoModal] = useState(null)
  const [errores, setErrores] = useState([])

  function cargarPlanes() {
    apiFetch('/api/carreras')
      .then((res) => res.ok ? res.json() : Promise.reject())
      .then((data) => setPlanes((data.carreras ?? []).map((c) => c.nombre)))
      .catch(() => {})
  }

  useEffect(cargarPlanes, [])

  // PDF, CSV, XLSX y JSON pasan por el mismo modal de revisión y guardado.
  function alElegir(archivo) {
    setErrores([])
    if (/\.(pdf|csv|xlsx|json)$/i.test(archivo.name)) {
      setArchivoModal(archivo)
      setModalAbierto(true)
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
      </footer>

      {modalAbierto && (
        <ImportarPlanModal
          abierto
          archivoInicial={archivoModal}
          onCerrar={() => setModalAbierto(false)}
          onImportado={() => { setModalAbierto(false); cargarPlanes() }}
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
          <CargadorBloques
            tipo="horarios"
            clave={`${CLAVE_HORARIOS}:${emailUsuario}`}
            numero={2}
            titulo="Horarios del semestre"
            descripcion="Días y horas de cada materia que se dicta."
            etiqueta="Subir horarios"
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
