import { useEffect, useState } from "react";

import { NavLink, Outlet, useLocation } from "react-router-dom";

import { useHealth } from "@/api/hooks";

import { getApiBaseUrl } from "@/api/client";

import { useAuth } from "@/context/AuthContext";

import { ApiKeyBanner } from "./ApiKeyBanner";
import { BrandMark } from "./BrandMark";
import { IconClose, IconMenu } from "./icons";
import { RastreameEspelhoToggle } from "./RastreameEspelhoToggle";

type NavItem = {
  to: string;
  label: string;
  end?: boolean;
  isActive?: (pathname: string) => boolean;
};

type NavSubsection = {
  title: string;
  items: NavItem[];
};

type NavSection = {
  title?: string;
  items: NavItem[];
  subsections?: NavSubsection[];
  module?: "locacao" | "particular" | "venda";
};

const sharedNavSections: NavSection[] = [
  {
    items: [
      { to: "/clientes", label: "Clientes" },
      { to: "/veiculos", label: "Veículos" },
      { to: "/sync", label: "Syncs" },
    ],
  },
  {
    title: "Relatórios",
    items: [
      { to: "/relatorios/veiculo", label: "Dados do veículo" },
      { to: "/relatorios/infracoes", label: "Infrações" },
      { to: "/relatorios/pedagios", label: "Pedágio Digital" },
      { to: "/relatorios/estacionamento", label: "SigaPay" },
      { to: "/relatorios/fipe", label: "FIPE" },
    ],
  },
];

const moduleNavSections: NavSection[] = [
  {
    title: "Locação",
    module: "locacao",
    items: [
      { to: "/", label: "Dashboard", end: true },
      { to: "/contratos", label: "Contratos" },
      { to: "/recebimentos", label: "Recebimentos" },
      { to: "/despesas", label: "Despesas" },
      { to: "/parceiros", label: "Parceiros" },
      { to: "/movimentacao", label: "Movimentação" },
    ],
    subsections: [
      {
        title: "Relatórios",
        items: [
          { to: "/relatorios/cobrancas", label: "Cobranças" },
          { to: "/relatorios/prestacao-contas", label: "Prestação de contas" },
          { to: "/relatorios/encerramento", label: "Encerramento" },
        ],
      },
    ],
  },
  {
    title: "Particular",
    module: "particular",
    items: [{ to: "/particular", label: "Veículos" }],
  },
  {
    title: "Venda",
    module: "venda",
    items: [
      {
        to: "/venda",
        label: "Vendas",
        isActive: (pathname) =>
          pathname === "/venda" ||
          pathname === "/venda/novo" ||
          /^\/venda\/[^/]+\/editar$/.test(pathname),
      },
      {
        to: "/venda/veiculos",
        label: "Veículos",
        isActive: (pathname) => pathname.startsWith("/venda/veiculos"),
      },
    ],
  },
];

function navLinkClass(locationPathname: string, item: NavItem, module?: NavSection["module"]): string {
  const active = item.isActive?.(locationPathname);
  const isActive =
    active ??
    (item.end
      ? locationPathname === item.to || locationPathname === `${item.to}/`
      : locationPathname.startsWith(item.to));
  if (!isActive) return "nav__link";
  return module ? "nav__link nav__link--active nav__link--active-module" : "nav__link nav__link--active";
}

function NavSectionBlock({
  section,
  locationPathname,
}: {
  section: NavSection;
  locationPathname: string;
}) {
  const sectionClass = section.module
    ? `nav-section nav-section--module nav-section--module-${section.module}`
    : "nav-section";

  return (
    <div className={sectionClass}>
      {section.title ? <p className="nav-section__title">{section.title}</p> : null}
      {section.items.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          end={item.end}
          className={() => navLinkClass(locationPathname, item, section.module)}
        >
          {item.label}
        </NavLink>
      ))}
      {section.subsections?.map((subsection) => (
        <div key={subsection.title} className="nav-subsection">
          <p className="nav-subsection__title">{subsection.title}</p>
          {subsection.items.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={() => navLinkClass(locationPathname, item, section.module)}
            >
              {item.label}
            </NavLink>
          ))}
        </div>
      ))}
    </div>
  );
}

