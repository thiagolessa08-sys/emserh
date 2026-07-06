# Dispensa de Item por Análise (exceção com registro no PDF) — Design

**Data:** 2026-07-04
**Status:** Aprovado pelo usuário

## Objetivo

Permitir que, na tela de resultado de uma análise, o auditor **dispense** um item NÃO CONFORME ("não se aplica a esta análise") com justificativa obrigatória. O item deixa de contar como pendência, a decisão recalcula, e o **relatório PDF é regenerado** registrando a exceção (item dispensado + justificativa + auditor + data). O registro é o próprio PDF — nada novo é persistido no sistema.

## Decisões (perguntas respondidas)

1. **Ação:** dispensar o item (marcar como "não se aplica"), com justificativa obrigatória. Item sai da contagem de pendências.
2. **Registro:** somente no relatório PDF regenerado (sem persistência no sistema).
3. **Escopo:** apenas itens NÃO CONFORME podem ser dispensados. Sem controle por papel (qualquer auditor logado).

## Arquitetura

Sem novo armazenamento. As dispensas vivem no **estado da tela** (por análise). O relatório é **regenerado no servidor** sob demanda incluindo as exceções.

### Modelo de dados (em memória / payload)

```typescript
interface Dispensa {
  secao: 'reg' | 'inst';   // regularidade ou instrução processual
  item: number;            // número do item dentro da seção
  justificativa: string;   // obrigatória
  auditorNome: string;     // nome do auditor logado (capturado no momento)
  dataISO: string;         // data/hora da dispensa
}
```

Chave de um item = `${secao}:${item}` (o número do item é único dentro de cada seção).

### Componentes

- **`src/lib/dispensation.ts`** (novo) — funções puras:
  - `isDispensado(dispensas, secao, item): boolean`
  - `recomputeConclusao(analysis, dispensas): { conformes, naoConformes, atencao, dispensados, decisao }` — recalcula os totais e a decisão geral considerando as dispensas.
- **`src/lib/report-generator.tsx`** (modificar) — `generateConformityReport(analysis, dispensas?)`:
  - Itens dispensados aparecem com badge **"DISPENSADO"** (não "NÃO CONFORME"), seguido de "Dispensado por {auditor} em {data} — {justificativa}".
  - Totais e decisão geral usam `recomputeConclusao`.
  - Nova seção **"Exceções aplicadas nesta análise"** listando cada dispensa (item · justificativa · auditor · data). Só aparece se houver dispensas.
- **`src/app/api/report/route.ts`** (novo) — `POST` recebe `{ analysis, dispensas }`, regenera o PDF e devolve base64. Chamado a partir do app (usuário logado).
- **`src/components/ResultPanel.tsx`** (modificar):
  - Em cada item NÃO CONFORME, botão **"Dispensar (não se aplica)"** → abre campo de justificativa → confirma.
  - Estado local `dispensas: Dispensa[]` por painel. Item dispensado mostra badge "DISPENSADO" e some da lista de pendências.
  - O bloco de estatísticas (conformes/atenção/não conformes) e a decisão recalculam ao vivo via `recomputeConclusao`, e mostram também "Dispensados".
  - Botão **"Baixar Relatório de Conformidade"**: se houver dispensas, chama `/api/report` com `{ analysis, dispensas }` e baixa o PDF regenerado; sem dispensas, baixa o PDF original já gerado (comportamento atual).
  - Nome do auditor obtido de `/api/auth/me` (fetch no mount).

### Fluxo

```
Resultado na tela
  → auditor clica "Dispensar" em item NÃO CONFORME
  → digita justificativa → confirma
  → dispensa entra no estado local; item vira "DISPENSADO"; totais/decisão recalculam
  → auditor clica "Baixar Relatório de Conformidade"
  → POST /api/report { analysis, dispensas }
  → generateConformityReport(analysis, dispensas) → PDF regenerado → download
```

### Recálculo da decisão

- Item dispensado sai da contagem de NÃO CONFORME e entra em "dispensados".
- `total_itens_nao_conformes` = não conformes − dispensados.
- `decisao_geral`: se não sobrar nenhum NÃO CONFORME → `CONFORME`; se ainda houver → mantém `NAO_CONFORME` (ou `PENDENTE_AJUSTES` conforme a regra atual).

## Tratamento de erros

- Justificativa vazia → não permite confirmar a dispensa.
- Falha ao regenerar o PDF (`/api/report`) → mensagem "Falha ao gerar o relatório atualizado, tente novamente"; as dispensas permanecem no estado.
- Dispensa só é oferecida em itens NÃO CONFORME; itens já dispensados podem ser **desfeitos** (remover a dispensa).

## Testes

- `recomputeConclusao` — dispensar o único não conforme → decisão vira CONFORME; dispensar 1 de 2 → segue NÃO CONFORME; contadores corretos.
- `isDispensado` — identifica item por seção+número.
- Geração do relatório com dispensas — item marcado DISPENSADO, seção de exceções presente, decisão recalculada (verificação leve via render para buffer sem erro).

## Fora de escopo (YAGNI)

- Persistência de análises/exceções no sistema (decidido: só PDF).
- Dispensar itens ATENCAO/CONFORME.
- Controle por papel.
- Alterar o PDF anotado (a exceção é registrada no relatório de conformidade, não na marcação do processo).
