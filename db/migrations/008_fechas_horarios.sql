-- Ejecutar una vez en instalaciones con la tabla Horarios ya creada.
BEGIN;
ALTER TABLE Horarios ADD COLUMN IF NOT EXISTS Fecha_Inicio DATE;
ALTER TABLE Horarios ADD COLUMN IF NOT EXISTS Fecha_Fin DATE;
-- Para horarios anteriores se asigna el período sugerido, sin borrar las cargas existentes.
UPDATE Horarios SET
    Fecha_Inicio = COALESCE(Fecha_Inicio, make_date(Anio_Lectivo, CASE WHEN Semestre_Lectivo = 1 THEN 3 ELSE 8 END, 1)),
    Fecha_Fin = COALESCE(Fecha_Fin, make_date(Anio_Lectivo, CASE WHEN Semestre_Lectivo = 1 THEN 7 ELSE 12 END, 31));
ALTER TABLE Horarios DROP CONSTRAINT IF EXISTS chk_horarios_fechas;
ALTER TABLE Horarios ADD CONSTRAINT chk_horarios_fechas CHECK (Fecha_Fin IS NULL OR Fecha_Inicio IS NULL OR Fecha_Fin >= Fecha_Inicio);
COMMIT;
