'use client';

import { useCallback, useRef, useState } from 'react';
import LettersModal from './LettersModal';
import {
  findInvalidInputLines,
  sanitizeInputText,
  type InvalidInputLine,
} from '@/lib/normalize';

interface FileUploadProps {
  onCheck: (numbers: string[]) => void;
  isChecking: boolean;
}

export default function FileUpload({ onCheck, isChecking }: FileUploadProps) {
  const [text, setText] = useState('');
  const [dragOver, setDragOver] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [invalidLines, setInvalidLines] = useState<InvalidInputLine[] | null>(
    null
  );
  const fileInputRef = useRef<HTMLInputElement>(null);

  const parseFile = useCallback(async (file: File) => {
    const content = await file.text();
    const lines = content
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line.length > 0);

    if (file.name.toLowerCase().endsWith('.csv')) {
      const first = lines[0]?.split(',')[0].trim() ?? '';
      const hasHeader = /^(phone|номер|number)$/i.test(first);
      const dataLines = hasHeader ? lines.slice(1) : lines;
      return dataLines.map((line) => line.split(',')[0].trim()).filter(Boolean);
    }

    return lines;
  }, []);

  const handleFiles = useCallback(
    async (files: FileList | null) => {
      if (!files || files.length === 0) return;

      const file = files[0];
      const numbers = await parseFile(file);
      setText(numbers.join('\n'));
      setError(null);
      setInvalidLines(null);
    },
    [parseFile]
  );

  const runCheck = useCallback(
    (rawText: string) => {
      const cleaned = sanitizeInputText(rawText);
      const numbers = cleaned
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter((line) => line.length > 0);

      if (numbers.length === 0) {
        setError('Загрузите номера');
        return;
      }

      setText(cleaned);
      setError(null);
      onCheck(numbers);
    },
    [onCheck]
  );

  const handleCheck = () => {
    const badLines = findInvalidInputLines(text);

    if (badLines.length > 0) {
      setInvalidLines(badLines);
      return;
    }

    runCheck(text);
  };

  const handleFixLetters = () => {
    const cleaned = sanitizeInputText(text);
    setText(cleaned);
    setInvalidLines(null);
  };

  return (
    <>
      {invalidLines && invalidLines.length > 0 && (
        <LettersModal
          lines={invalidLines}
          onFix={handleFixLetters}
          onClose={() => setInvalidLines(null)}
        />
      )}

      <div className="space-y-4">
        <div
          className={`rounded-lg border-2 border-dashed p-8 text-center transition-colors ${
            dragOver
              ? 'border-blue-400 bg-blue-50'
              : 'border-slate-300 bg-slate-50 hover:border-slate-400'
          }`}
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragOver(false);
            handleFiles(e.dataTransfer.files);
          }}
          onClick={() => fileInputRef.current?.click()}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              fileInputRef.current?.click();
            }
          }}
        >
          <p className="text-slate-700">
            Перетащите файл <strong>.txt</strong> или <strong>.csv</strong> сюда
          </p>
          <p className="mt-1 text-sm text-slate-500">
            или нажмите для выбора или отожмись иди 100 раз
          </p>
          <input
            ref={fileInputRef}
            type="file"
            accept=".txt,.csv"
            className="hidden"
            onChange={(e) => handleFiles(e.target.files)}
          />
        </div>

        <div>
          <label
            htmlFor="numbers-textarea"
            className="mb-2 block text-sm font-medium text-slate-700"
          >
            или вставьте номера
          </label>
          <textarea
            id="numbers-textarea"
            value={text}
            onChange={(e) => {
              setText(e.target.value);
              setError(null);
              setInvalidLines(null);
            }}
            rows={6}
            placeholder={'79901234567\n+7 (499) 110-57-15'}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 font-mono text-sm text-slate-800 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
          <p className="mt-1 text-xs text-slate-500">
            Один номер на строку, на другую строчку можешь перейти с помощью Enter.
            Можно с +7, скобками и дефисами — лишнее уберём сами. Буквы — нет,
            пидора ответ
          </p>
        </div>

        {error && (
          <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </p>
        )}

        <button
          type="button"
          onClick={handleCheck}
          disabled={isChecking}
          className="rounded-lg bg-blue-600 px-6 py-2.5 text-sm font-medium text-white shadow-sm transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isChecking ? 'Проверка...' : 'Проверить'}
        </button>
      </div>
    </>
  );
}
