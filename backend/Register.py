
import bcrypt
from flask import Blueprint, request, jsonify
from psycopg2 import errors

from conexion import obtener_conexion
from validaciones import (
    ValidationError,
    validar_email,
    validar_password,
    validar_nombre_persona,
)

register_bp = Blueprint("register", __name__)


@register_bp.route("/register", methods=["POST"])
def register():
    data = request.get_json(silent=True)
    if not data:
        return jsonify({"error": "Body inválido o faltante."}), 400

    validadores = (
        ("nombre", lambda: validar_nombre_persona(data.get("nombre"), "nombre")),
        ("apellido", lambda: validar_nombre_persona(data.get("apellido"), "apellido")),
        ("email", lambda: validar_email(data.get("email"))),
        ("password", lambda: validar_password(data.get("password"))),
    )
    valores = {}
    for campo, validar in validadores:
        try:
            valores[campo] = validar()
        except ValidationError as e:
            return jsonify({"error": e.message, "campo": campo}), 400
    nombre, apellido = valores["nombre"], valores["apellido"]
    email, password = valores["email"], valores["password"]

    # Hasheo de la contraseña -- nunca se guarda en texto plano.
    password_bytes = password.encode("utf-8")
    hashed = bcrypt.hashpw(password_bytes, bcrypt.gensalt())
    hashed_str = hashed.decode("utf-8")

    conn = None
    try:
        conn = obtener_conexion()
        cur = conn.cursor()


        cur.execute(
            """
            INSERT INTO Personas (Email, Nombre, Apellido, Contrasena)
            VALUES (%s, %s, %s, %s)
            """,
            (email, nombre, apellido, hashed_str),
        )
        conn.commit()
        cur.close()

        # Devuelve el usuario para que el frontend inicie sesión sin pedir el login.
        return jsonify({
            "message": "Usuario registrado correctamente.",
            "usuario": {"nombre": nombre, "apellido": apellido, "email": email},
        }), 201

    except errors.UniqueViolation:
        if conn:
            conn.rollback()
        return jsonify({"error": "Ese email ya está registrado.", "campo": "email"}), 409

    except Exception as e:
        if conn:
            conn.rollback()
        print(f"Error al registrar usuario: {e}")
        return jsonify({"error": "Error interno del servidor."}), 500

    finally:
        if conn:
            conn.close()