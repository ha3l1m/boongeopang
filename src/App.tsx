import { useEffect } from 'react'
import { Navigate, Outlet, Route, Routes, useLocation } from 'react-router-dom'
import { useAuth } from './state/AuthContext'
import { remoteMode, startSync } from './services/remoteSync'
import { RobotLinkBanner } from './components/RobotLinkBanner'
import { TabBar } from './components/TabBar'
import { LoginPage } from './pages/LoginPage'
import { MenuPage } from './pages/MenuPage'
import { ConfirmPage } from './pages/ConfirmPage'
import { OrderStatusPage } from './pages/OrderStatusPage'
import { HistoryPage } from './pages/HistoryPage'
import { VoicePage } from './pages/VoicePage'
import { AdminLoginPage } from './pages/admin/AdminLoginPage'
import { AdminOrdersPage } from './pages/admin/AdminOrdersPage'
import { isAdminLoggedIn } from './services/adminAuth'

function RequireAuth() {
  const { user } = useAuth()
  return user ? <Outlet /> : <Navigate to="/login" replace />
}

function RequireAdmin() {
  return isAdminLoggedIn() ? <Outlet /> : <Navigate to="/admin/login" replace />
}

function TabLayout() {
  return (
    <>
      <Outlet />
      <TabBar />
    </>
  )
}

export function App() {
  const { user } = useAuth()
  const isAdmin = useLocation().pathname.startsWith('/admin')
  const remote = remoteMode()
  useEffect(() => (remote ? startSync() : undefined), [remote])
  return (
    <div className={isAdmin ? 'app app--admin' : 'app'}>
      {remote && <RobotLinkBanner />}
      <Routes>
        <Route path="/login" element={user ? <Navigate to="/" replace /> : <LoginPage />} />
        <Route element={<RequireAuth />}>
          <Route element={<TabLayout />}>
            <Route path="/" element={<MenuPage />} />
            <Route path="/orders" element={<HistoryPage />} />
          </Route>
          <Route path="/voice" element={<VoicePage />} />
          <Route path="/confirm" element={<ConfirmPage />} />
          <Route path="/orders/:id" element={<OrderStatusPage />} />
        </Route>
        <Route path="/admin/login" element={<AdminLoginPage />} />
        <Route element={<RequireAdmin />}>
          <Route path="/admin" element={<AdminOrdersPage />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </div>
  )
}
