import { Link } from "react-router-dom";
import { useEffect, useRef, useState } from "react";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import Section from "@/components/Section";
import ArticlePreview from "@/components/ArticlePreview";
import BlogHighlight from "@/components/BlogHighlight";
import blog1 from "@/assets/blog-1.avif";
import blog2 from "@/assets/blog-2.avif";
import blog3 from "@/assets/blog-3.avif";
import blog4 from "@/assets/blog-4.avif";
import blog5 from "@/assets/blog-5.avif";
import blog6 from "@/assets/blog-6.avif";
import blog7 from "@/assets/blog-7.avif";
import blog8 from "@/assets/blog-8.avif";
import blog9 from "@/assets/blog-9.avif";
import blog10 from "@/assets/blog-10.avif";
import malmoHero from "@/assets/malmo/malmo-hero.jpg";

const Blog = () => {
  const articlesRef = useRef<(HTMLElement | null)[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>("Todos");

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("animate-fadeInUp");
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.1 },
    );

    articlesRef.current.forEach((article) => {
      if (article) observer.observe(article);
    });

    return () => observer.disconnect();
  }, [selectedCategory]);

  const featuredArticle = {
    title: "MLMO: Capturando o Renascimento Arquitetônico de Malmö",
    description:
      "De porto industrial a laboratório arquitetônico—a jornada de um fotógrafo através da transformação de Malmö em uma das capitais de design mais ousadas da Escandinávia.",
    image: malmoHero,
    tag: "Arquitetura",
    slug: "mlmo-architectural-renaissance",
  };

  const articles = [
    {
      title: "Espaços Interiores Minimalistas",
      description: "Linhas limpas e conceitos abertos que redefinem a vida contemporânea.",
      image: blog2,
      tag: "Casa",
      slug: "mlmo-architectural-renaissance",
    },
    {
      title: "Luz e Sombra no Design",
      description: "Como a luz natural transforma espaços arquitetônicos ao longo do dia.",
      image: blog3,
      tag: "Bem-estar",
      slug: "mlmo-architectural-renaissance",
    },
    {
      title: "Arquitetura Residencial Urbana",
      description: "Soluções habitacionais inovadoras para a vida moderna na cidade.",
      image: blog4,
      tag: "Casa",
      slug: "mlmo-architectural-renaissance",
    },
    {
      title: "Design de Construção Sustentável",
      description: "Arquitetura ecologicamente consciente que respeita o meio ambiente.",
      image: blog7,
      tag: "Bem-estar",
      slug: "mlmo-architectural-renaissance",
    },
    {
      title: "Fachadas Geométricas",
      description: "Designs angulares ousados que fazem declarações arquitetônicas poderosas.",
      image: blog8,
      tag: "Moda",
      slug: "mlmo-architectural-renaissance",
    },
  ];

  const opinions = [
    {
      title: "Encontrando Equilíbrio em um Mundo Agitado",
      avatar: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=200&q=80",
      author: "Emma Thompson",
      slug: "mlmo-architectural-renaissance",
    },
    {
      title: "A Alegria da Vida Lenta",
      avatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=200&q=80",
      author: "Marcus Chen",
      slug: "mlmo-architectural-renaissance",
    },
    {
      title: "Construindo Conexões Significativas",
      avatar: "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=200&q=80",
      author: "Sofia Rodriguez",
      slug: "mlmo-architectural-renaissance",
    },
    {
      title: "Abraçando Mudanças e Crescimento",
      avatar: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=200&q=80",
      author: "James Wilson",
      slug: "mlmo-architectural-renaissance",
    },
  ];

  const allArticles = [
    {
      title: "Vivendo em Caixas de Vidro",
      description: "Paredes transparentes que borram a fronteira entre interior e exterior.",
      image: blog5,
      tag: "Casa",
      slug: "mlmo-architectural-renaissance",
    },
    {
      title: "Harmonia entre Concreto e Madeira",
      description: "O equilíbrio perfeito entre materiais industriais e naturais.",
      image: blog6,
      tag: "Gastronomia",
      slug: "mlmo-architectural-renaissance",
    },
    {
      title: "Design de Construção Sustentável",
      description: "Arquitetura ecologicamente consciente que respeita o meio ambiente.",
      image: blog7,
      tag: "Bem-estar",
      slug: "mlmo-architectural-renaissance",
    },
    {
      title: "Fachadas Geométricas",
      description: "Designs angulares ousados que fazem declarações arquitetônicas poderosas.",
      image: blog8,
      tag: "Moda",
      slug: "mlmo-architectural-renaissance",
    },
    {
      title: "Plantas Abertas",
      description: "Espaços de vida flexíveis que se adaptam aos estilos de vida modernos.",
      image: blog9,
      tag: "Estilo de Vida",
      slug: "mlmo-architectural-renaissance",
    },
    {
      title: "Otimização de Luz Natural",
      description: "Posicionamento estratégico de janelas para interiores cheios de sol.",
      image: blog10,
      tag: "Casa",
      slug: "mlmo-architectural-renaissance",
    },
    {
      title: "Jardins no Terraço",
      description: "Trazendo a natureza para espaços urbanos elevados.",
      image: blog1,
      tag: "Viagem",
      slug: "mlmo-architectural-renaissance",
    },
    {
      title: "Texturas no Design Moderno",
      description: "Camadas de materiais para profundidade e interesse visual.",
      image: blog2,
      tag: "Moda",
      slug: "mlmo-architectural-renaissance",
    },
    {
      title: "Vida Interior-Exterior",
      description: "Transições suaves entre espaços internos e externos.",
      image: blog3,
      tag: "Viagem",
      slug: "mlmo-architectural-renaissance",
    },
    {
      title: "Design de Cozinha Contemporânea",
      description: "Espaços elegantes e funcionais para o chef moderno.",
      image: blog4,
      tag: "Gastronomia",
      slug: "mlmo-architectural-renaissance",
    },
    {
      title: "Escadas Escultóricas",
      description: "Elementos esculturais que se tornam o ponto focal de qualquer espaço.",
      image: blog5,
      tag: "Moda",
      slug: "mlmo-architectural-renaissance",
    },
    {
      title: "Paletas de Cores Neutras",
      description: "Tons atemporais que criam interiores calmos e sofisticados.",
      image: blog6,
      tag: "Estilo de Vida",
      slug: "mlmo-architectural-renaissance",
    },
    {
      title: "Integração de Casa Inteligente",
      description: "Tecnologia integrada perfeitamente ao design arquitetônico.",
      image: blog7,
      tag: "Estilo de Vida",
      slug: "mlmo-architectural-renaissance",
    },
    {
      title: "Arquitetura Flutuante",
      description: "Estruturas em balanço que desafiam a gravidade.",
      image: blog8,
      tag: "Viagem",
      slug: "mlmo-architectural-renaissance",
    },
    {
      title: "Banheiros Minimalistas",
      description: "Santuários tipo spa com estética limpa e moderna.",
      image: blog9,
      tag: "Bem-estar",
      slug: "mlmo-architectural-renaissance",
    },
    {
      title: "Casas com Pátio",
      description: "Espaços externos privados no coração do design residencial.",
      image: blog10,
      tag: "Viagem",
      slug: "mlmo-architectural-renaissance",
    },
    {
      title: "Interiores Industrial Chic",
      description: "Vigas expostas e materiais brutos criam elegância urbana.",
      image: blog1,
      tag: "Gastronomia",
      slug: "mlmo-architectural-renaissance",
    },
    {
      title: "Designs de Parede de Vidro",
      description: "Vidro do chão ao teto para vistas e luz natural máximas.",
      image: blog2,
      tag: "Casa",
      slug: "mlmo-architectural-renaissance",
    },
    {
      title: "Soluções para Espaços Compactos",
      description: "Maximizando pequenos espaços através de design inteligente.",
      image: blog3,
      tag: "Estilo de Vida",
      slug: "mlmo-architectural-renaissance",
    },
    {
      title: "Iluminação Arquitetônica",
      description: "Iluminação como elemento de design em casas modernas.",
      image: blog4,
      tag: "Gastronomia",
      slug: "mlmo-architectural-renaissance",
    },
  ];

  return (
    <div className="min-h-screen bg-background">
      <Header />

      <Section>
        <BlogHighlight
          title={featuredArticle.title}
          description={featuredArticle.description}
          href={`/article/${featuredArticle.slug}`}
          imageSrc={featuredArticle.image}
          imageAlt={featuredArticle.title}
        />
      </Section>

      {/* Grade de Artigos */}
      <Section
        className="relative overflow-x-scroll scroll-smooth snap-x snap-mandatory pb-28 [-ms-overflow-style:none] [-webkit-overflow-scrolling:touch] [scrollbar-width:none] 
  [&::-webkit-scrollbar]:hidden"
      >
        <div className="m-0 flex w-full list-none items-start overflow-x-visible after:ml-[-6.25%] after:block after:flex-[0_0_calc(50vw-50%)] after:content-[''] lg:after:ml-[-4.347826087%]">
          {articles.map((article, index) => (
            <div
              key={index}
              ref={(el) => (articlesRef.current[index] = el)}
              className="m-0 mr-[6.25%] inline-flex max-w-[42rem] flex-[0_0_80%] scroll-snap-align-center sm:flex-[0_0_43.75%] lg:mr-[4.347826087%] lg:flex-[0_0_30.434783%]"
            >
              <ArticlePreview
                title={article.title}
                slug={article.slug}
                image={article.image}
                imageAlt={article.title}
                category={article.tag}
                categorySlug={article.tag.toLowerCase()}
                teaser={article.description}
              />
            </div>
          ))}
        </div>
      </Section>

      {/* Seção de Opiniões */}
      <Section>
        <h2
          className="text-[hsl(var(--editorial-text))]"
          style={{
            width: "100%",
            marginBottom: "3rem",
            padding: "1rem 0",
            textAlign: "left",
            letterSpacing: "0.2rem",
            textTransform: "uppercase",
            borderBottom: "1px solid rgba(0, 0, 0, 0.2)",
            fontSize: "1.6rem",
            fontWeight: 600,
            lineHeight: 1.5,
          }}
        >
          Opiniões
        </h2>
        <div className="m-0 grid w-full list-none gap-12 p-0 text-left sm:grid-cols-2 lg:grid-cols-[repeat(auto-fit,minmax(20rem,1fr))] 2xl:gap-24">
          {opinions.map((opinion, index) => (
            <Link
              key={index}
              to={`/article/${opinion.slug}`}
              ref={(el) => (articlesRef.current[articles.length + index] = el)}
              className="group blog-feed__item"
              style={{
                flex: "0 0 calc(25% - 2.25rem)",
                animationDelay: `${index * 150}ms`,
              }}
            >
              <article className="h-full">
                <div className="relative w-[60px] h-[60px] rounded-full overflow-hidden bg-muted mb-4">
                  <img
                    src={opinion.avatar}
                    alt={opinion.author}
                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                  />
                </div>
                <h2 className="font-sans font-semibold text-[2.2rem] md:text-[2.7rem] leading-[1.4] text-[hsl(var(--editorial-text))] text-left">
                  <span className="inline-block mb-[-0.3em] pb-[0.3em] [transition:background-position_600ms_cubic-bezier(0.45,0,0.55,1)] bg-current [background-image:linear-gradient(90deg,rgba(203,48,223,0.5)_0%,rgba(254,44,85,0.5)_46%,hsl(var(--foreground))_54%,hsl(var(--foreground))_100%)] bg-[length:220%_100%] bg-[position:100%_0] bg-clip-text text-transparent group-hover:bg-[position:0%_0]">
                    {opinion.title}
                  </span>
                </h2>
              </article>
            </Link>
          ))}
        </div>
      </Section>

      {/* Seção Mais Artigos */}
      <Section>
        <h2
          className="text-[hsl(var(--editorial-text))]"
          style={{
            width: "100%",
            marginBottom: "3rem",
            padding: "1rem 0",
            textAlign: "left",
            letterSpacing: "0.2rem",
            textTransform: "uppercase",
            borderBottom: "1px solid rgba(0, 0, 0, 0.2)",
            fontSize: "1.6rem",
            fontWeight: 600,
            lineHeight: 1.5,
          }}
        >
          Mais Artigos
        </h2>

        {/* Barra de Filtro por Categoria */}
        <div
          className="flex gap-4 mb-8 flex-wrap bg-background py-4 justify-center w-screen relative left-1/2 right-1/2 ml-0 mr-0"
          style={{
            position: "sticky",
            top: "72px",
            zIndex: 10,
            marginLeft: "calc(-50vw + 50%)",
            marginRight: "calc(-50vw + 50%)",
          }}
        >
          {["Todos", "Bem-estar", "Casa", "Viagem", "Gastronomia", "Moda", "Estilo de Vida"].map((category) => (
            <button
              key={category}
              onClick={() => setSelectedCategory(category)}
              className={`uppercase tracking-wide text-[1.6rem] leading-[2rem] font-normal px-4 py-2 rounded-[0.6rem] transition-all duration-300 ${
                selectedCategory === category
                  ? "bg-[rgba(254,44,85,0.15)] text-[#FE2C55]"
                  : "text-[hsl(var(--foreground))] hover:text-[#FE2C55]"
              }`}
            >
              {category}
            </button>
          ))}
        </div>

        <div className="grid list-none gap-x-16 gap-y-24 py-8 text-left sm:grid-cols-2 lg:grid-cols-3">
          {allArticles
            .filter((article) => selectedCategory === "Todos" || article.tag === selectedCategory)
            .map((article, index) => (
              <div
                key={index}
                ref={(el) => (articlesRef.current[articles.length + opinions.length + index] = el)}
                className="blog-feed__item"
                style={{
                  animationDelay: `${(index % 3) * 150}ms`,
                }}
              >
                <ArticlePreview
                  title={article.title}
                  slug={article.slug}
                  image={article.image}
                  imageAlt={article.title}
                  category={article.tag}
                  categorySlug={article.tag.toLowerCase()}
                  teaser={article.description}
                />
              </div>
            ))}
        </div>
      </Section>

      <Footer />
    </div>
  );
};

export default Blog;
