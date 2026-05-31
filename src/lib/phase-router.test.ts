import { describe, it, expect } from 'vitest'
import { routePhase } from './phase-router'

const fixedNow = new Date('2026-05-30T12:00:00Z')

describe('routePhase', () => {
  it('NA dentro de 30 dias → defesa_previa válida', () => {
    const r = routePhase({ tipo_notificacao: 'NA', data_notificacao: '2026-05-10', now: fixedNow })
    expect(r.fase).toBe('defesa_previa')
    expect(r.prazo_status).toBe('valido')
    expect(r.dias_restantes).toBe(10)
  })

  it('NA com prazo passado → defesa_previa MAS prazo_status vencido (info)', () => {
    const r = routePhase({ tipo_notificacao: 'NA', data_notificacao: '2026-04-01', now: fixedNow })
    expect(r.fase).toBe('defesa_previa')
    expect(r.prazo_status).toBe('vencido')
  })

  it('NP dentro de 30 dias → jari válida', () => {
    const r = routePhase({ tipo_notificacao: 'NP', data_notificacao: '2026-05-20', now: fixedNow })
    expect(r.fase).toBe('jari')
    expect(r.prazo_status).toBe('valido')
  })

  it('NP com prazo passado → jari mas prazo vencido', () => {
    const r = routePhase({ tipo_notificacao: 'NP', data_notificacao: '2026-03-01', now: fixedNow })
    expect(r.fase).toBe('jari')
    expect(r.prazo_status).toBe('vencido')
  })

  it('tipo desconhecido → defesa_previa por default', () => {
    const r = routePhase({ tipo_notificacao: 'desconhecido', data_notificacao: '2026-05-20', now: fixedNow })
    expect(r.fase).toBe('defesa_previa')
  })

  it('data ausente → defesa_previa sem prazo', () => {
    const r = routePhase({ tipo_notificacao: 'NA', data_notificacao: null, now: fixedNow })
    expect(r.fase).toBe('defesa_previa')
    expect(r.prazo_limite).toBeNull()
  })
})
