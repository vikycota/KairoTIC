-- La nota de cada examen se guarda por alumno (en Hacen), así una persona puede registrar
-- todos sus intentos de una materia sin que otro alumno que rindió el mismo día se la pise.
-- Idempotente. Se aplica también al crear la base (db/init/04_nota_por_examen.sql).
--   docker exec -i kairo_db sh -c 'psql -U "$(cat /run/secrets/db_user)" -d "$(cat /run/secrets/db_name)"' < db/migrations/003_nota_por_examen.sql
--
-- La tabla Examenes queda sin uso (se conserva por compatibilidad).

BEGIN;

ALTER TABLE Hacen ADD COLUMN IF NOT EXISTS Nota NUMERIC(4,2) NULL;

UPDATE Hacen h
SET Nota = e.Nota
FROM Examenes e
WHERE e.Fecha = h.Examenes_Fecha
  AND e.Materias_Nombre = h.Materias_Nombre
  AND h.Nota IS NULL;

ALTER TABLE Hacen DROP CONSTRAINT IF EXISTS fk_hacen_examen;

ALTER TABLE Hacen ALTER COLUMN Nota SET NOT NULL;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_hacen_nota') THEN
        ALTER TABLE Hacen ADD CONSTRAINT chk_hacen_nota CHECK (Nota BETWEEN 0 AND 12);
    END IF;
    -- Sin la clave foránea a Examenes, la materia debe seguir existiendo.
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_hacen_materia') THEN
        ALTER TABLE Hacen
            ADD CONSTRAINT fk_hacen_materia
            FOREIGN KEY (Materias_Nombre) REFERENCES Materias (Nombre)
            ON UPDATE CASCADE ON DELETE CASCADE;
    END IF;
END $$;

COMMIT;
