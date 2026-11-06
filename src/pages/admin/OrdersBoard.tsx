import { useState } from 'react'
import { isTerminal, type AdminStatus, type Order } from '../../domain/order'
import type { Pause } from '../../domain/robot'
import { AdminOrderCard } from './AdminOrderCard'
import { AdminOrderDetail } from './AdminOrderDetail'

type Group = 'live' | 'done'
type Filter = 'all' | 'baking' | 'ready' | 'picked_up' | 'cancelled'
type Row = { order: Order; status: AdminStatus }

const FILTERS: Record<Group, readonly { key: Filter; label: string }[]> = {
  live: [
    { key: 'all', label: '전체' },
    { key: 'baking', label: '굽는 중' },
    { key: 'ready', label: '픽업 대기' },
  ],
  done: [
    { key: 'all', label: '전체' },
    { key: 'picked_up', label: '픽업 완료' },
    { key: 'cancelled', label: '취소' },
  ],
}

export function inGroup(group: Group, status: AdminStatus): boolean {
  return isTerminal(status) === (group === 'done')
}

function matches(filter: Filter, status: AdminStatus): boolean {
  if (filter === 'all') return true
  if (filter === 'baking') return status !== 'ready' && !isTerminal(status)
  return status === filter
}

type Props = {
  group: Group
  rows: readonly Row[]
  now: Date
  pauses: readonly Pause[]
  paused: boolean
  onChange: (order: Order, status: AdminStatus) => void
}

export function OrdersBoard({ group, rows, now, pauses, paused, onChange }: Props) {
  const [filter, setFilter] = useState<Filter>('all')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const groupRows = rows.filter((r) => inGroup(group, r.status))
  const shown = groupRows.filter((r) => matches(filter, r.status))
  const selected = rows.find((r) => r.order.id === selectedId) ?? null

  return (
    <div className="admin-orders">
      <div className="admin-orders__list">
        <nav className="admin__filters" aria-label="주문 상태 필터">
          {FILTERS[group].map((f) => (
            <button
              key={f.key}
              type="button"
              className={`admin__filter ${filter === f.key ? 'admin__filter--on' : ''}`}
              aria-pressed={filter === f.key}
              onClick={() => setFilter(f.key)}
            >
              {f.label} <b>{groupRows.filter((r) => matches(f.key, r.status)).length}</b>
            </button>
          ))}
        </nav>
        {shown.length === 0 ? (
          <p className="muted admin__empty">해당하는 주문이 없어요</p>
        ) : (
          <ul className="admin__grid">
            {shown.map(({ order, status }) => (
              <AdminOrderCard
                key={order.id}
                order={order}
                status={status}
                now={now}
                pauses={pauses}
                paused={paused}
                selected={order.id === selectedId}
                onSelect={(o) => setSelectedId(o.id)}
                onChange={onChange}
              />
            ))}
          </ul>
        )}
      </div>
      <AdminOrderDetail row={selected} onChange={onChange} onClose={() => setSelectedId(null)} />
    </div>
  )
}
