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
        'Accédez à vos comptes, soldes, virements et prêts Monalyz en toute sécurité.',
      email: 'Adresse e-mail',
      password: 'Mot de passe',
      emailPlaceholder: 'vous@exemple.com',
      passwordPlaceholder: 'Saisissez votre mot de passe',
      showPassword: 'Afficher le mot de passe',
      hidePassword: 'Masquer le mot de passe',
      forgotPassword: 'Mot de passe oublié ?',
      submit: 'Se connecter',
      submitting: 'Connexion…',
      newUser: 'Nouveau sur Monalyz ?',
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
      title: 'Ouvrir votre espace Monalyz',
      subtitle:
        'Renseignez vos informations pour créer votre accès sécurisé aux services bancaires Monalyz.',
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
      checkEmailTitle: 'Vérifiez votre adresse e-mail',
      checkEmailBody:
        'Le lien sécurisé vous ramènera vers le dépôt de votre dossier d’identité.',
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
        'Securely access your Monalyz accounts, balances, transfers and loans.',
      email: 'Email address',
      password: 'Password',
      emailPlaceholder: 'you@example.com',
      passwordPlaceholder: 'Enter your password',
      showPassword: 'Show password',
      hidePassword: 'Hide password',
      forgotPassword: 'Forgot your password?',
      submit: 'Sign in',
      submitting: 'Signing in…',
      newUser: 'New to Monalyz?',
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
      title: 'Open your Monalyz account',
      subtitle:
        'Enter your details to create secure access to Monalyz banking services.',
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
      checkEmailTitle: 'Check your email address',
      checkEmailBody:
        'The secure link will return you to the identity-document submission.',
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
        'Greifen Sie sicher auf Ihre Monalyz-Konten, Salden, Überweisungen und Kredite zu.',
      email: 'E-Mail-Adresse',
      password: 'Passwort',
      emailPlaceholder: 'sie@beispiel.de',
      passwordPlaceholder: 'Geben Sie Ihr Passwort ein',
      showPassword: 'Passwort anzeigen',
      hidePassword: 'Passwort ausblenden',
      forgotPassword: 'Passwort vergessen?',
      submit: 'Anmelden',
      submitting: 'Anmeldung…',
      newUser: 'Neu bei Monalyz?',
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
      title: 'Ihren Monalyz-Zugang eröffnen',
      subtitle:
        'Geben Sie Ihre Daten ein, um einen sicheren Zugang zu den Bankdienstleistungen von Monalyz einzurichten.',
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
      checkEmailTitle: 'Prüfen Sie Ihre E-Mail-Adresse',
      checkEmailBody:
        'Der sichere Link führt Sie zur Übermittlung Ihrer Identitätsunterlagen zurück.',
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
        'Acceda de forma segura a sus cuentas, saldos, transferencias y préstamos Monalyz.',
      email: 'Correo electrónico',
      password: 'Contraseña',
      emailPlaceholder: 'usted@ejemplo.com',
      passwordPlaceholder: 'Introduzca su contraseña',
      showPassword: 'Mostrar contraseña',
      hidePassword: 'Ocultar contraseña',
      forgotPassword: '¿Olvidó su contraseña?',
      submit: 'Iniciar sesión',
      submitting: 'Conectando…',
      newUser: '¿Es nuevo en Monalyz?',
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
      title: 'Abra su espacio Monalyz',
      subtitle:
        'Introduzca sus datos para crear un acceso seguro a los servicios bancarios de Monalyz.',
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
      checkEmailTitle: 'Compruebe su correo electrónico',
      checkEmailBody:
        'El enlace seguro le devolverá al envío de sus documentos de identidad.',
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
