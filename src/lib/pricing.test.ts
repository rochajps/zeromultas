import { describe, it, expect } from 'vitest'
import { pickTier, formatBRL, type PriceTierLike } from './pricing'

const tiers: PriceTierLike[] = [
  { id: 1, faixa: 'Leve', valor_multa_min_centavos: 0, valor_multa_max_centavos: 13099, preco_centavos: 4700, ativo: true },
  { id: 2, faixa: 'Média', valor_multa_min_centavos: 13100, valor_multa_max_centavos: 19599, preco_centavos: 6700, ativo: true },
  { id: 3, faixa: 'Grave', valor_multa_min_centavos: 19600, valor_multa_max_centavos: 29399, preco_centavos: 9700, ativo: true },
  { id: 4, faixa: 'Gravíssima', valor_multa_min_centavos: 29400, valor_multa_max_centavos: 999999999, preco_centavos: 14700, ativo: true },
]

describe('pickTier', () => {
  it('multa baixa cai em Leve', () => {
    const r = pickTier(13000, tiers)
    expect(r?.tier.faixa).toBe('Leve')
    expect(r?.preco_centavos).toBe(4700)
  })

  it('valor no limite superior', () => {
    expect(pickTier(13099, tiers)?.tier.faixa).toBe('Leve')
    expect(pickTier(13100, tiers)?.tier.faixa).toBe('Média')
  })

  it('Gravíssima cobre valores altos', () => {
    expect(pickTier(50000, tiers)?.tier.faixa).toBe('Gravíssima')
    expect(pickTier(1_000_000_00, tiers)?.tier.faixa).toBe('Gravíssima')
  })

  it('ignora tiers inativos', () => {
    const desativada = tiers.map((t) => (t.faixa === 'Leve' ? { ...t, ativo: false } : t))
    const r = pickTier(5000, desativada)
    expect(r?.tier.faixa).not.toBe('Leve')
  })

  it('valor negativo → null', () => {
    expect(pickTier(-100, tiers)).toBeNull()
  })
})

describe('formatBRL', () => {
  it('formata centavos em BRL', () => {
    expect(formatBRL(4700)).toMatch(/47,00/)
    expect(formatBRL(14700)).toMatch(/147,00/)
  })
})
