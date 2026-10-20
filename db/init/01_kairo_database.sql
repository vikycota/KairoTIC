CREATE TABLE Personas (
    Email        VARCHAR(150)    NOT NULL,
    Nombre       VARCHAR(100)    NOT NULL,
    Apellido     VARCHAR(100)    NOT NULL,
    Contrasena   VARCHAR(255)    NOT NULL,
    Beca         NUMERIC(5,2)    NOT NULL DEFAULT 0,
    CONSTRAINT pk_personas PRIMARY KEY (Email),
    CONSTRAINT chk_beca_rango CHECK (Beca BETWEEN 0 AND 100)
);

CREATE TABLE Carreras (
    Nombre                    VARCHAR(100)    NOT NULL,
    Valor_Credito             NUMERIC(10,2)   NOT NULL,
    Nota_Minima_Aprobacion    NUMERIC(4,2)    NOT NULL DEFAULT 6.00,
    Propietario     VARCHAR(150)    NULL,
    CONSTRAINT pk_carreras PRIMARY KEY (Nombre),
    CONSTRAINT fk_carreras_propietario
        FOREIGN KEY (Propietario)
        REFERENCES Personas (Email)
        ON UPDATE CASCADE
        ON DELETE CASCADE
);

CREATE TABLE Semestres (
    Nombre               VARCHAR(50)  NOT NULL,
    Anio                 INT          NOT NULL,
    Cantidad_de_Creditos INT          NOT NULL,
    CONSTRAINT pk_semestres PRIMARY KEY (Nombre, Anio),
    CONSTRAINT chk_semestre_valido CHECK (Nombre IN ('Semestre 1', 'Semestre 2')),
    CONSTRAINT chk_anio_valido CHECK (Anio BETWEEN 1 AND 5)
);

CREATE TABLE Materias (
    Nombre                  VARCHAR(100)    NOT NULL,
    Cantidad_de_Creditos    INT             NOT NULL,
    Categoria               VARCHAR(100)    NULL,
    CONSTRAINT pk_materias PRIMARY KEY (Nombre)
);

-- Una materia puede tener varias previas.
CREATE TABLE Previas (
    Materias_Nombre   VARCHAR(100)  NOT NULL,
    Previa_Nombre     VARCHAR(100)  NOT NULL,
    CONSTRAINT pk_previas PRIMARY KEY (Materias_Nombre, Previa_Nombre),
    CONSTRAINT chk_previa_distinta CHECK (Materias_Nombre <> Previa_Nombre),
    CONSTRAINT fk_previas_materia
        FOREIGN KEY (Materias_Nombre)
        REFERENCES Materias (Nombre)
        ON UPDATE CASCADE
        ON DELETE CASCADE,
    CONSTRAINT fk_previas_previa
        FOREIGN KEY (Previa_Nombre)
        REFERENCES Materias (Nombre)
        ON UPDATE CASCADE
        ON DELETE CASCADE
);

CREATE TABLE Examenes (
    Fecha            DATE            NOT NULL,
    Materias_Nombre  VARCHAR(100)    NOT NULL,
    CONSTRAINT pk_examenes PRIMARY KEY (Fecha, Materias_Nombre),
    CONSTRAINT fk_examenes_materia
        FOREIGN KEY (Materias_Nombre)
        REFERENCES Materias (Nombre)
        ON UPDATE CASCADE
        ON DELETE CASCADE
);


CREATE TABLE Pertenecen_A (
    Email               VARCHAR(150)    NOT NULL,
    Carreras_Nombre     VARCHAR(100)    NOT NULL,
    Fecha_Inscripcion   DATE            NOT NULL,
    Fecha_Finalizacion  DATE            NULL,
    CONSTRAINT pk_pertenecen_a PRIMARY KEY (Email, Carreras_Nombre),
    CONSTRAINT fk_pertenecen_a_persona
        FOREIGN KEY (Email)
        REFERENCES Personas (Email)
        ON UPDATE CASCADE
        ON DELETE CASCADE,
    CONSTRAINT fk_pertenecen_a_carrera
        FOREIGN KEY (Carreras_Nombre)
        REFERENCES Carreras (Nombre)
        ON UPDATE CASCADE
        ON DELETE CASCADE
);

