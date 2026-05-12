# Plan de Migración Firebase → Supabase

## Rama: `feat/supabase-migration`

---

## Estado General

| Fase | Descripción | Estado |
|------|-------------|--------|
| 0 | Infraestructura Supabase | ✅ COMPLETADA |
| 1 | Schema PostgreSQL | ✅ COMPLETADA |
| 2 | Migración de datos | ✅ COMPLETADA |
| 3 | Auth (archivos nuevos) | ✅ COMPLETADA |
| 4 | Servicios de datos | ✅ COMPLETADA |
| 5 | Hooks y uso directo Firestore | ✅ COMPLETADA |
| 6 | API Routes (preparación) | ✅ COMPLETADA |
| 7 | Storage (PDFs) | ⬜ PENDIENTE |
| 8 | Switch (reemplazar imports) | ⬜ PENDIENTE |
| 9 | Cleanup (borrar Firebase) | ⬜ PENDIENTE |

---

## Fase 0: Infraestructura ✅

**Dependencias instaladas:**
- `@supabase/supabase-js`
- `@supabase/ssr`

**Archivos creados:**
- `lib/supabase.ts` — cliente browser (equivale a `lib/firebase.ts`)
- `lib/supabase-admin.ts` — cliente server con service role (equivale a `lib/firebase-admin.ts`)

**Env vars en `.env.local`:**
```
NEXT_PUBLIC_SUPABASE_URL=https://zpfzstvbvpyhlkfawhhe.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<configurada>
SUPABASE_SERVICE_ROLE_KEY=<configurada>
```

---

## Fase 1: Schema PostgreSQL ✅

**Archivo:** `supabase/schema.sql` — ejecutado en Supabase SQL Editor.

**17 tablas creadas:**
1. `vendedores` — empleados/vendedores
2. `productos` — catálogo de productos
3. `clientes` — clientes
4. `cliente_direcciones` — direcciones de clientes (normalizado desde array embebido)
5. `listas_precios` — listas de precios
6. `configuracion` — config key/value con JSONB
7. `caja` — caja diaria
8. `usuarios` — perfiles de usuario (FK → vendedores, auth.users)
9. `pedidos` — pedidos (FK → clientes, vendedores)
10. `pedido_items` — items de pedido (normalizado desde array embebido)
11. `ventas` — ventas (FK → clientes, vendedores, pedidos)
12. `venta_items` — items de venta (normalizado desde array embebido)
13. `venta_afip_data` — datos AFIP 1:1 con ventas (normalizado desde objeto embebido)
14. `transacciones` — transacciones de crédito/pago
15. `comisiones` — comisiones de vendedores
16. `auditoria` — log de auditoría

**Enums:** user_role, employee_type, tax_category, payment_type, payment_method, sale_status, sale_source, invoice_status, order_status, delivery_method, discount_type, transaction_type, price_list_type, cash_register_status, audit_action

**Funciones:**
- `generate_readable_id(table, prefix, identifier)` — genera IDs legibles tipo `cliente_juan_1`
- `adjust_client_balance(client_id, amount)` — ajuste atómico de saldo
- `update_updated_at()` — trigger para `pedidos.updated_at`

**RLS Policies:**
- `get_user_role()` y `get_user_seller_id()` como helpers
- Productos: lectura pública, escritura admin
- Ventas: admin ve todo, seller ve las propias
- Pedidos: admin ve todo, seller/transportista ve asignados
- Clientes: admin y seller pueden leer
- Comisiones: admin ve todo, seller ve las propias

---

## Fase 2: Migración de datos ✅

**Script:** `scripts/migrate-to-supabase.ts` (ejecutar con `npx tsx scripts/migrate-to-supabase.ts`)

**Resultados de la migración:**

