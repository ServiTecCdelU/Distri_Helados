# CLAUDE.md

Este archivo guia a Claude Code cuando trabaja con este repositorio. **Siempre responder en español.**

CONTEXTO DEL PROYECTO
Este es un proyecto existente de gestión (productos, pedidos, etc.) para una distribuidora de helados de la marca Mío Helados.
REGLA CRÍTICA: NO toques, modifiques ni refactorices nada del sistema de gestión existente (ABM de productos, pedidos, dashboard, login, etc.). Solo agregá las nuevas secciones públicas.
Lo que necesito:
Agregar un frontend público (landing page / home) espectacular que sea la cara visible para los clientes. La parte de gestión interna (admin, productos, pedidos) ya existe y debe seguir funcionando exactamente igual.
Proveedor: Mío Helados

Web: https://www.miohelados.com.ar/
Se pueden usar su logo, imágenes de productos y banners directamente

NOMBRE DE LA DISTRIBUIDORA: [REEMPLAZÁ CON TU NOMBRE]
ZONA DE COBERTURA: [REEMPLAZÁ CON TU ZONA]
WHATSAPP: [REEMPLAZÁ CON TU NÚMERO con código de país, ej: 5493411234567]
## Commands

```bash
npm run dev       # Start development server
npm run build     # Production build (TypeScript errors are ignored — see next.config.mjs)
npm run lint      # Run ESLint
npm run start     # Start production server
```

No hay tests en este proyecto.

## Reglas del Proyecto

### Antes de hacer cambios
- Analizar el codigo existente.
- Mantener la arquitectura actual.
- No romper estilos ni componentes existentes.
- Revisar estilos existentes antes de tocar cualquier componente visual para mantener consistencia.

### Despues de hacer cambios — commit y push automaticamente
Siempre hacer commit y push al terminar cada tarea, sin esperar confirmacion del usuario:
1. Ejecutar `npm run build` y verificar que no haya errores.
2. Hacer `git add` de los archivos modificados.
3. Hacer commit con el mensaje apropiado.
4. Hacer `git push origin main`.

### Commit conventions (Conventional Commits)
- `feat:` nuevas funcionalidades
- `fix:` correcciones
- `refactor:` mejoras internas sin cambiar funcionalidad
- `style:` cambios visuales
- `docs:` documentacion
- **NUNCA** agregar `Co-Authored-By` ni ninguna referencia a Claude/AI en los commits.

### Reglas de estilo visual
- Border-radius estandar: `rounded-2xl`
- Paleta principal: teal/cyan
- Antes de modificar cualquier componente visual, revisar los estilos existentes para mantener consistencia.

### Prohibiciones — NO hacer sin consultar
- **No instalar librerias nuevas** sin consultarlo primero.
- **No crear componentes nuevos** si ya existe uno similar — reutilizar lo existente.
- **No modificar `next.config.mjs`**.
- **No cambiar la estructura de carpetas** sin confirmacion.
- **No reescribir logica que ya funciona** solo para "limpiarla" o "mejorarla".

## Reglas de Comportamiento

- Siempre responder en español.
- Leer archivos existentes antes de escribir código. No releer archivos ya leídos salvo que hayan podido cambiar.
- Preferir ediciones puntuales sobre reescribir archivos completos.
- Ser conciso en las respuestas, sin introducciones ni cierres innecesarios.
- No explicar lo que vas a hacer, hacerlo directamente.
- Mantener soluciones simples y directas.
- Si una tarea es ambigua, hacer una sola pregunta antes de empezar, no varias.
- Las instrucciones del usuario siempre tienen prioridad sobre este archivo.
- Razonar antes de actuar, pero ser breve en el output.
- Testear el código antes de declarar una tarea como terminada.

## Decisiones de Arquitectura (no revertir)

- El carrito es un unico componente `UnifiedCart` (`components/cart/UnifiedCart.tsx`) que se adapta por rol (`admin`, `seller`, `null`). La logica vive en `hooks/useCart.ts`.
- AFIP billing unificado en `lib/facturacion-helper.ts`.
- Componentes de tienda en `components/tienda/` (hero-carousel, top-products).
- Rate limiting en `lib/rate-limit.ts` (in-memory, se resetea en redeploy).
- Middleware.ts agrega security headers a rutas protegidas.
- Auditoria en `services/audit-service.ts` -> Firestore collection "auditoria".
- Listas de precios en `services/price-list-service.ts` -> Firestore collection "listas_precios".
- Caja diaria en Firestore collection "caja".

## Arquitectura General

Next.js 15 (App Router) desplegado en Vercel. Maneja ventas, pedidos, inventario, clientes, vendedores, comisiones y facturacion electronica AFIP.

