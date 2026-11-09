"""Utilidades para el pipeline de importacion de planes PDF."""

import os
import re
import unicodedata
import logging


_REGISTRO_RE = re.compile(r"^[ \t]*REGISTRO[ \t]+(\d+)[ \t]*$", re.IGNORECASE | re.MULTILINE)
_BLOQUE_RE = re.compile(
    r"^[ \t]*REGISTRO[ \t]+(\d+)[ \t]*\r?\n(.*?)^[ \t]*FIN[ \t]+REGISTRO[ \t]+\1[ \t]*$",
    re.IGNORECASE | re.MULTILINE | re.DOTALL,
)
_SEMESTRE_RE = re.compile(r"^[ \t]*SEMESTRE[ \t]+(\d+)[ \t]*$", re.IGNORECASE)
_MATERIA_RE = re.compile(r"^[ \t]*MATERIA[ \t]*:[ \t]*(.*)$", re.IGNORECASE)
_ETIQUETAS = {
    "semestre": "semestre",
    "materia": "nombre",
    "nombre": "nombre",
    "codigo": "codigo",
    "creditos": "creditos",
    "categoria": "categoria",
    "previa": "previas",
    "previas": "previas",
    "previatura": "previas",
    "previaturas": "previas",
    "requisito": "previas",
    "requisitos": "previas",
    "correlativa": "previas",
    "correlativas": "previas",
}
_SIN_PREVIA = {"", "ninguna", "ninguno", "no", "no tiene", "sin previa", "-", "—", "n/a", "na"}
_CAMPOS_NOMBRE_PREVIA = ("nombre", "materia", "previa", "previa_nombre")
logger = logging.getLogger(__name__)


def _clave(texto):
    normalizado = unicodedata.normalize("NFD", texto)
    return "".join(c for c in normalizado if unicodedata.category(c) != "Mn").lower().strip()


def _parsear_semestre(valor):
    coincidencia = re.fullmatch(r"\s*(?:semestre\s*)?(\d+)\s*", valor, re.IGNORECASE)
    if not coincidencia:
        return None
    numero = int(coincidencia.group(1))
    return numero if 1 <= numero <= 10 else None


def _parsear_creditos(valor):
    valor = "".join(
        c for c in unicodedata.normalize("NFD", valor)
        if unicodedata.category(c) != "Mn"
    )
    coincidencia = re.fullmatch(r"\s*(\d+)(?:[,.]0+)?\s*(?:creditos?|ects)?\s*", valor, re.IGNORECASE)
    return int(coincidencia.group(1)) if coincidencia else None


def _normalizar_nombre_materia(valor):
    return re.sub(r"\s+", " ", _clave(str(valor or ""))).strip(" .")


def _normalizar_previas(valor, nombre_materia=None):
    if valor is None:
        return []
    elementos = valor if isinstance(valor, list) else [valor]
    previas = []
    for elemento in elementos:
        if isinstance(elemento, str):
            nombre = elemento.strip()
        elif isinstance(elemento, dict):
            nombre = next(
                (elemento.get(campo, "").strip() for campo in _CAMPOS_NOMBRE_PREVIA
                 if isinstance(elemento.get(campo), str) and elemento[campo].strip()),
                "",
            )
        else:
            nombre = ""
        if nombre and _clave(nombre) not in _SIN_PREVIA:
            if nombre_materia and _normalizar_nombre_materia(nombre) == _normalizar_nombre_materia(nombre_materia):
                logger.warning("Se descarto una previa autorreferente en la materia %r", nombre_materia)
                continue
            previas.append(nombre)
    return previas


def _normalizar_semestre(valor):
    if isinstance(valor, bool) or valor is None:
        return None
    coincidencia = re.fullmatch(r"\s*(?:semestre\s*)?(\d+)\s*", str(valor), re.IGNORECASE)
    if not coincidencia:
        return None
    numero = int(coincidencia.group(1))
    return numero if 1 <= numero <= 10 else None


def normalizar_plan_pdf(datos):
    """Canoniza respuestas nuevas y antiguas, sin mezclar previas con materias."""
    if not isinstance(datos, dict):
        raise ValueError("La respuesta del plan debe ser un objeto JSON.")

    entradas = []
    if isinstance(datos.get("materias"), list):
        entradas = [(materia, None) for materia in datos["materias"]]
    elif isinstance(datos.get("semestres"), list):
        for semestre in datos["semestres"]:
            if not isinstance(semestre, dict):
                continue
            lista = semestre.get("materias")
            if not isinstance(lista, list):
                continue
            entradas.extend((materia, semestre.get("numero")) for materia in lista)

    materias = []
    for materia, semestre_padre in entradas:
        if not isinstance(materia, dict):
            raise ValueError("La respuesta del plan contiene una materia con formato invalido.")
        semestre = materia.get("semestre")
        if semestre is None:
            semestre = semestre_padre
        nombre = materia.get("nombre") or materia.get("materia") or ""
        creditos = materia.get("creditos")
        if creditos is None:
            creditos = materia.get("cr\u00e9ditos")
        if creditos is None:
            creditos = materia.get("credits")
        if creditos is None:
            creditos = materia.get("ects")
        previas_raw = materia.get("previas") or materia.get("previa")
        materias.append({
            "semestre": _normalizar_semestre(semestre),
            "nombre": nombre,
            "creditos": creditos,
            "categoria": materia.get("categoria") or materia.get("categor\u00eda") or materia.get("category"),
            "previas": _normalizar_previas(previas_raw, nombre),
        })

    return {"carrera": datos.get("carrera"), "materias": materias}


