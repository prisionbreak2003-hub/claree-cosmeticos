# Template PV 01 — Landing page de vendas (kit/produto físico)

Template de página de vendas (dropshipping/e-commerce) mobile-first, 100% frontend estático,
pronto pra deploy na Vercel. Sem build, sem dependências — abre direto no navegador.

Inclui: topbar de avisos rotativa, seletor de kits (1/2/3 unidades) com preço "flutuante",
seção de 3 passos do produto (trocada no toque), carrossel de vídeos de prova social,
comparador antes/depois arrastável, carrossel de depoimentos, âncora de valor (preço parece
pequeno), garantia + CTA, footer institucional, CTA fixo no rodapé da tela e widget de chat
("atendente" fake com respostas automáticas).

## Estrutura

```
index.html              — página inteira (HTML + CSS inline + JS inline)
precos-front.js         — lógica do preço "flutuante" dos kits (client-side)
atendimento-widget.js   — widget de chat flutuante
assets/
  fonts.css             — @font-face (Fraunces + Plus Jakarta Sans, via fonts.gstatic.com)
  *.webp                — [NÃO versionado] fotos do produto — ver checklist abaixo
media/
  *.mp4                 — [NÃO versionado] vídeos de prova social — ver checklist abaixo
```

As imagens/vídeos **não ficam no git** (propositalmente — são conteúdo específico de cada
produto/campanha, muitas vezes com pessoas reais). Toda vez que for montar um produto novo,
essas mídias precisam ser fornecidas e colocadas nos mesmos nomes de arquivo esperados pelo
`index.html` (ou o `index.html` precisa ser ajustado pros novos nomes).

## Checklist pra adaptar a um produto novo

Tudo isso é editado direto no `index.html` (é um arquivo único, sem framework):

**1. Identidade**
- `<title>` e `<meta name="description">` (linhas ~6-7)
- `.brand` — nome da marca (aparece 2x: nav e footer)
- Paleta de cores em `:root` no `<style>` (`--ac`, `--ac-d`, `--ac-l`, `--ink`, `--gold` etc.)

**2. Hero**
- H1, subtítulo, nota de rating/avaliações
- Imagem principal do produto (`hero-img-wrap img`)
- Badge de desconto (`#disc-badge`)

**3. Preços e kits** — bloco `<script>` no fim do arquivo, array `KITS`:
  ```js
  var KITS=[{p:3793,o:8900,n:'1 Kit Completo',q:1}, ...]
  ```
  `p` = preço atual (centavos), `o` = preço "de" riscado, `n` = nome, `q` = quantidade.
  Os mesmos valores também precisam bater com os `data-price`/`data-old`/`data-per` no HTML
  dos cards `.of-kit` e nos botões `.sk-kit` do CTA fixo.
  Se quiser desligar o "preço flutuante" (que sobe uns centavos a cada 5min), basta não
  incluir `precos-front.js` — o JS já tem fallback pros valores fixos do array `KITS`.

**4. Seção "Como funciona" (`#scn-passos`)** — 3 blocos `.ps-act-N`, cada um com imagem,
título, texto e chips de ingredientes/benefícios. Trocar para as 3 etapas de uso do produto novo.

**5. Antes/depois (`#scn-cla`)** — troca `before.webp`/`after.webp` e o texto de `CAPS` no JS
(as legendas que mudam conforme arrasta o slider).

**6. Prova social**
- Carrossel de vídeos: troca os `src="media/vidN.mp4"` e os nomes/seguidores nas legendas
- Carrossel de depoimentos: troca nome + texto de cada `.rev`
- Prints de entrega: troca `prova1.webp`/`prova2.webp`

**7. Vídeo principal (`#mv-video`, `media/vip.mp4`)** — vídeo de depoimento com áudio,
toca ao clicar. Trocar os textos dos `.vbadge` (selos que aparecem sobre o vídeo).

**8. Âncora de valor (`#scn-valor`)** — 3 argumentos de "o preço é pequeno perto disso".
Ajustar números e comparação pro contexto do produto novo.

**9. Garantia** — texto do `.guar h3`/`.guar p` (dias de garantia, valor do bônus se não amar).

**10. Footer** — WhatsApp, razão social, CNPJ, horário de atendimento, links institucionais.

**11. Widget de atendimento** — `window.ATD_NOME`, `ATD_PRODUTO`, `ATD_TEASER` (perto do fim do arquivo).

**12. Rastreamento (pixels)** — este template **não tem** Meta Pixel/UTMify (removidos de
propósito na versão frontend-only). Se o produto precisar, adicionar de volta no `<head>`.

## Deploy (Vercel)

```bash
vercel --prod --yes
```
Site estático puro — a Vercel detecta e serve sem passo de build.

## Mídia esperada (nomes de arquivo)

| Arquivo | Uso |
|---|---|
| `assets/produto1.webp` `produto2.webp` `produto4.webp` `produto5.webp` | fotos do produto/kit |
| `assets/before.webp` `after.webp` | comparador antes/depois |
| `assets/bellafio.webp` | imagem do brinde (se houver) |
| `assets/prova1.webp` `prova2.webp` | prints de entrega/pedido |
| `media/vid1.mp4` … `vid6.mp4` | carrossel de vídeos de prova social (vertical, mudo) |
| `media/vip.mp4` | vídeo principal de depoimento (com áudio) |
