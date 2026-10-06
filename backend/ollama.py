import json
import os
import requests


OLLAMA_URL = os.environ.get(
    "OLLAMA_URL",
    "http://host.docker.internal:11434"
)

OLLAMA_MODEL = os.environ.get(
    "OLLAMA_MODEL",
    "llama3.2:3b"
)


def interpretar_plan_estudio(texto):

    prompt = f"""
Analiza el siguiente plan de estudios universitario.

Extrae únicamente información que realmente aparezca en el documento.

Devuelve JSON con exactamente esta estructura:

{{
  "carrera": "",
  "semestres": [
    {{
      "numero": 1,
      "materias": [
        {{
          "codigo": "",
          "nombre": "",
          "creditos": 0,
          "categoria": ""
        }}
      ]
    }}
  ]
}}

Reglas:

- No inventes materias.
- No inventes créditos.
- Si no aparece una categoría, usa null.
- Si no se puede determinar la carrera, usa null.
- El número de semestre debe ser numérico.
- Los créditos deben ser numéricos.
- No agregues explicaciones fuera del JSON.
- "codigo" debe contener el código de la materia, por ejemplo "MAT101".
- "nombre" debe contener el nombre completo de la materia.
- No confundas el código con el nombre.
- Si el documento no contiene código para una materia, usa null.

DOCUMENTO:

{texto}
"""

    response = requests.post(
        f"{OLLAMA_URL}/api/chat",
        json={
            "model": OLLAMA_MODEL,
            "stream": False,
            "format": "json",
            "messages": [
                {
                    "role": "user",
                    "content": prompt
                }
            ]
        },
        timeout=600
    )

    response.raise_for_status()

    resultado = response.json()

    contenido = resultado["message"]["content"]

    return json.loads(contenido)