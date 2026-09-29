# Pakora CRM MCP — Tanda 1

Servidor MCP oficial por **stdio**, con seis herramientas de consulta. Node.js 22+.
No abre puertos, no importa clientes admin ni módulos de ejecución de Next.js y no
contiene operaciones de escritura. No hace login ni modifica pedidos, tareas o n8n.

## Instalar y compilar

Desde la raíz del repositorio:

```bash
cd mcp-server
npm install
npm run build
cp .env.example .env
```

Completa `mcp-server/.env` con:

- `SUPABASE_URL`: origen HTTPS del proyecto Supabase.
- `SUPABASE_ANON_KEY`: clave **publishable** (`sb_publishable_...`) o JWT legacy
  **anon**, usada exclusivamente como `apikey` de la pasarela.
- `SUPABASE_READ_ONLY_TOKEN`: JWT firmado, no vencido, cuyo claim superior `role`
  sea exactamente `crm_mcp_reader`, configurado como se describe abajo.

**La clave anon por sí sola no es una credencial de solo lectura.** El token
restringido viaja en `Authorization: Bearer ...`. Nunca uses service-role,
`sb_secret_...`, un token de usuario `authenticated` o la clave de firma como token.

`npm start` inicia el transporte; al ejecutarlo manualmente parece quedar esperando
porque lee JSON-RPC de stdin. No escribas logs en stdout. La ruta de `.env` se
resuelve desde el archivo compilado, aunque Claude arranque en otro directorio;
variables ya presentes en el proceso tienen prioridad. No se lee `.env.local` del CRM.

Los tipos se importan **solo como tipos** desde `src/lib/supabase/database.types.ts`.
Por eso TypeScript conserva la estructura común en `dist/`: el ejecutable es
`dist/mcp-server/src/index.js`. Compila dentro de este checkout; si distribuyes el
paquete, copia `dist/`, `node_modules/`, `package.json` y `.env` conservando esa estructura.
Next.js y ESLint excluyen esta carpeta igual que `whatsapp-bridge/`.

## Claude Desktop

Añade esta entrada a `mcpServers` de `claude_desktop_config.json` (conserva otras
entradas). Usa rutas absolutas **del equipo donde corre Claude Desktop**, y un
binario Node 22+ accesible desde la aplicación:

```json
{
  "mcpServers": {
    "pakora-crm": {
      "command": "node",
      "args": [
        "/home/alejandro/Documentos/Proyectos/crm_pakora/mcp-server/dist/mcp-server/src/index.js"
      ]
    }
  }
}
```

En macOS el archivo suele estar en
`~/Library/Application Support/Claude/claude_desktop_config.json`; en Windows,
`%APPDATA%\Claude\claude_desktop_config.json`. Si el repositorio está en Linux/WSL
y Desktop en Windows/macOS, instala/compila una copia en ese equipo y ajusta las
rutas (JSON de Windows requiere `\\`). Si `node` no está en el PATH de Desktop,
usa su ruta absoluta. Reinicia Desktop tras editar configuración o `.env`.
No pongas el token en el JSON: el proceso lo lee del `.env` del paquete.

## Seguridad: mecanismo exacto

1. **Base de datos:** rol dedicado `crm_mcp_reader`, sin login, sin heredar otros
   roles, sin bypass RLS, sin propiedad de objetos; SELECT sobre las tablas
   necesarias y EXECUTE solo sobre funciones revisadas de lectura. RLS permite
   consultar todo el negocio CO/MX para reproducir las pantallas administrativas.
2. **Credencial:** Supabase valida la firma y expiración del JWT y PostgREST asume
   ese rol. El servidor comprueba además rol/expiración y rechaza claves admin al
   iniciar; decodificar claims localmente **no** verifica firma ni permisos SQL.
3. **Código:** se expone una fachada `select` y cuatro RPCs enumerados, no el cliente
   general, Auth, Storage ni Edge Functions. No hay SQL arbitrario ni herramientas
   de escritura. Cada herramienta declara `readOnlyHint`.
4. **Transporte:** lista cerrada de cuatro tablas y cuatro RPCs; únicamente GET/HEAD
   contra el origen HTTPS configurado y schema `public`, sin redirecciones.
   Todos los RPCs se llaman con `{ get: true }`. PostgREST ejecuta GET/HEAD en
   transacciones **READ ONLY**, incluso para funciones VOLATILE; una escritura
   SQL falla. No hay fallback a POST cuando un RPC falla.

