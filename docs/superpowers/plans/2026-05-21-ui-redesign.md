# UI Redesign — Auditor de Conformidade EMSERH — Plano de Implementação

> **Para workers agênticos:** SUB-SKILL OBRIGATÓRIA: Use superpowers:executing-plans para implementar este plano tarefa por tarefa. Os passos usam sintaxe de checkbox (`- [ ]`) para rastreamento.

**Objetivo:** Substituir toda a UI pelo design pixel-fiel do mockup HTML (`C:\Users\CAPITANI\Downloads\Auditor de Conformidade.html`), sem tocar em nenhum arquivo de backend.

**Arquitetura:** Tokens de design EMSERH adicionados em `globals.css` via `@layer components`. Três novos componentes (Header, Stepper, Sidebar). UploadArea, ResultPanel e page.tsx reescritos. ProgressIndicator vira arquivo de tipo puro.

**Tech Stack:** Next.js App Router, Tailwind CSS v4, next/font/google (Inter + Instrument Serif + JetBrains Mono).

---

### Tarefa 1: Design tokens + fontes

**Arquivos:**
- Modificar: `src/app/globals.css`
- Modificar: `src/app/layout.tsx`

- [ ] **Passo 1: Reescrever globals.css**

Substituir o conteúdo completo de `src/app/globals.css` por:

