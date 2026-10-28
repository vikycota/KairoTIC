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
            RETURNING Id
            """,
            (email, empresa, fecha_inicio, fecha_fin, creditos, descripcion),
        )
        nuevo_id = cur.fetchone()[0]
        conn.commit()
        cur.close()

        return jsonify({"message": "Pasantía agregada correctamente.", "id": nuevo_id}), 201

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


@pasantia_bp.route("/persona/<string:email>/pasantias", methods=["GET"])
def listar_pasantias(email):
    try:
        email = validar_email(email)
    except ValidationError as e:
        return jsonify({"error": e.message}), 400

    conn = None
    try:
        conn = obtener_conexion()
        cur = conn.cursor()

        cur.execute(
            """
            SELECT p.Id, p.Empresa, p.Fecha_Inicio, p.Fecha_Fin, p.Creditos, p.Descripcion,
                   COALESCE(SUM(hp.Horas), 0)
            FROM Pasantias p
            LEFT JOIN Horas_Pasantia hp ON hp.Pasantias_Id = p.Id
            WHERE p.Email = %s
            GROUP BY p.Id
            ORDER BY p.Fecha_Inicio DESC, p.Id DESC
            """,
            (email,),
        )
        filas = cur.fetchall()
        cur.close()

        pasantias = [
            {
                "id": fila[0],
                "empresa": fila[1],
                "fecha_inicio": fila[2].isoformat(),
                "fecha_fin": fila[3].isoformat() if fila[3] else None,
                "creditos": fila[4],
                "descripcion": fila[5] or "",
                "horas_totales": float(fila[6]),
            }
            for fila in filas
        ]
        return jsonify({"pasantias": pasantias}), 200

    except Exception as e:
        print(f"Error al listar pasantías: {e}")
        traceback.print_exc()
        return jsonify({"error": "Error interno del servidor."}), 500

    finally:
        if conn:
            conn.close()