Las anotaciones MCP son descriptivas; las barreras efectivas son permisos SQL y
el transporte. Las pruebas interceptan peticiones y verifican el bloqueo antes
de la red. No intentan escribir datos reales para comprobarlo.

Referencia: [transacciones de PostgREST](https://docs.postgrest.org/en/stable/references/transactions.html),
[roles Supabase](https://supabase.com/docs/guides/database/postgres/roles),
[JWT Supabase](https://supabase.com/docs/guides/auth/jwts),
[SDK MCP oficial v1](https://ts.sdk.modelcontextprotocol.io/server).

## Preparar el rol de lectura (administrador de Supabase)

Estos pasos son **configuración manual**, no una migración ejecutada por el MCP.
No se ha cambiado la base de datos al crear este paquete. Ejecuta en SQL Editor
como administrador, sobre el proyecto correcto. No reutilices un rol existente
con permisos desconocidos. Los SQL siguientes usan las firmas conocidas del CRM.

```sql
create role crm_mcp_reader nologin noinherit nosuperuser nocreatedb
  nocreaterole noreplication nobypassrls;
grant crm_mcp_reader to authenticator;
grant usage on schema public to crm_mcp_reader;
grant select on public.orders, public.status_catalog, public.status_history,
  public.tasks, public.wallet_movements, public.wallet_movement_catalog
  to crm_mcp_reader;
grant execute on function public.product_order_summary(),
  public.dinero_en_la_calle(), public.wallet_summary(date,date),
  public.wallet_daily_summary(date,date) to crm_mcp_reader;

-- Políticas exclusivamente SELECT; no se alteran las políticas de los usuarios.
create policy mcp_reader_select on public.orders
  for select to crm_mcp_reader using (true);
create policy mcp_reader_select on public.status_catalog
  for select to crm_mcp_reader using (true);
create policy mcp_reader_select on public.status_history
  for select to crm_mcp_reader using (true);
create policy mcp_reader_select on public.tasks
  for select to crm_mcp_reader using (true);
create policy mcp_reader_select on public.wallet_movements
  for select to crm_mcp_reader using (true);
create policy mcp_reader_select on public.wallet_movement_catalog
  for select to crm_mcp_reader using (true);
notify pgrst, 'reload schema';
```

Revisa las definiciones **desplegadas**, incluidas dependencias y funciones
`SECURITY DEFINER`; los tipos TypeScript no demuestran que un RPC sea de lectura:

```sql
select p.oid::regprocedure as funcion, p.provolatile, p.prosecdef,
       pg_get_functiondef(p.oid) as definicion
from pg_proc p join pg_namespace n on n.oid=p.pronamespace
where n.nspname='public' and p.proname in
  ('product_order_summary','dinero_en_la_calle','wallet_summary','wallet_daily_summary');
```

**Obligatorio antes de emitir el JWT: auditar privilegios efectivos.** PostgreSQL
concede EXECUTE a `PUBLIC` por defecto: `NOINHERIT` y un REVOKE sobre el rol nuevo
no quitan esos permisos. No declares el token de solo lectura hasta revisar y
corregir los resultados siguientes:

```sql
-- Debe devolver cero filas: escrituras heredadas de PUBLIC o grants accidentales.
select n.nspname, c.relname, privilege
from pg_class c join pg_namespace n on n.oid=c.relnamespace
cross join (values ('INSERT'),('UPDATE'),('DELETE'),('TRUNCATE'),('REFERENCES'),('TRIGGER')) v(privilege)
where n.nspname not in ('pg_catalog','information_schema')
  and c.relkind in ('r','p','v','m','f')
  and has_table_privilege('crm_mcp_reader',c.oid,privilege);

-- También debe devolver cero filas: grants de escritura a nivel de columna.
select n.nspname,c.relname,a.attname,privilege
from pg_attribute a join pg_class c on c.oid=a.attrelid
join pg_namespace n on n.oid=c.relnamespace
cross join (values ('INSERT'),('UPDATE'),('REFERENCES')) v(privilege)
where n.nspname not in ('pg_catalog','information_schema')
  and c.relkind in ('r','p','v','f') and a.attnum>0 and not a.attisdropped
  and has_column_privilege('crm_mcp_reader',c.oid,a.attnum,privilege);

-- Cero filas: no uso/actualización de secuencias.
select n.nspname,c.relname
from pg_class c join pg_namespace n on n.oid=c.relnamespace
where c.relkind='S' and n.nspname not in ('pg_catalog','information_schema')
  and has_sequence_privilege('crm_mcp_reader',c.oid,'USAGE,UPDATE');

-- Revisar TODAS las funciones adicionales accesibles, en todos los schemas
-- expuestos por la API. Este CRM usa public; amplía la condición si expones otros.
select p.oid::regprocedure as funcion,p.prosecdef,p.provolatile,
       pg_get_functiondef(p.oid) as definicion
from pg_proc p join pg_namespace n on n.oid=p.pronamespace
where n.nspname='public' and p.prokind='f'
  and has_function_privilege('crm_mcp_reader',p.oid,'EXECUTE')
  and p.oid not in ('public.product_order_summary()'::regprocedure,
    'public.dinero_en_la_calle()'::regprocedure,
    'public.wallet_summary(date,date)'::regprocedure,
    'public.wallet_daily_summary(date,date)'::regprocedure);
```

Revoca EXECUTE de funciones no aprobadas para `crm_mcp_reader`. Si el permiso viene
de `PUBLIC`, revócalo de `PUBLIC`; **antes** conserva con grants explícitos el acceso
que necesiten los roles actuales de la app/integraciones. Ejemplo a adaptar a una
función real y sus consumidores existentes (no ejecutar los nombres de ejemplo):

```sql
begin;
-- Solo los consumidores que ya requieren este acceso:
grant execute on function public.funcion_de_escritura(integer)
  to authenticated, service_role;
revoke execute on function public.funcion_de_escritura(integer) from public;
revoke execute on function public.funcion_de_escritura(integer) from crm_mcp_reader;
commit;
```

Haz lo mismo con grants de escritura a tablas, columnas o secuencias provenientes
de `PUBLIC`. Revisa además que el rol no pertenezca a otros roles, no sea propietario
de objetos y no tenga CREATE en schemas. Mantén esta auditoría al añadir funciones:
los permisos por defecto pueden conceder nuevamente EXECUTE a `PUBLIC`. Funciones
auxiliares de RLS solo se permiten tras verificar que sean lectura. No desactives
RLS ni concedas `service_role`/`authenticated` al rol para solucionar errores.

Una comprobación sin escrituras, usando SQL Editor, es:

```sql
begin read only;
set local role crm_mcp_reader;
select count(*) from public.orders;
select * from public.product_order_summary() limit 1;
select * from public.dinero_en_la_calle() limit 1;
select * from public.wallet_summary(current_date - 30,current_date);
select * from public.wallet_daily_summary(current_date - 30,current_date) limit 1;
rollback;
```

Si las políticas existentes incluyen restricciones adicionales, revísalas con el
administrador para conseguir el mismo alcance que el CRM. Un resultado vacío por
RLS no demuestra ausencia de pedidos. Compara conteos y cifras con la pantalla.

## Generar el token

Opción reproducible para proyectos que **todavía aceptan la clave legacy HS256**:
el administrador usa el JWT Secret del proyecto **solo en su terminal de confianza**.
No es la service-role key. No guardes el JWT Secret en `.env`, en Desktop o en este
servidor. El siguiente programa Python estándar pide el secreto sin eco y emite un
JWT de 24 horas; copia solo su resultado a `SUPABASE_READ_ONLY_TOKEN`.

```bash
python3 - <<'PY'
import base64, getpass, hashlib, hmac, json, time
secret = getpass.getpass('JWT Secret legacy del proyecto (no service-role key): ')
def b64(value):
    return base64.urlsafe_b64encode(value).rstrip(b'=').decode()
now = int(time.time())
header = b64(json.dumps({'alg':'HS256','typ':'JWT'},separators=(',',':')).encode())
payload = b64(json.dumps({'role':'crm_mcp_reader','aud':'authenticated',
    'iat':now,'exp':now+86400},separators=(',',':')).encode())
message = f'{header}.{payload}'
signature = b64(hmac.new(secret.encode(),message.encode(),hashlib.sha256).digest())
print(f'{message}.{signature}')
PY
```

Si la clave legacy fue revocada/desactivada, este procedimiento no sirve: el
administrador debe emitir el JWT mediante una clave de firma importada aceptada
por el proyecto o un emisor/Auth Hook configurado, manteniendo `role=crm_mcp_reader`
y expiración corta. El servidor acepta el JWT; no necesita ni recibe su clave
privada. Ver [JWT personalizados de Supabase](https://supabase.com/docs/guides/auth/jwts).

Renueva el token cuando venza y reinicia Desktop; no hay auto-refresh privilegiado.
Para retirar acceso al rol: `revoke crm_mcp_reader from authenticator;` y recarga la
configuración PostgREST (`notify pgrst, 'reload config';`). La rotación/revocación de
la clave de firma debe gestionarse según el procedimiento del proyecto.

## Herramientas y paridad con el CRM

| Tool | Entrada principal | Fuente y semántica |
|---|---|---|
| `buscar_pedido` | `numero_orden`, `telefono` o `nombre`; `pais` opcional | Número/teléfono exactos; palabras del nombre/apellido sin distinguir mayúsculas, filtros AND. Campos clave y categoría. |
| `detalle_pedido` | exactamente `id` o `numero_orden`; `pais` opcional | Todos los campos, status_history y tasks completos; número ambiguo exige id. |
| `pedidos_por_estado` | `categoria`, `pais` | Prioridad estado+transportadora, fallback genérico, después `sin_clasificar`; `nuevo` = pendiente de confirmación. |
| `resumen_producto` | `nombre_producto`, `pais` | RPC `product_order_summary`, nombre base exacto mostrado en Métricas, todo el histórico. Conserva `confirmados`, `confirmados_alguna_vez` y tasas, incluso null. |
| `perfil_cliente` | `telefono`; `pais` opcional | Misma lógica de `clientes/[telefono]/page.tsx` y `getCustomerHistoryStats`. País omitido = el del pedido más reciente. Snapshot Dropi y pedidos locales separados. |
| `resumen_financiero` | `pais`, `fecha_desde`, `fecha_hasta` | RPCs `wallet_summary`, `wallet_daily_summary`, `dinero_en_la_calle`; moneda nativa, sin FX. |

Se revisó `customer_directory_v1` en `getCustomerDirectory.ts`: es el directorio
paginado, **no** el perfil completo. `perfil_cliente` reproduce las consultas de la
página de perfil (teléfono/país exactos), sin reemplazarlas por una búsqueda parcial
en el directorio. No añade un RPC ni actualiza los tipos del CRM.

La clasificación replica `processOrderEvent.lookupCategory` y el catálogo de
`getCampaignRealResults`. No añade filtros `activo` que esas consultas no usan.
La confirmación actual y la confirmación histórica son métricas distintas: el
resumen devuelve la salida del RPC sin inferir nuevas confirmaciones por estado.
Finanzas excluye recargas/retiros y usa `identification_code` a través de los RPCs;
nunca clasifica movimientos por texto libre. Dinero en la calle es la foto actual,
**sin filtro de fechas**. Los endpoints de fechas se pasan intactos a los RPCs,
con la misma interpretación SQL que la aplicación.

Listados usan `limite` (1–100; 25 por defecto) y `antes_de_id` como cursor descendente.
Reenvía `siguiente_antes_de_id` hasta que sea null o la página esté vacía; puede
existir una última página vacía. Detalle/perfil y RPCs recorren todas las páginas,
incluso con un límite API menor al solicitado. No hay truncamiento silencioso.
Como la app, varias consultas no constituyen un snapshot transaccional conjunto;
pedidos que cambian durante la lectura pueden producir diferencias momentáneas.
`pedidos_por_estado` recorre los pedidos del país para resolver correctamente las
excepciones por transportadora; en bases grandes puede tardar. No devuelve un total
inventado de todos los pedidos a partir de una página.

## Verificación

```bash
npm run build
npm test
```

Las pruebas usan el cliente MCP oficial, transporte en memoria y stdio real;
verifican las seis herramientas, inputs inválidos, precedencia de transportadora,
paginación con cap API de una fila, país exacto, tasas originales, capital fuera de
utilidad y bloqueo de escrituras/rutas no permitidas. **Los datos de prueba son
fixtures, no producción.**

Para aceptación con datos reales configura el rol/token anterior y compara en
Desktop: pedido conocido por id, perfil teléfono+país, pendientes `nuevo` en CO,
resumen de un nombre base mostrado en Métricas y Finanzas con idéntico país/rango.
Repite Finanzas con otro rango: el dinero en la calle debe conservar su alcance.
Un 401 apunta a token/firma/expiración; 42501 a grants/RLS; 25006 indica que el RPC
intenta escribir y debe revisarse, nunca habilitar POST. Si faltan RPCs no se
sustituyen por fórmulas distintas.

La comparación real y la prueba en Claude Desktop quedan pendientes hasta contar
con la credencial restringida. Después de confirmar Tanda 1 en Desktop, sigue
**Tanda 2: las otras 14 herramientas**.
