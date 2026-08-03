import { createFileRoute, Link } from "@tanstack/react-router";
import { BookOpen, CreditCard, MessageCircle, Leaf } from "lucide-react";

import { SiteHeader } from "@/components/site-header";
import { Button } from "@/components/ui/button";
import heroBurger from "@/assets/hero-burger.jpg";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "DeliveryPro | Hambúrgueres artesanais com entrega" },
      {
        name: "description",
        content:
          "DeliveryPro: peça hambúrgueres artesanais pelo cardápio digital, pague na entrega e acompanhe tudo pelo WhatsApp.",
      },
      { property: "og:title", content: "DeliveryPro | Hambúrgueres artesanais com entrega" },
      {
        property: "og:description",
        content:
          "DeliveryPro: peça hambúrgueres artesanais pelo cardápio digital, pague na entrega e acompanhe tudo pelo WhatsApp.",
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
    title: "Cardápio digital",
    text: "Monte seu hambúrguer com os adicionais que quiser, direto no navegador.",
  },
  {
    icon: CreditCard,
    title: "Pagamento na entrega",
    text: "Escolha crédito, débito ou Pix e pague quando o pedido chegar.",
  },
  {
    icon: MessageCircle,
    title: "Confirmação por WhatsApp",
    text: "Avisamos quando o pedido for aprovado e quando sair para a entrega.",
  },
  {
    icon: Leaf,
    title: "Ingredientes frescos",
    text: "Pão, carne e acompanhamentos preparados na hora do seu pedido.",
  },
];

function Index() {
  return (
    <div className="min-h-screen bg-client-bg">
      <SiteHeader />

      <main>
        <section className="mx-auto grid max-w-5xl items-center gap-8 px-4 py-14 md:grid-cols-2">
          <div className="space-y-5">
            <h1 className="text-4xl font-bold leading-tight text-foreground sm:text-5xl">
              Hambúrguer artesanal quentinho na sua porta
            </h1>
            <p className="text-lg text-muted-foreground">
              Peça em poucos cliques e acompanhe cada etapa até a entrega.
            </p>
            <Button asChild size="lg">
              <Link to="/cardapio">Ver Cardápio</Link>
            </Button>
          </div>
          <img
            src={heroBurger}
            alt="Hambúrguer artesanal com bacon, queijo derretido e alface"
            width={1200}
            height={1000}
            className="w-full rounded-2xl object-cover shadow-lg"
          />
        </section>

        <section className="mx-auto max-w-5xl space-y-6 px-4 py-10">
          <h2 className="text-2xl font-bold text-foreground">Por que pedir com a gente?</h2>
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {beneficios.map((b) => (
              <li key={b.title} className="space-y-2 rounded-xl border bg-card p-5 shadow-sm">
                <span className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-accent text-primary">
                  <b.icon className="h-5 w-5" />
                </span>
                <h3 className="font-semibold text-foreground">{b.title}</h3>
                <p className="text-sm text-muted-foreground">{b.text}</p>
              </li>
            ))}
          </ul>
        </section>

        <section className="mx-auto max-w-5xl px-4 pb-16">
          <div className="space-y-4 rounded-2xl border bg-card p-8 text-center shadow-sm">
            <h2 className="text-2xl font-bold text-foreground">Pronto pra pedir?</h2>
            <p className="text-muted-foreground">
              Seu hambúrguer está a poucos cliques de distância.
            </p>
            <Button asChild size="lg">
              <Link to="/cardapio">Ver Cardápio</Link>
            </Button>
          </div>
        </section>
      </main>
    </div>
  );
}
