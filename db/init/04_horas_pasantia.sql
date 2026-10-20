CREATE TABLE Horas_Pasantia (
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