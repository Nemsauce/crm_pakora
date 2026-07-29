# Dropi Polling (CO) — live n8n source of truth

- Workflow API ID: `9p1gvbDxdYqugkMT`
- Live name: `Dropi Polling`
- Captured read-only at: `2026-07-12T22:50:21.827Z`
- Workflow updated at: `2026-07-06T22:44:48.426Z`
- Active: `true`
- Version: `e7048916-e082-493e-9731-2b2b3f4d567b` (counter `134`)
- Nodes: `27`
- Directed connections: `26`
- Trigger nodes: `2`
- Current editable graph equals the active-version graph: `true`

> This document was generated from `GET /api/v1/workflows/9p1gvbDxdYqugkMT`. No n8n mutation endpoint was called.

## Redaction policy

Only reusable secret values were replaced. URLs, email/account identifiers, user IDs, field names, expressions, logic, node IDs, positions, headers, and non-secret configuration remain unchanged.

- `[REDACTED_TOTP_SECRET]`: the Base32 TOTP seed hardcoded in `Generar TOTP`.
- `[REDACTED_DROPI_PASSWORD]`: the hardcoded Dropi password repeated in login request bodies.
- `[REDACTED_JWT]` / `[REDACTED_SECRET]`: embedded Supabase/API, webhook, and cron bearer values.

## Critical TOTP finding

**The TOTP secret is hardcoded directly in the Code node.** It is not read from an n8n credential and not read from an environment variable. The node implements Base32 decoding, SHA-1, HMAC-SHA1, and a 6-digit TOTP locally, then deliberately calls `generateTOTP(secret, -1)` to use the previous 30-second time step.

This means a native backend port can reuse the currently linked 2FA seed without re-linking 2FA, provided that the existing seed is transferred securely into server-only secret storage. The redacted working document intentionally does not contain the seed.

### Exact `Generar TOTP` jsCode (secret value redacted)

```js
const base32Decode = (input) => {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  input = input.toUpperCase().replace(/=+$/, '');
  let bits = 0, value = 0;
  const output = [];
  for (let i = 0; i < input.length; i++) {
    value = (value << 5) | alphabet.indexOf(input[i]);
    bits += 5;
    if (bits >= 8) { output.push((value >>> (bits - 8)) & 255); bits -= 8; }
  }
  return output;
};

function sha1(buffer) {
  let h0=0x67452301,h1=0xEFCDAB89,h2=0x98BADCFE,h3=0x10325476,h4=0xC3D2E1F0;
  const msg = Array.from(buffer);
  const bitLen = msg.length * 8;
  msg.push(0x80);
  while (msg.length % 64 !== 56) msg.push(0);
  for (let i = 7; i >= 0; i--) msg.push((bitLen / Math.pow(2, i*8)) & 0xff);
  for (let i = 0; i < msg.length; i += 64) {
    const w = [];
    for (let j = 0; j < 16; j++)
      w[j] = (msg[i+j*4]<<24)|(msg[i+j*4+1]<<16)|(msg[i+j*4+2]<<8)|msg[i+j*4+3];
    for (let j = 16; j < 80; j++) {
      const x = w[j-3]^w[j-8]^w[j-14]^w[j-16];
      w[j] = (x<<1)|(x>>>31);
    }
    let a=h0,b=h1,c=h2,d=h3,e=h4;
    for (let j = 0; j < 80; j++) {
      let f,k;
      if(j<20){f=(b&c)|((~b)&d);k=0x5A827999;}
      else if(j<40){f=b^c^d;k=0x6ED9EBA1;}
      else if(j<60){f=(b&c)|(b&d)|(c&d);k=0x8F1BBCDC;}
      else{f=b^c^d;k=0xCA62C1D6;}
      const temp=(((a<<5)|(a>>>27))+f+e+k+w[j])>>>0;
      e=d;d=c;c=(b<<30)|(b>>>2);b=a;a=temp;
    }
    h0=(h0+a)>>>0;h1=(h1+b)>>>0;h2=(h2+c)>>>0;h3=(h3+d)>>>0;h4=(h4+e)>>>0;
  }
  const result=[];
  [h0,h1,h2,h3,h4].forEach(h=>{
    for(let i=3;i>=0;i--) result.push((h>>>(i*8))&0xff);
  });
  return result;
}

function hmacSHA1(key, data) {
  let k = Array.from(key);
  if (k.length > 64) k = sha1(k);
  while (k.length < 64) k.push(0);
  const ipad = k.map(b => b ^ 0x36);
  const opad = k.map(b => b ^ 0x5c);
  return sha1([...opad, ...sha1([...ipad, ...Array.from(data)])]);
}

function generateTOTP(secret, offset = 0) {
  const key = base32Decode(secret);
  const epoch = Math.floor(Date.now() / 1000);
  const timeStep = Math.floor(epoch / 30) + offset;
  const data = [
    0, 0, 0, 0,
    (timeStep >>> 24) & 0xff,
    (timeStep >>> 16) & 0xff,
    (timeStep >>> 8) & 0xff,
    timeStep & 0xff
  ];
  const hmac = hmacSHA1(key, data);
  const off = hmac[hmac.length - 1] & 0x0f;
  const code = (
    ((hmac[off] & 0x7f) << 24) |
    ((hmac[off+1] & 0xff) << 16) |
    ((hmac[off+2] & 0xff) << 8) |
    (hmac[off+3] & 0xff)
  ) % 1000000;
  return String(code).padStart(6, '0');
}

const secret = '[REDACTED_TOTP_SECRET]';
const tempToken = $('Dropi Login Paso 2').item.json.token;

// Usar offset -1 para compensar desfase del servidor
const totp = generateTOTP(secret, -1);

return [{
  json: {
    totp,
    temp_token: tempToken
  }
}];
```

## Exact execution graph

Human-readable paths (fan-out branches execute independently):

```text
Schedule Trigger (0 6,9,12,15,18 * * *) ─┐
                                           ├─> Calcular delay -> Esperar delay aleatorio -> Obtener IP
Schedule Trigger1 (30 21 * * *) ──────────┘      -> Dropi Login Paso 1 -> Dropi Login Paso 2
                                                  -> Generar TOTP -> Dropi 2FA Verify
                                                  -> Dropi Before Login 2 -> Dropi Login Final

Dropi Login Final
  ├─> Dropi Consultar Pedidos -> Traer ordenes activas Supabase -> Comparar y filtrar cambios
  │     ├─> Actualizar orden Supabase
  │     │     ├─> Registrar historial
  │     │     └─> Notificar backend CRM
  │     └─> Filtrar historial faltante -> Procesar historial completo
  ├─> Dropi Consultar Wallet
  │     ├─> Procesar movimientos wallet -> Es liquidacion?
  │     │     ├─ true (output 0)  -> Actualizar liquidacion
  │     │     └─ false (output 1) -> Actualizar devolucion
  │     └─> Mapear movimientos wallet completo -> Insertar movimientos wallet
  └─> Chequear pedidos estancados
```

Terminal nodes: `Registrar historial`, `Actualizar liquidacion`, `Actualizar devolucion`, `Notificar backend CRM`, `Insertar movimientos wallet`, `Chequear pedidos estancados`, `Procesar historial completo`.

### Exact connections object

```json
{
  "Schedule Trigger": {
    "main": [
      [
        {
          "node": "Calcular delay",
          "type": "main",
          "index": 0
        }
      ]
    ]
  },
  "Calcular delay": {
    "main": [
      [
        {
          "node": "Esperar delay aleatorio",
          "type": "main",
          "index": 0
        }
      ]
    ]
  },
  "Esperar delay aleatorio": {
    "main": [
      [
        {
          "node": "Obtener IP",
          "type": "main",
          "index": 0
        }
      ]
    ]
  },
  "Obtener IP": {
    "main": [
      [
        {
          "node": "Dropi Login Paso 1",
          "type": "main",
          "index": 0
        }
      ]
    ]
  },
  "Dropi Login Paso 1": {
    "main": [
      [
        {
          "node": "Dropi Login Paso 2",
          "type": "main",
          "index": 0
        }
      ]
    ]
  },
  "Dropi Login Paso 2": {
    "main": [
      [
        {
          "node": "Generar TOTP",
          "type": "main",
          "index": 0
        }
      ]
    ]
  },
  "Generar TOTP": {
    "main": [
      [
        {
          "node": "Dropi 2FA Verify",
          "type": "main",
          "index": 0
        }
      ]
    ]
  },
  "Dropi 2FA Verify": {
    "main": [
      [
        {
          "node": "Dropi Before Login 2",
          "type": "main",
          "index": 0
        }
      ]
    ]
  },
  "Dropi Before Login 2": {
    "main": [
      [
        {
          "node": "Dropi Login Final",
          "type": "main",
          "index": 0
        }
      ]
    ]
  },
  "Dropi Login Final": {
    "main": [
      [
        {
          "node": "Dropi Consultar Pedidos",
          "type": "main",
          "index": 0
        },
        {
          "node": "Dropi Consultar Wallet",
          "type": "main",
          "index": 0
        },
        {
          "node": "Chequear pedidos estancados",
          "type": "main",
          "index": 0
        }
      ]
    ]
  },
  "Dropi Consultar Pedidos": {
    "main": [
      [
        {
          "node": "Traer ordenes activas Supabase",
          "type": "main",
          "index": 0
        }
      ]
    ]
  },
  "Traer ordenes activas Supabase": {
    "main": [
      [
        {
          "node": "Comparar y filtrar cambios",
          "type": "main",
          "index": 0
        }
      ]
    ]
  },
  "Comparar y filtrar cambios": {
    "main": [
      [
        {
          "node": "Actualizar orden Supabase",
          "type": "main",
          "index": 0
        },
        {
          "node": "Filtrar historial faltante",
          "type": "main",
          "index": 0
        }
      ]
    ]
  },
  "Actualizar orden Supabase": {
    "main": [
      [
        {
          "node": "Registrar historial",
          "type": "main",
          "index": 0
        },
        {
          "node": "Notificar backend CRM",
          "type": "main",
          "index": 0
        }
      ]
    ]
  },
  "Registrar historial": {
    "main": [
      []
    ]
  },
  "Schedule Trigger1": {
    "main": [
      [
        {
          "node": "Calcular delay",
          "type": "main",
          "index": 0
        }
      ]
    ]
  },
  "Dropi Consultar Wallet": {
    "main": [
      [
        {
          "node": "Procesar movimientos wallet",
          "type": "main",
          "index": 0
        },
        {
          "node": "Mapear movimientos wallet completo",
          "type": "main",
          "index": 0
        }
      ]
    ]
  },
  "Procesar movimientos wallet": {
    "main": [
      [
        {
          "node": "Es liquidacion?",
          "type": "main",
          "index": 0
        }
      ]
    ]
  },
  "Es liquidacion?": {
    "main": [
      [
        {
          "node": "Actualizar liquidacion",
          "type": "main",
          "index": 0
        }
      ],
      [
        {
          "node": "Actualizar devolucion",
          "type": "main",
          "index": 0
        }
      ]
    ]
  },
  "Mapear movimientos wallet completo": {
    "main": [
      [
        {
          "node": "Insertar movimientos wallet",
          "type": "main",
          "index": 0
        }
      ]
    ]
  },
  "Filtrar historial faltante": {
    "main": [
      [
        {
          "node": "Procesar historial completo",
          "type": "main",
          "index": 0
        }
      ]
    ]
  }
}
```

### Flattened edge list

| # | Source | Output | Target | Input |
|---:|---|---:|---|---:|
| 1 | Schedule Trigger | 0 | Calcular delay | 0 |
| 2 | Calcular delay | 0 | Esperar delay aleatorio | 0 |
| 3 | Esperar delay aleatorio | 0 | Obtener IP | 0 |
| 4 | Obtener IP | 0 | Dropi Login Paso 1 | 0 |
| 5 | Dropi Login Paso 1 | 0 | Dropi Login Paso 2 | 0 |
| 6 | Dropi Login Paso 2 | 0 | Generar TOTP | 0 |
| 7 | Generar TOTP | 0 | Dropi 2FA Verify | 0 |
| 8 | Dropi 2FA Verify | 0 | Dropi Before Login 2 | 0 |
| 9 | Dropi Before Login 2 | 0 | Dropi Login Final | 0 |
| 10 | Dropi Login Final | 0 | Dropi Consultar Pedidos | 0 |
| 11 | Dropi Login Final | 0 | Dropi Consultar Wallet | 0 |
| 12 | Dropi Login Final | 0 | Chequear pedidos estancados | 0 |
| 13 | Dropi Consultar Pedidos | 0 | Traer ordenes activas Supabase | 0 |
| 14 | Traer ordenes activas Supabase | 0 | Comparar y filtrar cambios | 0 |
| 15 | Comparar y filtrar cambios | 0 | Actualizar orden Supabase | 0 |
| 16 | Comparar y filtrar cambios | 0 | Filtrar historial faltante | 0 |
| 17 | Actualizar orden Supabase | 0 | Registrar historial | 0 |
| 18 | Actualizar orden Supabase | 0 | Notificar backend CRM | 0 |
| 19 | Schedule Trigger1 | 0 | Calcular delay | 0 |
| 20 | Dropi Consultar Wallet | 0 | Procesar movimientos wallet | 0 |
| 21 | Dropi Consultar Wallet | 0 | Mapear movimientos wallet completo | 0 |
| 22 | Procesar movimientos wallet | 0 | Es liquidacion? | 0 |
| 23 | Es liquidacion? | 0 | Actualizar liquidacion | 0 |
| 24 | Es liquidacion? | 1 | Actualizar devolucion | 0 |
| 25 | Mapear movimientos wallet completo | 0 | Insertar movimientos wallet | 0 |
| 26 | Filtrar historial faltante | 0 | Procesar historial completo | 0 |

## Node inventory

| # | Name | Type | Type version |
|---:|---|---|---:|
| 1 | Schedule Trigger | `n8n-nodes-base.scheduleTrigger` | 1.3 |
| 2 | Calcular delay | `n8n-nodes-base.code` | 2 |
| 3 | Esperar delay aleatorio | `n8n-nodes-base.wait` | 1.1 |
| 4 | Obtener IP | `n8n-nodes-base.httpRequest` | 4.4 |
| 5 | Dropi Login Paso 1 | `n8n-nodes-base.httpRequest` | 4.4 |
| 6 | Dropi Login Paso 2 | `n8n-nodes-base.httpRequest` | 4.4 |
| 7 | Generar TOTP | `n8n-nodes-base.code` | 2 |
| 8 | Dropi 2FA Verify | `n8n-nodes-base.httpRequest` | 4.4 |
| 9 | Dropi Login Final | `n8n-nodes-base.httpRequest` | 4.4 |
| 10 | Dropi Before Login 2 | `n8n-nodes-base.httpRequest` | 4.4 |
| 11 | Dropi Consultar Pedidos | `n8n-nodes-base.httpRequest` | 4.4 |
| 12 | Traer ordenes activas Supabase | `n8n-nodes-base.httpRequest` | 4.4 |
| 13 | Comparar y filtrar cambios | `n8n-nodes-base.code` | 2 |
| 14 | Actualizar orden Supabase | `n8n-nodes-base.httpRequest` | 4.4 |
| 15 | Registrar historial | `n8n-nodes-base.httpRequest` | 4.4 |
| 16 | Schedule Trigger1 | `n8n-nodes-base.scheduleTrigger` | 1.3 |
| 17 | Dropi Consultar Wallet | `n8n-nodes-base.httpRequest` | 4.4 |
| 18 | Procesar movimientos wallet | `n8n-nodes-base.code` | 2 |
| 19 | Es liquidacion? | `n8n-nodes-base.if` | 2.3 |
| 20 | Actualizar liquidacion | `n8n-nodes-base.httpRequest` | 4.4 |
| 21 | Actualizar devolucion | `n8n-nodes-base.httpRequest` | 4.4 |
| 22 | Notificar backend CRM | `n8n-nodes-base.httpRequest` | 4.4 |
| 23 | Mapear movimientos wallet completo | `n8n-nodes-base.code` | 2 |
| 24 | Insertar movimientos wallet | `n8n-nodes-base.httpRequest` | 4.4 |
| 25 | Chequear pedidos estancados | `n8n-nodes-base.httpRequest` | 4.4 |
| 26 | Filtrar historial faltante | `n8n-nodes-base.code` | 2 |
| 27 | Procesar historial completo | `n8n-nodes-base.httpRequest` | 4.4 |

## Complete node definitions

Each block below is the complete node object returned by the API, including complete parameters, node ID, type version, canvas position, and execution controls. Secret values alone are redacted.

### 1. Schedule Trigger

```json
{
  "parameters": {
    "rule": {
      "interval": [
        {
          "field": "cronExpression",
          "expression": "0 6,9,12,15,18 * * *"
        }
      ]
    }
  },
  "type": "n8n-nodes-base.scheduleTrigger",
  "typeVersion": 1.3,
  "position": [
    -1232,
    -16
  ],
  "id": "f2756b31-20ed-4e3b-9982-3761b980171f",
  "name": "Schedule Trigger"
}
```

### 2. Calcular delay

```json
{
  "parameters": {
    "jsCode": "const delay = Math.floor(Math.random() * 15 * 60 * 1000);\nreturn [{ json: { delay } }];"
  },
  "type": "n8n-nodes-base.code",
  "typeVersion": 2,
  "position": [
    -1024,
    -16
  ],
  "id": "64d26c24-ae7b-4de9-b933-9c5314b9e25f",
  "name": "Calcular delay"
}
```

#### Verbatim `jsCode`

```js
const delay = Math.floor(Math.random() * 15 * 60 * 1000);
return [{ json: { delay } }];
```

### 3. Esperar delay aleatorio

```json
{
  "parameters": {
    "amount": "=1"
  },
  "type": "n8n-nodes-base.wait",
  "typeVersion": 1.1,
  "position": [
    -816,
    -16
  ],
  "id": "f9da3e32-2ef3-4eb0-8736-7068f9708faf",
  "name": "Esperar delay aleatorio",
  "webhookId": "d2533785-1cd2-4dad-8e2b-3e5a47103bc8"
}
```

### 4. Obtener IP

```json
{
  "parameters": {
    "url": "https://api.ipify.org/?format=json",
    "options": {
      "response": {
        "response": {
          "responseFormat": "json"
        }
      }
    }
  },
  "type": "n8n-nodes-base.httpRequest",
  "typeVersion": 4.4,
  "position": [
    -608,
    -16
  ],
  "id": "86fab41b-d91a-483c-b344-2ed6c3fdae87",
  "name": "Obtener IP"
}
```

### 5. Dropi Login Paso 1

```json
{
  "parameters": {
    "method": "POST",
    "url": "https://api.dropi.co/api/beforeLoginUnknownDevice",
    "sendHeaders": true,
    "headerParameters": {
      "parameters": [
        {
          "name": "accept",
          "value": "application/json, text/plain, */*"
        },
        {
          "name": "accept-language",
          "value": "es-419,es;q=0.8"
        },
        {
          "name": "content-type",
          "value": "application/json"
        },
        {
          "name": "origin",
          "value": "https://app.dropi.co"
        },
        {
          "name": "referer",
          "value": "https://app.dropi.co/"
        },
        {
          "name": "sec-ch-ua",
          "value": "\"Chromium\";v=\"148\", \"Brave\";v=\"148\", \"Not/A)Brand\";v=\"99\""
        },
        {
          "name": "sec-ch-ua-mobile",
          "value": "?0"
        },
        {
          "name": "sec-ch-ua-platform",
          "value": "\"Linux\""
        },
        {
          "name": "sec-fetch-dest",
          "value": "empty"
        },
        {
          "name": "sec-fetch-mode",
          "value": "cors"
        },
        {
          "name": "sec-fetch-site",
          "value": "same-site"
        },
        {
          "name": "user-agent",
          "value": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36"
        },
        {
          "name": "x-authorization",
          "value": "Bearer undefined"
        },
        {
          "name": "x-captcha-token"
        }
      ]
    },
    "sendBody": true,
    "specifyBody": "json",
    "jsonBody": "={\n  \"email\": \"ecommerce.cop.1@gmail.com\",\n  \"password\": \"[REDACTED_DROPI_PASSWORD]\",\n  \"white_brand_id\": 1,\n  \"brand\": \"\",\n  \"ipAddress\": \"{{ $('Obtener IP').item.json.ip }}\",\n  \"otp\": null,\n  \"with_cdc\": false\n}",
    "options": {}
  },
  "type": "n8n-nodes-base.httpRequest",
  "typeVersion": 4.4,
  "position": [
    -400,
    -16
  ],
  "id": "e9144ca5-fd51-433a-8708-d26328d0ecaa",
  "name": "Dropi Login Paso 1"
}
```

### 6. Dropi Login Paso 2

```json
{
  "parameters": {
    "method": "POST",
    "url": "https://api.dropi.co/api/login",
    "sendHeaders": true,
    "headerParameters": {
      "parameters": [
        {
          "name": "accept",
          "value": "application/json, text/plain, */*"
        },
        {
          "name": "accept-language ",
          "value": "es-419,es;q=0.8"
        },
        {
          "name": "content-type",
          "value": "application/json"
        },
        {
          "name": "origin",
          "value": "https://app.dropi.co"
        },
        {
          "name": "referer",
          "value": "https://app.dropi.co/"
        },
        {
          "name": "sec-ch-ua",
          "value": "\"Chromium\";v=\"148\", \"Brave\";v=\"148\", \"Not/A)Brand\";v=\"99\""
        },
        {
          "name": "sec-ch-ua-mobile",
          "value": "?0"
        },
        {
          "name": "sec-ch-ua-platform",
          "value": "\"Linux\""
        },
        {
          "name": "sec-fetch-dest",
          "value": "empty"
        },
        {
          "name": "sec-fetch-mode",
          "value": "cors"
        },
        {
          "name": "sec-fetch-site",
          "value": "same-site"
        },
        {
          "name": "user-agent",
          "value": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36"
        },
        {
          "name": "x-authorization",
          "value": "Bearer undefined"
        },
        {
          "name": "x-captcha-token"
        }
      ]
    },
    "sendBody": true,
    "specifyBody": "json",
    "jsonBody": "={\n  \"email\": \"ecommerce.cop.1@gmail.com\",\n  \"password\": \"[REDACTED_DROPI_PASSWORD]\",\n  \"white_brand_id\": 1,\n  \"brand\": \"\",\n  \"ipAddress\": \"{{ $('Obtener IP').item.json.ip }}\",\n  \"otp\": null,\n  \"with_cdc\": false\n}",
    "options": {}
  },
  "type": "n8n-nodes-base.httpRequest",
  "typeVersion": 4.4,
  "position": [
    -176,
    -16
  ],
  "id": "1d34b44d-05a1-4198-8f54-ccccf70dd98c",
  "name": "Dropi Login Paso 2"
}
```

