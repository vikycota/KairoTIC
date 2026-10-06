CREATE TABLE Pasantias (
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