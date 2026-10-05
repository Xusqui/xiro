# Configuración de la IA (Groq y Gemini)

El generador de preguntas IA puede usar dos proveedores:

- [Groq](https://groq.com): nivel gratuito, sin tarjeta de crédito.
- [Gemini](https://ai.google.dev) (Google AI Studio).

Se pueden guardar las dos claves a la vez. Desde el panel se elige cuál es el proveedor activo y si el otro sirve de respaldo.

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
4. En la tarjeta de cada proveedor, pega su API key, elige el modelo y pulsa **Guardar configuración**
5. En la tarjeta **Proveedor de IA**, elige el **proveedor activo**, activa o desactiva el respaldo y pulsa **Guardar preferencias**

Al guardar solo se comprueba el formato de la clave; no se hace ninguna llamada de prueba.

Todo se guarda en `app/ai-generator/groq-key.json` dentro del contenedor. El nombre se mantiene por compatibilidad con los bind mounts de `docker-compose.yml` y `docker-compose.deploy.yml`. Formato:

```json
{
  "provider": "groq",
  "fallback": true,
  "groq":   { "apiKey": "gsk_...", "model": "llama-3.3-70b-versatile" },
  "gemini": { "apiKey": "AQ....",  "model": "gemini-3.5-flash-lite" }
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

La lista vive en `AI_PROVIDER_META` (`public/js/admin/modules/config-ui.js`). Si un modelo deja de existir, basta con editarla.

## Respaldo automático (fallback)

Si está activado y el otro proveedor tiene clave:

- Si un lote de preguntas no sale con el proveedor activo tras sus reintentos (error, respuesta inválida o timeout), ese lote se repite con el otro proveedor.
- Si el proveedor activo devuelve un límite de uso (`429`), no se espera: el lote pasa directamente al otro proveedor.
- Si el proveedor activo no tiene clave, se usa el otro.

Un mismo banco puede acabar con preguntas de los dos modelos. Sin respaldo, los límites de uso se esperan y reintentan como antes.

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
controller.js        → orquesta los bucles de lotes de 3 (BATCH_SIZE), inyección de memoria histórica (preguntas previas excluidas en el prompt), reintentos ante rate limit / timeout y el paso al proveedor de respaldo.
ai-client.js         → callLLM(provider, ...): elige el cliente según el proveedor; checkAIStatus().
ai-config.js         → persiste proveedor activo, respaldo, claves y modelos en groq-key.json; getProviderPlan() decide principal y respaldo.
ai-validator.js      → valida el formato de las claves (gsk_ / AQ.) y del nombre del modelo.
groq-client.js       → HTTP a api.groq.com (módulo https nativo con Temperature adaptada a 0.7).
gemini-client.js     → HTTP a generativelanguage.googleapis.com (generateContent, cabecera x-goog-api-key).
prompt-builder.js    → diseña la estructura agnóstica para extraer preguntas únicas; aquí vive el límite de 11.000 caracteres (MAX_DOC_CHARS).
document-parser.js   → extrae texto de PDF/DOCX/TXT y busca priorizar las "Conclusiones" multilingüe.
```

```
public/js/admin/modules/config-ui.js  → pestaña "IA" en el panel de configuración frontal (fuera de app/ai-generator/).
```
