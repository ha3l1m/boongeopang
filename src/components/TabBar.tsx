import { NavLink } from 'react-router-dom'
import { Icon } from './Icon'

export function TabBar() {
  return (
    <nav className="tabbar" aria-label="메인 메뉴">
      <NavLink to="/" end>
        <Icon name="fish" className="tabbar__icon" />
        주문하기
      </NavLink>
      <NavLink to="/orders">
        <Icon name="receipt" className="tabbar__icon" />
        주문내역
      </NavLink>
    </nav>
  )
}
