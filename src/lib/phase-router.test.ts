import { describe, it, expect } from 'vitest'
import { routePhase } from './phase-router'

const fixedNow = new Date('2026-05-30T12:00:00Z')

describe('routePhase', () => {
  it('NA dentro de 30 dias → defesa_previa válida', () => {
    const r = routePhase({
      tipo_notificacao: 'NA',
      data_notificacao: '2026-05-10',
      now: fixedNow,
    })
    expect(r.fase).toBe('defesa_previa')
    expect(r.prazo_status).toBe('valido')
    expect(r.dias_restantes).toBe(10)
  })

  it('NA com prazo vencido → fase vencido', () => {
    const r = routePhase({
      tipo_notificacao: 'NA',
      data_notificacao: '2026-04-01',
      now: fixedNow,
    })
    expect(r.fase).toBe('vencido')
    expect(r.prazo_status).toBe('vencido')
  })

  it('NP dentro de 30 dias → jari válida', () => {
    const r = routePhase({
      tipo_notificacao: 'NP',
      data_notificacao: '2026-05-20',
      now: fixedNow,
    })
    expect(r.fase).toBe('jari')
    expect(r.prazo_status).toBe('valido')
    expect(r.dias_restantes).toBe(20)
  })

  it('NP com prazo vencido → fase vencido', () => {
    const r = routePhase({
      tipo_notificacao: 'NP',
      data_notificacao: '2026-03-01',
      now: fixedNow,
    })
    expect(r.fase).toBe('vencido')
  })

  it('tipo desconhecido → vencido com motivo', () => {
    const r = routePhase({
      tipo_notificacao: 'desconhecido',
      data_notificacao: '2026-05-20',
      now: fixedNow,
    })
    expect(r.fase).toBe('vencido')
    expect(r.motivo).toMatch(/tipo/i)
  })

  it('data ausente → vencido com motivo', () => {
    const r = routePhase({
      tipo_notificacao: 'NA',
      data_notificacao: null,
      now: fixedNow,
    })
    expect(r.fase).toBe('vencido')
    expect(r.motivo).toMatch(/data/i)
  })

  it('exatamente no último dia (dia 30) → válido', () => {
    const r = routePhase({
      tipo_notificacao: 'NA',
      data_notificacao: '2026-04-30',
      now: fixedNow,
    })
    expect(r.fase).toBe('defesa_previa')
    expect(r.dias_restantes).toBe(0)
  })
})
