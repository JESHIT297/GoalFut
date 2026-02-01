-- Migración para agregar campos de W.O. (Walkover)
-- Ejecutar en SQL Editor de Supabase

ALTER TABLE torneos ADD COLUMN IF NOT EXISTS goles_wo_ganador INTEGER DEFAULT 3;
ALTER TABLE torneos ADD COLUMN IF NOT EXISTS goles_wo_perdedor INTEGER DEFAULT 0;

-- Comentarios
COMMENT ON COLUMN torneos.goles_wo_ganador IS 'Goles que se le asignan al equipo ganador por W.O.';
COMMENT ON COLUMN torneos.goles_wo_perdedor IS 'Goles que se le asignan al equipo perdedor por W.O.';
