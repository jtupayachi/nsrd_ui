import React, { useRef, useState } from 'react';
import './FileUpload.css';

interface FileUploadProps {
  accept: string;           /* e.g. ".svg" or ".csv" */
  onFile: (file: { content: string; name: string }) => void;
}

const FileUpload: React.FC<FileUploadProps> = ({ accept, onFile }) => {
  const ref = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState('');

  const process = async (file: File) => {
    setError('');
    const ext = file.name.split('.').pop()?.toLowerCase();
    const allowed = accept.replace(/\./g, '').split(',');
    if (!ext || !allowed.includes(ext)) {
      setError(`Only ${accept} files allowed`);
      return;
    }
    const content = await file.text();
    onFile({ content, name: file.name });
  };

  return (
    <div
      className={`fu-zone${dragging ? ' drag' : ''}`}
      onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => { e.preventDefault(); setDragging(false); if (e.dataTransfer.files[0]) process(e.dataTransfer.files[0]); }}
      onClick={() => ref.current?.click()}
    >
      <input ref={ref} type="file" accept={accept} hidden onChange={(e) => { if (e.target.files?.[0]) process(e.target.files[0]); }} />
      <span className="fu-icon">☁️</span>
      <span className="fu-text">Drop {accept} file or click</span>
      {error && <span className="fu-err">⚠ {error}</span>}
    </div>
  );
};

export default FileUpload;
