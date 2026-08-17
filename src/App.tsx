import { useEffect } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AppLayout } from '@/components/layout/AppLayout'
import { HomePage } from '@/pages/HomePage'
import { SessionPage } from '@/pages/SessionPage'
import { MistakesPage } from '@/pages/MistakesPage'
import { StatsPage } from '@/pages/StatsPage'
import { SettingsPage } from '@/pages/SettingsPage'
import { ConversationsPage, ScenarioPage } from '@/pages/ConversationsPage'
import { TravelPage, TravelPackPage } from '@/pages/TravelPage'
import { AlphabetTrainingPage } from '@/pages/training/AlphabetTrainingPage'
import { VocabularyTrainingPage } from '@/pages/training/VocabularyTrainingPage'
import { ListeningTrainingPage } from '@/pages/training/ListeningTrainingPage'
import { PronunciationTrainingPage } from '@/pages/training/PronunciationTrainingPage'
import { SentencesTrainingPage } from '@/pages/training/SentencesTrainingPage'
import { useAppStore } from '@/store/appStore'

export default function App() {
  const ready = useAppStore((state) => state.ready)
  const load = useAppStore((state) => state.load)

  useEffect(() => {
    void load()
  }, [load])

  if (!ready) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-bg">
        <span className="cyr text-4xl font-black" lang="ru">
          РУССКИЙ
        </span>
        <div className="h-7 w-7 animate-spin rounded-full border-2 border-border border-t-accent" />
      </div>
    )
  }

  return (
    <BrowserRouter>
      <AppLayout>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/sessione" element={<SessionPage />} />

          <Route path="/allenamento/alfabeto" element={<AlphabetTrainingPage />} />
          <Route path="/allenamento/vocabolario" element={<VocabularyTrainingPage />} />
          <Route path="/allenamento/ascolto" element={<ListeningTrainingPage />} />
          <Route path="/allenamento/pronuncia" element={<PronunciationTrainingPage />} />
          <Route path="/allenamento/frasi" element={<SentencesTrainingPage />} />

          <Route path="/conversazioni" element={<ConversationsPage />} />
          <Route path="/scenari/:id" element={<ScenarioPage />} />

          <Route path="/viaggio" element={<TravelPage />} />
          <Route path="/viaggio/:category" element={<TravelPackPage />} />

          <Route path="/errori" element={<MistakesPage />} />
          <Route path="/statistiche" element={<StatsPage />} />
          <Route path="/impostazioni" element={<SettingsPage />} />

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AppLayout>
    </BrowserRouter>
  )
}
