import { createContext, useContext, useMemo, useState, type ReactNode } from 'react'
import type { Flavor } from '../domain/menu'
import { addToCart, removeFromCart, type Cart } from '../domain/order'

type CartValue = {
  cart: Cart
  memo: string
  add: (flavor: Flavor) => void
  remove: (flavor: Flavor) => void
  setMemo: (memo: string) => void
  clear: () => void
  /** Replaces the cart, e.g. with what the customer said on the voice page. */
  fill: (cart: Cart) => void
}

const CartContext = createContext<CartValue | null>(null)

export function CartProvider({ children }: { children: ReactNode }) {
  const [cart, setCart] = useState<Cart>({})
  const [memo, setMemo] = useState('')

  const value = useMemo<CartValue>(
    () => ({
      cart,
      memo,
      add: (flavor) => setCart((c) => addToCart(c, flavor)),
      remove: (flavor) => setCart((c) => removeFromCart(c, flavor)),
      setMemo,
      fill: (next) => setCart(next),
      clear: () => {
        setCart({})
        setMemo('')
      },
    }),
    [cart, memo],
  )
  return <CartContext.Provider value={value}>{children}</CartContext.Provider>
}

export function useCart(): CartValue {
  const value = useContext(CartContext)
  if (!value) throw new Error('useCart must be used inside CartProvider')
  return value
}
