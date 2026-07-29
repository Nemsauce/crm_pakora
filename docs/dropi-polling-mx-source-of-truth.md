# Dropi Polling (MX) — live n8n source of truth

- Workflow API ID: `BQ7G5rSntIoszmJ3`
- Live name: `Dropi Polling MX`
- Captured read-only at: `2026-07-14T04:07:35.563Z`
- Workflow updated at: `2026-07-06T22:44:48.782Z`
- Active: `true`
- Version: `7cc1f137-73b5-428f-8694-e0902b5344cb` (counter `53`)
- Nodes: `26`
- Directed connections: `25`
- Trigger nodes: `2`
- Current editable graph equals the active-version graph: `true`

> This document was generated from `GET /api/v1/workflows/BQ7G5rSntIoszmJ3`. The CO workflow was also fetched with GET solely for structural comparison. No n8n mutation endpoint was called.

## Redaction policy

Only reusable secret values were replaced. URLs, email/account identifiers, user IDs, field names, expressions, logic, node IDs, positions, headers, and non-secret configuration remain unchanged.

- `[REDACTED_TOTP_SECRET]`: the Base32 TOTP seed hardcoded in the MX TOTP Code node.
- `[REDACTED_DROPI_PASSWORD]`: the hardcoded Dropi password repeated in login request bodies.
- `[REDACTED_JWT]` / `[REDACTED_SECRET]`: embedded Supabase/API, webhook, cron, or authorization values.

## Critical MX account, API, and TOTP findings

- Login email: `ecommerce.cop.1@gmail.com`. **Unexpectedly, this is the same as the CO workflow email** (`ecommerce.cop.1@gmail.com`).
- Dropi MX `user_id`: `139984` (CO uses `824352`).
- Dropi API base: `https://api.dropi.mx/api` (explicitly MX; CO uses `https://api.dropi.co/api`).
- Dropi app origin/referer use `https://app.dropi.mx`.
- The hardcoded MX password is the same value as CO's password; neither value is printed here.
- The MX TOTP seed is hardcoded directly in the Code node and is different from the CO seed. It is not read from an n8n credential or environment variable.
- TOTP algorithm comparison after redacting the seed: `identical to CO`. MX also calls `generateTOTP(secret, -1)`, using the previous 30-second time step.

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
  └─> Dropi Consultar Wallet
        ├─> Procesar movimientos wallet -> Es liquidacion?
        │     ├─ true (output 0)  -> Actualizar liquidacion
        │     └─ false (output 1) -> Actualizar devolucion
        └─> Mapear movimientos wallet completo -> Insertar movimientos wallet
