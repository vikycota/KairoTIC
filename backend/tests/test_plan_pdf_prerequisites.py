import json
import sys
import unittest
from pathlib import Path
from unittest.mock import Mock, patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from ollama import (
    PLAN_JSON_SCHEMA,
    PlanPdfRespuestaInvalida,
    interpretar_plan_estudio,
    limpiar_respuesta_json,
)
from plan_parser import leer_json, validar_plan
from pdf_plan import normalizar_plan_pdf


CASES = (
    ("Ecuaciones Diferenciales", "M\u00e9todos Matem\u00e1ticos"),
    ("Mec\u00e1nica Cl\u00e1sica", "F\u00edsica Cu\u00e1ntica I"),
    ("Electromagnetismo", "Astrof\u00edsica"),
)


def sample_plan(previa, materia):
    return {
        "carrera": "Ingenieria de prueba",
        "materias": [
            {"semestre": 4, "nombre": previa, "creditos": 10,
             "categoria": None, "previas": []},
            {"semestre": 5, "nombre": materia, "creditos": 10,
             "categoria": None, "previas": [previa]},
        ],
    }


class PlanPdfPrerequisiteTests(unittest.TestCase):
    def test_ollama_prompt_treats_prerequisites_as_references(self):
        for previa, materia in CASES:
            with self.subTest(previa=previa):
                source = f"""Semestre 4
{previa} \u2014 10 cr\u00e9ditos

Semestre 5
{materia} \u2014 10 cr\u00e9ditos
Previa: {previa}"""
                expected = sample_plan(previa, materia)
                response = Mock()
                response.json.return_value = {
                    "message": {"content": json.dumps(expected, ensure_ascii=False)}
                }

                with patch("ollama.requests.post", return_value=response) as post:
                    result = interpretar_plan_estudio(source)

                prompt = post.call_args.kwargs["json"]["messages"][0]["content"]
                self.assertIn("Una previa/requisito/correlativa es solo una referencia", prompt)
                self.assertIn("cada objeto representa una entrada principal", prompt)
                self.assertIn('"previas": []', prompt)
                self.assertIn(source, prompt)
                self.assertEqual(result, expected)
                self.assertEqual(post.call_args.kwargs["json"]["format"], PLAN_JSON_SCHEMA)
                self.assertEqual(post.call_args.kwargs["json"]["options"]["num_predict"], 2048)
                self.assertEqual(len(result["materias"]), 2)
                self.assertEqual(result["materias"][1]["semestre"], 5)
                self.assertEqual(result["materias"][1]["previas"], [previa])

    def test_json_plan_parser_keeps_reference_out_of_materia_list(self):
        for previa, materia in CASES:
            with self.subTest(previa=previa):
                raw = leer_json(json.dumps(sample_plan(previa, materia), ensure_ascii=False).encode("utf-8"))
                result = validar_plan(raw)

                self.assertTrue(result["valido"], result["errores"])
                self.assertEqual(len(result["materias"]), 2)
                self.assertEqual([m["nombre"] for m in result["materias"]], [previa, materia])
                self.assertEqual(result["materias"][1]["previas"], [previa])
                self.assertEqual([m["semestre"] for m in result["materias"]], [4, 5])
                self.assertEqual([m["creditos"] for m in result["materias"]], [10, 10])
                self.assertEqual([m["categoria"] for m in result["materias"]], [None, None])
                self.assertEqual(result["resumen"]["total_previas"], 1)

    def test_response_normalization_keeps_flat_subjects_and_string_prerequisites(self):
        plan = normalizar_plan_pdf({
            "carrera": "Matematica",
            "materias": [
                {"semestre": 1, "nombre": "C\u00e1lculo I", "creditos": 10,
                 "categoria": "Matematica", "previas": ["NINGUNA"]},
                {"semestre": 2, "nombre": "C\u00e1lculo II", "creditos": 10,
                 "categoria": "Matematica", "previas": [{"nombre": "C\u00e1lculo I", "semestre": 1}]},
                {"semestre": 3, "nombre": "Ecuaciones Diferenciales", "creditos": 10,
                 "categoria": "Matematica", "previas": [{"previa_nombre": "C\u00e1lculo II"}]},
            ],
        })

        self.assertEqual(plan["materias"], [
            {"semestre": 1, "nombre": "C\u00e1lculo I", "creditos": 10,
             "categoria": "Matematica", "previas": []},
            {"semestre": 2, "nombre": "C\u00e1lculo II", "creditos": 10,
             "categoria": "Matematica", "previas": ["C\u00e1lculo I"]},
            {"semestre": 3, "nombre": "Ecuaciones Diferenciales", "creditos": 10,
             "categoria": "Matematica", "previas": ["C\u00e1lculo II"]},
        ])

    def test_legacy_nested_semesters_keep_their_numbers_and_missing_stays_none(self):
        plan = normalizar_plan_pdf({
            "semestres": [{
                "numero": 7,
                "materias": [{"nombre": "Materia A", "creditos": 10, "previas": []}],
            }]
        })
        self.assertEqual(plan["materias"][0]["semestre"], 7)
        self.assertIsNone(normalizar_plan_pdf({"materias": [{"nombre": "Sin semestre"}]})["materias"][0]["semestre"])

    def test_eight_subject_preview_totals_and_categories(self):
        entradas = [
            (1, "C\u00e1lculo I", "Matem\u00e1tica", []),
            (1, "F\u00edsica I", "F\u00edsica", []),
            (2, "C\u00e1lculo II", "Matem\u00e1tica", ["C\u00e1lculo I"]),
            (2, "F\u00edsica II", "F\u00edsica", ["F\u00edsica I"]),
            (3, "\u00c1lgebra Lineal", "Matem\u00e1tica", ["C\u00e1lculo I"]),
            (3, "Mec\u00e1nica Cl\u00e1sica", "F\u00edsica", ["F\u00edsica II"]),
            (4, "Ecuaciones Diferenciales", "Matem\u00e1tica", ["C\u00e1lculo II"]),
            (4, "Electromagnetismo", "F\u00edsica", ["F\u00edsica II"]),
        ]
        raw = {"carrera": "F\u00edsica", "materias": [
            {"semestre": semestre, "nombre": nombre, "creditos": 10,
             "category": categoria, "previas": previas}
            for semestre, nombre, categoria, previas in entradas
        ]}
        raw["materias"][0]["categor\u00eda"] = raw["materias"][0].pop("category")

        response = Mock()
        response.json.return_value = {
            "message": {"content": json.dumps(raw, ensure_ascii=False)}
        }
        with patch("ollama.requests.post", return_value=response):
            plan = interpretar_plan_estudio("PDF de prueba con ocho materias")
        materias = plan["materias"]

        self.assertEqual(len(materias), 8)
        self.assertEqual(sum(m["creditos"] for m in materias), 80)
        self.assertEqual(len({m["semestre"] for m in materias}), 4)
        self.assertEqual(sum(bool(m["previas"]) for m in materias), 6)
        self.assertEqual({m["categoria"] for m in materias}, {"Matem\u00e1tica", "F\u00edsica"})

    def test_self_prerequisite_is_removed_with_warning(self):
        with self.assertLogs("pdf_plan", level="WARNING") as logs:
            plan = normalizar_plan_pdf({"materias": [{
                "semestre": 2,
                "nombre": "C\u00e1lculo II",
                "creditos": 10,
                "categoria": "Matem\u00e1tica",
                "previas": [{"nombre": "  calculo   ii "}],
            }]})

        self.assertEqual(plan["materias"][0]["previas"], [])
        self.assertIn("autorreferente", logs.output[0])

    def test_removes_only_outer_markdown_fences(self):
        self.assertEqual(limpiar_respuesta_json('```json\n{"materias": []}\n```'), '{"materias": []}')
        self.assertEqual(limpiar_respuesta_json("{'materias': []}"), "{'materias': []}")

    def test_invalid_json_becomes_a_controlled_plan_error(self):
        response = Mock()
        response.json.return_value = {"message": {"content": '{"materias": [}'}}
        with patch("ollama.requests.post", return_value=response):
            with self.assertLogs("ollama", level="WARNING"):
                with self.assertRaises(PlanPdfRespuestaInvalida):
                    interpretar_plan_estudio("Plan no estructurado")

    def test_schema_rejection_retries_with_json_mode(self):
        rechazada = Mock(status_code=400)
        respuesta = Mock(status_code=200)
        respuesta.json.return_value = {
            "message": {"content": json.dumps(sample_plan("Materia A", "Materia B"))}
        }
        with patch("ollama.requests.post", side_effect=[rechazada, respuesta]) as post:
            plan = interpretar_plan_estudio("Plan no estructurado")

        self.assertEqual(len(plan["materias"]), 2)
        self.assertEqual(post.call_args_list[0].kwargs["json"]["format"], PLAN_JSON_SCHEMA)
        self.assertEqual(post.call_args_list[1].kwargs["json"]["format"], "json")


if __name__ == "__main__":
    unittest.main()

