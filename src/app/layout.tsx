import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Zero Multas — Recurso administrativo de multa em minutos',
  description:
    'Envie a foto da sua multa, descubra na hora se vale recorrer e receba um recurso jurídico em PDF pronto pra protocolar. Pague só se for viável.',
  metadataBase: new URL(process.env.PUBLIC_BASE_URL ?? 'https://zeromultas.pro'),
  openGraph: {
    title: 'Zero Multas',
    description: 'Recurso administrativo de multa em minutos. Análise grátis.',
    type: 'website',
    locale: 'pt_BR',
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body className={`${inter.className} bg-slate-50 text-slate-900 antialiased`}>{children}</body>
    </html>
  )
}
