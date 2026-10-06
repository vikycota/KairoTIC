from datetime import date
from decimal import Decimal, InvalidOperation

from flask import Blueprint, jsonify, request

from conexion import obtener_conexion
from validaciones import ValidationError, validar_email

materias_notas_bp = Blueprint("materias_notas", __name__)

NOTA_MINIMA = Decimal("0")
NOTA_MAXIMA = Decimal("12")


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
    if nota != nota.quantize(Decimal("0.01")):
        raise ValidationError("La nota admite como máximo 2 decimales.")
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


def _validar_entrada(data):
    return (
        validar_email(data.get("email")),
        _validar_materia(data.get("materia")),
        _validar_nota(data.get("nota")),
        _validar_fecha(data.get("fecha")),
    )


# ---------------------------------------------------------------------------
# Guardar materia completada con su nota
# ---------------------------------------------------------------------------

@materias_notas_bp.route("/materias-completadas", methods=["POST"])
def agregar_materia_completada():
    """
    Registra que el alumno completó una materia con una nota.
    Body: {"email", "materia", "nota", "fecha"}.
    Guarda en Examenes (fecha, materia, nota), Hacen (alumno <-> examen) y
    marca la materia como finalizada en Cursan.
    """
    data = request.get_json(silent=True)
    if not isinstance(data, dict):
        return jsonify({"error": "Body inválido o faltante."}), 400

    try:
        email, materia, nota, fecha = _validar_entrada(data)
    except ValidationError as e:
        return jsonify({"error": e.message}), 400

    conn = None
    try:
        conn = obtener_conexion()
        cur = conn.cursor()

        cur.execute("SELECT 1 FROM Personas WHERE Email = %s", (email,))
        if not cur.fetchone():
            cur.close()
            return jsonify({"error": "El email no corresponde a un usuario registrado."}), 404

        cur.execute("SELECT 1 FROM Materias WHERE Nombre = %s", (materia,))
        if not cur.fetchone():
            cur.close()
            return jsonify({"error": "La materia no existe."}), 404

        # Un alumno guarda una sola nota por materia: si ya la tenía, se reemplaza.
        cur.execute(
            "SELECT Examenes_Fecha FROM Hacen WHERE Email = %s AND Materias_Nombre = %s",
            (email, materia),
        )
        anteriores = [f for (f,) in cur.fetchall()]

        # Examenes no distingue alumnos: (fecha, materia) es única. Si otro alumno ya
        # registró ese examen con otra nota no se puede pisar sin alterar su resultado.
        cur.execute(
            "SELECT Nota FROM Examenes WHERE Fecha = %s AND Materias_Nombre = %s",
            (fecha, materia),
        )
        existente = cur.fetchone()
        if existente and Decimal(existente[0]) != nota:
            hecho_por_otros = fecha not in anteriores
            if hecho_por_otros:
                cur.close()
                return jsonify({
                    "error": "Ya hay otro examen de esa materia en esa fecha con una nota distinta."
                }), 409

        for f in anteriores:
            if f != fecha:
                cur.execute(
                    "DELETE FROM Hacen WHERE Email = %s AND Examenes_Fecha = %s AND Materias_Nombre = %s",
                    (email, f, materia),
                )
        cur.execute(
            """
            INSERT INTO Examenes (Fecha, Materias_Nombre, Nota) VALUES (%s, %s, %s)
            ON CONFLICT (Fecha, Materias_Nombre) DO UPDATE SET Nota = EXCLUDED.Nota
            """,
            (fecha, materia, nota),
        )
        cur.execute(
            """
            INSERT INTO Hacen (Email, Examenes_Fecha, Materias_Nombre) VALUES (%s, %s, %s)
            ON CONFLICT DO NOTHING
            """,
            (email, fecha, materia),
        )
        cur.execute(
            """
            INSERT INTO Cursan (Email, Materias_Nombre, Fecha_Inscripcion, Fecha_Finalizacion)
            VALUES (%s, %s, %s, %s)
            ON CONFLICT (Email, Materias_Nombre) DO UPDATE SET Fecha_Finalizacion = EXCLUDED.Fecha_Finalizacion
            """,
            (email, materia, fecha, fecha),
        )

        conn.commit()
        cur.close()
        return jsonify({
            "message": "Materia completada guardada correctamente.",
            "materia": materia,
            "nota": float(nota),
            "fecha": fecha.isoformat(),
        }), 201

    except Exception as e:
        if conn:
            conn.rollback()
        print(f"Error al guardar la materia completada: {e}")
        return jsonify({"error": "Error interno del servidor."}), 500
    finally:
        if conn:
            conn.close()


