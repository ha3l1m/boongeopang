import type { ReactNode } from 'react'

export type Tab = 'today' | 'live' | 'done'

const ICON: Record<Tab, ReactNode> = {
  today: <path d="M4 11l8-7 8 7v9a1 1 0 0 1-1 1h-5v-6h-4v6H5a1 1 0 0 1-1-1z" />,
  live: <path d="M6 3h12v18l-3-2-3 2-3-2-3 2zM9 8h6M9 12h6M9 16h3" />,
  done: <path d="M5 4h14v16H5zM8.5 12l2.5 2.5 4.5-5" />,
}

const TABS: readonly { key: Tab; label: string }[] = [
  { key: 'today', label: '오늘 현황' },
  { key: 'live', label: '처리 중' },
  { key: 'done', label: '완료' },
]

type Props = {
  tab: Tab
  onTab: (tab: Tab) => void
  liveCount: number
  /** red dot per tab when something there needs the owner */
  dots: Partial<Record<Tab, boolean>>
}

export function AdminNav({ tab, onTab, liveCount, dots }: Props) {
  return (
    <nav className="admin-nav" aria-label="주문판 메뉴">
      <div className="admin-nav__list" role="tablist" aria-orientation="vertical">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            role="tab"
            id={`admin-tab-${t.key}`}
            aria-selected={tab === t.key}
            aria-controls="admin-tabpanel"
            className={`admin-nav__tab ${tab === t.key ? 'admin-nav__tab--on' : ''}`}
            onClick={() => onTab(t.key)}
          >
            <svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true">{ICON[t.key]}</svg>
            <span>{t.label}</span>
            {t.key === 'live' && liveCount > 0 && <b className="admin-nav__badge">{liveCount}</b>}
            {dots[t.key] && <i className="admin-nav__dot" aria-label="확인 필요" />}
          </button>
        ))}
      </div>
    </nav>
  )
}
