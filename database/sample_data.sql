-- =============================================
-- DATOS DE PRUEBA PARA GOALFUT
-- 3 Torneos con equipos y jugadores
-- =============================================

-- IMPORTANTE: Primero crea una cuenta en la app con email: admin@goalfut.com
-- Luego obtén el ID de ese usuario desde Supabase (tabla auth.users o perfiles)
-- Reemplaza 'TU_USER_ID_AQUI' con tu ID real

-- Variable para el admin (reemplaza con tu ID real)
-- Puedes obtenerlo ejecutando: SELECT id FROM auth.users WHERE email = 'admin@goalfut.com';

DO $$
DECLARE
    admin_id UUID := '38632ae6-3965-4113-8860-7e5cc2b38d26';  -- <-- REEMPLAZA ESTO
    
    -- IDs de torneos
    torneo1_id UUID := gen_random_uuid();
    torneo2_id UUID := gen_random_uuid();
    torneo3_id UUID := gen_random_uuid();
    
    -- IDs de equipos Torneo 1 (2 grupos)
    t1_eq1 UUID := gen_random_uuid();
    t1_eq2 UUID := gen_random_uuid();
    t1_eq3 UUID := gen_random_uuid();
    t1_eq4 UUID := gen_random_uuid();
    t1_eq5 UUID := gen_random_uuid();
    t1_eq6 UUID := gen_random_uuid();
    t1_eq7 UUID := gen_random_uuid();
    t1_eq8 UUID := gen_random_uuid();
    
    -- IDs de equipos Torneo 2 (todos contra todos)
    t2_eq1 UUID := gen_random_uuid();
    t2_eq2 UUID := gen_random_uuid();
    t2_eq3 UUID := gen_random_uuid();
    t2_eq4 UUID := gen_random_uuid();
    
    -- IDs de equipos Torneo 3 (4 grupos)
    t3_eq1 UUID := gen_random_uuid();
    t3_eq2 UUID := gen_random_uuid();
    t3_eq3 UUID := gen_random_uuid();
    t3_eq4 UUID := gen_random_uuid();
    t3_eq5 UUID := gen_random_uuid();
    t3_eq6 UUID := gen_random_uuid();
    t3_eq7 UUID := gen_random_uuid();
    t3_eq8 UUID := gen_random_uuid();
    
BEGIN

-- =============================================
-- TORNEO 1: Copa Barrio 2026 (2 GRUPOS)
-- =============================================
INSERT INTO torneos (id, admin_id, nombre, descripcion, lugar, cantidad_equipos, max_jugadores_equipo, min_jugadores_equipo, duracion_tiempo_minutos, cantidad_tiempos, puntos_victoria, puntos_empate, puntos_derrota, estado)
VALUES (torneo1_id, admin_id, 'Copa Barrio 2026', 'Torneo de fútbol de salón del barrio', 'Cancha San Miguel', 8, 10, 5, 20, 2, 3, 1, 0, 'activo');

-- Equipos Grupo A
INSERT INTO equipos (id, torneo_id, nombre, nombre_corto, color_principal, grupo) VALUES
(t1_eq1, torneo1_id, 'Los Tigres', 'TIG', '#E53935', 'A'),
(t1_eq2, torneo1_id, 'Deportivo Norte', 'NOR', '#1E88E5', 'A'),
(t1_eq3, torneo1_id, 'Atlético Sur', 'SUR', '#43A047', 'A'),
(t1_eq4, torneo1_id, 'Real Centro', 'CEN', '#FB8C00', 'A');

-- Equipos Grupo B
INSERT INTO equipos (id, torneo_id, nombre, nombre_corto, color_principal, grupo) VALUES
(t1_eq5, torneo1_id, 'FC Unidos', 'UNI', '#8E24AA', 'B'),
(t1_eq6, torneo1_id, 'Sporting Club', 'SPO', '#00ACC1', 'B'),
(t1_eq7, torneo1_id, 'Juventud FC', 'JUV', '#FFB300', 'B'),
(t1_eq8, torneo1_id, 'Club América', 'AME', '#5E35B1', 'B');

-- Jugadores Los Tigres
INSERT INTO jugadores (equipo_id, nombre, apellido, numero_camiseta, posicion, es_capitan) VALUES
(t1_eq1, 'Carlos', 'González', 1, 'portero', false),
(t1_eq1, 'Juan', 'Martínez', 2, 'defensa', true),
(t1_eq1, 'Pedro', 'López', 5, 'mediocampista', false),
(t1_eq1, 'Miguel', 'Rodríguez', 7, 'mediocampista', false),
(t1_eq1, 'Luis', 'Hernández', 9, 'delantero', false),
(t1_eq1, 'Andrés', 'García', 10, 'mediocampista', false),
(t1_eq1, 'Diego', 'Sánchez', 11, 'delantero', false),
(t1_eq1, 'Roberto', 'Pérez', 14, 'defensa', false);

