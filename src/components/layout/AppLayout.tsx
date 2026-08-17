import type { ReactNode } from 'react'
import { NavLink, useLocation, useNavigate } from 'react-router-dom'

const NAV = [
  { to: '/', label: 'Home', icon: '🏠' },
  { to: '/errori', label: 'Errori', icon: '❌' },
  { to: '/statistiche', label: 'Statistiche', icon: '📊' },
  { to: '/impostazioni', label: 'Impostazioni', icon: '⚙️' },
]

/** Routes that hide the bottom bar so exercises stay distraction-free. */
const IMMERSIVE = ['/sessione', '/allenamento', '/scenari/']

interface Props {
  children: ReactNode
}

export function AppLayout({ children }: Props) {
  const location = useLocation()
  const immersive = IMMERSIVE.some((prefix) => location.pathname.startsWith(prefix))

  return (
    <div className="min-h-full bg-bg">
      <a
        href="#contenuto"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-accent focus:px-4 focus:py-2 focus:text-white"
      >
        Vai al contenuto
      </a>

      <main
        id="contenuto"
        className={`mx-auto flex min-h-dvh w-full max-w-[560px] flex-col px-4 safe-top ${
          immersive ? 'pb-6 safe-bottom' : 'pb-24'
        }`}
      >
        {children}
      </main>

      {!immersive && <BottomNav />}
    </div>
  )
}

function BottomNav() {
  return (
    <nav
      aria-label="Navigazione principale"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-bg-soft/95 backdrop-blur safe-bottom"
    >
      <ul className="mx-auto flex w-full max-w-[560px] items-stretch justify-around px-2 pt-1.5">
        {NAV.map((entry) => (
          <li key={entry.to} className="flex-1">
            <NavLink
              to={entry.to}
              end={entry.to === '/'}
              className={({ isActive }) =>
                [
                  'flex min-h-[52px] flex-col items-center justify-center gap-0.5 rounded-lg px-2 py-1 text-[0.68rem] font-medium transition-colors',
                  isActive ? 'text-accent' : 'text-ink-faint hover:text-ink-muted',
                ].join(' ')
              }
            >
              {({ isActive }) => (
                <>
                  <span aria-hidden className="text-lg leading-none">
                    {entry.icon}
                  </span>
                  <span>{entry.label}</span>
                  <span className="sr-only">{isActive ? '(pagina corrente)' : ''}</span>
                </>
              )}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  )
}

interface HeaderProps {
  title: string
  subtitle?: string
  /** Where the back arrow goes; defaults to browser history. */
  back?: string
  action?: ReactNode
}

export function PageHeader({ title, subtitle, back, action }: HeaderProps) {
  const navigate = useNavigate()
  return (
    <header className="mb-5 flex items-start gap-3 pt-3">
      <button
        type="button"
        onClick={() => (back ? navigate(back) : navigate(-1))}
        aria-label="Torna indietro"
        className="-ml-2 flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-ink-muted transition-colors hover:bg-surface-2 hover:text-ink"
      >
        <span aria-hidden className="text-xl">
          ←
        </span>
      </button>
      <div className="min-w-0 flex-1">
        <h1 className="truncate text-xl font-bold leading-tight">{title}</h1>
        {subtitle && <p className="mt-0.5 text-sm text-ink-faint">{subtitle}</p>}
      </div>
      {action}
    </header>
  )
}