```css
@import "tailwindcss";
@import "tw-animate-css";
@import "shadcn/tailwind.css";

@custom-variant dark (&:is(.dark *));

@theme inline {
  --color-background: var(--background);
  --color-foreground: var(--foreground);
  --font-sans: var(--font-inter);
  --font-serif: var(--font-instrument-serif);
  --font-mono: var(--font-jetbrains-mono);
  --color-sidebar-ring: var(--sidebar-ring);
  --color-sidebar-border: var(--sidebar-border);
  --color-sidebar-accent-foreground: var(--sidebar-accent-foreground);
  --color-sidebar-accent: var(--sidebar-accent);
  --color-sidebar-primary-foreground: var(--sidebar-primary-foreground);
  --color-sidebar-primary: var(--sidebar-primary);
  --color-sidebar-foreground: var(--sidebar-foreground);
  --color-sidebar: var(--sidebar);
  --color-ring: var(--ring);
  --color-input: var(--input);
  --color-border: var(--border);
  --color-destructive: var(--destructive);
  --color-accent-foreground: var(--accent-foreground);
  --color-accent: var(--accent);
  --color-muted-foreground: var(--muted-foreground);
  --color-muted: var(--muted);
  --color-secondary-foreground: var(--secondary-foreground);
  --color-secondary: var(--secondary);
  --color-primary-foreground: var(--primary-foreground);
  --color-primary: var(--primary);
  --color-popover-foreground: var(--popover-foreground);
  --color-popover: var(--popover);
  --color-card-foreground: var(--card-foreground);
  --color-card: var(--card);
  --radius-sm: calc(var(--radius) * 0.6);
  --radius-md: calc(var(--radius) * 0.8);
  --radius-lg: var(--radius);
  --radius-xl: calc(var(--radius) * 1.4);
  --radius-2xl: calc(var(--radius) * 1.8);
}

:root {
  /* shadcn tokens (mantidos) */
  --background: oklch(1 0 0);
  --foreground: oklch(0.145 0 0);
  --card: oklch(1 0 0);
  --card-foreground: oklch(0.145 0 0);
  --popover: oklch(1 0 0);
  --popover-foreground: oklch(0.145 0 0);
  --primary: oklch(0.205 0 0);
  --primary-foreground: oklch(0.985 0 0);
  --secondary: oklch(0.97 0 0);
  --secondary-foreground: oklch(0.205 0 0);
  --muted: oklch(0.97 0 0);
  --muted-foreground: oklch(0.556 0 0);
  --accent: oklch(0.97 0 0);
  --accent-foreground: oklch(0.205 0 0);
  --destructive: oklch(0.577 0.245 27.325);
  --border: oklch(0.922 0 0);
  --input: oklch(0.922 0 0);
  --ring: oklch(0.708 0 0);
  --radius: 0.625rem;
  --sidebar: oklch(0.985 0 0);
  --sidebar-foreground: oklch(0.145 0 0);
  --sidebar-primary: oklch(0.205 0 0);
  --sidebar-primary-foreground: oklch(0.985 0 0);
  --sidebar-accent: oklch(0.97 0 0);
  --sidebar-accent-foreground: oklch(0.205 0 0);
  --sidebar-border: oklch(0.922 0 0);
  --sidebar-ring: oklch(0.708 0 0);

  /* EMSERH brand */
  --emserh-green: #9DC95F;
  --emserh-green-deep: #7FB348;
  --emserh-blue: #3FA9D5;
  --emserh-navy: #14304F;
  --emserh-navy-2: #1E4570;
  /* Neutrals */
  --ink: #0F1E2E;
  --ink-2: #2A3B4F;
  --em-muted: #6B7A8C;
  --em-muted-2: #94A1B2;
  --line: #E4E8EE;
  --line-2: #EFF2F6;
  --bg: #F4F6F9;
  --paper: #FFFFFF;
  --paper-soft: #FAFBFC;
  /* Status */
  --ok: #2F7D4A;
  --ok-soft: #E8F3EC;
  --warn: #A86A12;
  --warn-soft: #FBF1DE;
  --err: #B53A2C;
  --err-soft: #FBEDE9;
}

@layer base {
  * { box-sizing: border-box; @apply border-border outline-ring/50; }
  html, body { margin: 0; padding: 0; }
  body {
    background: var(--bg);
    color: var(--ink);
    font-feature-settings: 'ss01', 'cv11';
    -webkit-font-smoothing: antialiased;
    min-height: 100vh;
  }
}

@layer components {
  /* ===== Header ===== */
  .header { background: var(--paper); border-bottom: 1px solid var(--line); position: sticky; top: 0; z-index: 50; }
  .header-inner { max-width: 1200px; margin: 0 auto; padding: 18px 32px; display: flex; align-items: center; gap: 24px; }
  .brand { display: flex; align-items: center; gap: 18px; }
  .brand img { height: 38px; width: auto; display: block; }
  .brand-divider { width: 1px; height: 36px; background: var(--line); flex-shrink: 0; }
  .brand-meta { display: flex; flex-direction: column; gap: 2px; }
  .brand-meta .system { font-size: 15px; font-weight: 600; color: var(--ink); letter-spacing: -0.01em; }
  .brand-meta .dept { font-size: 12px; color: var(--em-muted); letter-spacing: 0.02em; }
  .header-right { margin-left: auto; display: flex; align-items: center; gap: 18px; }
  .header-link { font-size: 13px; color: var(--em-muted); text-decoration: none; font-weight: 500; padding: 8px 10px; border-radius: 6px; transition: all 0.15s; }
  .header-link:hover { color: var(--ink); background: var(--line-2); }
  .header-link.active { color: var(--emserh-navy); font-weight: 600; }
  .user-chip { display: flex; align-items: center; gap: 10px; padding: 6px 6px 6px 14px; border: 1px solid var(--line); border-radius: 999px; background: var(--paper); }
  .user-chip .name { font-size: 13px; font-weight: 500; color: var(--ink-2); }
  .avatar { width: 28px; height: 28px; border-radius: 999px; background: linear-gradient(135deg, var(--emserh-green), var(--emserh-blue)); color: white; font-size: 11px; font-weight: 700; display: grid; place-items: center; letter-spacing: 0.02em; flex-shrink: 0; }

  /* ===== Page shell ===== */
  .page { max-width: 1200px; margin: 0 auto; padding: 36px 32px 96px; display: grid; grid-template-columns: 1fr 320px; gap: 32px; }
  .page-header { grid-column: 1 / -1; display: flex; align-items: flex-end; justify-content: space-between; margin-bottom: 8px; gap: 24px; }
  .breadcrumb { display: flex; align-items: center; gap: 8px; font-size: 12px; color: var(--em-muted); margin-bottom: 8px; letter-spacing: 0.01em; }
  .page-title { font-family: var(--font-instrument-serif), 'Georgia', serif; font-size: 42px; font-weight: 400; color: var(--emserh-navy); letter-spacing: -0.01em; line-height: 1.05; margin: 0 0 6px; }
  .page-title em { font-style: italic; color: var(--emserh-green-deep); }
  .page-sub { font-size: 14px; color: var(--em-muted); max-width: 540px; line-height: 1.5; margin: 0; }

  /* ===== Stepper ===== */
  .stepper { display: flex; align-items: center; gap: 14px; padding: 10px 16px; background: var(--paper); border: 1px solid var(--line); border-radius: 10px; white-space: nowrap; }
  .step { display: flex; align-items: center; gap: 8px; font-size: 12.5px; color: var(--em-muted); font-weight: 500; }
  .step .dot { width: 20px; height: 20px; border-radius: 999px; background: var(--line); color: var(--em-muted); font-size: 10px; font-weight: 700; display: grid; place-items: center; flex-shrink: 0; }
  .step.active { color: var(--emserh-navy); }
  .step.active .dot { background: var(--emserh-navy); color: white; }
  .step.done { color: var(--ink-2); }
  .step.done .dot { background: var(--emserh-green-deep); color: white; }
  .step-sep { width: 18px; height: 1px; background: var(--line); flex-shrink: 0; }

  /* ===== Cards ===== */
  .main { display: flex; flex-direction: column; gap: 20px; min-width: 0; }
  .card { background: var(--paper); border: 1px solid var(--line); border-radius: 14px; overflow: hidden; }
  .card-head { padding: 18px 22px 14px; display: flex; align-items: center; justify-content: space-between; gap: 12px; }
  .card-title { font-size: 13px; font-weight: 600; color: var(--ink); letter-spacing: 0.02em; text-transform: uppercase; display: flex; align-items: center; gap: 10px; }
  .card-title .count { font-size: 11px; font-weight: 600; padding: 2px 8px; border-radius: 999px; background: var(--emserh-navy); color: white; letter-spacing: 0.02em; text-transform: none; }
  .card-action { font-size: 12.5px; font-weight: 500; color: var(--em-muted); cursor: pointer; background: none; border: 0; padding: 4px 8px; border-radius: 6px; transition: all 0.15s; font-family: inherit; }
  .card-action:hover { color: var(--err); background: var(--err-soft); }
  .card-body { padding: 6px 22px 22px; }

  /* ===== Dropzone ===== */
  .dropzone { position: relative; border: 1.5px dashed #C8D1DC; border-radius: 12px; background: radial-gradient(circle at 50% 0%, rgba(157,201,95,0.05), transparent 60%), var(--paper-soft); padding: 56px 32px; text-align: center; cursor: pointer; transition: all 0.2s; outline: none; }
  .dropzone:hover, .dropzone:focus-visible { border-color: var(--emserh-green); background: radial-gradient(circle at 50% 0%, rgba(157,201,95,0.08), transparent 60%), var(--paper-soft); }
  .dropzone.dragging { border-color: var(--emserh-green-deep); border-style: solid; background: radial-gradient(circle at 50% 0%, rgba(157,201,95,0.15), transparent 70%), #F5FAEC; transform: scale(1.005); }
  .dropzone.dz-disabled { opacity: 0.5; pointer-events: none; }
  .dropzone-icon { width: 72px; height: 72px; margin: 0 auto 18px; border-radius: 16px; background: var(--paper); border: 1px solid var(--line); display: grid; place-items: center; color: var(--emserh-navy); box-shadow: 0 6px 20px -8px rgba(20,48,79,0.15); position: relative; }
  .dropzone-icon::after { content: ''; position: absolute; inset: -1px; border-radius: 16px; background: linear-gradient(180deg, transparent, rgba(157,201,95,0.2)); opacity: 0; transition: opacity 0.2s; pointer-events: none; }
  .dropzone:hover .dropzone-icon::after { opacity: 1; }
  .dropzone-title { font-size: 17px; font-weight: 600; color: var(--ink); margin: 0 0 6px; letter-spacing: -0.01em; }
  .dropzone-title .accent { color: var(--emserh-green-deep); text-decoration: underline; text-decoration-color: rgba(127,179,72,0.3); text-underline-offset: 3px; }
  .dropzone-sub { font-size: 13px; color: var(--em-muted); margin: 0; }
  .dropzone-meta { display: flex; justify-content: center; gap: 18px; margin-top: 18px; font-size: 11.5px; color: var(--em-muted-2); letter-spacing: 0.02em; }
  .dropzone-meta .pill { padding: 2px 8px; background: var(--paper); border: 1px solid var(--line); border-radius: 999px; font-family: var(--font-jetbrains-mono), monospace; font-size: 11px; color: var(--em-muted); }

  /* ===== File list ===== */
  .file-list { display: flex; flex-direction: column; gap: 8px; }
  .file-row { display: grid; grid-template-columns: 44px 1fr auto auto; gap: 14px; align-items: center; padding: 12px 14px; background: var(--paper-soft); border: 1px solid var(--line-2); border-radius: 10px; transition: all 0.15s; animation: slideIn 0.25s ease-out; }
  .file-row:hover { border-color: var(--line); background: var(--paper); }
  .file-thumb { width: 44px; height: 52px; border-radius: 6px; background: var(--paper); border: 1px solid var(--line); position: relative; display: grid; place-items: end center; color: var(--err); overflow: hidden; flex-shrink: 0; }
  .file-thumb::before { content: ''; position: absolute; top: 0; right: 0; width: 12px; height: 12px; background: linear-gradient(225deg, var(--line) 50%, transparent 50%); }
  .file-thumb-lines { position: absolute; top: 8px; left: 6px; right: 6px; bottom: 18px; display: flex; flex-direction: column; gap: 3px; }
  .file-thumb-lines div { height: 1.5px; background: var(--line); border-radius: 2px; width: 100%; }
  .file-thumb-lines div:nth-child(2) { width: 80%; }
  .file-thumb-lines div:nth-child(3) { width: 60%; }
  .file-thumb-lines div:nth-child(4) { width: 70%; }
  .file-thumb-label { position: absolute; bottom: 4px; left: 0; right: 0; text-align: center; font-size: 7px; font-weight: 700; color: var(--err); letter-spacing: 0.06em; }
  .file-info { min-width: 0; }
  .file-name { font-size: 14px; font-weight: 500; color: var(--ink); margin: 0 0 4px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .file-meta { display: flex; align-items: center; gap: 8px; font-size: 12px; color: var(--em-muted); }
  .file-status { font-size: 11px; font-weight: 600; padding: 4px 10px; border-radius: 999px; letter-spacing: 0.02em; white-space: nowrap; flex-shrink: 0; }
  .file-status.queued { background: var(--line-2); color: var(--em-muted); }
  .file-status.processing { background: var(--ok-soft); color: var(--ok); animation: pulse 1.5s infinite; }
  .file-remove { width: 30px; height: 30px; border-radius: 8px; background: transparent; border: 0; display: grid; place-items: center; color: var(--em-muted-2); cursor: pointer; transition: all 0.15s; flex-shrink: 0; }
  .file-remove:hover { background: var(--err-soft); color: var(--err); }
  .file-row.analyzing { background: linear-gradient(90deg, rgba(157,201,95,0.06), transparent); border-color: var(--emserh-green); }
  .analyzing-bar { height: 4px; background: var(--line-2); border-radius: 999px; overflow: hidden; margin-top: 8px; }
  .analyzing-bar-inner { height: 100%; background: linear-gradient(90deg, var(--emserh-green), var(--emserh-blue)); border-radius: 999px; animation: progress-grow 2s ease-in-out infinite alternate; }

  /* ===== Buttons ===== */
  .submit-row { display: flex; align-items: center; gap: 14px; margin-top: 18px; }
  .btn-primary { flex: 1; background: var(--emserh-navy); color: white; border: 0; padding: 16px 24px; border-radius: 10px; font-size: 14.5px; font-weight: 600; cursor: pointer; transition: all 0.2s; display: flex; align-items: center; justify-content: center; gap: 10px; letter-spacing: 0.01em; font-family: inherit; }
  .btn-primary:hover { background: var(--emserh-navy-2); transform: translateY(-1px); box-shadow: 0 8px 24px -10px rgba(20,48,79,0.4); }
  .btn-primary:disabled { background: var(--line); color: var(--em-muted-2); cursor: not-allowed; transform: none; box-shadow: none; }
  .btn-primary .arrow { transition: transform 0.2s; }
  .btn-primary:hover .arrow { transform: translateX(3px); }
  .btn-secondary { background: var(--paper); color: var(--ink-2); border: 1px solid var(--line); padding: 16px 18px; border-radius: 10px; font-size: 13.5px; font-weight: 500; cursor: pointer; font-family: inherit; transition: all 0.15s; }
  .btn-secondary:hover { border-color: var(--ink-2); }

  /* ===== Sidebar ===== */
  .side { display: flex; flex-direction: column; gap: 20px; position: sticky; top: 100px; align-self: flex-start; }
  .side .card-body { padding: 0 22px 22px; }
  .checklist { display: flex; flex-direction: column; gap: 12px; }
  .check-item { display: grid; grid-template-columns: 20px 1fr; gap: 12px; font-size: 13px; color: var(--ink-2); line-height: 1.5; }
  .check-icon { width: 20px; height: 20px; border-radius: 6px; background: var(--emserh-green); color: white; display: grid; place-items: center; flex-shrink: 0; margin-top: 1px; }
  .check-item small { display: block; color: var(--em-muted); font-size: 12px; margin-top: 2px; }
  .recent { display: flex; flex-direction: column; }
  .recent-item { padding: 12px 0; border-bottom: 1px solid var(--line-2); display: grid; grid-template-columns: 1fr auto; gap: 8px; align-items: center; }
  .recent-item:last-child { border-bottom: 0; padding-bottom: 0; }
  .recent-item:first-child { padding-top: 0; }
  .recent-name { font-size: 13px; font-weight: 500; color: var(--ink-2); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .recent-date { font-size: 11px; color: var(--em-muted); margin-top: 2px; }
  .em-badge { font-size: 10.5px; font-weight: 700; padding: 3px 8px; border-radius: 999px; letter-spacing: 0.04em; white-space: nowrap; }
  .em-badge.ok { background: var(--ok-soft); color: var(--ok); }
  .em-badge.warn { background: var(--warn-soft); color: var(--warn); }
  .em-badge.err { background: var(--err-soft); color: var(--err); }

  /* ===== Results ===== */
  .results-summary { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin: 8px 0 18px; }
  .stat { padding: 14px 16px; border-radius: 10px; background: var(--paper-soft); border: 1px solid var(--line-2); }
  .stat .lbl { font-size: 11px; text-transform: uppercase; letter-spacing: 0.06em; color: var(--em-muted); font-weight: 600; }
  .stat .val { font-family: var(--font-instrument-serif), 'Georgia', serif; font-size: 36px; line-height: 1; margin-top: 6px; color: var(--ink); }
  .stat.ok .val { color: var(--ok); }
  .stat.warn .val { color: var(--warn); }
  .stat.err .val { color: var(--err); }
  .findings { display: flex; flex-direction: column; gap: 1px; background: var(--line-2); border-radius: 10px; overflow: hidden; border: 1px solid var(--line-2); }
  .finding { padding: 14px 16px; background: var(--paper); display: grid; grid-template-columns: auto 1fr auto; gap: 14px; align-items: start; }
  .finding-dot { width: 8px; height: 8px; border-radius: 999px; margin-top: 7px; flex-shrink: 0; }
  .finding-dot.ok { background: var(--ok); }
  .finding-dot.warn { background: var(--warn); }
  .finding-dot.err { background: var(--err); }
  .finding-title { font-size: 13.5px; font-weight: 600; color: var(--ink); margin: 0 0 3px; }
  .finding-desc { font-size: 12.5px; color: var(--em-muted); margin: 0; line-height: 1.5; }
  .finding-ref { font-family: var(--font-jetbrains-mono), monospace; font-size: 11px; color: var(--em-muted); background: var(--line-2); padding: 3px 8px; border-radius: 6px; white-space: nowrap; align-self: start; margin-top: 2px; }
  .contract-id { background: var(--paper-soft); border: 1px solid var(--line-2); border-radius: 10px; padding: 14px 16px; margin-bottom: 18px; }
  .contract-id-grid { display: grid; grid-template-columns: auto 1fr; gap: 4px 16px; font-size: 13px; }
  .contract-id-grid dt { color: var(--em-muted); font-weight: 500; white-space: nowrap; }
  .contract-id-grid dd { color: var(--ink-2); margin: 0; font-weight: 500; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .download-row { display: flex; gap: 12px; flex-wrap: wrap; margin-top: 18px; }
  .btn-dl-primary { display: flex; align-items: center; gap: 8px; background: var(--emserh-navy); color: white; border: 0; padding: 12px 20px; border-radius: 8px; font-size: 13.5px; font-weight: 600; cursor: pointer; font-family: inherit; transition: all 0.2s; }
  .btn-dl-primary:hover { background: var(--emserh-navy-2); }
  .btn-dl-secondary { display: flex; align-items: center; gap: 8px; background: var(--paper); color: var(--ink-2); border: 1px solid var(--line); padding: 12px 20px; border-radius: 8px; font-size: 13.5px; font-weight: 500; cursor: pointer; font-family: inherit; transition: all 0.15s; }
  .btn-dl-secondary:hover { border-color: var(--ink-2); }

  /* ===== Misc ===== */
  .spinner { width: 14px; height: 14px; border: 2px solid rgba(255,255,255,0.3); border-top-color: white; border-radius: 999px; animation: spin 0.7s linear infinite; }
  .footer-note { grid-column: 1 / -1; text-align: center; font-size: 11.5px; color: var(--em-muted-2); margin-top: 16px; letter-spacing: 0.02em; }

  /* ===== Responsive ===== */
  @media (max-width: 980px) {
    .page { grid-template-columns: 1fr; }
    .side { position: static; }
    .header-right .header-link { display: none; }
  }

  /* ===== Animations ===== */
  @keyframes slideIn { from { opacity: 0; transform: translateY(-4px); } to { opacity: 1; transform: translateY(0); } }
  @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }
  @keyframes spin { to { transform: rotate(360deg); } }
  @keyframes progress-grow { from { width: 30%; } to { width: 85%; } }
}
```

