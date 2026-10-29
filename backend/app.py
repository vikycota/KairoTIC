import os

from flask import Flask, jsonify
from flask_cors import CORS

from Login import login_bp
from academic import academic_bp
from Pasantia import pasantia_bp
from Plan import plan_bp
from horarios import horarios_bp
from Register import register_bp
from routes.study_plan import study_plan_bp
from subir_materias_notas import materias_notas_bp
from HorasPasantia import horas_pasantia_bp
from Costos import costos_bp

app = Flask(__name__)
app.config["MAX_CONTENT_LENGTH"] = 10 * 1024 * 1024

# Cada blueprint se publica sin prefijo (Caddy quita /api antes de llegar acá)
# y también bajo /api (el proxy de Vite en desarrollo lo reenvía tal cual).
for bp in (register_bp, login_bp, plan_bp, pasantia_bp, horas_pasantia_bp, materias_notas_bp, study_plan_bp, horarios_bp, costos_bp, academic_bp):
    app.register_blueprint(bp)
    app.register_blueprint(bp, url_prefix="/api", name=f"{bp.name}_api")

origenes_cors = [
    origen.strip()
    for origen in os.environ.get(
        "CORS_ORIGINS",
        "http://localhost:5173,http://localhost:3000",
    ).split(",")
    if origen.strip()
]
CORS(app, origins=origenes_cors)


@app.route("/", methods=["GET"])
def health():
    return jsonify({"status": "backend funcionando"}), 200


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=3000)