# ---------------------------------------------------------------------------
# Listar materias completadas de un alumno
# ---------------------------------------------------------------------------

@materias_notas_bp.route("/materias-completadas", methods=["GET"])
def listar_materias_completadas():
    try:
        email = validar_email(request.args.get("email"))
    except ValidationError as e:
        return jsonify({"error": e.message}), 400

    conn = None
    try:
        conn = obtener_conexion()
        cur = conn.cursor()
        cur.execute(
            """
            SELECT h.Materias_Nombre, m.Cantidad_de_Creditos, e.Nota, h.Examenes_Fecha
            FROM Hacen h
            JOIN Examenes e ON e.Fecha = h.Examenes_Fecha AND e.Materias_Nombre = h.Materias_Nombre
            JOIN Materias m ON m.Nombre = h.Materias_Nombre
            WHERE h.Email = %s
            ORDER BY h.Examenes_Fecha DESC, h.Materias_Nombre
            """,
            (email,),
        )
        materias = [
            {"materia": n, "creditos": c, "nota": float(nota), "fecha": f.isoformat()}
            for n, c, nota, f in cur.fetchall()
        ]
        cur.close()
        return jsonify({"materias": materias}), 200
    except Exception as e:
        print(f"Error al listar materias completadas: {e}")
        return jsonify({"error": "Error interno del servidor."}), 500
    finally:
        if conn:
            conn.close()


# ---------------------------------------------------------------------------
# Quitar una materia completada
# ---------------------------------------------------------------------------

@materias_notas_bp.route("/materias-completadas", methods=["DELETE"])
def quitar_materia_completada():
    data = request.get_json(silent=True)
    if not isinstance(data, dict):
        return jsonify({"error": "Body inválido o faltante."}), 400

    try:
        email = validar_email(data.get("email"))
        materia = _validar_materia(data.get("materia"))
    except ValidationError as e:
        return jsonify({"error": e.message}), 400

    conn = None
    try:
        conn = obtener_conexion()
        cur = conn.cursor()

        cur.execute(
            "DELETE FROM Hacen WHERE Email = %s AND Materias_Nombre = %s RETURNING Examenes_Fecha",
            (email, materia),
        )
        fechas = [f for (f,) in cur.fetchall()]
        if not fechas:
            cur.close()
            return jsonify({"error": "El alumno no tiene esa materia completada."}), 404

        # Borra el examen solo si ningún otro alumno lo comparte.
        for f in fechas:
            cur.execute(
                """
                DELETE FROM Examenes e
                WHERE e.Fecha = %s AND e.Materias_Nombre = %s
                  AND NOT EXISTS (SELECT 1 FROM Hacen h
                                  WHERE h.Examenes_Fecha = e.Fecha AND h.Materias_Nombre = e.Materias_Nombre)
                """,
                (f, materia),
            )
        cur.execute(
            "UPDATE Cursan SET Fecha_Finalizacion = NULL WHERE Email = %s AND Materias_Nombre = %s",
            (email, materia),
        )

        conn.commit()
        cur.close()
        return jsonify({"message": "Materia completada eliminada."}), 200
    except Exception as e:
        if conn:
            conn.rollback()
        print(f"Error al quitar la materia completada: {e}")
        return jsonify({"error": "Error interno del servidor."}), 500
    finally:
        if conn:
            conn.close()
