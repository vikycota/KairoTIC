import json
import logging
import os
import requests

from pdf_plan import normalizar_plan_pdf, parsear_plan_estructurado, registrar_etapa_pdf, resumir_plan


logger = logging.getLogger(__name__)


class PlanPdfRespuestaInvalida(Exception):
    """La IA respondio con JSON truncado o con un plan que no cumple el contrato."""


PLAN_JSON_SCHEMA = {
    "type": "object",
    "properties": {
        "carrera": {"type": ["string", "null"]},
        "materias": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "semestre": {"type": "integer"},
                    "nombre": {"type": "string"},
                    "creditos": {"type": "integer"},
                    "categoria": {"type": ["string", "null"]},
                    "previas": {"type": "array", "items": {"type": "string"}},
                },
                "required": ["semestre", "nombre", "creditos", "categoria", "previas"],
                "additionalProperties": False,
            },
        },
    },
    "required": ["carrera", "materias"],
    "additionalProperties": False,
}


def limpiar_respuesta_json(texto):
    """Quita unicamente un fence Markdown que envuelve toda la respuesta."""
    texto = texto.strip()
    if not texto.startswith("```"):
        return texto
    salto = texto.find("\n")
    if salto == -1:
        return texto
    texto = texto[salto + 1:].rstrip()
    if texto.endswith("```"):
        texto = texto[:-3]
    return texto.strip()


OLLAMA_URL = os.environ.get(
    "OLLAMA_URL",
    "http://host.docker.internal:11434"
)

OLLAMA_MODEL = os.environ.get(
    "OLLAMA_MODEL",
    "llama3.2:1b"
)


def interpretar_plan_estudio(texto):

    plan_estructurado = parsear_plan_estructurado(texto)
    if plan_estructurado is not None:
        registrar_etapa_pdf("RESPUESTA OLLAMA RAW", "Ollama omitido: se uso el parser determinista.")
        registrar_etapa_pdf(
            "JSON PARSEADO",
            json.dumps({"resumen": resumir_plan(plan_estructurado), "datos": plan_estructurado}, ensure_ascii=False, indent=2),
        )
        return plan_estructurado

    prompt = f"""
Analiza TODO el plan de estudios recibido y responde EXCLUSIVAMENTE con JSON valido.
No escribas explicaciones, Markdown, comentarios ni texto antes o despues del JSON.

Formato exacto:
{{
  "carrera": "nombre o null",
  "materias": [
    {{"semestre": 1, "nombre": "Materia", "creditos": 10, "categoria": "Categoria o null", "previas": []}}
  ]
}}

Reglas:
- Procesa todas las materias y conserva el semestre indicado en cada una. No asumas que todas pertenecen al primer semestre.
- Devuelve una lista plana: cada objeto representa una entrada principal del plan y tiene su propio semestre.
- Una previa/requisito/correlativa es solo una referencia. Guardala como string en "previas"; nunca la conviertas en otra materia.
- Usa "previas": [] cuando no haya previa. No hagas una materia previa de si misma.
- No inventes materias, creditos ni categorias. No copies los valores de ejemplo si no aparecen en el documento.

DOCUMENTO:
{texto}
"""

    registrar_etapa_pdf("PROMPT OLLAMA", prompt)
    payload = {
        "model": OLLAMA_MODEL,
        "stream": False,
        "format": PLAN_JSON_SCHEMA,
        "messages": [{"role": "user", "content": prompt}],
        "options": {"num_ctx": 8192, "num_predict": 2048, "temperature": 0},
    }
    response = requests.post(f"{OLLAMA_URL}/api/chat", json=payload, timeout=600)
    if getattr(response, "status_code", None) == 400 and isinstance(payload["format"], dict):
        logger.warning("Ollama no acepto JSON Schema; se reintenta con format=json.")
        payload_json = {**payload, "format": "json"}
        response = requests.post(f"{OLLAMA_URL}/api/chat", json=payload_json, timeout=600)

    response.raise_for_status()

    try:
        resultado = response.json()
    except ValueError as error:
        raise PlanPdfRespuestaInvalida("Ollama devolvio una respuesta HTTP no valida.") from error

    respuesta_raw = resultado.get("message", {}).get("content") if isinstance(resultado, dict) else None
    if not isinstance(respuesta_raw, str) or not respuesta_raw.strip():
        raise PlanPdfRespuestaInvalida("Ollama no devolvio contenido JSON.")
    registrar_etapa_pdf("RESPUESTA OLLAMA RAW", respuesta_raw)
    if isinstance(resultado, dict) and resultado.get("done_reason") in {"length", "max_tokens"}:
        raise PlanPdfRespuestaInvalida("La respuesta de Ollama quedo truncada.")

    respuesta_limpia = limpiar_respuesta_json(respuesta_raw)
    try:
        datos_parseados = json.loads(respuesta_limpia)
    except json.JSONDecodeError as error:
        inicio = max(0, error.pos - 300)
        fin = min(len(respuesta_raw), error.pos + 300)
        logger.warning(
            "JSON invalido de Ollama (longitud=%d, posicion=%d, linea=%d, columna=%d)",
            len(respuesta_raw), error.pos, error.lineno, error.colno,
        )
        registrar_etapa_pdf("CONTEXTO JSON INVALIDO", {
            "posicion": error.pos,
            "linea": error.lineno,
            "columna": error.colno,
            "contexto": respuesta_raw[inicio:fin],
        })
        raise PlanPdfRespuestaInvalida("Ollama devolvio JSON invalido o incompleto.") from error

    registrar_etapa_pdf(
        "JSON PARSEADO",
        json.dumps({"resumen": resumir_plan(datos_parseados), "datos": datos_parseados}, ensure_ascii=False, indent=2),
    )
    try:
        plan = normalizar_plan_pdf(datos_parseados)
        validar_plan_pdf(plan)
    except (TypeError, ValueError) as error:
        logger.warning("Plan PDF invalido despues de parsear JSON: %s", error)
        raise PlanPdfRespuestaInvalida("Ollama devolvio un plan incompleto o con formato invalido.") from error
    return plan


def validar_plan_pdf(plan):
    materias = plan.get("materias")
    if not isinstance(materias, list) or not materias:
        raise ValueError("El plan no contiene materias.")
    for indice, materia in enumerate(materias, start=1):
        if materia.get("semestre") is None:
            raise ValueError(f"La materia {indice} no tiene un semestre valido.")
        if not isinstance(materia.get("nombre"), str) or not materia["nombre"].strip():
            raise ValueError(f"La materia {indice} no tiene nombre.")
        creditos = materia.get("creditos")
        if isinstance(creditos, bool) or not isinstance(creditos, (int, float)):
            raise ValueError(f"La materia {indice} no tiene creditos validos.")
        if isinstance(creditos, float) and creditos.is_integer():
            materia["creditos"] = int(creditos)
        elif isinstance(creditos, float) or creditos < 0:
            raise ValueError(f"Los creditos de la materia {indice} no son un entero valido.")
        if not isinstance(materia.get("categoria"), (str, type(None))):
            materia["categoria"] = None
        if not isinstance(materia.get("previas"), list) or not all(
            isinstance(pre, str) for pre in materia["previas"]
        ):
            raise ValueError(f"Las previas de la materia {indice} no son una lista de nombres.")