```

Terminal nodes: `Registrar historial`, `Actualizar liquidacion`, `Actualizar devolucion`, `Notificar backend CRM`, `Insertar movimientos wallet`, `Procesar historial completo`.

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

### Flattened directed edge list

- `Schedule Trigger` output 0 -> `Calcular delay` input 0
- `Calcular delay` output 0 -> `Esperar delay aleatorio` input 0
- `Esperar delay aleatorio` output 0 -> `Obtener IP` input 0
- `Obtener IP` output 0 -> `Dropi Login Paso 1` input 0
- `Dropi Login Paso 1` output 0 -> `Dropi Login Paso 2` input 0
- `Dropi Login Paso 2` output 0 -> `Generar TOTP` input 0
- `Generar TOTP` output 0 -> `Dropi 2FA Verify` input 0
- `Dropi 2FA Verify` output 0 -> `Dropi Before Login 2` input 0
- `Dropi Before Login 2` output 0 -> `Dropi Login Final` input 0
- `Dropi Login Final` output 0 -> `Dropi Consultar Pedidos` input 0
- `Dropi Login Final` output 0 -> `Dropi Consultar Wallet` input 0
- `Dropi Consultar Pedidos` output 0 -> `Traer ordenes activas Supabase` input 0
- `Traer ordenes activas Supabase` output 0 -> `Comparar y filtrar cambios` input 0
- `Comparar y filtrar cambios` output 0 -> `Actualizar orden Supabase` input 0
- `Comparar y filtrar cambios` output 0 -> `Filtrar historial faltante` input 0
- `Actualizar orden Supabase` output 0 -> `Registrar historial` input 0
- `Actualizar orden Supabase` output 0 -> `Notificar backend CRM` input 0
- `Schedule Trigger1` output 0 -> `Calcular delay` input 0
- `Dropi Consultar Wallet` output 0 -> `Procesar movimientos wallet` input 0
- `Dropi Consultar Wallet` output 0 -> `Mapear movimientos wallet completo` input 0
- `Procesar movimientos wallet` output 0 -> `Es liquidacion?` input 0
- `Es liquidacion?` output 0 -> `Actualizar liquidacion` input 0
- `Es liquidacion?` output 1 -> `Actualizar devolucion` input 0
- `Mapear movimientos wallet completo` output 0 -> `Insertar movimientos wallet` input 0
- `Filtrar historial faltante` output 0 -> `Procesar historial completo` input 0

## Structural and parameter differences from CO

- MX has `26` nodes / `25` edges; CO has `27` nodes / `26` edges.
- CO-only nodes: `Chequear pedidos estancados`.
- MX-only nodes: none.
- MX has no `Chequear pedidos estancados` branch. Its final login fans out only to orders and wallet.
- `Dropi Consultar Pedidos`: MX uses `orderDirection=asc`; CO uses `desc`. CO includes an empty `textToSearch=` query parameter and MX omits it. Both retain the same 50-row pages, maximum 20 pages, 500 ms page interval, and rolling 30-day window.
- `Traer ordenes activas Supabase`: MX explicitly filters `pais=eq.MX`; the live CO workflow has no corresponding `pais=eq.CO` filter.
- `Dropi Consultar Wallet`: MX requests `result_number=100`; CO requests `200`. Both use the same 180-day window and neither paginates the wallet endpoint.
- Region-normalized shared-node parameter differences were limited to: `Dropi Consultar Pedidos`, `Traer ordenes activas Supabase`, `Dropi Consultar Wallet`. (`Esperar delay aleatorio` also has a distinct node webhook ID, which is outside `parameters`.)
- Apart from the regional values and differences listed above, the login chain, TOTP implementation, order comparison logic, wallet branches, field mappings, IF logic, retries, and connection structure are the same as CO.

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
| 25 | Filtrar historial faltante | `n8n-nodes-base.code` | 2 |
| 26 | Procesar historial completo | `n8n-nodes-base.httpRequest` | 4.4 |

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
  "id": "2a28ba61-2713-4856-814b-b18c1787c430",
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
  "id": "e8e8f846-9066-4ef2-91c6-d44774eb77a5",
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
  "id": "40e53892-1822-4f3a-91e1-857fc629ba12",
  "name": "Esperar delay aleatorio",
  "webhookId": "fb300406-865d-41f6-969d-244caff8b121"
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
  "id": "5aa99d3d-77d5-479d-a23a-fb56fc3bd658",
  "name": "Obtener IP"
}
```

### 5. Dropi Login Paso 1

```json
{
  "parameters": {
    "method": "POST",
    "url": "https://api.dropi.mx/api/beforeLoginUnknownDevice",
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
          "value": "https://app.dropi.mx"
        },
        {
          "name": "referer",
          "value": "https://app.dropi.mx/"
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
          "name": "x-captcha-token",
          "value": ""
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
  "id": "f8b5d0b0-c56a-4ba2-8938-ed3444f4e161",
  "name": "Dropi Login Paso 1"
}
```

### 6. Dropi Login Paso 2

```json
{
  "parameters": {
    "method": "POST",
    "url": "https://api.dropi.mx/api/login",
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
          "value": "https://app.dropi.mx"
        },
        {
          "name": "referer",
          "value": "https://app.dropi.mx/"
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
          "name": "x-captcha-token",
          "value": ""
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
  "id": "853fc5f1-336d-4b58-a698-5238173b1174",
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
  "id": "ffcc519c-af1b-4534-8cd8-614f33d27fca",
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
    "url": "https://api.dropi.mx/api/auth/2fa/verify",
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
          "value": "https://app.dropi.mx"
        },
        {
          "name": "referer",
          "value": "https://app.dropi.mx/"
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
          "name": "x-captcha-token",
          "value": ""
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
  "id": "46f7aacb-a85f-4907-8bc9-08e98b3aa24b",
  "name": "Dropi 2FA Verify"
}
```

### 9. Dropi Login Final

```json
{
  "parameters": {
    "method": "POST",
    "url": "https://api.dropi.mx/api/login",
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
          "value": "https://app.dropi.mx"
        },
        {
          "name": "referer",
          "value": "https://app.dropi.mx/"
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
          "name": "x-captcha-token",
          "value": ""
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
  "id": "f5bbafb2-87f0-44b8-bb0f-cf9101e3d024",
  "name": "Dropi Login Final"
}
```

### 10. Dropi Before Login 2

```json
{
  "parameters": {
    "method": "POST",
    "url": "https://api.dropi.mx/api/beforeLoginUnknownDevice",
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
          "value": "https://app.dropi.mx"
        },
        {
          "name": "referer",
          "value": "https://app.dropi.mx/"
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
          "name": "x-captcha-token",
          "value": ""
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
  "id": "d6a83324-8b12-4848-8549-e8815c387113",
  "name": "Dropi Before Login 2"
}
```

### 11. Dropi Consultar Pedidos

