'use client';

import { useRef, useState, useCallback } from 'react';

interface UploadAreaProps {
  onFilesSelected: (files: File[]) => void;
  disabled?: boolean;
}

export function UploadArea({ onFilesSelected, disabled = false }: UploadAreaProps) {
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFiles = useCallback(
    (files: FileList | null) => {
      if (!files) return;
      const pdfs = Array.from(files).filter(
        (f) => f.type === 'application/pdf' || f.name.toLowerCase().endsWith('.pdf'),
      );
      if (pdfs.length === 0) {
        alert('Selecione apenas arquivos PDF.');
        return;
      }
      onFilesSelected(pdfs);
    },
    [onFilesSelected],
  );

  return (
    <div
      role="region"
      aria-label="Área de upload de arquivos PDF"
      onDragOver={(e) => {
        e.preventDefault();
        if (!disabled) setDragOver(true);
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragOver(false);
        if (!disabled) handleFiles(e.dataTransfer.files);
      }}
      onClick={() => !disabled && inputRef.current?.click()}
      className={[
        'flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed p-12 text-center transition-colors cursor-pointer select-none',
        dragOver ? 'border-blue-500 bg-blue-50' : 'border-gray-300 hover:border-blue-400 hover:bg-gray-50',
        disabled ? 'opacity-50 cursor-not-allowed' : '',
      ].join(' ')}
    >
      <input
        ref={inputRef}
        type="file"
        accept=".pdf,application/pdf"
        multiple
        className="hidden"
        disabled={disabled}
        onChange={(e) => handleFiles(e.target.files)}
        aria-hidden="true"
      />
      <div className="text-5xl">📄</div>
      <p className="text-lg font-medium text-gray-700">
        Arraste os PDFs aqui ou clique para selecionar
      </p>
      <p className="text-sm text-gray-400">
        Suporta um ou mais arquivos PDF (máx. 50 MB cada)
      </p>
    </div>
  );
}
