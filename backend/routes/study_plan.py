from flask import Blueprint, request, jsonify

from pdf_reader import extraer_texto_pdf
from ollama import interpretar_plan_estudio


study_plan_bp = Blueprint(
    "study_plan",
    __name__
)

@study_plan_bp.route(
    "/study-plan/import",
    methods=["POST"]
)
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

    except Exception as error:

        print("Error importando plan:", error)

        return jsonify({
            "error": "No se pudo procesar el plan de estudios."
        }), 500