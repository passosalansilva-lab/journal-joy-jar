import Header from "@/components/Header";
import Footer from "@/components/Footer";
import Section from "@/components/Section";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

const FAQ = () => {
  const faqs = [
    {
      question: "O que é a Editorial?",
      answer:
        "A Editorial é uma plataforma de conteúdo focada em design onde criadores compartilham histórias, fotografia e perspectivas. Combinamos excelência editorial com design bonito para criar uma experiência de leitura envolvente.",
    },
    {
      question: "Como posso contribuir para a Editorial?",
      answer:
        "Estamos sempre em busca de escritores, fotógrafos e designers talentosos. Entre em contato através da nossa página de Contato com amostras do seu trabalho e uma breve apresentação. Analisamos todas as submissões e respondemos em 7-10 dias úteis.",
    },
    {
      question: "A Editorial é gratuita para ler?",
      answer:
        "Sim! Todo o conteúdo da Editorial é gratuito para leitura. Acreditamos que grandes histórias devem ser acessíveis a todos. Estamos explorando modelos sustentáveis que mantêm o conteúdo gratuito enquanto apoiam nossos criadores.",
    },
    {
      question: "Posso republicar conteúdo da Editorial?",
      answer:
        "Os direitos do conteúdo pertencem aos criadores individuais. Se você deseja republicar ou referenciar um artigo, entre em contato conosco com detalhes sobre o uso pretendido, e conectaremos você com o autor original.",
    },
    {
      question: "Com que frequência vocês publicam novo conteúdo?",
      answer:
        "Publicamos novos artigos 3-4 vezes por semana. Qualidade sobre quantidade é nosso lema—cada peça passa por uma revisão editorial e de design minuciosa antes da publicação.",
    },
    {
      question: "Vocês aceitam conteúdo patrocinado ou publicidade?",
      answer:
        "Ocasionalmente apresentamos conteúdo patrocinado que se alinha com nossos valores e padrões. Todas as peças patrocinadas são claramente identificadas. Não aceitamos banners publicitários ou formatos de publicidade intrusivos.",
    },
    {
      question: "Como me inscrevo para receber atualizações?",
      answer:
        "Enquanto estamos desenvolvendo nosso recurso de newsletter, você pode nos seguir no Twitter para atualizações regulares. Anunciamos novos artigos, fotógrafos em destaque e destaques da comunidade lá.",
    },
    {
      question: "Qual é o processo editorial de vocês?",
      answer:
        "Cada submissão passa por uma revisão em múltiplas etapas: triagem inicial, feedback editorial, integração de design e aprovação final. Trabalhamos de perto com os colaboradores para garantir que sua visão seja preservada enquanto mantemos nossos padrões de qualidade.",
    },
    {
      question: "Posso sugerir um tópico ou ideia de história?",
      answer:
        "Com certeza! Adoramos ouvir ideias da nossa comunidade. Envie seu pitch através da nossa página de Contato com um breve esboço. Analisamos todas as sugestões e respondemos às que se encaixam em nossa direção editorial.",
    },
    {
      question: "Como vocês escolhem os artigos em destaque?",
      answer:
        "Os artigos em destaque são selecionados com base na qualidade editorial, impacto visual, atualidade e engajamento da comunidade. Nosso objetivo é mostrar vozes e perspectivas diversas em diferentes categorias de conteúdo.",
    },
    {
      question: "Existe um aplicativo móvel?",
      answer:
        "Ainda não, mas nosso site é totalmente responsivo e otimizado para leitura em dispositivos móveis. Um aplicativo nativo está em nosso roadmap para 2025, enquanto continuamos a melhorar a experiência de leitura.",
    },
    {
      question: "Como posso relatar um problema ou bug?",
      answer:
        "Por favor, use nossa página de Contato para relatar quaisquer problemas técnicos, links quebrados ou preocupações. Inclua detalhes sobre seu dispositivo, navegador e o problema específico que encontrou. Investigamos todos os relatórios prontamente.",
    },
  ];

  return (
    <div className="min-h-screen bg-background">
      <Header />

      {/* Seção Hero */}
      <Section>
        <div className="text-center w-full max-w-[80rem] mx-auto">
          <h1 className="text-[3.4rem] md:text-[4.2rem] lg:text-[6rem] font-semibold tracking-[-0.01em] leading-[1.2] md:leading-[1] mb-[2rem]">
            Perguntas Frequentes
          </h1>
          <p className="text-[1.8rem] md:text-[2rem] text-muted-foreground leading-[1.8]">
            Tudo o que você precisa saber sobre a Editorial e como funciona.
          </p>
        </div>
      </Section>

      {/* Acordeão de FAQ */}
      <Section>
        <div className="max-w-[80rem] w-full mx-auto">
          <Accordion type="single" collapsible className="w-full">
            {faqs.map((faq, index) => (
              <AccordionItem
                key={index}
                value={`item-${index}`}
                className="border-b border-border"
              >
                <AccordionTrigger className="text-[1.8rem] md:text-[2rem] font-medium text-left hover:no-underline py-6 w-full">
                  {faq.question}
                </AccordionTrigger>
                <AccordionContent className="text-[1.6rem] leading-[1.8] text-muted-foreground pb-6 w-full">
                  {faq.answer}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      </Section>

      {/* Ainda Tem Dúvidas */}
      <Section>
        <div className="text-center max-w-[70rem] mx-auto border-t border-border pt-[4rem]">
          <h3 className="text-[2.4rem] font-semibold mb-[1.5rem]">
            Ainda tem dúvidas?
          </h3>
          <p className="text-[1.8rem] leading-[1.8] text-muted-foreground mb-[2rem]">
            Não encontrou a resposta que procurava? Fique à vontade para entrar em contato com nossa equipe.
          </p>
          <a
            href="/contact"
            className="inline-block px-8 py-3 text-[1.6rem] font-medium bg-foreground text-background rounded-lg hover:opacity-90 transition-opacity"
          >
            Fale Conosco
          </a>
        </div>
      </Section>

      <Footer />
    </div>
  );
};

export default FAQ;