export function Layout() {
  const health = useHealth();
  const { user, logout } = useAuth();
  const location = useLocation();
  const [apiKeyOpen, setApiKeyOpen] = useState(false);
  const [navOpen, setNavOpen] = useState(false);
  const apiBase = getApiBaseUrl();

  useEffect(() => {
    setNavOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    document.body.classList.toggle("nav-open", navOpen);
    return () => document.body.classList.remove("nav-open");
  }, [navOpen]);

  useEffect(() => {
    if (!navOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setNavOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [navOpen]);

  return (
    <div className="app-shell">
      {navOpen ? (
        <button
          type="button"
          className="sidebar-backdrop"
          aria-label="Fechar menu"
          onClick={() => setNavOpen(false)}
        />
      ) : null}

      <aside className={`sidebar${navOpen ? " sidebar--open" : ""}`}>
        <div className="sidebar__top">
          <div className="brand">
            <BrandMark variant="sidebar" />
            <div>
              <strong>Lanza</strong>
              <span className="brand__sub">Painel operacional</span>
            </div>
          </div>

          <button
            type="button"
            className="sidebar__close btn btn--icon"
            aria-label="Fechar menu"
            onClick={() => setNavOpen(false)}
          >
            <IconClose className="row-actions__icon" title="" />
          </button>
        </div>

        <nav className="nav" aria-label="Menu principal">
          {sharedNavSections.map((section, index) => (
            <NavSectionBlock key={section.title ?? `shared-${index}`} section={section} locationPathname={location.pathname} />
          ))}
          <div className="nav-modules" aria-label="Módulos operacionais">
            <p className="nav-modules__label">Módulos</p>
            {moduleNavSections.map((section) => (
              <NavSectionBlock key={section.module} section={section} locationPathname={location.pathname} />
            ))}
          </div>
        </nav>

        <footer className="sidebar__footer">
          <RastreameEspelhoToggle />
          {user ? (
            <div className="sidebar__user">
              <strong>{user.name}</strong>
              <span>{user.email}</span>
              <button type="button" className="sidebar__link-btn" onClick={logout}>
                Sair
              </button>
            </div>
          ) : null}
          <a
            href={apiBase ? `${apiBase}/api/docs` : "/api/docs"}
            target="_blank"
            rel="noreferrer"
            className="sidebar__docs"
          >
            Documentação API
          </a>
          <button type="button" className="sidebar__link-btn" onClick={() => setApiKeyOpen(true)}>
            Chave API
          </button>
          <span className="sidebar__status">
            {health.isLoading && "Conectando…"}
            {health.isError && "API offline"}
            {health.isSuccess && (
              <>
                API v{health.data.version}
                {health.data.database?.backend ? ` · DB ${health.data.database.backend}` : null}
                {health.data.database?.postgres?.ok === false ? " · PG erro" : null}
              </>
            )}
          </span>
          {apiBase ? <span className="sidebar__api-url">{apiBase}</span> : null}
        </footer>
      </aside>

      <div className="app-content">
        <header className="mobile-topbar">
          <button
            type="button"
            className="mobile-topbar__menu btn btn--icon"
            aria-label="Abrir menu"
            aria-expanded={navOpen}
            onClick={() => setNavOpen(true)}
          >
            <IconMenu className="row-actions__icon" title="" />
          </button>
          <div className="mobile-topbar__brand">
            <BrandMark variant="auth" />
            <strong>Lanza</strong>
          </div>
        </header>

        <main className="main">
          <ApiKeyBanner open={apiKeyOpen} onClose={() => setApiKeyOpen(false)} />
          <Outlet />
        </main>
      </div>
    </div>
  );
}
