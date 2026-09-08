FROM python:3.12-alpine
WORKDIR /app
RUN echo 'from http.server import HTTPServer, BaseHTTPRequestHandler\n\
class Handler(BaseHTTPRequestHandler):\n\
    def do_GET(self):\n\
        self.send_response(200)\n\
        self.end_headers()\n\
        self.wfile.write(b"OK backend")\n\
HTTPServer(("0.0.0.0", 3000), Handler).serve_forever()' > server.py
EXPOSE 3000
CMD ["python", "server.py"]