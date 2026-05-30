import Link from 'next/link'

export const metadata = { title: 'Termos de Uso — Zero Multas' }

export default function TermosPage() {
  return (
    <main className="min-h-screen bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-4">
          <Link href="/" className="flex items-center gap-2">
            <span className="inline-block h-7 w-7 rounded-md bg-blue-600" />
            <span className="text-lg font-semibold tracking-tight">Zero Multas</span>
          </Link>
        </div>
      </header>

      <article className="mx-auto max-w-3xl px-4 py-10 text-slate-800">
        <h1 className="text-3xl font-bold tracking-tight">Termos de Uso</h1>
        <p className="mt-1 text-sm text-slate-500">Última atualização: 30/05/2026</p>

        <p className="mt-6 leading-relaxed">
          Estes Termos regem o uso do site <strong>zeromultas.pro</strong> e a contratação do serviço de geração
          de recurso administrativo de multa de trânsito.
        </p>

        <Section title="1. O que é o serviço">
          <p>
            A Zero Multas elabora, por meio de inteligência artificial e modelos jurídicos, peças administrativas
            (defesa prévia e recurso à JARI) contra notificações de multa de trânsito, com base nos dados extraídos da
            notificação enviada e nas informações fornecidas pelo condutor.
          </p>
          <p>
            <strong>O serviço é exclusivamente administrativo</strong> — não inclui representação processual judicial,
            recurso ao CETRAN, parecer técnico personalizado por advogado ou atendimento presencial.
          </p>
        </Section>

        <Section title="2. Sem garantia de êxito">
          <p>
            O serviço prepara um recurso fundamentado, mas <strong>não garantimos o cancelamento da multa</strong>. A
            decisão final cabe ao órgão autuador (defesa prévia) ou à JARI (recurso de penalidade). O sucesso de qualquer
            recurso administrativo depende da existência efetiva de vícios, do mérito do caso e do entendimento do órgão
            julgador.
          </p>
          <p>
            Quando o sistema não identifica vício formal forte, comunicamos isso de forma transparente antes da contratação.
            Você decide se contrata mesmo assim.
          </p>
        </Section>

        <Section title="3. O que você precisa fornecer">
          <ul className="list-disc space-y-2 pl-6">
            <li>Foto ou PDF legível da notificação (NA ou NP);</li>
            <li>Foto legível da sua CNH (frente);</li>
            <li>Endereço completo;</li>
            <li>Motivo pelo qual considera a multa injusta;</li>
            <li>Aceitar a <Link href="/privacidade" className="text-blue-600 underline">Política de Privacidade</Link>.</li>
          </ul>
          <p>
            Você é responsável pela <strong>veracidade</strong> das informações prestadas. Dados falsos podem inviabilizar
            o recurso e descaracterizar o serviço.
          </p>
        </Section>

        <Section title="4. Preço e pagamento">
          <p>
            O preço é calculado pela faixa do valor da multa. O valor exato é exibido <strong>antes</strong> de qualquer
            cobrança, na tela de checkout. O pagamento é feito via PIX, processado pela TriboPay.
          </p>
          <p>
            Em caso de prazo administrativo já encerrado, <strong>não cobramos</strong> — informamos a situação e o usuário
            decide o próximo passo (CETRAN ou via judicial com advogado).
          </p>
        </Section>

        <Section title="5. Entrega">
          <p>
            Após confirmação do pagamento, o sistema gera o recurso em PDF e libera o download na própria tela do checkout.
            A entrega é digital e imediata (em regra, em até 1 minuto após a confirmação do PIX).
          </p>
          <p>
            O recurso entregue deve ser <strong>protocolado por você</strong> no órgão autuador ou via canal eletrônico do
            DETRAN/CET correspondente, dentro do prazo legal.
          </p>
        </Section>

        <Section title="6. Direito de arrependimento e reembolso">
          <p>
            Por se tratar de produto digital personalizado e gerado sob demanda no momento da contratação, o direito de
            arrependimento previsto no art. 49 do CDC <strong>não se aplica</strong> após a entrega do PDF.
          </p>
          <p>
            Se o sistema falhar na entrega por motivo técnico de nossa parte (ex: PDF não gerado por erro do servidor),
            ressarcimos integralmente em até 7 dias úteis, mediante solicitação por e-mail.
          </p>
        </Section>

        <Section title="7. Uso da inteligência artificial">
          <p>
            A peça é produzida por modelos de linguagem (Anthropic Claude). A IA opera dentro do escopo do prompt
            jurídico mantido pela equipe e dos dados fornecidos por você. O conteúdo é revisável a qualquer momento por
            você, antes do protocolo. <strong>Não substitui o aconselhamento de advogado</strong> em casos complexos.
          </p>
        </Section>

        <Section title="8. Conduta esperada do usuário">
          <ul className="list-disc space-y-2 pl-6">
            <li>Não usar o site para fins ilícitos;</li>
            <li>Não tentar contornar limites técnicos (rate limit) ou autenticação;</li>
            <li>Não enviar conteúdo de terceiros sem autorização;</li>
            <li>Não automatizar consultas em massa contra o serviço.</li>
          </ul>
        </Section>

        <Section title="9. Limitação de responsabilidade">
          <p>
            A responsabilidade total da Zero Multas em razão deste serviço é limitada ao valor pago pelo usuário no pedido
            específico. Não respondemos por: decisões dos órgãos autuadores; perda de prazo por inércia do usuário; uso do
            recurso fora da finalidade contratada; falhas alheias à nossa infraestrutura.
          </p>
        </Section>

        <Section title="10. Alterações dos Termos">
          <p>
            Estes Termos podem ser atualizados periodicamente. A data da última atualização consta no topo. Alterações
            relevantes são comunicadas no site antes de produzirem efeito.
          </p>
        </Section>

        <Section title="11. Foro">
          <p>
            Aplica-se a legislação brasileira. Eventuais disputas serão dirimidas no foro da comarca do consumidor, nos
            termos do CDC.
          </p>
        </Section>

        <div className="mt-12 rounded-lg bg-slate-100 p-4 text-sm text-slate-600">
          Veja também a <Link href="/privacidade" className="text-blue-600 underline">Política de Privacidade</Link>.
        </div>
      </article>
    </main>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-8">
      <h2 className="text-lg font-bold tracking-tight text-slate-900">{title}</h2>
      <div className="mt-3 space-y-3 leading-relaxed text-slate-700">{children}</div>
    </section>
  )
}
