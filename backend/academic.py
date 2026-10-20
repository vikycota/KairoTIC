from flask import Blueprint, jsonify, request

from academic_service import obtener_estado_academico
from conexion import obtener_conexion
from validaciones import ValidationError, validar_email, validar_longitud, validar_no_vacio


academic_bp = Blueprint("academic", __name__)


@academic_bp.route("/materias-habilitadas", methods=["GET"])
def listar_materias_habilitadas():
    try:
        email = validar_email(request.args.get("email"))
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
            estado = obtener_estado_academico(cur, email, carrera)
        if estado is None:
            return jsonify({"error": "La carrera no existe."}), 404
        return jsonify(estado), 200
    except Exception as error:
        print(f"Error al consultar el estado académico: {error}")
        return jsonify({"error": "Error interno del servidor."}), 500
    finally:
        if conn:
            conn.close()
