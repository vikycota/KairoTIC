-- Presupuesto mensual y gastos extra por semestre para bases ya existentes.
-- Es seguro ejecutarla varias veces.

ALTER TABLE Personas
    ADD COLUMN IF NOT EXISTS Presupuesto_Mensual NUMERIC(12,2) NULL;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'chk_presupuesto_positivo'
    ) THEN
        ALTER TABLE Personas
            ADD CONSTRAINT chk_presupuesto_positivo
            CHECK (Presupuesto_Mensual IS NULL OR Presupuesto_Mensual >= 0);
    END IF;
END $$;

CREATE TABLE IF NOT EXISTS Gastos_Extra (
    Id          SERIAL          PRIMARY KEY,
    Email       VARCHAR(150)    NOT NULL,
    Semestre    VARCHAR(10)     NOT NULL,
    Concepto    VARCHAR(150)    NOT NULL,
    Monto       NUMERIC(12,2)   NOT NULL,
    CONSTRAINT fk_gastos_extra_persona
        FOREIGN KEY (Email)
        REFERENCES Personas (Email)
        ON UPDATE CASCADE
        ON DELETE CASCADE,
    CONSTRAINT chk_gasto_monto CHECK (Monto >= 0)
);

CREATE INDEX IF NOT EXISTS idx_gastos_extra_email_semestre
    ON Gastos_Extra (Email, Semestre);