def _parsear_bloque(contenido):
    campos = {}
    previas = []
    for linea in contenido.splitlines():
        if ":" not in linea:
            continue
        etiqueta, valor = linea.split(":", 1)
        campo = _ETIQUETAS.get(_clave(etiqueta))
        if not campo:
            continue
        valor = valor.strip()
        if campo == "previas":
            if _clave(valor) not in _SIN_PREVIA:
                previas.extend(item.strip() for item in re.split(r"[;|]", valor) if item.strip())
        else:
            if campo in campos:
                return None
            campos[campo] = valor

    semestre = _parsear_semestre(campos.get("semestre", ""))
    creditos = _parsear_creditos(campos.get("creditos", ""))
    nombre = campos.get("nombre", "").strip()
    if semestre is None or creditos is None or not nombre:
        return None
    return {
        "semestre": semestre,
        "nombre": nombre,
        "creditos": creditos,
        "categoria": campos.get("categoria") or None,
        "codigo": campos.get("codigo") or None,
        "previas": previas,
    }


def _parsear_secciones_semestre(texto):
    actual = None
    registros = []
    semestre_actual = None

    def guardar_actual():
        if actual is None:
            return True
        materia = _parsear_bloque("\n".join(actual))
        if materia is None:
            return False
        registros.append(materia)
        return True

    for linea in texto.splitlines():
        encabezado = _SEMESTRE_RE.fullmatch(linea)
        if encabezado:
            if not guardar_actual():
                return None
            semestre_actual = encabezado.group(1)
            actual = None
            continue

        materia = _MATERIA_RE.fullmatch(linea)
        if materia:
            if not guardar_actual():
                return None
            actual = [f"Semestre: {semestre_actual or ''}", f"Materia: {materia.group(1)}"]
        elif actual is not None:
            actual.append(linea)

    if not guardar_actual() or not registros:
        return None
    return normalizar_plan_pdf({"carrera": None, "materias": registros})


def parsear_plan_estructurado(texto):
    """Devuelve el plan si todo el texto contiene registros completos y validos."""
    inicios = list(_REGISTRO_RE.finditer(texto))
    bloques = list(_BLOQUE_RE.finditer(texto))
    if not inicios:
        return _parsear_secciones_semestre(texto)
    if len(inicios) != len(bloques):
        return None

    materias = []
    for bloque in bloques:
        materia = _parsear_bloque(bloque.group(2))
        if materia is None:
            return None
        materias.append(materia)

    return normalizar_plan_pdf({"carrera": None, "materias": materias})


def contar_registros(texto):
    return len(_REGISTRO_RE.findall(texto))


def resumir_plan(plan):
    materias = materias_de_plan(plan)
    semestres = {materia.get("semestre") for materia in materias if materia.get("semestre") is not None}
    creditos_total = 0.0
    for materia in materias:
        try:
            creditos_total += float(str(materia.get("creditos", 0) or 0).replace(",", "."))
        except ValueError:
            continue
    if creditos_total.is_integer():
        creditos_total = int(creditos_total)
    return {
        "semestres": len(semestres),
        "materias": len(materias),
        "creditos": creditos_total,
        "materias_con_previas": sum(bool(materia.get("previas")) for materia in materias),
    }


def materias_de_plan(plan):
    if not isinstance(plan, dict):
        return []
    if isinstance(plan.get("materias"), list):
        return [materia for materia in plan["materias"] if isinstance(materia, dict)]
    semestres = plan.get("semestres", [])
    if not isinstance(semestres, list):
        return []
    resultado = []
    for semestre in semestres:
        if not isinstance(semestre, dict) or not isinstance(semestre.get("materias"), list):
            continue
        for materia in semestre["materias"]:
            if not isinstance(materia, dict):
                continue
            copia = dict(materia)
            if copia.get("semestre") is None:
                copia["semestre"] = semestre.get("numero")
            resultado.append(copia)
    return resultado


def registrar_etapa_pdf(titulo, contenido):
    """Imprime trazas explicitas solo al activar KAIRO_PDF_IMPORT_DEBUG=1."""
    if os.environ.get("KAIRO_PDF_IMPORT_DEBUG") == "1":
        print(f"=== {titulo} ===", flush=True)
        print(contenido, flush=True)
