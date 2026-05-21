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
      className={['dropzone', dragging ? 'dragging' : '', disabled ? 'dz-disabled' : '']
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
          <span className="pill">máx. 200 MB</span>
        </span>
        <span>
          <span className="pill">até 20 arquivos</span>
        </span>
      </div>
    </div>
  );
}
