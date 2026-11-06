import { MENU, formatWon } from '../../domain/menu'
import type { DaySummary } from '../../services/orderService'

export function TodaySummary({ summary }: { summary: DaySummary }) {
  return (
    <section className="card admin__summary" aria-label="오늘 요약">
      <div className="admin-stat admin-stat--sales">
        <span className="muted">오늘 매출</span>
        <strong>{formatWon(summary.sales)}</strong>
      </div>
      <div className="admin-stat">
        <span className="muted">주문 건수</span>
        <strong>{summary.orders}건</strong>
      </div>
      <ul className="admin-flavors">
        {MENU.map((m) => (
          <li key={m.flavor} className="admin-stat">
            <span className="muted"><i className="admin-stat__dot" style={{ background: m.color }} />{m.name}</span>
            <strong>{summary.byFlavor[m.flavor]}마리</strong>
          </li>
        ))}
      </ul>
      <div className="admin-stat admin-stat--cancel">
        <span className="muted">취소</span>
        <strong>{summary.cancelled}건</strong>
      </div>
    </section>
  )
}
