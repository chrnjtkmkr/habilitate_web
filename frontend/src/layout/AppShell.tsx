import { NavLink, Outlet } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import clsx from 'clsx';
import { useAuth } from '../hooks/useAuth';
import { LanguageToggle } from './LanguageToggle';
import UserMenu from './UserMenu';

// TODO Week 8 polish: add center-level /reports approval queue page
//   - Lists all reports across children in center
//   - Filters: child, status (awaiting_approval surfaces first), period
//   - Supervisor reviews + approves multiple children's reports from one place
const navItems = [
  { to: '/dashboard', labelKey: 'nav_pulse' },
  { to: '/children', labelKey: 'nav_children' },
  { to: '/sessions', labelKey: 'nav_sessions' },
  { to: '/my-work', labelKey: 'nav_my_work' },
  { to: '/roster', labelKey: 'nav_roster' },
] as const;

export default function AppShell() {
  const { t } = useTranslation();
  const { memberships } = useAuth();
  const centerName = memberships[0]?.centers?.name;
  const isCenterOwner = memberships.some((m) => m.role === 'center_owner');

  return (
    <div className="min-h-screen overflow-x-hidden bg-background">
      {/* Top nav */}
      <header className="sticky top-0 z-10 flex h-14 items-center justify-between border-b border-border bg-surface px-4 lg:px-6">
        <div className="flex min-w-0 items-center gap-3">
          <img src="/logo.png" alt="" className="h-11 w-11 shrink-0" />
          <span className="truncate text-lg font-semibold text-ink-primary">{t('app_name')}</span>
          {centerName && (
            <>
              <span className="hidden text-border-strong sm:inline">|</span>
              <span className="hidden text-sm text-ink-secondary sm:inline">{centerName}</span>
            </>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-2 sm:gap-3">
          <LanguageToggle />
          <UserMenu />
        </div>
      </header>

      {/* Mobile nav strip — min-h-[44px] on each item for touch targets */}
      <nav className="relative flex gap-1 overflow-x-auto border-b border-border bg-surface px-4 py-1 lg:hidden" style={{ maskImage: 'linear-gradient(to right, black 90%, transparent)', WebkitMaskImage: 'linear-gradient(to right, black 90%, transparent)' }}>
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              clsx(
                'flex min-h-[44px] items-center whitespace-nowrap rounded-lg px-4 py-2 text-sm font-medium',
                isActive ? 'bg-primary-50 text-primary-700' : 'text-ink-secondary hover:bg-primary-50',
              )
            }
          >
            {t(item.labelKey)}
          </NavLink>
        ))}
        {isCenterOwner && (
          <NavLink
            to="/diagnostics/camera"
            className={({ isActive }) =>
              clsx(
                'flex min-h-[44px] items-center whitespace-nowrap rounded-lg px-4 py-2 text-sm font-medium',
                isActive ? 'bg-primary-50 text-primary-700' : 'text-ink-secondary hover:bg-primary-50',
              )
            }
          >
            {t('nav_diagnostics')}
          </NavLink>
        )}
      </nav>

      <div className="flex min-w-0">
        {/* Desktop left rail */}
        <aside className="hidden w-56 shrink-0 border-r border-border bg-surface p-4 lg:block">
          <nav className="flex flex-col gap-1">
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  clsx(
                    'flex h-10 items-center rounded-lg px-3 text-sm font-medium',
                    isActive
                      ? 'bg-primary-50 text-primary-700'
                      : 'text-ink-secondary hover:bg-primary-50',
                  )
                }
              >
                {t(item.labelKey)}
              </NavLink>
            ))}
            {isCenterOwner && (
              <NavLink
                to="/diagnostics/camera"
                className={({ isActive }) =>
                  clsx(
                    'flex h-10 items-center rounded-lg px-3 text-sm font-medium',
                    isActive
                      ? 'bg-primary-50 text-primary-700'
                      : 'text-ink-secondary hover:bg-primary-50',
                  )
                }
              >
                {t('nav_diagnostics')}
              </NavLink>
            )}
          </nav>
        </aside>

        {/* Main content */}
        <main className="min-w-0 flex-1 p-6 lg:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
