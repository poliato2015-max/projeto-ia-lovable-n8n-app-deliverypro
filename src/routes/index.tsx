import { createFileRoute, Link } from "@tanstack/react-router";
import { BookOpen, CreditCard, MessageCircle, Leaf } from "lucide-react";

import { SiteHeader } from "@/components/site-header";
import { Button } from "@/components/ui/button";
import heroBurger from "@/assets/hero-burger.jpg";
import benefitMenu from "@/assets/benefit-menu.jpg";
import benefitPayment from "@/assets/benefit-payment.jpg";
import benefitWhatsapp from "@/assets/benefit-whatsapp.jpg";
import benefitIngredients from "@/assets/benefit-ingredients.jpg";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "DeliveryPro | Comida artesanal com entrega rápida" },
      {
        name: "description",
        content:
          "DeliveryPro: peça pelo cardápio digital, pague na entrega e acompanhe tudo pelo WhatsApp.",
      },
      { property: "og:title", content: "DeliveryPro | Comida artesanal com entrega rápida" },
      {
        property: "og:description",
        content:
          "DeliveryPro: peça pelo cardápio digital, pague na entrega e acompanhe tudo pelo WhatsApp.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

const beneficios = [
  {
    icon: BookOpen,
    image: benefitMenu,
    title: "Cardápio digital",
    text: "Monte seu pedido com os adicionais que quiser, direto no navegador.",
  },
  {
    icon: CreditCard,
    image: benefitPayment,
    title: "Pagamento na entrega",
    text: "Escolha crédito, débito ou Pix e pague quando o pedido chegar.",
  },
  {
    icon: MessageCircle,
    image: benefitWhatsapp,
    title: "Confirmação por WhatsApp",
    text: "Avisamos quando o pedido for aprovado e quando sair para a entrega.",
  },
  {
    icon: Leaf,
    image: benefitIngredients,
    title: "Ingredientes frescos",
    text: "Pão, carne e acompanhamentos preparados na hora do seu pedido.",
  },
];

function Index() {
  return (
    <div className="min-h-screen bg-client-bg">
      <SiteHeader />

      <main>
        <section className="relative isolate overflow-hidden">
          <img
            src={heroBurger}
            alt="Hambúrguer artesanal com bacon, queijo derretido e alface"
            width={1200}
            height={1000}
            className="absolute inset-0 -z-20 h-full w-full object-cover"
          />
          {/* Gradiente translúcido: escurece o lado do texto sem esconder a foto. */}
          <div
            className="absolute inset-0 -z-10"
            style={{
              background:
                "linear-gradient(100deg, color-mix(in oklab, var(--primary) 82%, transparent) 0%, color-mix(in oklab, var(--primary) 45%, transparent) 45%, color-mix(in oklab, #1A1A1A 25%, transparent) 100%)",
            }}
          />
          <div className="mx-auto max-w-5xl space-y-5 px-4 py-24 text-primary-foreground">
            <h1 className="text-4xl font-bold leading-tight drop-shadow-md sm:text-5xl">
              Hambúrgueres, pizzas e mais, feitos na hora e entregues quentinhos
            </h1>
            <p className="text-lg text-primary-foreground/95 drop-shadow">
              Monte seu pedido do jeito que você gosta e acompanhe cada etapa, do preparo até a sua
              porta.
            </p>

            <Button asChild size="lg" variant="secondary">
              <Link to="/cardapio">Ver Cardápio</Link>
            </Button>
          </div>
        </section>

        <section className="mx-auto max-w-5xl space-y-6 px-4 py-12">
          <h2 className="text-2xl font-bold text-foreground">Por que pedir com a gente?</h2>
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {beneficios.map((b) => (
              <li key={b.title} className="overflow-hidden rounded-xl bg-card">
                <div className="relative">
                  <img
                    src={b.image}
                    alt={`Ilustração de ${b.title}`}
                    loading="lazy"
                    width={512}
                    height={512}
                    className="h-40 w-full object-cover"
                  />
                  <span className="absolute bottom-2 right-2 inline-flex h-9 w-9 items-center justify-center rounded-lg bg-card/90 text-primary shadow-sm">
                    <b.icon className="h-4 w-4" />
                  </span>
                </div>
                <div className="space-y-2 p-5">
                  <h3 className="font-semibold text-foreground">{b.title}</h3>
                  <p className="text-sm text-muted-foreground">{b.text}</p>
                </div>
              </li>
            ))}
          </ul>
        </section>

        <section className="mx-auto max-w-5xl px-4 pb-16">
          <div className="space-y-4 rounded-2xl border bg-card p-8 text-center shadow-sm">
            <h2 className="text-2xl font-bold text-foreground">Pronto pra pedir?</h2>
            <p className="text-muted-foreground">
              Seu pedido está a poucos cliques de distância.
            </p>
            <Button asChild size="lg">
              <Link to="/cardapio">Começar Pedido</Link>
            </Button>
          </div>
        </section>
      </main>
    </div>
  );
}