```json
{
  "parameters": {
    "url": "=https://api.dropi.mx/api/orders/myorders?exportAs=orderByRow&orderBy=id&orderDirection=asc&result_number=50&start=0&status=null&supplier_id=false&user_id=139984&from={{ new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0] }}&until={{ new Date().toISOString().split('T')[0] }}&filter_product=undefined&haveIncidenceProcesamiento=false&tag_id=&warranty=false&seller=null&filter_date_by=FECHA%20DE%20CREADO&invoiced=null",
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
          "value": "https://app.dropi.mx"
        },
        {
          "name": "referer",
          "value": "https://app.dropi.mx/"
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
          "name": "x-captcha-token",
          "value": ""
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
  "id": "99e595b6-da7d-45f9-848e-854cb0366f3b",
  "name": "Dropi Consultar Pedidos"
}
```

### 12. Traer ordenes activas Supabase

```json
{
  "parameters": {
    "url": "https://nauqpgsspwfqkxidenkx.supabase.co/rest/v1/orders?select=id,id_orden_shopify,id_orden_dropi,estado_dropi,tarea_generada_para_estado,status_history(registrado_en)&activo=eq.true&pais=eq.MX&status_history.order=registrado_en.desc&status_history.limit=1",
    "sendHeaders": true,
    "headerParameters": {
      "parameters": [
        {
          "name": "apikey",
          "value": "[REDACTED_SECRET]"
        },
        {
          "name": "Authorization",
          "value": "Bearer [REDACTED_SECRET]"
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
  "id": "894ee294-320b-4bd3-8449-46cef0cd9554",
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
  "id": "77b0cd0a-2556-474c-bed0-a2590c12d9ea",
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
          "value": "Bearer [REDACTED_SECRET]"
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
  "id": "96ca09a5-247e-4b51-9d9d-dcc561c27acb",
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
          "value": "Bearer [REDACTED_SECRET]"
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
  "id": "e1d58edc-7a86-4fb5-acd4-87c156b68fb0",
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
  "id": "b373ba65-1642-4e3e-830d-4a96a5c31769",
  "name": "Schedule Trigger1"
}
```

### 17. Dropi Consultar Wallet

```json
{
  "parameters": {
    "url": "=https://api.dropi.mx/api/historywallet?orderBy=id&orderDirection=desc&result_number=100&start=0&textToSearch=&type=null&id=null&identification_code=null&user_id=139984&from={{ DateTime.now().minus({days:180}).toFormat('yyyy-MM-dd') }}&until={{ DateTime.now().toFormat('yyyy-MM-dd') }}&wallet_id=0",
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
          "value": "https://app.dropi.mx"
        },
        {
          "name": "referer",
          "value": "https://app.dropi.mx/"
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
          "name": "x-captcha-token",
          "value": ""
        }
      ]
    },
    "options": {}
  },
  "type": "n8n-nodes-base.httpRequest",
  "typeVersion": 4.4,
  "position": [
    432,
    368
  ],
  "id": "c76daf48-249f-4d81-9350-3d9866dbea8c",
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
    640,
    368
  ],
  "id": "8c3b39da-78b9-494a-85f8-39d3c0db016c",
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
    848,
    368
  ],
  "id": "16035d76-8bcb-4067-8e05-7d67f16ad4ce",
  "name": "Es liquidacion?"
}
```

#### Complete conditional parameters

```json
{
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
          "value": "Bearer [REDACTED_SECRET]"
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
    1104,
    336
  ],
  "id": "d357f791-85da-4b7b-8c98-1eece4a8ddb3",
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
          "value": "Bearer [REDACTED_SECRET]"
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
    1104,
    480
  ],
  "id": "2122cdff-8234-4cd6-975e-adfdac958e85",
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
  "id": "3c07572f-1236-4669-b6b8-26664da15d88",
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
    "jsCode": "const pais = \"MX\";\nconst rows = [];\n\nfunction getObjects(payload) {\n  if (Array.isArray(payload?.objects)) return payload.objects;\n  if (Array.isArray(payload?.data?.objects)) return payload.data.objects;\n  if (Array.isArray(payload?.body?.objects)) return payload.body.objects;\n  return [];\n}\n\nfunction toAmount(value, fallback) {\n  const parsed = parseFloat(value || fallback);\n  return Number.isFinite(parsed) ? parsed : fallback;\n}\n\nfor (const item of $input.all()) {\n  const objects = getObjects(item.json);\n\n  for (const m of objects) {\n    if (!m || m.order_id === null || m.order_id === undefined || m.order_id === \"\") {\n      continue;\n    }\n\n    rows.push({\n      id_movimiento_dropi: m.id,\n      wallet_id: m.wallet_id ?? null,\n      id_orden_dropi: m.order_id,\n      identification_code: m.identification_code != null ? String(m.identification_code) : null,\n      tipo: m.type ?? null,\n      amount: toAmount(m.amount, 0),\n      previous_amount: m.previous_amount != null ? toAmount(m.previous_amount, null) : null,\n      description: m.description ?? null,\n      guia_envio: m.shipping_guide ?? m.guide ?? null,\n      registrado_en: m.created_at,\n      pais,\n    });\n  }\n}\n\nreturn rows.length > 0 ? [{ json: { wallet_movements: rows } }] : [];\n"
  },
  "id": "5bef78c9-fa22-40bd-90a5-dd74953e16e9",
  "name": "Mapear movimientos wallet completo",
  "type": "n8n-nodes-base.code",
  "typeVersion": 2,
  "position": [
    864,
    528
  ]
}
```

