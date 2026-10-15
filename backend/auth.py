"""Tokens de sesión firmados y decorador para proteger rutas."""
import hashlib
import hmac
import os
from functools import wraps

from flask import g, jsonify, request
from itsdangerous import BadSignature, SignatureExpired, URLSafeTimedSerializer

from conexion import leer_secret

DURACION_SEGUNDOS = 60 * 60 * 24 * 30  # 30 días


def _clave_secreta():
    """SECRET_KEY si está definida; si no, se deriva del secreto de la base de datos."""
    clave = os.environ.get("SECRET_KEY")
    if clave:
        return clave
    base = leer_secret("DB_PASSWORD_FILE").encode("utf-8")
    return hmac.new(base, b"kairo-token-sesion", hashlib.sha256).hexdigest()


def _serializador():
    return URLSafeTimedSerializer(_clave_secreta(), salt="kairo-sesion")


def crear_token(email):
    return _serializador().dumps({"email": email})


def email_desde_token(token):
    try:
        datos = _serializador().loads(token, max_age=DURACION_SEGUNDOS)
    except (BadSignature, SignatureExpired):
        return None
    return datos.get("email")


def requiere_login(vista):
    """Exige 'Authorization: Bearer <token>' y deja el email en g.email."""
    @wraps(vista)
    def protegida(*args, **kwargs):
        cabecera = request.headers.get("Authorization", "")
        token = cabecera[7:].strip() if cabecera.lower().startswith("bearer ") else ""
        email = email_desde_token(token) if token else None
        if not email:
            return jsonify({"error": "Sesión no válida. Iniciá sesión nuevamente."}), 401
        g.email = email
        return vista(*args, **kwargs)
    return protegida
