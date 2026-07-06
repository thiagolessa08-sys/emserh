# Regra Específica + Reanálise por Documento — Design

**Data:** 2026-07-04
**Status:** Aprovado pelo usuário

## Objetivo

Após a análise de um documento, permitir que o auditor escreva uma **regra específica em texto livre** e **reanalise o documento inteiro** incluindo essa regra. A regra pode afetar itens já avaliados (ex.: relaxar uma exigência). Vale só para aquela análise; a regra aplicada fica registrada no relatório PDF.

## Decisões (perguntas respondidas)

1. **Reanálise:** refaz a análise **completa** com a regra incluída (não só adicionar item) — porque a regra pode mudar itens já avaliados.
2. **Entrada da regra:** **texto livre**; a IA interpreta e avalia.
3. **Registro:** a regra aplicada aparece no relatório PDF ("Regra adicional aplicada nesta análise: …").
4. **Reaproveitamento:** a reanálise **reusa o texto já extraído** (sem refazer OCR/extração), rodando só a fase de análise da IA.
5. Dispensas manuais são **resetadas** ao reanalisar (é um resultado novo).

## Arquitetura

Sem persistência nova. O texto processado da primeira análise é devolvido ao cliente e reenviado na reanálise.

### Componentes

- **`src/lib/prompt.ts`** (mod) — `buildSystemPrompt(checklist, segmento, modalidade, regraExtra?)`: quando `regraExtra` existe, acrescenta uma seção "REGRA ADICIONAL ESPECÍFICA DESTA ANÁLISE" instruindo a IA a (a) avaliá-la como item na Instrução Processual e (b) reconsiderar itens existentes à luz dela.
- **`src/lib/claude-analyzer.ts`** (mod):
  - `runAnalysisOnText(focusedText, segmento, modalidade, regraExtra?)` — passa `regraExtra` ao prompt.
  - `analyzeProcess(...)` passa a devolver `{ analysis, focusedText }` (o texto usado na análise).
- **`src/app/api/analyze/route.ts`** (mod) — usa `analysis` do objeto e inclui `focusedText` no resultado enviado ao cliente.
- **`src/app/api/reanalyze/route.ts`** (novo) — `POST { focusedText, segmento, modalidade, regraExtra }` → `runAnalysisOnText(...)` → novo `AnalysisResult`.
- **`src/lib/report-generator.tsx`** (mod) — `generateConformityReport(analysis, dispensas?, regraExtra?)`: se `regraExtra` presente, mostra a nota "Regra adicional aplicada nesta análise: {texto}".
- **`src/app/api/report/route.ts`** (mod) — aceita `regraExtra` opcional no body e repassa ao gerador.
- **`src/components/ResultPanel.tsx`** (mod):
  - Recebe props novas: `focusedText`, `segmento`, `modalidade`.
  - Guarda `analysis` em estado (reanálise substitui) e `regraExtra` aplicada.
  - Bloco "Adicionar regra específica e reanalisar": textarea + botão "Reanalisar com esta regra".
  - Ao reanalisar: `POST /api/reanalyze`; sucesso → substitui a análise, grava a regra, reseta dispensas.
  - Download do relatório: se houver dispensas OU regraExtra → `POST /api/report { analysis, dispensas, regraExtra }`; senão baixa o original.
- **`src/app/page.tsx`** (mod) — passa `segmento`, `modalidade` e `focusedText` (do resultado) ao `ResultPanel`.
- **`src/app/globals.css`** (mod) — estilos do bloco de reanálise.

### Fluxo

```
1ª análise → resultado + focusedText (texto usado) no cliente
  → auditor escreve regra livre → "Reanalisar com esta regra"
  → POST /api/reanalyze { focusedText, segmento, modalidade, regraExtra }
  → IA refaz a análise com a regra → novo AnalysisResult
  → ResultPanel substitui a análise; dispensas resetam; regra guardada
  → "Baixar Relatório" → POST /api/report { analysis, dispensas, regraExtra }
  → PDF com o item reavaliado + nota "Regra adicional aplicada"
```

## Tratamento de erros

- Regra vazia → botão "Reanalisar" desabilitado.
- Falha na IA (reanálise) → mensagem "Falha ao reanalisar, tente novamente"; a análise atual permanece.
- Sem `focusedText` (análises antigas em memória) → botão de reanálise não aparece; comportamento normal preservado.

## Efeitos colaterais aceitos

- Itens já avaliados podem mudar (é o objetivo).
- Dispensas manuais resetam ao reanalisar.
- O **PDF anotado** continua o da 1ª análise (reanotar exigiria reenviar o PDF); o **relatório** sai atualizado.

## Testes

- `buildSystemPrompt` com `regraExtra` inclui a seção de regra adicional.
- (Já coberto) `recomputeConclusao`/geração do relatório seguem funcionando; geração com `regraExtra` renderiza a nota sem erro.

## Fora de escopo (YAGNI)

- Salvar a regra no checklist do segmento (é só daquela análise).
- Reanotar o PDF anotado.
- Preservar dispensas entre reanálises.
