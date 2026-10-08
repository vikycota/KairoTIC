from flask import Blueprint, Response, jsonify, request
from werkzeug.exceptions import HTTPException

from conexion import obtener_conexion
from plan_parser import (
    PlanError,
    leer_archivo,
    plantilla_csv,
    plantilla_json,
    validar_plan,
)


plan_bp = Blueprint("plan", __name__)


# ============================================================
# CONSTANTES
# ============================================================

SEMESTRE_1 = "Semestre 1"
SEMESTRE_2 = "Semestre 2"


# ============================================================
# CONVERSIÓN DE SEMESTRES
# ============================================================

def periodo_desde_numero(numero):
    """
    Convierte un semestre global 1..10 a la estructura
    utilizada por PostgreSQL.

    Ejemplos:
        1  -> ("Semestre 1", 1)
        2  -> ("Semestre 2", 1)
        3  -> ("Semestre 1", 2)
        4  -> ("Semestre 2", 2)
        ...
        10 -> ("Semestre 2", 5)
    """

    if numero is None:
        return None, None

    numero = int(numero)

    if numero < 1 or numero > 10:
        raise ValueError(
            f"El semestre debe estar entre 1 y 10. Recibido: {numero}"
        )

    nombre = (
        SEMESTRE_1
        if numero % 2 == 1
        else SEMESTRE_2
    )

    anio = (numero + 1) // 2

    return nombre, anio


def numero_desde_periodo(nombre, anio):
    """
    Convierte la estructura de PostgreSQL a semestre global.

    Ejemplos:
        ("Semestre 1", 1) -> 1
        ("Semestre 2", 1) -> 2
        ("Semestre 1", 2) -> 3
    """

    if not nombre or not anio:
        return None

    posicion = (
        1
        if nombre == SEMESTRE_1
        else 2
    )

    return ((int(anio) - 1) * 2) + posicion


# ============================================================
# CONSULTAS AUXILIARES
# ============================================================

def materias_existentes(cur):
    """
    Devuelve las materias existentes de la BD como:

        {
            "Programación I": 6,
            "Álgebra": 10
        }
    """

    cur.execute(
        """
        SELECT
            Nombre,
            Cantidad_de_Creditos
        FROM Materias
        """
    )

    return {
        nombre: creditos
        for nombre, creditos in cur.fetchall()
    }


def semestres_existentes(cur):
    """
    Devuelve en qué semestres está cada materia.

    Ejemplo:

        {
            "Programación I": {1},
            "Base de Datos": {3}
        }
    """

    cur.execute(
        """
        SELECT
            Materias_Nombre,
            Semestres_Nombre,
            Semestres_Anio
        FROM Se_Organiza_En
        """
    )

    resultado = {}

    for materia, nombre, anio in cur.fetchall():

        numero = numero_desde_periodo(
            nombre,
            anio
        )

        resultado.setdefault(
            materia,
            set()
        ).add(numero)

    return resultado


# ============================================================
# PROCESAMIENTO DEL ARCHIVO SUBIDO
# ============================================================

def procesar_subida(cur):
    """
    Lee el archivo enviado mediante multipart/form-data.

    El campo esperado es:

        archivo

    Devuelve:

        (resultado, None)

    o:

        (None, (respuesta_json, codigo_http))
    """

    archivo = request.files.get("archivo")

    if archivo is None or not archivo.filename:

        return None, (
            jsonify({
                "error": "Falta el archivo (campo 'archivo')."
            }),
            400
        )

    contenido = archivo.read()

    if not contenido:

        return None, (
            jsonify({
                "error": "El archivo está vacío."
            }),
            400
        )

    try:

        raw = leer_archivo(
            archivo.filename,
            contenido
        )

    except PlanError as error:

        return None, (
            jsonify({
                "error": error.message
            }),
            400
        )

    carrera = (
        request.form.get("carrera") or ""
    ).strip() or None

    resultado = validar_plan(
        raw,
        carrera=carrera,
        existentes=materias_existentes(cur),
        semestres_existentes=semestres_existentes(cur),
    )

    return resultado, None


# ============================================================
# PERSISTENCIA - CARRERA
# ============================================================

def guardar_carrera(
    cur,
    carrera,
    valor_credito
):
    """
    Crea la carrera si no existe.

    Si el archivo trae valor_credito,
    también lo actualiza.
    """

    if valor_credito is not None:

        cur.execute(
            """
            INSERT INTO Carreras (
                Nombre,
                Valor_Credito
            )
            VALUES (%s, %s)

            ON CONFLICT (Nombre)
            DO UPDATE SET
                Valor_Credito =
                    EXCLUDED.Valor_Credito
            """,
            (
                carrera,
                valor_credito
            ),
        )

        return

    cur.execute(
        """
        INSERT INTO Carreras (
            Nombre,
            Valor_Credito
        )
        VALUES (%s, 0)

        ON CONFLICT (Nombre)
        DO NOTHING
        """,
        (carrera,),
    )