| Tabla | Migrados | Notas |
|-------|----------|-------|
| vendedores | 3 | OK |
| productos | 94 | OK |
| clientes | 350 | OK |
| cliente_direcciones | 4 | OK |
| usuarios | 13 | 3 con sellerId huérfano (nulleado) |
| pedidos | 11 | OK |
| pedido_items | 15 | OK |
| ventas | 12 | OK |
| venta_items | 13 | OK |
| venta_afip_data | 3 | OK |
| transacciones | 1 | 2 con clientId inexistente (omitidas) |
| comisiones | 2 | 14 con FK huérfana por IDs viejos Firebase (omitidas) |
| auditoria | 0 | Solo 1 doc en Firestore, no pasó filtro de action válida |
| listas_precios | 0 | No había datos |
| configuracion | 1 | Transferencia migrada |
| caja | 1 | OK |

**Datos huérfanos:** Son de IDs auto-generados de Firebase (antes del sistema de readable IDs). No afectan operación actual.

---

## Fase 3: Auth ✅

**Estrategia:** Crear archivos nuevos con sufijo `-supabase` sin tocar los existentes de Firebase. El switch se hace después cambiando imports.

**Archivos creados:**

| Archivo nuevo | Reemplaza a | Función |
|---|---|---|
| `services/auth-service-supabase.ts` | `services/auth-service.ts` | signIn, signOut, Google OAuth, getAuthToken |
| `services/users-service-supabase.ts` | `services/users-service.ts` | getUserProfile, ensureUserProfile |
| `hooks/use-auth-supabase.ts` | `hooks/use-auth.ts` | Hook de auth React |
| `lib/supabase-auth-helper.ts` | `adminAuth.verifyIdToken()` en API routes | Verificación de token server-side |

**Cambios clave vs Firebase:**
- `signInWithEmailAndPassword` → `supabase.auth.signInWithPassword`
- `signInWithPopup(GoogleAuthProvider)` → `supabase.auth.signInWithOAuth({ provider: 'google' })`
- `onAuthStateChanged` → `supabase.auth.onAuthStateChange`
- `currentUser.getIdToken()` → `supabase.auth.getSession().access_token`
- `adminAuth.verifyIdToken(token)` → `supabaseAdmin.auth.getUser(token)`
- `firebaseUser.uid` → `supabaseUser.id`
- `firebaseUser.displayName` → `supabaseUser.user_metadata.full_name`

**Prerequisito dashboard:** Habilitar Google OAuth en Supabase → Authentication → Providers con las mismas credenciales de Google Cloud.

**API routes que usan `adminAuth.verifyIdToken` (11 archivos a actualizar en Fase 6):**
- `app/api/ventas/emitir/route.ts`
- `app/api/remitos/route.ts`
- `app/api/drive/route.ts`
- `app/api/afip/test/route.ts`
- `app/api/afip/cuit/route.ts`
- `app/api/facturacion/route.ts`
- `app/api/facturacion/comprobantes/route.ts`
- `app/api/facturacion/consultar-cuit/route.ts`
- `app/api/facturacion/reimprimir/route.ts`
- `app/api/facturacion/pdf/[saleId]/route.tsx`
- `app/api/facturacion/pdf/[saleId]/route.txt` (backup, no es código activo)

---

## Fase 4: Servicios de datos ✅ COMPLETADA

**Archivos creados (12):**

| Archivo | Descripción |
|---|---|
| `services/supabase-helpers.ts` | Helper base: toDate, slugify, generateReadableId via RPC |
| `services/products-service-supabase.ts` | CRUD productos con paginación offset |
| `services/clients-service-supabase.ts` | CRUD clientes + JOIN cliente_direcciones |
| `services/sellers-service-supabase.ts` | CRUD vendedores + sync employeeType a usuarios |
| `services/sales-service-supabase.ts` | processSale multi-tabla, items normalizados, comisiones |
| `services/orders-service-supabase.ts` | CRUD pedidos + pedido_items normalizados |
| `services/payments-service-supabase.ts` | Pagos con RPC adjust_client_balance |
| `services/commissions-service-supabase.ts` | Lectura comisiones + resumen |
| `services/audit-service-supabase.ts` | Log auditoría insert/select |
| `services/dashboard-service-supabase.ts` | Queries optimizadas con JOINs |
| `services/price-list-service-supabase.ts` | CRUD listas de precios |
| `services/transfer-config-service-supabase.ts` | Config transferencia en tabla configuracion |

