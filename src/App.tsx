import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useEffect } from 'react'
import { BrowserRouter, Link, Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { Toaster } from 'sonner'
import { emitBridgeEvent, isEmbedLayout, isInIframe } from './lib/embedBridge'
import { DisplayPage } from './pages/DisplayPage'
import { EmbedDemoPage } from './pages/EmbedDemoPage'
import { HomePage } from './pages/HomePage'
import { HostLobbyPage } from './pages/HostLobbyPage'
import { HostPage } from './pages/HostPage'
import { JoinPage } from './pages/JoinPage'
import { RoomPage } from './pages/RoomPage'
import { TermsPage } from './pages/TermsPage'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
    },
  },
})

function AppShell() {
  const location = useLocation()
  const embedded = isEmbedLayout(location.search)
  const isStandaloneScreen =
    location.pathname === '/embed-demo' ||
    location.pathname === '/host' ||
    location.pathname.startsWith('/display/') ||
    location.pathname.startsWith('/host/') ||
    location.pathname.startsWith('/room/')
  const showFooter = !embedded && !isStandaloneScreen

  useEffect(() => {
    emitBridgeEvent({
      source: 'quizbutton',
      type: 'quizbutton:ready',
      payload: { embedded: embedded || isInIframe() },
    })
  }, [embedded])

  return (
    <div className="flex min-h-screen flex-col">
      <main className="flex-1">
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/join/:roomId" element={<JoinPage />} />
          <Route path="/room/:roomId" element={<RoomPage />} />
          <Route path="/display/:roomId" element={<DisplayPage />} />
          <Route path="/host" element={<HostLobbyPage />} />
          <Route path="/host/:roomId" element={<HostPage />} />
          <Route path="/terms" element={<TermsPage />} />
          <Route path="/embed-demo" element={<EmbedDemoPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>

      {showFooter && (
        <footer className="mt-auto border-t border-[#cbd5f5] bg-[#f3f6ff] py-4 text-[#434d7e]">
          <div className="container mx-auto flex items-center justify-center gap-2 px-4 text-sm">
            <span className="font-semibold text-[#0b1437]">
              © {new Date().getFullYear()} ISSC Quiz Buzzer
            </span>
            <span className="text-[#8e9cd6]">•</span>
            <Link to="/terms" className="font-medium text-[#2a55d6] transition-colors hover:text-[#0d2be3]">
              Syarat &amp; Ketentuan
            </Link>
          </div>
        </footer>
      )}

      <Toaster position="bottom-right" richColors />
    </div>
  )
}

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AppShell />
      </BrowserRouter>
    </QueryClientProvider>
  )
}
