'use client';

import React, { useState } from 'react';
import { useAppStore } from '@/lib/store';
import { Download, FileText, X } from 'lucide-react';

function csvCell(value: string | number) {
  return `"${String(value).replaceAll('"', '""')}"`;
}

export default function AccountStatementsModal() {
  const {
    transactions,
    isStatementsModalOpen,
    setIsStatementsModalOpen,
  } = useAppStore();
  const [isGenerated, setIsGenerated] = useState(false);

  if (!isStatementsModalOpen) return null;

  const downloadCsv = () => {
    const rows = [
      ['Référence', 'Libellé', 'Date affichée', 'Montant', 'Nature'],
      ...transactions.map((transaction) => [
        transaction.id,
        transaction.title,
        transaction.date,
        transaction.amount,
        'Règlement externe confirmé dans Monalyz',
      ]),
    ];
    const content = [
      '# Export interne Monalyz — aucune donnée bancaire en temps réel',
      '# Ce fichier ne constitue ni un relevé bancaire ni une attestation de solde.',
      ...rows.map((row) => row.map(csvCell).join(',')),
    ].join('\r\n');
    const blob = new Blob([`\uFEFF${content}`], {
      type: 'text/csv;charset=utf-8',
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `monalyz-registre-interne-${new Date().toISOString().slice(0, 10)}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
    setIsGenerated(true);
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4">
      <section className="bg-white rounded-3xl max-w-lg w-full p-6 space-y-5">
        <header className="flex items-start justify-between border-b pb-4">
          <div className="flex gap-3">
            <FileText className="w-7 h-7 text-blue-600" />
            <div>
              <h2 className="font-extrabold text-slate-900">Exporter le registre Monalyz</h2>
              <p className="text-xs text-slate-500">
                {transactions.length} règlement(s) externe(s) confirmé(s)
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setIsStatementsModalOpen(false)}
            aria-label="Fermer"
          >
            <X className="w-5 h-5 text-slate-500" />
          </button>
        </header>

        <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl text-xs text-amber-900">
          Le CSV est généré localement depuis les données visibles dans Monalyz. Il
          n&apos;est ni certifié par une banque ni utilisable comme relevé bancaire officiel.
        </div>

        {isGenerated && (
          <p className="p-3 bg-emerald-50 text-emerald-800 rounded-xl text-xs font-bold">
            Export généré et téléchargé.
          </p>
        )}

        <button
          type="button"
          disabled={!transactions.length}
          onClick={downloadCsv}
          className="w-full py-3 bg-blue-600 text-white rounded-xl font-bold text-sm disabled:opacity-40 flex items-center justify-center gap-2"
        >
          <Download className="w-4 h-4" />
          Télécharger le CSV interne
        </button>
      </section>
    </div>
  );
}
