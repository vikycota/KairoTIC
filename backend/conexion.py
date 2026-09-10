"""
Módulo de conexión a la base de datos.
Lee las credenciales desde Docker Secrets (nunca desde variables de entorno en texto plano).
"""

import os
import psycopg2


def leer_secret(env_var_name):
    """Lee el contenido de un archivo de secret montado por Docker."""
    path = os.environ.get(env_var_name)
    if not path:
        raise RuntimeError(f"Variable de entorno '{env_var_name}' no configurada.")
    with open(path, "r") as f:
        return f.read().strip()


def obtener_conexion():
    return psycopg2.connect(
        host=os.environ.get("DB_HOST", "db"),
        port=os.environ.get("DB_PORT", "5432"),
        user=leer_secret("DB_USER_FILE"),
        password=leer_secret("DB_PASSWORD_FILE"),
        dbname=leer_secret("DB_NAME_FILE"),
    )