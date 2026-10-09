// Aura Application Master Controller

const createDefaultState = () => ({
    username: "Alex",
    relationshipStatus: "dating",
    onboardingPreferences: {
      goal: "conflict",
      communicationStyle: "words",
      emotionalFocus: "anxiety",
      privacyMode: "local"
    },
    onboarded: false,
    completedLessons: [],
    journalEntries: [],
    simMessages: [],
    activeAnalysis: null,
    straightAnswerMode: true,
    currentView: "landing",
    currentCourse: null,
    currentLessonIndex: 0,
    audioPlaying: false,
    audioProgress: 0,
    audioInterval: null
});

const app = {
  state: createDefaultState(),
  currentUser: null,
  authBusy: false,
  phoneConfirmation: null,
  recaptchaVerifier: null,

  // Initialize App
  init: function() {
    this.setupViewRouter();
    this.setupEventListeners();
    this.setupOnboardingWizard();
    this.setupSimulator();

    // Never restore a view from local storage before Firebase has confirmed the user.
    this.switchView('landing');
    this.startSakuraFalling();
    this.startWindBlowing();
    this.logAudit("Aura Engine initialized successfully.");

    const firebase = window.auraFirebase;
    if (!firebase || !firebase.configured) {
      this.logAudit("Firebase Authentication is not configured yet.");
      this.showAuthMessage(this.getFirebaseUnavailableMessage(firebase), true);
      return;
    }

    firebase.onAuthStateChanged(firebase.auth, (user) => {
      this.handleAuthStateChanged(user);
    }, (error) => {
      this.currentUser = null;
      this.switchView('landing');
      this.showAuthMessage(this.getFriendlyAuthError(error), true);
    });
  },

  // Local data is private to the signed-in Firebase user on this browser.
  storageKey: function(uid) {
    const userId = uid || (this.currentUser && this.currentUser.uid);
    return userId ? `aura_state_vault:${userId}` : null;
  },

  saveState: function() {
    const key = this.storageKey();
    if (!key) return;
    localStorage.setItem(key, JSON.stringify(this.state));
  },

  loadState: function(uid) {
    this.state = createDefaultState();
    const key = this.storageKey(uid);
    const raw = key && localStorage.getItem(key);
    if (raw) {
      try {
        const parsed = JSON.parse(raw);
        this.state = { ...this.state, ...parsed };
      } catch (e) {
        console.error("Failed to parse this user's Local Data Vault. Resetting...", e);
      }
    }
    if (!this.state.activeAnalysis) {
      this.state.activeAnalysis = auraEngines.getDefaultAnalysis();
    }
  },

  handleAuthStateChanged: function(user) {
    this.currentUser = user || null;
    if (!user) {
      this.state = createDefaultState();
      document.getElementById('sidebar').classList.add('hidden');
      this.switchView('landing');
      return;
    }

    this.loadState(user.uid);
    if (!this.state.username || this.state.username === 'Alex') {
      this.state.username = user.displayName || (user.email ? user.email.split('@')[0] : 'User');
    }
    if (window.innerWidth > 968) {
      document.getElementById('sidebar').classList.remove('hidden');
    }
    this.switchView(this.state.onboarded ? 'dashboard' : 'onboarding');
    this.logAudit(`Firebase user authenticated: ${user.uid}`);
  },

  showAuthMessage: function(message, isError) {
    const status = document.getElementById('auth-message');
    if (!status) return;
    status.textContent = message || '';
    status.setAttribute('role', isError ? 'alert' : 'status');
    status.style.color = isError ? 'var(--danger)' : 'var(--text-secondary)';
  },

  getFriendlyAuthError: function(error) {
    const messages = {
      'auth/invalid-email': 'Enter a valid email address.',
      'auth/missing-password': 'Enter your password to continue.',
      'auth/weak-password': 'Choose a password with at least 6 characters.',
      'auth/email-already-in-use': 'An account already uses that email. Try logging in instead.',
      'auth/invalid-credential': 'That email and password combination did not work.',
      'auth/user-not-found': 'No account was found for that email. Try signing up.',
      'auth/wrong-password': 'That email and password combination did not work.',
      'auth/popup-closed-by-user': 'The Google sign in window was closed before finishing.',
      'auth/popup-blocked': 'Your browser blocked the Google sign in window. Allow popups and try again.',
      'auth/unauthorized-domain': 'This website is not authorized in Firebase yet. Add its domain in Authentication settings.',
      'auth/operation-not-allowed': 'This sign in method is not enabled in Firebase Authentication yet.',
      'auth/network-request-failed': 'Could not reach Firebase. Check your internet connection and try again.',
      'auth/too-many-requests': 'There have been too many attempts. Wait a little and try again.',
      'auth/invalid-phone-number': 'Enter a valid phone number with its country code, such as +1 555 123 4567.',
      'auth/missing-phone-number': 'Enter your phone number with its country code first.',
      'auth/quota-exceeded': 'SMS verification is temporarily unavailable. Try again later.',
      'auth/captcha-check-failed': 'Phone verification could not be completed. Try again.',
      'auth/invalid-verification-code': 'That SMS code is not correct. Check it and try again.',
      'auth/code-expired': 'That SMS code has expired. Request a new code.',
      'auth/session-expired': 'Phone verification expired. Request a new code.'
    };
    const code = error && error.code;
    if (code && messages[code]) return messages[code];
    if (code === 'auth/api-key-not-valid' || code === 'auth/invalid-api-key') {
      return 'Firebase rejected this app’s API key. Check the Web app config and API key settings for project aura-dd66e.';
    }
    if (code === 'auth/app-not-authorized') {
      return 'This website is not authorized to use Firebase Authentication. Check the API key website restrictions and Firebase authorized domains.';
    }
    if (error && error.message === 'firebase-config-missing') {
      return 'Firebase is not connected yet. Add the Web app settings in js/firebase-config.js.';
    }
    if (code) {
      return `We could not complete sign in (${code}). Check Firebase Authentication settings and the browser console.`;
    }
    if (error && error.name) {
      return `We could not complete sign in (${error.name}). Check the browser console for the underlying error.`;
    }
    return 'We could not complete sign in. Please try again.';
  },

  getFirebaseUnavailableMessage: function(firebase) {
    if (!firebase) {
      return 'Firebase Authentication could not load. Check your connection and reload the page.';
    }
    if (firebase.initializationError) {
      const code = firebase.initializationError.code;
      return code
        ? `Firebase Authentication could not initialize (${code}). Check the Web app config and browser console.`
        : 'Firebase Authentication could not initialize. Check the Web app config and browser console.';
    }
    return this.getFriendlyAuthError({ message: 'firebase-config-missing' });
  },

  runAuthAction: async function(button, busyLabel, action) {
    if (this.authBusy) return;
    const firebase = window.auraFirebase;
    if (!firebase || !firebase.configured) {
      this.showAuthMessage(this.getFirebaseUnavailableMessage(firebase), true);
      return;
    }

    this.authBusy = true;
    const buttons = ['btn-auth-submit', 'btn-google-signin', 'btn-phone-send', 'btn-phone-verify', 'btn-signout'];
    const originals = new Map();
    buttons.forEach((id) => {
      const control = document.getElementById(id);
      if (control) {
        originals.set(control, control.textContent);
        control.disabled = true;
      }
    });
    if (button) button.textContent = busyLabel;
    this.showAuthMessage('', false);

    try {
      await action(firebase);
    } catch (error) {
      this.showAuthMessage(this.getFriendlyAuthError(error), true);
      console.error('Aura Firebase Auth request failed', {
        code: error && typeof error.code === 'string' ? error.code : null,
        name: error && typeof error.name === 'string' ? error.name : null
      });
      this.logAudit(`Authentication failed: ${error && error.code ? error.code : 'unknown error'}`);
      if (this.recaptchaVerifier) {
        this.recaptchaVerifier.clear();
        this.recaptchaVerifier = null;
      }
    } finally {
      originals.forEach((label, control) => {
        control.disabled = false;
        control.textContent = label;
      });
      this.authBusy = false;
    }
  },

  // Log to Settings Console
  logAudit: function(msg) {
    const logs = document.getElementById('settings-audit-logs');
    if (logs) {
      const now = new Date();
      const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      logs.append(document.createTextNode(`[${timeStr}] ${msg}`), document.createElement('br'));
      logs.scrollTop = logs.scrollHeight;
    }
  },

  // Announce messages to screen reader live region
  announceA11y: function(msg) {
    const announcer = document.getElementById('a11y-announcer');
    if (announcer) {
      announcer.textContent = msg;
    }
  },

  // Toggle slide-out mobile menu drawer
  toggleMobileMenu: function(isOpen) {
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('sidebar-overlay');
    const trigger = document.getElementById('mobile-menu-trigger');
    const closeBtn = document.getElementById('mobile-menu-close');

    if (!sidebar || !overlay || !trigger) return;

    const shouldOpen = (isOpen !== undefined) ? isOpen : !sidebar.classList.contains('mobile-open');

    if (shouldOpen) {
      sidebar.classList.remove('hidden');
      sidebar.classList.add('mobile-open');
      overlay.classList.add('active');
      overlay.setAttribute('aria-hidden', 'false');
      trigger.setAttribute('aria-expanded', 'true');
      sidebar.setAttribute('aria-hidden', 'false');
      document.body.style.overflow = 'hidden';
      if (closeBtn) closeBtn.focus();
      this.announceA11y("Navigation menu opened");
    } else {
      sidebar.classList.remove('mobile-open');
      overlay.classList.remove('active');
      overlay.setAttribute('aria-hidden', 'true');
      trigger.setAttribute('aria-expanded', 'false');
      if (window.innerWidth <= 968) {
        sidebar.classList.add('hidden');
        sidebar.setAttribute('aria-hidden', 'true');
      }
      document.body.style.overflow = '';
      trigger.focus();
      this.announceA11y("Navigation menu closed");
    }
  },

  // Page view switching router
  switchView: function(viewId) {
    const publicViews = ['landing', 'auth'];
    if (!this.currentUser && !publicViews.includes(viewId)) {
      viewId = 'auth';
    } else if (this.currentUser && viewId === 'auth') {
      viewId = this.state.onboarded ? 'dashboard' : 'onboarding';
    } else if (this.currentUser && !this.state.onboarded && !['landing', 'onboarding'].includes(viewId)) {
      viewId = 'onboarding';
    }

    this.state.currentView = viewId;
    this.saveState();

    // Toggle DOM views
    const views = ['landing', 'auth', 'onboarding', 'dashboard', 'upload', 'analysis', 'reality-check', 'simulator', 'growth', 'settings'];
    views.forEach(v => {
      const el = document.getElementById(`view-${v}`);
      if (el) {
        if (v === viewId) {
          el.classList.remove('hidden');
        } else {
          el.classList.add('hidden');
        }
      }
    });

    // Update active state in Sidebar
    const navItems = document.querySelectorAll('.menu-item');
    navItems.forEach(item => {
      if (item.getAttribute('data-view') === viewId) {
        item.classList.add('active');
        item.setAttribute('aria-current', 'page');
      } else {
        item.classList.remove('active');
        item.removeAttribute('aria-current');
      }
    });

    // Update active state in Mobile Bottom Bar
    const mobileNavItems = document.querySelectorAll('.mobile-nav-item');
    mobileNavItems.forEach(item => {
      if (item.getAttribute('data-view') === viewId) {
        item.classList.add('active');
        item.setAttribute('aria-current', 'page');
      } else {
        item.classList.remove('active');
        item.removeAttribute('aria-current');
      }
    });

    // Run custom rendering functions per view
    this.renderCurrentView();
    this.logAudit(`Switched view to: ${viewId}`);
    this.announceA11y(`Navigated to ${viewId.replace('-', ' ')} page`);
  },

  // Trigger UI updates based on current view loaded
  renderCurrentView: function() {
    const view = this.state.currentView;
    const analysis = this.state.activeAnalysis || auraEngines.getDefaultAnalysis();
    
    // Update profile displays
    const letters = (this.state.username || "US").substring(0,2).toUpperCase();
    document.getElementById('avatar-letters').textContent = letters;
    document.getElementById('profile-display-name').textContent = this.state.username || "User";
    
    if (view === 'dashboard') {
      auraUI.renderDashboard(this.state, analysis);
    } else if (view === 'analysis') {
      auraUI.renderAnalysis(analysis);
    } else if (view === 'reality-check') {
      auraUI.renderRealityCheck(analysis, this.state.straightAnswerMode);
    } else if (view === 'simulator') {
      auraUI.renderSimulator(this.state);
    } else if (view === 'growth') {
      auraUI.renderGrowthHub(this.state);
    }
  },

  // Setup click listeners for sidebar and topbar router triggers
  setupViewRouter: function() {
    const self = this;
    
    // Sidebar clicks & keyboard
    document.querySelectorAll('.menu-item').forEach(item => {
      const handleAction = function() {
        const view = this.getAttribute('data-view');
        self.switchView(view);
        if (window.innerWidth <= 968) {
          self.toggleMobileMenu(false);
        }
      };

      item.addEventListener('click', handleAction);
      item.addEventListener('keydown', function(e) {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          handleAction.call(this);
        }
      });
    });

    // Mobile bottom navigation clicks & keyboard
    document.querySelectorAll('.mobile-nav-item').forEach(item => {
      const handleAction = function() {
        const view = this.getAttribute('data-view');
        self.switchView(view);
      };

      item.addEventListener('click', handleAction);
      item.addEventListener('keydown', function(e) {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          handleAction.call(this);
        }
      });
    });

    // Mobile menu trigger button
    const menuBtn = document.getElementById('mobile-menu-trigger');
    if (menuBtn) {
      menuBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        self.toggleMobileMenu();
      });
    }

    // Mobile menu close button
    const closeBtn = document.getElementById('mobile-menu-close');
    if (closeBtn) {
      closeBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        self.toggleMobileMenu(false);
      });
    }

    // Mobile overlay backdrop click
    const overlay = document.getElementById('sidebar-overlay');
    if (overlay) {
      overlay.addEventListener('click', () => {
        self.toggleMobileMenu(false);
      });
    }

    // Global keyboard shortcuts (Escape key closes drawer)
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        const sidebar = document.getElementById('sidebar');
        if (sidebar && sidebar.classList.contains('mobile-open')) {
          self.toggleMobileMenu(false);
        }
      }
    });

    // Enable keyboard accessibility for wizard option cards, tabs, and course cards
    const enableKeyboardClick = (selector) => {
      document.querySelectorAll(selector).forEach(el => {
        if (!el.hasAttribute('tabindex')) el.setAttribute('tabindex', '0');
        el.addEventListener('keydown', function(e) {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            this.click();
          }
        });
      });
    };

    enableKeyboardClick('.wizard-option-card');
    enableKeyboardClick('.course-card');
    enableKeyboardClick('.auth-tab');
    enableKeyboardClick('.analysis-tab-btn');
  },

  // Setup onboarding step navigation
  setupOnboardingWizard: function() {
    let currentStep = 1;
    const totalSteps = 5;
    const self = this;

    // Multi-choice clicks
    document.querySelectorAll('.wizard-option-card').forEach(card => {
      card.addEventListener('click', function() {
        const parent = this.parentElement;
        parent.querySelectorAll('.wizard-option-card').forEach(c => c.classList.remove('selected'));
        this.classList.add('selected');
        
        // Save values during selection
        const val = this.getAttribute('data-value');
        const step = this.closest('.wizard-step-content').id;
        self.logAudit(`Selected onboarding parameter: ${step} = ${val}`);
      });
    });

    const nextBtn = document.getElementById('btn-onboard-next');
    const backBtn = document.getElementById('btn-onboard-back');
    const progress = document.getElementById('wizard-progress');

    const updateWizard = () => {
      // Toggle visibility
      for (let i = 1; i <= totalSteps; i++) {
        const stepEl = document.getElementById(`step-${i}`);
        if (i === currentStep) {
          stepEl.classList.remove('hidden');
        } else {
          stepEl.classList.add('hidden');
        }
      }

      // Update node active states
      document.querySelectorAll('.wizard-step-node').forEach(node => {
        const nodeStep = parseInt(node.getAttribute('data-step'));
        if (nodeStep === currentStep) {
          node.className = "wizard-step-node active";
        } else if (nodeStep < currentStep) {
          node.className = "wizard-step-node completed";
        } else {
          node.className = "wizard-step-node";
        }
      });

      // Update progress bar width
      const width = ((currentStep - 1) / (totalSteps - 1)) * 100;
      progress.style.width = width + "%";

      // Toggle buttons
      backBtn.style.visibility = (currentStep === 1) ? 'hidden' : 'visible';
      nextBtn.textContent = (currentStep === totalSteps) ? 'Finish & Analyze' : 'Continue';
    };

    nextBtn.addEventListener('click', () => {
      if (currentStep < totalSteps) {
        currentStep++;
        updateWizard();
      } else {
        if (!self.currentUser) {
          self.switchView('auth');
          return;
        }
        // Collect form data and complete onboarding
        const nameVal = document.getElementById('onboard-name').value.trim() || "Alex";
        self.state.username = nameVal;
        
        const selectedStatusCard = document.querySelector('#step-3 .wizard-option-card.selected');
        self.state.relationshipStatus = selectedStatusCard ? selectedStatusCard.getAttribute('data-value') : 'dating';

        const selectedValue = (stepId, fallback) => {
          const selected = document.querySelector(`#${stepId} .wizard-option-card.selected`);
          return selected ? selected.getAttribute('data-value') : fallback;
        };
        self.state.onboardingPreferences = {
          goal: selectedValue('step-1', 'conflict'),
          communicationStyle: selectedValue('step-2', 'words'),
          emotionalFocus: selectedValue('step-4', 'anxiety'),
          privacyMode: selectedValue('step-5', 'local')
        };
        
        self.state.onboarded = true;
        self.saveState();

        if (window.innerWidth > 968) {
          document.getElementById('sidebar').classList.remove('hidden');
        }
        self.logAudit("Onboarding completed successfully. Profile created.");
        
        // Show success alert
        self.switchView('dashboard');
      }
    });

    backBtn.addEventListener('click', () => {
      if (currentStep > 1) {
        currentStep--;
        updateWizard();
      }
    });
  },

  // Setup all secondary feature buttons and listeners
  setupEventListeners: function() {
    const self = this;

    // Welcome start takes new visitors through account creation before onboarding.
    document.getElementById('btn-landing-start').addEventListener('click', () => {
      setAuthMode(true);
      self.switchView('auth');
    });

    document.getElementById('btn-landing-auth').addEventListener('click', () => {
      setAuthMode(false);
      self.switchView('auth');
    });

    const loginTab = document.getElementById('tab-login');
    const registerTab = document.getElementById('tab-register');
    const authSubmit = document.getElementById('btn-auth-submit');
    let isRegistering = false;
    const phoneCodeSection = document.getElementById('phone-code-section');

    function setAuthMode(registering) {
      isRegistering = registering;
      loginTab.classList.toggle('active', !registering);
      registerTab.classList.toggle('active', registering);
      loginTab.setAttribute('aria-selected', String(!registering));
      registerTab.setAttribute('aria-selected', String(registering));
      loginTab.setAttribute('tabindex', registering ? '-1' : '0');
      registerTab.setAttribute('tabindex', registering ? '0' : '-1');
      authSubmit.textContent = registering ? 'Create Account' : "Let's Go";
      document.getElementById('auth-password').setAttribute('autocomplete', registering ? 'new-password' : 'current-password');
      self.showAuthMessage('', false);
    }

    loginTab.addEventListener('click', () => setAuthMode(false));
    registerTab.addEventListener('click', () => setAuthMode(true));
    document.getElementById('btn-auth-back').addEventListener('click', () => {
      setAuthMode(false);
      phoneCodeSection.classList.add('hidden');
      self.phoneConfirmation = null;
      self.switchView('landing');
    });

    document.getElementById('auth-form').addEventListener('submit', (event) => {
      event.preventDefault();
      const form = event.currentTarget;
      if (!form.reportValidity()) return;
      const email = document.getElementById('auth-email').value.trim();
      const password = document.getElementById('auth-password').value;
      self.runAuthAction(authSubmit, isRegistering ? 'Creating account…' : 'Signing in…', (firebase) => {
        const method = isRegistering ? firebase.createUserWithEmailAndPassword : firebase.signInWithEmailAndPassword;
        return method(firebase.auth, email, password);
      });
    });

    document.getElementById('btn-google-signin').addEventListener('click', () => {
      const button = document.getElementById('btn-google-signin');
      self.runAuthAction(button, 'Opening Google…', (firebase) => {
        return firebase.signInWithPopup(firebase.auth, new firebase.GoogleAuthProvider());
      });
    });

    document.getElementById('btn-phone-send').addEventListener('click', () => {
      const button = document.getElementById('btn-phone-send');
      const phoneNumber = document.getElementById('auth-phone').value.trim();
      if (!phoneNumber) {
        self.showAuthMessage('Enter your phone number with its country code first.', true);
        return;
      }
      self.runAuthAction(button, 'Sending code…', async (firebase) => {
        if (!self.recaptchaVerifier) {
          self.recaptchaVerifier = new firebase.RecaptchaVerifier(firebase.auth, 'recaptcha-container', { size: 'invisible' });
        }
        self.phoneConfirmation = await firebase.signInWithPhoneNumber(firebase.auth, phoneNumber, self.recaptchaVerifier);
        phoneCodeSection.classList.remove('hidden');
        document.getElementById('auth-phone-code').focus();
        self.showAuthMessage('A verification code was sent by SMS. Enter it below to continue.', false);
      });
    });

    document.getElementById('btn-phone-verify').addEventListener('click', () => {
      const code = document.getElementById('auth-phone-code').value.trim();
      if (!self.phoneConfirmation) {
        self.showAuthMessage('Request a new SMS verification code first.', true);
        return;
      }
      if (!/^\d{6}$/.test(code)) {
        self.showAuthMessage('Enter the six digit code from your SMS.', true);
        return;
      }
      const button = document.getElementById('btn-phone-verify');
      self.runAuthAction(button, 'Verifying…', async () => {
        await self.phoneConfirmation.confirm(code);
        self.phoneConfirmation = null;
      });
    });

    document.getElementById('btn-signout').addEventListener('click', () => {
      const button = document.getElementById('btn-signout');
      self.runAuthAction(button, 'Signing out…', (firebase) => firebase.signOut(firebase.auth));
    });

    // Sample conversation triggers
    document.getElementById('btn-sample-anxious').addEventListener('click', () => {
      document.getElementById('pasted-chat-text').value = auraData.samples.anxious;
      self.logAudit("Pasted Sample 1 (Anxious vs Avoidant).");
    });
    document.getElementById('btn-sample-passive').addEventListener('click', () => {
      document.getElementById('pasted-chat-text').value = auraData.samples.passive;
      self.logAudit("Pasted Sample 2 (Passive-Aggressive).");
    });
    document.getElementById('btn-sample-secure').addEventListener('click', () => {
      document.getElementById('pasted-chat-text').value = auraData.samples.secure;
      self.logAudit("Pasted Sample 3 (Healthy Boundary).");
    });

    // Analyze pasted chat log
    document.getElementById('btn-analyze-paste').addEventListener('click', () => {
      const text = document.getElementById('pasted-chat-text').value.trim();
      if (!text) {
        alert("Please paste a conversation transcript to analyze.");
        return;
      }

      // Run crisis check
      if (auraEngines.detectCrisis(text)) {
        document.getElementById('crisis-alert-banner').classList.remove('hidden');
        self.logAudit("CRITICAL: Distress keywords triggered safety system.");
      }

      // Analyze
      const analysis = auraEngines.analyzeChat(text);
      self.state.activeAnalysis = analysis;
      self.saveState();

      self.switchView('analysis');
    });

    // Close crisis banner
    document.getElementById('btn-close-crisis-banner').addEventListener('click', () => {
      document.getElementById('crisis-alert-banner').classList.add('hidden');
    });

    // Export PDF mockup
    document.getElementById('btn-export-pdf').addEventListener('click', () => {
      alert("A PDF report containing trust indices, emotional balances, and resolution roadmaps has been downloaded (Simulated).");
      self.logAudit("Exported PDF analysis report.");
    });

    // Reality Check Switches
    const gSwitch = document.getElementById('global-straight-switch');
    const rSwitch = document.getElementById('reality-straight-switch');

    const updateStraightState = (checked) => {
      self.state.straightAnswerMode = checked;
      gSwitch.checked = checked;
      rSwitch.checked = checked;
      
      const card = document.getElementById('reality-straight-toggle');
      if (checked) {
        card.classList.add('straight-answer-active');
      } else {
        card.classList.remove('straight-answer-active');
      }

      self.saveState();
      
      // Re-render reality content if visible
      if (self.state.currentView === 'reality-check') {
        const analysis = self.state.activeAnalysis || auraEngines.getDefaultAnalysis();
        auraUI.renderRealityCheck(analysis, checked);
      }
      self.logAudit(`Toggled Straight-Answer Mode to: ${checked}`);
    };

    gSwitch.addEventListener('change', (e) => updateStraightState(e.target.checked));
    rSwitch.addEventListener('change', (e) => updateStraightState(e.target.checked));

    // Boundary Translation trigger
    document.getElementById('btn-translate-boundary').addEventListener('click', () => {
      const input = document.getElementById('boundary-draft-input').value.trim();
      if (!input) return;

      const output = auraEngines.translateBoundary(input);
      document.getElementById('boundary-translation-output').textContent = output;
      self.logAudit("Boundary Translation Engine computed suggestion.");
    });

    // Save Journal Entry
    document.getElementById('btn-save-journal').addEventListener('click', () => {
      const text = document.getElementById('journal-entry-text').value.trim();
      if (!text) return;

      const prompt = document.getElementById('journal-daily-prompt').textContent;
      const date = new Date().toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
      
      const newEntry = {
        id: 'journal_' + Date.now(),
        date: date,
        prompt: prompt,
        text: text
      };

      self.state.journalEntries.unshift(newEntry);
      self.saveState();
      
      document.getElementById('journal-entry-text').value = "";
      auraUI.renderGrowthHub(self.state);
      self.logAudit("Saved reflective journal entry.");
    });

    // Growth Courses clicks
    document.querySelectorAll('.course-card').forEach(card => {
      card.addEventListener('click', function() {
        const courseId = this.getAttribute('data-course');
        self.loadCourse(courseId);
      });
    });

    // Course Navigation clicks
    document.getElementById('btn-lesson-prev').addEventListener('click', () => self.navigateLesson(-1));
    document.getElementById('btn-lesson-complete').addEventListener('click', () => self.completeLesson());

    // Audio meditator player mockup
    document.getElementById('btn-audio-toggle').addEventListener('click', () => self.toggleMockAudio());

    // Settings actions
    document.getElementById('btn-export-settings-data').addEventListener('click', () => {
      const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(self.state, null, 2));
      const dlAnchorElem = document.createElement('a');
      dlAnchorElem.setAttribute("href", dataStr);
      dlAnchorElem.setAttribute("download", "aura_secure_vault.json");
      dlAnchorElem.click();
      self.logAudit("Data vault exported successfully.");
    });

    document.getElementById('btn-clear-settings-data').addEventListener('click', () => {
      if (confirm("Are you sure you want to delete all local files and metrics? This cannot be undone.")) {
        const key = self.storageKey();
        if (key) localStorage.removeItem(key);
        self.state = createDefaultState();
        self.switchView(self.currentUser ? 'onboarding' : 'landing');
        alert("Your local Aura data for this account has been cleared.");
      }
    });
  },

  // Delete Journal record
  deleteJournal: function(id) {
    this.state.journalEntries = this.state.journalEntries.filter(j => j.id !== id);
    this.saveState();
    auraUI.renderGrowthHub(this.state);
    this.logAudit(`Deleted journal log: ${id}`);
  },

  // Load growth course reader
  loadCourse: function(courseId) {
    const course = auraData.courses[courseId];
    if (!course) return;

    this.state.currentCourse = courseId;
    this.state.currentLessonIndex = 0;

    document.getElementById('course-reader-empty').classList.add('hidden');
    document.getElementById('course-reader-content').classList.remove('hidden');

    this.renderLesson();
    this.logAudit(`Loaded Course: ${course.title}`);
  },

  // Display specific lesson contents in Course Reader
  renderLesson: function() {
    const course = auraData.courses[this.state.currentCourse];
    const lesson = course.lessons[this.state.currentLessonIndex];

    document.getElementById('course-lesson-title').textContent = lesson.title;
    document.getElementById('course-lesson-badge').textContent = course.title;
    
    // Convert newlines to breaks for mock body
    const bodyHTML = lesson.body.replace(/\n/g, '<br>');
    document.getElementById('course-lesson-body').innerHTML = bodyHTML;

    // Reset Audio Mock
    this.stopMockAudio();

    // Toggle complete button status
    const compBtn = document.getElementById('btn-lesson-complete');
    const isCompleted = this.state.completedLessons.includes(lesson.id);
    compBtn.textContent = isCompleted ? "Completed ✓" : "Mark Complete";
    compBtn.className = isCompleted ? "btn btn-secondary" : "btn btn-primary";

    // Toggle prev button visibility
    document.getElementById('btn-lesson-prev').style.visibility = (this.state.currentLessonIndex === 0) ? 'hidden' : 'visible';
  },

  // Slide previous or next lesson
  navigateLesson: function(dir) {
    this.state.currentLessonIndex += dir;
    this.renderLesson();
  },

  // Complete lesson check mark
  completeLesson: function() {
    const course = auraData.courses[this.state.currentCourse];
    const lesson = course.lessons[this.state.currentLessonIndex];
    
    if (!this.state.completedLessons.includes(lesson.id)) {
      this.state.completedLessons.push(lesson.id);
      this.saveState();
      this.logAudit(`Completed Lesson: ${lesson.title}`);
    }

    // Automatically load next lesson if available, else finish
    if (this.state.currentLessonIndex < course.lessons.length - 1) {
      this.state.currentLessonIndex++;
      this.renderLesson();
    } else {
      alert(`Congratulations! You have completed the "${course.title}" course roadmap.`);
      document.getElementById('course-reader-empty').classList.remove('hidden');
      document.getElementById('course-reader-content').classList.add('hidden');
    }
    
    auraUI.renderGrowthHub(this.state);
  },

  // Mock Audio guide functions
  toggleMockAudio: function() {
    const btn = document.getElementById('btn-audio-toggle');
    const trackProgress = document.querySelector('.audio-track-progress');
    const self = this;

    if (this.state.audioPlaying) {
      this.stopMockAudio();
    } else {
      this.state.audioPlaying = true;
      btn.textContent = "⏸ Pause Guide";
      self.state.audioInterval = setInterval(() => {
        self.state.audioProgress += 1.5;
        if (self.state.audioProgress >= 100) {
          self.state.audioProgress = 100;
          self.stopMockAudio();
        }
        trackProgress.style.width = self.state.audioProgress + "%";
      }, 300);
      self.logAudit("Audio guide meditation playback started.");
    }
  },

  stopMockAudio: function() {
    if (this.state.audioInterval) {
      clearInterval(this.state.audioInterval);
      this.state.audioInterval = null;
    }
    this.state.audioPlaying = false;
    this.state.audioProgress = 0;
    
    const btn = document.getElementById('btn-audio-toggle');
    const trackProgress = document.querySelector('.audio-track-progress');
    if (btn) btn.textContent = "▶ Play Audio Guide";
    if (trackProgress) trackProgress.style.width = "0%";
  },

  // Setup Chat Simulator initial state
  setupSimulator: function() {
    const self = this;

    if (this.state.simMessages.length === 0) {
      this.resetSimulator();
    }

    document.getElementById('btn-sim-send').addEventListener('click', () => self.sendSimMessage());
    document.getElementById('sim-input-text').addEventListener('keypress', (e) => {
      if (e.key === 'Enter') self.sendSimMessage();
    });
    document.getElementById('btn-reset-simulator').addEventListener('click', () => self.resetSimulator());
  },

  resetSimulator: function() {
    this.state.simMessages = [
      { role: "partner", text: "Why haven't you replied all day? It takes 5 seconds to send a text." }
    ];
    this.saveState();
    
    // Clear display parameters
    document.getElementById('predict-success-val').textContent = "--%";
    document.getElementById('predict-defense-val').textContent = "--%";
    document.getElementById('predict-withdrawal-val').textContent = "--%";
    
    const alertBox = document.getElementById('sim-prediction-alert');
    alertBox.textContent = "Start typing messages to begin prediction scoring.";
    alertBox.className = "insight-item";
    
    document.getElementById('sim-advice-text').textContent = "Try using an 'I' statement instead of a 'You' statement to lower your partner's predicted defensiveness.";

    auraUI.renderSimulator(this.state);
    this.logAudit("Simulator conversation thread reset.");
  },

  // Send message in simulator
  sendSimMessage: function() {
    const input = document.getElementById('sim-input-text');
    const msgText = input.value.trim();
    if (!msgText) return;

    // 1. Add User bubble
    this.state.simMessages.push({ role: "user", text: msgText });
    input.value = "";
    auraUI.renderSimulator(this.state);

    // 2. Perform outcome prediction
    const prediction = auraEngines.predictOutcome(msgText);
    
    // Update metric numbers
    document.getElementById('predict-success-val').textContent = `${prediction.positive}%`;
    document.getElementById('predict-defense-val').textContent = `${prediction.defensive}%`;
    document.getElementById('predict-withdrawal-val').textContent = `${prediction.withdrawal}%`;

    // Highlight alerts
    const alertBox = document.getElementById('sim-prediction-alert');
    alertBox.textContent = prediction.alertText;
    if (prediction.positive > 60) {
      alertBox.className = "insight-item success";
    } else if (prediction.defensive > 60) {
      alertBox.className = "insight-item danger";
    } else {
      alertBox.className = "insight-item warning";
    }

    // Set advice block
    document.getElementById('sim-advice-text').textContent = prediction.advice;

    this.logAudit(`Simulator analyzed sentence: "${msgText}"`);

    // 3. Simulate Partner response with small typing delay
    const chatArea = document.getElementById('sim-chat-box');
    const typingBubble = document.createElement('div');
    typingBubble.className = "sim-message partner";
    typingBubble.textContent = "Typing...";
    chatArea.appendChild(typingBubble);
    chatArea.scrollTop = chatArea.scrollHeight;

    setTimeout(() => {
      typingBubble.remove();
      
      let replyText = "";
      if (prediction.positive > 60) {
        replyText = "Thanks for telling me how you feel. I understand you were busy. Let's schedule dinner tonight.";
      } else if (prediction.defensive > 60) {
        replyText = "Oh, so now it's MY fault? You always turn things around on me when you make a mistake!";
      } else {
        replyText = "Whatever. I don't want to get into this right now. Talk later.";
      }

      this.state.simMessages.push({ role: "partner", text: replyText });
      
      // Offer secondary guidance advice bubble in log
      let coachFeedback = "";
      if (prediction.positive > 60) {
        coachFeedback = "💡 Coach Note: Nice job! Your emotional clarity de-escalated the friction and steered the topic toward collaboration.";
      } else {
        coachFeedback = `💡 Coach Note: This reply triggered high resistance. Notice how using the draft phrasing caused them to ${prediction.defensive > 60 ? "act defensive" : "shut down"}. Try replaying this step using the translated boundary builder suggestion.`;
      }
      this.state.simMessages.push({ role: "ai-feedback", text: coachFeedback });

      this.saveState();
      auraUI.renderSimulator(this.state);
      this.logAudit(`Simulator generated partner response: "${replyText}"`);
    }, 1500);
  },

  startSakuraFalling: function() {
    const container = document.createElement('div');
    container.id = 'sakura-falling-container';
    container.style.cssText = 'position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; overflow: hidden; pointer-events: none; z-index: -1;';
    
    // Add to body to keep animation active across all pages
    document.body.appendChild(container);

    const petalCount = 20; // Slightly increased for site-wide density
    for (let i = 0; i < petalCount; i++) {
      this.spawnPetal(container);
    }
  },

  spawnPetal: function(container) {
    const petal = document.createElement('div');
    petal.className = 'sakura-petal';
    
    // Bias 70% of petals to start near the top-left where the background branch stretches
    let left;
    if (Math.random() < 0.7) {
      left = Math.random() * 35; // 0% to 35% left
    } else {
      left = Math.random() * 100; // 0% to 100% left
    }
    
    const delay = Math.random() * 10;
    const duration = 8 + Math.random() * 8;
    const size = 6 + Math.random() * 10;
    
    petal.style.left = `${left}%`;
    petal.style.top = `-20px`; // Start just above screen boundary
    petal.style.width = `${size}px`;
    petal.style.height = `${size}px`;
    petal.style.animationDelay = `${delay}s`;
    petal.style.animationDuration = `${duration}s`;
    
    container.appendChild(petal);
  },

  startWindBlowing: function() {
    const container = document.createElement('div');
    container.id = 'wind-container';
    container.style.cssText = 'position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; overflow: hidden; pointer-events: none; z-index: -1;';
    
    document.body.appendChild(container);

    const windLineCount = 10;
    for (let i = 0; i < windLineCount; i++) {
      this.spawnWindLine(container);
    }
  },

  spawnWindLine: function(container) {
    const line = document.createElement('div');
    line.className = 'wind-line';
    
    const top = Math.random() * 95;
    const width = 120 + Math.random() * 180;
    const height = 1 + Math.random() * 1.5;
    const delay = Math.random() * 10;
    const duration = 6 + Math.random() * 6;
    
    line.style.top = `${top}%`;
    line.style.width = `${width}px`;
    line.style.height = `${height}px`;
    line.style.animationDelay = `${delay}s`;
    line.style.animationDuration = `${duration}s`;
    
    container.appendChild(line);
  }
};

// Start app on DOM content loaded
window.addEventListener('DOMContentLoaded', () => {
  app.init();
});

