# Lanza Web

Frontend React do painel operacional **Lanza Locações**. Consome a [Lanza API](https://github.com/nathalialanzendorf/lanza-locacoes) (`/api/docs`).

## Stack

- React 19 + TypeScript
- Vite 6
- React Router 7
- TanStack Query

## Arranque rápido

### 1. API (terminal 1)

Clone e suba a API em [lanza-locacoes](https://github.com/nathalialanzendorf/lanza-locacoes):

```bash
git clone https://github.com/nathalialanzendorf/lanza-locacoes.git
cd lanza-locacoes
npm install
npm run api:dev
```

A API fica em `http://127.0.0.1:3100` (documentação: `/api/docs`).

### 2. Frontend (terminal 2)

```bash
git clone https://github.com/nathalialanzendorf/lanza-web.git
cd lanza-web
npm install
npm run dev
```

Abra `http://localhost:5173`. Em desenvolvimento, o Vite faz **proxy** de `/api` e `/health` para a API local — não é preciso configurar CORS.

## Variáveis de ambiente

Copie `.env.example` para `.env` e ajuste conforme necessário:

| Variável | Uso |
|----------|-------|
| `VITE_API_BASE_URL` | URL absoluta da API em produção (ex.: deploy Vercel). Em dev, deixe vazio para usar o proxy. |
| `VITE_API_KEY` | Chave opcional (`X-API-Key`) quando `LANZA_API_KEY` está ativa no servidor. |
| `VITE_API_PROXY_TARGET` | Alvo do proxy Vite (default `http://127.0.0.1:3100`). |

A chave também pode ser guardada no navegador pelo banner de autenticação.

## Produção (Vercel)

1. No [dashboard Vercel](https://vercel.com/new), importe `nathalialanzendorf/lanza-web`.
2. **Framework Preset:** Vite (detectado automaticamente)
3. Variáveis de ambiente:

| Nome | Valor |
|------|-------|
| `VITE_API_BASE_URL` | `https://lanza-locacoes.vercel.app` |
| `VITE_API_KEY` | (opcional) mesma chave de `LANZA_API_KEY` na API |

4. Deploy.

Na API (`lanza-locacoes`), defina `LANZA_API_CORS_ORIGIN` com o domínio do frontend.

## Páginas incluídas

| Rota | Endpoint |
|------|----------|
| `/` | `GET /api/resumo` — dashboard |
| `/clientes` | `GET /api/clientes` |
| `/veiculos` | `GET /api/veiculos` |
| `/contratos` | `GET /api/contratos` |
| `/despesas` | `GET /api/despesas` |
| `/locacoes` | `GET /api/locacoes` |

A estrutura em `src/api/` está preparada para expandir com os demais grupos da OpenAPI (sync, relatórios, FIPE, etc.).
