import { menuItem } from '../../domain/menu'
import type { Order } from '../../domain/order'

export const orderNo = (order: Order) => `No.${String(order.number).padStart(3, '0')}`

export const clockFormat = new Intl.DateTimeFormat('ko-KR', { hour: 'numeric', minute: '2-digit' })

export function itemLine(order: Order): string {
  return order.items.map((item) => `${menuItem(item.flavor).name} ${item.qty}`).join(' · ')
}

export function fishCount(order: Order): number {
  return order.items.reduce((sum, item) => sum + item.qty, 0)
}

export function formatEta(seconds: number): string {
  return seconds < 60 ? `${seconds}초` : `${Math.ceil(seconds / 60)}분`
}
