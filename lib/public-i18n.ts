import type { Language } from './types';

interface PublicMessages {
  languageSelector: string;
  login: {
    title: string;
    subtitle: string;
    email: string;
    password: string;
    emailPlaceholder: string;
    passwordPlaceholder: string;
    showPassword: string;
    hidePassword: string;
    forgotPassword: string;
    submit: string;
    submitting: string;
    newUser: string;
    register: string;
    genericError: string;
    errors: Record<string, string>;
  };
  register: {
    title: string;
    subtitle: string;
    displayName: string;
    email: string;
    password: string;
    confirmPassword: string;
    displayNamePlaceholder: string;
    emailPlaceholder: string;
    passwordPlaceholder: string;
    confirmPasswordPlaceholder: string;
    passwordHint: string;
    showPassword: string;
    hidePassword: string;
    submit: string;
    submitting: string;
    passwordPolicyError: string;
    passwordMismatchError: string;
    genericError: string;
    checkEmailTitle: string;
    checkEmailBody: string;
    otpLabel: string;
    otpPlaceholder: string;
    otpHint: string;
    otpSubmit: string;
    otpSubmitting: string;
    otpInvalidError: string;
    otpVerificationError: string;
    resendPrompt: string;
    resendAction: string;
    resending: string;
    resendCooldown: string;
    resendSuccess: string;
    resendError: string;
    backToLogin: string;
  };
  adminLogin: {
    restricted: string;
    email: string;
    password: string;
    emailPlaceholder: string;
    passwordPlaceholder: string;
    showPassword: string;
    hidePassword: string;
    submit: string;
    submitting: string;
    backToUser: string;
    forbidden: string;
    genericError: string;
    errors: Record<string, string>;
  };
  resetPassword: {
    requestTitle: string;
    updateTitle: string;
    email: string;
    password: string;
    confirmPassword: string;
    emailPlaceholder: string;
    passwordPlaceholder: string;
    confirmPasswordPlaceholder: string;
    passwordHint: string;
    showPassword: string;
    hidePassword: string;
    requestSubmit: string;
    updateSubmit: string;
    submitting: string;
    recoveryError: string;
    passwordError: string;
    requestSuccess: string;
    requestError: string;
    updateError: string;
    backToLogin: string;
  };
}

