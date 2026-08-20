import LegalPageShell from '@/components/legal/LegalPageShell';
import { interpolateLegalText, type LegalPageCopy } from '@/lib/legal-i18n';
import type { Language } from '@/lib/types';

export default function LegalDocument({
  language,
  copy,
  bankName,
  supportEmail,
}: {
  language: Language;
  copy: LegalPageCopy;
  bankName: string;
  supportEmail: string;
}) {
  const render = (value: string) => interpolateLegalText(value, bankName, supportEmail);

  return (
    <LegalPageShell
      language={language}
      title={copy.title}
      introduction={render(copy.introduction)}
    >
      {copy.sections.map((section) => (
        <section key={section.title}>
          <h2>{section.title}</h2>
          {section.paragraphs?.map((paragraph) => (
            <p key={paragraph} className="mt-3 whitespace-pre-line">{render(paragraph)}</p>
          ))}
          {section.items ? (
            <ul className="mt-3">
              {section.items.map((item) => <li key={item}>{render(item)}</li>)}
            </ul>
          ) : null}
        </section>
      ))}
    </LegalPageShell>
  );
}
