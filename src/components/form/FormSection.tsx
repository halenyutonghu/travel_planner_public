import { useEffect, useRef, useState, type ReactNode } from 'react';

export interface FormSectionProps {
  title: string;
  children: ReactNode;
  collapsible?: boolean;
  open?: boolean;
}

export function FormSection({ title, children, collapsible = false, open }: FormSectionProps) {
  if (collapsible) {
    return <CollapsibleFormSection title={title} open={open}>{children}</CollapsibleFormSection>;
  }
  return <section className="form-section"><h2>{title}</h2><div className="form-section__body">{children}</div></section>;
}

function CollapsibleFormSection({ title, children, open }: Pick<FormSectionProps, 'title' | 'children' | 'open'>) {
  const [hovered, setHovered] = useState(false);
  const [pinnedOpen, setPinnedOpen] = useState(false);
  const [renderOpen, setRenderOpen] = useState(Boolean(open));
  const [visualOpen, setVisualOpen] = useState(Boolean(open));
  const closeTimer = useRef<number | null>(null);
  const isOpen = Boolean(open || hovered || pinnedOpen);

  useEffect(() => {
    if (closeTimer.current !== null) {
      window.clearTimeout(closeTimer.current);
      closeTimer.current = null;
    }
    if (isOpen) {
      setRenderOpen(true);
      window.requestAnimationFrame(() => setVisualOpen(true));
      return;
    }
    setVisualOpen(false);
    closeTimer.current = window.setTimeout(() => setRenderOpen(false), 260);
    return () => {
      if (closeTimer.current !== null) window.clearTimeout(closeTimer.current);
    };
  }, [isOpen]);

  return (
    <details className={`form-section form-section--collapsible${visualOpen ? ' is-expanded' : ''}`} open={renderOpen} onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}>
      <summary onClick={(event) => { event.preventDefault(); setPinnedOpen(true); }}><h2>{title}</h2></summary>
      <div className="form-section__reveal"><div className="form-section__body">{children}</div></div>
    </details>
  );
}
