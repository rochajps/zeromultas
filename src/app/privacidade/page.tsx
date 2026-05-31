import Link from 'next/link'

export const metadata = { title: 'Política de Privacidade — Zero Multas' }

export default function PrivacidadePage() {
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
        <h1 className="text-3xl font-bold tracking-tight">Política de Privacidade</h1>
        <p className="mt-1 text-sm text-slate-500">Última atualização: 30/05/2026</p>

        <p className="mt-6 leading-relaxed">
          Esta Política descreve como a Zero Multas (&quot;nós&quot;) trata seus dados pessoais quando você utiliza o site
          <strong> zeromultas.pro</strong> para contratar a elaboração de recurso administrativo de multa de trânsito.
          Operamos em conformidade com a Lei Geral de Proteção de Dados (Lei 13.709/2018 — LGPD).
        </p>

        <Section title="1. Quem somos">
          <p>
            Zero Multas é um serviço de geração de recursos administrativos de multa de trânsito por inteligência
            artificial, em fase administrativa (defesa prévia e recurso à JARI). Para questões de privacidade,
            o contato é o e-mail <a className="text-blue-600 underline" href="mailto:zeromultasgo@gmail.com">zeromultasgo@gmail.com</a>.
          </p>
        </Section>

        <Section title="2. Dados que coletamos">
          <ul className="list-disc space-y-2 pl-6">
            <li>
              <strong>Notificação de multa</strong> (imagem ou PDF): processada em memória pela IA para extrair os dados
              necessários ao recurso. <strong>A imagem/PDF original é descartada imediatamente após a extração</strong> e
              <strong> não é armazenada</strong>.
            </li>
            <li>
              <strong>Dados da CNH</strong>: você envia uma foto da CNH para que o sistema extraia o nome, CPF e número
              da CNH. <strong>A imagem da CNH é descartada</strong> imediatamente após a extração — guardamos apenas os
              três campos textuais.
            </li>
            <li>
              <strong>Endereço</strong>: informado por você para qualificação no recurso.
            </li>
            <li>
              <strong>Motivo da injustiça</strong>: texto livre escrito por você para fundamentação da peça.
            </li>
            <li>
              <strong>Dados de uso e marketing</strong>: parâmetros UTM (origem, mídia, campanha) e um <em>hash</em> do seu
              endereço IP (não armazenamos o IP em texto claro) para métricas de funil. User-agent do navegador.
            </li>
            <li>
              <strong>Dados de pagamento</strong>: nome e CPF informados na CNH são repassados ao provedor de pagamento
              (TriboPay) para gerar a cobrança PIX. Não armazenamos chave Pix, número de cartão ou senha.
            </li>
          </ul>
        </Section>

        <Section title="3. Finalidades e bases legais">
          <ul className="list-disc space-y-2 pl-6">
            <li>
              <strong>Execução de contrato</strong> (art. 7º, V, LGPD): processar seu pedido, gerar o recurso em PDF,
              receber pagamento e entregar o produto.
            </li>
            <li>
              <strong>Cumprimento de obrigação legal</strong> (art. 7º, II): manter registros fiscais e contábeis das
              transações pelo prazo exigido pela legislação.
            </li>
            <li>
              <strong>Legítimo interesse</strong> (art. 7º, IX): métricas internas de funil (volume e taxa de conversão)
              com IP <em>hash</em>; nenhum dado pessoal é compartilhado para esse fim.
            </li>
          </ul>
        </Section>

        <Section title="4. Com quem compartilhamos">
          <ul className="list-disc space-y-2 pl-6">
            <li>
              <strong>Anthropic (Claude API)</strong>: a imagem e os textos enviados são processados pelos modelos da
              Anthropic apenas para extração e geração do recurso. A Anthropic mantém política de não treinar modelos com
              dados de API.
            </li>
            <li>
              <strong>TriboPay</strong>: provedor brasileiro de pagamento. Recebe seu nome e CPF para emissão da cobrança PIX.
            </li>
            <li>
              <strong>Não vendemos</strong> seus dados a terceiros. Não compartilhamos com fins de marketing externo.
            </li>
          </ul>
        </Section>

        <Section title="5. Onde os dados ficam">
          <p>
            Os dados textuais (nome, CPF, CNH, endereço, motivo, dados extraídos da multa) são armazenados em servidor
            próprio no Brasil/Europa (VPS dedicada), com acesso restrito por autenticação. Imagens da multa e da CNH são
            descartadas após a extração e <strong>não persistem em disco</strong>.
          </p>
        </Section>

        <Section title="6. Por quanto tempo">
          <p>
            Mantemos os dados do pedido enquanto a relação contratual existir e pelo período exigido pela legislação
            fiscal e tributária (em regra, 5 anos a contar do final do exercício). Após esse prazo, os dados são apagados
            ou anonimizados.
          </p>
        </Section>

        <Section title="7. Seus direitos (LGPD)">
          <p>Você pode, a qualquer momento, solicitar:</p>
          <ul className="list-disc space-y-2 pl-6">
            <li>Confirmação da existência de tratamento;</li>
            <li>Acesso aos dados;</li>
            <li>Correção de dados incompletos, inexatos ou desatualizados;</li>
            <li>Anonimização, bloqueio ou eliminação de dados desnecessários ou tratados em desconformidade;</li>
            <li>Portabilidade dos dados;</li>
            <li>Eliminação dos dados pessoais tratados com o seu consentimento;</li>
            <li>Informação sobre as entidades com as quais compartilhamos seus dados;</li>
            <li>Revogação do consentimento.</li>
          </ul>
          <p className="mt-3">
            Para exercer qualquer um desses direitos, escreva para{' '}
            <a className="text-blue-600 underline" href="mailto:zeromultasgo@gmail.com">zeromultasgo@gmail.com</a>.
            Responderemos em até 15 dias.
          </p>
        </Section>

        <Section title="8. Segurança">
          <p>
            Utilizamos HTTPS, hash de senhas com bcrypt, isolamento por usuário no sistema operacional e logs com IP
            anonimizado. Nenhum sistema é 100% seguro, mas aplicamos as melhores práticas razoáveis para o tipo de dado
            tratado.
          </p>
        </Section>

        <Section title="9. Cookies">
          <p>
            Utilizamos um único cookie de sessão (<code>zm_admin</code>) restrito ao painel administrativo. O site público
            não utiliza cookies de rastreamento ou publicidade.
          </p>
        </Section>

        <Section title="10. Alterações desta Política">
          <p>
            Podemos atualizar esta Política quando necessário. A data da última atualização aparece no topo. Mudanças
            relevantes serão informadas no próprio site antes de produzirem efeito.
          </p>
        </Section>

        <div className="mt-12 rounded-lg bg-slate-100 p-4 text-sm text-slate-600">
          Veja também os <Link href="/termos" className="text-blue-600 underline">Termos de Uso</Link>.
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
