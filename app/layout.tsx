import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Aprovação de Viagens — Osasco',
  description: 'Sistema de aprovação de despesas com viagem da Prefeitura de Osasco',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <head>
        <link
          href="https://fonts.googleapis.com/css2?family=Public+Sans:wght@300;400;500;600;700;800&display=swap"
          rel="stylesheet"
        />
        <link
          href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200"
          rel="stylesheet"
        />
      </head>
      <body className="font-sans bg-[#f6f6f8] text-slate-900">{children}</body>
    </html>
  )
}
