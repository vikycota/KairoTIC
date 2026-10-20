"""Reglas académicas para determinar materias aprobadas y habilitadas."""


def obtener_materias_aprobadas(cur, email, carrera):
    cur.execute(
        "SELECT Nota_Minima_Aprobacion FROM Carreras WHERE Nombre = %s",
        (carrera,),
    )
    fila = cur.fetchone()
    if not fila:
        return None

    nota_minima = fila[0]
    cur.execute(
        """
        SELECT DISTINCT Materias_Nombre
        FROM Hacen
        WHERE Email = %s AND Nota >= %s
        ORDER BY Materias_Nombre
        """,
        (email, nota_minima),
    )
    return {nombre for (nombre,) in cur.fetchall()}


def obtener_estado_academico(cur, email, carrera):
    aprobadas = obtener_materias_aprobadas(cur, email, carrera)
    if aprobadas is None:
        return None

    cur.execute(
        """
        SELECT m.Nombre, m.Materia_Previa_Nombre
        FROM Tiene t
        JOIN Materias m ON m.Nombre = t.Materias_Nombre
        WHERE t.Carreras_Nombre = %s
        ORDER BY m.Nombre
        """,
        (carrera,),
    )

    habilitadas = []
    bloqueadas = []
    for nombre, previa in cur.fetchall():
        if nombre in aprobadas:
            continue
        if not previa or previa in aprobadas:
            habilitadas.append(nombre)
        else:
            bloqueadas.append({
                "nombre": nombre,
                "motivo": f"Requiere {previa}",
            })

    return {
        "aprobadas": sorted(aprobadas),
        "habilitadas": habilitadas,
        "bloqueadas": bloqueadas,
    }
