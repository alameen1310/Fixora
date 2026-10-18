import { lazy, Suspense } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import ScrollToTop from './components/ScrollToTop.jsx'
import PwaControls from './components/PwaControls.jsx'
import AuthenticatedAppShell from './components/AuthenticatedAppShell.jsx'
import { ToastProvider } from './components/ToastProvider.jsx'
import LandingPage from './pages/LandingPage.jsx'
import ProtectedRoute from './components/ProtectedRoute.jsx'
import { AuthProvider } from './context/AuthContext.jsx'

const CustomerSignupPage = lazy(() => import('./pages/CustomerSignupPage.jsx'))
const ProviderSignupPage = lazy(() => import('./pages/ProviderSignupPage.jsx'))
const AuthPage = lazy(() => import('./pages/AuthPage.jsx'))
const AuthCallbackPage = lazy(() => import('./pages/AuthCallbackPage.jsx'))
const AccountTypePage = lazy(() => import('./pages/AccountTypePage.jsx'))
const OnboardingPage = lazy(() => import('./pages/OnboardingPage.jsx'))
const AccountHomePage = lazy(() => import('./pages/AccountHomePage.jsx'))
const DiscoverPage = lazy(() => import('./pages/DiscoverPage.jsx'))
const ActivityPage = lazy(() => import('./pages/ActivityPage.jsx'))
const ProfilePage = lazy(() => import('./pages/ProfilePage.jsx'))
const ProfessionalProfilePage = lazy(() => import('./pages/ProfessionalProfilePage.jsx'))

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <ToastProvider>
          <ScrollToTop />
          <PwaControls />
          <Suspense fallback={<main className="account-state"><p role="status">Loading Fixora…</p></main>}>
            <Routes>
            <Route element={<LandingPage />} path="/" />
            <Route element={<Navigate replace to="/signup/customer" />} path="/customer" />
            <Route element={<CustomerSignupPage />} path="/signup/customer" />
            <Route element={<ProviderSignupPage />} path="/signup/provider" />
            <Route element={<AuthPage />} path="/auth/login" />
            <Route element={<AuthPage mode="forgot" />} path="/auth/forgot-password" />
            <Route element={<AuthPage mode="reset" />} path="/auth/reset-password" />
            <Route element={<AuthCallbackPage />} path="/auth/callback" />
            <Route element={<ProtectedRoute onboarding><AccountTypePage /></ProtectedRoute>} path="/onboarding/account-type" />
            <Route element={<ProtectedRoute onboarding><OnboardingPage audience="customer" /></ProtectedRoute>} path="/onboarding/customer" />
            <Route element={<ProtectedRoute onboarding><OnboardingPage audience="provider" /></ProtectedRoute>} path="/onboarding/provider" />
            <Route element={<ProtectedRoute><AuthenticatedAppShell /></ProtectedRoute>} path="/app">
              <Route element={<AccountHomePage />} index />
              <Route element={<DiscoverPage />} path="discover" />
              <Route element={<ActivityPage />} path="activity" />
              <Route element={<ProfilePage />} path="profile" />
              <Route element={<ProfessionalProfilePage />} path="professionals/:professionalId" />
            </Route>
            <Route element={<Navigate replace to="/" />} path="*" />
            </Routes>
          </Suspense>
        </ToastProvider>
      </AuthProvider>
    </BrowserRouter>
  )
}
