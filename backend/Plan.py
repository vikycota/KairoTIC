from flask import Blueprint, Response, jsonify, request
from werkzeug.exceptions import HTTPException

from conexion import obtener_conexion
from plan_parser import (
    PlanError,
    leer_archivo,
    plantilla_csv,
    plantilla_json,
    validar_plan,
)

plan_bp = Blueprint("plan", __name__)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _materias_existentes(cur):
    cur.execute("SELECT Nombre, Cantidad_de_Creditos FROM Materias")
    return {nombre: creditos for nombre, creditos in cur.fetchall()}


def _semestres_existentes(cur):
    """{materia: {números de semestre}} según Se_Organiza_En (Anio 1 + 'Semestre 1' -> 1, 'Semestre 2' -> 2, ...)."""
    cur.execute("SELECT Materias_Nombre, Semestres_Nombre, Semestres_Anio FROM Se_Organiza_En")
    resultado = {}
    for materia, nombre, anio in cur.fetchall():
        numero = (anio - 1) * 2 + (1 if nombre == "Semestre 1" else 2)
        resultado.setdefault(materia, set()).add(numero)
    return resultado


def _periodo(numero):
    """Semestre 1..10 del archivo -> (Semestres.Nombre, Semestres.Anio) de la base."""
    return ("Semestre 1" if numero % 2 else "Semestre 2"), (numero + 1) // 2


def _procesar_subida(cur):
    """
    Lee el archivo del formulario (campo 'archivo') y lo valida.
    Devuelve (resultado, None) o (None, (respuesta_json, codigo_http)).
    """
    archivo = request.files.get("archivo")
    if archivo is None or not archivo.filename:
        return None, (jsonify({"error": "Falta el archivo (campo 'archivo')."}), 400)

    contenido = archivo.read()
    if not contenido:
        return None, (jsonify({"error": "El archivo está vacío."}), 400)

    try:
        raw = leer_archivo(archivo.filename, contenido)
    except PlanError as e:
        return None, (jsonify({"error": e.message}), 400)

    carrera = (request.form.get("carrera") or "").strip() or None
    resultado = validar_plan(
        raw,
        carrera=carrera,
        existentes=_materias_existentes(cur),
        semestres_existentes=_semestres_existentes(cur),
    )
    return resultado, None


# ---------------------------------------------------------------------------
# Plantillas
# ---------------------------------------------------------------------------

@plan_bp.route("/plan/plantilla.csv", methods=["GET"])
def descargar_plantilla_csv():
    return Response(
        plantilla_csv(),
        mimetype="text/csv",
        headers={"Content-Disposition": "attachment; filename=plantilla_plan_estudio.csv"},
    )


@plan_bp.route("/plan/plantilla.json", methods=["GET"])
def descargar_plantilla_json():
    return Response(
        plantilla_json(),
        mimetype="application/json",
        headers={"Content-Disposition": "attachment; filename=plantilla_plan_estudio.json"},
    )


# ---------------------------------------------------------------------------
# Vista previa (no escribe nada en la base)
# ---------------------------------------------------------------------------

@plan_bp.route("/plan/preview", methods=["POST"])
def preview():
    conn = None
    try:
        conn = obtener_conexion()
        cur = conn.cursor()
        resultado, error = _procesar_subida(cur)
        cur.close()
        if error:
            return error
        return jsonify(resultado), 200
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error en la vista previa del plan: {e}")
        return jsonify({"error": "Error interno del servidor."}), 500
    finally:
        if conn:
            conn.close()


# ---------------------------------------------------------------------------
# Importación: valida de nuevo en el servidor y guarda todo en una transacción
# ---------------------------------------------------------------------------