export const publicMessages: Record<Language, PublicMessages> = {
  fr: {
    languageSelector: 'Langue',
    login: {
      title: 'Connexion à votre espace',
      subtitle:
        'Accédez à vos comptes, soldes, virements et prêts {bankName} en toute sécurité.',
      email: 'Adresse e-mail',
      password: 'Mot de passe',
      emailPlaceholder: 'vous@exemple.com',
      passwordPlaceholder: 'Saisissez votre mot de passe',
      showPassword: 'Afficher le mot de passe',
      hidePassword: 'Masquer le mot de passe',
      forgotPassword: 'Mot de passe oublié ?',
      submit: 'Se connecter',
      submitting: 'Connexion…',
      newUser: 'Nouveau sur {bankName} ?',
      register: 'Ouvrir mon espace bancaire',
      genericError: 'Connexion impossible. Vérifiez vos identifiants.',
      errors: {
        auth_callback: 'Le lien de connexion est invalide ou expiré.',
        auth_confirmation: 'Le lien de confirmation est invalide ou expiré.',
        configuration: 'La connexion Supabase doit être configurée par le déploiement.',
        session: 'Votre session a expiré ou a été révoquée. Reconnectez-vous.',
      },
    },
    register: {
      title: 'Ouvrir votre espace {bankName}',
      subtitle:
        'Renseignez vos informations pour créer votre accès sécurisé aux services bancaires {bankName}.',
      displayName: 'Nom complet',
      email: 'Adresse e-mail personnelle',
      password: 'Mot de passe',
      confirmPassword: 'Confirmation du mot de passe',
      displayNamePlaceholder: 'Prénom et nom',
      emailPlaceholder: 'vous@exemple.com',
      passwordPlaceholder: 'Choisissez un mot de passe sécurisé',
      confirmPasswordPlaceholder: 'Confirmez votre mot de passe',
      passwordHint:
        '10 caractères minimum, avec au moins une lettre et un chiffre.',
      showPassword: 'Afficher le mot de passe',
      hidePassword: 'Masquer le mot de passe',
      submit: 'Ouvrir mon espace sécurisé',
      submitting: 'Ouverture en cours…',
      passwordPolicyError:
        'Le mot de passe doit comporter au moins 10 caractères, dont une lettre et un chiffre.',
      passwordMismatchError: 'Les mots de passe ne correspondent pas.',
      genericError: 'Création du compte impossible.',
      checkEmailTitle: 'Saisissez votre code de confirmation',
      checkEmailBody:
        'Un code à 6 chiffres a été envoyé à {email}. Saisissez-le ci-dessous pour confirmer votre adresse et poursuivre votre inscription.',
      otpLabel: 'Code reçu par e-mail',
      otpPlaceholder: '000000',
      otpHint: 'Ce code est personnel. Ne le communiquez jamais à un tiers.',
      otpSubmit: 'Confirmer mon adresse',
      otpSubmitting: 'Vérification…',
      otpInvalidError: 'Saisissez le code à 6 chiffres reçu par e-mail.',
      otpVerificationError: 'Ce code est invalide ou expiré. Vérifiez-le ou demandez un nouveau code.',
      resendPrompt: 'Vous n’avez pas reçu le code ?',
      resendAction: 'Renvoyer le code',
      resending: 'Envoi…',
      resendCooldown: 'Nouvel envoi possible dans {seconds} s',
      resendSuccess: 'Un nouveau code vient de vous être envoyé.',
      resendError: 'Le code n’a pas pu être renvoyé. Réessayez dans quelques instants.',
      backToLogin: 'Revenir à la connexion',
    },
    adminLogin: {
      restricted: 'Accès réservé au chef d’agence',
      email: 'E-mail professionnel',
      password: 'Mot de passe',
      emailPlaceholder: 'prenom.nom@monalyz.com',
      passwordPlaceholder: 'Saisissez votre mot de passe',
      showPassword: 'Afficher le mot de passe',
      hidePassword: 'Masquer le mot de passe',
      submit: 'Ouvrir l’espace chef d’agence',
      submitting: 'Vérification des habilitations…',
      backToUser: 'Retour à l’espace utilisateur',
      forbidden: 'Ce compte ne dispose pas de l’habilitation chef d’agence.',
      genericError: 'Authentification Back-Office impossible.',
      errors: {
        configuration: 'La connexion Supabase doit être configurée par le déploiement.',
        session:
          'Votre session Back-Office a expiré ou a été révoquée. Reconnectez-vous.',
      },
    },
    resetPassword: {
      requestTitle: 'Réinitialiser le mot de passe',
      updateTitle: 'Choisir un nouveau mot de passe',
      email: 'Adresse e-mail',
      password: 'Nouveau mot de passe',
      confirmPassword: 'Confirmation',
      emailPlaceholder: 'vous@exemple.com',
      passwordPlaceholder: 'Créez un nouveau mot de passe',
      confirmPasswordPlaceholder: 'Confirmez le nouveau mot de passe',
      passwordHint:
        'Utilisez au moins 10 caractères, dont une lettre et un chiffre.',
      showPassword: 'Afficher le mot de passe',
      hidePassword: 'Masquer le mot de passe',
      requestSubmit: 'Envoyer le lien sécurisé',
      updateSubmit: 'Enregistrer',
      submitting: 'Traitement…',
      recoveryError:
        'Le lien de récupération est invalide ou expiré. Demandez-en un nouveau.',
      passwordError:
        'Utilisez au moins 10 caractères avec une lettre et un chiffre, puis saisissez deux valeurs identiques.',
      requestSuccess:
        'Si cette adresse existe, un lien sécurisé a été envoyé. Il expirera selon la politique Supabase Auth.',
      requestError: 'Demande impossible.',
      updateError: 'Mise à jour impossible.',
      backToLogin: 'Retour à la connexion',
    },
  },
  en: {
    languageSelector: 'Language',
    login: {
      title: 'Sign in to your account',
      subtitle:
        'Securely access your {bankName} accounts, balances, transfers and loans.',
      email: 'Email address',
      password: 'Password',
      emailPlaceholder: 'you@example.com',
      passwordPlaceholder: 'Enter your password',
      showPassword: 'Show password',
      hidePassword: 'Hide password',
      forgotPassword: 'Forgot your password?',
      submit: 'Sign in',
      submitting: 'Signing in…',
      newUser: 'New to {bankName}?',
      register: 'Open my online banking',
      genericError: 'Unable to sign in. Check your credentials.',
      errors: {
        auth_callback: 'The sign-in link is invalid or has expired.',
        auth_confirmation: 'The confirmation link is invalid or has expired.',
        configuration: 'The deployment must configure the Supabase connection.',
        session: 'Your session has expired or was revoked. Please sign in again.',
      },
    },
    register: {
      title: 'Open your {bankName} account',
      subtitle:
        'Enter your details to create secure access to {bankName} banking services.',
      displayName: 'Full name',
      email: 'Personal email address',
      password: 'Password',
      confirmPassword: 'Password confirmation',
      displayNamePlaceholder: 'First and last name',
      emailPlaceholder: 'you@example.com',
      passwordPlaceholder: 'Choose a secure password',
      confirmPasswordPlaceholder: 'Confirm your password',
      passwordHint:
        'At least 10 characters, including one letter and one number.',
      showPassword: 'Show password',
      hidePassword: 'Hide password',
      submit: 'Open my secure account',
      submitting: 'Opening your account…',
      passwordPolicyError:
        'The password must contain at least 10 characters, including a letter and a number.',
      passwordMismatchError: 'The passwords do not match.',
      genericError: 'Unable to create the account.',
      checkEmailTitle: 'Enter your confirmation code',
      checkEmailBody:
        'A 6-digit code was sent to {email}. Enter it below to confirm your address and continue registration.',
      otpLabel: 'Code received by email',
      otpPlaceholder: '000000',
      otpHint: 'This code is personal. Never share it with anyone.',
      otpSubmit: 'Confirm my address',
      otpSubmitting: 'Verifying…',
      otpInvalidError: 'Enter the 6-digit code received by email.',
      otpVerificationError: 'This code is invalid or expired. Check it or request a new code.',
      resendPrompt: 'Didn’t receive the code?',
      resendAction: 'Resend code',
      resending: 'Sending…',
      resendCooldown: 'You can resend a code in {seconds}s',
      resendSuccess: 'A new code has just been sent to you.',
      resendError: 'The code could not be resent. Try again in a moment.',
      backToLogin: 'Back to sign in',
    },
    adminLogin: {
      restricted: 'Branch manager access only',
      email: 'Work email',
      password: 'Password',
      emailPlaceholder: 'first.last@monalyz.com',
      passwordPlaceholder: 'Enter your password',
      showPassword: 'Show password',
      hidePassword: 'Hide password',
      submit: 'Open the branch manager workspace',
      submitting: 'Checking permissions…',
      backToUser: 'Back to the user workspace',
      forbidden: 'This account does not have branch manager permission.',
      genericError: 'Back-office authentication failed.',
      errors: {
        configuration: 'The deployment must configure the Supabase connection.',
        session:
          'Your back-office session has expired or was revoked. Please sign in again.',
      },
    },
    resetPassword: {
      requestTitle: 'Reset your password',
      updateTitle: 'Choose a new password',
      email: 'Email address',
      password: 'New password',
      confirmPassword: 'Confirmation',
      emailPlaceholder: 'you@example.com',
      passwordPlaceholder: 'Create a new password',
      confirmPasswordPlaceholder: 'Confirm your new password',
      passwordHint:
        'Use at least 10 characters, including one letter and one number.',
      showPassword: 'Show password',
      hidePassword: 'Hide password',
      requestSubmit: 'Send the secure link',
      updateSubmit: 'Save',
      submitting: 'Processing…',
      recoveryError:
        'The recovery link is invalid or has expired. Please request a new one.',
      passwordError:
        'Use at least 10 characters with a letter and a number, then enter the same value twice.',
      requestSuccess:
        'If this address exists, a secure link has been sent. It will expire according to the Supabase Auth policy.',
      requestError: 'Unable to submit the request.',
      updateError: 'Unable to update the password.',
      backToLogin: 'Back to sign in',
    },
  },
  de: {
    languageSelector: 'Sprache',
    login: {
      title: 'Bei Ihrem Bereich anmelden',
      subtitle:
        'Greifen Sie sicher auf Ihre {bankName}-Konten, Salden, Überweisungen und Kredite zu.',
      email: 'E-Mail-Adresse',
      password: 'Passwort',
      emailPlaceholder: 'sie@beispiel.de',
      passwordPlaceholder: 'Geben Sie Ihr Passwort ein',
      showPassword: 'Passwort anzeigen',
      hidePassword: 'Passwort ausblenden',
      forgotPassword: 'Passwort vergessen?',
      submit: 'Anmelden',
      submitting: 'Anmeldung…',
      newUser: 'Neu bei {bankName}?',
      register: 'Online-Banking eröffnen',
      genericError: 'Anmeldung nicht möglich. Prüfen Sie Ihre Zugangsdaten.',
      errors: {
        auth_callback: 'Der Anmeldelink ist ungültig oder abgelaufen.',
        auth_confirmation: 'Der Bestätigungslink ist ungültig oder abgelaufen.',
        configuration: 'Die Supabase-Verbindung muss im Deployment konfiguriert werden.',
        session:
          'Ihre Sitzung ist abgelaufen oder wurde widerrufen. Melden Sie sich erneut an.',
      },
    },
    register: {
      title: 'Ihren {bankName}-Zugang eröffnen',
      subtitle:
        'Geben Sie Ihre Daten ein, um einen sicheren Zugang zu den Bankdienstleistungen von {bankName} einzurichten.',
      displayName: 'Vollständiger Name',
      email: 'Persönliche E-Mail-Adresse',
      password: 'Passwort',
      confirmPassword: 'Passwortbestätigung',
      displayNamePlaceholder: 'Vor- und Nachname',
      emailPlaceholder: 'sie@beispiel.de',
      passwordPlaceholder: 'Wählen Sie ein sicheres Passwort',
      confirmPasswordPlaceholder: 'Bestätigen Sie Ihr Passwort',
      passwordHint:
        'Mindestens 10 Zeichen, darunter ein Buchstabe und eine Zahl.',
      showPassword: 'Passwort anzeigen',
      hidePassword: 'Passwort ausblenden',
      submit: 'Sicheren Zugang eröffnen',
      submitting: 'Zugang wird eröffnet…',
      passwordPolicyError:
        'Das Passwort muss mindestens 10 Zeichen sowie einen Buchstaben und eine Zahl enthalten.',
      passwordMismatchError: 'Die Passwörter stimmen nicht überein.',
      genericError: 'Das Konto konnte nicht erstellt werden.',
      checkEmailTitle: 'Bestätigungscode eingeben',
      checkEmailBody:
        'Ein 6-stelliger Code wurde an {email} gesendet. Geben Sie ihn unten ein, um Ihre Adresse zu bestätigen und die Registrierung fortzusetzen.',
      otpLabel: 'Per E-Mail erhaltener Code',
      otpPlaceholder: '000000',
      otpHint: 'Dieser Code ist persönlich. Geben Sie ihn niemals an Dritte weiter.',
      otpSubmit: 'E-Mail-Adresse bestätigen',
      otpSubmitting: 'Wird geprüft…',
      otpInvalidError: 'Geben Sie den 6-stelligen Code aus der E-Mail ein.',
      otpVerificationError: 'Dieser Code ist ungültig oder abgelaufen. Prüfen Sie ihn oder fordern Sie einen neuen Code an.',
      resendPrompt: 'Keinen Code erhalten?',
      resendAction: 'Code erneut senden',
      resending: 'Wird gesendet…',
      resendCooldown: 'Neuer Code in {seconds} Sek. möglich',
      resendSuccess: 'Ein neuer Code wurde Ihnen soeben gesendet.',
      resendError: 'Der Code konnte nicht erneut gesendet werden. Versuchen Sie es später noch einmal.',
      backToLogin: 'Zurück zur Anmeldung',
    },
    adminLogin: {
      restricted: 'Nur für Filialleiter',
      email: 'Geschäftliche E-Mail-Adresse',
      password: 'Passwort',
      emailPlaceholder: 'vorname.nachname@monalyz.com',
      passwordPlaceholder: 'Geben Sie Ihr Passwort ein',
      showPassword: 'Passwort anzeigen',
      hidePassword: 'Passwort ausblenden',
      submit: 'Filialleiterbereich öffnen',
      submitting: 'Berechtigungen werden geprüft…',
      backToUser: 'Zurück zum Benutzerbereich',
      forbidden: 'Dieses Konto besitzt keine Filialleiterberechtigung.',
      genericError: 'Backoffice-Anmeldung nicht möglich.',
      errors: {
        configuration: 'Die Supabase-Verbindung muss im Deployment konfiguriert werden.',
        session:
          'Ihre Backoffice-Sitzung ist abgelaufen oder wurde widerrufen. Melden Sie sich erneut an.',
      },
    },
    resetPassword: {
      requestTitle: 'Passwort zurücksetzen',
      updateTitle: 'Neues Passwort wählen',
      email: 'E-Mail-Adresse',
      password: 'Neues Passwort',
      confirmPassword: 'Bestätigung',
      emailPlaceholder: 'sie@beispiel.de',
      passwordPlaceholder: 'Erstellen Sie ein neues Passwort',
      confirmPasswordPlaceholder: 'Bestätigen Sie Ihr neues Passwort',
      passwordHint:
        'Verwenden Sie mindestens 10 Zeichen, darunter einen Buchstaben und eine Zahl.',
      showPassword: 'Passwort anzeigen',
      hidePassword: 'Passwort ausblenden',
      requestSubmit: 'Sicheren Link senden',
      updateSubmit: 'Speichern',
      submitting: 'Verarbeitung…',
      recoveryError:
        'Der Wiederherstellungslink ist ungültig oder abgelaufen. Fordern Sie einen neuen an.',
      passwordError:
        'Verwenden Sie mindestens 10 Zeichen mit einem Buchstaben und einer Zahl und geben Sie denselben Wert zweimal ein.',
      requestSuccess:
        'Falls diese Adresse existiert, wurde ein sicherer Link gesendet. Er läuft gemäß der Supabase-Auth-Richtlinie ab.',
      requestError: 'Anfrage nicht möglich.',
      updateError: 'Aktualisierung nicht möglich.',
      backToLogin: 'Zurück zur Anmeldung',
    },
  },
  es: {
    languageSelector: 'Idioma',
    login: {
      title: 'Acceda a su espacio',
      subtitle:
        'Acceda de forma segura a sus cuentas, saldos, transferencias y préstamos {bankName}.',
      email: 'Correo electrónico',
      password: 'Contraseña',
      emailPlaceholder: 'usted@ejemplo.com',
      passwordPlaceholder: 'Introduzca su contraseña',
      showPassword: 'Mostrar contraseña',
      hidePassword: 'Ocultar contraseña',
      forgotPassword: '¿Olvidó su contraseña?',
      submit: 'Iniciar sesión',
      submitting: 'Conectando…',
      newUser: '¿Es nuevo en {bankName}?',
      register: 'Abrir mi banca en línea',
      genericError: 'No se pudo iniciar sesión. Compruebe sus credenciales.',
      errors: {
        auth_callback: 'El enlace de inicio de sesión no es válido o ha caducado.',
        auth_confirmation: 'El enlace de confirmación no es válido o ha caducado.',
        configuration: 'El despliegue debe configurar la conexión con Supabase.',
        session: 'Su sesión ha caducado o ha sido revocada. Vuelva a iniciar sesión.',
      },
    },
    register: {
      title: 'Abra su espacio {bankName}',
      subtitle:
        'Introduzca sus datos para crear un acceso seguro a los servicios bancarios de {bankName}.',
      displayName: 'Nombre completo',
      email: 'Correo electrónico personal',
      password: 'Contraseña',
      confirmPassword: 'Confirmación de la contraseña',
      displayNamePlaceholder: 'Nombre y apellidos',
      emailPlaceholder: 'usted@ejemplo.com',
      passwordPlaceholder: 'Elija una contraseña segura',
      confirmPasswordPlaceholder: 'Confirme su contraseña',
      passwordHint:
        'Mínimo 10 caracteres, con al menos una letra y un número.',
      showPassword: 'Mostrar contraseña',
      hidePassword: 'Ocultar contraseña',
      submit: 'Abrir mi espacio seguro',
      submitting: 'Abriendo su espacio…',
      passwordPolicyError:
        'La contraseña debe tener al menos 10 caracteres, incluida una letra y un número.',
      passwordMismatchError: 'Las contraseñas no coinciden.',
      genericError: 'No se pudo crear la cuenta.',
      checkEmailTitle: 'Introduzca su código de confirmación',
      checkEmailBody:
        'Se ha enviado un código de 6 dígitos a {email}. Introdúzcalo para confirmar su dirección y continuar el registro.',
      otpLabel: 'Código recibido por correo',
      otpPlaceholder: '000000',
      otpHint: 'Este código es personal. No lo comparta nunca con nadie.',
      otpSubmit: 'Confirmar mi dirección',
      otpSubmitting: 'Verificando…',
      otpInvalidError: 'Introduzca el código de 6 dígitos recibido por correo.',
      otpVerificationError: 'Este código no es válido o ha caducado. Compruébelo o solicite uno nuevo.',
      resendPrompt: '¿No ha recibido el código?',
      resendAction: 'Reenviar el código',
      resending: 'Enviando…',
      resendCooldown: 'Podrá reenviar un código en {seconds} s',
      resendSuccess: 'Se le acaba de enviar un nuevo código.',
      resendError: 'No se pudo reenviar el código. Inténtelo de nuevo en unos instantes.',
      backToLogin: 'Volver al inicio de sesión',
    },
    adminLogin: {
      restricted: 'Acceso exclusivo para el director de sucursal',
      email: 'Correo profesional',
      password: 'Contraseña',
      emailPlaceholder: 'nombre.apellido@monalyz.com',
      passwordPlaceholder: 'Introduzca su contraseña',
      showPassword: 'Mostrar contraseña',
      hidePassword: 'Ocultar contraseña',
      submit: 'Abrir el espacio del director de sucursal',
      submitting: 'Comprobando permisos…',
      backToUser: 'Volver al espacio de usuario',
      forbidden: 'Esta cuenta no tiene permisos de director de sucursal.',
      genericError: 'No se pudo autenticar en el back office.',
      errors: {
        configuration: 'El despliegue debe configurar la conexión con Supabase.',
        session:
          'Su sesión de back office ha caducado o ha sido revocada. Vuelva a iniciar sesión.',
      },
    },
    resetPassword: {
      requestTitle: 'Restablecer la contraseña',
      updateTitle: 'Elegir una nueva contraseña',
      email: 'Correo electrónico',
      password: 'Nueva contraseña',
      confirmPassword: 'Confirmación',
      emailPlaceholder: 'usted@ejemplo.com',
      passwordPlaceholder: 'Cree una contraseña nueva',
      confirmPasswordPlaceholder: 'Confirme la nueva contraseña',
      passwordHint:
        'Use al menos 10 caracteres, con una letra y un número.',
      showPassword: 'Mostrar contraseña',
      hidePassword: 'Ocultar contraseña',
      requestSubmit: 'Enviar el enlace seguro',
      updateSubmit: 'Guardar',
      submitting: 'Procesando…',
      recoveryError:
        'El enlace de recuperación no es válido o ha caducado. Solicite uno nuevo.',
      passwordError:
        'Use al menos 10 caracteres con una letra y un número e introduzca el mismo valor dos veces.',
      requestSuccess:
        'Si esta dirección existe, se ha enviado un enlace seguro. Caducará según la política de Supabase Auth.',
      requestError: 'No se pudo enviar la solicitud.',
      updateError: 'No se pudo actualizar la contraseña.',
      backToLogin: 'Volver al inicio de sesión',
    },
  },
};