**Patrón de traducción Firestore → Supabase:**
```
getDocs(collection(db, 'tabla'))         → supabase.from('tabla').select('*')
getDoc(doc(db, 'tabla', id))             → supabase.from('tabla').select('*').eq('id', id).single()
setDoc(doc(db, 'tabla', id), data)       → supabase.from('tabla').insert({ id, ...data })
updateDoc(doc(db, 'tabla', id), data)    → supabase.from('tabla').update(data).eq('id', id)
deleteDoc(doc(db, 'tabla', id))          → supabase.from('tabla').delete().eq('id', id)
query(where('field','==',val))           → .eq('field', val)
query(orderBy('field','desc'))           → .order('field', { ascending: false })
query(limit(n))                          → .limit(n)
startAfter(lastDoc)                      → .range(offset, offset + limit - 1)
increment(n)                             → supabase.rpc('adjust_client_balance', {...})
generateReadableId(db, col, pre, name)   → supabase.rpc('generate_readable_id', {...})
```

**Convención de nombres camelCase → snake_case:**
```
clientId      → client_id
sellerId      → seller_id
createdAt     → created_at
isActive      → is_active
employeeType  → employee_type
taxCategory   → tax_category
paymentType   → payment_type
commissionRate → commission_rate
etc.
```

**Helper a crear:** `services/supabase-helpers.ts` — reemplaza `services/firestore-helpers.ts`
- `toDate()` simplificado (Supabase retorna ISO strings)
- `slugify()` sin cambios
- `generateReadableId()` → llama RPC

---

## Fase 5: Hooks ✅ COMPLETADA

**Archivo creado:** `hooks/useVentas-supabase.ts`

Cambios clave vs Firebase:
- `cargarVentas` usa `supabase.from('ventas').select('*, venta_items(*), venta_afip_data(*)')` con JOIN
- `mapVentaRow()` convierte snake_case → camelCase y reconstruye items/afipData desde relaciones
- Auth token via `supabase.auth.getSession()` en vez de `getAuth().currentUser.getIdToken()`
- Updates con `supabase.from('ventas').update({...}).eq('id', id)`
- AFIP data se guarda en `venta_afip_data` con upsert (tabla separada)
- Remito number query usa `supabase.from('ventas')` con `.not('remito_number', 'is', null)`
- `resolverTelefono` y `fetchClientData` usan `supabase.from('clientes')`

**`hooks/useCart.ts`** — No tiene acceso directo a Firestore, usa `lib/api.ts`. Sin cambios necesarios.

---

## Fase 6: API Routes (preparación) ✅ COMPLETADA

**Archivo creado:** `lib/facturacion-helper-supabase.ts`
- Reemplaza `adminFirestore` por `supabaseAdmin`
- Lee venta con JOIN `venta_items(*)`
- Usa `client.tax_category` (snake_case) vs `clientData.taxCategory`
- Guarda AFIP data en `venta_afip_data` (tabla separada, upsert)
- Parámetro renombrado: `collectionName` → `tableName`

**Las API routes se modificarán directamente en Fase 8** (no se pueden crear archivos paralelos para rutas).

### Cambios necesarios por ruta (referencia para Fase 8):

**Rutas protegidas (auth: `adminAuth.verifyIdToken` → `verifyAuthToken`):**
1. `api/ventas/emitir` — solo auth + import facturacion-helper
2. `api/facturacion` — solo auth + import facturacion-helper
3. `api/facturacion/comprobantes` — solo auth (no usa Firestore)
4. `api/facturacion/consultar-cuit` — solo auth (no usa Firestore)
5. `api/facturacion/reimprimir` — auth + `adminFirestore` → `supabaseAdmin` (lee venta, actualiza PDF)
6. `api/facturacion/pdf/[saleId]` — auth + `adminFirestore` → `supabaseAdmin` + `adminStorage` → Supabase Storage
7. `api/drive` — solo auth (no usa Firestore)
8. `api/afip/test` — solo auth (no usa Firestore)
9. `api/afip/cuit` — solo auth (no usa Firestore)
10. `api/remitos` — auth + `adminFirestore` → `supabaseAdmin` (lee/escribe ventas)

