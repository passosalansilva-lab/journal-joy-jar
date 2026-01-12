import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { ArticleContent } from "@/components/ArticleComponents";

const Privacy = () => {
  return (
    <div className="min-h-screen bg-background">
      <Header />

      <div className="box-content max-w-[80rem] px-6 md:px-[calc(18vw-10rem)] mx-auto mt-[4rem] mb-[8rem]">
        <header className="mb-[4rem] text-center">
          <h1 className="text-[3.4rem] md:text-[4.2rem] lg:text-[5rem] font-semibold tracking-[-0.01em] leading-[1.2] mb-[1rem]">
            Política de Privacidade
          </h1>
          <p className="text-[1.6rem] text-muted-foreground">
            Última atualização: 10 de janeiro de 2025
          </p>
        </header>

        <ArticleContent>
          <p>
            Na Editorial, levamos sua privacidade a sério. Esta Política de Privacidade
            explica como coletamos, usamos, divulgamos e protegemos suas
            informações quando você visita nosso site.
          </p>

          <h2>Informações que Coletamos</h2>

          <h3>Informações Pessoais</h3>
          <p>
            Podemos coletar informações pessoais que você nos fornece voluntariamente
            quando você:
          </p>
          <ul>
            <li>Assina nossa newsletter</li>
            <li>Envia conteúdo ou nos contata através de formulários</li>
            <li>Cria uma conta em nossa plataforma</li>
            <li>Participa de pesquisas ou promoções</li>
          </ul>
          <p>
            Estas informações podem incluir seu nome, endereço de e-mail e qualquer outra
            informação que você escolher fornecer.
          </p>

          <h3>Informações Coletadas Automaticamente</h3>
          <p>
            Quando você visita nosso site, coletamos automaticamente certas
            informações sobre seu dispositivo, incluindo:
          </p>
          <ul>
            <li>Tipo e versão do navegador</li>
            <li>Sistema operacional</li>
            <li>Endereço IP</li>
            <li>Páginas visitadas e tempo gasto em cada página</li>
            <li>Endereços de sites de referência</li>
          </ul>

          <h2>Como Usamos Suas Informações</h2>
          <p>Usamos as informações que coletamos para:</p>
          <ul>
            <li>Fornecer, manter e melhorar nossos serviços</li>
            <li>Enviar newsletters e atualizações (com seu consentimento)</li>
            <li>Responder a seus comentários, perguntas e solicitações</li>
            <li>Analisar padrões de uso e tendências</li>
            <li>Detectar, prevenir e resolver problemas técnicos</li>
            <li>Cumprir obrigações legais</li>
          </ul>

          <h2>Cookies e Tecnologias de Rastreamento</h2>
          <p>
            Usamos cookies e tecnologias de rastreamento similares para rastrear atividade
            em nosso site e armazenar certas informações. Você pode instruir seu
            navegador a recusar todos os cookies ou indicar quando um cookie está sendo
            enviado. No entanto, se você não aceitar cookies, pode não conseguir
            usar algumas partes do nosso site.
          </p>

          <h3>Tipos de Cookies que Usamos</h3>
          <ul>
            <li>
              <strong>Cookies Essenciais:</strong> Necessários para o funcionamento correto
              do site
            </li>
            <li>
              <strong>Cookies de Análise:</strong> Nos ajudam a entender como
              os visitantes interagem com nosso site
            </li>
            <li>
              <strong>Cookies de Preferência:</strong> Lembram suas configurações e
              preferências
            </li>
          </ul>

          <h2>Serviços de Terceiros</h2>
          <p>
            Podemos usar provedores de serviços terceirizados para nos ajudar a operar nosso
            site e conduzir nossos negócios. Esses terceiros têm acesso às
            suas informações pessoais apenas para realizar tarefas específicas em nosso
            nome e são obrigados a não divulgar ou usar para qualquer outro
            propósito.
          </p>

          <h2>Segurança dos Dados</h2>
          <p>
            Implementamos medidas técnicas e organizacionais apropriadas para
            proteger suas informações pessoais. No entanto, observe que nenhum
            método de transmissão pela internet ou armazenamento eletrônico é
            100% seguro, e não podemos garantir segurança absoluta.
          </p>

          <h2>Seus Direitos</h2>
          <p>Dependendo da sua localização, você pode ter os seguintes direitos:</p>
          <ul>
            <li>Acessar suas informações pessoais</li>
            <li>Corrigir informações imprecisas ou incompletas</li>
            <li>Solicitar exclusão de suas informações pessoais</li>
            <li>Opor-se ao processamento de suas informações pessoais</li>
            <li>Solicitar restrição do processamento</li>
            <li>Portabilidade de dados</li>
            <li>Retirar consentimento a qualquer momento</li>
          </ul>

          <h2>Privacidade de Crianças</h2>
          <p>
            Nosso site não é destinado a crianças menores de 13 anos. Não
            coletamos intencionalmente informações pessoais de crianças menores de
            13 anos. Se você é pai ou responsável e acredita que seu filho nos forneceu
            informações pessoais, por favor entre em contato conosco.
          </p>

          <h2>Transferências Internacionais de Dados</h2>
          <p>
            Suas informações podem ser transferidas e mantidas em computadores
            localizados fora do seu estado, província, país ou outra
            jurisdição governamental onde as leis de proteção de dados podem diferir. Tomaremos
            todas as medidas razoavelmente necessárias para garantir que seus dados sejam
            tratados com segurança.
          </p>

          <h2>Alterações nesta Política de Privacidade</h2>
          <p>
            Podemos atualizar nossa Política de Privacidade de tempos em tempos. Notificaremos
            você sobre quaisquer alterações publicando a nova Política de Privacidade nesta página
            e atualizando a data de "Última atualização". Aconselhamos que você revise esta
            Política de Privacidade periodicamente para quaisquer alterações.
          </p>

          <h2>Fale Conosco</h2>
          <p>
            Se você tiver alguma dúvida sobre esta Política de Privacidade, entre em contato
            conosco:
          </p>
          <ul>
            <li>Por e-mail: privacidade@editorial.com</li>
            <li>Através da nossa página de contato: <a href="/contact">/contact</a></li>
          </ul>
        </ArticleContent>
      </div>

      <Footer />
    </div>
  );
};

export default Privacy;
