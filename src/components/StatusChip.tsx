import { ADMIN_STATUS_LABEL, type AdminStatus } from '../domain/order'

const CHIP_CLASS: Partial<Record<AdminStatus, string>> = {
  ready: 'chip--done',
  picked_up: 'chip--done',
  cancelled: 'chip--cancel',
}

export function StatusChip({ status }: { status: AdminStatus }) {
  return <span className={`chip ${CHIP_CLASS[status] ?? 'chip--live'}`}>{ADMIN_STATUS_LABEL[status]}</span>
}
