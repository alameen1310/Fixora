import { useAuth } from '../context/AuthContext.jsx'
import OnboardingPage from './OnboardingPage.jsx'

export default function ProfileEditPage() {
  const { profile } = useAuth()
  return <OnboardingPage audience={profile?.account_type === 'provider' ? 'provider' : 'customer'} editMode />
}
