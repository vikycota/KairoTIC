from flask import Blueprint, g, jsonify, request

from auth import requiere_login
from academic_service import obtener_estado_academico
from conexion import obtener_conexion
from validaciones import ValidationError, validar_longitud, validar_no_vacio


academic_bp = Blueprint("academic", __name__)


@academic_bp.route("/materias-habilitadas", methods=["GET"])
@requiere_login
def listar_materias_habilitadas():
    try:
        carrera = validar_longitud(
            validar_no_vacio(request.args.get("carrera"), "carrera"),
            "carrera",
            maximo=100,
        )
    except ValidationError as error:
        return jsonify({"error": error.message}), 400

    conn = None
    try:
        conn = obtener_conexion()
        with conn.cursor() as cur:
            cur.execute(
                "SELECT 1 FROM Pertenecen_A WHERE Email = %s AND Carreras_Nombre = %s",
                (g.email, carrera),
            )
            if not cur.fetchone():
                return jsonify({"error": "La carrera no está asociada a tu cuenta."}), 404
            estado = obtener_estado_academico(cur, g.email, carrera)
        if estado is None:
            return jsonify({"error": "La carrera no existe."}), 404
        return jsonify(estado), 200
    except Exception as error:
        print(f"Error al consultar el estado académico: {error}")
        return jsonify({"error": "Error interno del servidor."}), 500
    finally:
        if conn:
            conn.close()
