"""Reglas de dominio y persistencia para importar/consultar horarios."""
from datetime import date


def validar_metadata(cur, carrera, anio_lectivo, semestre_lectivo, bloques, errores):
    if not carrera:
        errores.append("No seleccionaste una carrera.")
        carrera = None
    elif len(carrera) > 100:
        errores.append("El nombre de la carrera no puede superar 100 caracteres.")
    try:
        anio = int(anio_lectivo)
        if not 1900 <= anio <= 9999:
            raise ValueError
    except (TypeError, ValueError):
        errores.append("El año lectivo debe ser un año válido.")
        anio = None
    try:
        semestre = int(semestre_lectivo)
        if semestre not in (1, 2):
            raise ValueError
    except (TypeError, ValueError):
        errores.append("El semestre lectivo debe ser 1 o 2.")
        semestre = None

    materias_validas = set()
    if carrera:
        cur.execute("SELECT Nombre FROM Carreras WHERE Nombre = %s", (carrera,))
        if not cur.fetchone():
            errores.append(f"La carrera '{carrera}' no existe.")
        else:
            cur.execute("SELECT Materias_Nombre FROM Tiene WHERE Carreras_Nombre = %s", (carrera,))
            materias_validas = {fila[0] for fila in cur.fetchall()}
    for bloque in bloques:
        if carrera and bloque["materia"] not in materias_validas:
            errores.append(f"La materia '{bloque['materia']}' no pertenece a la carrera '{carrera}'.")

    vistos = set()
    for bloque in bloques:
        clave = tuple(bloque.get(campo) for campo in ("materia", "anio_carrera", "grupo", "dia", "hora_inicio", "hora_fin", "docente", "tipo", "opcional"))
        if clave in vistos:
            errores.append(f"Fila {bloque['fila']}: bloque horario duplicado.")
        vistos.add(clave)
    resumen = {"bloques": len(bloques), "materias": len({b["materia"] for b in bloques}), "grupos": len({b["grupo"] for b in bloques})}
    return {"valido": not errores, "carrera": carrera, "anio_lectivo": anio, "semestre_lectivo": semestre,
            "bloques": bloques, "errores": errores, "avisos": [], "resumen": resumen}


def guardar_horarios(cur, resultado):
    cur.execute("DELETE FROM Horarios WHERE Carrera_Nombre = %s AND Anio_Lectivo = %s AND Semestre_Lectivo = %s",
                (resultado["carrera"], resultado["anio_lectivo"], resultado["semestre_lectivo"]))
    for bloque in resultado["bloques"]:
        cur.execute("""INSERT INTO Horarios
            (Carrera_Nombre, Materia_Nombre, Anio_Lectivo, Semestre_Lectivo, Anio_Carrera, Grupo,
             Dia, Hora_Inicio, Hora_Fin, Docente, Tipo, Opcional)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)""",
            (resultado["carrera"], bloque["materia"], resultado["anio_lectivo"], resultado["semestre_lectivo"],
             bloque["anio_carrera"], bloque["grupo"], bloque["dia"], bloque["hora_inicio"], bloque["hora_fin"],
             bloque["docente"], bloque["tipo"], bloque["opcional"]))


def listar_horarios(cur, carrera, anio_lectivo, semestre_lectivo):
    cur.execute("""SELECT Materia_Nombre, Anio_Carrera, Grupo, Dia, Hora_Inicio, Hora_Fin, Docente, Tipo, Opcional
        FROM Horarios WHERE Carrera_Nombre = %s AND Anio_Lectivo = %s AND Semestre_Lectivo = %s
        ORDER BY CASE Dia WHEN 'Lunes' THEN 1 WHEN 'Martes' THEN 2 WHEN 'Miércoles' THEN 3
        WHEN 'Jueves' THEN 4 WHEN 'Viernes' THEN 5 WHEN 'Sábado' THEN 6 ELSE 7 END,
        Hora_Inicio, Materia_Nombre, Grupo""", (carrera, anio_lectivo, semestre_lectivo))
    columnas = ("materia", "anio_carrera", "grupo", "dia", "hora_inicio", "hora_fin", "docente", "tipo", "opcional")
    return [dict(zip(columnas, (v.isoformat(timespec="minutes") if hasattr(v, "isoformat") and not isinstance(v, date) else v.isoformat() if isinstance(v, date) else v for v in fila))) for fila in cur.fetchall()]
