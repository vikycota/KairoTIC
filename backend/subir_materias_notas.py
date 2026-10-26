from datetime import date
from decimal import Decimal, InvalidOperation

from flask import Blueprint, g, jsonify, request

from auth import requiere_login
from conexion import obtener_conexion
from validaciones import ValidationError

materias_notas_bp = Blueprint("materias_notas", __name__)

NOTA_MINIMA = Decimal("0")
NOTA_MAXIMA = Decimal("12")

# Una materia se aprueba con una nota MAYOR a este valor; solo entonces acredita sus créditos.
NOTA_APROBACION = Decimal("6")


# ---------------------------------------------------------------------------
# Validaciones
# ---------------------------------------------------------------------------

def _validar_nota(valor):
    if isinstance(valor, bool) or valor is None or valor == "":
        raise ValidationError("El campo 'nota' es obligatorio.")
    try:
        nota = Decimal(str(valor))
    except InvalidOperation:
        raise ValidationError("El campo 'nota' debe ser un número.")
    if not nota.is_finite() or not (NOTA_MINIMA <= nota <= NOTA_MAXIMA):
        raise ValidationError(f"La nota debe estar entre {NOTA_MINIMA} y {NOTA_MAXIMA}.")
    if nota != nota.to_integral_value():
        raise ValidationError("La nota debe ser un número entero.")
    return nota


def _validar_fecha(valor):
    if not isinstance(valor, str) or not valor.strip():
        raise ValidationError("El campo 'fecha' es obligatorio (formato AAAA-MM-DD).")
    try:
        fecha = date.fromisoformat(valor.strip())
    except ValueError:
        raise ValidationError("El campo 'fecha' debe tener formato AAAA-MM-DD.")
    if fecha > date.today():
        raise ValidationError("La fecha no puede ser futura.")
    return fecha


def _validar_materia(valor):
    if not isinstance(valor, str) or not valor.strip():
        raise ValidationError("El campo 'materia' es obligatorio.")
    return valor.strip()


def _carrera_existe(cur, carrera, email):
    """True si la carrera está asociada a la persona de la sesión."""
    cur.execute(
        """
        SELECT 1
        FROM Pertenecen_A
        WHERE Carreras_Nombre = %s AND Email = %s
        """,
        (carrera, email),
    )
    return cur.fetchone() is not None


def _esta_aprobada(cur, email, materia):
    cur.execute(
        "SELECT 1 FROM Hacen WHERE Email = %s AND Materias_Nombre = %s AND Nota > %s LIMIT 1",
        (email, materia, NOTA_APROBACION),
    )
    return cur.fetchone() is not None


def _actualizar_cursada(cur, email, materia):
    """
    Mantiene Cursan al día: la fecha de inscripción es la del primer examen y la de
    finalización queda cargada solo mientras la materia esté aprobada.
    """
    cur.execute(
        "SELECT MIN(Examenes_Fecha) FROM Hacen WHERE Email = %s AND Materias_Nombre = %s",
        (email, materia),
    )
    primera = cur.fetchone()[0]
    if primera is None:
        return
    cur.execute(
        """
        SELECT MIN(Examenes_Fecha) FROM Hacen
        WHERE Email = %s AND Materias_Nombre = %s AND Nota > %s
        """,
        (email, materia, NOTA_APROBACION),
    )
    aprobada_el = cur.fetchone()[0]
    cur.execute(
        """
        INSERT INTO Cursan (Email, Materias_Nombre, Fecha_Inscripcion, Fecha_Finalizacion)
        VALUES (%s, %s, %s, %s)
        ON CONFLICT (Email, Materias_Nombre) DO UPDATE
            SET Fecha_Inscripcion = LEAST(Cursan.Fecha_Inscripcion, EXCLUDED.Fecha_Inscripcion),
                Fecha_Finalizacion = EXCLUDED.Fecha_Finalizacion
        """,
        (email, materia, primera, aprobada_el),
    )


# ---------------------------------------------------------------------------
# Agregar un examen (un intento) de una materia
# ---------------------------------------------------------------------------

