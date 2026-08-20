import { cookies, headers } from 'next/headers';
import { LANGUAGE_COOKIE, isSupportedLanguage, parseAcceptLanguage, resolveSupportedLanguage } from './language';
import type { Language } from './types';

export type LegalPageKey = 'notices' | 'privacy' | 'terms' | 'cookies';

export interface LegalSectionCopy {
  title: string;
  paragraphs?: readonly string[];
  items?: readonly string[];
}

export interface LegalPageCopy {
  title: string;
  description: string;
  introduction: string;
  sections: readonly LegalSectionCopy[];
}

export interface LegalShellCopy {
  back: string;
  backAria: string;
  language: string;
  eyebrow: string;
  updated: string;
  updatedDate: string;
  footerRights: string;
  footerAria: string;
  links: { notices: string; privacy: string; terms: string; cookies: string; contact: string };
}

const shell: Record<Language, LegalShellCopy> = {
  fr: { back: 'Retour à la connexion', backAria: 'Retour à la connexion', language: 'Langue', eyebrow: 'Informations légales', updated: 'Dernière mise à jour', updatedDate: '18 août 2026', footerRights: 'Tous droits réservés.', footerAria: 'Informations légales', links: { notices: 'Mentions légales', privacy: 'Confidentialité', terms: 'Conditions d’utilisation', cookies: 'Cookies', contact: 'Contact' } },
  en: { back: 'Back to sign in', backAria: 'Back to sign in', language: 'Language', eyebrow: 'Legal information', updated: 'Last updated', updatedDate: '18 August 2026', footerRights: 'All rights reserved.', footerAria: 'Legal information', links: { notices: 'Legal notice', privacy: 'Privacy', terms: 'Terms of use', cookies: 'Cookies', contact: 'Contact' } },
  de: { back: 'Zurück zur Anmeldung', backAria: 'Zurück zur Anmeldung', language: 'Sprache', eyebrow: 'Rechtliche Informationen', updated: 'Zuletzt aktualisiert', updatedDate: '18. August 2026', footerRights: 'Alle Rechte vorbehalten.', footerAria: 'Rechtliche Informationen', links: { notices: 'Impressum', privacy: 'Datenschutz', terms: 'Nutzungsbedingungen', cookies: 'Cookies', contact: 'Kontakt' } },
  es: { back: 'Volver al inicio de sesión', backAria: 'Volver al inicio de sesión', language: 'Idioma', eyebrow: 'Información legal', updated: 'Última actualización', updatedDate: '18 de agosto de 2026', footerRights: 'Todos los derechos reservados.', footerAria: 'Información legal', links: { notices: 'Aviso legal', privacy: 'Privacidad', terms: 'Condiciones de uso', cookies: 'Cookies', contact: 'Contacto' } },
  it: { back: 'Torna all’accesso', backAria: 'Torna all’accesso', language: 'Lingua', eyebrow: 'Informazioni legali', updated: 'Ultimo aggiornamento', updatedDate: '18 agosto 2026', footerRights: 'Tutti i diritti riservati.', footerAria: 'Informazioni legali', links: { notices: 'Note legali', privacy: 'Privacy', terms: 'Condizioni d’uso', cookies: 'Cookie', contact: 'Contatti' } },
  nl: { back: 'Terug naar aanmelden', backAria: 'Terug naar aanmelden', language: 'Taal', eyebrow: 'Juridische informatie', updated: 'Laatst bijgewerkt', updatedDate: '18 augustus 2026', footerRights: 'Alle rechten voorbehouden.', footerAria: 'Juridische informatie', links: { notices: 'Juridische kennisgeving', privacy: 'Privacy', terms: 'Gebruiksvoorwaarden', cookies: 'Cookies', contact: 'Contact' } },
};