### 7. Generar TOTP

```json
{
  "parameters": {
    "jsCode": "const base32Decode = (input) => {\n  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';\n  input = input.toUpperCase().replace(/=+$/, '');\n  let bits = 0, value = 0;\n  const output = [];\n  for (let i = 0; i < input.length; i++) {\n    value = (value << 5) | alphabet.indexOf(input[i]);\n    bits += 5;\n    if (bits >= 8) { output.push((value >>> (bits - 8)) & 255); bits -= 8; }\n  }\n  return output;\n};\n\nfunction sha1(buffer) {\n  let h0=0x67452301,h1=0xEFCDAB89,h2=0x98BADCFE,h3=0x10325476,h4=0xC3D2E1F0;\n  const msg = Array.from(buffer);\n  const bitLen = msg.length * 8;\n  msg.push(0x80);\n  while (msg.length % 64 !== 56) msg.push(0);\n  for (let i = 7; i >= 0; i--) msg.push((bitLen / Math.pow(2, i*8)) & 0xff);\n  for (let i = 0; i < msg.length; i += 64) {\n    const w = [];\n    for (let j = 0; j < 16; j++)\n      w[j] = (msg[i+j*4]<<24)|(msg[i+j*4+1]<<16)|(msg[i+j*4+2]<<8)|msg[i+j*4+3];\n    for (let j = 16; j < 80; j++) {\n      const x = w[j-3]^w[j-8]^w[j-14]^w[j-16];\n      w[j] = (x<<1)|(x>>>31);\n    }\n    let a=h0,b=h1,c=h2,d=h3,e=h4;\n    for (let j = 0; j < 80; j++) {\n      let f,k;\n      if(j<20){f=(b&c)|((~b)&d);k=0x5A827999;}\n      else if(j<40){f=b^c^d;k=0x6ED9EBA1;}\n      else if(j<60){f=(b&c)|(b&d)|(c&d);k=0x8F1BBCDC;}\n      else{f=b^c^d;k=0xCA62C1D6;}\n      const temp=(((a<<5)|(a>>>27))+f+e+k+w[j])>>>0;\n      e=d;d=c;c=(b<<30)|(b>>>2);b=a;a=temp;\n    }\n    h0=(h0+a)>>>0;h1=(h1+b)>>>0;h2=(h2+c)>>>0;h3=(h3+d)>>>0;h4=(h4+e)>>>0;\n  }\n  const result=[];\n  [h0,h1,h2,h3,h4].forEach(h=>{\n    for(let i=3;i>=0;i--) result.push((h>>>(i*8))&0xff);\n  });\n  return result;\n}\n\nfunction hmacSHA1(key, data) {\n  let k = Array.from(key);\n  if (k.length > 64) k = sha1(k);\n  while (k.length < 64) k.push(0);\n  const ipad = k.map(b => b ^ 0x36);\n  const opad = k.map(b => b ^ 0x5c);\n  return sha1([...opad, ...sha1([...ipad, ...Array.from(data)])]);\n}\n\nfunction generateTOTP(secret, offset = 0) {\n  const key = base32Decode(secret);\n  const epoch = Math.floor(Date.now() / 1000);\n  const timeStep = Math.floor(epoch / 30) + offset;\n  const data = [\n    0, 0, 0, 0,\n    (timeStep >>> 24) & 0xff,\n    (timeStep >>> 16) & 0xff,\n    (timeStep >>> 8) & 0xff,\n    timeStep & 0xff\n  ];\n  const hmac = hmacSHA1(key, data);\n  const off = hmac[hmac.length - 1] & 0x0f;\n  const code = (\n    ((hmac[off] & 0x7f) << 24) |\n    ((hmac[off+1] & 0xff) << 16) |\n    ((hmac[off+2] & 0xff) << 8) |\n    (hmac[off+3] & 0xff)\n  ) % 1000000;\n  return String(code).padStart(6, '0');\n}\n\nconst secret = '[REDACTED_TOTP_SECRET]';\nconst tempToken = $('Dropi Login Paso 2').item.json.token;\n\n// Usar offset -1 para compensar desfase del servidor\nconst totp = generateTOTP(secret, -1);\n\nreturn [{\n  json: {\n    totp,\n    temp_token: tempToken\n  }\n}];"
  },
  "type": "n8n-nodes-base.code",
  "typeVersion": 2,
  "position": [
    16,
    -16
  ],
  "id": "1ba34502-5e49-4e1d-8415-e2f250b97c3c",
  "name": "Generar TOTP"
}
```

#### Verbatim `jsCode`

```js
const base32Decode = (input) => {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  input = input.toUpperCase().replace(/=+$/, '');
  let bits = 0, value = 0;
  const output = [];
  for (let i = 0; i < input.length; i++) {
    value = (value << 5) | alphabet.indexOf(input[i]);
    bits += 5;
    if (bits >= 8) { output.push((value >>> (bits - 8)) & 255); bits -= 8; }
  }
  return output;
};

function sha1(buffer) {
  let h0=0x67452301,h1=0xEFCDAB89,h2=0x98BADCFE,h3=0x10325476,h4=0xC3D2E1F0;
  const msg = Array.from(buffer);
  const bitLen = msg.length * 8;
  msg.push(0x80);
  while (msg.length % 64 !== 56) msg.push(0);
  for (let i = 7; i >= 0; i--) msg.push((bitLen / Math.pow(2, i*8)) & 0xff);
  for (let i = 0; i < msg.length; i += 64) {
    const w = [];
    for (let j = 0; j < 16; j++)
      w[j] = (msg[i+j*4]<<24)|(msg[i+j*4+1]<<16)|(msg[i+j*4+2]<<8)|msg[i+j*4+3];
    for (let j = 16; j < 80; j++) {
      const x = w[j-3]^w[j-8]^w[j-14]^w[j-16];
      w[j] = (x<<1)|(x>>>31);
    }
    let a=h0,b=h1,c=h2,d=h3,e=h4;
    for (let j = 0; j < 80; j++) {
      let f,k;
      if(j<20){f=(b&c)|((~b)&d);k=0x5A827999;}
      else if(j<40){f=b^c^d;k=0x6ED9EBA1;}
      else if(j<60){f=(b&c)|(b&d)|(c&d);k=0x8F1BBCDC;}
      else{f=b^c^d;k=0xCA62C1D6;}
      const temp=(((a<<5)|(a>>>27))+f+e+k+w[j])>>>0;
      e=d;d=c;c=(b<<30)|(b>>>2);b=a;a=temp;
    }
    h0=(h0+a)>>>0;h1=(h1+b)>>>0;h2=(h2+c)>>>0;h3=(h3+d)>>>0;h4=(h4+e)>>>0;
  }
  const result=[];
  [h0,h1,h2,h3,h4].forEach(h=>{
    for(let i=3;i>=0;i--) result.push((h>>>(i*8))&0xff);
  });
  return result;
}

function hmacSHA1(key, data) {
  let k = Array.from(key);
  if (k.length > 64) k = sha1(k);
  while (k.length < 64) k.push(0);
  const ipad = k.map(b => b ^ 0x36);
  const opad = k.map(b => b ^ 0x5c);
  return sha1([...opad, ...sha1([...ipad, ...Array.from(data)])]);
}

function generateTOTP(secret, offset = 0) {
  const key = base32Decode(secret);
  const epoch = Math.floor(Date.now() / 1000);
  const timeStep = Math.floor(epoch / 30) + offset;
  const data = [
    0, 0, 0, 0,
    (timeStep >>> 24) & 0xff,
    (timeStep >>> 16) & 0xff,
    (timeStep >>> 8) & 0xff,
    timeStep & 0xff
  ];
  const hmac = hmacSHA1(key, data);
  const off = hmac[hmac.length - 1] & 0x0f;
  const code = (
    ((hmac[off] & 0x7f) << 24) |
    ((hmac[off+1] & 0xff) << 16) |
    ((hmac[off+2] & 0xff) << 8) |
    (hmac[off+3] & 0xff)
  ) % 1000000;
  return String(code).padStart(6, '0');
}

const secret = '[REDACTED_TOTP_SECRET]';
const tempToken = $('Dropi Login Paso 2').item.json.token;

// Usar offset -1 para compensar desfase del servidor
const totp = generateTOTP(secret, -1);

return [{
  json: {
    totp,
    temp_token: tempToken
  }
}];
```

### 8. Dropi 2FA Verify

```json
{
  "parameters": {
    "method": "POST",
    "url": "https://api.dropi.co/api/auth/2fa/verify",
    "sendHeaders": true,
    "headerParameters": {
      "parameters": [
        {
          "name": "accept",
          "value": "application/json, text/plain, */*"
        },
        {
          "name": "accept-language",
          "value": "es-419,es;q=0.8"
        },
        {
          "name": "content-type",
          "value": "application/json"
        },
        {
          "name": "origin",
          "value": "https://app.dropi.co"
        },
        {
          "name": "referer",
          "value": "https://app.dropi.co/"
        },
        {
          "name": "sec-ch-ua",
          "value": "\"Chromium\";v=\"148\", \"Brave\";v=\"148\", \"Not/A)Brand\";v=\"99\""
        },
        {
          "name": "sec-ch-ua-mobile",
          "value": "?0"
        },
        {
          "name": "sec-ch-ua-platform",
          "value": "\"Linux\""
        },
        {
          "name": "sec-fetch-dest",
          "value": "empty"
        },
        {
          "name": "sec-fetch-mode",
          "value": "cors"
        },
        {
          "name": "sec-fetch-site",
          "value": "same-site"
        },
        {
          "name": "user-agent",
          "value": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36"
        },
        {
          "name": "x-authorization",
          "value": "=Bearer {{ $json.temp_token }}"
        },
        {
          "name": "x-captcha-token"
        }
      ]
    },
    "sendBody": true,
    "specifyBody": "json",
    "jsonBody": "={\n  \"token\": \"{{ $json.temp_token }}\",\n  \"code\": \"{{ $json.totp }}\"\n}",
    "options": {}
  },
  "type": "n8n-nodes-base.httpRequest",
  "typeVersion": 4.4,
  "position": [
    224,
    -16
  ],
  "id": "e60537d3-4c08-4002-a900-40152ff35d2a",
  "name": "Dropi 2FA Verify"
}
```

### 9. Dropi Login Final

```json
{
  "parameters": {
    "method": "POST",
    "url": "https://api.dropi.co/api/login",
    "sendHeaders": true,
    "headerParameters": {
      "parameters": [
        {
          "name": "accept",
          "value": "application/json, text/plain, */*"
        },
        {
          "name": "accept-language",
          "value": "es-419,es;q=0.8"
        },
        {
          "name": "content-type",
          "value": "application/json"
        },
        {
          "name": "origin",
          "value": "https://app.dropi.co"
        },
        {
          "name": "referer",
          "value": "https://app.dropi.co/"
        },
        {
          "name": "sec-ch-ua",
          "value": "\"Chromium\";v=\"148\", \"Brave\";v=\"148\", \"Not/A)Brand\";v=\"99\""
        },
        {
          "name": "sec-ch-ua-mobile",
          "value": "?0"
        },
        {
          "name": "sec-ch-ua-platform ",
          "value": "\"Linux\""
        },
        {
          "name": "sec-fetch-dest",
          "value": "empty"
        },
        {
          "name": "sec-fetch-mode",
          "value": "cors"
        },
        {
          "name": "sec-fetch-site",
          "value": "same-site"
        },
        {
          "name": "user-agent",
          "value": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36"
        },
        {
          "name": "x-authorization",
          "value": "Bearer undefined"
        },
        {
          "name": "x-captcha-token"
        }
      ]
    },
    "sendBody": true,
    "specifyBody": "json",
    "jsonBody": "={\n  \"email\": \"ecommerce.cop.1@gmail.com\",\n  \"password\": \"[REDACTED_DROPI_PASSWORD]\",\n  \"white_brand_id\": 1,\n  \"brand\": \"\",\n  \"ipAddress\": \"{{ $('Obtener IP').item.json.ip }}\",\n  \"otp\": \"{{ $('Generar TOTP').item.json.totp }}\",\n  \"with_cdc\": false\n}",
    "options": {}
  },
  "type": "n8n-nodes-base.httpRequest",
  "typeVersion": 4.4,
  "position": [
    432,
    -16
  ],
  "id": "b931f313-4247-42a9-a48c-276e99897953",
  "name": "Dropi Login Final"
}
```

### 10. Dropi Before Login 2

```json
{
  "parameters": {
    "method": "POST",
    "url": "https://api.dropi.co/api/beforeLoginUnknownDevice",
    "sendHeaders": true,
    "headerParameters": {
      "parameters": [
        {
          "name": "accept",
          "value": "application/json, text/plain, */*"
        },
        {
          "name": "accept-language",
          "value": "es-419,es;q=0.8"
        },
        {
          "name": "content-type",
          "value": "application/json"
        },
        {
          "name": "origin",
          "value": "https://app.dropi.co"
        },
        {
          "name": "referer",
          "value": "https://app.dropi.co/"
        },
        {
          "name": "sec-ch-ua",
          "value": "\"Chromium\";v=\"148\", \"Brave\";v=\"148\", \"Not/A)Brand\";v=\"99\""
        },
        {
          "name": "sec-ch-ua-mobile",
          "value": "?0"
        },
        {
          "name": "sec-ch-ua-platform",
          "value": "\"Linux\""
        },
        {
          "name": "sec-fetch-dest",
          "value": "empty"
        },
        {
          "name": "sec-fetch-mode",
          "value": "cors"
        },
        {
          "name": "sec-fetch-site",
          "value": "same-site"
        },
        {
          "name": "user-agent",
          "value": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36"
        },
        {
          "name": "x-authorization",
          "value": "Bearer undefined"
        },
        {
          "name": "x-captcha-token"
        }
      ]
    },
    "sendBody": true,
    "specifyBody": "json",
    "jsonBody": "={\n  \"email\": \"ecommerce.cop.1@gmail.com\",\n  \"password\": \"[REDACTED_DROPI_PASSWORD]\",\n  \"white_brand_id\": 1,\n  \"brand\": \"\",\n  \"ipAddress\": \"{{ $('Obtener IP').item.json.ip }}\",\n  \"otp\": null,\n  \"with_cdc\": false\n}",
    "options": {}
  },
  "type": "n8n-nodes-base.httpRequest",
  "typeVersion": 4.4,
  "position": [
    -288,
    -272
  ],
  "id": "84efe52f-0f62-40df-b6e8-32b953462ae3",
  "name": "Dropi Before Login 2"
}
```

### 11. Dropi Consultar Pedidos

```json
{
  "parameters": {
    "url": "=https://api.dropi.co/api/orders/myorders?exportAs=orderByRow&orderBy=id&orderDirection=desc&result_number=50&start=0&textToSearch=&status=null&supplier_id=false&user_id=824352&filter_product=undefined&haveIncidenceProcesamiento=false&tag_id=&warranty=false&seller=null&filter_date_by=FECHA%20DE%20CREADO&invoiced=null&from={{ new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0] }}&until={{ new Date().toISOString().split('T')[0] }}",
    "sendHeaders": true,
    "headerParameters": {
      "parameters": [
        {
          "name": "accept",
          "value": "application/json, text/plain, */*"
        },
        {
          "name": "accept-language",
          "value": "es-419,es;q=0.8"
        },
        {
          "name": "origin",
          "value": "https://app.dropi.co"
        },
        {
          "name": "referer",
          "value": "https://app.dropi.co/"
        },
        {
          "name": "sec-ch-ua",
          "value": "\"Chromium\";v=\"148\", \"Brave\";v=\"148\", \"Not/A)Brand\";v=\"99\""
        },
        {
          "name": "sec-ch-ua-mobile",
          "value": "?0"
        },
        {
          "name": "sec-ch-ua-platform",
          "value": "\"Linux\""
        },
        {
          "name": "sec-fetch-dest",
          "value": "empty"
        },
        {
          "name": "sec-fetch-mode",
          "value": "cors"
        },
        {
          "name": "sec-fetch-site",
          "value": "same-site"
        },
        {
          "name": "user-agent",
          "value": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36"
        },
        {
          "name": "x-authorization",
          "value": "=Bearer {{ $('Dropi Login Final').item.json.token }}"
        },
        {
          "name": "x-captcha-token"
        }
      ]
    },
    "options": {
      "pagination": {
        "pagination": {
          "paginationMode": "updateAParameterInEachRequest",
          "parameters": {
            "parameters": [
              {
                "type": "qs",
                "name": "start",
                "value": "={{ $pageCount * 50 }}"
              }
            ]
          },
          "paginationCompleteWhen": "other",
          "statusCodesWhenComplete": "",
          "completeExpression": "={{ !Array.isArray($response.body?.objects) || $response.body.objects.length < 50 }}",
          "limitPagesFetched": true,
          "maxRequests": 20,
          "requestInterval": 500
        }
      }
    }
  },
  "type": "n8n-nodes-base.httpRequest",
  "typeVersion": 4.4,
  "position": [
    640,
    -16
  ],
  "id": "0ae8ecca-992e-475c-a37e-d8a21246c239",
  "name": "Dropi Consultar Pedidos"
}
```

### 12. Traer ordenes activas Supabase

```json
{
  "parameters": {
    "url": "https://nauqpgsspwfqkxidenkx.supabase.co/rest/v1/orders?select=id,id_orden_shopify,id_orden_dropi,estado_dropi,tarea_generada_para_estado,status_history(registrado_en)&activo=eq.true&status_history.order=registrado_en.desc&status_history.limit=1",
    "sendHeaders": true,
    "headerParameters": {
      "parameters": [
        {
          "name": "apikey",
          "value": "[REDACTED_SECRET]"
        },
        {
          "name": "Authorization",
          "value": "[REDACTED_SECRET]"
        }
      ]
    },
    "options": {}
  },
  "type": "n8n-nodes-base.httpRequest",
  "typeVersion": 4.4,
  "position": [
    848,
    -16
  ],
  "id": "a161ec97-3278-4203-8171-0aab98262e83",
  "name": "Traer ordenes activas Supabase",
  "alwaysOutputData": true,
  "executeOnce": true
}
```

### 13. Comparar y filtrar cambios

