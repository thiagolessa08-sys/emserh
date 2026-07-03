# UI Redesign — Auditor de Conformidade EMSERH

> **Para agentic workers:** SUB-SKILL OBRIGATÓRIA: Use superpowers:executing-plans para implementar este plano tarefa por tarefa.

**Objetivo:** Substituir a UI atual pela nova identidade visual definida no mockup HTML de referência (`C:\Users\CAPITANI\Downloads\Auditor de Conformidade.html`), mantendo toda a lógica de backend intacta.

**Referência de design:** O arquivo HTML de referência é a especificação definitiva. A implementação deve ser pixel-fiel ao mockup.

---

## Tokens de design

```
/* Paleta EMSERH */
--emserh-green: #9DC95F
--emserh-green-deep: #7FB348
--emserh-blue: #3FA9D5
--emserh-navy: #14304F
--emserh-navy-2: #1E4570

/* Neutros */
--ink: #0F1E2E
--ink-2: #2A3B4F
--muted: #6B7A8C
--muted-2: #94A1B2
--line: #E4E8EE
--line-2: #EFF2F6
--bg: #F4F6F9
--paper: #FFFFFF
--paper-soft: #FAFBFC

/* Status */
--ok: #2F7D4A       --ok-soft: #E8F3EC
--warn: #A86A12     --warn-soft: #FBF1DE
--err: #B53A2C      --err-soft: #FBEDE9
```

**Fontes:**
- Texto: `Inter` (400/500/600/700)
- Títulos/números: `Instrument Serif` (400, italic)
- Código/mono: `JetBrains Mono` (400/500)

---

## Estrutura de layout

```
Header (sticky, branco, borda inferior)
  Logo /logo-emserh.png | divisor | "Auditor de Conformidade" / "GCIF · ..." | nav (decorativa) | user chip

Page (grid: 1fr 320px, max-width 1200px, padding 36px 32px)
  page-header (span 2 colunas)
    breadcrumb: GCIF › Auditoria documental › Nova análise
    título hero: "Submeta os documentos\npara <em>análise de conformidade</em>"
    subtítulo cinza
    stepper (Envio → Análise → Relatório)

  main (coluna esquerda, flex-col gap-20px)
    [Estado idle]   → card upload + card fila de arquivos + botão Analisar
    [Processando]   → card com file-rows animadas (Analisando / Concluído)
    [Done]          → card de resultados (stat grid + findings list)

  sidebar (coluna direita, sticky top 100px)
    card "O que é verificado" (4 itens com ✓ verde — estático)
    card "Análises Recentes" (3 itens hardcoded — estático)
```

---

## Componentes

### Header (novo: `src/components/Header.tsx`)
- Logo `<img src="/logo-emserh.png">` height 38px
- Divisor vertical 1px
- `<div>` system="Auditor de Conformidade" dept="GCIF · Gerência de Controle Interno Financeiro"
- Nav links: Nova análise (active), Histórico, Normativos — decorativos (`href="#"`)
- User chip: "M. Carvalho" + avatar gradiente "MC"

### Stepper (novo: `src/components/Stepper.tsx`)
- Props: `step: 1 | 2 | 3`
- Dots: `active` = navy fundo branco texto, `done` = green-deep, `upcoming` = cinza
- Separadores linha cinza
- Labels: Envio, Análise, Relatório

### Sidebar (novo: `src/components/Sidebar.tsx`)
- Card "O que é verificado": 4 itens (Empenho liquidação pagamento / Certidões e habilitação / Assinaturas e atestos / Vinculação ao contrato) com ícone ✓ verde EMSERH
- Card "Análises Recentes": 3 linhas hardcoded com badge colorido (OBS / NC)

### UploadArea (reescrita: `src/components/UploadArea.tsx`)
- Props mantidas: `onFilesSelected(files: File[])`, `disabled?: boolean`
- Dropzone com ícone caixa branca sombra (seta upload SVG), gradiente radial verde no topo, borda dashed, 3 pills: `PDF · máx. 50 MB · até 20 arquivos`
- Estados: default, hover (borda verde), drag (borda sólida, fundo verde 15%, scale 1.005)
- Texto: "Arraste os PDFs ou **clique para selecionar**" (verde sublinhado)

### FileQueueCard (inline em page.tsx)
- Cada `file-row`: grid `44px 1fr auto auto`, ícone PDF thumbnail (div CSS estilizada), nome + tamanho, badge "Na fila", botão ✕
- Botão primário: "Iniciar análise de N arquivo(s) →" (navy, hover navy-2, sombra)
- Botão secundário: "Limpar" (branco, borda)

### AnalyzingCard (inline em page.tsx, estado processando)
- Mesmos file-rows mas classe `analyzing` (fundo gradiente verde leve, borda verde) com badge pulsando
- Barra de progresso 4px gradiente verde→azul abaixo do nome do arquivo

### ResultPanel (reescrita: `src/components/ResultPanel.tsx`)
- Stat grid 3 colunas: Conformes (verde, Instrument Serif 36px) / Atenção (warn) / Não Conformes (err)
- Findings list: linhas separadas por 1px bg-line-2, cada linha = dot colorido + título + descrição + badge ref mono
- Botões de download: primário navy + secundário outline

### ProgressIndicator.tsx
- Mantido apenas para lógica de tipo `AnalysisStage` — o visual de progresso agora é inline nos cards

---

## Mapeamento de estados → stepper

| `stage`                          | Stepper step | Card visível         |
|----------------------------------|--------------|----------------------|
| `idle` + pendingFiles.length = 0 | 1 (active)   | Upload dropzone      |
| `idle` + pendingFiles.length > 0 | 1 (active)   | Upload + fila        |
| `extracting / ocr / analyzing / generating` | 2 (active) | Analyzing card |
| `done`                           | 3 (done)     | Results card         |
| `error`                          | 2 (error)    | Error inline         |

---

## Arquivos modificados

| Arquivo | Ação |
|---|---|
| `src/app/globals.css` | Adicionar variáveis CSS EMSERH (`:root`) |
| `src/app/layout.tsx` | Fonts Inter + Instrument Serif + JetBrains Mono, lang="pt-BR", metadata |
| `src/app/page.tsx` | Reescrita completa — layout 2 colunas, todos os estados |
| `src/components/Header.tsx` | Novo |
| `src/components/Stepper.tsx` | Novo |
| `src/components/Sidebar.tsx` | Novo |
| `src/components/UploadArea.tsx` | Reescrita |
| `src/components/ResultPanel.tsx` | Reescrita |
| `src/components/ProgressIndicator.tsx` | Mantém tipos, remove JSX (substituído pelo design novo) |
| `public/logo-emserh.png` | Já colocado pelo usuário |

**Sem mudanças em:** `src/app/api/`, `src/lib/` (nenhuma mudança de backend).
