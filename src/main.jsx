import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import './styles/classical.css'
import './styles/reader.css'
import App from './App.jsx'
import { AuthProvider } from './components/AuthContext.jsx'
import { SyncProvider } from './components/SyncContext.jsx'
import GoogleSignInGate from './components/GoogleSignInGate.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <AuthProvider>
      <GoogleSignInGate>
        <SyncProvider>
          <App />
        </SyncProvider>
      </GoogleSignInGate>
    </AuthProvider>
  </StrictMode>,
)
