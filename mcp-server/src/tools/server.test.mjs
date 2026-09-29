import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { createServer } from '../../dist/mcp-server/src/index.js';
import { createReadOnlyClient, readOnlyFetch, validateCredentials } from '../../dist/mcp-server/src/supabase.js';

const jwt = (role, exp = Math.floor(Date.now()/1000) + 3600) =>
  `${Buffer.from('{"alg":"HS256"}').toString('base64url')}.${Buffer.from(JSON.stringify({role, exp})).toString('base64url')}.test-signature`;
const env = { SUPABASE_URL: 'https://example.supabase.co', SUPABASE_ANON_KEY: jwt('anon'), SUPABASE_READ_ONLY_TOKEN: jwt('crm_mcp_reader') };
const names = ['buscar_pedido','detalle_pedido','pedidos_por_estado','resumen_producto','perfil_cliente','resumen_financiero'];

test('credential guard rejects privileged, generic, expired, missing and non-HTTPS credentials', () => {
  assert.equal(validateCredentials(env.SUPABASE_URL, env.SUPABASE_ANON_KEY, env.SUPABASE_READ_ONLY_TOKEN), env.SUPABASE_URL);
  for (const key of [jwt('service_role'), 'sb_secret_bad']) assert.throws(() => validateCredentials(env.SUPABASE_URL, key, env.SUPABASE_READ_ONLY_TOKEN));
  for (const token of [jwt('service_role'),jwt('authenticated'),jwt('anon'),jwt('crm_mcp_reader',1)]) assert.throws(() => validateCredentials(env.SUPABASE_URL,env.SUPABASE_ANON_KEY,token));
  assert.throws(() => createReadOnlyClient({}));
  assert.throws(() => validateCredentials('http://example.test',env.SUPABASE_ANON_KEY,env.SUPABASE_READ_ONLY_TOKEN));
});

test('transport blocks every write verb, unapproved RPC/table/schema and external origin before network', async () => {
  let requests = 0;
  const guarded = readOnlyFetch(env.SUPABASE_URL, async (request) => {
    requests++;
    assert.equal(request.redirect,'error');
    return new Response('[]');
  });
  for (const method of ['POST','PATCH','DELETE','PUT']) {
    await assert.rejects(guarded(`${env.SUPABASE_URL}/rest/v1/orders`,{method}));
    await assert.rejects(guarded(`${env.SUPABASE_URL}/rest/v1/rpc/wallet_summary`,{method}));
  }
  for (const path of ['/rest/v1/profiles','/rest/v1/rpc/process_order','/auth/v1/token','/storage/v1/object']) await assert.rejects(guarded(env.SUPABASE_URL+path));
  await assert.rejects(guarded('https://attacker.test/rest/v1/orders'));
  await assert.rejects(guarded(`${env.SUPABASE_URL}/rest/v1/orders`,{headers:{'accept-profile':'private'}}));
  assert.equal(requests,0);
  await guarded(`${env.SUPABASE_URL}/rest/v1/orders`);
  await guarded(`${env.SUPABASE_URL}/rest/v1/rpc/product_order_summary`);
  assert.equal(requests,2);
});

const order = (id,pais,carrier,state,phone='3001234567') => ({
  id,pais,transportadora:carrier,estado_dropi:state,telefono:phone,numero_orden:'#123',
  nombre:'Ana',apellido:'Pérez',fecha:'2026-09-20',created_at:`2026-09-20T10:00:0${id}Z`,
  updated_at:'2026-09-21T00:00:00Z',total_pedidos_cliente:10,pedidos_entregados_cliente:7,pedidos_devueltos_cliente:2,
  nivel_riesgo:'bajo',nombre_producto:'Producto',direccion:'test',estado_crm:'en_ruta',
});
const fixtures = {
  orders:[order(4,'MX',null,'DONE'),order(3,'CO','SPECIAL','DONE'),order(2,'CO',null,'DONE'),order(1,'CO',null,null)],
  status_catalog:[{id:1,estado:'DONE',transportadora:null,categoria:'entregado'},{id:2,estado:'DONE',transportadora:'SPECIAL',categoria:'devolucion'}],
  status_history:[{id:1,order_id:3,estado:'DONE',transportadora:'SPECIAL',registrado_en:'2026-09-20',created_at:'2026-09-20'},{id:2,order_id:3,estado:'DONE',transportadora:null,registrado_en:'2026-09-21',created_at:'2026-09-21'}],
  tasks:[{id:1,order_id:3,created_at:'2026-09-20'},{id:2,order_id:3,created_at:'2026-09-21'}],
  product_order_summary:[{pais:'CO',nombre_producto:'Producto',total:50,confirmados:3,confirmados_alguna_vez:40,entregados:30,cancelados:5,devoluciones:2,pct_confirmacion:80,pct_entrega:75,pct_cancelacion:10,pct_devolucion:5}],
  wallet_summary:[{pais:'CO',categoria:'ganancia',tipo:'entrada',total:100},{pais:'CO',categoria:'costo_flete',tipo:'SALIDA',total:25},{pais:'CO',categoria:'recarga',tipo:'ENTRADA',total:900},{pais:'CO',categoria:'retiro',tipo:'SALIDA',total:500},{pais:'MX',categoria:'ganancia',tipo:'ENTRADA',total:999}],
  wallet_daily_summary:[{pais:'CO',dia:'2026-09-20',neto:75}],
  dinero_en_la_calle:[{pais:'CO',nombre_producto:'Producto',pedidos_por_entregar:2,dinero_en_la_calle:200}],
};

