function MateriasDisponibles({
  materias,
  materiasSinOferta,
  materiasBloqueadas = [],
  seleccionadas,
  cargando,
  error,
  carrera,
  onSeleccionar,
  onSeleccionarGrupo,
}) {
  return (
    <section className="materias-disponibles" aria-labelledby="materias-disponibles-titulo">
      <header className="materias-disponibles-header">
        <div>
          <h2 id="materias-disponibles-titulo">Materias disponibles</h2>
          <p>Elegí las materias que querés considerar y luego seleccioná un grupo para cada una.</p>
        </div>
      </header>

      {error && <p className="plan-datos-error" role="alert">{error}</p>}
      {cargando && <p className="materias-disponibles-vacio">Cargando materias y horarios…</p>}
      {!cargando && !error && !carrera && <p className="materias-disponibles-vacio">Seleccioná una carrera para consultar su oferta.</p>}
      {!cargando && !error && carrera && materias.length === 0 && (
        <p className="materias-disponibles-vacio">
          {materiasBloqueadas.length > 0
            ? 'No hay materias habilitadas con horario en este per?odo.'
            : 'No hay materias habilitadas del plan con horarios en este per?odo.'}
        </p>
      )}

      {!cargando && !error && materias.length > 0 && (
        <div className="materias-disponibles-lista">
          {materias.map(({ id, materia, grupos }) => {
            const seleccion = seleccionadas[id]
            const nombresGrupos = Object.keys(grupos).sort((a, b) => a.localeCompare(b, 'es', { numeric: true }))
            return (
              <article className="materia-disponible" key={id}>
                <label className="materia-disponible-seleccion">
                  <input
                    type="checkbox"
                    checked={Boolean(seleccion?.seleccionada)}
                    onChange={(event) => onSeleccionar(id, event.target.checked)}
                  />
                  <span className="materia-disponible-nombre">{materia.nombre}</span>
                  <span className="materia-disponible-grupos">
                    {nombresGrupos.length} {nombresGrupos.length === 1 ? 'grupo disponible' : 'grupos disponibles'}
                  </span>
                </label>

                {seleccion?.seleccionada && (
                  <div className="materia-grupos">
                    {nombresGrupos.map((grupo) => (
                      <label className="materia-grupo" key={grupo}>
                        <span className="materia-grupo-opcion">
                          <input
                            type="radio"
                            name={`grupo-${id}`}
                            value={grupo}
                            checked={seleccion.grupo === grupo}
                            onChange={() => onSeleccionarGrupo(id, grupo)}
                          />
                          <strong>{grupo === 'General' ? 'General' : `Grupo ${grupo}`}</strong>
                        </span>
                        <span className="materia-grupo-horarios">
                          {grupos[grupo].map((bloque, index) => (
                            <span key={`${bloque.dia}-${bloque.hora_inicio}-${index}`}>
                              {bloque.dia} {bloque.hora_inicio}–{bloque.hora_fin}
                            </span>
                          ))}
                        </span>
                      </label>
                    ))}
                  </div>
                )}
              </article>
            )
          })}
        </div>
      )}
      {!cargando && !error && materiasSinOferta.length > 0 && (
        <p className="materias-sin-oferta">
          Sin horarios para este periodo: {materiasSinOferta.map((materia) => materia.nombre).join(', ')}.
        </p>
      )}
      {!cargando && !error && materiasBloqueadas.length > 0 && (
        <section className="materias-no-habilitadas" aria-labelledby="materias-no-habilitadas-titulo">
          <h3 id="materias-no-habilitadas-titulo">No habilitadas</h3>
          <ul>
            {materiasBloqueadas.map(({ nombre, motivo }) => (
              <li key={nombre}><strong>{nombre}</strong><span>{motivo}</span></li>
            ))}
          </ul>
        </section>
      )}
    </section>
  )
}

export default MateriasDisponibles
