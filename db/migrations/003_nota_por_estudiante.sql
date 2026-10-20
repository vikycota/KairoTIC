BEGIN;

ALTER TABLE Hacen
ADD COLUMN Nota NUMERIC(4,2);

UPDATE Hacen h
SET Nota = e.Nota
FROM Examenes e
WHERE h.Examenes_Fecha = e.Fecha
  AND h.Materias_Nombre = e.Materias_Nombre;

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM Hacen WHERE Nota IS NULL) THEN
        RAISE EXCEPTION 'Migración cancelada: hay filas de Hacen sin nota asociada';
    END IF;
END
$$;

ALTER TABLE Hacen
ALTER COLUMN Nota SET NOT NULL;

ALTER TABLE Examenes
DROP COLUMN Nota;

COMMIT;