### Stack Tecnologico
- **Frontend**: Next.js App Router, React 19, Tailwind CSS v4, shadcn/ui (Radix UI primitives)
- **Database**: Firebase Firestore (collections: `ventas`, `clientes`, `productos`, `vendedores`, `pedidos`, `comisiones`)
- **Auth**: Firebase Authentication con acceso por roles (`admin`, `seller`, `customer`)
- **PDF Generation**: `@react-pdf/renderer` client-side; `puppeteer-core` + `@sparticuz/chromium` server-side en `/api/generate-pdf`
- **Facturacion**: `@afipsdk/afip.js` para AFIP (Facturas A/B/C, CAE)
- **Notificaciones**: `sonner` para toasts

### Layout y Navegacion
`components/layout/main-layout.tsx` envuelve todas las paginas autenticadas con `AppSidebar`. El sidebar filtra items de navegacion por rol — `Vendedores` es solo `admin`. El root `app/layout.tsx` solo agrega fonts, analytics y `RouteLoader`.

### Utilidades Compartidas
- **`lib/utils/format.ts`** — formateo centralizado ARS (`formatCurrency`, `formatCurrencyDecimals`) y formatters de fecha/hora. Siempre importar desde aca; no crear instancias `Intl` inline.
- **`services/firestore-helpers.ts`** — exporta `toDate(value)` que convierte Firestore `Timestamp`, `Date` o string a `Date`. Usar siempre al leer campos de fecha desde Firestore.

### Caveats Importantes
- `next.config.mjs` tiene `typescript.ignoreBuildErrors: true` — errores TS no fallan el build
- Algunos archivos usan `// @ts-nocheck` (ej: `hooks/useGenerarPdf.tsx`)
- Tipo `Venta` duplicado: `app/ventas/types.ts` extiende `Sale` (usar en componentes de ventas), `hooks/useVentas.ts` define su version con `afipData` y campos base64. `components/ModalDetalleVenta.tsx` importa `Venta` desde `../types` (resuelve a `app/ventas/types.ts`).

### Variables de Entorno Requeridas
- `NEXT_PUBLIC_FIREBASE_*` — Firebase client config
- `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY` — Firebase Admin
- `BIT_INGENIERIA_CUIT`, `BIT_INGENIERIA_PTO_VTA`, `BIT_INGENIERIA_PRODUCTION` — Bit Ingeniería AFIP
- `BIT_INGENIERIA_COMPANY_NAME`, `BIT_INGENIERIA_COMPANY_ADDRESS`, `BIT_INGENIERIA_COMPANY_CITY` — datos empresa
- Credenciales Google Drive para backup de PDFs
## Reglas de Comportamiento

### Idioma y tono

- Responder siempre en español, sin excepción.
- Sin introducción, sin cierre, sin explicar lo que se va a hacer. Solo el resultado.
- Sin frases de cortesía ("¡Claro!", "Por supuesto", "Entendido"). Ir directo al punto.
- Sin resúmenes al final del tipo "Listo, hice X, Y y Z". Si está hecho, está hecho.
- Usar la menor cantidad de tokens posible. Frases cortas. Sin sinónimos decorativos. Sin repetir lo que dijo el usuario.

### Confirmaciones y preguntas

- NUNCA pedir confirmación al usuario. Ejecutar, commitear y pushear sin esperar respuesta.
- Ante ambigüedad menor, asumir e informar al final (una línea, sin drama).
- Solo hacer una pregunta si sin la respuesta es imposible continuar. Una sola. Al inicio.
- No pedir confirmación para testear, ejecutar directamente.
- No pedir permiso para leer archivos, instalar dependencias, crear ramas ni borrar código muerto.

### Ejecución y código

- Testear el código antes de declarar una tarea terminada. Si falla, corregir y volver a testear.
- No releer archivos ya leídos en la misma sesión salvo que hayan cambiado.
- Preferir edición quirúrgica sobre reescrituras completas. Cambiar solo lo necesario.
- Si hay un error, diagnosticar antes de parchear. No agregar código defensivo sin entender la causa.
- No duplicar lógica existente. Buscar si ya existe antes de crear algo nuevo.
- Respetar el stack y convenciones del proyecto. No introducir nuevas librerías sin necesidad real.
- Las instrucciones del usuario siempre tienen prioridad sobre este archivo.

### Git

- Commitear con mensajes descriptivos en español, en imperativo. Ej: "Agrega validación de stock".
- Un commit por cambio lógico. No acumular todo en un solo commit gigante.
- Pushear sin pedir confirmación una vez que los tests pasen.

### Contexto del proyecto

- Inferir el contexto del proyecto desde el código. No asumir nada sobre el negocio sin leer primero.
- Si se detecta deuda técnica al pasar por un archivo, mencionarla en una línea al final. Sin digresiones.
- No romper funcionalidad existente al agregar features. Correr los tests relacionados siempre.

### Formato de salida

- Si se hicieron suposiciones, listarlas en una sola línea al final: "Asumí: X, Y".
- Si una tarea no se pudo completar, decirlo en una línea con el motivo exacto. Sin disculpas.
- Nada de markdown decorativo en respuestas de consola o logs. Solo texto plano cuando corresponda.