@materias_notas_bp.route("/examenes", methods=["POST"])
@requiere_login
def agregar_examen():
    """
    Registra un examen rendido por el usuario de la sesión.
    Body: {"materia", "nota", "fecha", "carrera"?}. Se pueden cargar todos los intentos.
    La materia queda aprobada con una nota mayor a NOTA_APROBACION y, una vez aprobada,
    no admite más exámenes. Si viene "carrera", la materia debe pertenecer a ese plan.
    """
    data = request.get_json(silent=True)
    if not isinstance(data, dict):
        return jsonify({"error": "Body inválido o faltante."}), 400

    try:
        materia = _validar_materia(data.get("materia"))
        nota = _validar_nota(data.get("nota"))
        fecha = _validar_fecha(data.get("fecha"))
    except ValidationError as e:
        return jsonify({"error": e.message}), 400

    email = g.email
    carrera = data.get("carrera").strip() if isinstance(data.get("carrera"), str) else ""

    conn = None
    try:
        conn = obtener_conexion()
        cur = conn.cursor()

        cur.execute("SELECT 1 FROM Materias WHERE Nombre = %s", (materia,))
        if not cur.fetchone():
            cur.close()
            return jsonify({"error": "La materia no existe."}), 404

        if carrera:
            if not _carrera_existe(cur, carrera, email):
                cur.close()
                return jsonify({"error": "La carrera no existe."}), 404
            cur.execute(
                "SELECT 1 FROM Tiene WHERE Carreras_Nombre = %s AND Materias_Nombre = %s",
                (carrera, materia),
            )
            if not cur.fetchone():
                cur.close()
                return jsonify({"error": "Esa materia no pertenece a la carrera elegida."}), 400

        if _esta_aprobada(cur, email, materia):
            cur.close()
            return jsonify({"error": "Esa materia ya está aprobada: no se pueden agregar más exámenes."}), 409

        cur.execute(
            "SELECT 1 FROM Hacen WHERE Email = %s AND Materias_Nombre = %s AND Examenes_Fecha = %s",
            (email, materia, fecha),
        )
        if cur.fetchone():
            cur.close()
            return jsonify({"error": "Ya cargaste un examen de esa materia en esa fecha."}), 409

        cur.execute(
            "INSERT INTO Hacen (Email, Examenes_Fecha, Materias_Nombre, Nota) VALUES (%s, %s, %s, %s)",
            (email, fecha, materia, nota),
        )
        _actualizar_cursada(cur, email, materia)

        conn.commit()
        cur.close()
        return jsonify({
            "message": "Examen guardado correctamente.",
            "materia": materia,
            "nota": int(nota),
            "fecha": fecha.isoformat(),
            "aprobada": nota > NOTA_APROBACION,
        }), 201

    except Exception as e:
        if conn:
            conn.rollback()
        print(f"Error al guardar el examen: {e}")
        return jsonify({"error": "Error interno del servidor."}), 500
    finally:
        if conn:
            conn.close()


# ---------------------------------------------------------------------------
# Listar los exámenes del usuario (todos los intentos)
# ---------------------------------------------------------------------------

@materias_notas_bp.route("/examenes", methods=["GET"])
@requiere_login
def listar_examenes():
    """Todos los exámenes del usuario; con ?carrera=X solo los de las materias de ese plan."""
    carrera = (request.args.get("carrera") or "").strip()
    email = g.email

    conn = None
    try:
        conn = obtener_conexion()
        cur = conn.cursor()

        union = ""
        parametros = [email]
        if carrera:
            if not _carrera_existe(cur, carrera, email):
                cur.close()
                return jsonify({"error": "La carrera no existe."}), 404
            union = "JOIN Tiene t ON t.Materias_Nombre = h.Materias_Nombre AND t.Carreras_Nombre = %s"
            parametros = [carrera, email]

        cur.execute(
            f"""
            SELECT h.Materias_Nombre, m.Cantidad_de_Creditos, h.Nota, h.Examenes_Fecha
            FROM Hacen h
            JOIN Materias m ON m.Nombre = h.Materias_Nombre
            {union}
            WHERE h.Email = %s
            ORDER BY h.Examenes_Fecha DESC, h.Materias_Nombre
            """,
            parametros,
        )
        examenes = [
            {
                "materia": n,
                "creditos": c,
                "nota": int(nota),
                "fecha": f.isoformat(),
                "aprobada": nota > NOTA_APROBACION,
            }
            for n, c, nota, f in cur.fetchall()
        ]
        cur.close()
        return jsonify({"examenes": examenes, "nota_aprobacion": int(NOTA_APROBACION)}), 200
    except Exception as e:
        print(f"Error al listar los exámenes: {e}")
        return jsonify({"error": "Error interno del servidor."}), 500
    finally:
        if conn:
            conn.close()


