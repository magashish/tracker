import { NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useTheme } from '../hooks/useTheme';

const NAV_ITEMS = [
  { to: '/', label: 'Live Employees', end: true },
  { to: '/reports', label: 'Reports' },
  { to: '/settings', label: 'Settings' },
  { to: '/admin-users', label: 'Admin Users', minRole: 'admin' as const },
];

function linkClasses(isActive: boolean) {
  return [
    'block rounded-md px-3 py-2 text-sm font-medium transition-colors',
    isActive
      ? 'bg-indigo-600 text-white'
      : 'text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800',
  ].join(' ');
}

export function Layout() {
  const { admin, logout, hasRole } = useAuth();
  const { theme, toggleTheme } = useTheme();

  return (
    <div className="flex min-h-screen">
      <aside className="w-60 shrink-0 border-r border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
        <div className="mb-6 px-2 text-lg font-semibold">Tracker</div>
        <nav className="space-y-1">
          {NAV_ITEMS.filter((item) => !item.minRole || hasRole(item.minRole)).map((item) => (
            <NavLink key={item.to} to={item.to} end={item.end} className={({ isActive }) => linkClasses(isActive)}>
              {item.label}
            </NavLink>
          ))}
        </nav>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center justify-between border-b border-gray-200 bg-white px-6 py-3 dark:border-gray-800 dark:bg-gray-900">
          <div className="text-sm text-gray-500 dark:text-gray-400">
            Signed in as <span className="font-medium text-gray-900 dark:text-gray-100">{admin?.fullName}</span>{' '}
            <span className="rounded bg-gray-100 px-1.5 py-0.5 text-xs uppercase text-gray-500 dark:bg-gray-800 dark:text-gray-400">
              {admin?.role}
            </span>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={toggleTheme}
              className="rounded-md border border-gray-200 px-3 py-1.5 text-sm dark:border-gray-700"
              aria-label="Toggle dark mode"
            >
              {theme === 'dark' ? 'Light mode' : 'Dark mode'}
            </button>
            <button
              onClick={() => void logout()}
              className="rounded-md border border-gray-200 px-3 py-1.5 text-sm dark:border-gray-700"
            >
              Log out
            </button>
          </div>
        </header>
        <main className="flex-1 overflow-y-auto p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
