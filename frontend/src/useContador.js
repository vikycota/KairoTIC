import { useEffect, useState } from 'react'

/** Número que sube de 0 al valor al aparecer (sin animación si la persona prefiere menos movimiento). */
export function useContador(objetivo) {
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
