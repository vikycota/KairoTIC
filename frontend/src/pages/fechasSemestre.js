// Rangos por defecto. Al importar, las fechas se pueden ajustar a cada institución.
export function fechasSemestre(anio, semestre) {
  const year = String(anio)
  return String(semestre) === '1'
    ? { fecha_inicio: `${year}-03-01`, fecha_fin: `${year}-07-31` }
    : { fecha_inicio: `${year}-08-01`, fecha_fin: `${year}-12-31` }
}

export function estaDentroDelPeriodo(fecha, bloque, periodo) {
  const iso = typeof fecha === 'string' ? fecha : `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, '0')}-${String(fecha.getDate()).padStart(2, '0')}`
  const inicio = bloque.fecha_inicio || periodo?.fecha_inicio
  const fin = bloque.fecha_fin || periodo?.fecha_fin
  return (!inicio || iso >= inicio) && (!fin || iso <= fin)
}
