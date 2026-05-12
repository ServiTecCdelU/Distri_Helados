-- ============================================
-- Schema Heladería - Migración Firebase → Supabase
-- Ejecutar en Supabase SQL Editor
-- ============================================

-- Extensiones necesarias
CREATE EXTENSION IF NOT EXISTS unaccent;

-- ============================================
-- 1. ENUMS
-- ============================================

CREATE TYPE user_role AS ENUM ('admin', 'seller', 'customer');
CREATE TYPE employee_type AS ENUM ('vendedor', 'transportista', 'ambos');
CREATE TYPE tax_category AS ENUM ('responsable_inscripto', 'monotributo', 'consumidor_final', 'exento', 'no_responsable');
CREATE TYPE payment_type AS ENUM ('cash', 'credit', 'mixed');
CREATE TYPE payment_method AS ENUM ('efectivo', 'transferencia');
CREATE TYPE sale_status AS ENUM ('completed', 'pending');
CREATE TYPE sale_source AS ENUM ('direct', 'order');
CREATE TYPE invoice_status AS ENUM ('pending', 'generated', 'emitted', 'sent_whatsapp');
CREATE TYPE order_status AS ENUM ('pending', 'preparation', 'delivery', 'completed');
CREATE TYPE delivery_method AS ENUM ('pickup', 'delivery');
CREATE TYPE discount_type AS ENUM ('percent', 'fixed');
CREATE TYPE transaction_type AS ENUM ('debt', 'payment');
CREATE TYPE price_list_type AS ENUM ('general', 'mayorista', 'especial');
CREATE TYPE cash_register_status AS ENUM ('open', 'closed');
CREATE TYPE audit_action AS ENUM (
  'sale_created', 'sale_invoiced', 'product_created', 'product_updated',
  'product_deleted', 'client_created', 'client_updated', 'client_deleted',
  'order_created', 'order_status_changed', 'cash_register_opened',
  'cash_register_closed', 'payment_registered', 'price_list_updated'
);

-- ============================================
-- 2. TABLAS (orden por dependencias FK)
-- ============================================