-- Jugadores Deportivo Norte
INSERT INTO jugadores (equipo_id, nombre, apellido, numero_camiseta, posicion, es_capitan) VALUES
(t1_eq2, 'Mateo', 'Ramírez', 1, 'portero', false),
(t1_eq2, 'Sebastián', 'Torres', 3, 'defensa', true),
(t1_eq2, 'Valentín', 'Flores', 6, 'mediocampista', false),
(t1_eq2, 'Nicolás', 'Rivera', 8, 'delantero', false),
(t1_eq2, 'Tomás', 'Morales', 10, 'mediocampista', false),
(t1_eq2, 'Emiliano', 'Castro', 11, 'delantero', false);

-- Jugadores Atlético Sur
INSERT INTO jugadores (equipo_id, nombre, apellido, numero_camiseta, posicion, es_capitan) VALUES
(t1_eq3, 'Fernando', 'Díaz', 1, 'portero', false),
(t1_eq3, 'Ricardo', 'Vargas', 4, 'defensa', true),
(t1_eq3, 'Eduardo', 'Mendoza', 7, 'mediocampista', false),
(t1_eq3, 'Gabriel', 'Ortiz', 9, 'delantero', false),
(t1_eq3, 'Santiago', 'Ruiz', 10, 'mediocampista', false);

-- Jugadores Real Centro
INSERT INTO jugadores (equipo_id, nombre, apellido, numero_camiseta, posicion, es_capitan) VALUES
(t1_eq4, 'Pablo', 'Jiménez', 1, 'portero', false),
(t1_eq4, 'Marcos', 'Salazar', 2, 'defensa', true),
(t1_eq4, 'Alberto', 'Núñez', 6, 'mediocampista', false),
(t1_eq4, 'Javier', 'Campos', 8, 'delantero', false),
(t1_eq4, 'Daniel', 'Vega', 11, 'mediocampista', false);

-- Jugadores FC Unidos (Grupo B)
INSERT INTO jugadores (equipo_id, nombre, apellido, numero_camiseta, posicion, es_capitan) VALUES
(t1_eq5, 'Alejandro', 'Molina', 1, 'portero', false),
(t1_eq5, 'Rafael', 'Guzmán', 3, 'defensa', true),
(t1_eq5, 'Óscar', 'Paredes', 5, 'mediocampista', false),
(t1_eq5, 'Hugo', 'Medina', 9, 'delantero', false),
(t1_eq5, 'Adrián', 'Rojas', 10, 'mediocampista', false);

-- Jugadores Sporting Club
INSERT INTO jugadores (equipo_id, nombre, apellido, numero_camiseta, posicion, es_capitan) VALUES
(t1_eq6, 'Sergio', 'Aguilar', 1, 'portero', false),
(t1_eq6, 'Iván', 'Herrera', 4, 'defensa', true),
(t1_eq6, 'Mario', 'Cordero', 7, 'mediocampista', false),
(t1_eq6, 'Francisco', 'León', 8, 'delantero', false),
(t1_eq6, 'Cristian', 'Paz', 10, 'mediocampista', false);

-- Partidos Copa Barrio - Grupo A (round robin)
INSERT INTO partidos (torneo_id, equipo_local_id, equipo_visitante_id, fecha, hora, jornada, grupo, estado) VALUES
(torneo1_id, t1_eq1, t1_eq2, '2026-01-18', '14:00', 1, 'A', 'programado'),
(torneo1_id, t1_eq3, t1_eq4, '2026-01-18', '15:30', 1, 'A', 'programado'),
(torneo1_id, t1_eq1, t1_eq3, '2026-01-25', '14:00', 2, 'A', 'programado'),
(torneo1_id, t1_eq2, t1_eq4, '2026-01-25', '15:30', 2, 'A', 'programado'),
(torneo1_id, t1_eq1, t1_eq4, '2026-02-01', '14:00', 3, 'A', 'programado'),
(torneo1_id, t1_eq2, t1_eq3, '2026-02-01', '15:30', 3, 'A', 'programado');

