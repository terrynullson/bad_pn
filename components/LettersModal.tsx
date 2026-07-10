'use client';

import type { InvalidInputLine } from '@/lib/normalize';

interface LettersModalProps {
  lines: InvalidInputLine[];
  onFix: () => void;
  onClose: () => void;
}

export default function LettersModal({ lines, onFix, onClose }: LettersModalProps) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="letters-modal-title"
      onClick={onClose}
    >
      <div
        className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl border-4 border-red-500 bg-white p-8 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2
          id="letters-modal-title"
          className="text-center text-2xl font-black uppercase leading-tight text-red-600 sm:text-3xl"
        >
          ДА БЛЯ, ТЫ НУ СЕРЬЁЗНО?
        </h2>
        <p className="mt-4 text-center text-lg font-semibold text-slate-800 sm:text-xl">
          НУ ТЫ БУКВЫ ТО УБЕРИ, ТЫ НА ПЕЙДЖЕР ЗВОНИТЬ СОБРАЛСЯ?
        </p>

        <div className="mt-6 rounded-lg bg-red-50 p-4">
          <p className="mb-3 text-sm font-medium text-red-800">
            Косяк в {lines.length === 1 ? 'строке' : 'строках'}:
          </p>
          <ul className="space-y-2">
            {lines.map((line) => (
              <li
                key={`${line.lineNumber}-${line.content}`}
                className="rounded-md border border-red-200 bg-white px-3 py-2 font-mono text-sm text-slate-900"
              >
                <span className="mr-2 font-sans font-bold text-red-600">
                  #{line.lineNumber}
                </span>
                {line.content}
              </li>
            ))}
          </ul>
        </div>

        <button
          type="button"
          onClick={onFix}
          className="mt-8 w-full rounded-xl bg-slate-900 px-6 py-4 text-base font-semibold text-white transition-colors hover:bg-slate-800 sm:text-lg"
        >
          Ладно, сам за тебя это сделаю...
        </button>
      </div>
    </div>
  );
}
