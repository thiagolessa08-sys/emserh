const COMMON_REPLACEMENTS: Array<[RegExp, string]> = [
  [/Servi�os/g, 'Serviços'],
  [/M�dicos/g, 'Médicos'],
  [/M�dica/g, 'Médica'],
  [/refer�ncia/gi, 'referência'],
  [/contrata��o/gi, 'contratação'],
  [/n�mero/gi, 'número'],
  [/�/g, ''],
];

export function normalizeText(input: string): string {
  let out = input;
  for (const [re, rep] of COMMON_REPLACEMENTS) {
    out = out.replace(re, rep);
  }
  // remove control chars except \n and \t
  out = out.replace(/[\x00-\x08\x0B-\x1F\x7F]/g, '');
  // collapse whitespace within a line (preserve newlines)
  out = out
    .split('\n')
    .map((line) => line.replace(/[ \t]+/g, ' ').trim())
    .join('\n');
  return out;
}
