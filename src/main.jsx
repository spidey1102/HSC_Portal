import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import PasswordGate from './components/PasswordGate.jsx'
import { AuthProvider } from './components/AuthContext.jsx'
import { SyncProvider } from './components/SyncContext.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <PasswordGate>
      <AuthProvider>
        <SyncProvider>
          <App />
        </SyncProvider>
      </AuthProvider>
    </PasswordGate>
  </StrictMode>,
)
