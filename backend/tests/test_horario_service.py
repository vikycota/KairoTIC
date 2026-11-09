import unittest
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from horario_service import guardar_horarios, listar_horarios


class CursorFake:
    def __init__(self, rows=()):
        self.rows = list(rows)
        self.calls = []

    def execute(self, query, params):
        self.calls.append((query, params))

    def fetchall(self):
        return self.rows


class HorarioServiceTests(unittest.TestCase):
    def test_guardar_usa_solo_las_doce_columnas_del_esquema(self):
        cur = CursorFake()
        resultado = {
            "carrera": "Física",
            "anio_lectivo": 2027,
            "semestre_lectivo": 1,
            "bloques": [{
                "materia": "Física II",
                "anio_carrera": 2,
                "grupo": "A",
                "dia": "Lunes",
                "hora_inicio": "08:00",
                "hora_fin": "10:00",
                "docente": "Docente",
                "tipo": "Clase",
                "opcional": False,
            }],
        }

        guardar_horarios(cur, resultado)

        query, params = cur.calls[1]
        self.assertIn("INSERT INTO Horarios", query)
        self.assertNotIn("Fecha_Inicio", query)
        self.assertNotIn("Fecha_Fin", query)
        self.assertEqual(query.count("%s"), 12)
        self.assertEqual(len(params), 12)
        self.assertEqual(params, (
            "Física", "Física II", 2027, 1, 2, "A", "Lunes", "08:00", "10:00",
            "Docente", "Clase", False,
        ))

    def test_listar_devuelve_solo_los_nueve_campos_de_bloque(self):
        cur = CursorFake([(
            "Física II", 2, "A", "Lunes", "08:00", "10:00", "Docente", "Clase", False,
        )])

        bloques = listar_horarios(cur, "Física", 2027, 1)

        query, params = cur.calls[0]
        self.assertIn("SELECT Materia_Nombre, Anio_Carrera, Grupo, Dia, Hora_Inicio, Hora_Fin, Docente, Tipo, Opcional", query)
        self.assertNotIn("Fecha_Inicio", query)
        self.assertNotIn("Fecha_Fin", query)
        self.assertEqual(params, ("Física", 2027, 1))
        self.assertEqual(bloques, [{
            "materia": "Física II",
            "anio_carrera": 2,
            "grupo": "A",
            "dia": "Lunes",
            "hora_inicio": "08:00",
            "hora_fin": "10:00",
            "docente": "Docente",
            "tipo": "Clase",
            "opcional": False,
        }])


if __name__ == "__main__":
    unittest.main()
