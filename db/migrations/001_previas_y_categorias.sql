-- Varias previas por materia y categoría por materia.
-- Es idempotente: se puede correr más de una vez sobre una base ya creada.
--   docker exec -i kairo_db sh -c 'psql -U "$(cat /run/secrets/db_user)" -d "$(cat /run/secrets/db_name)"' < db/migrations/001_previas_y_categorias.sql

BEGIN;

ALTER TABLE Materias ADD COLUMN IF NOT EXISTS Categoria VARCHAR(100) NULL;

CREATE TABLE IF NOT EXISTS Previas (
    Materias_Nombre   VARCHAR(100)  NOT NULL,
    Previa_Nombre     VARCHAR(100)  NOT NULL,
    CONSTRAINT pk_previas PRIMARY KEY (Materias_Nombre, Previa_Nombre),
    CONSTRAINT chk_previa_distinta CHECK (Materias_Nombre <> Previa_Nombre),
    CONSTRAINT fk_previas_materia
        FOREIGN KEY (Materias_Nombre)
        REFERENCES Materias (Nombre)
        ON UPDATE CASCADE
        ON DELETE CASCADE,
    CONSTRAINT fk_previas_previa
        FOREIGN KEY (Previa_Nombre)
        REFERENCES Materias (Nombre)
        ON UPDATE CASCADE
        ON DELETE CASCADE
);

-- Pasa la previa única anterior a la tabla nueva y elimina la columna.
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'materias' AND column_name = 'materia_previa_nombre'
    ) THEN
        INSERT INTO Previas (Materias_Nombre, Previa_Nombre)
        SELECT Nombre, Materia_Previa_Nombre FROM Materias
        WHERE Materia_Previa_Nombre IS NOT NULL
        ON CONFLICT DO NOTHING;

        ALTER TABLE Materias DROP COLUMN Materia_Previa_Nombre;
    END IF;
END $$;

COMMIT;
