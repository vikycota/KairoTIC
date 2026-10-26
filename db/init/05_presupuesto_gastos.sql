-- Presupuesto mensual de la persona (SCRUM-11) y gastos extra por semestre (SCRUM-24).
-- Idempotente: se puede correr varias veces. Se aplica al crear la base (db/init) o a mano:
--   docker exec -i kairo_db sh -c 'psql -U "$(cat /run/secrets/db_user)" -d "$(cat /run/secrets/db_name)"' < db/init/05_presupuesto_gastos.sql

ALTER TABLE Personas ADD COLUMN IF NOT EXISTS Presupuesto_Mensual NUMERIC(12,2) NULL;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_presupuesto_positivo') THEN
        ALTER TABLE Personas
            ADD CONSTRAINT chk_presupuesto_positivo
            CHECK (Presupuesto_Mensual IS NULL OR Presupuesto_Mensual >= 0);
    END IF;
END $$;

-- Talleres, materiales, traslados, etc. que se suman al costo de un semestre.
-- Semestre es una etiqueta tipo '2026-2' (año-semestre).
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

CREATE INDEX IF NOT EXISTS idx_gastos_extra_email_semestre ON Gastos_Extra (Email, Semestre);