-- Partidos Copa Barrio - Grupo B (round robin)
INSERT INTO partidos (torneo_id, equipo_local_id, equipo_visitante_id, fecha, hora, jornada, grupo, estado) VALUES
(torneo1_id, t1_eq5, t1_eq6, '2026-01-18', '17:00', 1, 'B', 'programado'),
(torneo1_id, t1_eq7, t1_eq8, '2026-01-18', '18:30', 1, 'B', 'programado'),
(torneo1_id, t1_eq5, t1_eq7, '2026-01-25', '17:00', 2, 'B', 'programado'),
(torneo1_id, t1_eq6, t1_eq8, '2026-01-25', '18:30', 2, 'B', 'programado'),
(torneo1_id, t1_eq5, t1_eq8, '2026-02-01', '17:00', 3, 'B', 'programado'),
(torneo1_id, t1_eq6, t1_eq7, '2026-02-01', '18:30', 3, 'B', 'programado');

-- =============================================
-- TORNEO 2: Liga Amigos (TODOS CONTRA TODOS)
-- =============================================
INSERT INTO torneos (id, admin_id, nombre, descripcion, lugar, cantidad_equipos, max_jugadores_equipo, min_jugadores_equipo, duracion_tiempo_minutos, cantidad_tiempos, puntos_victoria, puntos_empate, puntos_derrota, estado)
VALUES (torneo2_id, admin_id, 'Liga Amigos', 'Torneo todos contra todos entre amigos', 'Polideportivo Central', 4, 10, 5, 15, 2, 3, 1, 0, 'activo');

-- Equipos (sin grupo - todos contra todos)
INSERT INTO equipos (id, torneo_id, nombre, nombre_corto, color_principal) VALUES
(t2_eq1, torneo2_id, 'Team Alpha', 'ALP', '#D81B60'),
(t2_eq2, torneo2_id, 'Team Beta', 'BET', '#00897B'),
(t2_eq3, torneo2_id, 'Team Gamma', 'GAM', '#3949AB'),
(t2_eq4, torneo2_id, 'Team Delta', 'DEL', '#6D4C41');

-- Jugadores Team Alpha
INSERT INTO jugadores (equipo_id, nombre, apellido, numero_camiseta, posicion, es_capitan) VALUES
(t2_eq1, 'Kevin', 'Ramos', 1, 'portero', false),
(t2_eq1, 'Bryan', 'Mejía', 2, 'defensa', true),
(t2_eq1, 'Steven', 'Ochoa', 5, 'mediocampista', false),
(t2_eq1, 'Jason', 'Pineda', 8, 'delantero', false),
(t2_eq1, 'Brandon', 'Reyes', 10, 'mediocampista', false);

-- Jugadores Team Beta
INSERT INTO jugadores (equipo_id, nombre, apellido, numero_camiseta, posicion, es_capitan) VALUES
(t2_eq2, 'Jonathan', 'Cruz', 1, 'portero', false),
(t2_eq2, 'Cristopher', 'Vásquez', 3, 'defensa', true),
(t2_eq2, 'Anthony', 'Solís', 6, 'mediocampista', false),
(t2_eq2, 'Jeremy', 'Montes', 9, 'delantero', false),
(t2_eq2, 'Dylan', 'Arias', 11, 'mediocampista', false);

-- Jugadores Team Gamma
INSERT INTO jugadores (equipo_id, nombre, apellido, numero_camiseta, posicion, es_capitan) VALUES
(t2_eq3, 'Andrey', 'Carrillo', 1, 'portero', false),
(t2_eq3, 'Erick', 'Bonilla', 4, 'defensa', true),
(t2_eq3, 'Josué', 'Sandoval', 7, 'mediocampista', false),
(t2_eq3, 'Fabián', 'Quirós', 10, 'delantero', false),
(t2_eq3, 'Mauricio', 'Brenes', 13, 'mediocampista', false);

-- Jugadores Team Delta
INSERT INTO jugadores (equipo_id, nombre, apellido, numero_camiseta, posicion, es_capitan) VALUES
(t2_eq4, 'Leonardo', 'Soto', 1, 'portero', false),
(t2_eq4, 'Gonzalo', 'Navarro', 2, 'defensa', true),
(t2_eq4, 'Patricio', 'Espinoza', 5, 'mediocampista', false),
(t2_eq4, 'Ignacio', 'Valenzuela', 8, 'delantero', false),
(t2_eq4, 'Benjamín', 'Lagos', 10, 'mediocampista', false);

-- Partidos Liga Amigos (todos contra todos)
INSERT INTO partidos (torneo_id, equipo_local_id, equipo_visitante_id, fecha, hora, jornada, estado) VALUES
(torneo2_id, t2_eq1, t2_eq2, '2026-01-25', '09:00', 1, 'programado'),
(torneo2_id, t2_eq3, t2_eq4, '2026-01-25', '10:30', 1, 'programado'),
(torneo2_id, t2_eq1, t2_eq3, '2026-02-01', '09:00', 2, 'programado'),
(torneo2_id, t2_eq2, t2_eq4, '2026-02-01', '10:30', 2, 'programado'),
(torneo2_id, t2_eq1, t2_eq4, '2026-02-08', '09:00', 3, 'programado'),
(torneo2_id, t2_eq2, t2_eq3, '2026-02-08', '10:30', 3, 'programado');