```json
{
  "parameters": {
    "jsCode": "const dropiOrders = [];\n\nfunction getDropiObjects(payload) {\n  if (Array.isArray(payload?.objects)) return payload.objects;\n  if (Array.isArray(payload?.data?.objects)) return payload.data.objects;\n  if (Array.isArray(payload?.body?.objects)) return payload.body.objects;\n  return [];\n}\n\nfor (const item of $('Dropi Consultar Pedidos').all()) {\n  dropiOrders.push(...getDropiObjects(item.json));\n}\n\nconst supabaseOrders = $('Traer ordenes activas Supabase').all();\n\nconst estadosCerrados = ['ENTREGADO', 'CANCELADO', 'DEVOLUCION'];\n\nconst estadosNovedad = [\n  'DESTINATARIO SE REHUSA A RECIBIR',\n  'Se visita, no se logra entrega',\n  'No contesta Cliente',\n  'PARA NUEVO INTENTO ENTREGA',\n  'EN CONFIRMACIÓN TELEFÓNICA',\n  'NOVEDAD',\n  'CERRADO POR INCIDENCIA, VER CAUSA',\n  'RECLAME EN OFICINA'\n];\n\nconst generaTarea = (estadoNuevo, novedad) => {\n  if (estadoNuevo === 'GUIA_GENERADA') return 'notificar_guia';\n  if (estadoNuevo === 'PENDIENTE CONFIRMACION') return 'llamar_confirmacion';\n  if (estadosNovedad.includes(estadoNuevo)) return 'presionar_entrega';\n  if (novedad && estadosNovedad.some(e => novedad.toLowerCase().includes(e.toLowerCase()))) return 'presionar_entrega';\n  return null;\n};\n\nfunction normalizeId(value) {\n  return value === null || value === undefined || value === '' ? null : String(value);\n}\n\nfunction getLatestKnownRegisteredAt(supabaseOrder) {\n  const history = supabaseOrder.status_history;\n\n  if (Array.isArray(history) && history.length > 0) {\n    return history[0]?.registrado_en ?? null;\n  }\n\n  if (history && typeof history === 'object') {\n    return history.registrado_en ?? null;\n  }\n\n  return null;\n}\n\nfunction getHistoryEstado(historyEntry) {\n  return historyEntry?.status ?? historyEntry?.estado ?? null;\n}\n\nfunction getHistoryRegisteredAt(historyEntry) {\n  return historyEntry?.created_at ?? historyEntry?.registrado_en ?? historyEntry?.updated_at ?? null;\n}\n\nfunction getHistoryNovedad(historyEntry, fallbackNovedad) {\n  return (\n    historyEntry?.novedad ??\n    historyEntry?.observacion ??\n    historyEntry?.observation ??\n    historyEntry?.description ??\n    historyEntry?.notes ??\n    fallbackNovedad ??\n    null\n  );\n}\n\nfunction isStrictlyAfterKnownRegisteredAt(registradoEn, latestKnownRegisteredAt) {\n  if (!latestKnownRegisteredAt) return true;\n  if (!registradoEn) return false;\n\n  const registeredTime = Date.parse(registradoEn);\n  const latestKnownTime = Date.parse(latestKnownRegisteredAt);\n\n  if (Number.isFinite(registeredTime) && Number.isFinite(latestKnownTime)) {\n    return registeredTime > latestKnownTime;\n  }\n\n  return String(registradoEn) > String(latestKnownRegisteredAt);\n}\n\nfunction getMissingHistoryEntries(history, latestKnownRegisteredAt, fallbackTransportadora, fallbackNovedad) {\n  if (!Array.isArray(history)) return [];\n\n  return history\n    .map((historyEntry) => {\n      const estado = getHistoryEstado(historyEntry);\n      const registradoEn = getHistoryRegisteredAt(historyEntry);\n\n      if (!estado || !registradoEn) {\n        return null;\n      }\n\n      return {\n        estado,\n        transportadora:\n          historyEntry?.transportadora ??\n          historyEntry?.distribution_company?.name ??\n          fallbackTransportadora ??\n          null,\n        novedad: getHistoryNovedad(historyEntry, fallbackNovedad),\n        registrado_en: registradoEn,\n      };\n    })\n    .filter(Boolean)\n    .filter((historyEntry) =>\n      isStrictlyAfterKnownRegisteredAt(historyEntry.registrado_en, latestKnownRegisteredAt),\n    );\n}\n\nconst results = [];\n\nfor (const dropi of dropiOrders) {\n  const dropiShopOrderId = normalizeId(dropi.shop_order_id);\n  const dropiId = normalizeId(dropi.id);\n  const supabase = supabaseOrders.find((s) =>\n    (dropiShopOrderId && normalizeId(s.json.id_orden_shopify) === dropiShopOrderId) ||\n    (dropiId && normalizeId(s.json.id_orden_dropi) === dropiId)\n  );\n\n  if (!supabase) continue;\n\n  const estadoAnterior = supabase.json.estado_dropi;\n  const estadoNuevo = dropi.status;\n  const yaProcesado = supabase.json.tarea_generada_para_estado === estadoNuevo;\n  const cerrar = estadosCerrados.includes(estadoNuevo);\n  const history = Array.isArray(dropi.history) ? dropi.history : [];\n  const historyMatch = [...history].reverse().find((h) => getHistoryEstado(h) === estadoNuevo);\n  const registradoEn = historyMatch ? getHistoryRegisteredAt(historyMatch) : dropi.updated_at;\n  const novedad = dropi.novedad_servientrega || null;\n  const transportadora = dropi.distribution_company?.name || null;\n  const latestKnownStatusRegisteredAt = getLatestKnownRegisteredAt(supabase.json);\n  const historiaFaltante = getMissingHistoryEntries(\n    history,\n    latestKnownStatusRegisteredAt,\n    transportadora,\n    novedad,\n  );\n  const debeActualizarEstado = !(estadoAnterior === estadoNuevo && yaProcesado);\n\n  if (!debeActualizarEstado && historiaFaltante.length === 0) continue;\n\n  const accion = generaTarea(estadoNuevo, novedad);\n\n  const totalPedidos = dropi.client_total_orders || 0;\n  const devoluciones = dropi.client_total_orders_returneds || 0;\n  let nivelRiesgo = 'sin_datos';\n  if (totalPedidos > 0) {\n    const tasa = devoluciones / totalPedidos;\n    if (tasa >= 0.5) nivelRiesgo = 'alto';\n    else if (tasa >= 0.25) nivelRiesgo = 'medio';\n    else nivelRiesgo = 'bajo';\n  }\n\n  let estadoCrm;\n  if (cerrar) {\n    if (estadoNuevo === 'ENTREGADO') estadoCrm = 'entregado';\n    else if (estadoNuevo.includes('DEVOLUCION')) estadoCrm = 'devolucion';\n    else estadoCrm = 'cancelado';\n  } else if (estadoNuevo === 'PENDIENTE CONFIRMACION') {\n    estadoCrm = 'nuevo';\n  } else {\n    estadoCrm = 'en_ruta';\n  }\n\n  const orderDetail = (dropi.orderdetails || [])[0] || {};\n  const costoProducto = parseFloat(orderDetail.supplier_price || 0);\n  const costoEnvio = parseFloat(dropi.shipping_amount || 0);\n\n  results.push({\n    json: {\n      supabase_id: supabase.json.id,\n      dropi_id: dropi.id,\n      numero_orden: supabase.json.numero_orden,\n      estado_anterior: estadoAnterior,\n      estado_nuevo: estadoNuevo,\n      estado_crm: estadoCrm,\n      registrado_en: registradoEn,\n      novedad,\n      cerrar,\n      accion,\n      nombre: dropi.name,\n      telefono: String(dropi.phone),\n      guia: dropi.shipping_guide,\n      transportadora,\n      nivel_riesgo: nivelRiesgo,\n      total_pedidos_cliente: dropi.client_total_orders,\n      pedidos_entregados_cliente: dropi.client_total_orders_delivered,\n      pedidos_devueltos_cliente: devoluciones,\n      costo_producto: costoProducto,\n      costo_envio: costoEnvio,\n      comision_cod: 0,\n      latest_status_history_registrado_en: latestKnownStatusRegisteredAt,\n      historiaFaltante,\n      debe_actualizar_estado: debeActualizarEstado\n    }\n  });\n}\n\nreturn results.length > 0 ? results : [];\n"
  },
  "type": "n8n-nodes-base.code",
  "typeVersion": 2,
  "position": [
    1056,
    -16
  ],
  "id": "7e93ed4e-ab93-4b3f-8dbf-b2c779edbbbf",
  "name": "Comparar y filtrar cambios"
}
```

#### Verbatim `jsCode`

```js
const dropiOrders = [];

function getDropiObjects(payload) {
  if (Array.isArray(payload?.objects)) return payload.objects;
  if (Array.isArray(payload?.data?.objects)) return payload.data.objects;
  if (Array.isArray(payload?.body?.objects)) return payload.body.objects;
  return [];
}

for (const item of $('Dropi Consultar Pedidos').all()) {
  dropiOrders.push(...getDropiObjects(item.json));
}

const supabaseOrders = $('Traer ordenes activas Supabase').all();

const estadosCerrados = ['ENTREGADO', 'CANCELADO', 'DEVOLUCION'];

const estadosNovedad = [
  'DESTINATARIO SE REHUSA A RECIBIR',
  'Se visita, no se logra entrega',
  'No contesta Cliente',
  'PARA NUEVO INTENTO ENTREGA',
  'EN CONFIRMACIÓN TELEFÓNICA',
  'NOVEDAD',
  'CERRADO POR INCIDENCIA, VER CAUSA',
  'RECLAME EN OFICINA'
];

const generaTarea = (estadoNuevo, novedad) => {
  if (estadoNuevo === 'GUIA_GENERADA') return 'notificar_guia';
  if (estadoNuevo === 'PENDIENTE CONFIRMACION') return 'llamar_confirmacion';
  if (estadosNovedad.includes(estadoNuevo)) return 'presionar_entrega';
  if (novedad && estadosNovedad.some(e => novedad.toLowerCase().includes(e.toLowerCase()))) return 'presionar_entrega';
  return null;
};

function normalizeId(value) {
  return value === null || value === undefined || value === '' ? null : String(value);
}

function getLatestKnownRegisteredAt(supabaseOrder) {
  const history = supabaseOrder.status_history;

  if (Array.isArray(history) && history.length > 0) {
    return history[0]?.registrado_en ?? null;
  }

  if (history && typeof history === 'object') {
    return history.registrado_en ?? null;
  }

  return null;
}

function getHistoryEstado(historyEntry) {
  return historyEntry?.status ?? historyEntry?.estado ?? null;
}

function getHistoryRegisteredAt(historyEntry) {
  return historyEntry?.created_at ?? historyEntry?.registrado_en ?? historyEntry?.updated_at ?? null;
}

function getHistoryNovedad(historyEntry, fallbackNovedad) {
  return (
    historyEntry?.novedad ??
    historyEntry?.observacion ??
    historyEntry?.observation ??
    historyEntry?.description ??
    historyEntry?.notes ??
    fallbackNovedad ??
    null
  );
}

function isStrictlyAfterKnownRegisteredAt(registradoEn, latestKnownRegisteredAt) {
  if (!latestKnownRegisteredAt) return true;
  if (!registradoEn) return false;

  const registeredTime = Date.parse(registradoEn);
  const latestKnownTime = Date.parse(latestKnownRegisteredAt);

  if (Number.isFinite(registeredTime) && Number.isFinite(latestKnownTime)) {
    return registeredTime > latestKnownTime;
  }

  return String(registradoEn) > String(latestKnownRegisteredAt);
}

function getMissingHistoryEntries(history, latestKnownRegisteredAt, fallbackTransportadora, fallbackNovedad) {
  if (!Array.isArray(history)) return [];

  return history
    .map((historyEntry) => {
      const estado = getHistoryEstado(historyEntry);
      const registradoEn = getHistoryRegisteredAt(historyEntry);

      if (!estado || !registradoEn) {
        return null;
      }

      return {
        estado,
        transportadora:
          historyEntry?.transportadora ??
          historyEntry?.distribution_company?.name ??
          fallbackTransportadora ??
          null,
        novedad: getHistoryNovedad(historyEntry, fallbackNovedad),
        registrado_en: registradoEn,
      };
    })
    .filter(Boolean)
    .filter((historyEntry) =>
      isStrictlyAfterKnownRegisteredAt(historyEntry.registrado_en, latestKnownRegisteredAt),
    );
}

const results = [];

for (const dropi of dropiOrders) {
  const dropiShopOrderId = normalizeId(dropi.shop_order_id);
  const dropiId = normalizeId(dropi.id);
  const supabase = supabaseOrders.find((s) =>
    (dropiShopOrderId && normalizeId(s.json.id_orden_shopify) === dropiShopOrderId) ||
    (dropiId && normalizeId(s.json.id_orden_dropi) === dropiId)
  );

  if (!supabase) continue;

  const estadoAnterior = supabase.json.estado_dropi;
  const estadoNuevo = dropi.status;
  const yaProcesado = supabase.json.tarea_generada_para_estado === estadoNuevo;
  const cerrar = estadosCerrados.includes(estadoNuevo);
  const history = Array.isArray(dropi.history) ? dropi.history : [];
  const historyMatch = [...history].reverse().find((h) => getHistoryEstado(h) === estadoNuevo);
  const registradoEn = historyMatch ? getHistoryRegisteredAt(historyMatch) : dropi.updated_at;
  const novedad = dropi.novedad_servientrega || null;
  const transportadora = dropi.distribution_company?.name || null;
  const latestKnownStatusRegisteredAt = getLatestKnownRegisteredAt(supabase.json);
  const historiaFaltante = getMissingHistoryEntries(
    history,
    latestKnownStatusRegisteredAt,
    transportadora,
    novedad,
  );
  const debeActualizarEstado = !(estadoAnterior === estadoNuevo && yaProcesado);

  if (!debeActualizarEstado && historiaFaltante.length === 0) continue;

  const accion = generaTarea(estadoNuevo, novedad);

  const totalPedidos = dropi.client_total_orders || 0;
  const devoluciones = dropi.client_total_orders_returneds || 0;
  let nivelRiesgo = 'sin_datos';
  if (totalPedidos > 0) {
    const tasa = devoluciones / totalPedidos;
    if (tasa >= 0.5) nivelRiesgo = 'alto';
    else if (tasa >= 0.25) nivelRiesgo = 'medio';
    else nivelRiesgo = 'bajo';
  }

  let estadoCrm;
  if (cerrar) {
    if (estadoNuevo === 'ENTREGADO') estadoCrm = 'entregado';
    else if (estadoNuevo.includes('DEVOLUCION')) estadoCrm = 'devolucion';
    else estadoCrm = 'cancelado';
  } else if (estadoNuevo === 'PENDIENTE CONFIRMACION') {
    estadoCrm = 'nuevo';
  } else {
    estadoCrm = 'en_ruta';
  }

  const orderDetail = (dropi.orderdetails || [])[0] || {};
  const costoProducto = parseFloat(orderDetail.supplier_price || 0);
  const costoEnvio = parseFloat(dropi.shipping_amount || 0);

  results.push({
    json: {
      supabase_id: supabase.json.id,
      dropi_id: dropi.id,
      numero_orden: supabase.json.numero_orden,
      estado_anterior: estadoAnterior,
      estado_nuevo: estadoNuevo,
      estado_crm: estadoCrm,
      registrado_en: registradoEn,
      novedad,
      cerrar,
      accion,
      nombre: dropi.name,
      telefono: String(dropi.phone),
      guia: dropi.shipping_guide,
      transportadora,
      nivel_riesgo: nivelRiesgo,
      total_pedidos_cliente: dropi.client_total_orders,
      pedidos_entregados_cliente: dropi.client_total_orders_delivered,
      pedidos_devueltos_cliente: devoluciones,
      costo_producto: costoProducto,
      costo_envio: costoEnvio,
      comision_cod: 0,
      latest_status_history_registrado_en: latestKnownStatusRegisteredAt,
      historiaFaltante,
      debe_actualizar_estado: debeActualizarEstado
    }
  });
}

return results.length > 0 ? results : [];

```

### 14. Actualizar orden Supabase

```json
{
  "parameters": {
    "method": "PATCH",
    "url": "=https://nauqpgsspwfqkxidenkx.supabase.co/rest/v1/orders?id=eq.{{ $json.supabase_id }}",
    "sendHeaders": true,
    "headerParameters": {
      "parameters": [
        {
          "name": "apikey",
          "value": "[REDACTED_SECRET]"
        },
        {
          "name": "Authorization",
          "value": "[REDACTED_SECRET]"
        },
        {
          "name": "Content-Type",
          "value": "application/json"
        },
        {
          "name": "Prefer",
          "value": "return=representation"
        }
      ]
    },
    "sendBody": true,
    "specifyBody": "json",
    "jsonBody": "={{ JSON.stringify({ id_orden_dropi: $json.dropi_id, estado_dropi: $json.estado_nuevo, estado_crm: $json.estado_crm, guia_envio: $json.guia, transportadora: $json.transportadora, nivel_riesgo: $json.nivel_riesgo, total_pedidos_cliente: $json.total_pedidos_cliente ?? 0, pedidos_entregados_cliente: $json.pedidos_entregados_cliente ?? 0, pedidos_devueltos_cliente: $json.pedidos_devueltos_cliente ?? 0, activo: $json.cerrar ? false : true, costo_producto: $json.costo_producto ?? 0, costo_envio: $json.costo_envio ?? 0, comision_cod: $json.comision_cod ?? 0, fecha_entrega_real: $json.estado_nuevo === \"ENTREGADO\" ? $json.registrado_en : null }) }}",
    "options": {}
  },
  "type": "n8n-nodes-base.httpRequest",
  "typeVersion": 4.4,
  "position": [
    1264,
    -16
  ],
  "id": "8e9214f7-9f33-4118-89e3-b7a4ccd43479",
  "name": "Actualizar orden Supabase"
}
```

### 15. Registrar historial

```json
{
  "parameters": {
    "method": "POST",
    "url": "https://nauqpgsspwfqkxidenkx.supabase.co/rest/v1/status_history?on_conflict=order_id,estado,registrado_en",
    "sendHeaders": true,
    "headerParameters": {
      "parameters": [
        {
          "name": "apikey",
          "value": "[REDACTED_SECRET]"
        },
        {
          "name": "Authorization",
          "value": "[REDACTED_SECRET]"
        },
        {
          "name": "Content-Type",
          "value": "application/json"
        },
        {
          "name": "Prefer",
          "value": "resolution=ignore-duplicates"
        }
      ]
    },
    "sendBody": true,
    "specifyBody": "json",
    "jsonBody": "={{ JSON.stringify({ order_id: $('Comparar y filtrar cambios').item.json.supabase_id, estado: $('Comparar y filtrar cambios').item.json.estado_nuevo, transportadora: $('Comparar y filtrar cambios').item.json.transportadora, registrado_en: $('Comparar y filtrar cambios').item.json.registrado_en, novedad: $('Comparar y filtrar cambios').item.json.novedad }) }}",
    "options": {}
  },
  "type": "n8n-nodes-base.httpRequest",
  "typeVersion": 4.4,
  "position": [
    1472,
    -16
  ],
  "id": "4908e908-f60e-4d0d-b09a-bbc77d945408",
  "name": "Registrar historial"
}
```

### 16. Schedule Trigger1

```json
{
  "parameters": {
    "rule": {
      "interval": [
        {
          "field": "cronExpression",
          "expression": "30 21 * * *"
        }
      ]
    }
  },
  "type": "n8n-nodes-base.scheduleTrigger",
  "typeVersion": 1.3,
  "position": [
    -1232,
    160
  ],
  "id": "a218a0c9-8d7e-4bcc-a8c6-e26bf20c9d0e",
  "name": "Schedule Trigger1"
}
```

### 17. Dropi Consultar Wallet

```json
{
  "parameters": {
    "url": "=https://api.dropi.co/api/historywallet?orderBy=id&orderDirection=desc&result_number=200&start=0&textToSearch=&type=null&id=null&identification_code=null&user_id=824352&from={{ DateTime.now().minus({days:180}).toFormat('yyyy-MM-dd') }}&until={{ DateTime.now().toFormat('yyyy-MM-dd') }}&wallet_id=0",
    "sendHeaders": true,
    "headerParameters": {
      "parameters": [
        {
          "name": "accept",
          "value": "application/json, text/plain, */*"
        },
        {
          "name": "accept-language",
          "value": "es-419,es;q=0.8"
        },
        {
          "name": "origin",
          "value": "https://app.dropi.co"
        },
        {
          "name": "referer",
          "value": "https://app.dropi.co/"
        },
        {
          "name": "sec-ch-ua",
          "value": "\"Chromium\";v=\"148\", \"Brave\";v=\"148\", \"Not/A)Brand\";v=\"99\""
        },
        {
          "name": "sec-ch-ua-mobile",
          "value": "?0"
        },
        {
          "name": "sec-ch-ua-platform",
          "value": "\"Linux\""
        },
        {
          "name": "sec-fetch-dest",
          "value": "empty"
        },
        {
          "name": "sec-fetch-mode",
          "value": "cors"
        },
        {
          "name": "sec-fetch-site",
          "value": "same-site"
        },
        {
          "name": "user-agent",
          "value": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36"
        },
        {
          "name": "x-authorization",
          "value": "=Bearer {{ $('Dropi Login Final').item.json.token }}"
        },
        {
          "name": "x-captcha-token"
        }
      ]
    },
    "options": {}
  },
  "type": "n8n-nodes-base.httpRequest",
  "typeVersion": 4.4,
  "position": [
    640,
    256
  ],
  "id": "5d9f8871-07ff-47b1-9280-f3a434aeca4f",
  "name": "Dropi Consultar Wallet",
  "alwaysOutputData": false
}
```

### 18. Procesar movimientos wallet

```json
{
  "parameters": {
    "jsCode": "const response = $('Dropi Consultar Wallet').item.json;\nconst movements = response.objects || [];\n\nconst results = [];\n\nfor (const m of movements) {\n  const desc = m.description || '';\n  if (!m.order_id) continue;\n\n  if (desc.startsWith('ENTRADA POR GANANCIA EN LA ORDEN COMO DROPSHIPPER')) {\n    results.push({\n      json: {\n        tipo: 'liquidacion',\n        dropi_id: m.order_id,\n        amount: parseFloat(m.amount || 0),\n        fecha: m.created_at\n      }\n    });\n  } else if (desc.startsWith('SALIDA POR COBRO DE FLETE INICIAL')) {\n    results.push({\n      json: {\n        tipo: 'devolucion',\n        dropi_id: m.order_id,\n        amount: parseFloat(m.amount || 0),\n        fecha: m.created_at\n      }\n    });\n  }\n}\n\nreturn results.length > 0 ? results : [];"
  },
  "type": "n8n-nodes-base.code",
  "typeVersion": 2,
  "position": [
    848,
    256
  ],
  "id": "3c1a7111-9863-4af3-affc-40ab3a6f6f09",
  "name": "Procesar movimientos wallet",
  "alwaysOutputData": true
}
```

#### Verbatim `jsCode`

```js
const response = $('Dropi Consultar Wallet').item.json;
const movements = response.objects || [];

const results = [];

for (const m of movements) {
  const desc = m.description || '';
  if (!m.order_id) continue;

  if (desc.startsWith('ENTRADA POR GANANCIA EN LA ORDEN COMO DROPSHIPPER')) {
    results.push({
      json: {
        tipo: 'liquidacion',
        dropi_id: m.order_id,
        amount: parseFloat(m.amount || 0),
        fecha: m.created_at
      }
    });
  } else if (desc.startsWith('SALIDA POR COBRO DE FLETE INICIAL')) {
    results.push({
      json: {
        tipo: 'devolucion',
        dropi_id: m.order_id,
        amount: parseFloat(m.amount || 0),
        fecha: m.created_at
      }
    });
  }
}

return results.length > 0 ? results : [];
```

### 19. Es liquidacion?

```json
{
  "parameters": {
    "conditions": {
      "options": {
        "caseSensitive": true,
        "leftValue": "",
        "typeValidation": "strict",
        "version": 3
      },
      "conditions": [
        {
          "id": "eec829ca-bd19-4987-82ec-468d571a3628",
          "leftValue": "={{ $json.tipo }}",
          "rightValue": "liquidacion",
          "operator": {
            "type": "string",
            "operation": "equals",
            "name": "filter.operator.equals"
          }
        }
      ],
      "combinator": "and"
    },
    "options": {}
  },
  "type": "n8n-nodes-base.if",
  "typeVersion": 2.3,
  "position": [
    1056,
    256
  ],
  "id": "32bbf42b-c05a-4645-b5d8-a421cfd56054",
  "name": "Es liquidacion?"
}
```

### 20. Actualizar liquidacion

```json
{
  "parameters": {
    "method": "PATCH",
    "url": "=https://nauqpgsspwfqkxidenkx.supabase.co/rest/v1/orders?id_orden_dropi=eq.{{ $json.dropi_id }}",
    "sendHeaders": true,
    "headerParameters": {
      "parameters": [
        {
          "name": "apikey",
          "value": "[REDACTED_SECRET]"
        },
        {
          "name": "Authorization",
          "value": "[REDACTED_SECRET]"
        },
        {
          "name": "Content-Type",
          "value": "application/json"
        },
        {
          "name": "Prefer",
          "value": "return=representation"
        }
      ]
    },
    "sendBody": true,
    "specifyBody": "json",
    "jsonBody": "={\n  \"valor_liquidado\": {{ $json.amount }},\n  \"fecha_liquidacion\": \"{{ $json.fecha }}\",\n  \"estado_liquidacion\": \"liquidado\"\n}",
    "options": {}
  },
  "type": "n8n-nodes-base.httpRequest",
  "typeVersion": 4.4,
  "position": [
    1312,
    224
  ],
  "id": "fc24c214-f5f3-4c55-80e0-d03e0bbfaedf",
  "name": "Actualizar liquidacion"
}
```