CREATE TABLE Cursan (
    Email               VARCHAR(150)    NOT NULL,
    Materias_Nombre     VARCHAR(100)    NOT NULL,
    Fecha_Inscripcion   DATE            NOT NULL,
    Fecha_Finalizacion  DATE            NULL,
    CONSTRAINT pk_cursan PRIMARY KEY (Email, Materias_Nombre),
    CONSTRAINT fk_cursan_persona
        FOREIGN KEY (Email)
        REFERENCES Personas (Email)
        ON UPDATE CASCADE
        ON DELETE CASCADE,
    CONSTRAINT fk_cursan_materia
        FOREIGN KEY (Materias_Nombre)
        REFERENCES Materias (Nombre)
        ON UPDATE CASCADE
        ON DELETE CASCADE
);

CREATE TABLE Tiene (
    Carreras_Nombre   VARCHAR(100)  NOT NULL,
    Materias_Nombre   VARCHAR(100)  NOT NULL,
    CONSTRAINT pk_tiene PRIMARY KEY (Carreras_Nombre, Materias_Nombre),
    CONSTRAINT fk_tiene_carrera
        FOREIGN KEY (Carreras_Nombre)
        REFERENCES Carreras (Nombre)
        ON UPDATE CASCADE
        ON DELETE CASCADE,
    CONSTRAINT fk_tiene_materia
        FOREIGN KEY (Materias_Nombre)
        REFERENCES Materias (Nombre)
        ON UPDATE CASCADE
        ON DELETE CASCADE
);

CREATE TABLE Horarios (
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

CREATE INDEX idx_horarios_periodo
    ON Horarios (Carrera_Nombre, Anio_Lectivo, Semestre_Lectivo);

CREATE UNIQUE INDEX uq_horarios_bloque
    ON Horarios (Carrera_Nombre, Materia_Nombre, Anio_Lectivo, Semestre_Lectivo,
                 COALESCE(Anio_Carrera, 0), Grupo, Dia, Hora_Inicio, Hora_Fin,
                 COALESCE(Docente, ''), Tipo, Opcional);

CREATE TABLE Se_Organiza_En (
    Semestres_Nombre   VARCHAR(50)     NOT NULL,
    Semestres_Anio     INT             NOT NULL,
    Materias_Nombre    VARCHAR(100)    NOT NULL,
    CONSTRAINT pk_se_organiza_en PRIMARY KEY (Semestres_Nombre, Semestres_Anio, Materias_Nombre),
    CONSTRAINT fk_organiza_semestre
        FOREIGN KEY (Semestres_Nombre, Semestres_Anio)
        REFERENCES Semestres (Nombre, Anio)
        ON UPDATE CASCADE
        ON DELETE CASCADE,
    CONSTRAINT fk_organiza_materia
        FOREIGN KEY (Materias_Nombre)
        REFERENCES Materias (Nombre)
        ON UPDATE CASCADE
        ON DELETE CASCADE
);

CREATE TABLE Hacen (
    Email               VARCHAR(150)    NOT NULL,
    Examenes_Fecha      DATE            NOT NULL,
    Materias_Nombre     VARCHAR(100)    NOT NULL,
    Nota                NUMERIC(4,2)    NOT NULL,
    CONSTRAINT pk_hacen PRIMARY KEY (Email, Examenes_Fecha, Materias_Nombre),
    CONSTRAINT fk_hacen_persona
        FOREIGN KEY (Email)
        REFERENCES Personas (Email)
        ON UPDATE CASCADE
        ON DELETE CASCADE,
    CONSTRAINT fk_hacen_examen
        FOREIGN KEY (Examenes_Fecha, Materias_Nombre)
        REFERENCES Examenes (Fecha, Materias_Nombre)
        ON UPDATE CASCADE
        ON DELETE CASCADE
);
