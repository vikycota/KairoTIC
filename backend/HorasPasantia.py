from datetime import date

from flask import Blueprint, request, jsonify
from psycopg2 import errors

from conexion import obtener_conexion
from validaciones import ValidationError, validar_email

horas_pasantia_bp = Blueprint("horas_pasantia", __name__)

HORAS_MAXIMAS_OBJETIVO = 10000
HORAS_MAXIMAS_CARGA = 9999.99  # tope de la columna Horas_Pasantia.Horas (NUMERIC(6,2))

_columna_objetivo_lista = False


def _asegurar_columna_objetivo(conn):
    """La meta de horas vive en Personas.Horas_Objetivo_Pasantia (NULL = todavía no la definió).
    Las bases ya creadas no la tienen porque db/init solo corre al crear la base, así que la
    agregamos acá la primera vez (idempotente)."""
    global _columna_objetivo_lista
    if _columna_objetivo_lista:
        return
    cur = conn.cursor()
    cur.execute("ALTER TABLE Personas ADD COLUMN IF NOT EXISTS Horas_Objetivo_Pasantia INT NULL")
    conn.commit()
    cur.close()
    _columna_objetivo_lista = True


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
        horas_por_semana = data.get("horas_por_semana")
        descripcion = (data.get("descripcion") or "").strip()[:255]
        # Si no mandan fechas, se usa el período de la pasantía (ver más abajo).
        fecha_inicio = _parsear_fecha(data["fecha_inicio"], "fecha_inicio") if data.get("fecha_inicio") else None
        fecha_fin = _parsear_fecha(data["fecha_fin"], "fecha_fin") if data.get("fecha_fin") else None

    except ValidationError as e:
        return jsonify({"error": e.message}), 400

    conn = None
    try:
        conn = obtener_conexion()
        _asegurar_columna_objetivo(conn)
        cur = conn.cursor()

        # Confirmamos que la pasantía exista antes de cargarle horas.
        cur.execute("SELECT Email, Fecha_Inicio, Fecha_Fin FROM Pasantias WHERE Id = %s", (pasantia_id,))
        fila = cur.fetchone()
        if not fila:
            cur.close()
            return jsonify({"error": "No existe una pasantía con ese id."}), 404

        email = fila[0]
        fecha_inicio = fecha_inicio or fila[1]
        # Pasantía en curso (sin fecha de fin): se cuenta hasta hoy.
        fecha_fin = fecha_fin or fila[2] or date.today()

        try:
            horas_calculadas = _calcular_horas(fecha_inicio, fecha_fin, horas_por_semana)
            if horas_calculadas > HORAS_MAXIMAS_CARGA:
                raise ValidationError("Son demasiadas horas para una sola carga; dividilas en períodos más cortos.")
        except ValidationError as e:
            cur.close()
            return jsonify({"error": e.message}), 400

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

    cur.execute("SELECT Horas_Objetivo_Pasantia FROM Personas WHERE Email = %s", (email,))
    fila = cur.fetchone()
    objetivo = fila[0] if fila else None

    if not objetivo:
        # Todavía no definió su meta: no hay porcentaje ni horas faltantes que calcular.
        return {
            "horas_totales": total_horas,
            "horas_objetivo": None,
            "horas_faltantes": None,
            "porcentaje": None,
        }

    return {
        "horas_totales": total_horas,
        "horas_objetivo": objetivo,
        "horas_faltantes": max(round(objetivo - total_horas, 2), 0),
        "porcentaje": round(min(total_horas / objetivo * 100, 100), 2),
    }


@horas_pasantia_bp.route("/pasantia/<int:pasantia_id>/horas-extra", methods=["POST"])
def agregar_horas_extra(pasantia_id):
    """Suma horas a mano a una pasantía. Body: {"horas": 8, "descripcion"?: "..."}"""
    data = request.get_json(silent=True)
    if not data:
        return jsonify({"error": "Body inválido o faltante."}), 400

    try:
        horas = data.get("horas")
        if isinstance(horas, bool) or not isinstance(horas, (int, float)) or horas <= 0:
            raise ValidationError("El campo 'horas' debe ser un número mayor a 0.")
        horas = round(float(horas), 2)
        if horas <= 0 or horas > HORAS_MAXIMAS_CARGA:
            raise ValidationError(f"Las horas deben estar entre 0.01 y {HORAS_MAXIMAS_CARGA:g}.")
        descripcion = (data.get("descripcion") or "").strip()[:255] or "Horas extra"
    except ValidationError as e:
        return jsonify({"error": e.message}), 400

    conn = None
    try:
        conn = obtener_conexion()
        _asegurar_columna_objetivo(conn)
        cur = conn.cursor()

        cur.execute("SELECT Email FROM Pasantias WHERE Id = %s", (pasantia_id,))
        fila = cur.fetchone()
        if not fila:
            cur.close()
            return jsonify({"error": "No existe una pasantía con ese id."}), 404

        cur.execute(
            "INSERT INTO Horas_Pasantia (Pasantias_Id, Horas, Descripcion) VALUES (%s, %s, %s)",
            (pasantia_id, horas, descripcion),
        )
        conn.commit()

        progreso = _obtener_progreso(cur, fila[0])
        cur.close()
        return jsonify({"message": "Horas extra agregadas correctamente.", "horas_agregadas": horas, "progreso": progreso}), 201

    except Exception as e:
        if conn:
            conn.rollback()
        print(f"Error al agregar horas extra: {e}")
        return jsonify({"error": "Error interno del servidor."}), 500

    finally:
        if conn:
            conn.close()


@horas_pasantia_bp.route("/persona/<string:email>/horas-objetivo-pasantia", methods=["PUT"])
def definir_horas_objetivo(email):
    """Define cuántas horas de pasantía tiene que juntar la persona. Body: {"horas_objetivo": 200}"""
    data = request.get_json(silent=True)
    if not data:
        return jsonify({"error": "Body inválido o faltante."}), 400

    try:
        email = validar_email(email)
        objetivo = data.get("horas_objetivo")
        if isinstance(objetivo, bool) or not isinstance(objetivo, int) or not (1 <= objetivo <= HORAS_MAXIMAS_OBJETIVO):
            raise ValidationError(f"Las horas objetivo deben ser un número entero entre 1 y {HORAS_MAXIMAS_OBJETIVO}.")
    except ValidationError as e:
        return jsonify({"error": e.message}), 400

    conn = None
    try:
        conn = obtener_conexion()
        _asegurar_columna_objetivo(conn)
        cur = conn.cursor()

        cur.execute("UPDATE Personas SET Horas_Objetivo_Pasantia = %s WHERE Email = %s", (objetivo, email))
        if cur.rowcount == 0:
            conn.rollback()
            cur.close()
            return jsonify({"error": "No existe una persona con ese email."}), 404
        conn.commit()

        progreso = _obtener_progreso(cur, email)
        cur.close()
        return jsonify({"message": "Meta de horas actualizada.", "progreso": progreso}), 200

    except Exception as e:
        if conn:
            conn.rollback()
        print(f"Error al definir horas objetivo: {e}")
        return jsonify({"error": "Error interno del servidor."}), 500

    finally:
        if conn:
            conn.close()


@horas_pasantia_bp.route("/persona/<string:email>/progreso-pasantia", methods=["GET"])
def progreso_pasantia(email):
    try:
        email = validar_email(email)
    except ValidationError as e:
        return jsonify({"error": e.message}), 400

    conn = None
    try:
        conn = obtener_conexion()
        _asegurar_columna_objetivo(conn)
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