#### Verbatim `jsCode`

```js
const pais = "MX";
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
          "value": "Bearer [REDACTED_SECRET]"
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
  "id": "ef6d1571-33b6-44a8-a1a1-c2a42f051ff0",
  "name": "Insertar movimientos wallet",
  "type": "n8n-nodes-base.httpRequest",
  "typeVersion": 4.4,
  "position": [
    1280,
    672
  ],
  "retryOnFail": true,
  "maxTries": 3,
  "waitBetweenTries": 2000
}
```

### 25. Filtrar historial faltante

```json
{
  "parameters": {
    "jsCode": "return $input.all().filter((item) =>\n  Array.isArray(item.json.historiaFaltante) && item.json.historiaFaltante.length > 0,\n);\n"
  },
  "id": "86fda244-e604-421b-b61a-cdb7007e1e46",
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

### 26. Procesar historial completo

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
  "id": "2f4881cd-7f44-4c89-9621-c09c15f7949c",
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

## Porting risks, fragility, and unexpected behavior

1. **The supposed separate MX account does not use a separate email in this workflow.** MX logs in with the same email as CO, and the stored password values also match. The regional identity is nevertheless distinct at the API level (`api.dropi.mx`, `user_id=139984`) and has a different TOTP seed. Confirm this account arrangement with Dropi before rotating credentials or re-linking 2FA.
2. **TOTP and password are hardcoded.** The MX seed can be ported without re-linking 2FA, but both values must move into server-only secret storage. The deliberate `offset=-1` creates timing-boundary and clock-skew fragility.
3. **MX lacks stale-order checking.** Unlike CO, the workflow has no `Chequear pedidos estancados` branch, so MX does not receive that post-login behavior from this workflow.
4. **The intended random delay is not wired into the Wait node.** `Calcular delay` emits a random millisecond value, while `Esperar delay aleatorio` uses only `amount: "=1"` and does not reference it.
5. **Both schedules run the entire workflow.** They merge before login, so every trigger runs both order and wallet branches.
6. **Order ordering differs from CO.** MX paginates oldest-first (`asc`) within the 30-day window, whereas CO uses newest-first (`desc`). At the 20-page cap, that changes which orders are omitted if the window exceeds 1,000 rows.
7. **Wallet coverage is more limited than CO.** MX fetches at most 100 wallet rows over 180 days with no pagination; CO asks for 200. Additional movements are silently outside the workflow's view.
8. **A selected-field mismatch exists here too.** `Comparar y filtrar cambios` uses `supabase.json.numero_orden`, but `Traer ordenes activas Supabase` does not select `numero_orden`, so that value is normally undefined.
9. **Legacy wallet text classification remains active in parallel.** `Procesar movimientos wallet` classifies Spanish free text and patches financial fields, while the newer branch stores movements using `identification_code`; the paths can diverge.
10. **Business decisions remain embedded in n8n.** The comparison node contains closed-state lists, risk thresholds, task-state mapping, and history logic rather than delegating decisions to the TypeScript backend.
11. **Browser emulation is brittle.** Hardcoded user agent/client hints, empty captcha values, `Bearer undefined`, and exact header quirks can break if Dropi changes its private API checks.
12. **Post-login and post-update fan-outs are parallel.** There is no explicit ordering across wallet/order side effects or between history writes and backend notification.
13. **Cron timezone is implicit.** Workflow settings do not declare one, so the n8n instance/workflow default controls schedule interpretation.

## Complete redacted API response

This appendix preserves the entire object returned by n8n, including workflow metadata, current graph, sharing metadata, and the duplicated active-version snapshot. It is included so this file remains a self-contained source-of-truth capture.

```json
{
  "updatedAt": "2026-07-06T22:44:48.782Z",
  "createdAt": "2026-06-27T04:34:38.439Z",
  "id": "BQ7G5rSntIoszmJ3",
  "name": "Dropi Polling MX",
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
      "id": "2a28ba61-2713-4856-814b-b18c1787c430",
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
      "id": "e8e8f846-9066-4ef2-91c6-d44774eb77a5",
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
      "id": "40e53892-1822-4f3a-91e1-857fc629ba12",
      "name": "Esperar delay aleatorio",
      "webhookId": "fb300406-865d-41f6-969d-244caff8b121"
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
      "id": "5aa99d3d-77d5-479d-a23a-fb56fc3bd658",
      "name": "Obtener IP"
    },
    {
      "parameters": {
        "method": "POST",
        "url": "https://api.dropi.mx/api/beforeLoginUnknownDevice",
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
              "value": "https://app.dropi.mx"
            },
            {
              "name": "referer",
              "value": "https://app.dropi.mx/"
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
              "name": "x-captcha-token",
              "value": ""
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
      "id": "f8b5d0b0-c56a-4ba2-8938-ed3444f4e161",
      "name": "Dropi Login Paso 1"
    },
    {
      "parameters": {
        "method": "POST",
        "url": "https://api.dropi.mx/api/login",
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
              "value": "https://app.dropi.mx"
            },
            {
              "name": "referer",
              "value": "https://app.dropi.mx/"
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
              "name": "x-captcha-token",
              "value": ""
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
      "id": "853fc5f1-336d-4b58-a698-5238173b1174",
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
      "id": "ffcc519c-af1b-4534-8cd8-614f33d27fca",
      "name": "Generar TOTP"
    },
    {
      "parameters": {
        "method": "POST",
        "url": "https://api.dropi.mx/api/auth/2fa/verify",
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
              "value": "https://app.dropi.mx"
            },
            {
              "name": "referer",
              "value": "https://app.dropi.mx/"
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
              "name": "x-captcha-token",
              "value": ""
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
      "id": "46f7aacb-a85f-4907-8bc9-08e98b3aa24b",
      "name": "Dropi 2FA Verify"
    },
    {
      "parameters": {
        "method": "POST",
        "url": "https://api.dropi.mx/api/login",
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
              "value": "https://app.dropi.mx"
            },
            {
              "name": "referer",
              "value": "https://app.dropi.mx/"
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
              "name": "x-captcha-token",
              "value": ""
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
      "id": "f5bbafb2-87f0-44b8-bb0f-cf9101e3d024",
      "name": "Dropi Login Final"
    },
    {
      "parameters": {
        "method": "POST",
        "url": "https://api.dropi.mx/api/beforeLoginUnknownDevice",
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
              "value": "https://app.dropi.mx"
            },
            {
              "name": "referer",
              "value": "https://app.dropi.mx/"
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
              "name": "x-captcha-token",
              "value": ""
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
      "id": "d6a83324-8b12-4848-8549-e8815c387113",
      "name": "Dropi Before Login 2"
    },
    {
      "parameters": {
        "url": "=https://api.dropi.mx/api/orders/myorders?exportAs=orderByRow&orderBy=id&orderDirection=asc&result_number=50&start=0&status=null&supplier_id=false&user_id=139984&from={{ new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0] }}&until={{ new Date().toISOString().split('T')[0] }}&filter_product=undefined&haveIncidenceProcesamiento=false&tag_id=&warranty=false&seller=null&filter_date_by=FECHA%20DE%20CREADO&invoiced=null",
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
              "value": "https://app.dropi.mx"
            },
            {
              "name": "referer",
              "value": "https://app.dropi.mx/"
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
              "name": "x-captcha-token",
              "value": ""
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
      "id": "99e595b6-da7d-45f9-848e-854cb0366f3b",
      "name": "Dropi Consultar Pedidos"
    },
    {
      "parameters": {
        "url": "https://nauqpgsspwfqkxidenkx.supabase.co/rest/v1/orders?select=id,id_orden_shopify,id_orden_dropi,estado_dropi,tarea_generada_para_estado,status_history(registrado_en)&activo=eq.true&pais=eq.MX&status_history.order=registrado_en.desc&status_history.limit=1",
        "sendHeaders": true,
        "headerParameters": {
          "parameters": [
            {
              "name": "apikey",
              "value": "[REDACTED_SECRET]"
            },
            {
              "name": "Authorization",
              "value": "Bearer [REDACTED_SECRET]"
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
      "id": "894ee294-320b-4bd3-8449-46cef0cd9554",
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
      "id": "77b0cd0a-2556-474c-bed0-a2590c12d9ea",
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
              "value": "Bearer [REDACTED_SECRET]"
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
      "id": "96ca09a5-247e-4b51-9d9d-dcc561c27acb",
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
              "value": "Bearer [REDACTED_SECRET]"
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
      "id": "e1d58edc-7a86-4fb5-acd4-87c156b68fb0",
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
      "id": "b373ba65-1642-4e3e-830d-4a96a5c31769",
      "name": "Schedule Trigger1"
    },
    {
      "parameters": {
        "url": "=https://api.dropi.mx/api/historywallet?orderBy=id&orderDirection=desc&result_number=100&start=0&textToSearch=&type=null&id=null&identification_code=null&user_id=139984&from={{ DateTime.now().minus({days:180}).toFormat('yyyy-MM-dd') }}&until={{ DateTime.now().toFormat('yyyy-MM-dd') }}&wallet_id=0",
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
              "value": "https://app.dropi.mx"
            },
            {
              "name": "referer",
              "value": "https://app.dropi.mx/"
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
              "name": "x-captcha-token",
              "value": ""
            }
          ]
        },
        "options": {}
      },
      "type": "n8n-nodes-base.httpRequest",
      "typeVersion": 4.4,
      "position": [
        432,
        368
      ],
      "id": "c76daf48-249f-4d81-9350-3d9866dbea8c",
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
        640,
        368
      ],
      "id": "8c3b39da-78b9-494a-85f8-39d3c0db016c",
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
        848,
        368
      ],
      "id": "16035d76-8bcb-4067-8e05-7d67f16ad4ce",
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
              "value": "Bearer [REDACTED_SECRET]"
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
        1104,
        336
      ],
      "id": "d357f791-85da-4b7b-8c98-1eece4a8ddb3",
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
              "value": "Bearer [REDACTED_SECRET]"
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
        1104,
        480
      ],
      "id": "2122cdff-8234-4cd6-975e-adfdac958e85",
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
      "id": "3c07572f-1236-4669-b6b8-26664da15d88",
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
        "jsCode": "const pais = \"MX\";\nconst rows = [];\n\nfunction getObjects(payload) {\n  if (Array.isArray(payload?.objects)) return payload.objects;\n  if (Array.isArray(payload?.data?.objects)) return payload.data.objects;\n  if (Array.isArray(payload?.body?.objects)) return payload.body.objects;\n  return [];\n}\n\nfunction toAmount(value, fallback) {\n  const parsed = parseFloat(value || fallback);\n  return Number.isFinite(parsed) ? parsed : fallback;\n}\n\nfor (const item of $input.all()) {\n  const objects = getObjects(item.json);\n\n  for (const m of objects) {\n    if (!m || m.order_id === null || m.order_id === undefined || m.order_id === \"\") {\n      continue;\n    }\n\n    rows.push({\n      id_movimiento_dropi: m.id,\n      wallet_id: m.wallet_id ?? null,\n      id_orden_dropi: m.order_id,\n      identification_code: m.identification_code != null ? String(m.identification_code) : null,\n      tipo: m.type ?? null,\n      amount: toAmount(m.amount, 0),\n      previous_amount: m.previous_amount != null ? toAmount(m.previous_amount, null) : null,\n      description: m.description ?? null,\n      guia_envio: m.shipping_guide ?? m.guide ?? null,\n      registrado_en: m.created_at,\n      pais,\n    });\n  }\n}\n\nreturn rows.length > 0 ? [{ json: { wallet_movements: rows } }] : [];\n"
      },
      "id": "5bef78c9-fa22-40bd-90a5-dd74953e16e9",
      "name": "Mapear movimientos wallet completo",
      "type": "n8n-nodes-base.code",
      "typeVersion": 2,
      "position": [
        864,
        528
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
              "value": "Bearer [REDACTED_SECRET]"
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
      "id": "ef6d1571-33b6-44a8-a1a1-c2a42f051ff0",
      "name": "Insertar movimientos wallet",
      "type": "n8n-nodes-base.httpRequest",
      "typeVersion": 4.4,
      "position": [
        1280,
        672
      ],
      "retryOnFail": true,
      "maxTries": 3,
      "waitBetweenTries": 2000
    },
    {
      "parameters": {
        "jsCode": "return $input.all().filter((item) =>\n  Array.isArray(item.json.historiaFaltante) && item.json.historiaFaltante.length > 0,\n);\n"
      },
      "id": "86fda244-e604-421b-b61a-cdb7007e1e46",
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
      "id": "2f4881cd-7f44-4c89-9621-c09c15f7949c",
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
  "versionId": "7cc1f137-73b5-428f-8694-e0902b5344cb",
  "activeVersionId": "7cc1f137-73b5-428f-8694-e0902b5344cb",
  "versionCounter": 53,
  "triggerCount": 2,
  "sourceWorkflowId": null,
  "shared": [
    {
      "updatedAt": "2026-06-27T04:34:38.440Z",
      "createdAt": "2026-06-27T04:34:38.440Z",
      "role": "workflow:owner",
      "workflowId": "BQ7G5rSntIoszmJ3",
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
    "updatedAt": "2026-07-06T22:44:48.783Z",
    "createdAt": "2026-07-06T22:44:48.783Z",
    "versionId": "7cc1f137-73b5-428f-8694-e0902b5344cb",
    "workflowId": "BQ7G5rSntIoszmJ3",
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
        "id": "2a28ba61-2713-4856-814b-b18c1787c430",
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
        "id": "e8e8f846-9066-4ef2-91c6-d44774eb77a5",
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
        "id": "40e53892-1822-4f3a-91e1-857fc629ba12",
        "name": "Esperar delay aleatorio",
        "webhookId": "fb300406-865d-41f6-969d-244caff8b121"
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
        "id": "5aa99d3d-77d5-479d-a23a-fb56fc3bd658",
        "name": "Obtener IP"
      },
      {
        "parameters": {
          "method": "POST",
          "url": "https://api.dropi.mx/api/beforeLoginUnknownDevice",
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
                "value": "https://app.dropi.mx"
              },
              {
                "name": "referer",
                "value": "https://app.dropi.mx/"
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
                "name": "x-captcha-token",
                "value": ""
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
        "id": "f8b5d0b0-c56a-4ba2-8938-ed3444f4e161",
        "name": "Dropi Login Paso 1"
      },
      {
        "parameters": {
          "method": "POST",
          "url": "https://api.dropi.mx/api/login",
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
                "value": "https://app.dropi.mx"
              },
              {
                "name": "referer",
                "value": "https://app.dropi.mx/"
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
                "name": "x-captcha-token",
                "value": ""
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
        "id": "853fc5f1-336d-4b58-a698-5238173b1174",
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
        "id": "ffcc519c-af1b-4534-8cd8-614f33d27fca",
        "name": "Generar TOTP"
      },
      {
        "parameters": {
          "method": "POST",
          "url": "https://api.dropi.mx/api/auth/2fa/verify",
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
                "value": "https://app.dropi.mx"
              },
              {
                "name": "referer",
                "value": "https://app.dropi.mx/"
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
                "name": "x-captcha-token",
                "value": ""
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
        "id": "46f7aacb-a85f-4907-8bc9-08e98b3aa24b",
        "name": "Dropi 2FA Verify"
      },
      {
        "parameters": {
          "method": "POST",
          "url": "https://api.dropi.mx/api/login",
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
                "value": "https://app.dropi.mx"
              },
              {
                "name": "referer",
                "value": "https://app.dropi.mx/"
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
                "name": "x-captcha-token",
                "value": ""
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
        "id": "f5bbafb2-87f0-44b8-bb0f-cf9101e3d024",
        "name": "Dropi Login Final"
      },
      {
        "parameters": {
          "method": "POST",
          "url": "https://api.dropi.mx/api/beforeLoginUnknownDevice",
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
                "value": "https://app.dropi.mx"
              },
              {
                "name": "referer",
                "value": "https://app.dropi.mx/"
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
                "name": "x-captcha-token",
                "value": ""
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
        "id": "d6a83324-8b12-4848-8549-e8815c387113",
        "name": "Dropi Before Login 2"
      },
      {
        "parameters": {
          "url": "=https://api.dropi.mx/api/orders/myorders?exportAs=orderByRow&orderBy=id&orderDirection=asc&result_number=50&start=0&status=null&supplier_id=false&user_id=139984&from={{ new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0] }}&until={{ new Date().toISOString().split('T')[0] }}&filter_product=undefined&haveIncidenceProcesamiento=false&tag_id=&warranty=false&seller=null&filter_date_by=FECHA%20DE%20CREADO&invoiced=null",
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
                "value": "https://app.dropi.mx"
              },
              {
                "name": "referer",
                "value": "https://app.dropi.mx/"
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
                "name": "x-captcha-token",
                "value": ""
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
        "id": "99e595b6-da7d-45f9-848e-854cb0366f3b",
        "name": "Dropi Consultar Pedidos"
      },
      {
        "parameters": {
          "url": "https://nauqpgsspwfqkxidenkx.supabase.co/rest/v1/orders?select=id,id_orden_shopify,id_orden_dropi,estado_dropi,tarea_generada_para_estado,status_history(registrado_en)&activo=eq.true&pais=eq.MX&status_history.order=registrado_en.desc&status_history.limit=1",
          "sendHeaders": true,
          "headerParameters": {
            "parameters": [
              {
                "name": "apikey",
                "value": "[REDACTED_SECRET]"
              },
              {
                "name": "Authorization",
                "value": "Bearer [REDACTED_SECRET]"
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
        "id": "894ee294-320b-4bd3-8449-46cef0cd9554",
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
        "id": "77b0cd0a-2556-474c-bed0-a2590c12d9ea",
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
                "value": "Bearer [REDACTED_SECRET]"
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
        "id": "96ca09a5-247e-4b51-9d9d-dcc561c27acb",
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
                "value": "Bearer [REDACTED_SECRET]"
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
        "id": "e1d58edc-7a86-4fb5-acd4-87c156b68fb0",
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
        "id": "b373ba65-1642-4e3e-830d-4a96a5c31769",
        "name": "Schedule Trigger1"
      },
      {
        "parameters": {
          "url": "=https://api.dropi.mx/api/historywallet?orderBy=id&orderDirection=desc&result_number=100&start=0&textToSearch=&type=null&id=null&identification_code=null&user_id=139984&from={{ DateTime.now().minus({days:180}).toFormat('yyyy-MM-dd') }}&until={{ DateTime.now().toFormat('yyyy-MM-dd') }}&wallet_id=0",
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
                "value": "https://app.dropi.mx"
              },
              {
                "name": "referer",
                "value": "https://app.dropi.mx/"
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
                "name": "x-captcha-token",
                "value": ""
              }
            ]
          },
          "options": {}
        },
        "type": "n8n-nodes-base.httpRequest",
        "typeVersion": 4.4,
        "position": [
          432,
          368
        ],
        "id": "c76daf48-249f-4d81-9350-3d9866dbea8c",
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
          640,
          368
        ],
        "id": "8c3b39da-78b9-494a-85f8-39d3c0db016c",
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
          848,
          368
        ],
        "id": "16035d76-8bcb-4067-8e05-7d67f16ad4ce",
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
                "value": "Bearer [REDACTED_SECRET]"
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
          1104,
          336
        ],
        "id": "d357f791-85da-4b7b-8c98-1eece4a8ddb3",
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
                "value": "Bearer [REDACTED_SECRET]"
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
          1104,
          480
        ],
        "id": "2122cdff-8234-4cd6-975e-adfdac958e85",
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
        "id": "3c07572f-1236-4669-b6b8-26664da15d88",
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
          "jsCode": "const pais = \"MX\";\nconst rows = [];\n\nfunction getObjects(payload) {\n  if (Array.isArray(payload?.objects)) return payload.objects;\n  if (Array.isArray(payload?.data?.objects)) return payload.data.objects;\n  if (Array.isArray(payload?.body?.objects)) return payload.body.objects;\n  return [];\n}\n\nfunction toAmount(value, fallback) {\n  const parsed = parseFloat(value || fallback);\n  return Number.isFinite(parsed) ? parsed : fallback;\n}\n\nfor (const item of $input.all()) {\n  const objects = getObjects(item.json);\n\n  for (const m of objects) {\n    if (!m || m.order_id === null || m.order_id === undefined || m.order_id === \"\") {\n      continue;\n    }\n\n    rows.push({\n      id_movimiento_dropi: m.id,\n      wallet_id: m.wallet_id ?? null,\n      id_orden_dropi: m.order_id,\n      identification_code: m.identification_code != null ? String(m.identification_code) : null,\n      tipo: m.type ?? null,\n      amount: toAmount(m.amount, 0),\n      previous_amount: m.previous_amount != null ? toAmount(m.previous_amount, null) : null,\n      description: m.description ?? null,\n      guia_envio: m.shipping_guide ?? m.guide ?? null,\n      registrado_en: m.created_at,\n      pais,\n    });\n  }\n}\n\nreturn rows.length > 0 ? [{ json: { wallet_movements: rows } }] : [];\n"
        },
        "id": "5bef78c9-fa22-40bd-90a5-dd74953e16e9",
        "name": "Mapear movimientos wallet completo",
        "type": "n8n-nodes-base.code",
        "typeVersion": 2,
        "position": [
          864,
          528
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
                "value": "Bearer [REDACTED_SECRET]"
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
        "id": "ef6d1571-33b6-44a8-a1a1-c2a42f051ff0",
        "name": "Insertar movimientos wallet",
        "type": "n8n-nodes-base.httpRequest",
        "typeVersion": 4.4,
        "position": [
          1280,
          672
        ],
        "retryOnFail": true,
        "maxTries": 3,
        "waitBetweenTries": 2000
      },
      {
        "parameters": {
          "jsCode": "return $input.all().filter((item) =>\n  Array.isArray(item.json.historiaFaltante) && item.json.historiaFaltante.length > 0,\n);\n"
        },
        "id": "86fda244-e604-421b-b61a-cdb7007e1e46",
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
        "id": "2f4881cd-7f44-4c89-9621-c09c15f7949c",
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
        "createdAt": "2026-07-06T22:44:48.814Z",
        "id": 148,
        "workflowId": "BQ7G5rSntIoszmJ3",
        "versionId": "7cc1f137-73b5-428f-8694-e0902b5344cb",
        "event": "activated",
        "userId": "55f82161-b55f-4333-8015-8bc98163d495"
      },
      {
        "createdAt": "2026-07-06T22:44:48.803Z",
        "id": 147,
        "workflowId": "BQ7G5rSntIoszmJ3",
        "versionId": "7cc1f137-73b5-428f-8694-e0902b5344cb",
        "event": "deactivated",
        "userId": "55f82161-b55f-4333-8015-8bc98163d495"
      }
    ]
  }
}
```

