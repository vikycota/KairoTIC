const CAMPOS_NOMBRE_PREVIA = ['nombre', 'materia', 'previa', 'previa_nombre']

function nombrePrevia(valor) {
  if (typeof valor === 'string') return valor.trim()
  if (!valor || typeof valor !== 'object' || Array.isArray(valor)) return ''

  for (const campo of CAMPOS_NOMBRE_PREVIA) {
    if (typeof valor[campo] === 'string' && valor[campo].trim()) {
      return valor[campo].trim()
    }
  }
  return ''
}

export function normalizarPrevias(previas) {
  const valores = Array.isArray(previas) ? previas : [previas]
  return valores.map(nombrePrevia).filter(Boolean)
}

export function formatearPrevias(previas) {
  const nombres = normalizarPrevias(previas)
  return nombres.length ? nombres.join('; ') : '—'
}