# ============================================================
# PERSISTENCIA - MATERIAS
# ============================================================

def guardar_materia(
    cur,
    materia
):
    """
    Inserta o actualiza una materia.

    Código y categoría son opcionales.
    """

    nombre = materia["nombre"]

    creditos = int(
        materia["creditos"]
    )

    codigo = (
        materia.get("codigo")
        or None
    )

    categoria = (
        materia.get("categoria")
        or None
    )

    cur.execute(
        """
        INSERT INTO Materias (
            Nombre,
            Codigo,
            Cantidad_de_Creditos,
            Categoria
        )
        VALUES (%s, %s, %s, %s)

        ON CONFLICT (Nombre)
        DO UPDATE SET

            Codigo =
                EXCLUDED.Codigo,

            Cantidad_de_Creditos =
                EXCLUDED.Cantidad_de_Creditos,

            Categoria =
                EXCLUDED.Categoria
        """,
        (
            nombre,
            codigo,
            creditos,
            categoria,
        ),
    )


def relacionar_materia_con_carrera(
    cur,
    carrera,
    nombre_materia
):
    """
    Registra que una materia pertenece
    a una determinada carrera.
    """

    cur.execute(
        """
        INSERT INTO Tiene (
            Carreras_Nombre,
            Materias_Nombre
        )
        VALUES (%s, %s)

        ON CONFLICT (
            Carreras_Nombre,
            Materias_Nombre
        )
        DO NOTHING
        """,
        (
            carrera,
            nombre_materia
        ),
    )


def guardar_materias_carrera(
    cur,
    carrera,
    materias
):
    """
    Reemplaza las relaciones Carrera -> Materia
    del plan y actualiza las materias.
    """

    cur.execute(
        """
        DELETE FROM Tiene
        WHERE Carreras_Nombre = %s
        """,
        (carrera,),
    )

    for materia in materias:

        guardar_materia(
            cur,
            materia
        )

        relacionar_materia_con_carrera(
            cur,
            carrera,
            materia["nombre"]
        )


# ============================================================
# PERSISTENCIA - SEMESTRES
# ============================================================

def calcular_creditos_por_semestre(
    materias
):
    """
    Devuelve:

        {
            1: 32,
            2: 30,
            ...
        }
    """

    resultado = {}

    for materia in materias:

        semestre = materia.get(
            "semestre"
        )

        if semestre is None:
            continue

        semestre = int(semestre)

        creditos = int(
            materia["creditos"]
        )

        resultado[semestre] = (
            resultado.get(
                semestre,
                0
            )
            + creditos
        )

    return resultado


def guardar_semestre(
    cur,
    numero,
    creditos
):
    """
    Crea o actualiza un semestre en PostgreSQL.
    """

    nombre, anio = periodo_desde_numero(
        numero
    )

    cur.execute(
        """
        INSERT INTO Semestres (
            Nombre,
            Anio,
            Cantidad_de_Creditos
        )
        VALUES (%s, %s, %s)

        ON CONFLICT (
            Nombre,
            Anio
        )
        DO UPDATE SET

            Cantidad_de_Creditos =
                EXCLUDED.Cantidad_de_Creditos
        """,
        (
            nombre,
            anio,
            creditos
        ),
    )


def relacionar_materia_con_semestre(
    cur,
    materia
):
    """
    Registra en Se_Organiza_En
    el semestre de una materia.
    """

    semestre = materia.get(
        "semestre"
    )

    if semestre is None:
        return

    nombre_semestre, anio = (
        periodo_desde_numero(
            semestre
        )
    )

    cur.execute(
        """
        INSERT INTO Se_Organiza_En (
            Semestres_Nombre,
            Semestres_Anio,
            Materias_Nombre
        )
        VALUES (%s, %s, %s)

        ON CONFLICT (
            Semestres_Nombre,
            Semestres_Anio,
            Materias_Nombre
        )
        DO NOTHING
        """,
        (
            nombre_semestre,
            anio,
            materia["nombre"],
        ),
    )


