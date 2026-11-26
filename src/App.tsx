import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useEffect } from 'react'
import { BrowserRouter, Link, Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { Toaster } from 'sonner'
import { emitBridgeEvent, isEmbedLayout, isInIframe } from './lib/embedBridge'
import { EmbedDemoPage } from './pages/EmbedDemoPage'
import { HomePage } from './pages/HomePage'
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
  const isEmbedDemo = location.pathname === '/embed-demo'
  const showFooter = !embedded && !isEmbedDemo

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
          <Route path="/terms" element={<TermsPage />} />
          <Route path="/embed-demo" element={<EmbedDemoPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>

      {showFooter && (
        <footer className="mt-auto border-t border-white/20 bg-white/10 py-4 text-white backdrop-blur-sm">
          <div className="container mx-auto flex items-center justify-center gap-2 px-4 text-sm">
            <span className="font-medium">© {new Date().getFullYear()} QuizButton.app</span>
            <span className="text-white/60">•</span>
            <Link to="/terms" className="font-medium transition-colors hover:text-white/80">
              Terms &amp; Conditions
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