-- Vendedores/Empleados (sin FK)
CREATE TABLE vendedores (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  employee_type employee_type NOT NULL DEFAULT 'vendedor',
  commission_rate NUMERIC(5,2) NOT NULL DEFAULT 0,
  transportista_commission_rate NUMERIC(5,2),
  is_active BOOLEAN NOT NULL DEFAULT true,
  total_sales NUMERIC(12,2) NOT NULL DEFAULT 0,
  total_commission NUMERIC(12,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_vendedores_email ON vendedores(email);
CREATE INDEX idx_vendedores_active ON vendedores(is_active);

-- Productos (sin FK)
CREATE TABLE productos (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  price NUMERIC(10,2) NOT NULL,
  stock INTEGER NOT NULL DEFAULT 0,
  image_url TEXT,
  category TEXT,
  base TEXT DEFAULT 'crema',
  marca TEXT DEFAULT 'Sin identificar',
  sin_tacc BOOLEAN NOT NULL DEFAULT false,
  disabled BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_productos_category ON productos(category);
CREATE INDEX idx_productos_disabled ON productos(disabled);

-- Clientes (sin FK)
CREATE TABLE clientes (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  dni TEXT,
  cuit TEXT,
  email TEXT,
  phone TEXT,
  address TEXT,
  tax_category tax_category NOT NULL DEFAULT 'consumidor_final',
  credit_limit NUMERIC(12,2) NOT NULL DEFAULT 0,
  current_balance NUMERIC(12,2) NOT NULL DEFAULT 0,
  notes TEXT DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_clientes_cuit ON clientes(cuit);
CREATE INDEX idx_clientes_email ON clientes(email);
CREATE INDEX idx_clientes_name ON clientes(name);

-- Direcciones de clientes (FK → clientes)
CREATE TABLE cliente_direcciones (
  id SERIAL PRIMARY KEY,
  client_id TEXT NOT NULL REFERENCES clientes(id) ON DELETE CASCADE,
  city TEXT NOT NULL,
  address TEXT NOT NULL,
  lat DOUBLE PRECISION,
  lng DOUBLE PRECISION,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_cliente_direcciones_client ON cliente_direcciones(client_id);

-- Listas de precios (sin FK)
CREATE TABLE listas_precios (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  type price_list_type NOT NULL,
  description TEXT,
  multiplier NUMERIC(5,3) NOT NULL DEFAULT 1.000,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Configuración key/value (sin FK)
CREATE TABLE configuracion (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
-- Seed de configuración inicial
INSERT INTO configuracion (key, value) VALUES ('transferencia', '{"alias":"","titular":"","banco":""}');

-- Caja diaria (sin FK)
CREATE TABLE caja (
  id TEXT PRIMARY KEY,
  opened_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  closed_at TIMESTAMPTZ,
  opened_by TEXT NOT NULL,
  closed_by TEXT,
  initial_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  final_amount NUMERIC(12,2),
  expected_amount NUMERIC(12,2),
  difference NUMERIC(12,2),
  status cash_register_status NOT NULL DEFAULT 'open',
  notes TEXT,
  sales_count INTEGER,
  total_sales NUMERIC(12,2),
  cash_total NUMERIC(12,2),
  credit_total NUMERIC(12,2)
);
CREATE INDEX idx_caja_status ON caja(status);
CREATE INDEX idx_caja_opened ON caja(opened_at DESC);

-- Usuarios (FK → vendedores, auth.users)
CREATE TABLE usuarios (
  id TEXT PRIMARY KEY,
  auth_uid UUID UNIQUE REFERENCES auth.users(id) ON DELETE SET NULL,
  email TEXT NOT NULL,
  name TEXT NOT NULL,
  role user_role NOT NULL DEFAULT 'customer',
  seller_id TEXT REFERENCES vendedores(id) ON DELETE SET NULL,
  employee_type employee_type,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_usuarios_auth_uid ON usuarios(auth_uid);
CREATE INDEX idx_usuarios_email ON usuarios(email);
CREATE INDEX idx_usuarios_seller_id ON usuarios(seller_id);

-- Pedidos (FK → clientes, vendedores)
CREATE TABLE pedidos (
  id TEXT PRIMARY KEY,
  sale_id TEXT,  -- FK se agrega después para evitar ciclo
  client_id TEXT REFERENCES clientes(id) ON DELETE SET NULL,
  client_name TEXT,
  client_phone TEXT,
  client_email TEXT,
  seller_id TEXT REFERENCES vendedores(id) ON DELETE SET NULL,
  seller_name TEXT,
  transportista_id TEXT REFERENCES vendedores(id) ON DELETE SET NULL,
  transportista_name TEXT,
  status order_status NOT NULL DEFAULT 'pending',
  city TEXT,
  address TEXT NOT NULL DEFAULT 'Retiro en local',
  lat DOUBLE PRECISION,
  lng DOUBLE PRECISION,
  delivery_method delivery_method,
  remito_number TEXT,
  remito_pdf_base64 TEXT,
  invoice_number TEXT,
  invoice_pdf_base64 TEXT,
  checked_items TEXT[] DEFAULT '{}',
  source TEXT DEFAULT 'direct',
  discount NUMERIC(10,2),
  discount_type discount_type,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_pedidos_client ON pedidos(client_id);
CREATE INDEX idx_pedidos_seller ON pedidos(seller_id);
CREATE INDEX idx_pedidos_transportista ON pedidos(transportista_id);
CREATE INDEX idx_pedidos_status ON pedidos(status);
CREATE INDEX idx_pedidos_created ON pedidos(created_at DESC);

-- Items de pedido (FK → pedidos, productos)
CREATE TABLE pedido_items (
  id SERIAL PRIMARY KEY,
  order_id TEXT NOT NULL REFERENCES pedidos(id) ON DELETE CASCADE,
  product_id TEXT REFERENCES productos(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  quantity INTEGER NOT NULL,
  price NUMERIC(10,2) NOT NULL,
  item_discount NUMERIC(5,2)
);
CREATE INDEX idx_pedido_items_order ON pedido_items(order_id);

-- Ventas (FK → clientes, vendedores, pedidos)
CREATE TABLE ventas (
  id TEXT PRIMARY KEY,
  sale_number TEXT,
  client_id TEXT REFERENCES clientes(id) ON DELETE SET NULL,
  client_name TEXT,
  client_phone TEXT,
  client_cuit TEXT,
  client_dni TEXT,
  client_email TEXT,
  client_address TEXT,
  client_tax_category tax_category,
  seller_id TEXT REFERENCES vendedores(id) ON DELETE SET NULL,
  seller_name TEXT,
  source sale_source DEFAULT 'direct',
  total NUMERIC(12,2) NOT NULL,
  payment_type payment_type NOT NULL,
  payment_method payment_method DEFAULT 'efectivo',
  cash_amount NUMERIC(12,2),
  credit_amount NUMERIC(12,2),
  overpayment NUMERIC(12,2),
  status sale_status NOT NULL DEFAULT 'completed',
  discount NUMERIC(10,2),
  discount_type discount_type,
  order_id TEXT REFERENCES pedidos(id) ON DELETE SET NULL,
  invoice_emitted BOOLEAN NOT NULL DEFAULT false,
  invoice_status invoice_status DEFAULT 'pending',
  invoice_number TEXT,
  invoice_pdf_base64 TEXT,
  invoice_pdf_url TEXT,
  invoice_whatsapp_url TEXT,
  invoice_drive_url TEXT,
  invoice_drive_file_id TEXT,
  invoice_filename TEXT,
  invoice_pdf_size INTEGER,
  remito_number TEXT,
  remito_pdf_base64 TEXT,
  remito_pdf_url TEXT,
  remito_drive_url TEXT,
  remito_drive_file_id TEXT,
  remito_filename TEXT,
  delivery_method delivery_method DEFAULT 'pickup',
  delivery_address TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  invoice_emitted_at TIMESTAMPTZ,
  remito_generated_at TIMESTAMPTZ,
  invoice_generated_at TIMESTAMPTZ
);
CREATE INDEX idx_ventas_client ON ventas(client_id);
CREATE INDEX idx_ventas_seller ON ventas(seller_id);
CREATE INDEX idx_ventas_created ON ventas(created_at DESC);
CREATE INDEX idx_ventas_order ON ventas(order_id);
CREATE INDEX idx_ventas_remito_number ON ventas(remito_number);
CREATE INDEX idx_ventas_invoice_emitted ON ventas(invoice_emitted);
CREATE INDEX idx_ventas_status ON ventas(status);

-- Resolver FK circular: pedidos.sale_id → ventas.id
ALTER TABLE pedidos ADD CONSTRAINT fk_pedidos_sale FOREIGN KEY (sale_id) REFERENCES ventas(id) ON DELETE SET NULL;

-- Datos AFIP de venta (1:1 con ventas)
CREATE TABLE venta_afip_data (
  sale_id TEXT PRIMARY KEY REFERENCES ventas(id) ON DELETE CASCADE,
  cae TEXT NOT NULL,
  cae_vencimiento TEXT NOT NULL,
  tipo_comprobante INTEGER NOT NULL,
  punto_venta INTEGER NOT NULL,
  numero_comprobante INTEGER NOT NULL
);

-- Items de venta (FK → ventas, productos)
CREATE TABLE venta_items (
  id SERIAL PRIMARY KEY,
  sale_id TEXT NOT NULL REFERENCES ventas(id) ON DELETE CASCADE,
  product_id TEXT REFERENCES productos(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  quantity INTEGER NOT NULL,
  price NUMERIC(10,2) NOT NULL,
  item_discount NUMERIC(5,2)
);
CREATE INDEX idx_venta_items_sale ON venta_items(sale_id);
CREATE INDEX idx_venta_items_product ON venta_items(product_id);

-- Transacciones de clientes (FK → clientes, ventas)
CREATE TABLE transacciones (
  id TEXT PRIMARY KEY,
  client_id TEXT NOT NULL REFERENCES clientes(id) ON DELETE CASCADE,
  type transaction_type NOT NULL,
  amount NUMERIC(12,2) NOT NULL,
  description TEXT,
  date TIMESTAMPTZ NOT NULL DEFAULT now(),
  sale_id TEXT REFERENCES ventas(id) ON DELETE SET NULL,
  sale_number TEXT
);
CREATE INDEX idx_transacciones_client ON transacciones(client_id);
CREATE INDEX idx_transacciones_date ON transacciones(date DESC);

-- Comisiones (FK → vendedores, ventas)
CREATE TABLE comisiones (
  id TEXT PRIMARY KEY,
  seller_id TEXT NOT NULL REFERENCES vendedores(id) ON DELETE CASCADE,
  sale_id TEXT NOT NULL REFERENCES ventas(id) ON DELETE CASCADE,
  sale_number TEXT,
  client_name TEXT,
  sale_total NUMERIC(12,2) NOT NULL,
  commission_rate NUMERIC(5,2) NOT NULL,
  commission_amount NUMERIC(12,2) NOT NULL,
  is_paid BOOLEAN NOT NULL DEFAULT false,
  paid_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_comisiones_seller ON comisiones(seller_id);
CREATE INDEX idx_comisiones_sale ON comisiones(sale_id);
CREATE INDEX idx_comisiones_is_paid ON comisiones(is_paid);

-- Auditoría (sin FK estricta)
CREATE TABLE auditoria (
  id TEXT PRIMARY KEY,
  action audit_action NOT NULL,
  user_id TEXT NOT NULL,
  user_name TEXT NOT NULL,
  description TEXT,
  entity_type TEXT,
  entity_id TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_auditoria_created ON auditoria(created_at DESC);
CREATE INDEX idx_auditoria_entity ON auditoria(entity_type, entity_id);
CREATE INDEX idx_auditoria_action ON auditoria(action);

-- ============================================
-- 3. FUNCIONES
-- ============================================

-- Generar IDs legibles (equivalente a generateReadableId de Firestore)
CREATE OR REPLACE FUNCTION generate_readable_id(
  p_table TEXT,
  p_prefix TEXT,
  p_identifier TEXT
) RETURNS TEXT AS $$
DECLARE
  v_slug TEXT;
  v_base TEXT;
  v_num INT := 1;
  v_candidate TEXT;
  v_exists BOOLEAN;
BEGIN
  -- Slugify: lowercase, quitar acentos, solo alfanuméricos y guiones bajos
  v_slug := lower(unaccent(trim(p_identifier)));
  v_slug := regexp_replace(v_slug, '\s+', '_', 'g');
  v_slug := regexp_replace(v_slug, '[^a-z0-9_]', '', 'g');
  v_slug := regexp_replace(v_slug, '_+', '_', 'g');
  v_slug := trim(both '_' from v_slug);

  IF v_slug = '' THEN
    v_slug := 'item';
  END IF;

  v_base := p_prefix || '_' || v_slug;

  LOOP
    v_candidate := v_base || '_' || v_num;
    EXECUTE format('SELECT EXISTS(SELECT 1 FROM %I WHERE id = $1)', p_table)
      INTO v_exists USING v_candidate;
    IF NOT v_exists THEN
      RETURN v_candidate;
    END IF;
    v_num := v_num + 1;
    IF v_num >= 1000 THEN
      RETURN v_base || '_' || extract(epoch from now())::bigint;
    END IF;
  END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Ajustar saldo de cliente atómicamente (reemplaza increment() de Firestore)
CREATE OR REPLACE FUNCTION adjust_client_balance(
  p_client_id TEXT,
  p_amount NUMERIC
) RETURNS NUMERIC AS $$
DECLARE
  v_new_balance NUMERIC;
BEGIN
  UPDATE clientes
  SET current_balance = current_balance + p_amount
  WHERE id = p_client_id
  RETURNING current_balance INTO v_new_balance;

  RETURN v_new_balance;
END;
$$ LANGUAGE plpgsql;

-- Actualizar updated_at automáticamente en pedidos
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tr_pedidos_updated_at
  BEFORE UPDATE ON pedidos
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

-- ============================================
-- 4. ROW LEVEL SECURITY (RLS)
-- ============================================

-- Habilitar RLS en todas las tablas
ALTER TABLE usuarios ENABLE ROW LEVEL SECURITY;
ALTER TABLE vendedores ENABLE ROW LEVEL SECURITY;
ALTER TABLE productos ENABLE ROW LEVEL SECURITY;
ALTER TABLE clientes ENABLE ROW LEVEL SECURITY;
ALTER TABLE cliente_direcciones ENABLE ROW LEVEL SECURITY;
ALTER TABLE ventas ENABLE ROW LEVEL SECURITY;
ALTER TABLE venta_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE venta_afip_data ENABLE ROW LEVEL SECURITY;
ALTER TABLE pedidos ENABLE ROW LEVEL SECURITY;
ALTER TABLE pedido_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE transacciones ENABLE ROW LEVEL SECURITY;
ALTER TABLE comisiones ENABLE ROW LEVEL SECURITY;
ALTER TABLE auditoria ENABLE ROW LEVEL SECURITY;
ALTER TABLE listas_precios ENABLE ROW LEVEL SECURITY;
ALTER TABLE configuracion ENABLE ROW LEVEL SECURITY;
ALTER TABLE caja ENABLE ROW LEVEL SECURITY;

-- Funciones helper para RLS
CREATE OR REPLACE FUNCTION get_user_role()
RETURNS user_role AS $$
BEGIN
  RETURN (SELECT role FROM usuarios WHERE auth_uid = auth.uid());
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION get_user_seller_id()
RETURNS TEXT AS $$
BEGIN
  RETURN (SELECT seller_id FROM usuarios WHERE auth_uid = auth.uid());
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- === PRODUCTOS ===
CREATE POLICY "productos_select" ON productos FOR SELECT USING (true);
CREATE POLICY "productos_insert" ON productos FOR INSERT WITH CHECK (get_user_role() = 'admin');
CREATE POLICY "productos_update" ON productos FOR UPDATE USING (get_user_role() = 'admin');
CREATE POLICY "productos_delete" ON productos FOR DELETE USING (get_user_role() = 'admin');

-- === CLIENTES ===
CREATE POLICY "clientes_select" ON clientes FOR SELECT USING (get_user_role() IN ('admin', 'seller'));
CREATE POLICY "clientes_insert" ON clientes FOR INSERT WITH CHECK (get_user_role() IN ('admin', 'seller'));
CREATE POLICY "clientes_update" ON clientes FOR UPDATE USING (get_user_role() = 'admin');
CREATE POLICY "clientes_delete" ON clientes FOR DELETE USING (get_user_role() = 'admin');

-- === CLIENTE_DIRECCIONES ===
CREATE POLICY "cliente_dir_select" ON cliente_direcciones FOR SELECT USING (get_user_role() IN ('admin', 'seller'));
CREATE POLICY "cliente_dir_insert" ON cliente_direcciones FOR INSERT WITH CHECK (get_user_role() IN ('admin', 'seller'));
CREATE POLICY "cliente_dir_update" ON cliente_direcciones FOR UPDATE USING (get_user_role() = 'admin');
CREATE POLICY "cliente_dir_delete" ON cliente_direcciones FOR DELETE USING (get_user_role() = 'admin');

-- === VENDEDORES ===
CREATE POLICY "vendedores_select" ON vendedores FOR SELECT USING (get_user_role() IN ('admin', 'seller'));
CREATE POLICY "vendedores_insert" ON vendedores FOR INSERT WITH CHECK (get_user_role() = 'admin');
CREATE POLICY "vendedores_update" ON vendedores FOR UPDATE USING (get_user_role() = 'admin');
CREATE POLICY "vendedores_delete" ON vendedores FOR DELETE USING (get_user_role() = 'admin');

-- === VENTAS ===
CREATE POLICY "ventas_admin" ON ventas FOR ALL USING (get_user_role() = 'admin');
CREATE POLICY "ventas_seller_select" ON ventas FOR SELECT USING (
  get_user_role() = 'seller' AND seller_id = get_user_seller_id()
);
CREATE POLICY "ventas_seller_insert" ON ventas FOR INSERT WITH CHECK (get_user_role() = 'seller');

-- === VENTA_ITEMS ===
CREATE POLICY "venta_items_admin" ON venta_items FOR ALL USING (get_user_role() = 'admin');
CREATE POLICY "venta_items_seller_select" ON venta_items FOR SELECT USING (
  get_user_role() = 'seller' AND EXISTS (
    SELECT 1 FROM ventas WHERE ventas.id = venta_items.sale_id AND ventas.seller_id = get_user_seller_id()
  )
);
CREATE POLICY "venta_items_seller_insert" ON venta_items FOR INSERT WITH CHECK (get_user_role() = 'seller');

-- === VENTA_AFIP_DATA ===
CREATE POLICY "venta_afip_admin" ON venta_afip_data FOR ALL USING (get_user_role() = 'admin');
CREATE POLICY "venta_afip_seller_select" ON venta_afip_data FOR SELECT USING (
  get_user_role() = 'seller' AND EXISTS (
    SELECT 1 FROM ventas WHERE ventas.id = venta_afip_data.sale_id AND ventas.seller_id = get_user_seller_id()
  )
);

-- === PEDIDOS ===
CREATE POLICY "pedidos_admin" ON pedidos FOR ALL USING (get_user_role() = 'admin');
CREATE POLICY "pedidos_seller_select" ON pedidos FOR SELECT USING (
  get_user_role() = 'seller' AND (
    seller_id = get_user_seller_id() OR transportista_id = get_user_seller_id()
  )
);
CREATE POLICY "pedidos_seller_insert" ON pedidos FOR INSERT WITH CHECK (get_user_role() = 'seller');
CREATE POLICY "pedidos_seller_update" ON pedidos FOR UPDATE USING (
  get_user_role() = 'seller' AND (
    seller_id = get_user_seller_id() OR transportista_id = get_user_seller_id()
  )
);

-- === PEDIDO_ITEMS ===
CREATE POLICY "pedido_items_admin" ON pedido_items FOR ALL USING (get_user_role() = 'admin');
CREATE POLICY "pedido_items_seller_select" ON pedido_items FOR SELECT USING (
  get_user_role() = 'seller' AND EXISTS (
    SELECT 1 FROM pedidos WHERE pedidos.id = pedido_items.order_id AND (
      pedidos.seller_id = get_user_seller_id() OR pedidos.transportista_id = get_user_seller_id()
    )
  )
);
CREATE POLICY "pedido_items_seller_insert" ON pedido_items FOR INSERT WITH CHECK (get_user_role() = 'seller');

-- === TRANSACCIONES ===
CREATE POLICY "transacciones_select" ON transacciones FOR SELECT USING (get_user_role() IN ('admin', 'seller'));
CREATE POLICY "transacciones_insert" ON transacciones FOR INSERT WITH CHECK (get_user_role() IN ('admin', 'seller'));
CREATE POLICY "transacciones_update" ON transacciones FOR UPDATE USING (get_user_role() = 'admin');
CREATE POLICY "transacciones_delete" ON transacciones FOR DELETE USING (get_user_role() = 'admin');

-- === COMISIONES ===
CREATE POLICY "comisiones_admin" ON comisiones FOR ALL USING (get_user_role() = 'admin');
CREATE POLICY "comisiones_seller_select" ON comisiones FOR SELECT USING (
  get_user_role() = 'seller' AND seller_id = get_user_seller_id()
);

-- === AUDITORIA ===
CREATE POLICY "auditoria_admin_select" ON auditoria FOR SELECT USING (get_user_role() = 'admin');
CREATE POLICY "auditoria_insert" ON auditoria FOR INSERT WITH CHECK (get_user_role() IN ('admin', 'seller'));

-- === LISTAS_PRECIOS ===
CREATE POLICY "listas_precios_select" ON listas_precios FOR SELECT USING (get_user_role() IN ('admin', 'seller'));
CREATE POLICY "listas_precios_insert" ON listas_precios FOR INSERT WITH CHECK (get_user_role() = 'admin');
CREATE POLICY "listas_precios_update" ON listas_precios FOR UPDATE USING (get_user_role() = 'admin');
CREATE POLICY "listas_precios_delete" ON listas_precios FOR DELETE USING (get_user_role() = 'admin');

-- === CONFIGURACION ===
CREATE POLICY "config_select" ON configuracion FOR SELECT USING (true);
CREATE POLICY "config_insert" ON configuracion FOR INSERT WITH CHECK (get_user_role() = 'admin');
CREATE POLICY "config_update" ON configuracion FOR UPDATE USING (get_user_role() = 'admin');

-- === CAJA ===
CREATE POLICY "caja_admin" ON caja FOR ALL USING (get_user_role() = 'admin');
CREATE POLICY "caja_seller_select" ON caja FOR SELECT USING (get_user_role() = 'seller');

-- === USUARIOS ===
CREATE POLICY "usuarios_self_select" ON usuarios FOR SELECT USING (
  auth_uid = auth.uid() OR get_user_role() = 'admin'
);
CREATE POLICY "usuarios_admin_insert" ON usuarios FOR INSERT WITH CHECK (true); -- permite crear perfil al registrarse
CREATE POLICY "usuarios_admin_update" ON usuarios FOR UPDATE USING (
  auth_uid = auth.uid() OR get_user_role() = 'admin'
);
CREATE POLICY "usuarios_admin_delete" ON usuarios FOR DELETE USING (get_user_role() = 'admin');
