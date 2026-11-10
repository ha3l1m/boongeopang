import { useEffect } from 'react'
import { Navigate, Outlet, Route, Routes, useLocation } from 'react-router-dom'
import { useAuth } from './state/AuthContext'
import { remoteMode, startSync } from './services/remoteSync'
import { RobotLinkBanner } from './components/RobotLinkBanner'
import { TabBar } from './components/TabBar'
import { LoginPage, loginDestination } from './pages/LoginPage'
import { MenuPage } from './pages/MenuPage'
import { VoiceOrderPage } from './pages/VoiceOrderPage'
import { ConfirmPage } from './pages/ConfirmPage'
import { OrderStatusPage } from './pages/OrderStatusPage'
import { HistoryPage } from './pages/HistoryPage'
import { VoicePage } from './pages/VoicePage'
import { AdminLoginPage } from './pages/admin/AdminLoginPage'
import { AdminOrdersPage } from './pages/admin/AdminOrdersPage'
import { isAdminLoggedIn } from './services/adminAuth'

/** After signing in, go to the page the splash button asked for (passed in location state), default the menu. */
function LoginRoute() {
  const { user } = useAuth()
  return user ? <Navigate to={loginDestination()} replace /> : <LoginPage />
}

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
  const isAdmin = useLocation().pathname.startsWith('/admin')
  const remote = remoteMode()
  useEffect(() => (remote ? startSync() : undefined), [remote])
  return (
    <div className={isAdmin ? 'app app--admin' : 'app'}>
      {remote && <RobotLinkBanner />}
      <Routes>
        <Route path="/login" element={<LoginRoute />} />
        <Route element={<RequireAuth />}>
          <Route element={<TabLayout />}>
            <Route path="/" element={<MenuPage />} />
            <Route path="/orders" element={<HistoryPage />} />
          </Route>
          <Route path="/voice" element={<VoicePage />} />
          <Route path="/confirm" element={<ConfirmPage />} />
          <Route path="/orders/:id" element={<OrderStatusPage />} />
        </Route>
        <Route path="/voice" element={<VoiceOrderPage />} />
        <Route path="/admin/login" element={<AdminLoginPage />} />
        <Route element={<RequireAdmin />}>
          <Route path="/admin" element={<AdminOrdersPage />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </div>
  )
}
