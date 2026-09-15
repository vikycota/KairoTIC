

import bcrypt
from flask import Blueprint, request, jsonify

from conexion import obtener_conexion
from validaciones import ValidationError, validar_email

login_bp = Blueprint("login", __name__)


def validar_password_login(password):
    if not isinstance(password, str) or password == "":
        raise ValidationError("El campo 'password' no puede estar vacío.")
    return password


@login_bp.route("/login", methods=["POST"])
def login():
    data = request.get_json(silent=True)
    if not data:
        return jsonify({"error": "Body inválido o faltante."}), 400

    try:
        email = validar_email(data.get("email"))
        password = validar_password_login(data.get("password"))
    except ValidationError as e:
        return jsonify({"error": e.message}), 400

    conn = None
    try:
        conn = obtener_conexion()
        cur = conn.cursor()

        cur.execute(
            "SELECT Nombre, Apellido, Contrasena FROM Personas WHERE Email = %s",
            (email,),
        )
        fila = cur.fetchone()
        cur.close()


        if not fila:
            return jsonify({"error": "Email o contraseña incorrectos."}), 401

        nombre, apellido, hashed_str = fila

        if not bcrypt.checkpw(password.encode("utf-8"), hashed_str.encode("utf-8")):
            return jsonify({"error": "Email o contraseña incorrectos."}), 401

        return jsonify({
            "message": "Login exitoso.",
            "usuario": {
                "nombre": nombre,
                "apellido": apellido,
                "email": email,
            },
        }), 200

    except Exception as e:
        print(f"Error al iniciar sesión: {e}")
        return jsonify({"error": "Error interno del servidor."}), 500

    finally:
        if conn:
            conn.close()
