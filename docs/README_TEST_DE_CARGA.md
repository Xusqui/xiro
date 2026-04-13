# Quick Start: Load Testing

## Prerequisitos

1. Servidor corriendo: `npm start` en `/app`
2. Node.js v20+ (Artillery se ejecuta con `npx`, sin instalación local)

## Ejecución Rápida

```bash
# Test completo (flujo completo de juego, 120s)
npx artillery@latest run artillery.yml

# Tests específicos (más rápidos)
npx artillery@latest run artillery-join-lobby.yml      # 40s - Join lobby stress
npx artillery@latest run artillery-submit-answers.yml  # 11s - Answer burst
npx artillery@latest run artillery-reconnection.yml    # 40s - Reconnection stress

# Script bash (ejecuta todos + genera reportes HTML)
./scripts/run-load-tests.sh all
```

**Nota**: Usamos `npx artillery@latest` para evitar problemas de espacio en disco (Artillery con instalación local descarga Playwright/Chrome innecesariamente).

## Qué Medir

- **P95 latency**: Debe ser < 200ms
- **Error rate**: Debe ser < 0.1%
- **Concurrent players**: 100 sin crashes

## Resultados

- JSON: `load-test-results/*.json`
- HTML: `load-test-results/*.html`

Ver [LOAD_TESTING_GUIDE.md](docs/LOAD_TESTING_GUIDE.md) para detalles completos.
