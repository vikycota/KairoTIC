import re
from decimal import Decimal

from flask import Blueprint, g, jsonify, request

from auth import requiere_login
from conexion import obtener_conexion
from validaciones import (
    ValidationError,
    detectar_intento_sql_injection,
    validar_longitud,
    validar_no_vacio,
)

costos_bp = Blueprint("costos", __name__)

MESES_POR_DEFECTO = 6
SEMESTRE_REGEX = re.compile(r"^\d{4}-[12]$")
MONTO_MAXIMO = Decimal("99999999.99")



# Validaciones


def _validar_monto(valor, nombre_campo):
    """Acepta números (no booleanos) >= 0 con hasta 2 decimales."""
    if isinstance(valor, bool) or not isinstance(valor, (int, float, str)):
        raise ValidationError(f"El campo '{nombre_campo}' debe ser un número.")
    try:
        monto = Decimal(str(valor).strip())
    except Exception:
        raise ValidationError(f"El campo '{nombre_campo}' debe ser un número.")
    if not monto.is_finite():
        raise ValidationError(f"El campo '{nombre_campo}' debe ser un número.")
    if monto < 0:
        raise ValidationError(f"El campo '{nombre_campo}' no puede ser negativo.")
    if monto > MONTO_MAXIMO:
        raise ValidationError(f"El campo '{nombre_campo}' es demasiado grande.")
    return monto.quantize(Decimal("0.01"))


def _validar_beca(valor):
    beca = _validar_monto(valor, "beca")
    if beca > 100:
        raise ValidationError("El campo 'beca' debe estar entre 0 y 100.")
    return beca


def _validar_semestre(valor):
    valor = validar_no_vacio(valor, "semestre")
    if not SEMESTRE_REGEX.match(valor):
        raise ValidationError("El campo 'semestre' debe tener formato AAAA-S (por ejemplo 2026-2).")
    return valor


def _validar_texto(valor, nombre_campo, maximo):
    valor = validar_no_vacio(valor, nombre_campo)
    valor = validar_longitud(valor, nombre_campo, minimo=2, maximo=maximo)
    detectar_intento_sql_injection(valor, nombre_campo)
    return valor


def _validar_meses(valor):
    if valor is None or valor == "":
        return MESES_POR_DEFECTO
    try:
        meses = int(valor)
    except (TypeError, ValueError):
        raise ValidationError("El campo 'meses' debe ser un número entero.")
    if not 1 <= meses <= 12:
        raise ValidationError("El campo 'meses' debe estar entre 1 y 12.")
    return meses


def _numero(valor):
    """Decimal de la base -> float para JSON (None se mantiene)."""
    return None if valor is None else float(valor)



# Presupuesto (SCRUM-11)


@costos_bp.route("/presupuesto", methods=["GET"])
@requiere_login
def obtener_presupuesto():
    conn = None
    try:
        conn = obtener_conexion()
        cur = conn.cursor()
        cur.execute(
            "SELECT Presupuesto_Mensual, Beca FROM Personas WHERE Email = %s",
            (g.email,),
        )
        fila = cur.fetchone()
        cur.close()
        if not fila:
            return jsonify({"error": "No existe la persona de la sesión."}), 404
        return jsonify({"presupuesto_mensual": _numero(fila[0]), "beca": _numero(fila[1])}), 200
    except Exception as e:
        print(f"Error al obtener presupuesto: {e}")
        return jsonify({"error": "Error interno del servidor."}), 500
    finally:
        if conn:
            conn.close()


