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
    Nombre          VARCHAR(100)    NOT NULL,
    Valor_Credito   NUMERIC(10,2)   NOT NULL,
    CONSTRAINT pk_carreras PRIMARY KEY (Nombre)
);

CREATE TABLE Semestres (
    Nombre               VARCHAR(50)  NOT NULL,
    Cantidad_de_Creditos INT          NOT NULL,
    CONSTRAINT pk_semestres PRIMARY KEY (Nombre)
);

CREATE TABLE Materias (
    Nombre                  VARCHAR(100)    NOT NULL,
    Cantidad_de_Creditos    INT             NOT NULL,
    Materia_Previa_Nombre   VARCHAR(100)    NULL,
    CONSTRAINT pk_materias PRIMARY KEY (Nombre),
    CONSTRAINT fk_materias_previa
        FOREIGN KEY (Materia_Previa_Nombre)
        REFERENCES Materias (Nombre)
        ON UPDATE CASCADE
        ON DELETE SET NULL
);



CREATE TABLE Examenes (
    Fecha            DATE            NOT NULL,
    Materias_Nombre  VARCHAR(100)    NOT NULL,
    Nota             NUMERIC(4,2)    NOT NULL,
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

CREATE TABLE Se_Organiza_En (
    Semestres_Nombre   VARCHAR(50)     NOT NULL,
    Materias_Nombre    VARCHAR(100)    NOT NULL,
    CONSTRAINT pk_se_organiza_en PRIMARY KEY (Semestres_Nombre, Materias_Nombre),
    CONSTRAINT fk_organiza_semestre
        FOREIGN KEY (Semestres_Nombre)
        REFERENCES Semestres (Nombre)
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