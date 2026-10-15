from datetime import date

from flask import Blueprint, request, jsonify
from psycopg2 import errors

from conexion import obtener_conexion
from validaciones import ValidationError, validar_email

horas_pasantia_bp = Blueprint("horas_pasantia", __name__)

HORAS_OBJETIVO = 150


def _parsear_fecha(valor, nombre_campo):
    if not valor:
        raise ValidationError(f"El campo '{nombre_campo}' es obligatorio.")
    try:
        return date.fromisoformat(valor)
    except ValueError:
        raise ValidationError(f"El campo '{nombre_campo}' debe tener formato AAAA-MM-DD.")


def _calcular_horas(fecha_inicio, fecha_fin, horas_por_semana):
    if fecha_fin < fecha_inicio:
        raise ValidationError("La fecha de fin no puede ser anterior a la fecha de inicio.")

    if not isinstance(horas_por_semana, (int, float)) or horas_por_semana <= 0:
        raise ValidationError("El campo 'horas_por_semana' debe ser un número mayor a 0.")

    dias_totales = (fecha_fin - fecha_inicio).days + 1  # inclusive
    semanas = dias_totales / 7
    horas = round(semanas * horas_por_semana, 2)

    if horas <= 0:
        raise ValidationError("El cálculo dio 0 horas, revisá las fechas y las horas por semana.")

    return horas


@horas_pasantia_bp.route("/pasantia/<int:pasantia_id>/horas", methods=["POST"])
def cargar_horas(pasantia_id):
    data = request.get_json(silent=True)
    if not data:
        return jsonify({"error": "Body inválido o faltante."}), 400

    try:
        fecha_inicio = _parsear_fecha(data.get("fecha_inicio"), "fecha_inicio")
        fecha_fin = _parsear_fecha(data.get("fecha_fin"), "fecha_fin")
        horas_por_semana = data.get("horas_por_semana")

        horas_calculadas = _calcular_horas(fecha_inicio, fecha_fin, horas_por_semana)

        descripcion = (data.get("descripcion") or "").strip()[:255]

    except ValidationError as e:
        return jsonify({"error": e.message}), 400

    conn = None
    try:
        conn = obtener_conexion()
        cur = conn.cursor()

        # Confirmamos que la pasantía exista antes de cargarle horas.
        cur.execute("SELECT Email FROM Pasantias WHERE Id = %s", (pasantia_id,))
        fila = cur.fetchone()
        if not fila:
            cur.close()
            return jsonify({"error": "No existe una pasantía con ese id."}), 404

        email = fila[0]

        cur.execute(
            """
            INSERT INTO Horas_Pasantia (Pasantias_Id, Horas, Descripcion)
            VALUES (%s, %s, %s)
            """,
            (pasantia_id, horas_calculadas, descripcion),
        )
        conn.commit()

        # Recalculamos el total actualizado de la persona para devolverlo ya mismo.
        progreso = _obtener_progreso(cur, email)
        cur.close()

        return jsonify({
            "message": "Horas cargadas correctamente.",
            "horas_agregadas": horas_calculadas,
            "progreso": progreso,
        }), 201

    except errors.ForeignKeyViolation:
        if conn:
            conn.rollback()
        return jsonify({"error": "No existe una pasantía con ese id."}), 404

    except Exception as e:
        if conn:
            conn.rollback()
        print(f"Error al cargar horas de pasantía: {e}")
        return jsonify({"error": "Error interno del servidor."}), 500

    finally:
        if conn:
            conn.close()


def _obtener_progreso(cur, email):
    cur.execute(
        """
        SELECT COALESCE(SUM(hp.Horas), 0)
        FROM Horas_Pasantia hp
        JOIN Pasantias p ON p.Id = hp.Pasantias_Id
        WHERE p.Email = %s
        """,
        (email,),
    )
    total_horas = float(cur.fetchone()[0])
    porcentaje = round(min(total_horas / HORAS_OBJETIVO * 100, 100), 2)
    horas_faltantes = max(round(HORAS_OBJETIVO - total_horas, 2), 0)

    return {
        "horas_totales": total_horas,
        "horas_objetivo": HORAS_OBJETIVO,
        "horas_faltantes": horas_faltantes,
        "porcentaje": porcentaje,
    }


@horas_pasantia_bp.route("/persona/<string:email>/progreso-pasantia", methods=["GET"])
def progreso_pasantia(email):
    try:
        email = validar_email(email)
    except ValidationError as e:
        return jsonify({"error": e.message}), 400

    conn = None
    try:
        conn = obtener_conexion()
        cur = conn.cursor()

        cur.execute("SELECT 1 FROM Personas WHERE Email = %s", (email,))
        if not cur.fetchone():
            cur.close()
            return jsonify({"error": "No existe una persona con ese email."}), 404

        progreso = _obtener_progreso(cur, email)
        cur.close()

        return jsonify(progreso), 200

    except Exception as e:
        if conn:
            conn.rollback()
        print(f"Error al calcular progreso de pasantía: {e}")
        return jsonify({"error": "Error interno del servidor."}), 500

    finally:
        if conn:
            conn.close()
