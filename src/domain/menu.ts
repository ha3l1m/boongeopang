export type Flavor = 'redbean' | 'cream' | 'choco'

export type MenuItem = {
  flavor: Flavor
  name: string
  description: string
  price: number
  color: string
  fillingName: string
}

export const MENU: readonly MenuItem[] = [
  { flavor: 'redbean', name: '팥붕', description: '할매표 국산 팥, 꽉 찬 클래식', price: 1000, color: '#8B4A2B', fillingName: '팥앙금' },
  { flavor: 'cream', name: '슈붕', description: '부드럽고 달콤한 노란 크림', price: 1000, color: '#F6D98A', fillingName: '커스터드' },
  { flavor: 'choco', name: '초코붕', description: '진한 초코가 주르륵', price: 1200, color: '#5A3220', fillingName: '초코크림' },
]

/** The robot has bottles for these only (ros2_ws motions.py FILLINGS). */
export const ROBOT_FLAVORS: readonly Flavor[] = ['redbean', 'cream']

export const MAX_PER_FLAVOR = 10
export const MAX_TOTAL = 20

export function menuItem(flavor: Flavor): MenuItem {
  const item = MENU.find((m) => m.flavor === flavor)
  if (!item) throw new Error(`Unknown flavor: ${flavor}`)
  return item
}

export function formatWon(value: number): string {
  return `${value.toLocaleString('ko-KR')}원`
}
