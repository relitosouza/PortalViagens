import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Aprovação de Viagens — Osasco',
  description: 'Sistema de aprovação de despesas com viagem da Prefeitura de Osasco',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body className="min-h-screen bg-gray-50 font-sans">{children}</body>
    </html>
  )
}