**Rutas públicas (`adminFirestore` → `supabaseAdmin`):**
1. `api/public/productos` — query simple
2. `api/public/clientes` — búsqueda por DNI/CUIT/query libre
3. `api/public/vendedores` — búsqueda por email
4. `api/public/pedidos` — crear pedido + cliente (más complejo)
5. `api/public/mas-vendidos` — JOIN optimizado con venta_items

**Ruta con Firebase client SDK (no admin):**
1. `api/register-debt` — usa `firestore` client + `firestore-helpers` → `supabaseAdmin`

**Ruta de transacciones:**
1. `api/public/clientes/[id]/transactions` — query simple

---

## Fase 7: Storage ⬜ PENDIENTE

- Crear bucket `pdfs` en Supabase Storage
- Crear `lib/supabase-storage.ts` (reemplaza `lib/storage.ts`)
- `uploadPDF()` → `supabase.storage.from('pdfs').upload(path, buffer)`
- Oportunidad: dejar de guardar base64 en tabla, solo URL

---

## Fase 8: Switch ⬜ PENDIENTE

Reemplazar los imports en todo el proyecto:
- `@/services/auth-service` → `@/services/auth-service-supabase`
- `@/services/users-service` → `@/services/users-service-supabase`
- `@/hooks/use-auth` → `@/hooks/use-auth-supabase`
- Y todos los servicios de datos

**Alternativa más limpia:** Renombrar archivos Firebase a `*-firebase.ts` y Supabase a los nombres originales.

---

## Fase 9: Cleanup ⬜ PENDIENTE

1. Desinstalar: `firebase`, `firebase-admin`
2. Eliminar: `lib/firebase.ts`, `lib/firebase-admin.ts`, `lib/storage.ts`, `services/firestore-helpers.ts`
3. Eliminar archivos con sufijo `-firebase.ts`
4. Eliminar env vars Firebase de `.env.local` y Vercel
5. Actualizar `CLAUDE.md`
6. Eliminar `scripts/migrate-to-supabase.ts`

---

## Sin cambios (permanecen igual en toda la migración)

- **AFIP SDK** (`@afipsdk/afip.js`) — independiente de la DB
- **Google Drive API** (`googleapis`) — solo cambia verificación de auth token
- **PDF generation** (`@react-pdf/renderer`, `puppeteer-core`)
- **Rate limiting** (`lib/rate-limit.ts`)
- **Middleware** (`middleware.ts`)

---

## Archivos clave de referencia

- `lib/types.ts` — Todas las interfaces TypeScript (no cambian)
- `supabase/schema.sql` — Schema completo de PostgreSQL
- `scripts/migrate-to-supabase.ts` — Script de migración de datos
- `.env.local` — Credenciales Firebase + Supabase

---

## Notas importantes

1. **No se toca código existente** hasta la Fase 8 (switch). Todo funciona con Firebase mientras tanto.
2. **Items normalizados** — `venta_items` y `pedido_items` son tablas propias, no arrays JSONB. Los servicios Supabase deben insertar/leer items por separado.
3. **Direcciones normalizadas** — `cliente_direcciones` es tabla propia. El servicio de clientes debe hacer JOIN al leer y batch insert al escribir.
4. **AFIP data normalizada** — `venta_afip_data` es tabla 1:1. El servicio de ventas debe insertar/leer por separado.
5. **Readable IDs** — Se mantienen via función PostgreSQL `generate_readable_id()`, llamada con `supabase.rpc()`.
6. **FK circular** — `ventas.order_id ↔ pedidos.sale_id`. El script de migración inserta pedidos sin sale_id primero, luego actualiza después de insertar ventas.
7. **Usuarios migrados sin auth_uid** — Los usuarios de Firebase se migraron con `auth_uid: null`. Se vincula automáticamente cuando se loguean por primera vez en Supabase Auth (`ensureUserProfile` busca por email y actualiza el `auth_uid`).
