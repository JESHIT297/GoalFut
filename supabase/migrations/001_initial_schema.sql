-- =====================================================
-- GOALFUT - ESQUEMA DE BASE DE DATOS
-- Aplicación para gestión de torneos de fútbol de salón
-- =====================================================

-- Habilitar extensión UUID
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =====================================================
-- TABLA: usuarios
-- Almacena información de todos los usuarios del sistema
-- =====================================================
CREATE TABLE usuarios (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    auth_id UUID UNIQUE, -- Referencia al auth.users de Supabase
    email VARCHAR(255) UNIQUE NOT NULL,
    nombre VARCHAR(100) NOT NULL,
    telefono VARCHAR(20),
    rol VARCHAR(20) DEFAULT 'registered' CHECK (rol IN ('admin', 'registered', 'guest')),
    avatar_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Índices para usuarios
CREATE INDEX idx_usuarios_email ON usuarios(email);
CREATE INDEX idx_usuarios_auth_id ON usuarios(auth_id);

-- =====================================================
-- TABLA: torneos
-- Almacena la configuración y estado de cada torneo
-- =====================================================
CREATE TABLE torneos (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    admin_id UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    nombre VARCHAR(150) NOT NULL,
    descripcion TEXT,
    -- Configuración del torneo
    cantidad_equipos INTEGER NOT NULL DEFAULT 8,
    equipos_por_grupo INTEGER DEFAULT 4,
    max_jugadores_equipo INTEGER DEFAULT 15,
    min_jugadores_equipo INTEGER DEFAULT 5,
    -- Sistema de puntos
    puntos_victoria INTEGER DEFAULT 3,
    puntos_empate INTEGER DEFAULT 1,
    puntos_derrota INTEGER DEFAULT 0,
    -- Configuración de partidos
    duracion_tiempo_minutos INTEGER DEFAULT 20,
    cantidad_tiempos INTEGER DEFAULT 2,
    -- Tipo de torneo
    tipo_fase_grupos BOOLEAN DEFAULT true,
    tipo_eliminatoria VARCHAR(30) DEFAULT 'directo' CHECK (tipo_eliminatoria IN ('directo', 'ida_vuelta')),
    -- Estado
    estado VARCHAR(20) DEFAULT 'configuracion' CHECK (estado IN ('configuracion', 'inscripcion', 'activo', 'finalizado', 'cancelado')),
    -- Fechas
    fecha_inicio DATE,
    fecha_fin DATE,
    -- Metadata
    logo_url TEXT,
    lugar VARCHAR(200),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Índices para torneos
CREATE INDEX idx_torneos_admin ON torneos(admin_id);
CREATE INDEX idx_torneos_estado ON torneos(estado);
CREATE INDEX idx_torneos_fecha ON torneos(fecha_inicio);

-- =====================================================
-- TABLA: equipos
-- Almacena equipos inscritos en cada torneo
-- =====================================================
CREATE TABLE equipos (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    torneo_id UUID NOT NULL REFERENCES torneos(id) ON DELETE CASCADE,
    nombre VARCHAR(100) NOT NULL,
    nombre_corto VARCHAR(10),
    logo_url TEXT,
    color_principal VARCHAR(7) DEFAULT '#1E88E5',
    color_secundario VARCHAR(7) DEFAULT '#FFFFFF',
    -- Estadísticas
    puntos INTEGER DEFAULT 0,
    partidos_jugados INTEGER DEFAULT 0,
    partidos_ganados INTEGER DEFAULT 0,
    partidos_empatados INTEGER DEFAULT 0,
    partidos_perdidos INTEGER DEFAULT 0,
    goles_favor INTEGER DEFAULT 0,
    goles_contra INTEGER DEFAULT 0,
    diferencia_gol INTEGER DEFAULT 0,
    -- Fase de grupos
    grupo VARCHAR(1),
    posicion_grupo INTEGER,
    -- Metadata
    delegado_nombre VARCHAR(100),
    delegado_telefono VARCHAR(20),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    UNIQUE(torneo_id, nombre)
);

-- Índices para equipos
CREATE INDEX idx_equipos_torneo ON equipos(torneo_id);
CREATE INDEX idx_equipos_grupo ON equipos(torneo_id, grupo);
CREATE INDEX idx_equipos_puntos ON equipos(torneo_id, puntos DESC, diferencia_gol DESC);

-- =====================================================
-- TABLA: jugadores
-- Almacena jugadores de cada equipo
-- =====================================================
CREATE TABLE jugadores (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    equipo_id UUID NOT NULL REFERENCES equipos(id) ON DELETE CASCADE,
    nombre VARCHAR(100) NOT NULL,
    apellido VARCHAR(100) NOT NULL,
    numero_camiseta INTEGER,
    posicion VARCHAR(30) CHECK (posicion IN ('portero', 'defensa', 'mediocampista', 'delantero', 'universal')),
    documento_identidad VARCHAR(20),
    fecha_nacimiento DATE,
    foto_url TEXT,
    -- Estadísticas
    goles_totales INTEGER DEFAULT 0,
    asistencias_totales INTEGER DEFAULT 0,
    tarjetas_amarillas INTEGER DEFAULT 0,
    tarjetas_rojas INTEGER DEFAULT 0,
    partidos_jugados INTEGER DEFAULT 0,
    -- Flags
    es_capitan BOOLEAN DEFAULT false,
    activo BOOLEAN DEFAULT true,
    -- Metadata
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    UNIQUE(equipo_id, numero_camiseta)
);

-- Índices para jugadores
CREATE INDEX idx_jugadores_equipo ON jugadores(equipo_id);
CREATE INDEX idx_jugadores_goles ON jugadores(goles_totales DESC);

-- =====================================================
-- TABLA: partidos
-- Almacena todos los partidos de cada torneo
-- =====================================================
CREATE TABLE partidos (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    torneo_id UUID NOT NULL REFERENCES torneos(id) ON DELETE CASCADE,
    equipo_local_id UUID NOT NULL REFERENCES equipos(id) ON DELETE CASCADE,
    equipo_visitante_id UUID NOT NULL REFERENCES equipos(id) ON DELETE CASCADE,
    -- Marcador
    goles_local INTEGER DEFAULT 0,
    goles_visitante INTEGER DEFAULT 0,
    -- Programación
    fecha DATE,
    hora TIME,
    cancha VARCHAR(100),
    -- Estado y cronómetro
    estado VARCHAR(20) DEFAULT 'programado' CHECK (estado IN ('programado', 'en_juego', 'pausado', 'medio_tiempo', 'finalizado', 'suspendido', 'aplazado')),
    tiempo_actual INTEGER DEFAULT 1, -- 1 o 2 (primer o segundo tiempo)
    segundos_jugados INTEGER DEFAULT 0, -- Segundos transcurridos del tiempo actual
    tiempo_inicio_real TIMESTAMP WITH TIME ZONE, -- Cuando realmente empezó
    -- Fase del torneo
    fase VARCHAR(20) DEFAULT 'grupos' CHECK (fase IN ('grupos', 'octavos', 'cuartos', 'semifinal', 'tercer_puesto', 'final')),
    jornada INTEGER,
    grupo VARCHAR(1),
    -- Metadata
    arbitro VARCHAR(100),
    observaciones TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Índices para partidos
CREATE INDEX idx_partidos_torneo ON partidos(torneo_id);
CREATE INDEX idx_partidos_fecha ON partidos(fecha, hora);
CREATE INDEX idx_partidos_estado ON partidos(estado);
CREATE INDEX idx_partidos_equipo_local ON partidos(equipo_local_id);
CREATE INDEX idx_partidos_equipo_visitante ON partidos(equipo_visitante_id);

-- =====================================================
-- TABLA: eventos_partido
-- Registra goles, tarjetas y faltas durante el partido
-- =====================================================
CREATE TABLE eventos_partido (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    partido_id UUID NOT NULL REFERENCES partidos(id) ON DELETE CASCADE,
    jugador_id UUID REFERENCES jugadores(id) ON DELETE SET NULL,
    equipo_id UUID NOT NULL REFERENCES equipos(id) ON DELETE CASCADE,
    -- Tipo de evento
    tipo VARCHAR(30) NOT NULL CHECK (tipo IN ('gol', 'gol_penal', 'autogol', 'tarjeta_amarilla', 'tarjeta_roja', 'doble_amarilla', 'falta', 'sustitucion')),
    -- Tiempo del evento
    tiempo INTEGER DEFAULT 1, -- Tiempo 1 o 2
    minuto INTEGER NOT NULL,
    segundo INTEGER DEFAULT 0,
    -- Detalles adicionales
    descripcion TEXT,
    jugador_asistencia_id UUID REFERENCES jugadores(id) ON DELETE SET NULL, -- Para goles con asistencia
    jugador_entra_id UUID REFERENCES jugadores(id) ON DELETE SET NULL, -- Para sustituciones
    -- Sincronización offline
    sync_id VARCHAR(50), -- ID local para sincronización
    sincronizado BOOLEAN DEFAULT true,
    -- Metadata
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Índices para eventos
CREATE INDEX idx_eventos_partido ON eventos_partido(partido_id);
CREATE INDEX idx_eventos_jugador ON eventos_partido(jugador_id);
CREATE INDEX idx_eventos_tipo ON eventos_partido(tipo);
CREATE INDEX idx_eventos_sync ON eventos_partido(sincronizado) WHERE sincronizado = false;

-- =====================================================
-- TABLA: torneos_seguidos
-- Permite a usuarios registrados seguir torneos
-- =====================================================
CREATE TABLE torneos_seguidos (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    usuario_id UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    torneo_id UUID NOT NULL REFERENCES torneos(id) ON DELETE CASCADE,
    notificaciones_activas BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    UNIQUE(usuario_id, torneo_id)
);

-- Índices
CREATE INDEX idx_torneos_seguidos_usuario ON torneos_seguidos(usuario_id);
CREATE INDEX idx_torneos_seguidos_torneo ON torneos_seguidos(torneo_id);

-- =====================================================
-- TABLA: equipos_seguidos
-- Permite a usuarios registrados seguir equipos
-- =====================================================
CREATE TABLE equipos_seguidos (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    usuario_id UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    equipo_id UUID NOT NULL REFERENCES equipos(id) ON DELETE CASCADE,
    notificaciones_activas BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    UNIQUE(usuario_id, equipo_id)
);

-- Índices
CREATE INDEX idx_equipos_seguidos_usuario ON equipos_seguidos(usuario_id);
CREATE INDEX idx_equipos_seguidos_equipo ON equipos_seguidos(equipo_id);

-- =====================================================
-- VISTAS ÚTILES
-- =====================================================

-- Vista: Tabla de posiciones por torneo
CREATE OR REPLACE VIEW vista_tabla_posiciones AS
SELECT 
    e.id,
    e.torneo_id,
    e.nombre,
    e.nombre_corto,
    e.logo_url,
    e.grupo,
    e.puntos,
    e.partidos_jugados AS pj,
    e.partidos_ganados AS pg,
    e.partidos_empatados AS pe,
    e.partidos_perdidos AS pp,
    e.goles_favor AS gf,
    e.goles_contra AS gc,
    e.diferencia_gol AS dif,
    ROW_NUMBER() OVER (
        PARTITION BY e.torneo_id, e.grupo 
        ORDER BY e.puntos DESC, e.diferencia_gol DESC, e.goles_favor DESC
    ) AS posicion
FROM equipos e
ORDER BY e.torneo_id, e.grupo, posicion;

-- Vista: Tabla de goleadores
CREATE OR REPLACE VIEW vista_goleadores AS
SELECT 
    j.id,
    j.nombre,
    j.apellido,
    j.numero_camiseta,
    j.foto_url,
    j.goles_totales,
    e.nombre AS equipo_nombre,
    e.logo_url AS equipo_logo,
    e.torneo_id,
    ROW_NUMBER() OVER (
        PARTITION BY e.torneo_id 
        ORDER BY j.goles_totales DESC, j.nombre ASC
    ) AS posicion
FROM jugadores j
JOIN equipos e ON j.equipo_id = e.id
WHERE j.goles_totales > 0
ORDER BY e.torneo_id, j.goles_totales DESC;

-- Vista: Próximos partidos
CREATE OR REPLACE VIEW vista_proximos_partidos AS
SELECT 
    p.*,
    el.nombre AS local_nombre,
    el.logo_url AS local_logo,
    ev.nombre AS visitante_nombre,
    ev.logo_url AS visitante_logo,
    t.nombre AS torneo_nombre
FROM partidos p
JOIN equipos el ON p.equipo_local_id = el.id
JOIN equipos ev ON p.equipo_visitante_id = ev.id
JOIN torneos t ON p.torneo_id = t.id
WHERE p.estado IN ('programado', 'en_juego')
ORDER BY p.fecha, p.hora;

-- =====================================================
-- FUNCIONES
-- =====================================================

-- Función para actualizar estadísticas de un equipo después de un partido
CREATE OR REPLACE FUNCTION actualizar_estadisticas_equipo(
    p_equipo_id UUID,
    p_goles_favor INTEGER,
    p_goles_contra INTEGER
) RETURNS VOID AS $$
DECLARE
    v_resultado VARCHAR(10);
BEGIN
    -- Determinar resultado
    IF p_goles_favor > p_goles_contra THEN
        v_resultado := 'victoria';
    ELSIF p_goles_favor < p_goles_contra THEN
        v_resultado := 'derrota';
    ELSE
        v_resultado := 'empate';
    END IF;
    
    -- Actualizar estadísticas
    UPDATE equipos SET
        partidos_jugados = partidos_jugados + 1,
        partidos_ganados = partidos_ganados + CASE WHEN v_resultado = 'victoria' THEN 1 ELSE 0 END,
        partidos_empatados = partidos_empatados + CASE WHEN v_resultado = 'empate' THEN 1 ELSE 0 END,
        partidos_perdidos = partidos_perdidos + CASE WHEN v_resultado = 'derrota' THEN 1 ELSE 0 END,
        goles_favor = goles_favor + p_goles_favor,
        goles_contra = goles_contra + p_goles_contra,
        diferencia_gol = diferencia_gol + (p_goles_favor - p_goles_contra),
        puntos = puntos + CASE 
            WHEN v_resultado = 'victoria' THEN (SELECT puntos_victoria FROM torneos WHERE id = (SELECT torneo_id FROM equipos WHERE id = p_equipo_id))
            WHEN v_resultado = 'empate' THEN (SELECT puntos_empate FROM torneos WHERE id = (SELECT torneo_id FROM equipos WHERE id = p_equipo_id))
            ELSE (SELECT puntos_derrota FROM torneos WHERE id = (SELECT torneo_id FROM equipos WHERE id = p_equipo_id))
        END,
        updated_at = NOW()
    WHERE id = p_equipo_id;
END;
$$ LANGUAGE plpgsql;

-- Función para contar torneos activos de un admin
CREATE OR REPLACE FUNCTION contar_torneos_activos_admin(p_admin_id UUID)
RETURNS INTEGER AS $$
BEGIN
    RETURN (
        SELECT COUNT(*) 
        FROM torneos 
        WHERE admin_id = p_admin_id 
        AND estado IN ('configuracion', 'inscripcion', 'activo')
    );
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- TRIGGERS
-- =====================================================

-- Trigger para actualizar updated_at automáticamente
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_usuarios_updated_at
    BEFORE UPDATE ON usuarios
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_torneos_updated_at
    BEFORE UPDATE ON torneos
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_equipos_updated_at
    BEFORE UPDATE ON equipos
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_jugadores_updated_at
    BEFORE UPDATE ON jugadores
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_partidos_updated_at
    BEFORE UPDATE ON partidos
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Trigger para actualizar goles del jugador cuando se registra un gol
CREATE OR REPLACE FUNCTION actualizar_goles_jugador()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.tipo IN ('gol', 'gol_penal') AND NEW.jugador_id IS NOT NULL THEN
        UPDATE jugadores 
        SET goles_totales = goles_totales + 1,
            updated_at = NOW()
        WHERE id = NEW.jugador_id;
    END IF;
    
    IF NEW.tipo = 'tarjeta_amarilla' AND NEW.jugador_id IS NOT NULL THEN
        UPDATE jugadores 
        SET tarjetas_amarillas = tarjetas_amarillas + 1,
            updated_at = NOW()
        WHERE id = NEW.jugador_id;
    END IF;
    
    IF NEW.tipo IN ('tarjeta_roja', 'doble_amarilla') AND NEW.jugador_id IS NOT NULL THEN
        UPDATE jugadores 
        SET tarjetas_rojas = tarjetas_rojas + 1,
            updated_at = NOW()
        WHERE id = NEW.jugador_id;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_actualizar_estadisticas_jugador
    AFTER INSERT ON eventos_partido
    FOR EACH ROW
    EXECUTE FUNCTION actualizar_goles_jugador();

-- =====================================================
-- ROW LEVEL SECURITY (RLS)
-- =====================================================

-- Habilitar RLS en todas las tablas
ALTER TABLE usuarios ENABLE ROW LEVEL SECURITY;
ALTER TABLE torneos ENABLE ROW LEVEL SECURITY;
ALTER TABLE equipos ENABLE ROW LEVEL SECURITY;
ALTER TABLE jugadores ENABLE ROW LEVEL SECURITY;
ALTER TABLE partidos ENABLE ROW LEVEL SECURITY;
ALTER TABLE eventos_partido ENABLE ROW LEVEL SECURITY;
ALTER TABLE torneos_seguidos ENABLE ROW LEVEL SECURITY;
ALTER TABLE equipos_seguidos ENABLE ROW LEVEL SECURITY;

-- Políticas para usuarios
CREATE POLICY "Usuarios pueden ver su propio perfil" ON usuarios
    FOR SELECT USING (auth.uid() = auth_id);

CREATE POLICY "Usuarios pueden actualizar su propio perfil" ON usuarios
    FOR UPDATE USING (auth.uid() = auth_id);

CREATE POLICY "Permitir inserción durante registro" ON usuarios
    FOR INSERT WITH CHECK (true);

-- Políticas para torneos (lectura pública, escritura solo admin del torneo)
CREATE POLICY "Torneos son públicos para lectura" ON torneos
    FOR SELECT USING (true);

CREATE POLICY "Solo el admin puede modificar su torneo" ON torneos
    FOR UPDATE USING (
        admin_id IN (SELECT id FROM usuarios WHERE auth_id = auth.uid())
    );

CREATE POLICY "Usuarios admin pueden crear torneos" ON torneos
    FOR INSERT WITH CHECK (
        admin_id IN (SELECT id FROM usuarios WHERE auth_id = auth.uid() AND rol = 'admin')
    );

CREATE POLICY "Solo el admin puede eliminar su torneo" ON torneos
    FOR DELETE USING (
        admin_id IN (SELECT id FROM usuarios WHERE auth_id = auth.uid())
    );

-- Políticas para equipos (lectura pública)
CREATE POLICY "Equipos son públicos para lectura" ON equipos
    FOR SELECT USING (true);

CREATE POLICY "Solo admin del torneo puede gestionar equipos" ON equipos
    FOR ALL USING (
        torneo_id IN (
            SELECT id FROM torneos 
            WHERE admin_id IN (SELECT id FROM usuarios WHERE auth_id = auth.uid())
        )
    );

-- Políticas para jugadores (lectura pública)
CREATE POLICY "Jugadores son públicos para lectura" ON jugadores
    FOR SELECT USING (true);

CREATE POLICY "Solo admin del torneo puede gestionar jugadores" ON jugadores
    FOR ALL USING (
        equipo_id IN (
            SELECT e.id FROM equipos e
            JOIN torneos t ON e.torneo_id = t.id
            WHERE t.admin_id IN (SELECT id FROM usuarios WHERE auth_id = auth.uid())
        )
    );

-- Políticas para partidos (lectura pública)
CREATE POLICY "Partidos son públicos para lectura" ON partidos
    FOR SELECT USING (true);

CREATE POLICY "Solo admin del torneo puede gestionar partidos" ON partidos
    FOR ALL USING (
        torneo_id IN (
            SELECT id FROM torneos 
            WHERE admin_id IN (SELECT id FROM usuarios WHERE auth_id = auth.uid())
        )
    );

-- Políticas para eventos (lectura pública)
CREATE POLICY "Eventos son públicos para lectura" ON eventos_partido
    FOR SELECT USING (true);

CREATE POLICY "Solo admin del torneo puede registrar eventos" ON eventos_partido
    FOR INSERT WITH CHECK (
        partido_id IN (
            SELECT p.id FROM partidos p
            JOIN torneos t ON p.torneo_id = t.id
            WHERE t.admin_id IN (SELECT id FROM usuarios WHERE auth_id = auth.uid())
        )
    );

-- Políticas para torneos seguidos
CREATE POLICY "Usuarios pueden ver sus torneos seguidos" ON torneos_seguidos
    FOR SELECT USING (
        usuario_id IN (SELECT id FROM usuarios WHERE auth_id = auth.uid())
    );

CREATE POLICY "Usuarios pueden seguir torneos" ON torneos_seguidos
    FOR INSERT WITH CHECK (
        usuario_id IN (SELECT id FROM usuarios WHERE auth_id = auth.uid())
    );

CREATE POLICY "Usuarios pueden dejar de seguir torneos" ON torneos_seguidos
    FOR DELETE USING (
        usuario_id IN (SELECT id FROM usuarios WHERE auth_id = auth.uid())
    );

-- Políticas para equipos seguidos
CREATE POLICY "Usuarios pueden ver sus equipos seguidos" ON equipos_seguidos
    FOR SELECT USING (
        usuario_id IN (SELECT id FROM usuarios WHERE auth_id = auth.uid())
    );

CREATE POLICY "Usuarios pueden seguir equipos" ON equipos_seguidos
    FOR INSERT WITH CHECK (
        usuario_id IN (SELECT id FROM usuarios WHERE auth_id = auth.uid())
    );

CREATE POLICY "Usuarios pueden dejar de seguir equipos" ON equipos_seguidos
    FOR DELETE USING (
        usuario_id IN (SELECT id FROM usuarios WHERE auth_id = auth.uid())
    );

-- =====================================================
-- DATOS DE EJEMPLO (opcional - comentar en producción)
-- =====================================================
/*
-- Insertar usuario admin de prueba
INSERT INTO usuarios (email, nombre, rol) VALUES 
('admin@goalfut.com', 'Administrador Demo', 'admin');

-- Insertar torneo de prueba
INSERT INTO torneos (admin_id, nombre, descripcion, cantidad_equipos) VALUES 
((SELECT id FROM usuarios WHERE email = 'admin@goalfut.com'), 
 'Copa del Barrio 2026', 
 'Torneo de fútbol sala del barrio San Miguel', 
 8);
*/
