import logging

import fitz
import requests
from flask import Blueprint, request, jsonify

from auth import requiere_login
from pdf_reader import extraer_texto_pdf
from ollama import interpretar_plan_estudio


study_plan_bp = Blueprint(
    "study_plan",
    __name__
)
logger = logging.getLogger(__name__)

@study_plan_bp.route(
    "/study-plan/import",
    methods=["POST"]
)
@requiere_login
def importar_plan():

    if "pdf" not in request.files:
        return jsonify({
            "error": "No se recibió ningún PDF."
        }), 400

    archivo = request.files["pdf"]

    if archivo.filename == "":
        return jsonify({
            "error": "El archivo no tiene nombre."
        }), 400

    if not archivo.filename.lower().endswith(".pdf"):
        return jsonify({
            "error": "El archivo debe ser PDF."
        }), 400

    try:

        texto = extraer_texto_pdf(archivo)

        if not texto.strip():
            return jsonify({
                "error": "No se pudo extraer texto del PDF."
            }), 400

        plan = interpretar_plan_estudio(texto)

        return jsonify(plan), 200

    except fitz.FileDataError:
        return jsonify({"error": "El archivo no es un PDF válido o está dañado."}), 400

    except requests.exceptions.Timeout:
        logger.exception("Ollama agotó el tiempo al importar el plan")
        return jsonify({
            "error": "El análisis del PDF superó el límite de 10 minutos. Probá con un PDF más corto o con menos páginas."
        }), 504

    except requests.exceptions.HTTPError as error:
        if error.response is not None and error.response.status_code == 404:
            return jsonify({
                "error": "El modelo de IA todavía no está listo. Esperá a que termine su descarga y volvé a intentar."
            }), 503
        logger.exception("Ollama respondió con un error al importar el plan")
        return jsonify({
            "error": "Ollama no pudo analizar el PDF. Revisá los logs del servicio Ollama."
        }), 502

    except requests.exceptions.ConnectionError:
        logger.exception("No se pudo conectar con Ollama al importar el plan")
        return jsonify({
            "error": "No se pudo conectar con Ollama. Esperá a que inicie y volvé a intentar."
        }), 503

    except requests.exceptions.RequestException:
        logger.exception("Error de comunicación con Ollama al importar el plan")
        return jsonify({"error": "Falló la comunicación con Ollama al analizar el PDF."}), 502

    except Exception:

        logger.exception("Error importando plan de estudios")

        return jsonify({
            "error": "No se pudo procesar el plan de estudios."
        }), 500
