# Secretos de la monitorización

Esta carpeta se monta en Prometheus y Alertmanager. Los ficheros que pongas aquí
no se suben a git (ver `.gitignore`).

| Fichero | Para qué | Quién lo lee |
|---|---|---|
| `smtp_password` | Contraseña SMTP de las alertas por email | Alertmanager |
| `telegram_token` | Token del bot si usas Telegram | Alertmanager |
| `metrics_token` | El mismo valor que `METRICS_TOKEN` del `.env` (opcional) | Prometheus |

Una sola línea, sin salto final: `printf '%s' 'la-contraseña' > smtp_password && chmod 644 smtp_password`.
Los contenedores corren con usuarios sin privilegios, por eso el permiso de lectura.
