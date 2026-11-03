import os
import psycopg2


def leer_secret(env_var_name):
    """Lee un secreto desde una variable de entorno directa (Vercel) o, si no existe,
    desde el archivo apuntado por `<NOMBRE>_FILE` (Docker secrets)."""
    valor = os.environ.get(env_var_name.removesuffix("_FILE"))
    if valor:
        return valor.strip()
    path = os.environ.get(env_var_name)
    if not path:
        raise RuntimeError(
            f"Falta configurar '{env_var_name.removesuffix('_FILE')}' o '{env_var_name}'."
        )
    with open(path, "r") as f:
        return f.read().strip()


def obtener_conexion():
    # Vercel (Neon/Supabase/etc.) entrega una única URL de conexión.
    url = os.environ.get("DATABASE_URL") or os.environ.get("POSTGRES_URL")
    if url:
        return psycopg2.connect(url)
    return psycopg2.connect(
        host=os.environ.get("DB_HOST", "db"),
        port=os.environ.get("DB_PORT", "5432"),
        user=leer_secret("DB_USER_FILE"),
        password=leer_secret("DB_PASSWORD_FILE"),
        dbname=leer_secret("DB_NAME_FILE"),
    )