-- =============================================
-- TORNEO 3: Super Copa (4 GRUPOS)
-- =============================================
INSERT INTO torneos (id, admin_id, nombre, descripcion, lugar, cantidad_equipos, max_jugadores_equipo, min_jugadores_equipo, duracion_tiempo_minutos, cantidad_tiempos, puntos_victoria, puntos_empate, puntos_derrota, estado)
VALUES (torneo3_id, admin_id, 'Super Copa 2026', 'Gran torneo con 4 grupos', 'Estadio Municipal', 8, 10, 5, 25, 2, 3, 1, 0, 'configuracion');

-- Equipos 4 grupos
INSERT INTO equipos (id, torneo_id, nombre, nombre_corto, color_principal, grupo) VALUES
(t3_eq1, torneo3_id, 'Barcelona FC', 'BAR', '#A50044', 'A'),
(t3_eq2, torneo3_id, 'Madrid United', 'MAD', '#FFFFFF', 'A'),
(t3_eq3, torneo3_id, 'Milan AC', 'MIL', '#FB090B', 'B'),
(t3_eq4, torneo3_id, 'Inter Club', 'INT', '#0068A8', 'B'),
(t3_eq5, torneo3_id, 'Bayern SC', 'BAY', '#DC052D', 'C'),
(t3_eq6, torneo3_id, 'Paris SG', 'PSG', '#004170', 'C'),
(t3_eq7, torneo3_id, 'Manchester City', 'MCI', '#6CABDD', 'D'),
(t3_eq8, torneo3_id, 'Liverpool FC', 'LIV', '#C8102E', 'D');

-- Jugadores Barcelona FC
INSERT INTO jugadores (equipo_id, nombre, apellido, numero_camiseta, posicion, es_capitan) VALUES
(t3_eq1, 'Lionel', 'Mesía', 10, 'delantero', true),
(t3_eq1, 'Pedri', 'Gonzáles', 8, 'mediocampista', false),
(t3_eq1, 'Gavi', 'Páez', 6, 'mediocampista', false),
(t3_eq1, 'Marc', 'Terán', 1, 'portero', false),
(t3_eq1, 'Ronald', 'Araújoz', 4, 'defensa', false);

-- Jugadores Madrid United
INSERT INTO jugadores (equipo_id, nombre, apellido, numero_camiseta, posicion, es_capitan) VALUES
(t3_eq2, 'Karim', 'Benzina', 9, 'delantero', true),
(t3_eq2, 'Vinicius', 'Juniorz', 7, 'delantero', false),
(t3_eq2, 'Jude', 'Bellín', 5, 'mediocampista', false),
(t3_eq2, 'Thibaut', 'Courtín', 1, 'portero', false),
(t3_eq2, 'David', 'Alabaz', 4, 'defensa', false);

-- Jugadores Milan AC
INSERT INTO jugadores (equipo_id, nombre, apellido, numero_camiseta, posicion, es_capitan) VALUES
(t3_eq3, 'Rafael', 'Leáo', 10, 'delantero', true),
(t3_eq3, 'Theo', 'Hernandéz', 19, 'defensa', false),
(t3_eq3, 'Olivier', 'Giroudín', 9, 'delantero', false),
(t3_eq3, 'Mike', 'Maignán', 16, 'portero', false),
(t3_eq3, 'Sandro', 'Tonalin', 8, 'mediocampista', false);

-- Jugadores Inter Club
INSERT INTO jugadores (equipo_id, nombre, apellido, numero_camiseta, posicion, es_capitan) VALUES
(t3_eq4, 'Lautaro', 'Martínaz', 10, 'delantero', true),
(t3_eq4, 'Nicolás', 'Barellas', 23, 'mediocampista', false),
(t3_eq4, 'Federico', 'Dimarcoz', 32, 'defensa', false),
(t3_eq4, 'André', 'Onanaz', 24, 'portero', false),
(t3_eq4, 'Hakan', 'Calhanoglu', 20, 'mediocampista', false);

RAISE NOTICE 'Datos insertados correctamente!';
RAISE NOTICE 'Torneo 1: Copa Barrio 2026 (2 grupos) - ID: %', torneo1_id;
RAISE NOTICE 'Torneo 2: Liga Amigos (todos contra todos) - ID: %', torneo2_id;
RAISE NOTICE 'Torneo 3: Super Copa 2026 (4 grupos) - ID: %', torneo3_id;

END $$;
