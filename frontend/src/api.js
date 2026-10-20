const EVENTO_SESION_VENCIDA = 'kairo-sesion-expirada'
const EVENTO_CARRERAS_ACTUALIZADAS = 'kairo-carreras-actualizadas'

function tokenActual() {
  try {
    return JSON.parse(localStorage.getItem('kairo-usuario'))?.token ?? ''
  } catch {
    return ''
  }
}

/** fetch que adjunta el token de la sesión. Si el servidor responde 401, avisa para cerrar la sesión. */
export async function apiFetch(url, opciones = {}) {
  const headers = new Headers(opciones.headers)
  const token = tokenActual()
  if (token) headers.set('Authorization', `Bearer ${token}`)
  const res = await fetch(url, { ...opciones, headers })
  if (res.status === 401) window.dispatchEvent(new Event(EVENTO_SESION_VENCIDA))
  return res
}

export { EVENTO_SESION_VENCIDA, EVENTO_CARRERAS_ACTUALIZADAS }
