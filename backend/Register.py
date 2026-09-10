"""
Lógica de registro de usuarios (tabla Personas).
"""

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

    try:
        nombre = validar_nombre_persona(data.get("nombre"), "nombre")
        apellido = validar_nombre_persona(data.get("apellido"), "apellido")
        email = validar_email(data.get("email"))
        password = validar_password(data.get("password"))
    except ValidationError as e:
        return jsonify({"error": e.message}), 400

    # Hasheo de la contraseña -- nunca se guarda en texto plano.
    password_bytes = password.encode("utf-8")
    hashed = bcrypt.hashpw(password_bytes, bcrypt.gensalt())
    hashed_str = hashed.decode("utf-8")

    conn = None
    try:
        conn = obtener_conexion()
        cur = conn.cursor()

        # Query parametrizada (%s): psycopg2 envía los valores por separado
        # del SQL, nunca los concatena dentro del string. Esto es lo que
        # realmente previene la inyección SQL, más allá del filtro en validaciones.py.
        cur.execute(
            """
            INSERT INTO Personas (Email, Nombre, Apellido, Contrasena)
            VALUES (%s, %s, %s, %s)
            """,
            (email, nombre, apellido, hashed_str, 0),
        )
        conn.commit()
        cur.close()

        return jsonify({"message": "Usuario registrado correctamente."}), 201

    except errors.UniqueViolation:
        if conn:
            conn.rollback()
        return jsonify({"error": "Ese email ya está registrado."}), 409

    except Exception as e:
        if conn:
            conn.rollback()
        print(f"Error al registrar usuario: {e}")
        return jsonify({"error": "Error interno del servidor."}), 500

    finally:
        if conn:
            conn.close()