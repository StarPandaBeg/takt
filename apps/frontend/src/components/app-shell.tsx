import {
    Activity,
    CalendarDays,
    Home,
    NotebookPen,
    Settings,
} from 'lucide-react'
import { NavLink, Outlet } from 'react-router-dom'

const navigation = [
    { to: '/', label: 'Главная', icon: Home, end: true },
    { to: '/calendar', label: 'Календарь', icon: CalendarDays, end: false },
    { to: '/notes', label: 'Заметки', icon: NotebookPen, end: false },
    { to: '/diagnostics', label: 'Диагностика', icon: Activity, end: false },
]

const commitSha = (import.meta.env.VITE_COMMIT_SHA || 'dev').trim()
const shortCommitSha = commitSha === 'dev' ? commitSha : commitSha.slice(0, 7)
const commitDate = (import.meta.env.VITE_COMMIT_DATE || '').trim()
const parsedCommitDate = new Date(commitDate)
const formattedCommitDate =
    commitSha !== 'dev' && !Number.isNaN(parsedCommitDate.getTime())
        ? new Intl.DateTimeFormat('ru-RU', {
              dateStyle: 'short',
              timeStyle: 'short',
          }).format(parsedCommitDate)
        : null
const commitLabel = `commit ${shortCommitSha}${formattedCommitDate === null ? '' : ` (${formattedCommitDate})`}`

export function AppShell() {
    return (
        <div className="app-shell">
            <aside className="sidebar">
                <NavLink
                    className="brand"
                    to="/"
                    aria-label="Takt — на главную"
                >
                    <span className="brand__mark">T</span>
                </NavLink>
                <nav className="main-nav" aria-label="Основная навигация">
                    {navigation.map(({ to, label, icon: Icon, end }) => (
                        <NavLink
                            key={to}
                            className={({ isActive }) =>
                                `nav-item${isActive ? ' nav-item--active' : ''}`
                            }
                            to={to}
                            end={end}
                            title={label}
                        >
                            <Icon
                                aria-hidden="true"
                                size={20}
                                strokeWidth={1.8}
                            />
                            <span>{label}</span>
                        </NavLink>
                    ))}
                </nav>
                <button
                    className="nav-item sidebar__settings"
                    type="button"
                    title="Настройки"
                >
                    <Settings size={20} strokeWidth={1.8} />
                    <span>Настройки</span>
                </button>
            </aside>
            <main className="app-content">
                <Outlet />
            </main>
            <nav className="mobile-nav" aria-label="Мобильная навигация">
                {navigation.map(({ to, label, icon: Icon, end }) => (
                    <NavLink
                        key={to}
                        className={({ isActive }) =>
                            `mobile-nav__item${isActive ? ' is-active' : ''}`
                        }
                        to={to}
                        end={end}
                    >
                        <Icon size={20} strokeWidth={1.8} />
                        <span>{label}</span>
                    </NavLink>
                ))}
            </nav>
            <div
                className="build-commit"
                title={`Commit сборки: ${commitSha}`}
                aria-label={commitLabel}
            >
                {commitLabel}
            </div>
        </div>
    )
}