test('six tools round-trip through MCP and Supabase GET requests; capped pages stay complete', async () => {
  const original = globalThis.fetch;
  const requests = [];
  globalThis.fetch = async (request) => {
    const url = new URL(request.url);
    requests.push(url);
    assert.equal(request.method,'GET');
    assert.equal(request.headers.get('authorization'),`Bearer ${env.SUPABASE_READ_ONLY_TOKEN}`);
    const name = url.pathname.split('/').at(-1);
    let data = structuredClone(fixtures[name] ?? []);
    for (const [key,value] of url.searchParams) {
      if (value.startsWith('eq.')) data = data.filter((row) => String(row[key]) === value.slice(3));
      if (value.startsWith('lt.')) data = data.filter((row) => row[key] < Number(value.slice(3)));
    }
    const sort = url.searchParams.get('order');
    if (sort) data.sort((a,b) => {
      for (const part of sort.split(',')) {
        const [key,direction] = part.split('.');
        if (a[key] < b[key]) return direction === 'desc' ? 1 : -1;
        if (a[key] > b[key]) return direction === 'desc' ? -1 : 1;
      }
      return 0;
    });
    // Force a cap below every requested page size; totals must still be complete.
    const offset = Number(url.searchParams.get('offset') ?? 0);
    data = data.slice(offset, offset + 1);
    return new Response(JSON.stringify(data),{status:200,headers:{'content-type':'application/json'}});
  };
  const db = createReadOnlyClient(env);
  const server = createServer(db);
  const client = new Client({name:'test',version:'1'});
  const [a,b] = InMemoryTransport.createLinkedPair();
  try {
    await server.connect(a); await client.connect(b);
    const list = await client.listTools();
    assert.deepEqual(list.tools.map((t) => t.name),names);
    for (const t of list.tools) assert.equal(t.annotations.readOnlyHint,true);
    const call = async (name,args) => {
      const result = await client.callTool({name,arguments:args});
      assert.equal(result.isError,undefined,JSON.stringify(result));
      return result.structuredContent.resultado;
    };
    const search = await call('buscar_pedido',{telefono:'3001234567',pais:'CO'});
    assert.equal(search.pedidos[0].id,3);
    const detail = await call('detalle_pedido',{id:3});
    assert.equal(detail.categoria,'devolucion'); assert.equal(detail.status_history.length,2); assert.equal(detail.tasks.length,2);
    assert.equal((await client.callTool({name:'detalle_pedido',arguments:{numero_orden:'#123'}})).isError,true);
    assert.equal((await client.callTool({name:'buscar_pedido',arguments:{}})).isError,true);
    assert.equal((await client.callTool({name:'resumen_financiero',arguments:{pais:'CO',fecha_desde:'2026-02-30',fecha_hasta:'2026-03-01'}})).isError,true);
    const states = await call('pedidos_por_estado',{pais:'CO',categoria:'entregado'});
    assert.deepEqual(states.pedidos.map((o)=>o.id),[2]);
    assert.equal((await call('pedidos_por_estado',{pais:'CO',categoria:'sin_clasificar'})).pedidos[0].id,1);
    const product = await call('resumen_producto',{pais:'CO',nombre_producto:'Producto'});
    assert.deepEqual(product.productos,fixtures.product_order_summary);
    const profile = await call('perfil_cliente',{telefono:'3001234567',pais:'CO'});
    assert.equal(profile.pakora.total,3); assert.equal(profile.pakora.devueltos,1); assert.equal(profile.pakora.entregados,1);
    assert.equal(profile.red_dropi.otherOrders,1);
    assert.equal((await call('perfil_cliente',{telefono:'3001234567'})).pais,'MX');
    const financial = await call('resumen_financiero',{pais:'CO',fecha_desde:'2026-09-20',fecha_hasta:'2026-09-21'});
    assert.equal(financial.utilidad_operativa,75); assert.equal(financial.recargas,900); assert.equal(financial.retiros,500);
    assert.deepEqual(financial.tendencia_diaria,[{dia:'2026-09-20',neto:75},{dia:'2026-09-21',neto:0}]);
    assert.equal(financial.dinero_en_la_calle.total,200);
    for (const url of requests.filter((u)=>u.pathname.endsWith('dinero_en_la_calle'))) assert.equal(url.searchParams.has('p_date_from'),false);
  } finally { await client.close(); await server.close(); globalThis.fetch = original; }
});

test('standalone stdio server starts outside package cwd and registers exactly six tools', async () => {
  const entry = new URL('../../dist/mcp-server/src/index.js',import.meta.url).pathname;
  const transport = new StdioClientTransport({command:process.execPath,args:[entry],cwd:'/tmp',env:{...process.env,...env},stderr:'pipe'});
  const client = new Client({name:'stdio-test',version:'1'});
  let stderr = '';
  transport.stderr?.on('data', (chunk) => { stderr += chunk.toString(); });
  try {
    await client.connect(transport).catch((error) => { throw new Error(`${error.message}\n${stderr}`); });
    assert.deepEqual((await client.listTools()).tools.map((t)=>t.name),names);
  } finally { await client.close(); }
});