### 21. Actualizar devolucion

```json
{
  "parameters": {
    "method": "PATCH",
    "url": "=https://nauqpgsspwfqkxidenkx.supabase.co/rest/v1/orders?id_orden_dropi=eq.{{ $json.dropi_id }}",
    "sendHeaders": true,
    "headerParameters": {
      "parameters": [
        {
          "name": "apikey",
          "value": "[REDACTED_SECRET]"
        },
        {
          "name": "Authorization",
          "value": "[REDACTED_SECRET]"
        },
        {
          "name": "Content-Type",
          "value": "application/json"
        },
        {
          "name": "Prefer",
          "value": "return=representation"
        }
      ]
    },
    "sendBody": true,
    "specifyBody": "json",
    "jsonBody": "={\n  \"costo_devolucion\": {{ $json.amount }}\n}",
    "options": {}
  },
  "type": "n8n-nodes-base.httpRequest",
  "typeVersion": 4.4,
  "position": [
    1312,
    368
  ],
  "id": "11b4f3dc-8221-4deb-8675-718431bebcf7",
  "name": "Actualizar devolucion"
}
```

### 22. Notificar backend CRM

```json
{
  "parameters": {
    "method": "POST",
    "url": "https://crm.pakora.online/api/webhooks/orders/status-changed",
    "sendHeaders": true,
    "headerParameters": {
      "parameters": [
        {
          "name": "x-webhook-secret",
          "value": "[REDACTED_SECRET]"
        },
        {
          "name": "Content-Type",
          "value": "application/json"
        }
      ]
    },
    "sendBody": true,
    "specifyBody": "json",
    "jsonBody": "={\n  \"order_id\": {{ $('Comparar y filtrar cambios').item.json.supabase_id }}\n}",
    "options": {}
  },
  "id": "326d5072-3fdb-479d-b4b1-63f77457cfac",
  "name": "Notificar backend CRM",
  "type": "n8n-nodes-base.httpRequest",
  "typeVersion": 4.4,
  "position": [
    1696,
    144
  ],
  "retryOnFail": true,
  "maxTries": 3,
  "waitBetweenTries": 2000
}
```

### 23. Mapear movimientos wallet completo

```json
{
  "parameters": {
    "jsCode": "const pais = \"CO\";\nconst rows = [];\n\nfunction getObjects(payload) {\n  if (Array.isArray(payload?.objects)) return payload.objects;\n  if (Array.isArray(payload?.data?.objects)) return payload.data.objects;\n  if (Array.isArray(payload?.body?.objects)) return payload.body.objects;\n  return [];\n}\n\nfunction toAmount(value, fallback) {\n  const parsed = parseFloat(value || fallback);\n  return Number.isFinite(parsed) ? parsed : fallback;\n}\n\nfor (const item of $input.all()) {\n  const objects = getObjects(item.json);\n\n  for (const m of objects) {\n    if (!m || m.order_id === null || m.order_id === undefined || m.order_id === \"\") {\n      continue;\n    }\n\n    rows.push({\n      id_movimiento_dropi: m.id,\n      wallet_id: m.wallet_id ?? null,\n      id_orden_dropi: m.order_id,\n      identification_code: m.identification_code != null ? String(m.identification_code) : null,\n      tipo: m.type ?? null,\n      amount: toAmount(m.amount, 0),\n      previous_amount: m.previous_amount != null ? toAmount(m.previous_amount, null) : null,\n      description: m.description ?? null,\n      guia_envio: m.shipping_guide ?? m.guide ?? null,\n      registrado_en: m.created_at,\n      pais,\n    });\n  }\n}\n\nreturn rows.length > 0 ? [{ json: { wallet_movements: rows } }] : [];\n"
  },
  "id": "cd71f133-6e4d-496b-91e3-3e1254067e4b",
  "name": "Mapear movimientos wallet completo",
  "type": "n8n-nodes-base.code",
  "typeVersion": 2,
  "position": [
    1072,
    416
  ]
}
```

#### Verbatim `jsCode`

```js
const pais = "CO";
const rows = [];

function getObjects(payload) {
  if (Array.isArray(payload?.objects)) return payload.objects;
  if (Array.isArray(payload?.data?.objects)) return payload.data.objects;
  if (Array.isArray(payload?.body?.objects)) return payload.body.objects;
  return [];
}

function toAmount(value, fallback) {
  const parsed = parseFloat(value || fallback);
  return Number.isFinite(parsed) ? parsed : fallback;
}

for (const item of $input.all()) {
  const objects = getObjects(item.json);

  for (const m of objects) {
    if (!m || m.order_id === null || m.order_id === undefined || m.order_id === "") {
      continue;
    }

    rows.push({
      id_movimiento_dropi: m.id,
      wallet_id: m.wallet_id ?? null,
      id_orden_dropi: m.order_id,
      identification_code: m.identification_code != null ? String(m.identification_code) : null,
      tipo: m.type ?? null,
      amount: toAmount(m.amount, 0),
      previous_amount: m.previous_amount != null ? toAmount(m.previous_amount, null) : null,
      description: m.description ?? null,
      guia_envio: m.shipping_guide ?? m.guide ?? null,
      registrado_en: m.created_at,
      pais,
    });
  }
}

return rows.length > 0 ? [{ json: { wallet_movements: rows } }] : [];

```

### 24. Insertar movimientos wallet

```json
{
  "parameters": {
    "method": "POST",
    "url": "https://nauqpgsspwfqkxidenkx.supabase.co/rest/v1/wallet_movements?on_conflict=pais,id_movimiento_dropi",
    "sendHeaders": true,
    "headerParameters": {
      "parameters": [
        {
          "name": "apikey",
          "value": "[REDACTED_SECRET]"
        },
        {
          "name": "Authorization",
          "value": "[REDACTED_SECRET]"
        },
        {
          "name": "Content-Type",
          "value": "application/json"
        },
        {
          "name": "Prefer",
          "value": "resolution=ignore-duplicates,return=minimal"
        }
      ]
    },
    "sendBody": true,
    "specifyBody": "json",
    "jsonBody": "={{ $json.wallet_movements }}",
    "options": {}
  },
  "id": "5825b19f-3a40-4ea8-81ae-de70ff60ecc5",
  "name": "Insertar movimientos wallet",
  "type": "n8n-nodes-base.httpRequest",
  "typeVersion": 4.4,
  "position": [
    1488,
    560
  ],
  "retryOnFail": true,
  "maxTries": 3,
  "waitBetweenTries": 2000
}
```

### 25. Chequear pedidos estancados

```json
{
  "parameters": {
    "method": "GET",
    "url": "https://crm.pakora.online/api/cron/check-stale-orders",
    "sendHeaders": true,
    "headerParameters": {
      "parameters": [
        {
          "name": "Authorization",
          "value": "[REDACTED_SECRET]"
        }
      ]
    },
    "options": {}
  },
  "id": "f08ffb89-9253-4601-96e1-99b6b1c4f9eb",
  "name": "Chequear pedidos estancados",
  "type": "n8n-nodes-base.httpRequest",
  "typeVersion": 4.4,
  "position": [
    852,
    134
  ]
}
```

### 26. Filtrar historial faltante

```json
{
  "parameters": {
    "jsCode": "return $input.all().filter((item) =>\n  Array.isArray(item.json.historiaFaltante) && item.json.historiaFaltante.length > 0,\n);\n"
  },
  "id": "ca174379-127a-49f7-a6d4-0815e6796c85",
  "name": "Filtrar historial faltante",
  "type": "n8n-nodes-base.code",
  "typeVersion": 2,
  "position": [
    1476,
    134
  ]
}
```

#### Verbatim `jsCode`

```js
return $input.all().filter((item) =>
  Array.isArray(item.json.historiaFaltante) && item.json.historiaFaltante.length > 0,
);

```

### 27. Procesar historial completo

```json
{
  "parameters": {
    "method": "POST",
    "url": "https://crm.pakora.online/api/webhooks/orders/process-history",
    "sendHeaders": true,
    "headerParameters": {
      "parameters": [
        {
          "name": "x-webhook-secret",
          "value": "[REDACTED_SECRET]"
        },
        {
          "name": "Content-Type",
          "value": "application/json"
        }
      ]
    },
    "sendBody": true,
    "specifyBody": "json",
    "jsonBody": "={{ JSON.stringify({ order_id: $json.supabase_id, history: ($json.historiaFaltante || []).map((entry) => ({ estado: entry.estado, transportadora: entry.transportadora ?? null, novedad: entry.novedad ?? null, registrado_en: entry.registrado_en })) }) }}",
    "options": {}
  },
  "id": "0b55e12e-b801-4e5c-a7ca-42b97b9bb50d",
  "name": "Procesar historial completo",
  "type": "n8n-nodes-base.httpRequest",
  "typeVersion": 4.4,
  "position": [
    1896,
    284
  ],
  "retryOnFail": true,
  "maxTries": 3,
  "waitBetweenTries": 2000
}
```

## Porting risks and fragile behavior observed

1. **Business logic is already embedded in n8n.** `Comparar y filtrar cambios` hardcodes closed states, task decisions, CRM-state mapping, customer risk thresholds, history reconciliation, and monetary mapping. The legacy wallet branch also classifies movements from free-text `description`. Both conflict with the repository rule that n8n only extracts and backend TypeScript owns decisions.
2. **TOTP and Dropi password are hardcoded.** The existing TOTP seed makes a no-relink port technically feasible, but both reusable secrets need to move to server-only secret storage. The code uses the previous TOTP time step (`offset = -1`), which implies clock-skew dependence and can fail around timing boundaries.
3. **The intended random delay is not wired into the Wait node.** `Calcular delay` emits a random millisecond value, while `Esperar delay aleatorio` has only `amount: "=1"`; it never references `$json.delay`.
4. **Both schedules run the entire workflow.** The 21:30 trigger joins before login, so it runs order polling, wallet polling, and stale-order checking—not just wallet extraction. Likewise every daytime trigger runs all three post-login branches.
5. **The post-login and post-update branches are parallel.** Wallet, orders, and stale checking do not wait for one another. `Registrar historial` and `Notificar backend CRM` fan out immediately after the order PATCH, while full-history replay branches directly from comparison; no explicit ordering prevents races between those side effects.
6. **Dropi emulation depends on brittle browser details.** Chrome/Brave version 148 client hints and user agent are hardcoded. Several requests send `Bearer undefined` and an empty captcha header. `accept-language ` and `sec-ch-ua-platform ` include trailing spaces in their header names in two nodes.
7. **Coverage is capped.** Orders inspect at most 20 pages × 50 rows over only the last 30 days. Wallet requests 200 rows over 180 days with no pagination. Older active orders or additional wallet movements can be missed.
8. **The legacy wallet branch uses unstable text.** `Procesar movimientos wallet` recognizes only two Spanish description prefixes, then directly patches financial order fields. In parallel, the newer branch stores all wallet movements by `identification_code`; the duplicate paths can diverge.
9. **State vocabulary is incomplete and exact-match sensitive.** `estadosCerrados` contains only `ENTREGADO`, `CANCELADO`, and exact `DEVOLUCION`; carrier variants may remain active. The logic bypasses the editable `status_catalog` that exists to normalize Dropi’s large state vocabulary.
10. **A selected-field mismatch exists.** `Comparar y filtrar cambios` emits `supabase.json.numero_orden`, but `Traer ordenes activas Supabase` does not select `numero_orden`, so that output is normally `undefined`.
11. **Retry behavior is inconsistent.** Only `Notificar backend CRM`, `Insertar movimientos wallet`, and `Procesar historial completo` carry explicit three-attempt retries. Login, Dropi reads, Supabase order/history writes, and the stale-order cron request have no explicit retry or timeout settings.
12. **Cron timezone is implicit.** The workflow settings contain no timezone; schedule interpretation therefore depends on the n8n instance/workflow default.
13. **Account/country assumptions are hardcoded.** Dropi email, `user_id=824352`, Supabase project URL, country `CO`, endpoints, and status/task vocabulary are embedded directly in nodes.

## Complete redacted API response

This appendix preserves the entire object returned by n8n, including workflow metadata, current graph, sharing metadata, and the duplicated active-version snapshot. It is included so this file remains a self-contained source-of-truth capture.

