from flask import Blueprint, request, jsonify
from psycopg2 import errors
import traceback
from conexion import obtener_conexion
from validaciones import (
    ValidationError,
    validar_email,
    validar_no_vacio,
    validar_longitud,
    detectar_intento_sql_injection,
)

pasantia_bp = Blueprint("pasantia", __name__)


@pasantia_bp.route("/pasantia", methods=["POST"])
def agregar_pasantia():
    data = request.get_json(silent=True)
    if not data:
        return jsonify({"error": "Body inválido o faltante."}), 400

    try:
        email = validar_email(data.get("email"))

        empresa = validar_no_vacio(data.get("empresa"), "empresa")
        empresa = validar_longitud(empresa, "empresa", minimo=2, maximo=150)
        detectar_intento_sql_injection(empresa, "empresa")

        fecha_inicio = validar_no_vacio(data.get("fecha_inicio"), "fecha_inicio")
        fecha_fin = data.get("fecha_fin") or None

        creditos = data.get("creditos", 0)
        if not isinstance(creditos, int) or creditos < 0:
            raise ValidationError("El campo 'creditos' debe ser un número entero no negativo.")

        descripcion = (data.get("descripcion") or "").strip()
        if descripcion:
            descripcion = validar_longitud(descripcion, "descripcion", minimo=0, maximo=500)
            detectar_intento_sql_injection(descripcion, "descripcion")

    except ValidationError as e:
        return jsonify({"error": e.message}), 400

    conn = None
    try:
        conn = obtener_conexion()
        cur = conn.cursor()

        cur.execute(
            """
            INSERT INTO Pasantias (Email, Empresa, Fecha_Inicio, Fecha_Fin, Creditos, Descripcion)
            VALUES (%s, %s, %s, %s, %s, %s)
            """,
            (email, empresa, fecha_inicio, fecha_fin, creditos, descripcion),
        )
        conn.commit()
        cur.close()

        return jsonify({"message": "Pasantía agregada correctamente."}), 201

    except errors.ForeignKeyViolation:
        if conn:
            conn.rollback()
        return jsonify({"error": "El email no corresponde a un usuario registrado."}), 404

    except Exception as e:
        if conn:
            conn.rollback()
        print(f"Error al agregar pasantía: {e}")
        traceback.print_exc()
        return jsonify({"error": "Error interno del servidor."}), 500

    finally:
        if conn:
            conn.close()