@costos_bp.route("/presupuesto", methods=["PUT"])
@requiere_login
def guardar_presupuesto():
    """
    Body: {"presupuesto_mensual": 15000, "beca"?: 50, "costo_credito"?: 4200, "carrera"?: "..."}
    presupuesto_mensual null lo borra. costo_credito exige carrera (debe ser del usuario).
    """
    data = request.get_json(silent=True)
    if not isinstance(data, dict):
        return jsonify({"error": "Body inválido o faltante."}), 400
    if "presupuesto_mensual" not in data:
        return jsonify({"error": "El campo 'presupuesto_mensual' es obligatorio."}), 400

    try:
        presupuesto = (
            None if data["presupuesto_mensual"] is None
            else _validar_monto(data["presupuesto_mensual"], "presupuesto_mensual")
        )
        beca = _validar_beca(data["beca"]) if data.get("beca") is not None else None
        costo_credito = None
        carrera = None
        if data.get("costo_credito") is not None:
            costo_credito = _validar_monto(data["costo_credito"], "costo_credito")
            carrera = _validar_texto(data.get("carrera"), "carrera", 100)
    except ValidationError as e:
        return jsonify({"error": e.message}), 400

    conn = None
    try:
        conn = obtener_conexion()
        cur = conn.cursor()

        cur.execute(
            "UPDATE Personas SET Presupuesto_Mensual = %s, Beca = COALESCE(%s, Beca) WHERE Email = %s",
            (presupuesto, beca, g.email),
        )
        if cur.rowcount == 0:
            conn.rollback()
            cur.close()
            return jsonify({"error": "No existe la persona de la sesión."}), 404

        if costo_credito is not None:
            cur.execute(
                """UPDATE Carreras SET Valor_Credito = %s WHERE Nombre = %s
                AND EXISTS (SELECT 1 FROM Pertenecen_A pa WHERE pa.Carreras_Nombre = Carreras.Nombre AND pa.Email = %s)""",
                (costo_credito, carrera, g.email),
            )
            if cur.rowcount == 0:
                conn.rollback()
                cur.close()
                return jsonify({"error": "La carrera no existe."}), 404

        conn.commit()
        cur.close()
        return jsonify({"message": "Presupuesto guardado correctamente."}), 200
    except Exception as e:
        if conn:
            conn.rollback()
        print(f"Error al guardar presupuesto: {e}")
        return jsonify({"error": "Error interno del servidor."}), 500
    finally:
        if conn:
            conn.close()



# Gastos extra


@costos_bp.route("/gastos-extra", methods=["POST"])
@requiere_login
def agregar_gasto_extra():
    data = request.get_json(silent=True)
    if not isinstance(data, dict):
        return jsonify({"error": "Body inválido o faltante."}), 400

    try:
        semestre = _validar_semestre(data.get("semestre"))
        concepto = _validar_texto(data.get("concepto"), "concepto", 150)
        if "monto" not in data:
            raise ValidationError("El campo 'monto' es obligatorio.")
        monto = _validar_monto(data["monto"], "monto")
    except ValidationError as e:
        return jsonify({"error": e.message}), 400

    conn = None
    try:
        conn = obtener_conexion()
        cur = conn.cursor()
        cur.execute(
            """
            INSERT INTO Gastos_Extra (Email, Semestre, Concepto, Monto)
            VALUES (%s, %s, %s, %s)
            RETURNING Id
            """,
            (g.email, semestre, concepto, monto),
        )
        nuevo_id = cur.fetchone()[0]
        conn.commit()
        cur.close()
        return jsonify({"message": "Gasto agregado correctamente.", "id": nuevo_id}), 201
    except Exception as e:
        if conn:
            conn.rollback()
        print(f"Error al agregar gasto extra: {e}")
        return jsonify({"error": "Error interno del servidor."}), 500
    finally:
        if conn:
            conn.close()


@costos_bp.route("/gastos-extra", methods=["GET"])
@requiere_login
def listar_gastos_extra():
    try:
        semestre = _validar_semestre(request.args.get("semestre"))
    except ValidationError as e:
        return jsonify({"error": e.message}), 400

    conn = None
    try:
        conn = obtener_conexion()
        cur = conn.cursor()
        cur.execute(
            "SELECT Id, Concepto, Monto FROM Gastos_Extra WHERE Email = %s AND Semestre = %s ORDER BY Id",
            (g.email, semestre),
        )
        gastos = [{"id": f[0], "concepto": f[1], "monto": _numero(f[2])} for f in cur.fetchall()]
        cur.close()
        return jsonify({
            "semestre": semestre,
            "gastos": gastos,
            "total": round(sum(x["monto"] for x in gastos), 2),
        }), 200
    except Exception as e:
        print(f"Error al listar gastos extra: {e}")
        return jsonify({"error": "Error interno del servidor."}), 500
    finally:
        if conn:
            conn.close()


@costos_bp.route("/gastos-extra/<int:gasto_id>", methods=["DELETE"])
@requiere_login
def borrar_gasto_extra(gasto_id):
    conn = None
    try:
        conn = obtener_conexion()
        cur = conn.cursor()
        cur.execute("DELETE FROM Gastos_Extra WHERE Id = %s AND Email = %s", (gasto_id, g.email))
        borrados = cur.rowcount
        conn.commit()
        cur.close()
        if borrados == 0:
            return jsonify({"error": "No existe un gasto con ese id."}), 404
        return jsonify({"message": "Gasto eliminado correctamente."}), 200
    except Exception as e:
        if conn:
            conn.rollback()
        print(f"Error al borrar gasto extra: {e}")
        return jsonify({"error": "Error interno del servidor."}), 500
    finally:
        if conn:
            conn.close()



