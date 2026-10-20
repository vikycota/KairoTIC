-- Cada plan de estudio (carrera) pertenece a un usuario. Idempotente.
--   docker exec -i kairo_db sh -c 'psql -U "$(cat /run/secrets/db_user)" -d "$(cat /run/secrets/db_name)"' < db/migrations/002_propietario_carreras.sql
--
-- Los planes que ya existían quedan sin propietario (NULL) y nadie los ve.
-- Para asignarlos a una persona:
--   UPDATE Carreras SET Propietario = 'persona@email.com' WHERE Propietario IS NULL;

BEGIN;

ALTER TABLE Carreras ADD COLUMN IF NOT EXISTS Propietario VARCHAR(150) NULL;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'fk_carreras_propietario'
    ) THEN
        ALTER TABLE Carreras
            ADD CONSTRAINT fk_carreras_propietario
            FOREIGN KEY (Propietario) REFERENCES Personas (Email)
            ON UPDATE CASCADE
            ON DELETE CASCADE;
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_carreras_propietario ON Carreras (Propietario);

COMMIT;
