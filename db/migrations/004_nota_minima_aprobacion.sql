BEGIN;

-- Valor inicial para datos existentes; configurable por carrera después de migrar.
ALTER TABLE Carreras
ADD COLUMN Nota_Minima_Aprobacion NUMERIC(4,2) NOT NULL DEFAULT 6.00;

COMMIT;