# Costo final por semestre (SCRUM-24)


@costos_bp.route("/costo-semestre", methods=["GET"])
@requiere_login
def costo_semestre():
    """
    costo_materias = créditos x valor del crédito x (1 - beca/100)
    costo_final    = costo_materias + gastos extra del semestre
    Se compara contra presupuesto_mensual x meses (6 por defecto).
    """
    try:
        carrera = _validar_texto(request.args.get("carrera"), "carrera", 100)
        semestre = _validar_semestre(request.args.get("semestre"))
        meses = _validar_meses(request.args.get("meses"))
        materias = []
        for materia in request.args.getlist("materias"):
            materia = _validar_texto(materia, "materias", 100)
            if materia not in materias:
                materias.append(materia)
        if not materias:
            raise ValidationError("Indicá al menos una materia en 'materias'.")
    except ValidationError as e:
        return jsonify({"error": e.message}), 400

    conn = None
    try:
        conn = obtener_conexion()
        cur = conn.cursor()

        cur.execute(
            """SELECT c.Valor_Credito FROM Carreras c
            JOIN Pertenecen_A pa ON pa.Carreras_Nombre = c.Nombre
            WHERE c.Nombre = %s AND pa.Email = %s""",
            (carrera, g.email),
        )
        fila = cur.fetchone()
        if not fila:
            cur.close()
            return jsonify({"error": "La carrera no existe."}), 404
        valor_credito = fila[0]

        cur.execute(
            """
            SELECT m.Nombre, m.Cantidad_de_Creditos
            FROM Materias m
            JOIN Tiene t ON t.Materias_Nombre = m.Nombre
            WHERE t.Carreras_Nombre = %s AND m.Nombre = ANY(%s)
            ORDER BY m.Nombre
            """,
            (carrera, materias),
        )
        encontradas = cur.fetchall()
        faltantes = sorted(set(materias) - {f[0] for f in encontradas})
        if faltantes:
            cur.close()
            return jsonify({"error": "Materias que no pertenecen a la carrera: " + ", ".join(faltantes)}), 400

        cur.execute("SELECT Beca, Presupuesto_Mensual FROM Personas WHERE Email = %s", (g.email,))
        beca, presupuesto_mensual = cur.fetchone()

        cur.execute(
            "SELECT COALESCE(SUM(Monto), 0) FROM Gastos_Extra WHERE Email = %s AND Semestre = %s",
            (g.email, semestre),
        )
        gastos_extra = cur.fetchone()[0]
        cur.close()

        creditos = sum(f[1] for f in encontradas)
        subtotal = Decimal(creditos) * valor_credito
        descuento = (subtotal * beca / Decimal(100)).quantize(Decimal("0.01"))
        costo_materias = subtotal - descuento
        costo_final = costo_materias + gastos_extra

        respuesta = {
            "carrera": carrera,
            "semestre": semestre,
            "materias": [{"nombre": f[0], "creditos": f[1]} for f in encontradas],
            "creditos": creditos,
            "valor_credito": _numero(valor_credito),
            "subtotal": _numero(subtotal),
            "beca": _numero(beca),
            "descuento_beca": _numero(descuento),
            "costo_materias": _numero(costo_materias),
            "gastos_extra": _numero(gastos_extra),
            "costo_final": _numero(costo_final),
            "meses": meses,
            "costo_mensual": _numero((costo_final / meses).quantize(Decimal("0.01"))),
            "presupuesto_mensual": _numero(presupuesto_mensual),
            "presupuesto_semestral": None,
            "diferencia": None,
            "dentro_del_presupuesto": None,
        }
        if presupuesto_mensual is not None:
            presupuesto_semestral = presupuesto_mensual * meses
            respuesta["presupuesto_semestral"] = _numero(presupuesto_semestral)
            respuesta["diferencia"] = _numero(presupuesto_semestral - costo_final)
            respuesta["dentro_del_presupuesto"] = costo_final <= presupuesto_semestral

        return jsonify(respuesta), 200
    except Exception as e:
        print(f"Error al calcular el costo del semestre: {e}")
        return jsonify({"error": "Error interno del servidor."}), 500
    finally:
        if conn:
            conn.close()