const pages: Record<Language, Record<LegalPageKey, LegalPageCopy>> = {
  fr: {
    notices: { title: 'Mentions légales', description: 'Informations relatives à l’édition et à l’hébergement du service.', introduction: 'Cette page identifie le service {bankName}, son point de contact et son prestataire d’hébergement.', sections: [
      { title: 'Éditeur du service', paragraphs: ['Le présent service numérique est édité par 2 C FINANCE, sous le nom commercial {tradeName}. Le responsable de publication est joignable à {supportEmail}.', 'Dénomination : 2 C FINANCE\nNom commercial : {tradeName}\nSIREN : 979 247 145\nSIRET du siège social : 979 247 145 00019\nForme juridique : SAS, société par actions simplifiée\nAdresse postale : 20 BOULEVARD MONTMARTRE, 75009 PARIS'] },
      { title: 'Hébergement', paragraphs: ['Le site est hébergé par Netlify, Inc., 101 2nd Street, San Francisco, CA 94105, États-Unis. Le domaine de production est bank.monalyz.com.'] },
      { title: 'Nature du service', paragraphs: ['{bankName} est un registre numérique utilisé pour déclarer et suivre des comptes, dossiers d’identité, intentions de virement, prêts et documents. Le service n’est relié à aucune API bancaire tierce et ne déclenche aucun mouvement financier automatique. Les contrôles et exécutions externes relèvent du personnel habilité.'] },
      { title: 'Propriété intellectuelle', paragraphs: ['La structure, les textes, les éléments graphiques, les logiciels et les signes distinctifs du service sont protégés. Toute reproduction ou réutilisation non autorisée est interdite, sous réserve des exceptions légales.'] },
      { title: 'Signalement et contact', paragraphs: ['Pour signaler un contenu, une vulnérabilité, une erreur ou une utilisation illicite, écrivez à {supportEmail} en décrivant précisément les faits concernés.'] },
    ] },
    privacy: { title: 'Politique de confidentialité', description: 'Informations sur les données personnelles traitées par le service.', introduction: 'Cette politique explique les données utilisées par {bankName}, leurs finalités et les moyens d’exercer vos droits.', sections: [
      { title: 'Responsable et contact', paragraphs: ['L’exploitant de {bankName} détermine les traitements nécessaires à la gestion des utilisateurs et des opérations. Pour toute demande relative à vos données, contactez {supportEmail}.'] },
      { title: 'Données traitées', items: ['identité, coordonnées, langue, devise et données d’authentification ;', 'dossier d’identité, pièce d’identité, justificatif de domicile et selfie facultatif pris avec la caméra ou choisi dans la galerie ;', 'positions, écritures, intentions de virement, prêts et documents ;', 'messages de support, notifications facultatives et préférences ;', 'journaux techniques, événements de sécurité et traces d’audit.'] },
      { title: 'Finalités et fondements', paragraphs: ['Les données servent à sécuriser le compte, fournir le service et le support, vérifier manuellement l’identité, tenir un registre fiable, prévenir la fraude et envoyer les messages nécessaires. Selon le traitement, la base est le contrat, une obligation légale, l’intérêt légitime ou le consentement.'] },
      { title: 'Destinataires et prestataires', paragraphs: ['Les données sont accessibles aux personnes concernées, au personnel habilité et aux prestataires nécessaires : Supabase, Netlify, Resend ou Brevo, et Tawk.to lorsque le support en ligne est disponible.'] },
      { title: 'Conservation et sécurité', paragraphs: ['Les données sont conservées pendant la durée nécessaire au compte, aux opérations, aux obligations applicables et à la défense de droits. Les justificatifs sont privés, les accès sont contrôlés et les opérations sensibles sont journalisées.'] },
      { title: 'Transferts internationaux', paragraphs: ['Certains prestataires peuvent traiter des données hors de l’Espace économique européen avec les mécanismes de protection applicables, notamment une décision d’adéquation ou des clauses contractuelles types.'] },
      { title: 'Vos droits', paragraphs: ['Vous pouvez demander l’accès, la rectification, l’effacement, la limitation, la portabilité ou vous opposer à certains traitements. Écrivez à {supportEmail}. Vous pouvez aussi saisir la CNIL.'] },
      { title: 'Cookies', paragraphs: ['Les informations sur les cookies, le stockage local et les services tiers figurent dans la politique relative aux cookies.'] },
    ] },
    terms: { title: 'Conditions générales d’utilisation', description: 'Conditions applicables à l’utilisation du service.', introduction: 'Ces conditions encadrent l’accès et l’utilisation de {bankName}. En utilisant le service, vous vous engagez à les respecter.', sections: [
      { title: 'Objet du service', paragraphs: ['{bankName} permet de déclarer, contrôler et suivre des informations d’identité, positions, opérations, demandes et documents. Le service ne se connecte pas à une infrastructure bancaire tierce et n’exécute automatiquement aucun mouvement de fonds.'] },
      { title: 'Accès et éligibilité', paragraphs: ['L’accès est réservé aux personnes autorisées. La vérification d’identité est destinée aux personnes majeures. Vous devez fournir des informations exactes et protéger vos identifiants et votre appareil.'] },
      { title: 'Vérification d’identité', paragraphs: ['Le selfie est facultatif. Si vous le fournissez, vous pouvez le prendre avec la caméra ou choisir une photo dans votre galerie. Les pièces sont contrôlées manuellement et leur dépôt ne vaut pas acceptation automatique.'] },
      { title: 'Opérations et documents', paragraphs: ['Les informations affichées reflètent les éléments déclarés ou validés par le personnel habilité. Toute exécution financière réelle intervient dans les procédures externes de l’établissement.'] },
      { title: 'Usages interdits', items: ['usurper une identité, falsifier un document ou accéder au compte d’un tiers ;', 'contourner les contrôles, perturber le service ou rechercher une vulnérabilité sans autorisation ;', 'utiliser le service à des fins frauduleuses ou illicites ;', 'extraire ou diffuser des données sans habilitation.'] },
      { title: 'Disponibilité et responsabilité', paragraphs: ['Des interruptions peuvent être nécessaires. {bankName} met en œuvre des mesures raisonnables de fiabilité sans garantir une disponibilité continue. Aucune responsabilité légalement impérative n’est limitée.'] },
      { title: 'Suspension et suppression', paragraphs: ['Un accès peut être suspendu pour des raisons de sécurité, d’usage interdit, d’exigence légale ou de fin d’habilitation. La suppression respecte les contrôles d’intégrité et obligations de conservation applicables.'] },
      { title: 'Évolution et contact', paragraphs: ['Ces conditions peuvent évoluer. Pour toute question ou contestation, contactez {supportEmail}.'] },
    ] },
    cookies: { title: 'Politique relative aux cookies', description: 'Informations sur les cookies et stockages utilisés par le service.', introduction: 'Cette page présente les cookies, stockages locaux et services tiers susceptibles d’être utilisés sur {bankName}.', sections: [
      { title: 'Stockages strictement nécessaires', paragraphs: ['{bankName} utilise des stockages indispensables à la session sécurisée, à l’authentification, à la langue choisie et aux préférences. Leur désactivation peut empêcher la connexion ou dégrader le service.'] },
      { title: 'Support en ligne et services tiers', paragraphs: ['Dans l’espace authentifié, Tawk.to peut utiliser ses cookies pour la continuité et la sécurité du chat. Netlify et Supabase traitent aussi des identifiants techniques nécessaires. Aucun traceur publicitaire n’est intégré.'] },
      { title: 'Durée et maîtrise', paragraphs: ['La durée varie selon la finalité et le prestataire. Vous pouvez supprimer les données du site ou bloquer les cookies tiers dans votre navigateur. Bloquer les stockages essentiels peut interrompre la session.'] },
      { title: 'Contact', paragraphs: ['Pour toute précision ou demande relative à ces technologies, contactez {supportEmail}.'] },
    ] },
  },
  en: {
    notices: { title: 'Legal notice', description: 'Information about the publisher and hosting of the service.', introduction: 'This page identifies the {bankName} service, its contact point and hosting provider.', sections: [
      { title: 'Service publisher', paragraphs: ['This digital service is published by 2 C FINANCE under the trade name {tradeName}. The publication contact can be reached at {supportEmail}.', 'Legal name: 2 C FINANCE\nTrade name: {tradeName}\nSIREN: 979 247 145\nRegistered-office SIRET: 979 247 145 00019\nLegal form: SAS, simplified joint-stock company\nPostal address: 20 BOULEVARD MONTMARTRE, 75009 PARIS, FRANCE'] },
      { title: 'Hosting', paragraphs: ['The site is hosted by Netlify, Inc., 101 2nd Street, San Francisco, CA 94105, United States. The production domain is bank.monalyz.com.'] },
      { title: 'Nature of the service', paragraphs: ['{bankName} is a digital register used to record and track accounts, identity files, transfer intentions, loans and documents. It is not connected to any third-party banking API and does not automatically move funds. External checks and execution are handled by authorised staff.'] },
      { title: 'Intellectual property', paragraphs: ['The structure, text, graphics, software and distinctive signs are protected. Unauthorised reproduction or reuse is prohibited, subject to legal exceptions.'] },
      { title: 'Reports and contact', paragraphs: ['To report content, a vulnerability, an error or unlawful use, write to {supportEmail} with a precise description.'] },
    ] },
    privacy: { title: 'Privacy policy', description: 'Information about personal data processed by the service.', introduction: 'This policy explains what data {bankName} uses, why it is used and how to exercise your rights.', sections: [
      { title: 'Controller and contact', paragraphs: ['The operator of {bankName} determines the processing needed to manage users and recorded operations. Contact {supportEmail} about your personal data.'] },
      { title: 'Data processed', items: ['identity, contact details, language, currency and authentication data;', 'identity-verification details, identity document, proof of address and an optional selfie taken with the camera or selected from the gallery;', 'positions, entries, transfer intentions, loan requests and documents;', 'support messages, optional notifications and device preferences;', 'technical logs, security events and audit trails.'] },
      { title: 'Purposes and legal bases', paragraphs: ['Data is used to secure accounts, provide the service and support, manually verify identity, maintain reliable records, prevent fraud and send necessary messages. The legal basis may be contract, legal obligation, legitimate interest or consent.'] },
      { title: 'Recipients and providers', paragraphs: ['Data is available to the relevant users, authorised staff and necessary providers: Supabase, Netlify, Resend or Brevo, and Tawk.to when online support is available.'] },
      { title: 'Retention and security', paragraphs: ['Data is retained as needed for the account, recorded operations, applicable duties and legal claims. Evidence is kept private, access is role-controlled and sensitive actions are logged.'] },
      { title: 'International transfers', paragraphs: ['Some providers may process data outside the EEA using applicable safeguards such as an adequacy decision or standard contractual clauses.'] },
      { title: 'Your rights', paragraphs: ['You may request access, correction, deletion, restriction or portability and object to certain processing. Contact {supportEmail}. You may also complain to the CNIL or your competent authority.'] },
      { title: 'Cookies', paragraphs: ['Information about cookies, local storage and third-party services is provided in the cookie policy.'] },
    ] },
    terms: { title: 'Terms of use', description: 'Terms governing use of the service.', introduction: 'These terms govern access to and use of {bankName}. By using the service, you agree to follow them.', sections: [
      { title: 'Purpose of the service', paragraphs: ['{bankName} records, checks and tracks identity information, positions, operations, requests and documents. It is not connected to third-party banking infrastructure and does not automatically execute transfers, loans or fund movements.'] },
      { title: 'Access and eligibility', paragraphs: ['Access is limited to authorised persons. Identity verification is intended for adults. You must provide accurate information and protect your credentials and device.'] },
      { title: 'Identity verification', paragraphs: ['The selfie is optional. If you provide one, you may take it with the camera or choose a photo from your gallery. Documents are reviewed manually and submission does not mean automatic acceptance.'] },
      { title: 'Operations and documents', paragraphs: ['Displayed information reflects items declared or validated by authorised staff. Any real financial execution takes place through the institution’s external procedures.'] },
      { title: 'Prohibited uses', items: ['impersonating another person, falsifying documents or accessing another account;', 'bypassing controls, disrupting the service or probing for vulnerabilities without permission;', 'using the service for fraudulent or unlawful purposes;', 'extracting or sharing data without authorisation.'] },
      { title: 'Availability and liability', paragraphs: ['Interruptions may be necessary. {bankName} takes reasonable reliability measures but does not guarantee uninterrupted availability. Liability that cannot lawfully be limited remains unaffected.'] },
      { title: 'Suspension and deletion', paragraphs: ['Access may be suspended for security, prohibited use, legal requirements or loss of authorisation. Deletion remains subject to integrity controls and applicable retention duties.'] },
      { title: 'Changes and contact', paragraphs: ['These terms may change. Contact {supportEmail} with questions or disputes.'] },
    ] },
    cookies: { title: 'Cookie policy', description: 'Information about cookies and storage used by the service.', introduction: 'This page describes cookies, local storage and third-party services that may be used on {bankName}.', sections: [
      { title: 'Strictly necessary storage', paragraphs: ['{bankName} uses storage required for secure sessions, authentication, the selected language and preferences. Disabling it may prevent sign-in or impair the service.'] },
      { title: 'Online support and third parties', paragraphs: ['In the authenticated area, Tawk.to may use cookies for chat continuity and security. Netlify and Supabase also process necessary technical identifiers. No advertising tracker is included.'] },
      { title: 'Duration and control', paragraphs: ['Duration varies by purpose and provider. You can delete site data or block third-party cookies in your browser. Blocking essential storage may end your session.'] },
      { title: 'Contact', paragraphs: ['For information or to exercise a right related to these technologies, contact {supportEmail}.'] },
    ] },
  },
  de: {
    notices: { title: 'Impressum', description: 'Informationen zu Anbieter und Hosting des Dienstes.', introduction: 'Diese Seite nennt den Anbieter von {bankName}, die Kontaktstelle und den Hosting-Dienstleister.', sections: [
      { title: 'Diensteanbieter', paragraphs: ['Dieser digitale Dienst wird von 2 C FINANCE unter dem Handelsnamen {tradeName} angeboten. Kontakt: {supportEmail}.', 'Firma: 2 C FINANCE\nHandelsname: {tradeName}\nSIREN: 979 247 145\nSIRET des Sitzes: 979 247 145 00019\nRechtsform: SAS, vereinfachte Aktiengesellschaft\nPostanschrift: 20 BOULEVARD MONTMARTRE, 75009 PARIS, FRANKREICH'] },
      { title: 'Hosting', paragraphs: ['Hosting durch Netlify, Inc., 101 2nd Street, San Francisco, CA 94105, USA. Produktionsdomain: bank.monalyz.com.'] },
      { title: 'Art des Dienstes', paragraphs: ['{bankName} ist ein digitales Register für Konten, Identitätsunterlagen, Überweisungsabsichten, Darlehen und Dokumente. Es besteht keine Verbindung zu einer fremden Banking-API und keine automatische Geldbewegung. Externe Prüfungen erfolgen durch befugtes Personal.'] },
      { title: 'Geistiges Eigentum', paragraphs: ['Struktur, Texte, Grafiken, Software und Kennzeichen sind geschützt. Unbefugte Vervielfältigung oder Wiederverwendung ist vorbehaltlich gesetzlicher Ausnahmen untersagt.'] },
      { title: 'Meldung und Kontakt', paragraphs: ['Melden Sie Inhalte, Schwachstellen, Fehler oder rechtswidrige Nutzung mit genauer Beschreibung an {supportEmail}.'] },
    ] },
    privacy: { title: 'Datenschutzerklärung', description: 'Informationen zur Verarbeitung personenbezogener Daten.', introduction: 'Diese Erklärung erläutert, welche Daten {bankName} nutzt, zu welchen Zwecken und wie Sie Ihre Rechte ausüben.', sections: [
      { title: 'Verantwortlicher und Kontakt', paragraphs: ['Der Betreiber von {bankName} bestimmt die Verarbeitung zur Nutzer- und Vorgangsverwaltung. Datenschutzanfragen richten Sie an {supportEmail}.'] },
      { title: 'Verarbeitete Daten', items: ['Identität, Kontaktdaten, Sprache, Währung und Authentifizierungsdaten;', 'Identitätsprüfung, Ausweis, Adressnachweis und optionales Selfie per Kamera oder Galerie;', 'Positionen, Buchungen, Überweisungsabsichten, Darlehen und Dokumente;', 'Supportnachrichten, optionale Benachrichtigungen und Einstellungen;', 'technische Protokolle, Sicherheitsereignisse und Auditspuren.'] },
      { title: 'Zwecke und Rechtsgrundlagen', paragraphs: ['Die Daten dienen Kontosicherheit, Dienst und Support, manueller Identitätsprüfung, verlässlichen Registern, Betrugsprävention und notwendigen Nachrichten. Grundlage sind Vertrag, Rechtspflicht, berechtigtes Interesse oder Einwilligung.'] },
      { title: 'Empfänger und Dienstleister', paragraphs: ['Zugriff haben betroffene Nutzer, befugtes Personal und erforderliche Anbieter: Supabase, Netlify, Resend oder Brevo sowie Tawk.to bei Online-Support.'] },
      { title: 'Speicherung und Sicherheit', paragraphs: ['Daten werden für Konto, Vorgänge, Pflichten und Rechtsansprüche erforderlich gespeichert. Nachweise sind privat, Zugriffe rollenbasiert und sensible Aktionen protokolliert.'] },
      { title: 'Internationale Übermittlungen', paragraphs: ['Anbieter können Daten außerhalb des EWR mit geeigneten Garantien wie Angemessenheitsbeschluss oder Standardvertragsklauseln verarbeiten.'] },
      { title: 'Ihre Rechte', paragraphs: ['Sie können Auskunft, Berichtigung, Löschung, Einschränkung oder Übertragbarkeit verlangen und widersprechen. Kontakt: {supportEmail}. Beschwerden sind bei der zuständigen Aufsicht möglich.'] },
      { title: 'Cookies', paragraphs: ['Einzelheiten zu Cookies, lokaler Speicherung und Drittanbietern stehen in der Cookie-Richtlinie.'] },
    ] },
    terms: { title: 'Nutzungsbedingungen', description: 'Bedingungen für die Nutzung des Dienstes.', introduction: 'Diese Bedingungen regeln Zugang und Nutzung von {bankName}. Mit der Nutzung verpflichten Sie sich zu ihrer Einhaltung.', sections: [
      { title: 'Zweck', paragraphs: ['{bankName} erfasst und verfolgt Identitätsdaten, Positionen, Vorgänge, Anträge und Dokumente. Der Dienst ist nicht mit fremder Bankinfrastruktur verbunden und führt keine Geldbewegung automatisch aus.'] },
      { title: 'Zugang und Berechtigung', paragraphs: ['Der Zugang ist befugten Personen vorbehalten. Die Identitätsprüfung richtet sich an Volljährige. Angaben müssen richtig sein; Zugangsdaten und Gerät sind zu schützen.'] },
      { title: 'Identitätsprüfung', paragraphs: ['Das Selfie ist optional. Sie können es per Kamera aufnehmen oder aus der Galerie wählen. Unterlagen werden manuell geprüft; die Einreichung bedeutet keine automatische Annahme.'] },
      { title: 'Vorgänge und Dokumente', paragraphs: ['Angezeigte Angaben entsprechen den durch befugtes Personal gemeldeten oder bestätigten Informationen. Reale Finanzvorgänge erfolgen außerhalb des Dienstes.'] },
      { title: 'Verbotene Nutzung', items: ['Identitätsmissbrauch, gefälschte Dokumente oder fremder Kontozugriff;', 'Umgehung von Kontrollen, Störung oder unbefugte Schwachstellensuche;', 'betrügerische oder rechtswidrige Nutzung;', 'unbefugte Entnahme oder Weitergabe von Daten.'] },
      { title: 'Verfügbarkeit und Haftung', paragraphs: ['Unterbrechungen können nötig sein. {bankName} trifft angemessene Maßnahmen, garantiert aber keine unterbrechungsfreie Verfügbarkeit. Zwingende Haftung bleibt unberührt.'] },
      { title: 'Sperrung und Löschung', paragraphs: ['Zugänge können aus Sicherheits-, Rechts- oder Berechtigungsgründen gesperrt werden. Löschung unterliegt Integritätsprüfungen und Aufbewahrungspflichten.'] },
      { title: 'Änderungen und Kontakt', paragraphs: ['Diese Bedingungen können geändert werden. Fragen oder Beschwerden richten Sie an {supportEmail}.'] },
    ] },
    cookies: { title: 'Cookie-Richtlinie', description: 'Informationen zu Cookies und Speicherungen des Dienstes.', introduction: 'Diese Seite beschreibt Cookies, lokale Speicherungen und Drittanbieter bei {bankName}.', sections: [
      { title: 'Unbedingt erforderliche Speicherung', paragraphs: ['{bankName} nutzt Speicher für sichere Sitzungen, Authentifizierung, Sprache und Einstellungen. Eine Deaktivierung kann Anmeldung oder Dienst beeinträchtigen.'] },
      { title: 'Online-Support und Drittanbieter', paragraphs: ['Tawk.to kann im geschützten Bereich Cookies für Chatkontinuität und Sicherheit nutzen. Netlify und Supabase verarbeiten notwendige technische Kennungen. Werbetracker sind nicht eingebunden.'] },
      { title: 'Dauer und Kontrolle', paragraphs: ['Die Dauer hängt von Zweck und Anbieter ab. Browser erlauben das Löschen von Websitedaten und Sperren fremder Cookies. Das Sperren notwendiger Speicher kann die Sitzung beenden.'] },
      { title: 'Kontakt', paragraphs: ['Fragen oder Rechte zu diesen Technologien richten Sie an {supportEmail}.'] },
    ] },
  },
  es: {
    notices: { title: 'Aviso legal', description: 'Información sobre la edición y el alojamiento del servicio.', introduction: 'Esta página identifica el servicio {bankName}, su contacto y su proveedor de alojamiento.', sections: [
      { title: 'Editor del servicio', paragraphs: ['Este servicio digital es editado por 2 C FINANCE con el nombre comercial {tradeName}. Contacto: {supportEmail}.', 'Denominación: 2 C FINANCE\nNombre comercial: {tradeName}\nSIREN: 979 247 145\nSIRET de la sede: 979 247 145 00019\nForma jurídica: SAS, sociedad por acciones simplificada\nDirección postal: 20 BOULEVARD MONTMARTRE, 75009 PARIS, FRANCIA'] },
      { title: 'Alojamiento', paragraphs: ['El sitio está alojado por Netlify, Inc., 101 2nd Street, San Francisco, CA 94105, Estados Unidos. Dominio de producción: bank.monalyz.com.'] },
      { title: 'Naturaleza del servicio', paragraphs: ['{bankName} es un registro digital de cuentas, expedientes de identidad, intenciones de transferencia, préstamos y documentos. No se conecta a API bancarias de terceros ni mueve fondos automáticamente. Los controles externos corresponden al personal autorizado.'] },
      { title: 'Propiedad intelectual', paragraphs: ['La estructura, los textos, gráficos, programas y signos distintivos están protegidos. Se prohíbe su reproducción o reutilización no autorizada, salvo excepciones legales.'] },
      { title: 'Avisos y contacto', paragraphs: ['Para informar de contenido, vulnerabilidades, errores o usos ilícitos, escriba a {supportEmail} con una descripción precisa.'] },
    ] },
    privacy: { title: 'Política de privacidad', description: 'Información sobre los datos personales tratados.', introduction: 'Esta política explica qué datos utiliza {bankName}, para qué y cómo ejercer sus derechos.', sections: [
      { title: 'Responsable y contacto', paragraphs: ['El operador de {bankName} determina los tratamientos necesarios para usuarios y operaciones. Contacte con {supportEmail} sobre sus datos.'] },
      { title: 'Datos tratados', items: ['identidad, contacto, idioma, divisa y autenticación;', 'verificación de identidad, documento, justificante de domicilio y selfie opcional con cámara o galería;', 'posiciones, registros, intenciones de transferencia, préstamos y documentos;', 'mensajes de soporte, notificaciones opcionales y preferencias;', 'registros técnicos, eventos de seguridad y auditoría.'] },
      { title: 'Finalidades y bases jurídicas', paragraphs: ['Los datos permiten proteger cuentas, prestar servicio y soporte, verificar manualmente la identidad, mantener registros, prevenir el fraude y enviar mensajes necesarios. La base puede ser contrato, obligación legal, interés legítimo o consentimiento.'] },
      { title: 'Destinatarios y proveedores', paragraphs: ['Acceden los usuarios afectados, el personal autorizado y los proveedores necesarios: Supabase, Netlify, Resend o Brevo y Tawk.to cuando hay soporte en línea.'] },
      { title: 'Conservación y seguridad', paragraphs: ['Los datos se conservan según las necesidades de la cuenta, operaciones, obligaciones y reclamaciones. Los justificantes son privados, el acceso se controla y las acciones sensibles se registran.'] },
      { title: 'Transferencias internacionales', paragraphs: ['Algunos proveedores pueden tratar datos fuera del EEE con garantías como decisiones de adecuación o cláusulas contractuales tipo.'] },
      { title: 'Sus derechos', paragraphs: ['Puede pedir acceso, rectificación, supresión, limitación o portabilidad y oponerse a ciertos tratamientos. Contacte con {supportEmail} o con la autoridad de control competente.'] },
      { title: 'Cookies', paragraphs: ['La política de cookies detalla las cookies, el almacenamiento local y los servicios de terceros.'] },
    ] },
    terms: { title: 'Condiciones de uso', description: 'Condiciones aplicables al uso del servicio.', introduction: 'Estas condiciones regulan el acceso y uso de {bankName}. Al usarlo, se compromete a respetarlas.', sections: [
      { title: 'Objeto', paragraphs: ['{bankName} registra y controla identidad, posiciones, operaciones, solicitudes y documentos. No está conectado a infraestructura bancaria de terceros ni ejecuta movimientos de fondos automáticamente.'] },
      { title: 'Acceso y requisitos', paragraphs: ['El acceso se limita a personas autorizadas. La verificación de identidad es para mayores de edad. Debe aportar datos exactos y proteger sus credenciales y dispositivo.'] },
      { title: 'Verificación de identidad', paragraphs: ['El selfie es opcional. Puede tomarlo con la cámara o elegirlo de la galería. Los documentos se revisan manualmente y su envío no implica aceptación automática.'] },
      { title: 'Operaciones y documentos', paragraphs: ['Los datos mostrados reflejan elementos declarados o validados por personal autorizado. Toda ejecución financiera real se realiza mediante procedimientos externos.'] },
      { title: 'Usos prohibidos', items: ['suplantar identidades, falsificar documentos o acceder a cuentas ajenas;', 'eludir controles, perturbar el servicio o buscar vulnerabilidades sin permiso;', 'usar el servicio con fines fraudulentos o ilícitos;', 'extraer o difundir datos sin autorización.'] },
      { title: 'Disponibilidad y responsabilidad', paragraphs: ['Puede haber interrupciones. {bankName} aplica medidas razonables sin garantizar disponibilidad continua. No se limita la responsabilidad que la ley impida limitar.'] },
      { title: 'Suspensión y supresión', paragraphs: ['El acceso puede suspenderse por seguridad, uso prohibido, requisitos legales o pérdida de autorización. La supresión respeta controles de integridad y conservación.'] },
      { title: 'Cambios y contacto', paragraphs: ['Estas condiciones pueden cambiar. Contacte con {supportEmail} para preguntas o reclamaciones.'] },
    ] },
    cookies: { title: 'Política de cookies', description: 'Información sobre cookies y almacenamiento del servicio.', introduction: 'Esta página describe las cookies, el almacenamiento local y los terceros que puede usar {bankName}.', sections: [
      { title: 'Almacenamiento estrictamente necesario', paragraphs: ['{bankName} usa almacenamiento necesario para sesión segura, autenticación, idioma y preferencias. Desactivarlo puede impedir el acceso o degradar el servicio.'] },
      { title: 'Soporte en línea y terceros', paragraphs: ['Tawk.to puede usar cookies en el área autenticada para continuidad y seguridad del chat. Netlify y Supabase tratan identificadores técnicos necesarios. No hay rastreadores publicitarios.'] },
      { title: 'Duración y control', paragraphs: ['La duración depende del fin y proveedor. Puede borrar datos del sitio o bloquear cookies de terceros en el navegador. Bloquear almacenamiento esencial puede cerrar la sesión.'] },
      { title: 'Contacto', paragraphs: ['Para información o ejercer derechos sobre estas tecnologías, contacte con {supportEmail}.'] },
    ] },
  },
  it: {
    notices: { title: 'Note legali', description: 'Informazioni sull’editore e sull’hosting del servizio.', introduction: 'Questa pagina identifica il servizio {bankName}, il contatto e il fornitore di hosting.', sections: [
      { title: 'Editore del servizio', paragraphs: ['Il servizio digitale è edito da 2 C FINANCE con nome commerciale {tradeName}. Contatto: {supportEmail}.', 'Denominazione: 2 C FINANCE\nNome commerciale: {tradeName}\nSIREN: 979 247 145\nSIRET della sede: 979 247 145 00019\nForma giuridica: SAS, società per azioni semplificata\nIndirizzo postale: 20 BOULEVARD MONTMARTRE, 75009 PARIS, FRANCIA'] },
      { title: 'Hosting', paragraphs: ['Il sito è ospitato da Netlify, Inc., 101 2nd Street, San Francisco, CA 94105, Stati Uniti. Dominio di produzione: bank.monalyz.com.'] },
      { title: 'Natura del servizio', paragraphs: ['{bankName} è un registro digitale per conti, fascicoli d’identità, intenzioni di bonifico, prestiti e documenti. Non è collegato ad API bancarie terze e non muove fondi automaticamente. I controlli esterni spettano al personale autorizzato.'] },
      { title: 'Proprietà intellettuale', paragraphs: ['Struttura, testi, grafica, software e segni distintivi sono protetti. La riproduzione o il riutilizzo non autorizzati sono vietati, salvo eccezioni di legge.'] },
      { title: 'Segnalazioni e contatti', paragraphs: ['Per segnalare contenuti, vulnerabilità, errori o usi illeciti, scrivere a {supportEmail} con una descrizione precisa.'] },
    ] },
    privacy: { title: 'Informativa sulla privacy', description: 'Informazioni sui dati personali trattati.', introduction: 'Questa informativa spiega quali dati usa {bankName}, perché e come esercitare i propri diritti.', sections: [
      { title: 'Titolare e contatto', paragraphs: ['Il gestore di {bankName} determina i trattamenti necessari per utenti e operazioni. Per i dati personali: {supportEmail}.'] },
      { title: 'Dati trattati', items: ['identità, contatti, lingua, valuta e autenticazione;', 'verifica d’identità, documento, prova d’indirizzo e selfie facoltativo da fotocamera o galleria;', 'posizioni, registrazioni, intenzioni di bonifico, prestiti e documenti;', 'messaggi di assistenza, notifiche facoltative e preferenze;', 'log tecnici, eventi di sicurezza e audit.'] },
      { title: 'Finalità e basi giuridiche', paragraphs: ['I dati servono a proteggere l’account, fornire servizio e assistenza, verificare manualmente l’identità, mantenere registri, prevenire frodi e inviare messaggi necessari. Le basi sono contratto, obbligo legale, interesse legittimo o consenso.'] },
      { title: 'Destinatari e fornitori', paragraphs: ['Accedono utenti interessati, personale autorizzato e fornitori necessari: Supabase, Netlify, Resend o Brevo e Tawk.to quando disponibile.'] },
      { title: 'Conservazione e sicurezza', paragraphs: ['I dati sono conservati per account, operazioni, obblighi e diritti. I documenti sono privati, gli accessi controllati e le azioni sensibili registrate.'] },
      { title: 'Trasferimenti internazionali', paragraphs: ['Alcuni fornitori possono trattare dati fuori dal SEE con garanzie quali decisioni di adeguatezza o clausole contrattuali standard.'] },
      { title: 'I suoi diritti', paragraphs: ['Può chiedere accesso, rettifica, cancellazione, limitazione o portabilità e opporsi a certi trattamenti. Contatti {supportEmail} o l’autorità competente.'] },
      { title: 'Cookie', paragraphs: ['La politica sui cookie descrive cookie, archiviazione locale e servizi terzi.'] },
    ] },
    terms: { title: 'Condizioni d’uso', description: 'Condizioni applicabili all’uso del servizio.', introduction: 'Queste condizioni regolano accesso e uso di {bankName}. Usando il servizio, accetta di rispettarle.', sections: [
      { title: 'Oggetto', paragraphs: ['{bankName} registra e controlla identità, posizioni, operazioni, richieste e documenti. Non è collegato a infrastrutture bancarie terze e non esegue automaticamente movimenti di fondi.'] },
      { title: 'Accesso e requisiti', paragraphs: ['L’accesso è riservato agli autorizzati. La verifica d’identità è destinata ai maggiorenni. Occorre fornire dati esatti e proteggere credenziali e dispositivo.'] },
      { title: 'Verifica d’identità', paragraphs: ['Il selfie è facoltativo. Può essere scattato con la fotocamera o scelto dalla galleria. I documenti sono verificati manualmente e l’invio non implica accettazione automatica.'] },
      { title: 'Operazioni e documenti', paragraphs: ['Le informazioni mostrate riflettono dati dichiarati o approvati dal personale autorizzato. Ogni esecuzione finanziaria reale avviene tramite procedure esterne.'] },
      { title: 'Usi vietati', items: ['usurpare identità, falsificare documenti o accedere ad account altrui;', 'aggirare controlli, disturbare il servizio o cercare vulnerabilità senza permesso;', 'usare il servizio per fini fraudolenti o illeciti;', 'estrarre o diffondere dati senza autorizzazione.'] },
      { title: 'Disponibilità e responsabilità', paragraphs: ['Possono verificarsi interruzioni. {bankName} adotta misure ragionevoli senza garantire continuità assoluta. Restano ferme le responsabilità inderogabili.'] },
      { title: 'Sospensione e cancellazione', paragraphs: ['L’accesso può essere sospeso per sicurezza, uso vietato, legge o perdita dell’autorizzazione. La cancellazione rispetta controlli d’integrità e obblighi di conservazione.'] },
      { title: 'Modifiche e contatto', paragraphs: ['Le condizioni possono cambiare. Per domande o contestazioni: {supportEmail}.'] },
    ] },
    cookies: { title: 'Politica sui cookie', description: 'Informazioni su cookie e archiviazione usati.', introduction: 'Questa pagina descrive cookie, archiviazione locale e terze parti che {bankName} può utilizzare.', sections: [
      { title: 'Archiviazione strettamente necessaria', paragraphs: ['{bankName} usa archiviazione necessaria per sessione sicura, autenticazione, lingua e preferenze. Disattivarla può impedire l’accesso o compromettere il servizio.'] },
      { title: 'Assistenza online e terze parti', paragraphs: ['Tawk.to può usare cookie nell’area autenticata per continuità e sicurezza della chat. Netlify e Supabase trattano identificatori tecnici necessari. Non sono presenti tracker pubblicitari.'] },
      { title: 'Durata e controllo', paragraphs: ['La durata dipende da finalità e fornitore. Il browser consente di cancellare i dati o bloccare cookie terzi. Bloccare l’archiviazione essenziale può chiudere la sessione.'] },
      { title: 'Contatti', paragraphs: ['Per informazioni o diritti relativi a queste tecnologie: {supportEmail}.'] },
    ] },
  },
  nl: {
    notices: { title: 'Juridische kennisgeving', description: 'Informatie over de uitgever en hosting van de dienst.', introduction: 'Deze pagina identificeert de dienst {bankName}, het contactpunt en de hostingprovider.', sections: [
      { title: 'Uitgever', paragraphs: ['Deze digitale dienst wordt uitgegeven door 2 C FINANCE onder de handelsnaam {tradeName}. Contact: {supportEmail}.', 'Statutaire naam: 2 C FINANCE\nHandelsnaam: {tradeName}\nSIREN: 979 247 145\nSIRET hoofdkantoor: 979 247 145 00019\nRechtsvorm: SAS, vereenvoudigde naamloze vennootschap\nPostadres: 20 BOULEVARD MONTMARTRE, 75009 PARIS, FRANKRIJK'] },
      { title: 'Hosting', paragraphs: ['De site wordt gehost door Netlify, Inc., 101 2nd Street, San Francisco, CA 94105, Verenigde Staten. Productiedomein: bank.monalyz.com.'] },
      { title: 'Aard van de dienst', paragraphs: ['{bankName} is een digitaal register voor rekeningen, identiteitsdossiers, overschrijvingsintenties, leningen en documenten. Er is geen koppeling met externe bank-API’s en geen automatische geldbeweging. Externe controles gebeuren door bevoegd personeel.'] },
      { title: 'Intellectuele eigendom', paragraphs: ['Structuur, teksten, afbeeldingen, software en kenmerken zijn beschermd. Onbevoegde reproductie of hergebruik is verboden, behoudens wettelijke uitzonderingen.'] },
      { title: 'Melden en contact', paragraphs: ['Meld inhoud, kwetsbaarheden, fouten of onrechtmatig gebruik met een precieze beschrijving aan {supportEmail}.'] },
    ] },
    privacy: { title: 'Privacybeleid', description: 'Informatie over de verwerking van persoonsgegevens.', introduction: 'Dit beleid legt uit welke gegevens {bankName} gebruikt, waarom en hoe u uw rechten uitoefent.', sections: [
      { title: 'Verantwoordelijke en contact', paragraphs: ['De exploitant van {bankName} bepaalt de verwerking voor gebruikers en verrichtingen. Neem voor persoonsgegevens contact op via {supportEmail}.'] },
      { title: 'Verwerkte gegevens', items: ['identiteit, contact, taal, valuta en authenticatie;', 'identiteitscontrole, identiteitsbewijs, adresbewijs en optionele selfie via camera of galerij;', 'posities, boekingen, overschrijvingsintenties, leningen en documenten;', 'supportberichten, optionele meldingen en voorkeuren;', 'technische logs, beveiligingsgebeurtenissen en auditsporen.'] },
      { title: 'Doeleinden en grondslagen', paragraphs: ['Gegevens dienen voor accountbeveiliging, dienst en support, handmatige identiteitscontrole, betrouwbare registers, fraudepreventie en noodzakelijke berichten. Grondslag is overeenkomst, wettelijke plicht, gerechtvaardigd belang of toestemming.'] },
      { title: 'Ontvangers en leveranciers', paragraphs: ['Betrokken gebruikers, bevoegd personeel en noodzakelijke leveranciers hebben toegang: Supabase, Netlify, Resend of Brevo en Tawk.to bij online support.'] },
      { title: 'Bewaring en beveiliging', paragraphs: ['Gegevens worden bewaard voor account, verrichtingen, verplichtingen en rechten. Bewijzen zijn privé, toegang is rolgestuurd en gevoelige acties worden gelogd.'] },
      { title: 'Internationale doorgifte', paragraphs: ['Leveranciers kunnen buiten de EER verwerken met passende waarborgen zoals een adequaatheidsbesluit of standaardcontractbepalingen.'] },
      { title: 'Uw rechten', paragraphs: ['U kunt inzage, correctie, verwijdering, beperking of overdraagbaarheid vragen en bezwaar maken. Contacteer {supportEmail} of de bevoegde toezichthouder.'] },
      { title: 'Cookies', paragraphs: ['Het cookiebeleid beschrijft cookies, lokale opslag en diensten van derden.'] },
    ] },
    terms: { title: 'Gebruiksvoorwaarden', description: 'Voorwaarden voor het gebruik van de dienst.', introduction: 'Deze voorwaarden regelen toegang tot en gebruik van {bankName}. Door gebruik stemt u ermee in.', sections: [
      { title: 'Doel', paragraphs: ['{bankName} registreert en controleert identiteit, posities, verrichtingen, aanvragen en documenten. De dienst is niet gekoppeld aan externe bankinfrastructuur en voert geen geldbeweging automatisch uit.'] },
      { title: 'Toegang en geschiktheid', paragraphs: ['Toegang is voor bevoegde personen. Identiteitscontrole is voor volwassenen. U moet juiste gegevens geven en uw inloggegevens en toestel beschermen.'] },
      { title: 'Identiteitscontrole', paragraphs: ['De selfie is optioneel. U kunt hem met de camera maken of uit de galerij kiezen. Documenten worden handmatig beoordeeld; indienen betekent geen automatische aanvaarding.'] },
      { title: 'Verrichtingen en documenten', paragraphs: ['Getoonde informatie weerspiegelt gegevens die bevoegd personeel heeft gemeld of goedgekeurd. Echte financiële uitvoering gebeurt via externe procedures.'] },
      { title: 'Verboden gebruik', items: ['identiteitsmisbruik, vervalste documenten of toegang tot andermans account;', 'controles omzeilen, de dienst verstoren of onbevoegd kwetsbaarheden zoeken;', 'frauduleus of onrechtmatig gebruik;', 'gegevens onbevoegd onttrekken of verspreiden.'] },
      { title: 'Beschikbaarheid en aansprakelijkheid', paragraphs: ['Onderbrekingen kunnen nodig zijn. {bankName} neemt redelijke maatregelen zonder continue beschikbaarheid te garanderen. Wettelijk dwingende aansprakelijkheid blijft gelden.'] },
      { title: 'Opschorting en verwijdering', paragraphs: ['Toegang kan worden opgeschort wegens veiligheid, verboden gebruik, wetgeving of einde van bevoegdheid. Verwijdering volgt integriteitscontroles en bewaarplichten.'] },
      { title: 'Wijzigingen en contact', paragraphs: ['Deze voorwaarden kunnen wijzigen. Contacteer {supportEmail} met vragen of geschillen.'] },
    ] },
    cookies: { title: 'Cookiebeleid', description: 'Informatie over cookies en opslag van de dienst.', introduction: 'Deze pagina beschrijft cookies, lokale opslag en derden die {bankName} kan gebruiken.', sections: [
      { title: 'Strikt noodzakelijke opslag', paragraphs: ['{bankName} gebruikt opslag voor veilige sessies, authenticatie, taal en voorkeuren. Uitschakelen kan aanmelden verhinderen of de dienst aantasten.'] },
      { title: 'Online support en derden', paragraphs: ['Tawk.to kan in het beveiligde gedeelte cookies gebruiken voor continuïteit en veiligheid van de chat. Netlify en Supabase verwerken noodzakelijke technische identifiers. Er zijn geen advertentietrackers.'] },
      { title: 'Duur en controle', paragraphs: ['De duur hangt af van doel en leverancier. U kunt sitegegevens wissen of cookies van derden blokkeren. Essentiële opslag blokkeren kan de sessie beëindigen.'] },
      { title: 'Contact', paragraphs: ['Voor informatie of rechten over deze technologieën: {supportEmail}.'] },
    ] },
  },
};

export async function getLegalLanguage(): Promise<Language> {
  const cookieLanguage = (await cookies()).get(LANGUAGE_COOKIE)?.value;
  if (isSupportedLanguage(cookieLanguage)) return cookieLanguage;
  const accepted = parseAcceptLanguage((await headers()).get('accept-language'));
  return resolveSupportedLanguage(accepted) ?? 'fr';
}

export function getLegalShell(language: Language): LegalShellCopy {
  return shell[language];
}

export function getLegalPage(language: Language, page: LegalPageKey): LegalPageCopy {
  return pages[language][page];
}

export function interpolateLegalText(value: string, bankName: string, supportEmail: string): string {
  return value
    .replaceAll('{bankName}', bankName)
    .replaceAll('{tradeName}', bankName.toUpperCase())
    .replaceAll('{supportEmail}', supportEmail);
}
