-- =====================================================
-- DATOS DE PRUEBA - KAIRO
-- =====================================================

-- ---------- PERSONAS ----------
INSERT INTO Personas (Email, Nombre, Apellido, Contrasena, Beca) VALUES
('carolina.perez@um.edu.uy',  'Carolina', 'Pérez',    '$2b$12$dummyhash0000000000000000000000000000000001', 50.00),
('juan.gomez@um.edu.uy',      'Juan',     'Gómez',    '$2b$12$dummyhash0000000000000000000000000000000002', 0.00),
('maria.rodriguez@um.edu.uy', 'María',    'Rodríguez','$2b$12$dummyhash0000000000000000000000000000000003', 100.00),
('lucas.fernandez@um.edu.uy', 'Lucas',    'Fernández','$2b$12$dummyhash0000000000000000000000000000000004', 0.00),
('sofia.martinez@um.edu.uy',  'Sofía',    'Martínez', '$2b$12$dummyhash0000000000000000000000000000000005', 25.00),
('diego.alvarez@um.edu.uy',   'Diego',    'Álvarez',  '$2b$12$dummyhash0000000000000000000000000000000006', 0.00);

-- ---------- CARRERAS ----------
INSERT INTO Carreras (Nombre, Valor_Credito) VALUES
('Ingeniería en Data Engineering y AI', 45.50),
('Ingeniería en Sistemas',              42.00);

-- ---------- SEMESTRES ----------
INSERT INTO Semestres (Nombre, Anio, Cantidad_de_Creditos) VALUES
('Semestre 1', 1, 45),
('Semestre 2', 1, 45),
('Semestre 1', 2, 45),
('Semestre 2', 2, 45),
('Semestre 1', 3, 45),
('Semestre 2', 3, 45);

-- ---------- MATERIAS ----------
-- Primero las que no tienen previa
INSERT INTO Materias (Nombre, Cantidad_de_Creditos, Categoria) VALUES
('Introducción a la Programación', 8,  'Informática comunes'),
('Matemática Discreta',            8,  'C. Básicas específicas'),
('Álgebra Lineal',                 8,  'C. Básicas comunes'),
('Bases de Datos I',               8,  'Informática comunes'),
('Estructuras de Datos',           10, 'Ingeniería aplicada'),
('Bases de Datos II',              10, 'Ingeniería aplicada'),
('Probabilidad y Estadística',     8,  'C. Básicas comunes'),
('Algoritmos y Complejidad',       10, 'C. Básicas específicas'),
('Machine Learning I',             12, 'Ingeniería aplicada'),
('Sistemas Distribuidos',          10, 'Ingeniería aplicada'),
('Machine Learning II',            12, 'Ingeniería aplicada'),
('Ingeniería de Datos a Escala',   12, 'Ingeniería aplicada');

-- ---------- PREVIAS (una materia puede tener varias) ----------
INSERT INTO Previas (Materias_Nombre, Previa_Nombre) VALUES
('Estructuras de Datos',         'Introducción a la Programación'),
('Bases de Datos II',            'Bases de Datos I'),
('Probabilidad y Estadística',   'Matemática Discreta'),
('Algoritmos y Complejidad',     'Estructuras de Datos'),
('Algoritmos y Complejidad',     'Matemática Discreta'),
('Machine Learning I',           'Probabilidad y Estadística'),
('Sistemas Distribuidos',        'Bases de Datos II'),
('Machine Learning II',          'Machine Learning I'),
('Ingeniería de Datos a Escala', 'Sistemas Distribuidos');

-- ---------- EXAMENES ----------
INSERT INTO Examenes (Fecha, Materias_Nombre, Nota) VALUES
('2025-07-10', 'Introducción a la Programación', 8.50),
('2025-07-12', 'Matemática Discreta',             6.00),
('2025-07-15', 'Álgebra Lineal',                  7.25),
('2025-12-03', 'Estructuras de Datos',            9.00),
('2025-12-05', 'Bases de Datos I',                7.75),
('2026-02-20', 'Probabilidad y Estadística',      5.50),
('2026-02-22', 'Bases de Datos II',               8.00),
('2026-07-01', 'Machine Learning I',              9.25);

-- =====================================================
-- TABLAS DE RELACIÓN
-- =====================================================

-- ---------- PERTENECEN_A (Personas <-> Carreras) ----------
INSERT INTO Pertenecen_A (Email, Carreras_Nombre, Fecha_Inscripcion, Fecha_Finalizacion) VALUES
('carolina.perez@um.edu.uy',  'Ingeniería en Data Engineering y AI', '2023-03-01', NULL),
('juan.gomez@um.edu.uy',      'Ingeniería en Data Engineering y AI', '2022-03-01', NULL),
('maria.rodriguez@um.edu.uy', 'Ingeniería en Sistemas',              '2021-03-01', NULL),
('lucas.fernandez@um.edu.uy', 'Ingeniería en Data Engineering y AI', '2024-03-01', NULL),
('sofia.martinez@um.edu.uy',  'Ingeniería en Sistemas',              '2023-08-01', NULL),
('diego.alvarez@um.edu.uy',   'Ingeniería en Data Engineering y AI', '2020-03-01', '2025-12-15');

