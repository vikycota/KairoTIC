-- Crea las tablas de pasantías en bases existentes.
-- Es seguro ejecutarla más de una vez.

CREATE TABLE IF NOT EXISTS Pasantias (
    Id              SERIAL          PRIMARY KEY,
    Email           VARCHAR(150)    NOT NULL,
    Empresa         VARCHAR(150)    NOT NULL,
    Fecha_Inicio    DATE            NOT NULL,
    Fecha_Fin       DATE            NULL,
    Creditos        INT             NOT NULL DEFAULT 0,
    Descripcion     VARCHAR(500)    NULL,
    CONSTRAINT fk_pasantias_persona
        FOREIGN KEY (Email)
        REFERENCES Personas (Email)
        ON UPDATE CASCADE
        ON DELETE CASCADE,
    CONSTRAINT chk_pasantia_fechas
        CHECK (Fecha_Fin IS NULL OR Fecha_Fin >= Fecha_Inicio),
    CONSTRAINT chk_pasantia_creditos
        CHECK (Creditos >= 0)
);

CREATE TABLE IF NOT EXISTS Horas_Pasantia (
    Id              SERIAL          PRIMARY KEY,
    Pasantias_Id    INT             NOT NULL,
    Horas           NUMERIC(6,2)    NOT NULL,
    Descripcion     VARCHAR(255)    NULL,
    CONSTRAINT fk_horaspasantia_pasantia
        FOREIGN KEY (Pasantias_Id)
        REFERENCES Pasantias (Id)
        ON UPDATE CASCADE
        ON DELETE CASCADE,
    CONSTRAINT chk_horaspasantia_horas
        CHECK (Horas > 0)
);
