# Padronização dos contêineres do DeliveryPro

## Objetivo
Unificar largura máxima e espaçamento lateral das páginas, garantindo que o conteúdo interno do cabeçalho e o conteúdo principal comecem e terminem no mesmo eixo em qualquer tela.

## Implementação

1. **Criar contêineres reutilizáveis**
   - Criar um componente central de contêiner com variantes públicas e administrativas.
   - Variante pública: largura máxima de 1600px, centralizada, com 24px laterais no mobile e 48px no desktop.
   - Variante administrativa: largura máxima de 1400px, centralizada, com o mesmo espaçamento lateral responsivo.
   - Expor wrappers semânticos `PublicLayout` e `AdminLayout` para impedir que cada página volte a definir largura e espaçamento próprios.

2. **Alinhar o cabeçalho**
   - Fazer o `SiteHeader` usar o mesmo componente de contêiner.
   - Permitir que o painel selecione a variante administrativa; páginas públicas usam a variante pública por padrão.
   - Manter a barra branca e a borda do cabeçalho ocupando toda a tela.
   - Preservar altura, navegação, ações e comportamento mobile existentes.

3. **Aplicar em todas as páginas**
   - Home: aplicar o contêiner público individualmente ao conteúdo das faixas full-width, preservando a imagem de fundo do topo.
   - Cardápio, checkout, conta, recuperação de senha, nova senha e Meus Pedidos: usar o layout público.
   - Relatórios, Produtos, Pedidos e Configuração: continuar centralizados pelo `AdminShell`, agora baseado no layout administrativo compartilhado.
   - Manter limites internos funcionais de formulários e listas estreitas, sem repetir largura/padding do contêiner da página.

4. **Responsividade e estabilidade**
   - Ajustar as linhas do cabeçalho e do título administrativo para não cortar textos nem ações em telas estreitas.
   - Garantir que a diferença entre 1600px e 1400px não mova o logo durante a navegação em larguras comuns; em telas muito grandes, o deslocamento será limitado e intencional conforme as duas larguras solicitadas.

## Validação
- Executar a verificação automática do projeto.
- Testar visualmente em 375px, 1440px e 1920px.
- Comparar as coordenadas esquerda/direita do conteúdo do cabeçalho e da página em rotas públicas e administrativas.
- Navegar entre uma página pública e uma administrativa para confirmar ausência de quebra, sobreposição ou salto inesperado.
