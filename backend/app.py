from flask import Flask, jsonify
from Register import register_bp
from Login import login_bp
from Plan import plan_bp

app = Flask(__name__)
app.register_blueprint(register_bp)
app.register_blueprint(login_bp)
app.register_blueprint(plan_bp)
from Pasantia import pasantia_bp
from flask_cors import CORS

app = Flask(__name__)
app.register_blueprint(register_bp)
app.register_blueprint(pasantia_bp)
CORS(app)


@app.route("/", methods=["GET"])
def health():
    return jsonify({"status": "backend funcionando"}), 200


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=3000)