# ---------------------------------------------------------------------------
# Resumen de avance de cada carrera del usuario (cada una por separado)
# ---------------------------------------------------------------------------

@materias_notas_bp.route("/progreso", methods=["GET"])
@requiere_login
def resumen_progreso():
    """Solo acreditan las materias con algún examen de nota mayor a NOTA_APROBACION."""
    conn = None
    try:
        conn = obtener_conexion()
        cur = conn.cursor()
        cur.execute(
            """
            WITH aprobadas AS (
                SELECT Materias_Nombre, MAX(Nota) AS nota
                FROM Hacen
                WHERE Email = %s AND Nota > %s
                GROUP BY Materias_Nombre
            )
            SELECT c.Nombre,
                   COUNT(m.Nombre),
                   COALESCE(SUM(m.Cantidad_de_Creditos), 0),
                   COUNT(a.nota),
                   COALESCE(SUM(CASE WHEN a.nota IS NOT NULL THEN m.Cantidad_de_Creditos END), 0),
                   AVG(a.nota)
            FROM Carreras c
            JOIN Pertenecen_A pa
              ON pa.Carreras_Nombre = c.Nombre
             AND pa.Email = %s
            JOIN Tiene t ON t.Carreras_Nombre = c.Nombre
            JOIN Materias m ON m.Nombre = t.Materias_Nombre
            LEFT JOIN aprobadas a ON a.Materias_Nombre = m.Nombre
            GROUP BY c.Nombre
            ORDER BY c.Nombre
            """,
            (g.email, NOTA_APROBACION, g.email),
        )
        carreras = [
            {
                "nombre": nombre,
                "materias": int(materias),
                "creditos": int(creditos),
                "aprobadas": int(aprobadas),
                "creditos_aprobados": int(creditos_aprobados),
                "promedio": float(promedio) if promedio is not None else None,
            }
            for nombre, materias, creditos, aprobadas, creditos_aprobados, promedio in cur.fetchall()
        ]
        cur.close()
        return jsonify({"carreras": carreras, "nota_aprobacion": int(NOTA_APROBACION)}), 200
    except Exception as e:
        print(f"Error al calcular el progreso: {e}")
        return jsonify({"error": "Error interno del servidor."}), 500
    finally:
        if conn:
            conn.close()


# ---------------------------------------------------------------------------
# Quitar un examen (por si se cargó mal)
# ---------------------------------------------------------------------------

@materias_notas_bp.route("/examenes", methods=["DELETE"])
@requiere_login
def quitar_examen():
    """Body: {"materia", "fecha"}. Si era el examen que aprobaba la materia, vuelve a estar disponible."""
    data = request.get_json(silent=True)
    if not isinstance(data, dict):
        return jsonify({"error": "Body inválido o faltante."}), 400

    try:
        materia = _validar_materia(data.get("materia"))
        fecha = _validar_fecha(data.get("fecha"))
    except ValidationError as e:
        return jsonify({"error": e.message}), 400

    email = g.email
    conn = None
    try:
        conn = obtener_conexion()
        cur = conn.cursor()

        cur.execute(
            "DELETE FROM Hacen WHERE Email = %s AND Materias_Nombre = %s AND Examenes_Fecha = %s",
            (email, materia, fecha),
        )
        if cur.rowcount == 0:
            cur.close()
            return jsonify({"error": "Ese examen no existe."}), 404

        cur.execute(
            "SELECT 1 FROM Hacen WHERE Email = %s AND Materias_Nombre = %s LIMIT 1",
            (email, materia),
        )
        if cur.fetchone():
            _actualizar_cursada(cur, email, materia)
        else:
            cur.execute(
                "DELETE FROM Cursan WHERE Email = %s AND Materias_Nombre = %s",
                (email, materia),
            )

        conn.commit()
        cur.close()
        return jsonify({"message": "Examen eliminado."}), 200
    except Exception as e:
        if conn:
            conn.rollback()
        print(f"Error al quitar el examen: {e}")
        return jsonify({"error": "Error interno del servidor."}), 500
    finally:
        if conn:
            conn.close()
