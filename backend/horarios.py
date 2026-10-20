"""Endpoints de importación y consulta de bloques horarios."""
import logging

from flask import Blueprint, Response, jsonify, request
from werkzeug.exceptions import HTTPException

from conexion import obtener_conexion
from horario_parser import HorarioError, leer_archivo_horarios, plantilla_csv, plantilla_json, plantilla_xlsx
from horario_service import guardar_horarios, listar_horarios, validar_metadata


horarios_bp = Blueprint("horarios", __name__)
logger = logging.getLogger(__name__)


def _analizar(cur):
    archivo = request.files.get("archivo")
    if archivo is None or not archivo.filename:
        raise HorarioError("Falta el archivo (campo 'archivo').")
    bloques, errores_parser = leer_archivo_horarios(archivo.filename, archivo.read())
    errores = list(errores_parser)
    carrera = (request.form.get("carrera") or "").strip()
    resultado = validar_metadata(cur, carrera, request.form.get("anio_lectivo"),
                                 request.form.get("semestre_lectivo"), bloques, errores)
    return resultado


@horarios_bp.get("/horarios/plantilla.csv")
def descargar_csv():
    return Response(plantilla_csv(), mimetype="text/csv; charset=utf-8",
                    headers={"Content-Disposition": "attachment; filename=plantilla_horarios.csv"})


@horarios_bp.get("/horarios/plantilla.json")
def descargar_json():
    return Response(plantilla_json(), mimetype="application/json; charset=utf-8",
                    headers={"Content-Disposition": "attachment; filename=plantilla_horarios.json"})


@horarios_bp.get("/horarios/plantilla.xlsx")
def descargar_xlsx():
    return Response(plantilla_xlsx(), mimetype="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                    headers={"Content-Disposition": "attachment; filename=plantilla_horarios.xlsx"})


@horarios_bp.post("/horarios/preview")
def preview():
    conn = None
    try:
        conn = obtener_conexion()
        with conn.cursor() as cur:
            resultado = _analizar(cur)
        return jsonify(resultado), 200
    except HorarioError as error:
        return jsonify({"valido": False, "errores": [error.message], "avisos": [], "bloques": [],
                        "resumen": {"bloques": 0, "materias": 0, "grupos": 0}}), 400
    except HTTPException:
        raise
    except Exception:
        logger.exception("Error al analizar la importación de horarios")
        return jsonify({"error": "No se pudo analizar el archivo por un error interno."}), 500
    finally:
        if conn:
            conn.close()


@horarios_bp.post("/horarios/importar")
def importar():
    conn = None
    try:
        conn = obtener_conexion()
        with conn.cursor() as cur:
            resultado = _analizar(cur)
            if not resultado["valido"]:
                return jsonify({"error": "Hay errores en los horarios; corregilos y volve a analizar.", **resultado}), 422
            guardar_horarios(cur, resultado)
        conn.commit()
        return jsonify({"mensaje": "Horarios guardados correctamente.", **resultado}), 200
    except HorarioError as error:
        if conn:
            conn.rollback()
        return jsonify({"error": error.message}), 400
    except HTTPException:
        if conn:
            conn.rollback()
        raise
    except Exception:
        if conn:
            conn.rollback()
        logger.exception("Error al importar horarios")
        return jsonify({"error": "No se pudieron guardar los horarios por un error interno."}), 500
    finally:
        if conn:
            conn.close()


@horarios_bp.get("/horarios")
def consultar():
    carrera = (request.args.get("carrera") or "").strip()
    try:
        anio = int(request.args.get("anio_lectivo", ""))
        semestre = int(request.args.get("semestre_lectivo", ""))
        if not carrera:
            raise ValueError
        if not 1900 <= anio <= 9999 or semestre not in (1, 2):
            raise ValueError
    except ValueError:
        return jsonify({"error": "Indicá carrera, un año válido y semestre 1 o 2."}), 400
    conn = None
    try:
        conn = obtener_conexion()
        with conn.cursor() as cur:
            bloques = listar_horarios(cur, carrera, anio, semestre)
        return jsonify({"carrera": carrera, "anio_lectivo": anio, "semestre_lectivo": semestre, "bloques": bloques}), 200
    except Exception:
        logger.exception("Error al consultar horarios")
        return jsonify({"error": "No se pudieron cargar los horarios."}), 500
    finally:
        if conn:
            conn.close()
