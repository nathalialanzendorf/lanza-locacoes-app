# Arquitetura em produção — 3 componentes

```
┌─────────────────────────┐     HTTPS + CORS      ┌──────────────────────────────┐
│  Frontend (Vite/React)  │ ────────────────────► │  Backend API (@lanza/api)    │
│  lanzalocacoes.vercel   │   X-API-Key (opc.)    │  api.lanzalocacoes.vercel    │
└─────────────────────────┘                       └──────────────┬───────────────┘
                                                                 │ OIDC + IAM
                                                                 ▼
                                                    ┌──────────────────────────────┐
                                                    │  PostgreSQL (RDS AWS)        │
                                                    │  via LANZA_DB_BACKEND=postgres│
                                                    └──────────────────────────────┘
```

## URLs de produção

| Componente | Projeto Vercel | URL |
|------------|----------------|-----|
| **Frontend** | `lanza-locacoes-app` | https://lanzalocacoes.vercel.app |
| **API** | `lanza-locacoes-services` | https://api.lanzalocacoes.vercel.app |
| **Docs** | (API) | https://api.lanzalocacoes.vercel.app/api/docs |

## Variáveis — projeto API (`lanza-locacoes-services`)

Valores exatos: **[docs/vercel-env-api.md](https://github.com/nathalialanzendorf/lanza-locacoes-services/blob/main/docs/vercel-env-api.md)** ou `.\scripts\set-vercel-postgres-env.ps1` no repo da API.

| Variável | Valor |
|----------|-------|
| `LANZA_DB_BACKEND` | `postgres` *(produção)* ou `dual` |
| `PGHOST` | `aws-pg-lanza-locacoes.cluster-c856s8wi6jzs.us-east-1.rds.amazonaws.com` |
| `PGPORT` | `5432` |
| `PGDATABASE` | `postgres` |
| `PGUSER` | `postgres` |
| `PGSSLMODE` | `require` |
| `AWS_REGION` | `us-east-1` |
| `AWS_ROLE_ARN` | `arn:aws:iam::154601375525:role/Vercel/access-pg-lanza-locacoes` |
| `LANZA_WEB_URL` | `https://lanzalocacoes.vercel.app` |
| `LANZA_API_PUBLIC_URL` | `https://api.lanzalocacoes.vercel.app` |

## Variáveis — projeto Frontend (`lanza-locacoes-app`)

| Variável | Valor |
|----------|-------|
| `VITE_API_BASE_URL` | `https://api.lanzalocacoes.vercel.app` |

Já definido em `.env.production` — o build Vercel usa automaticamente.

> **Segurança:** o frontend só precisa de variáveis `VITE_*`. **Não** coloque `PGHOST`, `AWS_*`, `PGPASSWORD` ou `LANZA_JWT_SECRET` no repo do app — elas vão no projeto Vercel da **API** (`lanza-locacoes-services`). Para aplicar ou rever: `lanza-locacoes-services/docs/vercel-env-api.md` ou `.\scripts\set-vercel-postgres-env.ps1`.

## Verificar ligação

```bash
# API + base de dados
curl https://api.lanzalocacoes.vercel.app/health

# Dados operacionais
curl https://api.lanzalocacoes.vercel.app/api/resumo
```

Resposta esperada de `/health`:

```json
{
  "status": "ok",
  "database": { "backend": "postgres", "postgres": { "ok": true } },
  "apiUrl": "https://api.lanzalocacoes.vercel.app",
  "frontendUrl": "https://lanzalocacoes.vercel.app"
}
```

O painel em https://lanzalocacoes.vercel.app mostra no rodapé a versão da API e o backend de dados (`file` ou `postgres`).

## Redeploy

Após alterar variáveis, faça **Redeploy** nos dois projetos Vercel (API e frontend).