- [ ] **Passo 2: Reescrever layout.tsx**

Substituir o conteúdo completo de `src/app/layout.tsx` por:

```tsx
import type { Metadata } from "next";
import { Inter, Instrument_Serif, JetBrains_Mono } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const instrumentSerif = Instrument_Serif({
  subsets: ["latin"],
  weight: "400",
  style: ["normal", "italic"],
  variable: "--font-instrument-serif",
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-jetbrains-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Auditor de Conformidade · EMSERH",
  description: "GCIF — Gerência de Controle Interno Financeiro · Sistema de auditoria documental.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="pt-BR"
      className={`${inter.variable} ${instrumentSerif.variable} ${jetbrainsMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
```

- [ ] **Passo 3: Verificar que o servidor sobe sem erro**

```
npm run dev
```

Esperado: servidor sobe em `http://localhost:3000` sem erros no terminal. O fundo da página deve ser `#F4F6F9` (cinza suave) em vez de branco.

- [ ] **Passo 4: Commit**

```
git add src/app/globals.css src/app/layout.tsx
git commit -m "feat(ui): tokens de design EMSERH + fontes Inter/InstrumentSerif/JetBrainsMono"
```

---

### Tarefa 2: Componente Header

**Arquivos:**
- Criar: `src/components/Header.tsx`

- [ ] **Passo 1: Criar src/components/Header.tsx**

```tsx
export function Header() {
  return (
    <header className="header">
      <div className="header-inner">
        <div className="brand">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo-emserh.png" alt="EMSERH" />
          <div className="brand-divider" />
          <div className="brand-meta">
            <div className="system">Auditor de Conformidade</div>
            <div className="dept">GCIF · Gerência de Controle Interno Financeiro</div>
          </div>
        </div>
        <div className="header-right">
          <a className="header-link active" href="#">Nova análise</a>
          <a className="header-link" href="#">Histórico</a>
          <a className="header-link" href="#">Normativos</a>
          <div className="user-chip">
            <span className="name">M. Carvalho</span>
            <div className="avatar">MC</div>
          </div>
        </div>
      </div>
    </header>
  );
}
```

- [ ] **Passo 2: Commit**

```
git add src/components/Header.tsx
git commit -m "feat(ui): componente Header com logo, nav decorativa e user chip"
```

---

### Tarefa 3: Componente Stepper

**Arquivos:**
- Criar: `src/components/Stepper.tsx`

- [ ] **Passo 1: Criar src/components/Stepper.tsx**

```tsx
interface StepperProps {
  step: 1 | 2 | 3;
}

const STEPS = ['Envio', 'Análise', 'Relatório'] as const;

export function Stepper({ step }: StepperProps) {
  const nodes: React.ReactNode[] = [];
  STEPS.forEach((label, idx) => {
    const num = (idx + 1) as 1 | 2 | 3;
    const cls = num < step ? 'step done' : num === step ? 'step active' : 'step';
    nodes.push(
      <div key={label} className={cls}>
        <div className="dot">{num < step ? '✓' : num}</div>
        <span>{label}</span>
      </div>,
    );
    if (idx < STEPS.length - 1) {
      nodes.push(<div key={`sep-${idx}`} className="step-sep" />);
    }
  });
  return <div className="stepper">{nodes}</div>;
}
```

- [ ] **Passo 2: Commit**

```
git add src/components/Stepper.tsx
git commit -m "feat(ui): componente Stepper (Envio → Análise → Relatório)"
```

---

### Tarefa 4: Componente Sidebar

**Arquivos:**
- Criar: `src/components/Sidebar.tsx`

- [ ] **Passo 1: Criar src/components/Sidebar.tsx**

```tsx
const CHECK_ITEMS = [
  {
    title: 'Empenho, liquidação e pagamento',
    sub: 'Conferência dos três estágios da despesa pública.',
  },
  {
    title: 'Certidões e habilitação',
    sub: 'Validade fiscal, trabalhista e previdenciária.',
  },
  {
    title: 'Assinaturas e atestos',
    sub: 'Identifica responsáveis e datas exigidas.',
  },
  {
    title: 'Vinculação ao contrato',
    sub: 'Itens, valores e prazos vs. instrumento contratual.',
  },
] as const;

const RECENT_ITEMS = [
  {
    name: 'Processo 2024.0451 — Hosp. Carlos Macieira',
    date: 'há 2 horas · 14 documentos',
    badge: null,
  },
  {
    name: 'Empenho 2024.388 — Manut. predial',
    date: 'ontem · 7 documentos',
    badge: { cls: 'warn', label: '3 OBS.' },
  },
  {
    name: 'Contrato 097/2024 — Insumos',
    date: '3 dias · 22 documentos',
    badge: { cls: 'err', label: '5 NC' },
  },
] as const;

function CheckIcon() {
  return (
    <div className="check-icon">
      <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
        <path
          d="M2 5.5L4.5 8L9 3"
          stroke="white"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </div>
  );
}

export function Sidebar() {
  return (
    <aside className="side">
      <div className="card">
        <div className="card-head">
          <div className="card-title">O que é verificado</div>
        </div>
        <div className="card-body">
          <div className="checklist">
            {CHECK_ITEMS.map((item) => (
              <div key={item.title} className="check-item">
                <CheckIcon />
                <div>
                  {item.title}
                  <small>{item.sub}</small>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-head">
          <div className="card-title">Análises Recentes</div>
        </div>
        <div className="card-body" style={{ paddingTop: '6px' }}>
          <div className="recent">
            {RECENT_ITEMS.map((item) => (
              <div key={item.name} className="recent-item">
                <div>
                  <div className="recent-name">{item.name}</div>
                  <div className="recent-date">{item.date}</div>
                </div>
                {item.badge && (
                  <span className={`em-badge ${item.badge.cls}`}>{item.badge.label}</span>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </aside>
  );
}
```

- [ ] **Passo 2: Commit**

```
git add src/components/Sidebar.tsx
git commit -m "feat(ui): componente Sidebar estático (checklist + análises recentes)"
```

---

### Tarefa 5: Reescrever UploadArea

**Arquivos:**
- Modificar: `src/components/UploadArea.tsx`

- [ ] **Passo 1: Substituir conteúdo completo de src/components/UploadArea.tsx**

```tsx
'use client';

import { useRef, useState, useCallback } from 'react';

interface UploadAreaProps {
  onFilesSelected: (files: File[]) => void;
  disabled?: boolean;
}

export function UploadArea({ onFilesSelected, disabled = false }: UploadAreaProps) {
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFiles = useCallback(
    (files: FileList | null) => {
      if (!files) return;
      const pdfs = Array.from(files).filter(
        (f) => f.type === 'application/pdf' || f.name.toLowerCase().endsWith('.pdf'),
      );
      if (pdfs.length > 0) onFilesSelected(pdfs);
    },
    [onFilesSelected],
  );

  return (
    <div
      role="button"
      tabIndex={0}
      aria-label="Área de upload de PDFs"
      className={[
        'dropzone',
        dragging ? 'dragging' : '',
        disabled ? 'dz-disabled' : '',
      ]
        .filter(Boolean)
        .join(' ')}
      onClick={() => !disabled && inputRef.current?.click()}
      onKeyDown={(e) => e.key === 'Enter' && !disabled && inputRef.current?.click()}
      onDragOver={(e) => {
        e.preventDefault();
        if (!disabled) setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragging(false);
        if (!disabled) handleFiles(e.dataTransfer.files);
      }}
    >
      <input
        ref={inputRef}
        type="file"
        accept=".pdf,application/pdf"
        multiple
        style={{ display: 'none' }}
        disabled={disabled}
        onChange={(e) => handleFiles(e.target.files)}
      />
      <div className="dropzone-icon">
        <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
          <path
            d="M16 6V22M16 6L10 12M16 6L22 12"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d="M5 22V25C5 26.1046 5.89543 27 7 27H25C26.1046 27 27 26.1046 27 25V22"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          />
        </svg>
      </div>
      <h3 className="dropzone-title">
        Arraste os PDFs ou <span className="accent">clique para selecionar</span>
      </h3>
      <p className="dropzone-sub">
        Aceita um ou mais arquivos · processos, empenhos, notas fiscais, contratos
      </p>
      <div className="dropzone-meta">
        <span>
          <span className="pill">PDF</span>
        </span>
        <span>
          <span className="pill">máx. 50 MB</span>
        </span>
        <span>
          <span className="pill">até 20 arquivos</span>
        </span>
      </div>
    </div>
  );
}
```

- [ ] **Passo 2: Commit**

```
git add src/components/UploadArea.tsx
git commit -m "feat(ui): UploadArea redesenhada com dropzone EMSERH"
```

---

### Tarefa 6: Simplificar ProgressIndicator (tipos apenas)

**Arquivos:**
- Modificar: `src/components/ProgressIndicator.tsx`

- [ ] **Passo 1: Substituir conteúdo completo de src/components/ProgressIndicator.tsx**

```tsx
export type AnalysisStage =
  | 'idle'
  | 'extracting'
  | 'ocr'
  | 'analyzing'
  | 'generating'
  | 'done'
  | 'error';
```

- [ ] **Passo 2: Commit**

```
git add src/components/ProgressIndicator.tsx
git commit -m "refactor(ui): ProgressIndicator reduzido a exportação de tipo AnalysisStage"
```

---

### Tarefa 7: Reescrever page.tsx

**Arquivos:**
- Modificar: `src/app/page.tsx`

- [ ] **Passo 1: Substituir conteúdo completo de src/app/page.tsx**

```tsx
'use client';

import { useState, useEffect, useRef } from 'react';
import { Header } from '@/components/Header';
import { Stepper } from '@/components/Stepper';
import { Sidebar } from '@/components/Sidebar';
import { UploadArea } from '@/components/UploadArea';
import { ResultPanel } from '@/components/ResultPanel';
import type { AnalysisResult } from '@/lib/types';
import type { AnalysisStage } from '@/components/ProgressIndicator';

interface AnalysisResultEntry {
  filename: string;
  analysis: AnalysisResult;
  reportPdfBase64: string;
  annotatedPdfBase64: string;
}

type SSEEvent =
  | { type: 'progress'; stage: AnalysisStage; message: string }
  | {
      type: 'result';
      results: Array<{
        filename: string;
        analysis: AnalysisResult;
        reportPdf: string;
        annotatedPdf: string;
      }>;
    }
  | { type: 'error'; message: string };

function formatSize(bytes: number): string {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function formatTime(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}m ${s.toString().padStart(2, '0')}s`;
}

