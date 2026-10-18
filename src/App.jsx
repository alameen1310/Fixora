import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import ScrollToTop from './components/ScrollToTop.jsx'
import PwaControls from './components/PwaControls.jsx'
import LandingPage from './pages/LandingPage.jsx'
import CustomerSignupPage from './pages/CustomerSignupPage.jsx'
import ProviderSignupPage from './pages/ProviderSignupPage.jsx'

export default function App() {
  return (
    <BrowserRouter>
      <ScrollToTop />
      <PwaControls />
      <Routes>
        <Route element={<LandingPage />} path="/" />
        <Route element={<CustomerSignupPage />} path="/signup/customer" />
        <Route element={<ProviderSignupPage />} path="/signup/provider" />
        <Route element={<Navigate replace to="/" />} path="*" />
      </Routes>
    </BrowserRouter>
  )
}