-- ---------- CURSAN (Personas <-> Materias) ----------
INSERT INTO Cursan (Email, Materias_Nombre, Fecha_Inscripcion, Fecha_Finalizacion) VALUES
('carolina.perez@um.edu.uy',  'Machine Learning I',            '2026-03-01', NULL),
('carolina.perez@um.edu.uy',  'Sistemas Distribuidos',         '2026-03-01', NULL),
('juan.gomez@um.edu.uy',      'Machine Learning II',           '2026-03-01', NULL),
('maria.rodriguez@um.edu.uy', 'Bases de Datos II',             '2025-08-01', '2025-12-10'),
('lucas.fernandez@um.edu.uy', 'Introducción a la Programación','2026-03-01', NULL),
('lucas.fernandez@um.edu.uy', 'Matemática Discreta',           '2026-03-01', NULL),
('sofia.martinez@um.edu.uy',  'Estructuras de Datos',          '2025-08-01', NULL),
('diego.alvarez@um.edu.uy',   'Ingeniería de Datos a Escala',  '2026-03-01', NULL);

-- ---------- TIENE (Carreras <-> Materias) ----------
INSERT INTO Tiene (Carreras_Nombre, Materias_Nombre) VALUES
('Ingeniería en Data Engineering y AI', 'Introducción a la Programación'),
('Ingeniería en Data Engineering y AI', 'Matemática Discreta'),
('Ingeniería en Data Engineering y AI', 'Álgebra Lineal'),
('Ingeniería en Data Engineering y AI', 'Bases de Datos I'),
('Ingeniería en Data Engineering y AI', 'Estructuras de Datos'),
('Ingeniería en Data Engineering y AI', 'Bases de Datos II'),
('Ingeniería en Data Engineering y AI', 'Probabilidad y Estadística'),
('Ingeniería en Data Engineering y AI', 'Machine Learning I'),
('Ingeniería en Data Engineering y AI', 'Machine Learning II'),
('Ingeniería en Data Engineering y AI', 'Sistemas Distribuidos'),
('Ingeniería en Data Engineering y AI', 'Ingeniería de Datos a Escala'),
('Ingeniería en Sistemas',              'Introducción a la Programación'),
('Ingeniería en Sistemas',              'Matemática Discreta'),
('Ingeniería en Sistemas',              'Álgebra Lineal'),
('Ingeniería en Sistemas',              'Bases de Datos I'),
('Ingeniería en Sistemas',              'Estructuras de Datos'),
('Ingeniería en Sistemas',              'Bases de Datos II'),
('Ingeniería en Sistemas',              'Algoritmos y Complejidad'),
('Ingeniería en Sistemas',              'Sistemas Distribuidos');

-- ---------- SE_ORGANIZA_EN (Semestres <-> Materias) ----------
INSERT INTO Se_Organiza_En (Semestres_Nombre, Semestres_Anio, Materias_Nombre) VALUES
('Semestre 1', 1, 'Introducción a la Programación'),
('Semestre 1', 1, 'Matemática Discreta'),
('Semestre 2', 1, 'Álgebra Lineal'),
('Semestre 2', 1, 'Bases de Datos I'),
('Semestre 1', 2, 'Estructuras de Datos'),
('Semestre 1', 2, 'Bases de Datos II'),
('Semestre 2', 2, 'Probabilidad y Estadística'),
('Semestre 2', 2, 'Algoritmos y Complejidad'),
('Semestre 1', 3, 'Machine Learning I'),
('Semestre 1', 3, 'Sistemas Distribuidos'),
('Semestre 2', 3, 'Machine Learning II'),
('Semestre 2', 3, 'Ingeniería de Datos a Escala');

-- ---------- HACEN (Personas <-> Examenes) ----------
INSERT INTO Hacen (Email, Examenes_Fecha, Materias_Nombre) VALUES
('lucas.fernandez@um.edu.uy', '2025-07-10', 'Introducción a la Programación'),
('lucas.fernandez@um.edu.uy', '2025-07-12', 'Matemática Discreta'),
('sofia.martinez@um.edu.uy',  '2025-07-15', 'Álgebra Lineal'),
('sofia.martinez@um.edu.uy',  '2025-12-03', 'Estructuras de Datos'),
('maria.rodriguez@um.edu.uy', '2025-12-05', 'Bases de Datos I'),
('maria.rodriguez@um.edu.uy', '2026-02-22', 'Bases de Datos II'),
('carolina.perez@um.edu.uy',  '2026-02-20', 'Probabilidad y Estadística'),
('juan.gomez@um.edu.uy',      '2026-07-01', 'Machine Learning I');