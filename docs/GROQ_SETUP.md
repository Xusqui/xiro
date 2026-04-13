# Configuración de Groq AI

El generador de preguntas IA usa la API de [Groq](https://groq.com) (nivel gratuito, sin tarjeta de crédito).

## Obtener la API Key

1. Ve a [console.groq.com](https://console.groq.com)
2. Crea una cuenta (gratis)
3. Ve a **API Keys** → **Create API Key**
4. Copia la clave (empieza por `gsk_`)

## Configurar la clave en Xiro

1. Entra al panel de administración
2. Ve a **Configuración del Servidor** (icono engranaje)
3. Haz clic en la pestaña **IA (Groq)**
4. Pega tu API key y pulsa **Guardar clave**

La clave se persiste en `app/ai-generator/groq-key.json` dentro del contenedor.  
**Nunca** se expone en logs, respuestas HTTP ni variables de entorno.

Modelos recomendados:
| Modelo | Velocidad | Calidad |
|--------|-----------|---------|
| `llama-3.3-70b-versatile` | ★★★ | ★★★★★ |
| `meta-llama/llama-4-scout-17b-16e-instruct` | ★★★★★ | ★★★★ |
| `openai/gpt-oss-120b` | ★★ | ★★★★★ |
| `openai/gpt-oss-20b` | ★★★★ | ★★★★ |
| `qwen/qwen3-32b` | ★★★★ | ★★★★ |
| `moonshotai/kimi-k2-instruct-0905` | ★★★★ | ★★★ |

## Límites del nivel gratuito y Estrategias implementadas

Groq impone límites de velocidad estrictos en su nivel gratuito (TPM: Tokens per Minute o RPM: Requests per Minute), dependiendo del modelo (algunos modelos avanzados como `gpt-oss-120b` están limitados a 8.000 TPM u `8b-instant` a 6.000 TPM).

Para garantizar estabilidad y evitar que la API corte el texto JSON (`Expected ',' or '}'`), Xiro implementa las siguientes barreras defensivas:
1. **Lotes Pequeños (Batching):** Se piden un máximo de 3 preguntas simultáneas a la IA.
2. **Límite de Ingesta:** El PDF subido se limpia y trunca a 11.000 caracteres como máximo para no asfixiar el prompt. Si el modelo localiza apartados valiosos (como "Conclusiones" o "Summary" en varios idiomas), los incluye dinámicamente frente al texto central.
3. **Memoria Anti-Repetición:** El backend guarda un registro de las preguntas de lotes anteriores y obliga a la IA (usando una temperatura de 0.7) a diversificarse y no repetir contenidos semánticos en las siguientes iteraciones.
4. **Auto-Reversión (Retries Inteligentes):** Si Groq devuelve un error `429 Rate Limit`, la arquitectura lee los segundos de espera recomendados en el error y "duerme" ese proceso el tiempo justo antes de reintentarlo automáticamente.

## Arquitectura

```
routes.js            → status endpoint: usa checkGroqStatus(). Además implementa un Anti-Timeout res.write(' ') cada 15s para evitar bloqueos del Proxy Reverso (Nginx/Synology) en generaciones largas.
config-routes.js     → GET/POST/DELETE /api/ai-generator/config
controller.js        → orquesta los bucles de lotes de 3, inyección de memoria histórica y controla interrupciones (AbortController).
groq-client.js       → HTTP a api.groq.com (módulo https nativo con Temperature adaptada a 0.7).
groq-config.js       → persiste API key y Modelos en groq-key.json.
prompt-builder.js    → diseña la estructura agnóstica para extraer preguntas únicas.
document-parser.js   → extrae texto de PDF/DOCX/TXT y busca priorizar las "Conclusiones" multilingüe.
config-ui.js         → pestaña "IA (Groq)" en el panel de configuración frontal.
```
