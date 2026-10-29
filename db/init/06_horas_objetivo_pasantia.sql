-- Meta de horas de pasantía de cada persona. NULL = todavía no la definió (la define en la pantalla Pasantías).
-- Idempotente: se puede correr varias veces. Se aplica al crear la base (db/init) o a mano:
--   docker exec -i kairo_db sh -c 'psql -U "$(cat /run/secrets/db_user)" -d "$(cat /run/secrets/db_name)"' < db/init/06_horas_objetivo_pasantia.sql
-- (El backend también agrega la columna solo la primera vez que se usa, por si la base ya existía.)

ALTER TABLE Personas ADD COLUMN IF NOT EXISTS Horas_Objetivo_Pasantia INT NULL;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_horas_objetivo_pasantia') THEN
        ALTER TABLE Personas
            ADD CONSTRAINT chk_horas_objetivo_pasantia
            CHECK (Horas_Objetivo_Pasantia IS NULL OR Horas_Objetivo_Pasantia > 0);
    END IF;
END $$;
