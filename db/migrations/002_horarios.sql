-- Crear la tabla de horarios en una base existente.
--   docker exec -i kairo_db sh -c 'psql -U "$(cat /run/secrets/db_user)" -d "$(cat /run/secrets/db_name)"' < db/migrations/002_horarios.sql
BEGIN;

CREATE TABLE IF NOT EXISTS Horarios (
    Id                  SERIAL          PRIMARY KEY,
    Carrera_Nombre      VARCHAR(100)    NOT NULL,
    Materia_Nombre      VARCHAR(100)    NOT NULL,
    Anio_Lectivo        INTEGER         NOT NULL CHECK (Anio_Lectivo BETWEEN 1900 AND 9999),
    Semestre_Lectivo    INTEGER         NOT NULL CHECK (Semestre_Lectivo IN (1, 2)),
    Anio_Carrera        INTEGER         NULL CHECK (Anio_Carrera IS NULL OR Anio_Carrera > 0),
    Grupo               VARCHAR(50)     NOT NULL DEFAULT 'General',
    Dia                 VARCHAR(10)     NOT NULL CHECK (Dia IN ('Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado')),
    Hora_Inicio         TIME            NOT NULL,
    Hora_Fin            TIME            NOT NULL,
    Docente             VARCHAR(250)    NULL,
    Tipo                VARCHAR(50)     NOT NULL DEFAULT 'Clase',
    Opcional            BOOLEAN         NOT NULL DEFAULT FALSE,
    CONSTRAINT chk_horarios_rango CHECK (Hora_Fin > Hora_Inicio),
    CONSTRAINT fk_horarios_tiene FOREIGN KEY (Carrera_Nombre, Materia_Nombre)
        REFERENCES Tiene (Carreras_Nombre, Materias_Nombre)
        ON UPDATE CASCADE ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_horarios_periodo
    ON Horarios (Carrera_Nombre, Anio_Lectivo, Semestre_Lectivo);
CREATE UNIQUE INDEX IF NOT EXISTS uq_horarios_bloque
    ON Horarios (Carrera_Nombre, Materia_Nombre, Anio_Lectivo, Semestre_Lectivo,
                 COALESCE(Anio_Carrera, 0), Grupo, Dia, Hora_Inicio, Hora_Fin,
                 COALESCE(Docente, ''), Tipo, Opcional);

COMMIT;
