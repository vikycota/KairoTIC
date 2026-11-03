BEGIN;

-- Plan.py guarda el código de la materia (p. ej. "MAT101"), pero ningún script creaba la columna.
ALTER TABLE Materias
ADD COLUMN IF NOT EXISTS Codigo VARCHAR(50) NULL;

COMMIT;
