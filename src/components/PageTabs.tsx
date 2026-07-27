import type { ReactNode } from "react";
import { NavLink, useLocation } from "react-router-dom";

type Tab = {
  to: string;
  label: string;
  end?: boolean;
  /** Substitui a detecção padrão do NavLink (ex.: abas com prefixo comum). */
  isActive?: (pathname: string) => boolean;
};

type Props = {
  tabs: Tab[];
  children?: ReactNode;
  ariaLabel?: string;
};

export function PageTabs({ tabs, children, ariaLabel = "Secções" }: Props) {
  const { pathname } = useLocation();

  return (
    <>
      <nav className="tabs" aria-label={ariaLabel}>
        {tabs.map((tab) => (
          <NavLink
            key={tab.to}
            to={tab.to}
            end={tab.end}
            className={() => {
              const active = tab.isActive ? tab.isActive(pathname) : undefined;
              const isActive =
                active ??
                (tab.end ? pathname === tab.to || pathname === `${tab.to}/` : pathname.startsWith(tab.to));
              return isActive ? "tabs__link tabs__link--active" : "tabs__link";
            }}
          >
            {tab.label}
          </NavLink>
        ))}
      </nav>
      {children}
    </>
  );
}
