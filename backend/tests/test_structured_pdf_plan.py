import io
import sys
import unittest
from pathlib import Path
from unittest.mock import patch

import fitz

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from ollama import interpretar_plan_estudio
from pdf_reader import extraer_texto_pdf


REGISTROS = (
    (1, 1, "C\u00e1lculo I", 10, "Matem\u00e1tica", "NINGUNA"),
    (2, 1, "F\u00edsica I", 10, "F\u00edsica", "NINGUNA"),
    (3, 2, "\u00c1lgebra Lineal", 10, "Matem\u00e1tica", "C\u00e1lculo I"),
    (4, 2, "F\u00edsica II", 10, "F\u00edsica", "F\u00edsica I"),
    (5, 3, "M\u00e9todos Matem\u00e1ticos", 10, "Matem\u00e1tica", "\u00c1lgebra Lineal"),
    (6, 3, "Mec\u00e1nica Cl\u00e1sica", 10, "F\u00edsica", "F\u00edsica II"),
)


def texto_de_registros():
    bloques = []
    for indice, semestre, materia, creditos, categoria, previa in REGISTROS:
        bloques.append(
            f"REGISTRO {indice}\n"
            f"Semestre: {semestre}\n"
            f"Materia: {materia}\n"
            f"Creditos: {creditos}\n"
            f"Categoria: {categoria}\n"
            f"Previa: {previa}\n"
            f"FIN REGISTRO {indice}"
        )
    return "\n\n".join(bloques)


class StructuredPdfPlanTests(unittest.TestCase):
    def test_sectioned_text_returns_exactly_three_primary_subjects(self):
        texto = (
            "SEMESTRE 1\n"
            "Materia: C\u00e1lculo I\n"
            "Cr\u00e9ditos: 10\n"
            "Categor\u00eda: Matem\u00e1tica\n"
            "Previa: Ninguna\n\n"
            "SEMESTRE 2\n"
            "Materia: C\u00e1lculo II\n"
            "Cr\u00e9ditos: 10\n"
            "Categor\u00eda: Matem\u00e1tica\n"
            "Previa: C\u00e1lculo I\n\n"
            "SEMESTRE 3\n"
            "Materia: Ecuaciones Diferenciales\n"
            "Cr\u00e9ditos: 10\n"
            "Categor\u00eda: Matem\u00e1tica\n"
            "Previa: C\u00e1lculo II"
        )

        with patch("ollama.requests.post") as llamar_ollama:
            plan = interpretar_plan_estudio(texto)

        llamar_ollama.assert_not_called()
        self.assertEqual(plan["materias"], [
            {"semestre": 1, "nombre": "C\u00e1lculo I", "creditos": 10,
             "categoria": "Matem\u00e1tica", "previas": []},
            {"semestre": 2, "nombre": "C\u00e1lculo II", "creditos": 10,
             "categoria": "Matem\u00e1tica", "previas": ["C\u00e1lculo I"]},
            {"semestre": 3, "nombre": "Ecuaciones Diferenciales", "creditos": 10,
             "categoria": "Matem\u00e1tica", "previas": ["C\u00e1lculo II"]},
        ])

    def test_one_page_pdf_extracts_and_previews_all_six_materias(self):
        documento = fitz.open()
        pagina = documento.new_page()
        pagina.insert_textbox(fitz.Rect(36, 36, 560, 800), texto_de_registros(), fontsize=10)
        archivo_pdf = io.BytesIO(documento.tobytes())
        documento.close()

        texto_pdf = extraer_texto_pdf(archivo_pdf)
        for indice in range(1, 7):
            self.assertRegex(texto_pdf, rf"(?m)^REGISTRO {indice}$")

        with patch("ollama.requests.post") as llamar_ollama:
            plan = interpretar_plan_estudio(texto_pdf)

        llamar_ollama.assert_not_called()
        materias = plan["materias"]
        self.assertEqual(len(materias), 6)
        self.assertEqual(sum(m["creditos"] for m in materias), 60)
        self.assertEqual(len({m["semestre"] for m in materias}), 3)
        self.assertEqual(sum(bool(m["previas"]) for m in materias), 4)
        self.assertEqual(
            [m["nombre"] for m in materias],
            [registro[2] for registro in REGISTROS],
        )
        self.assertEqual(materias[2]["previas"], ["C\u00e1lculo I"])
        self.assertEqual(materias[4]["previas"], ["\u00c1lgebra Lineal"])


if __name__ == "__main__":
    unittest.main()
