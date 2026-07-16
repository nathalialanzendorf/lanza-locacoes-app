import { useState } from "react";
import { NavLink, Outlet } from "react-router-dom";
import { useHealth } from "@/api/hooks";
import { getApiBaseUrl } from "@/api/client";
import { ApiKeyBanner } from "./ApiKeyBanner";

const nav = [
  { to: "/", label: "Dashboard", end: true },
  { to: "/clientes", label: "Clientes" },
  { to: "/veiculos", label: "Veículos" },
  { to: "/contratos", label: "Contratos" },
  { to: "/despesas", label: "Débitos cliente" },
  { to: "/locacoes", label: "Locações" },
];

export function Layout() {
  const health = useHealth();
  const [apiKeyOpen, setApiKeyOpen] = useState(false);
  const apiBase = getApiBaseUrl();

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <span className="brand__mark">L</span>
          <div>
            <strong>Lanza</strong>
            <span className="brand__sub">Painel operacional</span>
          </div>
        </div>

        <nav className="nav">
          {nav.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                isActive ? "nav__link nav__link--active" : "nav__link"
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>

        <footer className="sidebar__footer">
          <a
            href={apiBase ? `${apiBase}/api/docs` : "/api/docs"}
            target="_blank"
            rel="noreferrer"
            className="sidebar__docs"
          >
            Documentação API
          </a>
          <button
            type="button"
            className="sidebar__link-btn"
            onClick={() => setApiKeyOpen(true)}
          >
            Chave API
          </button>
          <span className="sidebar__status">
            {health.isLoading && "Conectando…"}
            {health.isError && "API offline"}
            {health.isSuccess && (
              <>
                API v{health.data.version}
                {health.data.database?.backend
                  ? ` · DB ${health.data.database.backend}`
                  : null}
                {health.data.database?.postgres?.ok === false ? " · PG erro" : null}
              </>
            )}
          </span>
          {apiBase ? <span className="sidebar__api-url">{apiBase}</span> : null}
        </footer>
      </aside>

      <main className="main">
        <ApiKeyBanner open={apiKeyOpen} onClose={() => setApiKeyOpen(false)} />
        <Outlet />
      </main>
    </div>
  );
}