@plan_bp.route("/plan/importar", methods=["POST"])
def importar():
    conn = None
    try:
        conn = obtener_conexion()
        cur = conn.cursor()

        resultado, error = _procesar_subida(cur)
        if error:
            cur.close()
            return error
        if not resultado["valido"]:
            cur.close()
            return jsonify({"error": "El plan tiene errores; corregilos y volvé a subirlo.",
                            **resultado}), 422

        carrera = resultado["carrera"]
        materias = resultado["materias"]

        # Carrera: si el archivo trae valor_credito se actualiza; si no, se respeta el que había.
        if resultado["valor_credito"] is not None:
            cur.execute(
                """
                INSERT INTO Carreras (Nombre, Valor_Credito) VALUES (%s, %s)
                ON CONFLICT (Nombre) DO UPDATE SET Valor_Credito = EXCLUDED.Valor_Credito
                """,
                (carrera, resultado["valor_credito"]),
            )
        else:
            cur.execute(
                "INSERT INTO Carreras (Nombre, Valor_Credito) VALUES (%s, 0) ON CONFLICT (Nombre) DO NOTHING",
                (carrera,),
            )

        # Reemplaza el plan anterior de esa carrera (las materias quedan en la tabla Materias).
        cur.execute("DELETE FROM Tiene WHERE Carreras_Nombre = %s", (carrera,))

        for m in materias:
            cur.execute(
                """
                INSERT INTO Materias (Nombre, Cantidad_de_Creditos, Categoria) VALUES (%s, %s, %s)
                ON CONFLICT (Nombre) DO UPDATE SET
                    Cantidad_de_Creditos = EXCLUDED.Cantidad_de_Creditos,
                    Categoria = EXCLUDED.Categoria
                """,
                (m["nombre"], m["creditos"], m["categoria"]),
            )
            cur.execute(
                "INSERT INTO Tiene (Carreras_Nombre, Materias_Nombre) VALUES (%s, %s)",
                (carrera, m["nombre"]),
            )

        # Semestres: Se_Organiza_En no distingue carreras, así que se reemplaza la ubicación
        # de cada materia del plan. Si falta la fila en Semestres se crea con los créditos del plan.
        nombres = [m["nombre"] for m in materias]
        cur.execute("DELETE FROM Se_Organiza_En WHERE Materias_Nombre = ANY(%s)", (nombres,))
        creditos_por_semestre = {}
        for m in materias:
            if m["semestre"]:
                creditos_por_semestre[m["semestre"]] = creditos_por_semestre.get(m["semestre"], 0) + m["creditos"]
        for numero, creditos in creditos_por_semestre.items():
            nombre_sem, anio = _periodo(numero)
            cur.execute(
                """
                INSERT INTO Semestres (Nombre, Anio, Cantidad_de_Creditos) VALUES (%s, %s, %s)
                ON CONFLICT (Nombre, Anio) DO NOTHING
                """,
                (nombre_sem, anio, creditos),
            )
        for m in materias:
            if m["semestre"]:
                nombre_sem, anio = _periodo(m["semestre"])
                cur.execute(
                    "INSERT INTO Se_Organiza_En (Semestres_Nombre, Semestres_Anio, Materias_Nombre) VALUES (%s, %s, %s)",
                    (nombre_sem, anio, m["nombre"]),
                )

        # Previas (varias por materia): reemplazan a las anteriores. Van después de insertar
        # todas las materias para no violar la clave foránea.
        cur.execute("DELETE FROM Previas WHERE Materias_Nombre = ANY(%s)", (nombres,))
        total_previas = 0
        for m in materias:
            for previa in m["previas"]:
                cur.execute(
                    "INSERT INTO Previas (Materias_Nombre, Previa_Nombre) VALUES (%s, %s)",
                    (m["nombre"], previa),
                )
                total_previas += 1

        conn.commit()
        cur.close()
        return jsonify({
            "message": "Plan importado correctamente.",
            "carrera": carrera,
            "resumen": {**resultado["resumen"], "previas": total_previas},
            "avisos": resultado["avisos"],
        }), 201

    except HTTPException:
        if conn:
            conn.rollback()
        raise
    except Exception as e:
        if conn:
            conn.rollback()
        print(f"Error al importar el plan: {e}")
        return jsonify({"error": "Error interno del servidor."}), 500
    finally:
        if conn:
            conn.close()


# ---------------------------------------------------------------------------
# Lectura
# ---------------------------------------------------------------------------

@plan_bp.route("/carreras", methods=["GET"])
def listar_carreras():
    conn = None
    try:
        conn = obtener_conexion()
        cur = conn.cursor()
        cur.execute(
            """
            SELECT c.Nombre, c.Valor_Credito, COUNT(t.Materias_Nombre),
                   COALESCE(SUM(m.Cantidad_de_Creditos), 0)
            FROM Carreras c
            LEFT JOIN Tiene t ON t.Carreras_Nombre = c.Nombre
            LEFT JOIN Materias m ON m.Nombre = t.Materias_Nombre
            GROUP BY c.Nombre, c.Valor_Credito
            HAVING COUNT(t.Materias_Nombre) > 0
            ORDER BY c.Nombre
            """
        )
        carreras = [
            {"nombre": n, "valor_credito": float(v), "materias": int(cant), "creditos": int(cred)}
            for n, v, cant, cred in cur.fetchall()
        ]
        cur.close()
        return jsonify({"carreras": carreras}), 200
    except Exception as e:
        print(f"Error al listar carreras: {e}")
        return jsonify({"error": "Error interno del servidor."}), 500
    finally:
        if conn:
            conn.close()


@plan_bp.route("/plan", methods=["GET"])
def obtener_plan():
    carrera = (request.args.get("carrera") or "").strip()
    if not carrera:
        return jsonify({"error": "Falta el parámetro 'carrera'."}), 400

    conn = None
    try:
        conn = obtener_conexion()
        cur = conn.cursor()
        cur.execute("SELECT Valor_Credito FROM Carreras WHERE Nombre = %s", (carrera,))
        fila = cur.fetchone()
        if not fila:
            cur.close()
            return jsonify({"error": "La carrera no existe."}), 404

        cur.execute(
            """
            SELECT m.Nombre, m.Cantidad_de_Creditos,
                   MIN((s.Semestres_Anio - 1) * 2 + CASE s.Semestres_Nombre WHEN 'Semestre 1' THEN 1 ELSE 2 END) AS semestre,
                   m.Categoria,
                   ARRAY(SELECT p.Previa_Nombre FROM Previas p
                         WHERE p.Materias_Nombre = m.Nombre ORDER BY p.Previa_Nombre) AS previas
            FROM Tiene t
            JOIN Materias m ON m.Nombre = t.Materias_Nombre
            LEFT JOIN Se_Organiza_En s ON s.Materias_Nombre = m.Nombre
            WHERE t.Carreras_Nombre = %s
            GROUP BY m.Nombre, m.Cantidad_de_Creditos, m.Categoria
            ORDER BY semestre NULLS LAST, m.Nombre
            """,
            (carrera,),
        )
        materias = [
            {"nombre": n, "creditos": c, "semestre": sem, "categoria": cat, "previas": list(previas)}
            for n, c, sem, cat, previas in cur.fetchall()
        ]
        cur.close()
        return jsonify({
            "carrera": carrera,
            "valor_credito": float(fila[0]),
            "materias": materias,
        }), 200
    except Exception as e:
        print(f"Error al leer el plan: {e}")
        return jsonify({"error": "Error interno del servidor."}), 500
    finally:
        if conn:
            conn.close()
