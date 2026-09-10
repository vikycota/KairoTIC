
import re

# ---------- Patrones ----------
EMAIL_REGEX = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")

SQL_INJECTION_PATTERN = re.compile(
    r"(--|;|/\*|\*/|xp_|\bUNION\b|\bSELECT\b|\bINSERT\b|\bDELETE\b|"
    r"\bUPDATE\b|\bDROP\b|\bALTER\b|\bEXEC\b|\bOR\b\s+\d+\s*=\s*\d+)",
    re.IGNORECASE,
)


class ValidationError(Exception):
    def __init__(self, message):
        self.message = message
        super().__init__(message)


# ---------- Validaciones de tipo ----------

def validar_es_string(valor, nombre_campo):
    if not isinstance(valor, str):
        raise ValidationError(f"El campo '{nombre_campo}' debe ser de tipo texto.")
    return valor


def validar_no_vacio(valor, nombre_campo):
    valor = validar_es_string(valor, nombre_campo).strip()
    if not valor:
        raise ValidationError(f"El campo '{nombre_campo}' no puede estar vacío.")
    return valor


def validar_longitud(valor, nombre_campo, minimo=1, maximo=255):
    if len(valor) < minimo:
        raise ValidationError(f"El campo '{nombre_campo}' debe tener al menos {minimo} caracteres.")
    if len(valor) > maximo:
        raise ValidationError(f"El campo '{nombre_campo}' no puede superar los {maximo} caracteres.")
    return valor


# ---------- Validaciones específicas ----------

def validar_email(email):
    email = validar_no_vacio(email, "email").lower()
    email = validar_longitud(email, "email", minimo=5, maximo=150)
    if not EMAIL_REGEX.match(email):
        raise ValidationError("El email no tiene un formato válido.")
    detectar_intento_sql_injection(email, "email")
    return email


def validar_password(password):
    password = validar_es_string(password, "password")
    if len(password) < 8:
        raise ValidationError("La contraseña debe tener al menos 8 caracteres.")
    if len(password) > 128:
        raise ValidationError("La contraseña no puede superar los 128 caracteres.")
    return password


def validar_nombre_persona(valor, nombre_campo):
    """Para campos como Nombre y Apellido: solo letras, espacios y acentos."""
    valor = validar_no_vacio(valor, nombre_campo)
    valor = validar_longitud(valor, nombre_campo, minimo=2, maximo=100)
    detectar_intento_sql_injection(valor, nombre_campo)
    if not re.match(r"^[A-Za-zÀ-ÿñÑ\s]+$", valor):
        raise ValidationError(f"El campo '{nombre_campo}' solo puede contener letras y espacios.")
    return valor


# ---------- Protección contra inyección SQL ----------

def detectar_intento_sql_injection(valor, nombre_campo):
    if SQL_INJECTION_PATTERN.search(valor):
        raise ValidationError(f"El campo '{nombre_campo}' contiene caracteres no permitidos.")
    return valor