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