def guardar_organizacion_semestres(
    cur,
    materias
):
    """
    Actualiza la ubicación de las materias
    dentro de los semestres.
    """

    nombres = [
        materia["nombre"]
        for materia in materias
    ]

    if nombres:

        cur.execute(
            """
            DELETE FROM Se_Organiza_En
            WHERE Materias_Nombre = ANY(%s)
            """,
            (nombres,),
        )

    creditos_por_semestre = (
        calcular_creditos_por_semestre(
            materias
        )
    )

    for numero, creditos in (
        creditos_por_semestre.items()
    ):

        guardar_semestre(
            cur,
            numero,
            creditos
        )

    for materia in materias:

        relacionar_materia_con_semestre(
            cur,
            materia
        )


# ============================================================
# PERSISTENCIA - PREVIAS
# ============================================================

def guardar_previas(
    cur,
    materias
):
    """
    El modelo actual de PostgreSQL admite
    UNA previa por materia mediante:

        Materia_Previa_Nombre

    Si el archivo contiene más de una previa,
    se guarda solamente la primera.

    Devuelve:

        total_previas,
        avisos
    """

    total_previas = 0

    avisos = []

    for materia in materias:

        previas = (
            materia.get("previas")
            or []
        )

        previa = (
            previas[0]
            if previas
            else None
        )

        if len(previas) > 1:

            avisos.append(
                (
                    f"{materia['nombre']} tiene "
                    f"{len(previas)} previas, pero "
                    "la base actual solo permite "
                    "guardar una. Se guardó la primera."
                )
            )

        cur.execute(
            """
            UPDATE Materias

            SET Materia_Previa_Nombre = %s

            WHERE Nombre = %s
            """,
            (
                previa,
                materia["nombre"]
            ),
        )

        if previa:
            total_previas += 1

    return (
        total_previas,
        avisos
    )


# ============================================================
# PLANTILLAS
# ============================================================

@plan_bp.route(
    "/plan/plantilla.csv",
    methods=["GET"]
)
def descargar_plantilla_csv():

    return Response(
        plantilla_csv(),
        mimetype="text/csv",
        headers={
            "Content-Disposition":
                "attachment; "
                "filename=plantilla_plan_estudio.csv"
        },
    )


@plan_bp.route(
    "/plan/plantilla.json",
    methods=["GET"]
)
def descargar_plantilla_json():

    return Response(
        plantilla_json(),
        mimetype="application/json",
        headers={
            "Content-Disposition":
                "attachment; "
                "filename=plantilla_plan_estudio.json"
        },
    )


# ============================================================
# PREVIEW
# ============================================================

@plan_bp.route(
    "/plan/preview",
    methods=["POST"]
)
def preview():

    conn = None

    try:

        conn = obtener_conexion()

        with conn.cursor() as cur:

            resultado, error = (
                procesar_subida(cur)
            )

        if error:
            return error

        return jsonify(
            resultado
        ), 200

    except HTTPException:
        raise

    except Exception as error:

        print(
            "Error en la vista previa "
            f"del plan: {error}"
        )

        return jsonify({
            "error":
                "Error interno del servidor."
        }), 500

    finally:

        if conn:
            conn.close()


# ============================================================
# IMPORTACIÓN
# ============================================================

@plan_bp.route(
    "/plan/importar",
    methods=["POST"]
)
def importar():

    conn = None

    try:

        conn = obtener_conexion()

        with conn.cursor() as cur:

            resultado, error = (
                procesar_subida(cur)
            )

            if error:
                return error

            if not resultado["valido"]:

                return jsonify({
                    "error":
                        "El plan tiene errores; "
                        "corregilos y volvé a subirlo.",

                    **resultado

                }), 422


            carrera = resultado["carrera"]

            materias = resultado["materias"]

            valor_credito = resultado.get(
                "valor_credito"
            )


            # ----------------------------------------
            # Carrera
            # ----------------------------------------

            guardar_carrera(
                cur,
                carrera,
                valor_credito
            )


            # ----------------------------------------
            # Materias
            # ----------------------------------------

            guardar_materias_carrera(
                cur,
                carrera,
                materias
            )


            # ----------------------------------------
            # Semestres
            # ----------------------------------------

            guardar_organizacion_semestres(
                cur,
                materias
            )


            # ----------------------------------------
            # Previas
            # ----------------------------------------

            (
                total_previas,
                avisos_previas

            ) = guardar_previas(
                cur,
                materias
            )


        conn.commit()


        avisos = list(
            resultado.get("avisos")
            or []
        )

        avisos.extend(
            avisos_previas
        )


        return jsonify({

            "message":
                "Plan importado correctamente.",

            "carrera":
                carrera,

            "resumen": {
                **resultado["resumen"],
                "previas": total_previas
            },

            "avisos":
                avisos,

        }), 201


    except HTTPException:

        if conn:
            conn.rollback()

        raise


    except Exception as error:

        if conn:
            conn.rollback()

        print(
            f"Error al importar el plan: {error}"
        )

        return jsonify({
            "error": str(error)
        }), 500


    finally:

        if conn:
            conn.close()


