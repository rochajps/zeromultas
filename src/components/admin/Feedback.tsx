'use client'

import { useFormStatus } from 'react-dom'

export function SubmitButton({
  children,
  pendingChildren,
  className,
  variant = 'primary',
}: {
  children: React.ReactNode
  pendingChildren?: React.ReactNode
  className?: string
  variant?: 'primary' | 'success' | 'ghost'
}) {
  const { pending } = useFormStatus()
  const base = 'inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition disabled:cursor-wait disabled:opacity-70'
  const variants = {
    primary: 'bg-blue-600 text-white hover:bg-blue-700',
    success: 'bg-emerald-600 text-white hover:bg-emerald-700',
    ghost: 'border border-slate-300 bg-white text-slate-700 hover:bg-slate-50',
  }
  return (
    <button type="submit" disabled={pending} className={`${base} ${variants[variant]} ${className ?? ''}`}>
      {pending && (
        <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
      )}
      {pending ? (pendingChildren ?? 'Processando…') : children}
    </button>
  )
}

export function FlashMessage({ type, text }: { type: 'success' | 'error' | 'info'; text: string }) {
  const colors = {
    success: 'border-emerald-200 bg-emerald-50 text-emerald-800',
    error: 'border-red-200 bg-red-50 text-red-800',
    info: 'border-blue-200 bg-blue-50 text-blue-800',
  }
  const icon = type === 'success' ? '✓' : type === 'error' ? '✕' : 'ℹ'
  return (
    <div className={`rounded-lg border px-4 py-3 text-sm ${colors[type]}`}>
      <strong className="mr-2">{icon}</strong>
      {text}
    </div>
  )
}
