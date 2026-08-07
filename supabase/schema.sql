-- =============================================
-- ESQUEMA DE BASE DE DATOS - Mantenimiento de Aires Acondicionados
-- Le Café & Punta Brasas
-- =============================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TYPE user_role AS ENUM ('admin', 'tecnico', 'gerente');
CREATE TYPE marca_sucursal AS ENUM ('le_cafe', 'punta_brasas');
CREATE TYPE estado_visita AS ENUM ('pendiente', 'en_progreso', 'completada', 'omitida');
CREATE TYPE prioridad_emergencia AS ENUM ('1', '2', '3', '4', '5');

CREATE TABLE perfiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  nombre TEXT NOT NULL,
  email TEXT NOT NULL,
  rol user_role NOT NULL DEFAULT 'tecnico',
  telefono TEXT,
  activo BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE sucursales (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  nombre TEXT NOT NULL,
  marca marca_sucursal NOT NULL,
  direccion TEXT NOT NULL,
  ciudad TEXT,
  estado TEXT,
  codigo_postal TEXT,
  latitud DECIMAL(10, 8),
  longitud DECIMAL(11, 8),
  cantidad_mini_split INTEGER NOT NULL DEFAULT 0,
  cantidad_equipos_grandes INTEGER NOT NULL DEFAULT 0,
  cantidad_bombas_condensacion INTEGER NOT NULL DEFAULT 0,
  tiempo_estimado_minutos INTEGER NOT NULL DEFAULT 60,
  orden_ciclo INTEGER NOT NULL DEFAULT 0,
  activa BOOLEAN DEFAULT true,
  notas TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE ciclo_mantenimiento (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  nombre TEXT NOT NULL DEFAULT 'Ciclo Principal',
  fecha_inicio DATE NOT NULL DEFAULT CURRENT_DATE,
  sucursal_actual_orden INTEGER NOT NULL DEFAULT 0,
  activo BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE visitas_programadas (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  sucursal_id UUID NOT NULL REFERENCES sucursales(id) ON DELETE CASCADE,
  fecha_programada DATE NOT NULL,
  orden_del_dia INTEGER NOT NULL DEFAULT 1,
  estado estado_visita NOT NULL DEFAULT 'pendiente',
  tecnico_id UUID REFERENCES perfiles(id),
  trabajo_realizado TEXT,
  observaciones TEXT,
  tiempo_real_minutos INTEGER,
  es_emergencia BOOLEAN DEFAULT false,
  prioridad_emergencia prioridad_emergencia,
  fecha_inicio TIMESTAMPTZ,
  fecha_fin TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE problemas (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  sucursal_id UUID NOT NULL REFERENCES sucursales(id) ON DELETE CASCADE,
  reportado_por UUID NOT NULL REFERENCES perfiles(id),
  titulo TEXT NOT NULL,
  descripcion TEXT NOT NULL,
  prioridad prioridad_emergencia NOT NULL DEFAULT '3',
  convertido_a_emergencia BOOLEAN DEFAULT false,
  visita_emergencia_id UUID REFERENCES visitas_programadas(id),
  estado TEXT NOT NULL DEFAULT 'abierto' CHECK (estado IN ('abierto', 'en_revision', 'resuelto', 'cerrado')),
  resuelto_por UUID REFERENCES perfiles(id),
  fecha_resolucion TIMESTAMPTZ,
  notas_resolucion TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE archivos_problema (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  problema_id UUID NOT NULL REFERENCES problemas(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  tipo TEXT NOT NULL CHECK (tipo IN ('imagen', 'video')),
  nombre_archivo TEXT,
  tamanio_bytes INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_sucursales_marca ON sucursales(marca);
CREATE INDEX idx_sucursales_orden ON sucursales(orden_ciclo);
CREATE INDEX idx_visitas_fecha ON visitas_programadas(fecha_programada);
CREATE INDEX idx_visitas_estado ON visitas_programadas(estado);
CREATE INDEX idx_problemas_sucursal ON problemas(sucursal_id);
CREATE INDEX idx_problemas_estado ON problemas(estado);

ALTER TABLE perfiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE sucursales ENABLE ROW LEVEL SECURITY;
ALTER TABLE visitas_programadas ENABLE ROW LEVEL SECURITY;
ALTER TABLE problemas ENABLE ROW LEVEL SECURITY;
ALTER TABLE archivos_problema ENABLE ROW LEVEL SECURITY;
ALTER TABLE ciclo_mantenimiento ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Usuarios autenticados pueden ver perfiles" ON perfiles
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Usuarios pueden actualizar su propio perfil" ON perfiles
  FOR UPDATE TO authenticated USING (auth.uid() = id);

CREATE POLICY "Todos los autenticados ven sucursales" ON sucursales
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Solo admin puede modificar sucursales" ON sucursales
  FOR ALL TO authenticated USING (
    EXISTS (SELECT 1 FROM perfiles WHERE id = auth.uid() AND rol = 'admin')
  );

CREATE POLICY "Todos ven visitas" ON visitas_programadas
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Técnicos y admin pueden actualizar visitas" ON visitas_programadas
  FOR UPDATE TO authenticated USING (
    EXISTS (SELECT 1 FROM perfiles WHERE id = auth.uid() AND rol IN ('admin', 'tecnico'))
  );

CREATE POLICY "Todos pueden ver problemas" ON problemas
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Todos pueden crear problemas" ON problemas
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Admin y técnico pueden actualizar problemas" ON problemas
  FOR UPDATE TO authenticated USING (
    EXISTS (SELECT 1 FROM perfiles WHERE id = auth.uid() AND rol IN ('admin', 'tecnico'))
  );

CREATE POLICY "Todos ven archivos" ON archivos_problema
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Todos pueden subir archivos" ON archivos_problema
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.perfiles (id, nombre, email, rol)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'nombre', NEW.email),
    NEW.email,
    COALESCE((NEW.raw_user_meta_data->>'rol')::user_role, 'tecnico')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

INSERT INTO ciclo_mantenimiento (nombre, fecha_inicio, sucursal_actual_orden)
VALUES ('Ciclo Principal 2026', CURRENT_DATE, 0);
