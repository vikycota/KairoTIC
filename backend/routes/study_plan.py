import logging

import fitz
import requests
from flask import Blueprint, request, jsonify

from auth import requiere_login
from pdf_reader import extraer_texto_pdf
from ollama import PlanPdfRespuestaInvalida, interpretar_plan_estudio
from pdf_plan import contar_registros, materias_de_plan, registrar_etapa_pdf, resumir_plan


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
        registrar_etapa_pdf(
            "TEXTO EXTRAIDO PDF",
            f"Caracteres: {len(texto)}; registros detectados: {contar_registros(texto)}\n{texto}",
        )

        if not texto.strip():
            return jsonify({
                "error": "No se pudo extraer texto del PDF."
            }), 400

        plan = interpretar_plan_estudio(texto)
        materias = materias_de_plan(plan)
        registrar_etapa_pdf(
            "MATERIAS NORMALIZADAS",
            {
                "TOTAL MATERIAS": len(materias),
                "SEMESTRES": sorted({m["semestre"] for m in materias if m.get("semestre") is not None}),
                **resumir_plan(plan),
                "datos": materias,
            },
        )

        return jsonify(plan), 200

    except PlanPdfRespuestaInvalida as error:
        logger.warning("No se pudo interpretar el plan PDF: %s", error)
        return jsonify({
            "error": "La IA no devolvio un plan valido. Volve a intentar.",
        }), 502

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
