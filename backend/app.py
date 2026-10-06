from flask import Flask, jsonify
from Register import register_bp
from Login import login_bp
from routes.study_plan import study_plan_bp

app = Flask(__name__)
app.register_blueprint(register_bp)
app.register_blueprint(login_bp)

app.register_blueprint(
    study_plan_bp,
    url_prefix="/api"
)


@app.route("/", methods=["GET"])
def health():
    return jsonify({"status": "backend funcionando"}), 200


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=3000)