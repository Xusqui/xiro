# Configuración de la IA (Groq, Gemini y Ollama)

El generador de preguntas IA puede usar tres proveedores:

- [Groq](https://groq.com): nivel gratuito, sin tarjeta de crédito.
- [Gemini](https://ai.google.dev) (Google AI Studio).
- [Ollama](https://ollama.com): modelos locales en un servidor propio, sin API key.

Se pueden configurar los tres a la vez. Desde el panel se elige cuál es el proveedor activo y si los demás sirven de respaldo.

## Obtener las API keys

### Groq

1. Ve a [console.groq.com](https://console.groq.com)
2. Crea una cuenta (gratis)
3. Ve a **API Keys** → **Create API Key**
4. Copia la clave (empieza por `gsk_`)

### Gemini

1. Ve a [aistudio.google.com](https://aistudio.google.com)
2. Entra con una cuenta de Google
3. Ve a **Get API key** → **Create API key**
4. Copia la clave (empieza por `AQ.`)

Desde mayo de 2026 Google AI Studio emite «auth keys» que empiezan por `AQ.`. Las claves antiguas `AIza...` dejaron de funcionar en septiembre de 2026, así que Xiro solo acepta el formato `AQ.`.

## Configurar en Xiro

1. Entra al panel de administración
2. Ve a **Configuración del Servidor** (icono engranaje)
3. Haz clic en la pestaña **IA**
4. Arriba, en **Proveedor activo**, elige el proveedor que generará las preguntas y activa o desactiva el respaldo
5. En **Conexiones**, abre la fila de cada proveedor que vayas a usar: en Groq o Gemini pega su API key y elige el modelo; en Ollama escribe la URL, pulsa **Cargar modelos** y elige uno (ver [Ollama](#ollama))
6. Pulsa **Guardar configuración** en la barra inferior. Es el único botón de guardado: envía solo lo que ha cambiado, primero las conexiones y después el proveedor activo. Si algo falla, se para, abre la fila del proveedor con el error y conserva lo escrito

Con una clave ya guardada, el campo aparece vacío con la clave enmascarada como pista: déjalo vacío para mantenerla o escribe otra para sustituirla. **Borrar clave** (dentro de la fila) elimina la conexión al momento, tras confirmar.

En Groq y Gemini, al guardar solo se comprueba el formato de la clave; no se hace ninguna llamada de prueba. En Ollama sí se consulta el servidor.

Todo se guarda en `app/ai-generator/groq-key.json` dentro del contenedor. El nombre se mantiene por compatibilidad con los bind mounts de `docker-compose.yml` y `docker-compose.deploy.yml`. Formato:

```json
{
  "provider": "groq",
  "fallback": true,
  "groq":   { "apiKey": "gsk_...", "model": "llama-3.3-70b-versatile" },
  "gemini": { "apiKey": "AQ....",  "model": "gemini-3.5-flash-lite" },
  "ollama": { "baseUrl": "http://192.168.1.10:11434", "model": "qwen3:8b", "apiKey": "opcional" }
}
```

El formato antiguo (`{ "apiKey", "model" }` en la raíz, solo Groq) se lee como la configuración de Groq y se reescribe con el formato nuevo en el siguiente guardado.  
Las claves **nunca** se exponen en logs, respuestas HTTP (solo enmascaradas) ni variables de entorno.

Valores por defecto: proveedor activo `groq`, respaldo activado, modelo de Gemini `gemini-3.5-flash-lite`, modelo de Groq `GROQ_MODEL` o `llama-3.3-70b-versatile`.

### Modelos de Groq

| Modelo | Velocidad | Calidad |
|--------|-----------|---------|
| `llama-3.3-70b-versatile` | ★★★ | ★★★★★ |
| `meta-llama/llama-4-scout-17b-16e-instruct` | ★★★★★ | ★★★★ |
| `openai/gpt-oss-120b` | ★★ | ★★★★★ |
| `openai/gpt-oss-20b` | ★★★★ | ★★★★ |
| `qwen/qwen3-32b` | ★★★★ | ★★★★ |
| `moonshotai/kimi-k2-instruct-0905` | ★★★★ | ★★★ |

### Modelos de Gemini

| Modelo | Notas |
|--------|-------|
| `gemini-3.5-flash-lite` | El más rápido y económico (por defecto) |
| `gemini-3.1-flash-lite` | Bajo coste |
| `gemini-3.8-flash` | El Flash más potente |
| `gemini-3.1-pro-preview` | Máxima calidad; en preview, puede cambiar o retirarse |

La lista de modelos de Groq y Gemini vive en `AI_PROVIDER_META` (`public/js/admin/modules/config-ui.js`). Si un modelo deja de existir, basta con editarla.

## Ollama

Ollama no usa API key: basta la URL del servidor y un modelo instalado (`ollama pull qwen3:8b`, por ejemplo).

- La URL la consulta el **servidor de Xiro!**, no el navegador. Si Xiro! corre en Docker, `localhost` es el propio contenedor: usa la IP del NAS o del equipo con Ollama (`http://192.168.1.10:11434`).
- Ollama escucha por defecto solo en `127.0.0.1`. Para aceptar conexiones del contenedor hay que arrancarlo con `OLLAMA_HOST=0.0.0.0:11434`. **No lo expongas a Internet tal cual**: no tiene autenticación y cualquiera podría usarlo o descargar y borrar modelos (`/api/pull`, `/api/delete`). Si tiene que ser accesible desde fuera, ponlo detrás de un proxy con API key (ver abajo).
- **API key (opcional):** se envía como `Authorization: Bearer <clave>`. Sirve para un proxy con autenticación o para Ollama Cloud. Va en el cuerpo de la petición, nunca en la URL. Si se deja vacía al guardar, se mantiene la guardada, pero solo si la URL no cambia: la clave nunca se envía a otro servidor. En las respuestas del panel solo aparece enmascarada.
- **Cargar modelos** llama a `POST /api/ai-generator/ollama/models` (`{ baseUrl, apiKey? }`), que consulta `/api/tags` de Ollama. Al abrir la pestaña, si ya hay URL guardada, la lista se carga sola.
- Al guardar (`POST /api/ai-generator/ollama/config`) se comprueba que el servidor responde y que el modelo está instalado.
- **Quitar Ollama** borra la URL y la API key y conserva el modelo.
- Ollama cuenta como configurado cuando tiene URL **y** modelo.

Peticiones: `/api/chat` sin streaming, `think: false` (los modelos con razonamiento como qwen3 o deepseek-r1 gastaban todo el límite de tokens pensando y devolvían la respuesta vacía), temperatura 0.7, `num_ctx` 8192 (el contexto por defecto de Ollama cortaría en silencio el texto del documento) y `num_predict` de al menos 4096. **No** se usa `format: "json"`: esa gramática obliga a devolver un objeto y los prompts piden un array. Si una versión antigua de Ollama deja el razonamiento en el texto (`<think>…</think>`), se elimina antes de parsear. El timeout mínimo es de 5 minutos porque los modelos locales, sobre todo en CPU, son mucho más lentos. Con modelos pequeños (menos de 7-8B parámetros) el JSON y la calidad de las preguntas empeoran.

### Ollama expuesto a Internet: proxy con API key

Ollama no comprueba ninguna clave, así que la comprobación la hace un proxy. El proxy inverso de DSM (Portal de inicio de sesión) no puede exigir cabeceras: usa un contenedor nginx o Caddy, publica solo el proxy con HTTPS y no abras el puerto 11434 en el router. Genera una clave larga (`openssl rand -hex 32`) y ponla también en el panel de Xiro!.

nginx:

```nginx
server {
    listen 443 ssl;
    server_name ollama.midominio.com;
    # ssl_certificate / ssl_certificate_key ...

    location / {
        if ($http_authorization != "Bearer CAMBIA_ESTA_CLAVE") { return 401; }
        proxy_pass http://192.168.1.10:11434;
        proxy_set_header Host localhost:11434;
        proxy_read_timeout 600s;   # las generaciones locales pueden tardar minutos
        proxy_buffering off;
    }
}
```

Caddy (certificado HTTPS automático):

```
ollama.midominio.com {
    @sinclave not header Authorization "Bearer CAMBIA_ESTA_CLAVE"
    respond @sinclave 401
    reverse_proxy 192.168.1.10:11434 {
        header_up Host localhost:11434
    }
}
```

#### Con Cloudflare delante (sin proxy extra)

Si el dominio pasa por Cloudflare (registro DNS con la nube naranja, «Proxied»), la clave la puede comprobar Cloudflare con una regla WAF y el proxy inverso de DSM solo reenvía:

1. Cloudflare → dominio → **Security → WAF → Custom rules → Create rule**, acción **Block**, expresión:
   ```
   (http.host eq "ollama.midominio.com" and not any(http.request.headers["authorization"][*] eq "Bearer CAMBIA_ESTA_CLAVE"))
   ```
2. En DSM, asigna a la regla de proxy inverso de Ollama un **perfil de control de acceso** que solo permita la red local y los rangos de IP de Cloudflare (https://www.cloudflare.com/ips/). Si no, quien conozca tu IP puede saltarse Cloudflare.
3. En Xiro!: URL `https://ollama.midominio.com` y, como API key, `CAMBIA_ESTA_CLAVE` (sin «Bearer»).

Cloudflare corta las peticiones que tardan más de 100 s (error 524) y Xiro! pide a Ollama sin streaming: con modelos lentos puede fallar. Si Xiro! y Ollama están en la misma red, usa la IP local en Xiro! y deja el dominio solo para los usos externos.

Con HTTP plano la clave viaja sin cifrar: por Internet, usa siempre `https://`. Si Xiro! y Ollama están en la misma red, lo más seguro es no exponer Ollama y usar la IP local.

## Respaldo automático (fallback)

Si está activado, el respaldo es el primer **otro** proveedor configurado, por este orden: Groq, Gemini, Ollama.

- Si un lote de preguntas no sale con el proveedor activo tras sus reintentos (error, respuesta inválida o timeout), ese lote se repite con el de respaldo.
- Si el proveedor activo devuelve un límite de uso (`429`), no se espera: el lote pasa directamente al de respaldo.
- Si el proveedor activo no está configurado, los dos primeros configurados hacen de principal y respaldo.

Un mismo banco puede acabar con preguntas de varios modelos. Sin respaldo, los límites de uso se esperan y reintentan como antes.

## Límites y estrategias implementadas

Groq impone límites de velocidad estrictos en su nivel gratuito (TPM: Tokens per Minute o RPM: Requests per Minute), dependiendo del modelo (algunos modelos avanzados como `gpt-oss-120b` están limitados a 8.000 TPM u `8b-instant` a 6.000 TPM). Gemini también limita peticiones por minuto y por día según el plan.

Para garantizar estabilidad y evitar que la API corte el texto JSON (`Expected ',' or '}'`), Xiro implementa las siguientes barreras defensivas:
1. **Lotes Pequeños (Batching):** Se piden un máximo de 3 preguntas simultáneas a la IA.
2. **Límite de Ingesta:** El PDF subido se limpia y trunca a 11.000 caracteres como máximo para no asfixiar el prompt. Si el modelo localiza apartados valiosos (como "Conclusiones" o "Summary" en varios idiomas), los incluye dinámicamente frente al texto central.
3. **Memoria Anti-Repetición:** El backend guarda un registro de las preguntas de lotes anteriores y obliga a la IA a diversificarse y no repetir contenidos semánticos en las siguientes iteraciones. Con Groq se usa una temperatura de 0.7; con Gemini se deja la de por defecto, como recomienda Google para los modelos Gemini 3.
4. **Auto-Reversión (Retries Inteligentes):** Si el proveedor devuelve un `429 Rate Limit`, `controller.js` (`getRateLimitWaitTime` + `handleBatchError`) lee los segundos de espera recomendados y "duerme" ese proceso el tiempo justo antes de reintentar el mismo lote, sin contar ese reintento como intento fallido. `gemini-client.js` traduce el `retryDelay` de Gemini al mismo texto que usa Groq.
5. **JSON garantizado en Gemini:** se pide `responseMimeType: application/json`. No se fija `maxOutputTokens` porque en los modelos con razonamiento ese límite incluye los tokens de pensamiento y cortaría la respuesta.

## Arquitectura

Todo el código de generación vive en `app/ai-generator/`, salvo la UI del panel admin:

```
routes.js            → status endpoint: usa checkAIStatus(). Además implementa un Anti-Timeout res.write(' ') cada 15s para evitar bloqueos del Proxy Reverso (Nginx/Synology) en generaciones largas.
config-routes.js     → GET/POST/DELETE /api/ai-generator/config (con provider) y PUT /api/ai-generator/config/settings (proveedor activo y respaldo).
ollama-routes.js     → GET /api/ai-generator/ollama/models (modelos instalados) y POST /api/ai-generator/ollama/config (URL + modelo).
controller.js        → orquesta los bucles de lotes de 3 (BATCH_SIZE), inyección de memoria histórica (preguntas previas excluidas en el prompt), reintentos ante rate limit / timeout y el paso al proveedor de respaldo.
ai-client.js         → callLLM(provider, ...): elige el cliente según el proveedor; checkAIStatus().
ai-config.js         → persiste proveedor activo, respaldo, claves y modelos en groq-key.json; getProviderPlan() decide principal y respaldo.
ai-validator.js      → valida el formato de las claves (gsk_ / AQ.) y del nombre del modelo.
groq-client.js       → HTTP a api.groq.com (módulo https nativo con Temperature adaptada a 0.7).
gemini-client.js     → HTTP a generativelanguage.googleapis.com (generateContent, cabecera x-goog-api-key).
ollama-client.js     → HTTP(S) al servidor Ollama: /api/chat (callOllama) y /api/tags (listOllamaModels); normalizeBaseUrl valida la URL.
prompt-builder.js    → diseña la estructura agnóstica para extraer preguntas únicas; aquí vive el límite de 11.000 caracteres (MAX_DOC_CHARS).
document-parser.js   → extrae texto de PDF/DOCX/TXT y busca priorizar las "Conclusiones" multilingüe.
```

```
public/js/admin/modules/config-ui.js            → pestaña "IA" en el panel de configuración (fuera de app/ai-generator/): proveedor activo, respaldo y barra de guardado.
public/js/admin/modules/config-ui-providers.js  → filas plegables de proveedor; cuerpo de Groq y Gemini (API key y modelo).
public/js/admin/modules/config-ui-ollama.js     → fila de Ollama: URL, API key opcional y carga de modelos instalados.
public/js/admin/modules/config-ui-save.js       → guardado único: detecta cambios y llama a los endpoints en orden.
public/css/admin-ai-config.css                  → estilos de la pestaña.
```