function BreadcrumbChevron() {
  return (
    <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
      <path
        d="M3.5 2L6.5 5L3.5 8"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function ArrowRight() {
  return (
    <svg
      className="arrow"
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
    >
      <path
        d="M3 8h10M9 4l4 4-4 4"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function FileThumbnail() {
  return (
    <div className="file-thumb">
      <div className="file-thumb-lines">
        <div />
        <div />
        <div />
        <div />
      </div>
      <span className="file-thumb-label">PDF</span>
    </div>
  );
}

function XIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
      <path
        d="M2 2l10 10M12 2L2 12"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

export default function Home() {
  const [stage, setStage] = useState<AnalysisStage>('idle');
  const [subMessage, setSubMessage] = useState<string | undefined>();
  const [results, setResults] = useState<AnalysisResultEntry[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [processingFiles, setProcessingFiles] = useState<File[]>([]);
  const startTimeRef = useRef<number | null>(null);

  useEffect(() => {
    if (stage === 'extracting') {
      startTimeRef.current = Date.now();
      setElapsedSeconds(0);
    }
    const isActive = stage !== 'idle' && stage !== 'done' && stage !== 'error';
    if (!isActive) return;
    const interval = setInterval(() => {
      if (startTimeRef.current !== null) {
        setElapsedSeconds(Math.round((Date.now() - startTimeRef.current) / 1000));
      }
    }, 500);
    return () => clearInterval(interval);
  }, [stage]);

  function handleFilesAdded(files: File[]) {
    setPendingFiles((prev) => {
      const existing = new Set(prev.map((f) => `${f.name}-${f.size}`));
      return [...prev, ...files.filter((f) => !existing.has(`${f.name}-${f.size}`))];
    });
  }

  function removePendingFile(index: number) {
    setPendingFiles((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleStartAnalysis() {
    if (pendingFiles.length === 0) return;
    const files = [...pendingFiles];
    setProcessingFiles(files);
    setPendingFiles([]);
    await runAnalysis(files);
    setProcessingFiles([]);
  }

  async function runAnalysis(files: File[]) {
    setResults([]);
    setError(null);
    setSubMessage(undefined);

    const formData = new FormData();
    for (const f of files) formData.append('files', f);

    setStage('extracting');

    try {
      const res = await fetch('/api/analyze', { method: 'POST', body: formData });

      if (!res.ok) {
        const body = await res.json().catch(() => ({ error: '' }));
        throw new Error(body.error || `Erro HTTP ${res.status}`);
      }

      const reader = res.body!.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          let event: SSEEvent;
          try {
            event = JSON.parse(line.slice(6)) as SSEEvent;
          } catch {
            continue;
          }

          if (event.type === 'progress') {
            setStage(event.stage);
            setSubMessage(event.message);
          } else if (event.type === 'result') {
            if (startTimeRef.current !== null) {
              setElapsedSeconds(Math.round((Date.now() - startTimeRef.current) / 1000));
            }
            setResults(
              event.results.map((r) => ({
                filename: r.filename,
                analysis: r.analysis,
                reportPdfBase64: r.reportPdf,
                annotatedPdfBase64: r.annotatedPdf,
              })),
            );
            setStage('done');
          } else if (event.type === 'error') {
            throw new Error(event.message);
          }
        }
      }
    } catch (err) {
      if (startTimeRef.current !== null) {
        setElapsedSeconds(Math.round((Date.now() - startTimeRef.current) / 1000));
      }
      setError(err instanceof Error ? err.message : String(err));
      setStage('error');
    }
  }

  const isProcessing = stage !== 'idle' && stage !== 'done' && stage !== 'error';
  const stepperStep: 1 | 2 | 3 = stage === 'done' ? 3 : isProcessing ? 2 : 1;

  return (
    <>
      <Header />
      <main className="page">
        {/* Page header */}
        <div className="page-header">
          <div>
            <div className="breadcrumb">
              <span>GCIF</span>
              <BreadcrumbChevron />
              <span>Auditoria documental</span>
              <BreadcrumbChevron />
              <span>Nova análise</span>
            </div>
            <h1 className="page-title">
              Submeta os documentos
              <br />
              para <em>análise de conformidade</em>
            </h1>
            <p className="page-sub">
              Envie processos de pagamento, contratos e notas fiscais em PDF. O sistema
              verifica os itens conforme a IN nº 03/2021 e devolve um relatório com as
              não conformidades.
            </p>
          </div>
          <Stepper step={stepperStep} />
        </div>

        {/* Main column */}
        <div className="main">
          {/* Upload card — visível apenas quando não está processando nem concluído */}
          {!isProcessing && stage !== 'done' && (
            <div className="card">
              <div className="card-head">
                <div className="card-title">
                  Adicionar arquivos
                  {pendingFiles.length > 0 && (
                    <span className="count">{pendingFiles.length}</span>
                  )}
                </div>
              </div>
              <div className="card-body">
                <UploadArea onFilesSelected={handleFilesAdded} disabled={isProcessing} />
              </div>
            </div>
          )}

          {/* Fila de arquivos */}
          {pendingFiles.length > 0 && !isProcessing && (
            <div className="card">
              <div className="card-head">
                <div className="card-title">
                  Fila de análise
                  <span className="count">{pendingFiles.length}</span>
                </div>
                <button className="card-action" onClick={() => setPendingFiles([])}>
                  Limpar tudo
                </button>
              </div>
              <div className="card-body">
                <div className="file-list">
                  {pendingFiles.map((f, i) => (
                    <div key={`${f.name}-${f.size}-${i}`} className="file-row">
                      <FileThumbnail />
                      <div className="file-info">
                        <div className="file-name">{f.name}</div>
                        <div className="file-meta">
                          <span>{formatSize(f.size)}</span>
                        </div>
                      </div>
                      <span className="file-status queued">Na fila</span>
                      <button
                        className="file-remove"
                        aria-label={`Remover ${f.name}`}
                        onClick={() => removePendingFile(i)}
                      >
                        <XIcon />
                      </button>
                    </div>
                  ))}
                </div>
                <div className="submit-row">
                  <button className="btn-primary" onClick={handleStartAnalysis}>
                    Iniciar análise de {pendingFiles.length} arquivo
                    {pendingFiles.length > 1 ? 's' : ''}
                    <ArrowRight />
                  </button>
                  <button className="btn-secondary" onClick={() => setPendingFiles([])}>
                    Limpar
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Estado de processamento */}
          {isProcessing && (
            <div className="card">
              <div className="card-head">
                <div className="card-title">
                  Processando
                  <span className="count">
                    <span className="spinner" />
                  </span>
                </div>
                {elapsedSeconds > 0 && (
                  <span
                    style={{
                      fontSize: '12px',
                      color: 'var(--em-muted)',
                      fontFamily: 'var(--font-jetbrains-mono)',
                    }}
                  >
                    {formatTime(elapsedSeconds)}
                  </span>
                )}
              </div>
              <div className="card-body">
                <div className="file-list">
                  {processingFiles.map((f) => (
                    <div key={`${f.name}-${f.size}`} className="file-row analyzing">
                      <FileThumbnail />
                      <div className="file-info">
                        <div className="file-name">{f.name}</div>
                        <div className="file-meta">
                          <span>{formatSize(f.size)}</span>
                        </div>
                        <div className="analyzing-bar">
                          <div className="analyzing-bar-inner" />
                        </div>
                      </div>
                      <span className="file-status processing">Analisando</span>
                      <div />
                    </div>
                  ))}
                </div>
                {subMessage && (
                  <p
                    style={{
                      marginTop: '14px',
                      fontSize: '12.5px',
                      color: 'var(--em-muted)',
                    }}
                  >
                    {subMessage}
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Erro */}
          {stage === 'error' && error && (
            <div className="card" style={{ borderColor: 'var(--err)' }}>
              <div className="card-head">
                <div className="card-title" style={{ color: 'var(--err)' }}>
                  Erro na análise
                </div>
              </div>
              <div className="card-body">
                <p
                  style={{
                    fontSize: '13px',
                    color: 'var(--em-muted)',
                    fontFamily: 'var(--font-jetbrains-mono)',
                    wordBreak: 'break-all',
                    lineHeight: 1.6,
                  }}
                >
                  {error}
                </p>
                <button
                  className="btn-secondary"
                  style={{ marginTop: '14px' }}
                  onClick={() => {
                    setStage('idle');
                    setError(null);
                  }}
                >
                  ← Tentar novamente
                </button>
              </div>
            </div>
          )}

          {/* Resultados */}
          {results.map((r) => (
            <ResultPanel
              key={r.filename}
              filename={r.filename}
              analysis={r.analysis}
              reportPdfBase64={r.reportPdfBase64}
              annotatedPdfBase64={r.annotatedPdfBase64}
            />
          ))}

          {/* Botão nova análise */}
          {stage === 'done' && (
            <button
              className="btn-secondary"
              onClick={() => {
                setStage('idle');
                setResults([]);
                setPendingFiles([]);
              }}
            >
              ← Nova análise
            </button>
          )}

          <p className="footer-note">
            Conforme <strong>IN EMSERH nº 03/2021</strong> — Uso exclusivo GCIF.
          </p>
        </div>

        {/* Sidebar */}
        <Sidebar />
      </main>
    </>
  );
}
```

- [ ] **Passo 2: Commit**

```
git add src/app/page.tsx
git commit -m "feat(ui): page.tsx reescrito — layout 2 colunas, todos os estados EMSERH"
```

---

### Tarefa 8: Reescrever ResultPanel

**Arquivos:**
- Modificar: `src/components/ResultPanel.tsx`

- [ ] **Passo 1: Substituir conteúdo completo de src/components/ResultPanel.tsx**

```tsx
'use client';

import type { AnalysisResult, ChecklistItemStatus } from '@/lib/types';

function downloadBase64(base64: string, filename: string) {
  const link = document.createElement('a');
  link.href = `data:application/pdf;base64,${base64}`;
  link.download = filename;
  link.click();
}

function dotClass(status: ChecklistItemStatus): string {
  if (status === 'CONFORME') return 'ok';
  if (status === 'NAO_CONFORME') return 'err';
  return 'warn';
}

interface ResultPanelProps {
  filename: string;
  analysis: AnalysisResult;
  reportPdfBase64: string;
  annotatedPdfBase64: string;
}

export function ResultPanel({
  filename,
  analysis,
  reportPdfBase64,
  annotatedPdfBase64,
}: ResultPanelProps) {
  const { identificacao_contrato: id, conclusao } = analysis;
  const allItems = [
    ...analysis.regularidade_fiscal_trabalhista,
    ...analysis.instrucao_processual,
  ];

  return (
    <div className="card">
      {/* Header band */}
      <div
        style={{
          background: 'var(--emserh-navy)',
          padding: '18px 22px',
        }}
      >
        <div
          style={{
            fontSize: '11px',
            color: 'rgba(255,255,255,0.55)',
            textTransform: 'uppercase',
            letterSpacing: '0.06em',
            marginBottom: '4px',
            fontWeight: 600,
          }}
        >
          Resultado da Análise
        </div>
        <div
          style={{
            fontSize: '16px',
            fontWeight: 600,
            color: 'white',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {filename}
        </div>
      </div>

      <div className="card-body" style={{ paddingTop: '18px' }}>
        {/* Identificação do contrato */}
        <div className="contract-id">
          <dl className="contract-id-grid">
            <dt>Credor</dt>
            <dd title={id.credor}>{id.credor}</dd>
            <dt>CNPJ</dt>
            <dd>{id.cnpj}</dd>
            <dt>Contrato</dt>
            <dd>{id.contrato_numero}</dd>
            <dt>Período</dt>
            <dd>{id.periodo_referencia}</dd>
            <dt>Processo SEI</dt>
            <dd>{id.processo_sei}</dd>
            <dt>Valor Total</dt>
            <dd>{id.valor_total}</dd>
          </dl>
        </div>

        {/* Estatísticas */}
        <div className="results-summary">
          <div className="stat ok">
            <div className="lbl">Conformes</div>
            <div className="val">{conclusao.total_itens_conformes}</div>
          </div>
          <div className="stat warn">
            <div className="lbl">Atenção</div>
            <div className="val">{conclusao.total_itens_atencao}</div>
          </div>
          <div className="stat err">
            <div className="lbl">Não Conformes</div>
            <div className="val">{conclusao.total_itens_nao_conformes}</div>
          </div>
        </div>

        {/* Resumo */}
        {conclusao.resumo && (
          <p
            style={{
              fontSize: '13.5px',
              color: 'var(--ink-2)',
              lineHeight: 1.6,
              marginBottom: '18px',
            }}
          >
            {conclusao.resumo}
          </p>
        )}

        {/* Findings */}
        <div className="findings">
          {allItems.map((item) => (
            <div key={item.item} className="finding">
              <div className={`finding-dot ${dotClass(item.status)}`} />
              <div>
                <div className="finding-title">{item.descricao}</div>
                {item.motivo && <p className="finding-desc">{item.motivo}</p>}
                {item.sugestao_correcao && (
                  <p
                    className="finding-desc"
                    style={{ color: 'var(--warn)', marginTop: '4px' }}
                  >
                    ► {item.sugestao_correcao}
                  </p>
                )}
              </div>
              {item.documento_verificador ? (
                <span className="finding-ref">{item.documento_verificador}</span>
              ) : (
                <div />
              )}
            </div>
          ))}
        </div>

        {/* Downloads */}
        <div className="download-row">
          <button
            className="btn-dl-primary"
            onClick={() =>
              downloadBase64(reportPdfBase64, `relatorio-conformidade-${filename}`)
            }
          >
            ↓ Relatório de Conformidade
          </button>
          <button
            className="btn-dl-secondary"
            onClick={() =>
              downloadBase64(annotatedPdfBase64, `processo-anotado-${filename}`)
            }
          >
            ↓ PDF Anotado
          </button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Passo 2: Commit**

```
git add src/components/ResultPanel.tsx
git commit -m "feat(ui): ResultPanel redesenhado com stat grid + findings list EMSERH"
```

---

### Tarefa 9: Push final

- [ ] **Passo 1: Verificar build**

```
npm run build
```

Esperado: build sem erros. Warnings de lint são aceitáveis.

- [ ] **Passo 2: Push**

```
git push
```

Esperado: Railway inicia deploy automaticamente.
