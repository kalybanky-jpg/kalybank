import type { Language } from './types';

interface PublicMessages {
  languageSelector: string;
  login: {
    title: string;
    subtitle: string;
    email: string;
    password: string;
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
        'Monalyz initie et suit vos instructions. Aucune banque n’est connectée.',
      email: 'Adresse e-mail',
      password: 'Mot de passe',
      forgotPassword: 'Mot de passe oublié ?',
      submit: 'Se connecter',
      submitting: 'Connexion…',
      newUser: 'Nouveau sur Monalyz ?',
      register: 'Créer un compte applicatif',
      genericError: 'Connexion impossible. Vérifiez vos identifiants.',
      errors: {
        auth_callback: 'Le lien de connexion est invalide ou expiré.',
        auth_confirmation: 'Le lien de confirmation est invalide ou expiré.',
        configuration: 'La connexion Supabase doit être configurée par le déploiement.',
        session: 'Votre session a expiré ou a été révoquée. Reconnectez-vous.',
      },
    },
    register: {
      title: 'Créer un compte Monalyz',
      subtitle:
        'Ce compte donne accès à un outil d’instruction et de suivi. Il ne crée ni compte bancaire, ni IBAN, ni connexion à une banque.',
      displayName: 'Nom affiché',
      email: 'Adresse e-mail',
      password: 'Mot de passe (10 caractères minimum, avec lettre et chiffre)',
      confirmPassword: 'Confirmation du mot de passe',
      submit: 'Créer mon compte applicatif',
      submitting: 'Création…',
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
        'Monalyz initiates and tracks your instructions. No bank is connected.',
      email: 'Email address',
      password: 'Password',
      forgotPassword: 'Forgot your password?',
      submit: 'Sign in',
      submitting: 'Signing in…',
      newUser: 'New to Monalyz?',
      register: 'Create an application account',
      genericError: 'Unable to sign in. Check your credentials.',
      errors: {
        auth_callback: 'The sign-in link is invalid or has expired.',
        auth_confirmation: 'The confirmation link is invalid or has expired.',
        configuration: 'The deployment must configure the Supabase connection.',
        session: 'Your session has expired or was revoked. Please sign in again.',
      },
    },
    register: {
      title: 'Create a Monalyz account',
      subtitle:
        'This account provides access to an instruction and tracking tool. It does not create a bank account, IBAN, or bank connection.',
      displayName: 'Display name',
      email: 'Email address',
      password: 'Password (at least 10 characters, including a letter and a number)',
      confirmPassword: 'Confirm password',
      submit: 'Create my application account',
      submitting: 'Creating…',
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
        'Monalyz erfasst und verfolgt Ihre Anweisungen. Es ist keine Bank verbunden.',
      email: 'E-Mail-Adresse',
      password: 'Passwort',
      forgotPassword: 'Passwort vergessen?',
      submit: 'Anmelden',
      submitting: 'Anmeldung…',
      newUser: 'Neu bei Monalyz?',
      register: 'Anwendungskonto erstellen',
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
      title: 'Monalyz-Konto erstellen',
      subtitle:
        'Dieses Konto bietet Zugriff auf ein Werkzeug zur Erfassung und Nachverfolgung. Es erstellt weder ein Bankkonto noch eine IBAN oder Bankverbindung.',
      displayName: 'Anzeigename',
      email: 'E-Mail-Adresse',
      password: 'Passwort (mindestens 10 Zeichen, mit Buchstabe und Zahl)',
      confirmPassword: 'Passwort bestätigen',
      submit: 'Anwendungskonto erstellen',
      submitting: 'Erstellung…',
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
        'Monalyz inicia y sigue sus instrucciones. No hay ningún banco conectado.',
      email: 'Correo electrónico',
      password: 'Contraseña',
      forgotPassword: '¿Olvidó su contraseña?',
      submit: 'Iniciar sesión',
      submitting: 'Conectando…',
      newUser: '¿Es nuevo en Monalyz?',
      register: 'Crear una cuenta de aplicación',
      genericError: 'No se pudo iniciar sesión. Compruebe sus credenciales.',
      errors: {
        auth_callback: 'El enlace de inicio de sesión no es válido o ha caducado.',
        auth_confirmation: 'El enlace de confirmación no es válido o ha caducado.',
        configuration: 'El despliegue debe configurar la conexión con Supabase.',
        session: 'Su sesión ha caducado o ha sido revocada. Vuelva a iniciar sesión.',
      },
    },
    register: {
      title: 'Crear una cuenta Monalyz',
      subtitle:
        'Esta cuenta da acceso a una herramienta de instrucciones y seguimiento. No crea una cuenta bancaria, un IBAN ni una conexión bancaria.',
      displayName: 'Nombre visible',
      email: 'Correo electrónico',
      password: 'Contraseña (mínimo 10 caracteres, con una letra y un número)',
      confirmPassword: 'Confirmar contraseña',
      submit: 'Crear mi cuenta de aplicación',
      submitting: 'Creando…',
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