```json
{
  "updatedAt": "2026-07-06T22:44:48.426Z",
  "createdAt": "2026-06-26T04:16:30.592Z",
  "id": "9p1gvbDxdYqugkMT",
  "name": "Dropi Polling",
  "description": null,
  "active": true,
  "isArchived": false,
  "nodes": [
    {
      "parameters": {
        "rule": {
          "interval": [
            {
              "field": "cronExpression",
              "expression": "0 6,9,12,15,18 * * *"
            }
          ]
        }
      },
      "type": "n8n-nodes-base.scheduleTrigger",
      "typeVersion": 1.3,
      "position": [
        -1232,
        -16
      ],
      "id": "f2756b31-20ed-4e3b-9982-3761b980171f",
      "name": "Schedule Trigger"
    },
    {
      "parameters": {
        "jsCode": "const delay = Math.floor(Math.random() * 15 * 60 * 1000);\nreturn [{ json: { delay } }];"
      },
      "type": "n8n-nodes-base.code",
      "typeVersion": 2,
      "position": [
        -1024,
        -16
      ],
      "id": "64d26c24-ae7b-4de9-b933-9c5314b9e25f",
      "name": "Calcular delay"
    },
    {
      "parameters": {
        "amount": "=1"
      },
      "type": "n8n-nodes-base.wait",
      "typeVersion": 1.1,
      "position": [
        -816,
        -16
      ],
      "id": "f9da3e32-2ef3-4eb0-8736-7068f9708faf",
      "name": "Esperar delay aleatorio",
      "webhookId": "d2533785-1cd2-4dad-8e2b-3e5a47103bc8"
    },
    {
      "parameters": {
        "url": "https://api.ipify.org/?format=json",
        "options": {
          "response": {
            "response": {
              "responseFormat": "json"
            }
          }
        }
      },
      "type": "n8n-nodes-base.httpRequest",
      "typeVersion": 4.4,
      "position": [
        -608,
        -16
      ],
      "id": "86fab41b-d91a-483c-b344-2ed6c3fdae87",
      "name": "Obtener IP"
    },
    {
      "parameters": {
        "method": "POST",
        "url": "https://api.dropi.co/api/beforeLoginUnknownDevice",
        "sendHeaders": true,
        "headerParameters": {
          "parameters": [
            {
              "name": "accept",
              "value": "application/json, text/plain, */*"
            },
            {
              "name": "accept-language",
              "value": "es-419,es;q=0.8"
            },
            {
              "name": "content-type",
              "value": "application/json"
            },
            {
              "name": "origin",
              "value": "https://app.dropi.co"
            },
            {
              "name": "referer",
              "value": "https://app.dropi.co/"
            },
            {
              "name": "sec-ch-ua",
              "value": "\"Chromium\";v=\"148\", \"Brave\";v=\"148\", \"Not/A)Brand\";v=\"99\""
            },
            {
              "name": "sec-ch-ua-mobile",
              "value": "?0"
            },
            {
              "name": "sec-ch-ua-platform",
              "value": "\"Linux\""
            },
            {
              "name": "sec-fetch-dest",
              "value": "empty"
            },
            {
              "name": "sec-fetch-mode",
              "value": "cors"
            },
            {
              "name": "sec-fetch-site",
              "value": "same-site"
            },
            {
              "name": "user-agent",
              "value": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36"
            },
            {
              "name": "x-authorization",
              "value": "Bearer undefined"
            },
            {
              "name": "x-captcha-token"
            }
          ]
        },
        "sendBody": true,
        "specifyBody": "json",
        "jsonBody": "={\n  \"email\": \"ecommerce.cop.1@gmail.com\",\n  \"password\": \"[REDACTED_DROPI_PASSWORD]\",\n  \"white_brand_id\": 1,\n  \"brand\": \"\",\n  \"ipAddress\": \"{{ $('Obtener IP').item.json.ip }}\",\n  \"otp\": null,\n  \"with_cdc\": false\n}",
        "options": {}
      },
      "type": "n8n-nodes-base.httpRequest",
      "typeVersion": 4.4,
      "position": [
        -400,
        -16
      ],
      "id": "e9144ca5-fd51-433a-8708-d26328d0ecaa",
      "name": "Dropi Login Paso 1"
    },
    {
      "parameters": {
        "method": "POST",
        "url": "https://api.dropi.co/api/login",
        "sendHeaders": true,
        "headerParameters": {
          "parameters": [
            {
              "name": "accept",
              "value": "application/json, text/plain, */*"
            },
            {
              "name": "accept-language ",
              "value": "es-419,es;q=0.8"
            },
            {
              "name": "content-type",
              "value": "application/json"
            },
            {
              "name": "origin",
              "value": "https://app.dropi.co"
            },
            {
              "name": "referer",
              "value": "https://app.dropi.co/"
            },
            {
              "name": "sec-ch-ua",
              "value": "\"Chromium\";v=\"148\", \"Brave\";v=\"148\", \"Not/A)Brand\";v=\"99\""
            },
            {
              "name": "sec-ch-ua-mobile",
              "value": "?0"
            },
            {
              "name": "sec-ch-ua-platform",
              "value": "\"Linux\""
            },
            {
              "name": "sec-fetch-dest",
              "value": "empty"
            },
            {
              "name": "sec-fetch-mode",
              "value": "cors"
            },
            {
              "name": "sec-fetch-site",
              "value": "same-site"
            },
            {
              "name": "user-agent",
              "value": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36"
            },
            {
              "name": "x-authorization",
              "value": "Bearer undefined"
            },
            {
              "name": "x-captcha-token"
            }
          ]
        },
        "sendBody": true,
        "specifyBody": "json",
        "jsonBody": "={\n  \"email\": \"ecommerce.cop.1@gmail.com\",\n  \"password\": \"[REDACTED_DROPI_PASSWORD]\",\n  \"white_brand_id\": 1,\n  \"brand\": \"\",\n  \"ipAddress\": \"{{ $('Obtener IP').item.json.ip }}\",\n  \"otp\": null,\n  \"with_cdc\": false\n}",
        "options": {}
      },
      "type": "n8n-nodes-base.httpRequest",
      "typeVersion": 4.4,
      "position": [
        -176,
        -16
      ],
      "id": "1d34b44d-05a1-4198-8f54-ccccf70dd98c",
      "name": "Dropi Login Paso 2"
    },
    {
      "parameters": {
        "jsCode": "const base32Decode = (input) => {\n  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';\n  input = input.toUpperCase().replace(/=+$/, '');\n  let bits = 0, value = 0;\n  const output = [];\n  for (let i = 0; i < input.length; i++) {\n    value = (value << 5) | alphabet.indexOf(input[i]);\n    bits += 5;\n    if (bits >= 8) { output.push((value >>> (bits - 8)) & 255); bits -= 8; }\n  }\n  return output;\n};\n\nfunction sha1(buffer) {\n  let h0=0x67452301,h1=0xEFCDAB89,h2=0x98BADCFE,h3=0x10325476,h4=0xC3D2E1F0;\n  const msg = Array.from(buffer);\n  const bitLen = msg.length * 8;\n  msg.push(0x80);\n  while (msg.length % 64 !== 56) msg.push(0);\n  for (let i = 7; i >= 0; i--) msg.push((bitLen / Math.pow(2, i*8)) & 0xff);\n  for (let i = 0; i < msg.length; i += 64) {\n    const w = [];\n    for (let j = 0; j < 16; j++)\n      w[j] = (msg[i+j*4]<<24)|(msg[i+j*4+1]<<16)|(msg[i+j*4+2]<<8)|msg[i+j*4+3];\n    for (let j = 16; j < 80; j++) {\n      const x = w[j-3]^w[j-8]^w[j-14]^w[j-16];\n      w[j] = (x<<1)|(x>>>31);\n    }\n    let a=h0,b=h1,c=h2,d=h3,e=h4;\n    for (let j = 0; j < 80; j++) {\n      let f,k;\n      if(j<20){f=(b&c)|((~b)&d);k=0x5A827999;}\n      else if(j<40){f=b^c^d;k=0x6ED9EBA1;}\n      else if(j<60){f=(b&c)|(b&d)|(c&d);k=0x8F1BBCDC;}\n      else{f=b^c^d;k=0xCA62C1D6;}\n      const temp=(((a<<5)|(a>>>27))+f+e+k+w[j])>>>0;\n      e=d;d=c;c=(b<<30)|(b>>>2);b=a;a=temp;\n    }\n    h0=(h0+a)>>>0;h1=(h1+b)>>>0;h2=(h2+c)>>>0;h3=(h3+d)>>>0;h4=(h4+e)>>>0;\n  }\n  const result=[];\n  [h0,h1,h2,h3,h4].forEach(h=>{\n    for(let i=3;i>=0;i--) result.push((h>>>(i*8))&0xff);\n  });\n  return result;\n}\n\nfunction hmacSHA1(key, data) {\n  let k = Array.from(key);\n  if (k.length > 64) k = sha1(k);\n  while (k.length < 64) k.push(0);\n  const ipad = k.map(b => b ^ 0x36);\n  const opad = k.map(b => b ^ 0x5c);\n  return sha1([...opad, ...sha1([...ipad, ...Array.from(data)])]);\n}\n\nfunction generateTOTP(secret, offset = 0) {\n  const key = base32Decode(secret);\n  const epoch = Math.floor(Date.now() / 1000);\n  const timeStep = Math.floor(epoch / 30) + offset;\n  const data = [\n    0, 0, 0, 0,\n    (timeStep >>> 24) & 0xff,\n    (timeStep >>> 16) & 0xff,\n    (timeStep >>> 8) & 0xff,\n    timeStep & 0xff\n  ];\n  const hmac = hmacSHA1(key, data);\n  const off = hmac[hmac.length - 1] & 0x0f;\n  const code = (\n    ((hmac[off] & 0x7f) << 24) |\n    ((hmac[off+1] & 0xff) << 16) |\n    ((hmac[off+2] & 0xff) << 8) |\n    (hmac[off+3] & 0xff)\n  ) % 1000000;\n  return String(code).padStart(6, '0');\n}\n\nconst secret = '[REDACTED_TOTP_SECRET]';\nconst tempToken = $('Dropi Login Paso 2').item.json.token;\n\n// Usar offset -1 para compensar desfase del servidor\nconst totp = generateTOTP(secret, -1);\n\nreturn [{\n  json: {\n    totp,\n    temp_token: tempToken\n  }\n}];"
      },
      "type": "n8n-nodes-base.code",
      "typeVersion": 2,
      "position": [
        16,
        -16
      ],
      "id": "1ba34502-5e49-4e1d-8415-e2f250b97c3c",
      "name": "Generar TOTP"
    },
    {
      "parameters": {
        "method": "POST",
        "url": "https://api.dropi.co/api/auth/2fa/verify",
        "sendHeaders": true,
        "headerParameters": {
          "parameters": [
            {
              "name": "accept",
              "value": "application/json, text/plain, */*"
            },
            {
              "name": "accept-language",
              "value": "es-419,es;q=0.8"
            },
            {
              "name": "content-type",
              "value": "application/json"
            },
            {
              "name": "origin",
              "value": "https://app.dropi.co"
            },
            {
              "name": "referer",
              "value": "https://app.dropi.co/"
            },
            {
              "name": "sec-ch-ua",
              "value": "\"Chromium\";v=\"148\", \"Brave\";v=\"148\", \"Not/A)Brand\";v=\"99\""
            },
            {
              "name": "sec-ch-ua-mobile",
              "value": "?0"
            },
            {
              "name": "sec-ch-ua-platform",
              "value": "\"Linux\""
            },
            {
              "name": "sec-fetch-dest",
              "value": "empty"
            },
            {
              "name": "sec-fetch-mode",
              "value": "cors"
            },
            {
              "name": "sec-fetch-site",
              "value": "same-site"
            },
            {
              "name": "user-agent",
              "value": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36"
            },
            {
              "name": "x-authorization",
              "value": "=Bearer {{ $json.temp_token }}"
            },
            {
              "name": "x-captcha-token"
            }
          ]
        },
        "sendBody": true,
        "specifyBody": "json",
        "jsonBody": "={\n  \"token\": \"{{ $json.temp_token }}\",\n  \"code\": \"{{ $json.totp }}\"\n}",
        "options": {}
      },
      "type": "n8n-nodes-base.httpRequest",
      "typeVersion": 4.4,
      "position": [
        224,
        -16
      ],
      "id": "e60537d3-4c08-4002-a900-40152ff35d2a",
      "name": "Dropi 2FA Verify"
    },
    {
      "parameters": {
        "method": "POST",
        "url": "https://api.dropi.co/api/login",
        "sendHeaders": true,
        "headerParameters": {
          "parameters": [
            {
              "name": "accept",
              "value": "application/json, text/plain, */*"
            },
            {
              "name": "accept-language",
              "value": "es-419,es;q=0.8"
            },
            {
              "name": "content-type",
              "value": "application/json"
            },
            {
              "name": "origin",
              "value": "https://app.dropi.co"
            },
            {
              "name": "referer",
              "value": "https://app.dropi.co/"
            },
            {
              "name": "sec-ch-ua",
              "value": "\"Chromium\";v=\"148\", \"Brave\";v=\"148\", \"Not/A)Brand\";v=\"99\""
            },
            {
              "name": "sec-ch-ua-mobile",
              "value": "?0"
            },
            {
              "name": "sec-ch-ua-platform ",
              "value": "\"Linux\""
            },
            {
              "name": "sec-fetch-dest",
              "value": "empty"
            },
            {
              "name": "sec-fetch-mode",
              "value": "cors"
            },
            {
              "name": "sec-fetch-site",
              "value": "same-site"
            },
            {
              "name": "user-agent",
              "value": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36"
            },
            {
              "name": "x-authorization",
              "value": "Bearer undefined"
            },
            {
              "name": "x-captcha-token"
            }
          ]
        },
        "sendBody": true,
        "specifyBody": "json",
        "jsonBody": "={\n  \"email\": \"ecommerce.cop.1@gmail.com\",\n  \"password\": \"[REDACTED_DROPI_PASSWORD]\",\n  \"white_brand_id\": 1,\n  \"brand\": \"\",\n  \"ipAddress\": \"{{ $('Obtener IP').item.json.ip }}\",\n  \"otp\": \"{{ $('Generar TOTP').item.json.totp }}\",\n  \"with_cdc\": false\n}",
        "options": {}
      },
      "type": "n8n-nodes-base.httpRequest",
      "typeVersion": 4.4,
      "position": [
        432,
        -16
      ],
      "id": "b931f313-4247-42a9-a48c-276e99897953",
      "name": "Dropi Login Final"
    },
    {
      "parameters": {
        "method": "POST",
        "url": "https://api.dropi.co/api/beforeLoginUnknownDevice",
        "sendHeaders": true,
        "headerParameters": {
          "parameters": [
            {
              "name": "accept",
              "value": "application/json, text/plain, */*"
            },
            {
              "name": "accept-language",
              "value": "es-419,es;q=0.8"
            },
            {
              "name": "content-type",
              "value": "application/json"
            },
            {
              "name": "origin",
              "value": "https://app.dropi.co"
            },
            {
              "name": "referer",
              "value": "https://app.dropi.co/"
            },
            {
              "name": "sec-ch-ua",
              "value": "\"Chromium\";v=\"148\", \"Brave\";v=\"148\", \"Not/A)Brand\";v=\"99\""
            },
            {
              "name": "sec-ch-ua-mobile",
              "value": "?0"
            },
            {
              "name": "sec-ch-ua-platform",
              "value": "\"Linux\""
            },
            {
              "name": "sec-fetch-dest",
              "value": "empty"
            },
            {
              "name": "sec-fetch-mode",
              "value": "cors"
            },
            {
              "name": "sec-fetch-site",
              "value": "same-site"
            },
            {
              "name": "user-agent",
              "value": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36"
            },
            {
              "name": "x-authorization",
              "value": "Bearer undefined"
            },
            {
              "name": "x-captcha-token"
            }
          ]
        },
        "sendBody": true,
        "specifyBody": "json",
        "jsonBody": "={\n  \"email\": \"ecommerce.cop.1@gmail.com\",\n  \"password\": \"[REDACTED_DROPI_PASSWORD]\",\n  \"white_brand_id\": 1,\n  \"brand\": \"\",\n  \"ipAddress\": \"{{ $('Obtener IP').item.json.ip }}\",\n  \"otp\": null,\n  \"with_cdc\": false\n}",
        "options": {}
      },
      "type": "n8n-nodes-base.httpRequest",
      "typeVersion": 4.4,
      "position": [
        -288,
        -272
      ],
      "id": "84efe52f-0f62-40df-b6e8-32b953462ae3",
      "name": "Dropi Before Login 2"
    },
    {
      "parameters": {
        "url": "=https://api.dropi.co/api/orders/myorders?exportAs=orderByRow&orderBy=id&orderDirection=desc&result_number=50&start=0&textToSearch=&status=null&supplier_id=false&user_id=824352&filter_product=undefined&haveIncidenceProcesamiento=false&tag_id=&warranty=false&seller=null&filter_date_by=FECHA%20DE%20CREADO&invoiced=null&from={{ new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0] }}&until={{ new Date().toISOString().split('T')[0] }}",
        "sendHeaders": true,
        "headerParameters": {
          "parameters": [
            {
              "name": "accept",
              "value": "application/json, text/plain, */*"
            },
            {
              "name": "accept-language",
              "value": "es-419,es;q=0.8"
            },
            {
              "name": "origin",
              "value": "https://app.dropi.co"
            },
            {
              "name": "referer",
              "value": "https://app.dropi.co/"
            },
            {
              "name": "sec-ch-ua",
              "value": "\"Chromium\";v=\"148\", \"Brave\";v=\"148\", \"Not/A)Brand\";v=\"99\""
            },
            {
              "name": "sec-ch-ua-mobile",
              "value": "?0"
            },
            {
              "name": "sec-ch-ua-platform",
              "value": "\"Linux\""
            },
            {
              "name": "sec-fetch-dest",
              "value": "empty"
            },
            {
              "name": "sec-fetch-mode",
              "value": "cors"
            },
            {
              "name": "sec-fetch-site",
              "value": "same-site"
            },
            {
              "name": "user-agent",
              "value": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36"
            },
            {
              "name": "x-authorization",
              "value": "=Bearer {{ $('Dropi Login Final').item.json.token }}"
            },
            {
              "name": "x-captcha-token"
            }
          ]
        },
        "options": {
          "pagination": {
            "pagination": {
              "paginationMode": "updateAParameterInEachRequest",
              "parameters": {
                "parameters": [
                  {
                    "type": "qs",
                    "name": "start",
                    "value": "={{ $pageCount * 50 }}"
                  }
                ]
              },
              "paginationCompleteWhen": "other",
              "statusCodesWhenComplete": "",
              "completeExpression": "={{ !Array.isArray($response.body?.objects) || $response.body.objects.length < 50 }}",
              "limitPagesFetched": true,
              "maxRequests": 20,
              "requestInterval": 500
            }
          }
        }
      },
      "type": "n8n-nodes-base.httpRequest",
      "typeVersion": 4.4,
      "position": [
        640,
        -16
      ],
      "id": "0ae8ecca-992e-475c-a37e-d8a21246c239",
      "name": "Dropi Consultar Pedidos"
    },
    {
      "parameters": {
        "url": "https://nauqpgsspwfqkxidenkx.supabase.co/rest/v1/orders?select=id,id_orden_shopify,id_orden_dropi,estado_dropi,tarea_generada_para_estado,status_history(registrado_en)&activo=eq.true&status_history.order=registrado_en.desc&status_history.limit=1",
        "sendHeaders": true,
        "headerParameters": {
          "parameters": [
            {
              "name": "apikey",
              "value": "[REDACTED_SECRET]"
            },
            {
              "name": "Authorization",
              "value": "[REDACTED_SECRET]"
            }
          ]
        },
        "options": {}
      },
      "type": "n8n-nodes-base.httpRequest",
      "typeVersion": 4.4,
      "position": [
        848,
        -16
      ],
      "id": "a161ec97-3278-4203-8171-0aab98262e83",
      "name": "Traer ordenes activas Supabase",
      "alwaysOutputData": true,
      "executeOnce": true
    },
    {
      "parameters": {
        "jsCode": "const dropiOrders = [];\n\nfunction getDropiObjects(payload) {\n  if (Array.isArray(payload?.objects)) return payload.objects;\n  if (Array.isArray(payload?.data?.objects)) return payload.data.objects;\n  if (Array.isArray(payload?.body?.objects)) return payload.body.objects;\n  return [];\n}\n\nfor (const item of $('Dropi Consultar Pedidos').all()) {\n  dropiOrders.push(...getDropiObjects(item.json));\n}\n\nconst supabaseOrders = $('Traer ordenes activas Supabase').all();\n\nconst estadosCerrados = ['ENTREGADO', 'CANCELADO', 'DEVOLUCION'];\n\nconst estadosNovedad = [\n  'DESTINATARIO SE REHUSA A RECIBIR',\n  'Se visita, no se logra entrega',\n  'No contesta Cliente',\n  'PARA NUEVO INTENTO ENTREGA',\n  'EN CONFIRMACIÓN TELEFÓNICA',\n  'NOVEDAD',\n  'CERRADO POR INCIDENCIA, VER CAUSA',\n  'RECLAME EN OFICINA'\n];\n\nconst generaTarea = (estadoNuevo, novedad) => {\n  if (estadoNuevo === 'GUIA_GENERADA') return 'notificar_guia';\n  if (estadoNuevo === 'PENDIENTE CONFIRMACION') return 'llamar_confirmacion';\n  if (estadosNovedad.includes(estadoNuevo)) return 'presionar_entrega';\n  if (novedad && estadosNovedad.some(e => novedad.toLowerCase().includes(e.toLowerCase()))) return 'presionar_entrega';\n  return null;\n};\n\nfunction normalizeId(value) {\n  return value === null || value === undefined || value === '' ? null : String(value);\n}\n\nfunction getLatestKnownRegisteredAt(supabaseOrder) {\n  const history = supabaseOrder.status_history;\n\n  if (Array.isArray(history) && history.length > 0) {\n    return history[0]?.registrado_en ?? null;\n  }\n\n  if (history && typeof history === 'object') {\n    return history.registrado_en ?? null;\n  }\n\n  return null;\n}\n\nfunction getHistoryEstado(historyEntry) {\n  return historyEntry?.status ?? historyEntry?.estado ?? null;\n}\n\nfunction getHistoryRegisteredAt(historyEntry) {\n  return historyEntry?.created_at ?? historyEntry?.registrado_en ?? historyEntry?.updated_at ?? null;\n}\n\nfunction getHistoryNovedad(historyEntry, fallbackNovedad) {\n  return (\n    historyEntry?.novedad ??\n    historyEntry?.observacion ??\n    historyEntry?.observation ??\n    historyEntry?.description ??\n    historyEntry?.notes ??\n    fallbackNovedad ??\n    null\n  );\n}\n\nfunction isStrictlyAfterKnownRegisteredAt(registradoEn, latestKnownRegisteredAt) {\n  if (!latestKnownRegisteredAt) return true;\n  if (!registradoEn) return false;\n\n  const registeredTime = Date.parse(registradoEn);\n  const latestKnownTime = Date.parse(latestKnownRegisteredAt);\n\n  if (Number.isFinite(registeredTime) && Number.isFinite(latestKnownTime)) {\n    return registeredTime > latestKnownTime;\n  }\n\n  return String(registradoEn) > String(latestKnownRegisteredAt);\n}\n\nfunction getMissingHistoryEntries(history, latestKnownRegisteredAt, fallbackTransportadora, fallbackNovedad) {\n  if (!Array.isArray(history)) return [];\n\n  return history\n    .map((historyEntry) => {\n      const estado = getHistoryEstado(historyEntry);\n      const registradoEn = getHistoryRegisteredAt(historyEntry);\n\n      if (!estado || !registradoEn) {\n        return null;\n      }\n\n      return {\n        estado,\n        transportadora:\n          historyEntry?.transportadora ??\n          historyEntry?.distribution_company?.name ??\n          fallbackTransportadora ??\n          null,\n        novedad: getHistoryNovedad(historyEntry, fallbackNovedad),\n        registrado_en: registradoEn,\n      };\n    })\n    .filter(Boolean)\n    .filter((historyEntry) =>\n      isStrictlyAfterKnownRegisteredAt(historyEntry.registrado_en, latestKnownRegisteredAt),\n    );\n}\n\nconst results = [];\n\nfor (const dropi of dropiOrders) {\n  const dropiShopOrderId = normalizeId(dropi.shop_order_id);\n  const dropiId = normalizeId(dropi.id);\n  const supabase = supabaseOrders.find((s) =>\n    (dropiShopOrderId && normalizeId(s.json.id_orden_shopify) === dropiShopOrderId) ||\n    (dropiId && normalizeId(s.json.id_orden_dropi) === dropiId)\n  );\n\n  if (!supabase) continue;\n\n  const estadoAnterior = supabase.json.estado_dropi;\n  const estadoNuevo = dropi.status;\n  const yaProcesado = supabase.json.tarea_generada_para_estado === estadoNuevo;\n  const cerrar = estadosCerrados.includes(estadoNuevo);\n  const history = Array.isArray(dropi.history) ? dropi.history : [];\n  const historyMatch = [...history].reverse().find((h) => getHistoryEstado(h) === estadoNuevo);\n  const registradoEn = historyMatch ? getHistoryRegisteredAt(historyMatch) : dropi.updated_at;\n  const novedad = dropi.novedad_servientrega || null;\n  const transportadora = dropi.distribution_company?.name || null;\n  const latestKnownStatusRegisteredAt = getLatestKnownRegisteredAt(supabase.json);\n  const historiaFaltante = getMissingHistoryEntries(\n    history,\n    latestKnownStatusRegisteredAt,\n    transportadora,\n    novedad,\n  );\n  const debeActualizarEstado = !(estadoAnterior === estadoNuevo && yaProcesado);\n\n  if (!debeActualizarEstado && historiaFaltante.length === 0) continue;\n\n  const accion = generaTarea(estadoNuevo, novedad);\n\n  const totalPedidos = dropi.client_total_orders || 0;\n  const devoluciones = dropi.client_total_orders_returneds || 0;\n  let nivelRiesgo = 'sin_datos';\n  if (totalPedidos > 0) {\n    const tasa = devoluciones / totalPedidos;\n    if (tasa >= 0.5) nivelRiesgo = 'alto';\n    else if (tasa >= 0.25) nivelRiesgo = 'medio';\n    else nivelRiesgo = 'bajo';\n  }\n\n  let estadoCrm;\n  if (cerrar) {\n    if (estadoNuevo === 'ENTREGADO') estadoCrm = 'entregado';\n    else if (estadoNuevo.includes('DEVOLUCION')) estadoCrm = 'devolucion';\n    else estadoCrm = 'cancelado';\n  } else if (estadoNuevo === 'PENDIENTE CONFIRMACION') {\n    estadoCrm = 'nuevo';\n  } else {\n    estadoCrm = 'en_ruta';\n  }\n\n  const orderDetail = (dropi.orderdetails || [])[0] || {};\n  const costoProducto = parseFloat(orderDetail.supplier_price || 0);\n  const costoEnvio = parseFloat(dropi.shipping_amount || 0);\n\n  results.push({\n    json: {\n      supabase_id: supabase.json.id,\n      dropi_id: dropi.id,\n      numero_orden: supabase.json.numero_orden,\n      estado_anterior: estadoAnterior,\n      estado_nuevo: estadoNuevo,\n      estado_crm: estadoCrm,\n      registrado_en: registradoEn,\n      novedad,\n      cerrar,\n      accion,\n      nombre: dropi.name,\n      telefono: String(dropi.phone),\n      guia: dropi.shipping_guide,\n      transportadora,\n      nivel_riesgo: nivelRiesgo,\n      total_pedidos_cliente: dropi.client_total_orders,\n      pedidos_entregados_cliente: dropi.client_total_orders_delivered,\n      pedidos_devueltos_cliente: devoluciones,\n      costo_producto: costoProducto,\n      costo_envio: costoEnvio,\n      comision_cod: 0,\n      latest_status_history_registrado_en: latestKnownStatusRegisteredAt,\n      historiaFaltante,\n      debe_actualizar_estado: debeActualizarEstado\n    }\n  });\n}\n\nreturn results.length > 0 ? results : [];\n"
      },
      "type": "n8n-nodes-base.code",
      "typeVersion": 2,
      "position": [
        1056,
        -16
      ],
      "id": "7e93ed4e-ab93-4b3f-8dbf-b2c779edbbbf",
      "name": "Comparar y filtrar cambios"
    },
    {
      "parameters": {
        "method": "PATCH",
        "url": "=https://nauqpgsspwfqkxidenkx.supabase.co/rest/v1/orders?id=eq.{{ $json.supabase_id }}",
        "sendHeaders": true,
        "headerParameters": {
          "parameters": [
            {
              "name": "apikey",
              "value": "[REDACTED_SECRET]"
            },
            {
              "name": "Authorization",
              "value": "[REDACTED_SECRET]"
            },
            {
              "name": "Content-Type",
              "value": "application/json"
            },
            {
              "name": "Prefer",
              "value": "return=representation"
            }
          ]
        },
        "sendBody": true,
        "specifyBody": "json",
        "jsonBody": "={{ JSON.stringify({ id_orden_dropi: $json.dropi_id, estado_dropi: $json.estado_nuevo, estado_crm: $json.estado_crm, guia_envio: $json.guia, transportadora: $json.transportadora, nivel_riesgo: $json.nivel_riesgo, total_pedidos_cliente: $json.total_pedidos_cliente ?? 0, pedidos_entregados_cliente: $json.pedidos_entregados_cliente ?? 0, pedidos_devueltos_cliente: $json.pedidos_devueltos_cliente ?? 0, activo: $json.cerrar ? false : true, costo_producto: $json.costo_producto ?? 0, costo_envio: $json.costo_envio ?? 0, comision_cod: $json.comision_cod ?? 0, fecha_entrega_real: $json.estado_nuevo === \"ENTREGADO\" ? $json.registrado_en : null }) }}",
        "options": {}
      },
      "type": "n8n-nodes-base.httpRequest",
      "typeVersion": 4.4,
      "position": [
        1264,
        -16
      ],
      "id": "8e9214f7-9f33-4118-89e3-b7a4ccd43479",
      "name": "Actualizar orden Supabase"
    },
    {
      "parameters": {
        "method": "POST",
        "url": "https://nauqpgsspwfqkxidenkx.supabase.co/rest/v1/status_history?on_conflict=order_id,estado,registrado_en",
        "sendHeaders": true,
        "headerParameters": {
          "parameters": [
            {
              "name": "apikey",
              "value": "[REDACTED_SECRET]"
            },
            {
              "name": "Authorization",
              "value": "[REDACTED_SECRET]"
            },
            {
              "name": "Content-Type",
              "value": "application/json"
            },
            {
              "name": "Prefer",
              "value": "resolution=ignore-duplicates"
            }
          ]
        },
        "sendBody": true,
        "specifyBody": "json",
        "jsonBody": "={{ JSON.stringify({ order_id: $('Comparar y filtrar cambios').item.json.supabase_id, estado: $('Comparar y filtrar cambios').item.json.estado_nuevo, transportadora: $('Comparar y filtrar cambios').item.json.transportadora, registrado_en: $('Comparar y filtrar cambios').item.json.registrado_en, novedad: $('Comparar y filtrar cambios').item.json.novedad }) }}",
        "options": {}
      },
      "type": "n8n-nodes-base.httpRequest",
      "typeVersion": 4.4,
      "position": [
        1472,
        -16
      ],
      "id": "4908e908-f60e-4d0d-b09a-bbc77d945408",
      "name": "Registrar historial"
    },
    {
      "parameters": {
        "rule": {
          "interval": [
            {
              "field": "cronExpression",
              "expression": "30 21 * * *"
            }
          ]
        }
      },
      "type": "n8n-nodes-base.scheduleTrigger",
      "typeVersion": 1.3,
      "position": [
        -1232,
        160
      ],
      "id": "a218a0c9-8d7e-4bcc-a8c6-e26bf20c9d0e",
      "name": "Schedule Trigger1"
    },
    {
      "parameters": {
        "url": "=https://api.dropi.co/api/historywallet?orderBy=id&orderDirection=desc&result_number=200&start=0&textToSearch=&type=null&id=null&identification_code=null&user_id=824352&from={{ DateTime.now().minus({days:180}).toFormat('yyyy-MM-dd') }}&until={{ DateTime.now().toFormat('yyyy-MM-dd') }}&wallet_id=0",
        "sendHeaders": true,
        "headerParameters": {
          "parameters": [
            {
              "name": "accept",
              "value": "application/json, text/plain, */*"
            },
            {
              "name": "accept-language",
              "value": "es-419,es;q=0.8"
            },
            {
              "name": "origin",
              "value": "https://app.dropi.co"
            },
            {
              "name": "referer",
              "value": "https://app.dropi.co/"
            },
            {
              "name": "sec-ch-ua",
              "value": "\"Chromium\";v=\"148\", \"Brave\";v=\"148\", \"Not/A)Brand\";v=\"99\""
            },
            {
              "name": "sec-ch-ua-mobile",
              "value": "?0"
            },
            {
              "name": "sec-ch-ua-platform",
              "value": "\"Linux\""
            },
            {
              "name": "sec-fetch-dest",
              "value": "empty"
            },
            {
              "name": "sec-fetch-mode",
              "value": "cors"
            },
            {
              "name": "sec-fetch-site",
              "value": "same-site"
            },
            {
              "name": "user-agent",
              "value": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36"
            },
            {
              "name": "x-authorization",
              "value": "=Bearer {{ $('Dropi Login Final').item.json.token }}"
            },
            {
              "name": "x-captcha-token"
            }
          ]
        },
        "options": {}
      },
      "type": "n8n-nodes-base.httpRequest",
      "typeVersion": 4.4,
      "position": [
        640,
        256
      ],
      "id": "5d9f8871-07ff-47b1-9280-f3a434aeca4f",
      "name": "Dropi Consultar Wallet",
      "alwaysOutputData": false
    },
    {
      "parameters": {
        "jsCode": "const response = $('Dropi Consultar Wallet').item.json;\nconst movements = response.objects || [];\n\nconst results = [];\n\nfor (const m of movements) {\n  const desc = m.description || '';\n  if (!m.order_id) continue;\n\n  if (desc.startsWith('ENTRADA POR GANANCIA EN LA ORDEN COMO DROPSHIPPER')) {\n    results.push({\n      json: {\n        tipo: 'liquidacion',\n        dropi_id: m.order_id,\n        amount: parseFloat(m.amount || 0),\n        fecha: m.created_at\n      }\n    });\n  } else if (desc.startsWith('SALIDA POR COBRO DE FLETE INICIAL')) {\n    results.push({\n      json: {\n        tipo: 'devolucion',\n        dropi_id: m.order_id,\n        amount: parseFloat(m.amount || 0),\n        fecha: m.created_at\n      }\n    });\n  }\n}\n\nreturn results.length > 0 ? results : [];"
      },
      "type": "n8n-nodes-base.code",
      "typeVersion": 2,
      "position": [
        848,
        256
      ],
      "id": "3c1a7111-9863-4af3-affc-40ab3a6f6f09",
      "name": "Procesar movimientos wallet",
      "alwaysOutputData": true
    },
    {
      "parameters": {
        "conditions": {
          "options": {
            "caseSensitive": true,
            "leftValue": "",
            "typeValidation": "strict",
            "version": 3
          },
          "conditions": [
            {
              "id": "eec829ca-bd19-4987-82ec-468d571a3628",
              "leftValue": "={{ $json.tipo }}",
              "rightValue": "liquidacion",
              "operator": {
                "type": "string",
                "operation": "equals",
                "name": "filter.operator.equals"
              }
            }
          ],
          "combinator": "and"
        },
        "options": {}
      },
      "type": "n8n-nodes-base.if",
      "typeVersion": 2.3,
      "position": [
        1056,
        256
      ],
      "id": "32bbf42b-c05a-4645-b5d8-a421cfd56054",
      "name": "Es liquidacion?"
    },
    {
      "parameters": {
        "method": "PATCH",
        "url": "=https://nauqpgsspwfqkxidenkx.supabase.co/rest/v1/orders?id_orden_dropi=eq.{{ $json.dropi_id }}",
        "sendHeaders": true,
        "headerParameters": {
          "parameters": [
            {
              "name": "apikey",
              "value": "[REDACTED_SECRET]"
            },
            {
              "name": "Authorization",
              "value": "[REDACTED_SECRET]"
            },
            {
              "name": "Content-Type",
              "value": "application/json"
            },
            {
              "name": "Prefer",
              "value": "return=representation"
            }
          ]
        },
        "sendBody": true,
        "specifyBody": "json",
        "jsonBody": "={\n  \"valor_liquidado\": {{ $json.amount }},\n  \"fecha_liquidacion\": \"{{ $json.fecha }}\",\n  \"estado_liquidacion\": \"liquidado\"\n}",
        "options": {}
      },
      "type": "n8n-nodes-base.httpRequest",
      "typeVersion": 4.4,
      "position": [
        1312,
        224
      ],
      "id": "fc24c214-f5f3-4c55-80e0-d03e0bbfaedf",
      "name": "Actualizar liquidacion"
    },
    {
      "parameters": {
        "method": "PATCH",
        "url": "=https://nauqpgsspwfqkxidenkx.supabase.co/rest/v1/orders?id_orden_dropi=eq.{{ $json.dropi_id }}",
        "sendHeaders": true,
        "headerParameters": {
          "parameters": [
            {
              "name": "apikey",
              "value": "[REDACTED_SECRET]"
            },
            {
              "name": "Authorization",
              "value": "[REDACTED_SECRET]"
            },
            {
              "name": "Content-Type",
              "value": "application/json"
            },
            {
              "name": "Prefer",
              "value": "return=representation"
            }
          ]
        },
        "sendBody": true,
        "specifyBody": "json",
        "jsonBody": "={\n  \"costo_devolucion\": {{ $json.amount }}\n}",
        "options": {}
      },
      "type": "n8n-nodes-base.httpRequest",
      "typeVersion": 4.4,
      "position": [
        1312,
        368
      ],
      "id": "11b4f3dc-8221-4deb-8675-718431bebcf7",
      "name": "Actualizar devolucion"
    },
    {
      "parameters": {
        "method": "POST",
        "url": "https://crm.pakora.online/api/webhooks/orders/status-changed",
        "sendHeaders": true,
        "headerParameters": {
          "parameters": [
            {
              "name": "x-webhook-secret",
              "value": "[REDACTED_SECRET]"
            },
            {
              "name": "Content-Type",
              "value": "application/json"
            }
          ]
        },
        "sendBody": true,
        "specifyBody": "json",
        "jsonBody": "={\n  \"order_id\": {{ $('Comparar y filtrar cambios').item.json.supabase_id }}\n}",
        "options": {}
      },
      "id": "326d5072-3fdb-479d-b4b1-63f77457cfac",
      "name": "Notificar backend CRM",
      "type": "n8n-nodes-base.httpRequest",
      "typeVersion": 4.4,
      "position": [
        1696,
        144
      ],
      "retryOnFail": true,
      "maxTries": 3,
      "waitBetweenTries": 2000
    },
    {
      "parameters": {
        "jsCode": "const pais = \"CO\";\nconst rows = [];\n\nfunction getObjects(payload) {\n  if (Array.isArray(payload?.objects)) return payload.objects;\n  if (Array.isArray(payload?.data?.objects)) return payload.data.objects;\n  if (Array.isArray(payload?.body?.objects)) return payload.body.objects;\n  return [];\n}\n\nfunction toAmount(value, fallback) {\n  const parsed = parseFloat(value || fallback);\n  return Number.isFinite(parsed) ? parsed : fallback;\n}\n\nfor (const item of $input.all()) {\n  const objects = getObjects(item.json);\n\n  for (const m of objects) {\n    if (!m || m.order_id === null || m.order_id === undefined || m.order_id === \"\") {\n      continue;\n    }\n\n    rows.push({\n      id_movimiento_dropi: m.id,\n      wallet_id: m.wallet_id ?? null,\n      id_orden_dropi: m.order_id,\n      identification_code: m.identification_code != null ? String(m.identification_code) : null,\n      tipo: m.type ?? null,\n      amount: toAmount(m.amount, 0),\n      previous_amount: m.previous_amount != null ? toAmount(m.previous_amount, null) : null,\n      description: m.description ?? null,\n      guia_envio: m.shipping_guide ?? m.guide ?? null,\n      registrado_en: m.created_at,\n      pais,\n    });\n  }\n}\n\nreturn rows.length > 0 ? [{ json: { wallet_movements: rows } }] : [];\n"
      },
      "id": "cd71f133-6e4d-496b-91e3-3e1254067e4b",
      "name": "Mapear movimientos wallet completo",
      "type": "n8n-nodes-base.code",
      "typeVersion": 2,
      "position": [
        1072,
        416
      ]
    },
    {
      "parameters": {
        "method": "POST",
        "url": "https://nauqpgsspwfqkxidenkx.supabase.co/rest/v1/wallet_movements?on_conflict=pais,id_movimiento_dropi",
        "sendHeaders": true,
        "headerParameters": {
          "parameters": [
            {
              "name": "apikey",
              "value": "[REDACTED_SECRET]"
            },
            {
              "name": "Authorization",
              "value": "[REDACTED_SECRET]"
            },
            {
              "name": "Content-Type",
              "value": "application/json"
            },
            {
              "name": "Prefer",
              "value": "resolution=ignore-duplicates,return=minimal"
            }
          ]
        },
        "sendBody": true,
        "specifyBody": "json",
        "jsonBody": "={{ $json.wallet_movements }}",
        "options": {}
      },
      "id": "5825b19f-3a40-4ea8-81ae-de70ff60ecc5",
      "name": "Insertar movimientos wallet",
      "type": "n8n-nodes-base.httpRequest",
      "typeVersion": 4.4,
      "position": [
        1488,
        560
      ],
      "retryOnFail": true,
      "maxTries": 3,
      "waitBetweenTries": 2000
    },
    {
      "parameters": {
        "method": "GET",
        "url": "https://crm.pakora.online/api/cron/check-stale-orders",
        "sendHeaders": true,
        "headerParameters": {
          "parameters": [
            {
              "name": "Authorization",
              "value": "[REDACTED_SECRET]"
            }
          ]
        },
        "options": {}
      },
      "id": "f08ffb89-9253-4601-96e1-99b6b1c4f9eb",
      "name": "Chequear pedidos estancados",
      "type": "n8n-nodes-base.httpRequest",
      "typeVersion": 4.4,
      "position": [
        852,
        134
      ]
    },
    {
      "parameters": {
        "jsCode": "return $input.all().filter((item) =>\n  Array.isArray(item.json.historiaFaltante) && item.json.historiaFaltante.length > 0,\n);\n"
      },
      "id": "ca174379-127a-49f7-a6d4-0815e6796c85",
      "name": "Filtrar historial faltante",
      "type": "n8n-nodes-base.code",
      "typeVersion": 2,
      "position": [
        1476,
        134
      ]
    },
    {
      "parameters": {
        "method": "POST",
        "url": "https://crm.pakora.online/api/webhooks/orders/process-history",
        "sendHeaders": true,
        "headerParameters": {
          "parameters": [
            {
              "name": "x-webhook-secret",
              "value": "[REDACTED_SECRET]"
            },
            {
              "name": "Content-Type",
              "value": "application/json"
            }
          ]
        },
        "sendBody": true,
        "specifyBody": "json",
        "jsonBody": "={{ JSON.stringify({ order_id: $json.supabase_id, history: ($json.historiaFaltante || []).map((entry) => ({ estado: entry.estado, transportadora: entry.transportadora ?? null, novedad: entry.novedad ?? null, registrado_en: entry.registrado_en })) }) }}",
        "options": {}
      },
      "id": "0b55e12e-b801-4e5c-a7ca-42b97b9bb50d",
      "name": "Procesar historial completo",
      "type": "n8n-nodes-base.httpRequest",
      "typeVersion": 4.4,
      "position": [
        1896,
        284
      ],
      "retryOnFail": true,
      "maxTries": 3,
      "waitBetweenTries": 2000
    }
  ],
  "connections": {
    "Schedule Trigger": {
      "main": [
        [
          {
            "node": "Calcular delay",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "Calcular delay": {
      "main": [
        [
          {
            "node": "Esperar delay aleatorio",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "Esperar delay aleatorio": {
      "main": [
        [
          {
            "node": "Obtener IP",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "Obtener IP": {
      "main": [
        [
          {
            "node": "Dropi Login Paso 1",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "Dropi Login Paso 1": {
      "main": [
        [
          {
            "node": "Dropi Login Paso 2",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "Dropi Login Paso 2": {
      "main": [
        [
          {
            "node": "Generar TOTP",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "Generar TOTP": {
      "main": [
        [
          {
            "node": "Dropi 2FA Verify",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "Dropi 2FA Verify": {
      "main": [
        [
          {
            "node": "Dropi Before Login 2",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "Dropi Before Login 2": {
      "main": [
        [
          {
            "node": "Dropi Login Final",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "Dropi Login Final": {
      "main": [
        [
          {
            "node": "Dropi Consultar Pedidos",
            "type": "main",
            "index": 0
          },
          {
            "node": "Dropi Consultar Wallet",
            "type": "main",
            "index": 0
          },
          {
            "node": "Chequear pedidos estancados",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "Dropi Consultar Pedidos": {
      "main": [
        [
          {
            "node": "Traer ordenes activas Supabase",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "Traer ordenes activas Supabase": {
      "main": [
        [
          {
            "node": "Comparar y filtrar cambios",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "Comparar y filtrar cambios": {
      "main": [
        [
          {
            "node": "Actualizar orden Supabase",
            "type": "main",
            "index": 0
          },
          {
            "node": "Filtrar historial faltante",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "Actualizar orden Supabase": {
      "main": [
        [
          {
            "node": "Registrar historial",
            "type": "main",
            "index": 0
          },
          {
            "node": "Notificar backend CRM",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "Registrar historial": {
      "main": [
        []
      ]
    },
    "Schedule Trigger1": {
      "main": [
        [
          {
            "node": "Calcular delay",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "Dropi Consultar Wallet": {
      "main": [
        [
          {
            "node": "Procesar movimientos wallet",
            "type": "main",
            "index": 0
          },
          {
            "node": "Mapear movimientos wallet completo",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "Procesar movimientos wallet": {
      "main": [
        [
          {
            "node": "Es liquidacion?",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "Es liquidacion?": {
      "main": [
        [
          {
            "node": "Actualizar liquidacion",
            "type": "main",
            "index": 0
          }
        ],
        [
          {
            "node": "Actualizar devolucion",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "Mapear movimientos wallet completo": {
      "main": [
        [
          {
            "node": "Insertar movimientos wallet",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "Filtrar historial faltante": {
      "main": [
        [
          {
            "node": "Procesar historial completo",
            "type": "main",
            "index": 0
          }
        ]
      ]
    }
  },
  "settings": {
    "executionOrder": "v1",
    "binaryMode": "separate",
    "availableInMCP": false
  },
  "staticData": {
    "node:Schedule Trigger": {
      "recurrenceRules": []
    },
    "node:Schedule Trigger1": {
      "recurrenceRules": []
    }
  },
  "meta": null,
  "nodeGroups": [],
  "pinData": {},
  "versionId": "e7048916-e082-493e-9731-2b2b3f4d567b",
  "activeVersionId": "e7048916-e082-493e-9731-2b2b3f4d567b",
  "versionCounter": 134,
  "triggerCount": 2,
  "sourceWorkflowId": null,
  "shared": [
    {
      "updatedAt": "2026-06-26T04:16:30.593Z",
      "createdAt": "2026-06-26T04:16:30.593Z",
      "role": "workflow:owner",
      "workflowId": "9p1gvbDxdYqugkMT",
      "projectId": "HfR1pvPYJyWnS0eR",
      "project": {
        "updatedAt": "2026-05-28T11:23:05.721Z",
        "createdAt": "2026-05-28T11:22:34.096Z",
        "id": "HfR1pvPYJyWnS0eR",
        "name": "Alejandro Torres <alejandroth@proton.me>",
        "type": "personal",
        "icon": null,
        "description": null,
        "customTelemetryTags": [],
        "creatorId": "55f82161-b55f-4333-8015-8bc98163d495"
      }
    }
  ],
  "tags": [],
  "activeVersion": {
    "updatedAt": "2026-07-06T22:44:48.427Z",
    "createdAt": "2026-07-06T22:44:48.427Z",
    "versionId": "e7048916-e082-493e-9731-2b2b3f4d567b",
    "workflowId": "9p1gvbDxdYqugkMT",
    "nodes": [
      {
        "parameters": {
          "rule": {
            "interval": [
              {
                "field": "cronExpression",
                "expression": "0 6,9,12,15,18 * * *"
              }
            ]
          }
        },
        "type": "n8n-nodes-base.scheduleTrigger",
        "typeVersion": 1.3,
        "position": [
          -1232,
          -16
        ],
        "id": "f2756b31-20ed-4e3b-9982-3761b980171f",
        "name": "Schedule Trigger"
      },
      {
        "parameters": {
          "jsCode": "const delay = Math.floor(Math.random() * 15 * 60 * 1000);\nreturn [{ json: { delay } }];"
        },
        "type": "n8n-nodes-base.code",
        "typeVersion": 2,
        "position": [
          -1024,
          -16
        ],
        "id": "64d26c24-ae7b-4de9-b933-9c5314b9e25f",
        "name": "Calcular delay"
      },
      {
        "parameters": {
          "amount": "=1"
        },
        "type": "n8n-nodes-base.wait",
        "typeVersion": 1.1,
        "position": [
          -816,
          -16
        ],
        "id": "f9da3e32-2ef3-4eb0-8736-7068f9708faf",
        "name": "Esperar delay aleatorio",
        "webhookId": "d2533785-1cd2-4dad-8e2b-3e5a47103bc8"
      },
      {
        "parameters": {
          "url": "https://api.ipify.org/?format=json",
          "options": {
            "response": {
              "response": {
                "responseFormat": "json"
              }
            }
          }
        },
        "type": "n8n-nodes-base.httpRequest",
        "typeVersion": 4.4,
        "position": [
          -608,
          -16
        ],
        "id": "86fab41b-d91a-483c-b344-2ed6c3fdae87",
        "name": "Obtener IP"
      },
      {
        "parameters": {
          "method": "POST",
          "url": "https://api.dropi.co/api/beforeLoginUnknownDevice",
          "sendHeaders": true,
          "headerParameters": {
            "parameters": [
              {
                "name": "accept",
                "value": "application/json, text/plain, */*"
              },
              {
                "name": "accept-language",
                "value": "es-419,es;q=0.8"
              },
              {
                "name": "content-type",
                "value": "application/json"
              },
              {
                "name": "origin",
                "value": "https://app.dropi.co"
              },
              {
                "name": "referer",
                "value": "https://app.dropi.co/"
              },
              {
                "name": "sec-ch-ua",
                "value": "\"Chromium\";v=\"148\", \"Brave\";v=\"148\", \"Not/A)Brand\";v=\"99\""
              },
              {
                "name": "sec-ch-ua-mobile",
                "value": "?0"
              },
              {
                "name": "sec-ch-ua-platform",
                "value": "\"Linux\""
              },
              {
                "name": "sec-fetch-dest",
                "value": "empty"
              },
              {
                "name": "sec-fetch-mode",
                "value": "cors"
              },
              {
                "name": "sec-fetch-site",
                "value": "same-site"
              },
              {
                "name": "user-agent",
                "value": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36"
              },
              {
                "name": "x-authorization",
                "value": "Bearer undefined"
              },
              {
                "name": "x-captcha-token"
              }
            ]
          },
          "sendBody": true,
          "specifyBody": "json",
          "jsonBody": "={\n  \"email\": \"ecommerce.cop.1@gmail.com\",\n  \"password\": \"[REDACTED_DROPI_PASSWORD]\",\n  \"white_brand_id\": 1,\n  \"brand\": \"\",\n  \"ipAddress\": \"{{ $('Obtener IP').item.json.ip }}\",\n  \"otp\": null,\n  \"with_cdc\": false\n}",
          "options": {}
        },
        "type": "n8n-nodes-base.httpRequest",
        "typeVersion": 4.4,
        "position": [
          -400,
          -16
        ],
        "id": "e9144ca5-fd51-433a-8708-d26328d0ecaa",
        "name": "Dropi Login Paso 1"
      },
      {
        "parameters": {
          "method": "POST",
          "url": "https://api.dropi.co/api/login",
          "sendHeaders": true,
          "headerParameters": {
            "parameters": [
              {
                "name": "accept",
                "value": "application/json, text/plain, */*"
              },
              {
                "name": "accept-language ",
                "value": "es-419,es;q=0.8"
              },
              {
                "name": "content-type",
                "value": "application/json"
              },
              {
                "name": "origin",
                "value": "https://app.dropi.co"
              },
              {
                "name": "referer",
                "value": "https://app.dropi.co/"
              },
              {
                "name": "sec-ch-ua",
                "value": "\"Chromium\";v=\"148\", \"Brave\";v=\"148\", \"Not/A)Brand\";v=\"99\""
              },
              {
                "name": "sec-ch-ua-mobile",
                "value": "?0"
              },
              {
                "name": "sec-ch-ua-platform",
                "value": "\"Linux\""
              },
              {
                "name": "sec-fetch-dest",
                "value": "empty"
              },
              {
                "name": "sec-fetch-mode",
                "value": "cors"
              },
              {
                "name": "sec-fetch-site",
                "value": "same-site"
              },
              {
                "name": "user-agent",
                "value": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36"
              },
              {
                "name": "x-authorization",
                "value": "Bearer undefined"
              },
              {
                "name": "x-captcha-token"
              }
            ]
          },
          "sendBody": true,
          "specifyBody": "json",
          "jsonBody": "={\n  \"email\": \"ecommerce.cop.1@gmail.com\",\n  \"password\": \"[REDACTED_DROPI_PASSWORD]\",\n  \"white_brand_id\": 1,\n  \"brand\": \"\",\n  \"ipAddress\": \"{{ $('Obtener IP').item.json.ip }}\",\n  \"otp\": null,\n  \"with_cdc\": false\n}",
          "options": {}
        },
        "type": "n8n-nodes-base.httpRequest",
        "typeVersion": 4.4,
        "position": [
          -176,
          -16
        ],
        "id": "1d34b44d-05a1-4198-8f54-ccccf70dd98c",
        "name": "Dropi Login Paso 2"
      },
      {
        "parameters": {
          "jsCode": "const base32Decode = (input) => {\n  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';\n  input = input.toUpperCase().replace(/=+$/, '');\n  let bits = 0, value = 0;\n  const output = [];\n  for (let i = 0; i < input.length; i++) {\n    value = (value << 5) | alphabet.indexOf(input[i]);\n    bits += 5;\n    if (bits >= 8) { output.push((value >>> (bits - 8)) & 255); bits -= 8; }\n  }\n  return output;\n};\n\nfunction sha1(buffer) {\n  let h0=0x67452301,h1=0xEFCDAB89,h2=0x98BADCFE,h3=0x10325476,h4=0xC3D2E1F0;\n  const msg = Array.from(buffer);\n  const bitLen = msg.length * 8;\n  msg.push(0x80);\n  while (msg.length % 64 !== 56) msg.push(0);\n  for (let i = 7; i >= 0; i--) msg.push((bitLen / Math.pow(2, i*8)) & 0xff);\n  for (let i = 0; i < msg.length; i += 64) {\n    const w = [];\n    for (let j = 0; j < 16; j++)\n      w[j] = (msg[i+j*4]<<24)|(msg[i+j*4+1]<<16)|(msg[i+j*4+2]<<8)|msg[i+j*4+3];\n    for (let j = 16; j < 80; j++) {\n      const x = w[j-3]^w[j-8]^w[j-14]^w[j-16];\n      w[j] = (x<<1)|(x>>>31);\n    }\n    let a=h0,b=h1,c=h2,d=h3,e=h4;\n    for (let j = 0; j < 80; j++) {\n      let f,k;\n      if(j<20){f=(b&c)|((~b)&d);k=0x5A827999;}\n      else if(j<40){f=b^c^d;k=0x6ED9EBA1;}\n      else if(j<60){f=(b&c)|(b&d)|(c&d);k=0x8F1BBCDC;}\n      else{f=b^c^d;k=0xCA62C1D6;}\n      const temp=(((a<<5)|(a>>>27))+f+e+k+w[j])>>>0;\n      e=d;d=c;c=(b<<30)|(b>>>2);b=a;a=temp;\n    }\n    h0=(h0+a)>>>0;h1=(h1+b)>>>0;h2=(h2+c)>>>0;h3=(h3+d)>>>0;h4=(h4+e)>>>0;\n  }\n  const result=[];\n  [h0,h1,h2,h3,h4].forEach(h=>{\n    for(let i=3;i>=0;i--) result.push((h>>>(i*8))&0xff);\n  });\n  return result;\n}\n\nfunction hmacSHA1(key, data) {\n  let k = Array.from(key);\n  if (k.length > 64) k = sha1(k);\n  while (k.length < 64) k.push(0);\n  const ipad = k.map(b => b ^ 0x36);\n  const opad = k.map(b => b ^ 0x5c);\n  return sha1([...opad, ...sha1([...ipad, ...Array.from(data)])]);\n}\n\nfunction generateTOTP(secret, offset = 0) {\n  const key = base32Decode(secret);\n  const epoch = Math.floor(Date.now() / 1000);\n  const timeStep = Math.floor(epoch / 30) + offset;\n  const data = [\n    0, 0, 0, 0,\n    (timeStep >>> 24) & 0xff,\n    (timeStep >>> 16) & 0xff,\n    (timeStep >>> 8) & 0xff,\n    timeStep & 0xff\n  ];\n  const hmac = hmacSHA1(key, data);\n  const off = hmac[hmac.length - 1] & 0x0f;\n  const code = (\n    ((hmac[off] & 0x7f) << 24) |\n    ((hmac[off+1] & 0xff) << 16) |\n    ((hmac[off+2] & 0xff) << 8) |\n    (hmac[off+3] & 0xff)\n  ) % 1000000;\n  return String(code).padStart(6, '0');\n}\n\nconst secret = '[REDACTED_TOTP_SECRET]';\nconst tempToken = $('Dropi Login Paso 2').item.json.token;\n\n// Usar offset -1 para compensar desfase del servidor\nconst totp = generateTOTP(secret, -1);\n\nreturn [{\n  json: {\n    totp,\n    temp_token: tempToken\n  }\n}];"
        },
        "type": "n8n-nodes-base.code",
        "typeVersion": 2,
        "position": [
          16,
          -16
        ],
        "id": "1ba34502-5e49-4e1d-8415-e2f250b97c3c",
        "name": "Generar TOTP"
      },
      {
        "parameters": {
          "method": "POST",
          "url": "https://api.dropi.co/api/auth/2fa/verify",
          "sendHeaders": true,
          "headerParameters": {
            "parameters": [
              {
                "name": "accept",
                "value": "application/json, text/plain, */*"
              },
              {
                "name": "accept-language",
                "value": "es-419,es;q=0.8"
              },
              {
                "name": "content-type",
                "value": "application/json"
              },
              {
                "name": "origin",
                "value": "https://app.dropi.co"
              },
              {
                "name": "referer",
                "value": "https://app.dropi.co/"
              },
              {
                "name": "sec-ch-ua",
                "value": "\"Chromium\";v=\"148\", \"Brave\";v=\"148\", \"Not/A)Brand\";v=\"99\""
              },
              {
                "name": "sec-ch-ua-mobile",
                "value": "?0"
              },
              {
                "name": "sec-ch-ua-platform",
                "value": "\"Linux\""
              },
              {
                "name": "sec-fetch-dest",
                "value": "empty"
              },
              {
                "name": "sec-fetch-mode",
                "value": "cors"
              },
              {
                "name": "sec-fetch-site",
                "value": "same-site"
              },
              {
                "name": "user-agent",
                "value": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36"
              },
              {
                "name": "x-authorization",
                "value": "=Bearer {{ $json.temp_token }}"
              },
              {
                "name": "x-captcha-token"
              }
            ]
          },
          "sendBody": true,
          "specifyBody": "json",
          "jsonBody": "={\n  \"token\": \"{{ $json.temp_token }}\",\n  \"code\": \"{{ $json.totp }}\"\n}",
          "options": {}
        },
        "type": "n8n-nodes-base.httpRequest",
        "typeVersion": 4.4,
        "position": [
          224,
          -16
        ],
        "id": "e60537d3-4c08-4002-a900-40152ff35d2a",
        "name": "Dropi 2FA Verify"
      },
      {
        "parameters": {
          "method": "POST",
          "url": "https://api.dropi.co/api/login",
          "sendHeaders": true,
          "headerParameters": {
            "parameters": [
              {
                "name": "accept",
                "value": "application/json, text/plain, */*"
              },
              {
                "name": "accept-language",
                "value": "es-419,es;q=0.8"
              },
              {
                "name": "content-type",
                "value": "application/json"
              },
              {
                "name": "origin",
                "value": "https://app.dropi.co"
              },
              {
                "name": "referer",
                "value": "https://app.dropi.co/"
              },
              {
                "name": "sec-ch-ua",
                "value": "\"Chromium\";v=\"148\", \"Brave\";v=\"148\", \"Not/A)Brand\";v=\"99\""
              },
              {
                "name": "sec-ch-ua-mobile",
                "value": "?0"
              },
              {
                "name": "sec-ch-ua-platform ",
                "value": "\"Linux\""
              },
              {
                "name": "sec-fetch-dest",
                "value": "empty"
              },
              {
                "name": "sec-fetch-mode",
                "value": "cors"
              },
              {
                "name": "sec-fetch-site",
                "value": "same-site"
              },
              {
                "name": "user-agent",
                "value": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36"
              },
              {
                "name": "x-authorization",
                "value": "Bearer undefined"
              },
              {
                "name": "x-captcha-token"
              }
            ]
          },
          "sendBody": true,
          "specifyBody": "json",
          "jsonBody": "={\n  \"email\": \"ecommerce.cop.1@gmail.com\",\n  \"password\": \"[REDACTED_DROPI_PASSWORD]\",\n  \"white_brand_id\": 1,\n  \"brand\": \"\",\n  \"ipAddress\": \"{{ $('Obtener IP').item.json.ip }}\",\n  \"otp\": \"{{ $('Generar TOTP').item.json.totp }}\",\n  \"with_cdc\": false\n}",
          "options": {}
        },
        "type": "n8n-nodes-base.httpRequest",
        "typeVersion": 4.4,
        "position": [
          432,
          -16
        ],
        "id": "b931f313-4247-42a9-a48c-276e99897953",
        "name": "Dropi Login Final"
      },
      {
        "parameters": {
          "method": "POST",
          "url": "https://api.dropi.co/api/beforeLoginUnknownDevice",
          "sendHeaders": true,
          "headerParameters": {
            "parameters": [
              {
                "name": "accept",
                "value": "application/json, text/plain, */*"
              },
              {
                "name": "accept-language",
                "value": "es-419,es;q=0.8"
              },
              {
                "name": "content-type",
                "value": "application/json"
              },
              {
                "name": "origin",
                "value": "https://app.dropi.co"
              },
              {
                "name": "referer",
                "value": "https://app.dropi.co/"
              },
              {
                "name": "sec-ch-ua",
                "value": "\"Chromium\";v=\"148\", \"Brave\";v=\"148\", \"Not/A)Brand\";v=\"99\""
              },
              {
                "name": "sec-ch-ua-mobile",
                "value": "?0"
              },
              {
                "name": "sec-ch-ua-platform",
                "value": "\"Linux\""
              },
              {
                "name": "sec-fetch-dest",
                "value": "empty"
              },
              {
                "name": "sec-fetch-mode",
                "value": "cors"
              },
              {
                "name": "sec-fetch-site",
                "value": "same-site"
              },
              {
                "name": "user-agent",
                "value": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36"
              },
              {
                "name": "x-authorization",
                "value": "Bearer undefined"
              },
              {
                "name": "x-captcha-token"
              }
            ]
          },
          "sendBody": true,
          "specifyBody": "json",
          "jsonBody": "={\n  \"email\": \"ecommerce.cop.1@gmail.com\",\n  \"password\": \"[REDACTED_DROPI_PASSWORD]\",\n  \"white_brand_id\": 1,\n  \"brand\": \"\",\n  \"ipAddress\": \"{{ $('Obtener IP').item.json.ip }}\",\n  \"otp\": null,\n  \"with_cdc\": false\n}",
          "options": {}
        },
        "type": "n8n-nodes-base.httpRequest",
        "typeVersion": 4.4,
        "position": [
          -288,
          -272
        ],
        "id": "84efe52f-0f62-40df-b6e8-32b953462ae3",
        "name": "Dropi Before Login 2"
      },
      {
        "parameters": {
          "url": "=https://api.dropi.co/api/orders/myorders?exportAs=orderByRow&orderBy=id&orderDirection=desc&result_number=50&start=0&textToSearch=&status=null&supplier_id=false&user_id=824352&filter_product=undefined&haveIncidenceProcesamiento=false&tag_id=&warranty=false&seller=null&filter_date_by=FECHA%20DE%20CREADO&invoiced=null&from={{ new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0] }}&until={{ new Date().toISOString().split('T')[0] }}",
          "sendHeaders": true,
          "headerParameters": {
            "parameters": [
              {
                "name": "accept",
                "value": "application/json, text/plain, */*"
              },
              {
                "name": "accept-language",
                "value": "es-419,es;q=0.8"
              },
              {
                "name": "origin",
                "value": "https://app.dropi.co"
              },
              {
                "name": "referer",
                "value": "https://app.dropi.co/"
              },
              {
                "name": "sec-ch-ua",
                "value": "\"Chromium\";v=\"148\", \"Brave\";v=\"148\", \"Not/A)Brand\";v=\"99\""
              },
              {
                "name": "sec-ch-ua-mobile",
                "value": "?0"
              },
              {
                "name": "sec-ch-ua-platform",
                "value": "\"Linux\""
              },
              {
                "name": "sec-fetch-dest",
                "value": "empty"
              },
              {
                "name": "sec-fetch-mode",
                "value": "cors"
              },
              {
                "name": "sec-fetch-site",
                "value": "same-site"
              },
              {
                "name": "user-agent",
                "value": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36"
              },
              {
                "name": "x-authorization",
                "value": "=Bearer {{ $('Dropi Login Final').item.json.token }}"
              },
              {
                "name": "x-captcha-token"
              }
            ]
          },
          "options": {
            "pagination": {
              "pagination": {
                "paginationMode": "updateAParameterInEachRequest",
                "parameters": {
                  "parameters": [
                    {
                      "type": "qs",
                      "name": "start",
                      "value": "={{ $pageCount * 50 }}"
                    }
                  ]
                },
                "paginationCompleteWhen": "other",
                "statusCodesWhenComplete": "",
                "completeExpression": "={{ !Array.isArray($response.body?.objects) || $response.body.objects.length < 50 }}",
                "limitPagesFetched": true,
                "maxRequests": 20,
                "requestInterval": 500
              }
            }
          }
        },
        "type": "n8n-nodes-base.httpRequest",
        "typeVersion": 4.4,
        "position": [
          640,
          -16
        ],
        "id": "0ae8ecca-992e-475c-a37e-d8a21246c239",
        "name": "Dropi Consultar Pedidos"
      },
      {
        "parameters": {
          "url": "https://nauqpgsspwfqkxidenkx.supabase.co/rest/v1/orders?select=id,id_orden_shopify,id_orden_dropi,estado_dropi,tarea_generada_para_estado,status_history(registrado_en)&activo=eq.true&status_history.order=registrado_en.desc&status_history.limit=1",
          "sendHeaders": true,
          "headerParameters": {
            "parameters": [
              {
                "name": "apikey",
                "value": "[REDACTED_SECRET]"
              },
              {
                "name": "Authorization",
                "value": "[REDACTED_SECRET]"
              }
            ]
          },
          "options": {}
        },
        "type": "n8n-nodes-base.httpRequest",
        "typeVersion": 4.4,
        "position": [
          848,
          -16
        ],
        "id": "a161ec97-3278-4203-8171-0aab98262e83",
        "name": "Traer ordenes activas Supabase",
        "alwaysOutputData": true,
        "executeOnce": true
      },
      {
        "parameters": {
          "jsCode": "const dropiOrders = [];\n\nfunction getDropiObjects(payload) {\n  if (Array.isArray(payload?.objects)) return payload.objects;\n  if (Array.isArray(payload?.data?.objects)) return payload.data.objects;\n  if (Array.isArray(payload?.body?.objects)) return payload.body.objects;\n  return [];\n}\n\nfor (const item of $('Dropi Consultar Pedidos').all()) {\n  dropiOrders.push(...getDropiObjects(item.json));\n}\n\nconst supabaseOrders = $('Traer ordenes activas Supabase').all();\n\nconst estadosCerrados = ['ENTREGADO', 'CANCELADO', 'DEVOLUCION'];\n\nconst estadosNovedad = [\n  'DESTINATARIO SE REHUSA A RECIBIR',\n  'Se visita, no se logra entrega',\n  'No contesta Cliente',\n  'PARA NUEVO INTENTO ENTREGA',\n  'EN CONFIRMACIÓN TELEFÓNICA',\n  'NOVEDAD',\n  'CERRADO POR INCIDENCIA, VER CAUSA',\n  'RECLAME EN OFICINA'\n];\n\nconst generaTarea = (estadoNuevo, novedad) => {\n  if (estadoNuevo === 'GUIA_GENERADA') return 'notificar_guia';\n  if (estadoNuevo === 'PENDIENTE CONFIRMACION') return 'llamar_confirmacion';\n  if (estadosNovedad.includes(estadoNuevo)) return 'presionar_entrega';\n  if (novedad && estadosNovedad.some(e => novedad.toLowerCase().includes(e.toLowerCase()))) return 'presionar_entrega';\n  return null;\n};\n\nfunction normalizeId(value) {\n  return value === null || value === undefined || value === '' ? null : String(value);\n}\n\nfunction getLatestKnownRegisteredAt(supabaseOrder) {\n  const history = supabaseOrder.status_history;\n\n  if (Array.isArray(history) && history.length > 0) {\n    return history[0]?.registrado_en ?? null;\n  }\n\n  if (history && typeof history === 'object') {\n    return history.registrado_en ?? null;\n  }\n\n  return null;\n}\n\nfunction getHistoryEstado(historyEntry) {\n  return historyEntry?.status ?? historyEntry?.estado ?? null;\n}\n\nfunction getHistoryRegisteredAt(historyEntry) {\n  return historyEntry?.created_at ?? historyEntry?.registrado_en ?? historyEntry?.updated_at ?? null;\n}\n\nfunction getHistoryNovedad(historyEntry, fallbackNovedad) {\n  return (\n    historyEntry?.novedad ??\n    historyEntry?.observacion ??\n    historyEntry?.observation ??\n    historyEntry?.description ??\n    historyEntry?.notes ??\n    fallbackNovedad ??\n    null\n  );\n}\n\nfunction isStrictlyAfterKnownRegisteredAt(registradoEn, latestKnownRegisteredAt) {\n  if (!latestKnownRegisteredAt) return true;\n  if (!registradoEn) return false;\n\n  const registeredTime = Date.parse(registradoEn);\n  const latestKnownTime = Date.parse(latestKnownRegisteredAt);\n\n  if (Number.isFinite(registeredTime) && Number.isFinite(latestKnownTime)) {\n    return registeredTime > latestKnownTime;\n  }\n\n  return String(registradoEn) > String(latestKnownRegisteredAt);\n}\n\nfunction getMissingHistoryEntries(history, latestKnownRegisteredAt, fallbackTransportadora, fallbackNovedad) {\n  if (!Array.isArray(history)) return [];\n\n  return history\n    .map((historyEntry) => {\n      const estado = getHistoryEstado(historyEntry);\n      const registradoEn = getHistoryRegisteredAt(historyEntry);\n\n      if (!estado || !registradoEn) {\n        return null;\n      }\n\n      return {\n        estado,\n        transportadora:\n          historyEntry?.transportadora ??\n          historyEntry?.distribution_company?.name ??\n          fallbackTransportadora ??\n          null,\n        novedad: getHistoryNovedad(historyEntry, fallbackNovedad),\n        registrado_en: registradoEn,\n      };\n    })\n    .filter(Boolean)\n    .filter((historyEntry) =>\n      isStrictlyAfterKnownRegisteredAt(historyEntry.registrado_en, latestKnownRegisteredAt),\n    );\n}\n\nconst results = [];\n\nfor (const dropi of dropiOrders) {\n  const dropiShopOrderId = normalizeId(dropi.shop_order_id);\n  const dropiId = normalizeId(dropi.id);\n  const supabase = supabaseOrders.find((s) =>\n    (dropiShopOrderId && normalizeId(s.json.id_orden_shopify) === dropiShopOrderId) ||\n    (dropiId && normalizeId(s.json.id_orden_dropi) === dropiId)\n  );\n\n  if (!supabase) continue;\n\n  const estadoAnterior = supabase.json.estado_dropi;\n  const estadoNuevo = dropi.status;\n  const yaProcesado = supabase.json.tarea_generada_para_estado === estadoNuevo;\n  const cerrar = estadosCerrados.includes(estadoNuevo);\n  const history = Array.isArray(dropi.history) ? dropi.history : [];\n  const historyMatch = [...history].reverse().find((h) => getHistoryEstado(h) === estadoNuevo);\n  const registradoEn = historyMatch ? getHistoryRegisteredAt(historyMatch) : dropi.updated_at;\n  const novedad = dropi.novedad_servientrega || null;\n  const transportadora = dropi.distribution_company?.name || null;\n  const latestKnownStatusRegisteredAt = getLatestKnownRegisteredAt(supabase.json);\n  const historiaFaltante = getMissingHistoryEntries(\n    history,\n    latestKnownStatusRegisteredAt,\n    transportadora,\n    novedad,\n  );\n  const debeActualizarEstado = !(estadoAnterior === estadoNuevo && yaProcesado);\n\n  if (!debeActualizarEstado && historiaFaltante.length === 0) continue;\n\n  const accion = generaTarea(estadoNuevo, novedad);\n\n  const totalPedidos = dropi.client_total_orders || 0;\n  const devoluciones = dropi.client_total_orders_returneds || 0;\n  let nivelRiesgo = 'sin_datos';\n  if (totalPedidos > 0) {\n    const tasa = devoluciones / totalPedidos;\n    if (tasa >= 0.5) nivelRiesgo = 'alto';\n    else if (tasa >= 0.25) nivelRiesgo = 'medio';\n    else nivelRiesgo = 'bajo';\n  }\n\n  let estadoCrm;\n  if (cerrar) {\n    if (estadoNuevo === 'ENTREGADO') estadoCrm = 'entregado';\n    else if (estadoNuevo.includes('DEVOLUCION')) estadoCrm = 'devolucion';\n    else estadoCrm = 'cancelado';\n  } else if (estadoNuevo === 'PENDIENTE CONFIRMACION') {\n    estadoCrm = 'nuevo';\n  } else {\n    estadoCrm = 'en_ruta';\n  }\n\n  const orderDetail = (dropi.orderdetails || [])[0] || {};\n  const costoProducto = parseFloat(orderDetail.supplier_price || 0);\n  const costoEnvio = parseFloat(dropi.shipping_amount || 0);\n\n  results.push({\n    json: {\n      supabase_id: supabase.json.id,\n      dropi_id: dropi.id,\n      numero_orden: supabase.json.numero_orden,\n      estado_anterior: estadoAnterior,\n      estado_nuevo: estadoNuevo,\n      estado_crm: estadoCrm,\n      registrado_en: registradoEn,\n      novedad,\n      cerrar,\n      accion,\n      nombre: dropi.name,\n      telefono: String(dropi.phone),\n      guia: dropi.shipping_guide,\n      transportadora,\n      nivel_riesgo: nivelRiesgo,\n      total_pedidos_cliente: dropi.client_total_orders,\n      pedidos_entregados_cliente: dropi.client_total_orders_delivered,\n      pedidos_devueltos_cliente: devoluciones,\n      costo_producto: costoProducto,\n      costo_envio: costoEnvio,\n      comision_cod: 0,\n      latest_status_history_registrado_en: latestKnownStatusRegisteredAt,\n      historiaFaltante,\n      debe_actualizar_estado: debeActualizarEstado\n    }\n  });\n}\n\nreturn results.length > 0 ? results : [];\n"
        },
        "type": "n8n-nodes-base.code",
        "typeVersion": 2,
        "position": [
          1056,
          -16
        ],
        "id": "7e93ed4e-ab93-4b3f-8dbf-b2c779edbbbf",
        "name": "Comparar y filtrar cambios"
      },
      {
        "parameters": {
          "method": "PATCH",
          "url": "=https://nauqpgsspwfqkxidenkx.supabase.co/rest/v1/orders?id=eq.{{ $json.supabase_id }}",
          "sendHeaders": true,
          "headerParameters": {
            "parameters": [
              {
                "name": "apikey",
                "value": "[REDACTED_SECRET]"
              },
              {
                "name": "Authorization",
                "value": "[REDACTED_SECRET]"
              },
              {
                "name": "Content-Type",
                "value": "application/json"
              },
              {
                "name": "Prefer",
                "value": "return=representation"
              }
            ]
          },
          "sendBody": true,
          "specifyBody": "json",
          "jsonBody": "={{ JSON.stringify({ id_orden_dropi: $json.dropi_id, estado_dropi: $json.estado_nuevo, estado_crm: $json.estado_crm, guia_envio: $json.guia, transportadora: $json.transportadora, nivel_riesgo: $json.nivel_riesgo, total_pedidos_cliente: $json.total_pedidos_cliente ?? 0, pedidos_entregados_cliente: $json.pedidos_entregados_cliente ?? 0, pedidos_devueltos_cliente: $json.pedidos_devueltos_cliente ?? 0, activo: $json.cerrar ? false : true, costo_producto: $json.costo_producto ?? 0, costo_envio: $json.costo_envio ?? 0, comision_cod: $json.comision_cod ?? 0, fecha_entrega_real: $json.estado_nuevo === \"ENTREGADO\" ? $json.registrado_en : null }) }}",
          "options": {}
        },
        "type": "n8n-nodes-base.httpRequest",
        "typeVersion": 4.4,
        "position": [
          1264,
          -16
        ],
        "id": "8e9214f7-9f33-4118-89e3-b7a4ccd43479",
        "name": "Actualizar orden Supabase"
      },
      {
        "parameters": {
          "method": "POST",
          "url": "https://nauqpgsspwfqkxidenkx.supabase.co/rest/v1/status_history?on_conflict=order_id,estado,registrado_en",
          "sendHeaders": true,
          "headerParameters": {
            "parameters": [
              {
                "name": "apikey",
                "value": "[REDACTED_SECRET]"
              },
              {
                "name": "Authorization",
                "value": "[REDACTED_SECRET]"
              },
              {
                "name": "Content-Type",
                "value": "application/json"
              },
              {
                "name": "Prefer",
                "value": "resolution=ignore-duplicates"
              }
            ]
          },
          "sendBody": true,
          "specifyBody": "json",
          "jsonBody": "={{ JSON.stringify({ order_id: $('Comparar y filtrar cambios').item.json.supabase_id, estado: $('Comparar y filtrar cambios').item.json.estado_nuevo, transportadora: $('Comparar y filtrar cambios').item.json.transportadora, registrado_en: $('Comparar y filtrar cambios').item.json.registrado_en, novedad: $('Comparar y filtrar cambios').item.json.novedad }) }}",
          "options": {}
        },
        "type": "n8n-nodes-base.httpRequest",
        "typeVersion": 4.4,
        "position": [
          1472,
          -16
        ],
        "id": "4908e908-f60e-4d0d-b09a-bbc77d945408",
        "name": "Registrar historial"
      },
      {
        "parameters": {
          "rule": {
            "interval": [
              {
                "field": "cronExpression",
                "expression": "30 21 * * *"
              }
            ]
          }
        },
        "type": "n8n-nodes-base.scheduleTrigger",
        "typeVersion": 1.3,
        "position": [
          -1232,
          160
        ],
        "id": "a218a0c9-8d7e-4bcc-a8c6-e26bf20c9d0e",
        "name": "Schedule Trigger1"
      },
      {
        "parameters": {
          "url": "=https://api.dropi.co/api/historywallet?orderBy=id&orderDirection=desc&result_number=200&start=0&textToSearch=&type=null&id=null&identification_code=null&user_id=824352&from={{ DateTime.now().minus({days:180}).toFormat('yyyy-MM-dd') }}&until={{ DateTime.now().toFormat('yyyy-MM-dd') }}&wallet_id=0",
          "sendHeaders": true,
          "headerParameters": {
            "parameters": [
              {
                "name": "accept",
                "value": "application/json, text/plain, */*"
              },
              {
                "name": "accept-language",
                "value": "es-419,es;q=0.8"
              },
              {
                "name": "origin",
                "value": "https://app.dropi.co"
              },
              {
                "name": "referer",
                "value": "https://app.dropi.co/"
              },
              {
                "name": "sec-ch-ua",
                "value": "\"Chromium\";v=\"148\", \"Brave\";v=\"148\", \"Not/A)Brand\";v=\"99\""
              },
              {
                "name": "sec-ch-ua-mobile",
                "value": "?0"
              },
              {
                "name": "sec-ch-ua-platform",
                "value": "\"Linux\""
              },
              {
                "name": "sec-fetch-dest",
                "value": "empty"
              },
              {
                "name": "sec-fetch-mode",
                "value": "cors"
              },
              {
                "name": "sec-fetch-site",
                "value": "same-site"
              },
              {
                "name": "user-agent",
                "value": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36"
              },
              {
                "name": "x-authorization",
                "value": "=Bearer {{ $('Dropi Login Final').item.json.token }}"
              },
              {
                "name": "x-captcha-token"
              }
            ]
          },
          "options": {}
        },
        "type": "n8n-nodes-base.httpRequest",
        "typeVersion": 4.4,
        "position": [
          640,
          256
        ],
        "id": "5d9f8871-07ff-47b1-9280-f3a434aeca4f",
        "name": "Dropi Consultar Wallet",
        "alwaysOutputData": false
      },
      {
        "parameters": {
          "jsCode": "const response = $('Dropi Consultar Wallet').item.json;\nconst movements = response.objects || [];\n\nconst results = [];\n\nfor (const m of movements) {\n  const desc = m.description || '';\n  if (!m.order_id) continue;\n\n  if (desc.startsWith('ENTRADA POR GANANCIA EN LA ORDEN COMO DROPSHIPPER')) {\n    results.push({\n      json: {\n        tipo: 'liquidacion',\n        dropi_id: m.order_id,\n        amount: parseFloat(m.amount || 0),\n        fecha: m.created_at\n      }\n    });\n  } else if (desc.startsWith('SALIDA POR COBRO DE FLETE INICIAL')) {\n    results.push({\n      json: {\n        tipo: 'devolucion',\n        dropi_id: m.order_id,\n        amount: parseFloat(m.amount || 0),\n        fecha: m.created_at\n      }\n    });\n  }\n}\n\nreturn results.length > 0 ? results : [];"
        },
        "type": "n8n-nodes-base.code",
        "typeVersion": 2,
        "position": [
          848,
          256
        ],
        "id": "3c1a7111-9863-4af3-affc-40ab3a6f6f09",
        "name": "Procesar movimientos wallet",
        "alwaysOutputData": true
      },
      {
        "parameters": {
          "conditions": {
            "options": {
              "caseSensitive": true,
              "leftValue": "",
              "typeValidation": "strict",
              "version": 3
            },
            "conditions": [
              {
                "id": "eec829ca-bd19-4987-82ec-468d571a3628",
                "leftValue": "={{ $json.tipo }}",
                "rightValue": "liquidacion",
                "operator": {
                  "type": "string",
                  "operation": "equals",
                  "name": "filter.operator.equals"
                }
              }
            ],
            "combinator": "and"
          },
          "options": {}
        },
        "type": "n8n-nodes-base.if",
        "typeVersion": 2.3,
        "position": [
          1056,
          256
        ],
        "id": "32bbf42b-c05a-4645-b5d8-a421cfd56054",
        "name": "Es liquidacion?"
      },
      {
        "parameters": {
          "method": "PATCH",
          "url": "=https://nauqpgsspwfqkxidenkx.supabase.co/rest/v1/orders?id_orden_dropi=eq.{{ $json.dropi_id }}",
          "sendHeaders": true,
          "headerParameters": {
            "parameters": [
              {
                "name": "apikey",
                "value": "[REDACTED_SECRET]"
              },
              {
                "name": "Authorization",
                "value": "[REDACTED_SECRET]"
              },
              {
                "name": "Content-Type",
                "value": "application/json"
              },
              {
                "name": "Prefer",
                "value": "return=representation"
              }
            ]
          },
          "sendBody": true,
          "specifyBody": "json",
          "jsonBody": "={\n  \"valor_liquidado\": {{ $json.amount }},\n  \"fecha_liquidacion\": \"{{ $json.fecha }}\",\n  \"estado_liquidacion\": \"liquidado\"\n}",
          "options": {}
        },
        "type": "n8n-nodes-base.httpRequest",
        "typeVersion": 4.4,
        "position": [
          1312,
          224
        ],
        "id": "fc24c214-f5f3-4c55-80e0-d03e0bbfaedf",
        "name": "Actualizar liquidacion"
      },
      {
        "parameters": {
          "method": "PATCH",
          "url": "=https://nauqpgsspwfqkxidenkx.supabase.co/rest/v1/orders?id_orden_dropi=eq.{{ $json.dropi_id }}",
          "sendHeaders": true,
          "headerParameters": {
            "parameters": [
              {
                "name": "apikey",
                "value": "[REDACTED_SECRET]"
              },
              {
                "name": "Authorization",
                "value": "[REDACTED_SECRET]"
              },
              {
                "name": "Content-Type",
                "value": "application/json"
              },
              {
                "name": "Prefer",
                "value": "return=representation"
              }
            ]
          },
          "sendBody": true,
          "specifyBody": "json",
          "jsonBody": "={\n  \"costo_devolucion\": {{ $json.amount }}\n}",
          "options": {}
        },
        "type": "n8n-nodes-base.httpRequest",
        "typeVersion": 4.4,
        "position": [
          1312,
          368
        ],
        "id": "11b4f3dc-8221-4deb-8675-718431bebcf7",
        "name": "Actualizar devolucion"
      },
      {
        "parameters": {
          "method": "POST",
          "url": "https://crm.pakora.online/api/webhooks/orders/status-changed",
          "sendHeaders": true,
          "headerParameters": {
            "parameters": [
              {
                "name": "x-webhook-secret",
                "value": "[REDACTED_SECRET]"
              },
              {
                "name": "Content-Type",
                "value": "application/json"
              }
            ]
          },
          "sendBody": true,
          "specifyBody": "json",
          "jsonBody": "={\n  \"order_id\": {{ $('Comparar y filtrar cambios').item.json.supabase_id }}\n}",
          "options": {}
        },
        "id": "326d5072-3fdb-479d-b4b1-63f77457cfac",
        "name": "Notificar backend CRM",
        "type": "n8n-nodes-base.httpRequest",
        "typeVersion": 4.4,
        "position": [
          1696,
          144
        ],
        "retryOnFail": true,
        "maxTries": 3,
        "waitBetweenTries": 2000
      },
      {
        "parameters": {
          "jsCode": "const pais = \"CO\";\nconst rows = [];\n\nfunction getObjects(payload) {\n  if (Array.isArray(payload?.objects)) return payload.objects;\n  if (Array.isArray(payload?.data?.objects)) return payload.data.objects;\n  if (Array.isArray(payload?.body?.objects)) return payload.body.objects;\n  return [];\n}\n\nfunction toAmount(value, fallback) {\n  const parsed = parseFloat(value || fallback);\n  return Number.isFinite(parsed) ? parsed : fallback;\n}\n\nfor (const item of $input.all()) {\n  const objects = getObjects(item.json);\n\n  for (const m of objects) {\n    if (!m || m.order_id === null || m.order_id === undefined || m.order_id === \"\") {\n      continue;\n    }\n\n    rows.push({\n      id_movimiento_dropi: m.id,\n      wallet_id: m.wallet_id ?? null,\n      id_orden_dropi: m.order_id,\n      identification_code: m.identification_code != null ? String(m.identification_code) : null,\n      tipo: m.type ?? null,\n      amount: toAmount(m.amount, 0),\n      previous_amount: m.previous_amount != null ? toAmount(m.previous_amount, null) : null,\n      description: m.description ?? null,\n      guia_envio: m.shipping_guide ?? m.guide ?? null,\n      registrado_en: m.created_at,\n      pais,\n    });\n  }\n}\n\nreturn rows.length > 0 ? [{ json: { wallet_movements: rows } }] : [];\n"
        },
        "id": "cd71f133-6e4d-496b-91e3-3e1254067e4b",
        "name": "Mapear movimientos wallet completo",
        "type": "n8n-nodes-base.code",
        "typeVersion": 2,
        "position": [
          1072,
          416
        ]
      },
      {
        "parameters": {
          "method": "POST",
          "url": "https://nauqpgsspwfqkxidenkx.supabase.co/rest/v1/wallet_movements?on_conflict=pais,id_movimiento_dropi",
          "sendHeaders": true,
          "headerParameters": {
            "parameters": [
              {
                "name": "apikey",
                "value": "[REDACTED_SECRET]"
              },
              {
                "name": "Authorization",
                "value": "[REDACTED_SECRET]"
              },
              {
                "name": "Content-Type",
                "value": "application/json"
              },
              {
                "name": "Prefer",
                "value": "resolution=ignore-duplicates,return=minimal"
              }
            ]
          },
          "sendBody": true,
          "specifyBody": "json",
          "jsonBody": "={{ $json.wallet_movements }}",
          "options": {}
        },
        "id": "5825b19f-3a40-4ea8-81ae-de70ff60ecc5",
        "name": "Insertar movimientos wallet",
        "type": "n8n-nodes-base.httpRequest",
        "typeVersion": 4.4,
        "position": [
          1488,
          560
        ],
        "retryOnFail": true,
        "maxTries": 3,
        "waitBetweenTries": 2000
      },
      {
        "parameters": {
          "method": "GET",
          "url": "https://crm.pakora.online/api/cron/check-stale-orders",
          "sendHeaders": true,
          "headerParameters": {
            "parameters": [
              {
                "name": "Authorization",
                "value": "[REDACTED_SECRET]"
              }
            ]
          },
          "options": {}
        },
        "id": "f08ffb89-9253-4601-96e1-99b6b1c4f9eb",
        "name": "Chequear pedidos estancados",
        "type": "n8n-nodes-base.httpRequest",
        "typeVersion": 4.4,
        "position": [
          852,
          134
        ]
      },
      {
        "parameters": {
          "jsCode": "return $input.all().filter((item) =>\n  Array.isArray(item.json.historiaFaltante) && item.json.historiaFaltante.length > 0,\n);\n"
        },
        "id": "ca174379-127a-49f7-a6d4-0815e6796c85",
        "name": "Filtrar historial faltante",
        "type": "n8n-nodes-base.code",
        "typeVersion": 2,
        "position": [
          1476,
          134
        ]
      },
      {
        "parameters": {
          "method": "POST",
          "url": "https://crm.pakora.online/api/webhooks/orders/process-history",
          "sendHeaders": true,
          "headerParameters": {
            "parameters": [
              {
                "name": "x-webhook-secret",
                "value": "[REDACTED_SECRET]"
              },
              {
                "name": "Content-Type",
                "value": "application/json"
              }
            ]
          },
          "sendBody": true,
          "specifyBody": "json",
          "jsonBody": "={{ JSON.stringify({ order_id: $json.supabase_id, history: ($json.historiaFaltante || []).map((entry) => ({ estado: entry.estado, transportadora: entry.transportadora ?? null, novedad: entry.novedad ?? null, registrado_en: entry.registrado_en })) }) }}",
          "options": {}
        },
        "id": "0b55e12e-b801-4e5c-a7ca-42b97b9bb50d",
        "name": "Procesar historial completo",
        "type": "n8n-nodes-base.httpRequest",
        "typeVersion": 4.4,
        "position": [
          1896,
          284
        ],
        "retryOnFail": true,
        "maxTries": 3,
        "waitBetweenTries": 2000
      }
    ],
    "connections": {
      "Schedule Trigger": {
        "main": [
          [
            {
              "node": "Calcular delay",
              "type": "main",
              "index": 0
            }
          ]
        ]
      },
      "Calcular delay": {
        "main": [
          [
            {
              "node": "Esperar delay aleatorio",
              "type": "main",
              "index": 0
            }
          ]
        ]
      },
      "Esperar delay aleatorio": {
        "main": [
          [
            {
              "node": "Obtener IP",
              "type": "main",
              "index": 0
            }
          ]
        ]
      },
      "Obtener IP": {
        "main": [
          [
            {
              "node": "Dropi Login Paso 1",
              "type": "main",
              "index": 0
            }
          ]
        ]
      },
      "Dropi Login Paso 1": {
        "main": [
          [
            {
              "node": "Dropi Login Paso 2",
              "type": "main",
              "index": 0
            }
          ]
        ]
      },
      "Dropi Login Paso 2": {
        "main": [
          [
            {
              "node": "Generar TOTP",
              "type": "main",
              "index": 0
            }
          ]
        ]
      },
      "Generar TOTP": {
        "main": [
          [
            {
              "node": "Dropi 2FA Verify",
              "type": "main",
              "index": 0
            }
          ]
        ]
      },
      "Dropi 2FA Verify": {
        "main": [
          [
            {
              "node": "Dropi Before Login 2",
              "type": "main",
              "index": 0
            }
          ]
        ]
      },
      "Dropi Before Login 2": {
        "main": [
          [
            {
              "node": "Dropi Login Final",
              "type": "main",
              "index": 0
            }
          ]
        ]
      },
      "Dropi Login Final": {
        "main": [
          [
            {
              "node": "Dropi Consultar Pedidos",
              "type": "main",
              "index": 0
            },
            {
              "node": "Dropi Consultar Wallet",
              "type": "main",
              "index": 0
            },
            {
              "node": "Chequear pedidos estancados",
              "type": "main",
              "index": 0
            }
          ]
        ]
      },
      "Dropi Consultar Pedidos": {
        "main": [
          [
            {
              "node": "Traer ordenes activas Supabase",
              "type": "main",
              "index": 0
            }
          ]
        ]
      },
      "Traer ordenes activas Supabase": {
        "main": [
          [
            {
              "node": "Comparar y filtrar cambios",
              "type": "main",
              "index": 0
            }
          ]
        ]
      },
      "Comparar y filtrar cambios": {
        "main": [
          [
            {
              "node": "Actualizar orden Supabase",
              "type": "main",
              "index": 0
            },
            {
              "node": "Filtrar historial faltante",
              "type": "main",
              "index": 0
            }
          ]
        ]
      },
      "Actualizar orden Supabase": {
        "main": [
          [
            {
              "node": "Registrar historial",
              "type": "main",
              "index": 0
            },
            {
              "node": "Notificar backend CRM",
              "type": "main",
              "index": 0
            }
          ]
        ]
      },
      "Registrar historial": {
        "main": [
          []
        ]
      },
      "Schedule Trigger1": {
        "main": [
          [
            {
              "node": "Calcular delay",
              "type": "main",
              "index": 0
            }
          ]
        ]
      },
      "Dropi Consultar Wallet": {
        "main": [
          [
            {
              "node": "Procesar movimientos wallet",
              "type": "main",
              "index": 0
            },
            {
              "node": "Mapear movimientos wallet completo",
              "type": "main",
              "index": 0
            }
          ]
        ]
      },
      "Procesar movimientos wallet": {
        "main": [
          [
            {
              "node": "Es liquidacion?",
              "type": "main",
              "index": 0
            }
          ]
        ]
      },
      "Es liquidacion?": {
        "main": [
          [
            {
              "node": "Actualizar liquidacion",
              "type": "main",
              "index": 0
            }
          ],
          [
            {
              "node": "Actualizar devolucion",
              "type": "main",
              "index": 0
            }
          ]
        ]
      },
      "Mapear movimientos wallet completo": {
        "main": [
          [
            {
              "node": "Insertar movimientos wallet",
              "type": "main",
              "index": 0
            }
          ]
        ]
      },
      "Filtrar historial faltante": {
        "main": [
          [
            {
              "node": "Procesar historial completo",
              "type": "main",
              "index": 0
            }
          ]
        ]
      }
    },
    "nodeGroups": [],
    "authors": "Alejandro Torres",
    "name": null,
    "description": null,
    "autosaved": false,
    "workflowPublishHistory": [
      {
        "createdAt": "2026-07-06T22:44:48.469Z",
        "id": 146,
        "workflowId": "9p1gvbDxdYqugkMT",
        "versionId": "e7048916-e082-493e-9731-2b2b3f4d567b",
        "event": "activated",
        "userId": "55f82161-b55f-4333-8015-8bc98163d495"
      },
      {
        "createdAt": "2026-07-06T22:44:48.456Z",
        "id": 145,
        "workflowId": "9p1gvbDxdYqugkMT",
        "versionId": "e7048916-e082-493e-9731-2b2b3f4d567b",
        "event": "deactivated",
        "userId": "55f82161-b55f-4333-8015-8bc98163d495"
      }
    ]
  }
}
```
