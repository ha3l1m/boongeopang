import { Icon } from './Icon'

type Props = { label: string; qty: number; canAdd: boolean; onAdd: () => void; onRemove: () => void; onBlocked: () => void }

export function QtyStepper({ label, qty, canAdd, onAdd, onRemove, onBlocked }: Props) {
  return (
    <div className="stepper">
      <button type="button" aria-label={`${label} 빼기`} onClick={onRemove} disabled={qty === 0}>
        <Icon name="minus" size={18} strokeWidth={2.5} />
      </button>
      <span key={qty} className={`stepper__qty ${qty > 0 ? 'stepper__qty--bump' : ''}`} aria-live="polite" aria-label={`${label} ${qty}개`}>
        {qty}
      </span>
      <button type="button" aria-label={`${label} 더하기`} onClick={canAdd ? onAdd : onBlocked}>
        <Icon name="plus" size={18} strokeWidth={2.5} />
      </button>
    </div>
  )
}