# ============================================================
# LISTAR CARRERAS
# ============================================================

@plan_bp.route(
    "/carreras",
    methods=["GET"]
)
def listar_carreras():

    conn = None

    try:

        conn = obtener_conexion()

        with conn.cursor() as cur:

            cur.execute(
                """
                SELECT
                    c.Nombre,
                    c.Valor_Credito,

                    COUNT(
                        t.Materias_Nombre
                    ),

                    COALESCE(
                        SUM(
                            m.Cantidad_de_Creditos
                        ),
                        0
                    )

                FROM Carreras c

                LEFT JOIN Tiene t
                    ON t.Carreras_Nombre =
                       c.Nombre

                LEFT JOIN Materias m
                    ON m.Nombre =
                       t.Materias_Nombre

                GROUP BY
                    c.Nombre,
                    c.Valor_Credito

                HAVING
                    COUNT(
                        t.Materias_Nombre
                    ) > 0

                ORDER BY
                    c.Nombre
                """
            )

            filas = cur.fetchall()


        carreras = [

            {
                "nombre": nombre,

                "valor_credito":
                    float(valor),

                "materias":
                    int(cantidad),

                "creditos":
                    int(creditos),
            }

            for (
                nombre,
                valor,
                cantidad,
                creditos
            ) in filas
        ]


        return jsonify({
            "carreras": carreras
        }), 200


    except Exception as error:

        print(
            f"Error al listar carreras: {error}"
        )

        return jsonify({
            "error": str(error)
        }), 500


    finally:

        if conn:
            conn.close()


# ============================================================
# LEER PLAN
# ============================================================

@plan_bp.route(
    "/plan",
    methods=["GET"]
)
def obtener_plan():

    carrera = (
        request.args.get("carrera")
        or ""
    ).strip()

    if not carrera:

        return jsonify({
            "error":
                "Falta el parámetro 'carrera'."
        }), 400


    conn = None

    try:

        conn = obtener_conexion()

        with conn.cursor() as cur:

            # ----------------------------------------
            # Carrera
            # ----------------------------------------

            cur.execute(
                """
                SELECT Valor_Credito

                FROM Carreras

                WHERE Nombre = %s
                """,
                (carrera,),
            )

            fila_carrera = cur.fetchone()

            if not fila_carrera:

                return jsonify({
                    "error":
                        "La carrera no existe."
                }), 404


            valor_credito = float(
                fila_carrera[0]
            )


            # ----------------------------------------
            # Materias
            # ----------------------------------------

            cur.execute(
                """
                SELECT

                    m.Codigo,

                    m.Nombre,

                    m.Cantidad_de_Creditos,

                    m.Categoria,

                    m.Materia_Previa_Nombre,

                    s.Nombre,

                    s.Anio

                FROM Tiene t

                JOIN Materias m

                    ON m.Nombre =
                       t.Materias_Nombre


                LEFT JOIN Se_Organiza_En so

                    ON so.Materias_Nombre =
                       m.Nombre


                LEFT JOIN Semestres s

                    ON s.Nombre =
                       so.Semestres_Nombre

                    AND s.Anio =
                        so.Semestres_Anio


                WHERE
                    t.Carreras_Nombre = %s


                ORDER BY

                    s.Anio NULLS LAST,

                    CASE

                        WHEN s.Nombre =
                             'Semestre 1'
                            THEN 1

                        WHEN s.Nombre =
                             'Semestre 2'
                            THEN 2

                        ELSE 3

                    END,

                    m.Nombre
                """,
                (carrera,),
            )


            filas = cur.fetchall()


        materias = []


        for (
            codigo,
            nombre,
            creditos,
            categoria,
            previa,
            semestre_nombre,
            semestre_anio

        ) in filas:

            numero_semestre = (
                numero_desde_periodo(
                    semestre_nombre,
                    semestre_anio
                )
            )

            materias.append({

                "codigo":
                    codigo,

                "nombre":
                    nombre,

                "creditos":
                    int(creditos),

                "categoria":
                    categoria,

                "semestre":
                    numero_semestre,

                "previas":
                    (
                        [previa]
                        if previa
                        else []
                    ),
            })


        return jsonify({

            "carrera":
                carrera,

            "valor_credito":
                valor_credito,

            "materias":
                materias,

        }), 200


    except Exception as error:

        print(
            f"Error al leer el plan: {error}"
        )

        return jsonify({
            "error": str(error)
        }), 500


    finally:

        if conn:
            conn.close()