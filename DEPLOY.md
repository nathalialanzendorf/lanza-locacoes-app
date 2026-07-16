# Arquitetura em produção — 3 componentes

```
┌─────────────────────────┐     HTTPS + CORS      ┌──────────────────────────────┐
│  Frontend (Vite/React)  │ ────────────────────► │  Backend API (@lanza/api)    │
│  lanza-web-ten.vercel   │   X-API-Key (opc.)    │  lanza-locacoes.vercel.app   │
└─────────────────────────┘                       └──────────────┬───────────────┘
                                                                 │ OIDC + IAM
                                                                 ▼
                                                    ┌──────────────────────────────┐
                                                    │  PostgreSQL (RDS AWS)        │
                                                    │  via LANZA_DB_BACKEND=postgres│
                                                    └──────────────────────────────┘
```

## URLs de produção

| Componente | URL |
|------------|-----|
| **Frontend** | https://lanza-web-ten.vercel.app |
| **API** | https://lanza-locacoes.vercel.app |
| **Docs** | https://lanza-locacoes.vercel.app/api/docs |

## Variáveis — projeto API (`lanza-locacoes`)

| Variável | Valor sugerido |
|----------|----------------|
| `LANZA_DB_BACKEND` | `postgres` |
| `PGHOST` | host RDS (ex. `aws-postgres-lanza.cluster-….rds.amazonaws.com`) |
| `PGUSER` | `postgres` |
| `PGDATABASE` | `postgres` |
| `PGSSLMODE` | `require` |
| `AWS_REGION` | `sa-east-1` |
| `AWS_ROLE_ARN` | `arn:aws:iam::…:role/Vercel/access-postgres-lanza` |
| `LANZA_WEB_URL` | `https://lanza-web-ten.vercel.app` |
| `LANZA_API_PUBLIC_URL` | `https://lanza-locacoes.vercel.app` |
| `LANZA_API_CORS_ORIGIN` | *(opcional)* lista separada por vírgula; default já inclui o frontend |

## Variáveis — projeto Frontend (`lanza-web`)

| Variável | Valor |
|----------|-------|
| `VITE_API_BASE_URL` | `https://lanza-locacoes.vercel.app` |

Já definido em `.env.production` — o build Vercel usa automaticamente.

## Verificar ligação

```bash
# API + base de dados
curl https://lanza-locacoes.vercel.app/health

# Dados operacionais
curl https://lanza-locacoes.vercel.app/api/resumo
```

Resposta esperada de `/health`:

```json
{
  "status": "ok",
  "database": { "backend": "postgres", "postgres": { "ok": true } },
  "apiUrl": "https://lanza-locacoes.vercel.app",
  "frontendUrl": "https://lanza-web-ten.vercel.app"
}
```

O painel em https://lanza-web-ten.vercel.app mostra no rodapé a versão da API e o backend de dados (`file` ou `postgres`).

## Redeploy

Após alterar variáveis, faça **Redeploy** nos dois projetos Vercel (API e frontend).
