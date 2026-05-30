// Lógica pura de seleção de faixa de preço a partir do valor da multa.

export interface PriceTierLike {
  id: number
  faixa: string
  valor_multa_min_centavos: number
  valor_multa_max_centavos: number
  preco_centavos: number
  ativo: boolean
}

export interface PricingResult {
  tier: PriceTierLike
  preco_centavos: number
}

export function pickTier(valor_multa_centavos: number, tiers: PriceTierLike[]): PricingResult | null {
  if (!Number.isFinite(valor_multa_centavos) || valor_multa_centavos < 0) return null
  const ativos = tiers.filter((t) => t.ativo)
  const match = ativos.find(
    (t) => valor_multa_centavos >= t.valor_multa_min_centavos && valor_multa_centavos <= t.valor_multa_max_centavos,
  )
  if (!match) {
    // fallback: maior faixa ativa
    const maior = ativos.reduce<PriceTierLike | null>((acc, t) => {
      if (!acc) return t
      return t.valor_multa_max_centavos > acc.valor_multa_max_centavos ? t : acc
    }, null)
    return maior ? { tier: maior, preco_centavos: maior.preco_centavos } : null
  }
  return { tier: match, preco_centavos: match.preco_centavos }
}

export function formatBRL(centavos: number): string {
  return (centavos / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}
