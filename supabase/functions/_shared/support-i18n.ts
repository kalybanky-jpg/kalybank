export interface SupportNotificationCopy {
  locale: string;
  pushTitle: string;
  pushBody: string;
  emailSubject: string;
  emailPreheader: string;
  emailHeading: string;
  greeting: string;
  greetingWithoutName: string;
  emailIntroduction: string;
  conversationLabel: string;
  conversationDateLabel: string;
  visitorSender: string;
  agentSender: string;
  systemSender: string;
  attachmentLabel: string;
  openAttachmentLabel: string;
  unavailableMessage: string;
  footer: string;
}

// Adding a support language only requires adding one complete catalog entry.
// Unknown or region-qualified tags use the same explicit fallback as Monalyz.
export const SUPPORT_FALLBACK_LANGUAGE = "fr";

export const SUPPORT_NOTIFICATION_COPY = {
  fr: {
    locale: "fr-FR",
    pushTitle: "Nouvelle transcription du support",
    pushBody: "Votre conversation avec le support est terminée.",
    emailSubject: "Votre conversation avec le support {{brandName}}",
    emailPreheader:
      "Retrouvez l’intégralité de votre conversation avec le support {{brandName}}.",
    emailHeading: "Votre conversation avec le support",
    greeting: "Bonjour {{name}},",
    greetingWithoutName: "Bonjour,",
    emailIntroduction:
      "Voici la transcription complète de votre récente conversation avec notre équipe de support.",
    conversationLabel: "Conversation",
    conversationDateLabel: "Date",
    visitorSender: "Vous",
    agentSender: "Support",
    systemSender: "Système",
    attachmentLabel: "Pièce jointe",
    openAttachmentLabel: "Ouvrir la pièce jointe",
    unavailableMessage: "Message indisponible",
    footer:
      "Ce message automatique a été envoyé à la suite de votre conversation avec le support {{brandName}}.",
  },
  en: {
    locale: "en-US",
    pushTitle: "New support transcript",
    pushBody: "Your support conversation has ended.",
    emailSubject: "Your {{brandName}} support conversation",
    emailPreheader:
      "Read the complete transcript of your {{brandName}} support conversation.",
    emailHeading: "Your support conversation",
    greeting: "Hello {{name}},",
    greetingWithoutName: "Hello,",
    emailIntroduction:
      "Here is the complete transcript of your recent conversation with our support team.",
    conversationLabel: "Conversation",
    conversationDateLabel: "Date",
    visitorSender: "You",
    agentSender: "Support",
    systemSender: "System",
    attachmentLabel: "Attachment",
    openAttachmentLabel: "Open attachment",
    unavailableMessage: "Message unavailable",
    footer:
      "This automated message was sent following your conversation with {{brandName}} support.",
  },
  de: {
    locale: "de-DE",
    pushTitle: "Neues Support-Protokoll",
    pushBody: "Ihr Support-Gespräch ist beendet.",
    emailSubject: "Ihr Gespräch mit dem {{brandName}}-Support",
    emailPreheader:
      "Lesen Sie das vollständige Protokoll Ihres Gesprächs mit dem {{brandName}}-Support.",
    emailHeading: "Ihr Gespräch mit dem Support",
    greeting: "Guten Tag {{name}},",
    greetingWithoutName: "Guten Tag,",
    emailIntroduction:
      "Hier finden Sie das vollständige Protokoll Ihres letzten Gesprächs mit unserem Support-Team.",
    conversationLabel: "Gespräch",
    conversationDateLabel: "Datum",
    visitorSender: "Sie",
    agentSender: "Support",
    systemSender: "System",
    attachmentLabel: "Anhang",
    openAttachmentLabel: "Anhang öffnen",
    unavailableMessage: "Nachricht nicht verfügbar",
    footer:
      "Diese automatische Nachricht wurde nach Ihrem Gespräch mit dem {{brandName}}-Support gesendet.",
  },
  es: {
    locale: "es-ES",
    pushTitle: "Nueva transcripción de soporte",
    pushBody: "Su conversación con soporte ha finalizado.",
    emailSubject: "Su conversación con el soporte de {{brandName}}",
    emailPreheader:
      "Consulte la transcripción completa de su conversación con el soporte de {{brandName}}.",
    emailHeading: "Su conversación con soporte",
    greeting: "Hola, {{name}}:",
    greetingWithoutName: "Hola:",
    emailIntroduction:
      "A continuación encontrará la transcripción completa de su conversación reciente con nuestro equipo de soporte.",
    conversationLabel: "Conversación",
    conversationDateLabel: "Fecha",
    visitorSender: "Usted",
    agentSender: "Soporte",
    systemSender: "Sistema",
    attachmentLabel: "Archivo adjunto",
    openAttachmentLabel: "Abrir archivo adjunto",
    unavailableMessage: "Mensaje no disponible",
    footer:
      "Este mensaje automático se envió después de su conversación con el soporte de {{brandName}}.",
  },
  it: {
    locale: "it-IT",
    pushTitle: "Nuova trascrizione dell’assistenza",
    pushBody: "La Sua conversazione con l’assistenza è terminata.",
    emailSubject: "La Sua conversazione con l’assistenza {{brandName}}",
    emailPreheader:
      "Consulti la trascrizione completa della Sua conversazione con l’assistenza {{brandName}}.",
    emailHeading: "La Sua conversazione con l’assistenza",
    greeting: "Buongiorno {{name}},",
    greetingWithoutName: "Buongiorno,",
    emailIntroduction:
      "Di seguito trova la trascrizione completa della Sua recente conversazione con il nostro team di assistenza.",
    conversationLabel: "Conversazione",
    conversationDateLabel: "Data",
    visitorSender: "Lei",
    agentSender: "Assistenza",
    systemSender: "Sistema",
    attachmentLabel: "Allegato",
    openAttachmentLabel: "Aprire l’allegato",
    unavailableMessage: "Messaggio non disponibile",
    footer:
      "Questo messaggio automatico è stato inviato in seguito alla Sua conversazione con l’assistenza {{brandName}}.",
  },
  nl: {
    locale: "nl-NL",
    pushTitle: "Nieuw gespreksoverzicht van de ondersteuning",
    pushBody: "Uw gesprek met de ondersteuning is beëindigd.",
    emailSubject: "Uw gesprek met de ondersteuning van {{brandName}}",
    emailPreheader:
      "Bekijk het volledige overzicht van uw gesprek met de ondersteuning van {{brandName}}.",
    emailHeading: "Uw gesprek met de ondersteuning",
    greeting: "Goedendag {{name}},",
    greetingWithoutName: "Goedendag,",
    emailIntroduction:
      "Hieronder vindt u het volledige overzicht van uw recente gesprek met ons ondersteuningsteam.",
    conversationLabel: "Gesprek",
    conversationDateLabel: "Datum",
    visitorSender: "U",
    agentSender: "Ondersteuning",
    systemSender: "Systeem",
    attachmentLabel: "Bijlage",
    openAttachmentLabel: "Bijlage openen",
    unavailableMessage: "Bericht niet beschikbaar",
    footer:
      "Dit automatische bericht is verzonden na uw gesprek met de ondersteuning van {{brandName}}.",
  },
} as const satisfies Record<string, SupportNotificationCopy>;

export type SupportLanguage = keyof typeof SUPPORT_NOTIFICATION_COPY;

export function resolveSupportLanguage(value: unknown): SupportLanguage {
  const normalized = typeof value === "string"
    ? value.trim().toLowerCase().split(/[-_]/, 1)[0]
    : "";

  return Object.prototype.hasOwnProperty.call(
      SUPPORT_NOTIFICATION_COPY,
      normalized,
    )
    ? normalized as SupportLanguage
    : SUPPORT_FALLBACK_LANGUAGE;
}

export function supportNotificationCopy(value: unknown) {
  return SUPPORT_NOTIFICATION_COPY[resolveSupportLanguage(value)];
}

export function interpolateSupportCopy(
  template: string,
  values: Readonly<Record<string, string>>,
) {
  return template.replace(
    /\{\{([a-zA-Z0-9_]+)\}\}/g,
    (_match, key: string) => values[key] ?? "",
  );
}
