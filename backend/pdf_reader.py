import fitz

def extraer_texto_pdf(archivo):
    documento = fitz.open(stream=archivo.read(), filetype="pdf")

    paginas = []

    for pagina in documento:
        texto = pagina.get_text("text")
        paginas.append(texto)

    documento.close()

    return "\n".join(paginas)