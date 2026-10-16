// Aura Application Master Controller

const createDefaultState = () => ({
    username: "Alex",
    relationshipStatus: "dating",
    onboardingPreferences: {
      messageResponse: null,
      conflictResponse: null,
      situationResponse: null,
      supportNeed: null,
      goal: null
    },
    onboarded: false,
    onboardingVersion: 0,
    completedLessons: [],
    journalEntries: [],
    conversations: [],
    analyses: [],
    activeConversationId: null,
    simMessages: [],
    simConversationId: null,
    simAnalysisVersion: null,
    simulationObjective: 'clarification',
    straightAnswerMode: true,
    currentView: "landing",
    currentCourse: null,
    currentLessonIndex: 0
});

const app = {
  state: createDefaultState(),
  currentUser: null,
  authBusy: false,
  analysisBusy: false,
  pendingImport: null,
  draftHasChanges: false,
  storageUnavailable: false,

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
      if (this.currentUser) this.clearPrivateSessionUI();
      this.currentUser = null;
      this.state = createDefaultState();
      this.renderConversationPicker();
      this.renderSecurityStatus();
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
    if (!key) return false;
    try {
      localStorage.setItem(key, JSON.stringify(this.state));
      this.storageUnavailable = false;
      return true;
    } catch (_) {
      this.storageUnavailable = true;
      this.setUploadStatus('Aura could not save to this browser’s storage. Export your work or free browser storage space before continuing.', true);
      return false;
    }
  },

  getActiveConversation: function() {
    return this.state.conversations.find((item) => item.id === this.state.activeConversationId) || null;
  },

  getActiveAnalysis: function() {
    const conversation = this.getActiveConversation();
    if (!conversation) return null;
    return this.state.analyses.find((item) => item.conversationId === conversation.id && item.analysisVersion === conversation.version) || null;
  },

  hasCompletedOnboarding: function() {
    return Boolean(this.state.onboarded && this.state.onboardingVersion === 2);
  },

  setUploadStatus: function(message, isError = false) {
    const status = document.getElementById('upload-file-status');
    const globalStatus = document.getElementById('app-status');
    [status, globalStatus].filter(Boolean).forEach((element) => {
      element.textContent = message || '';
      element.style.color = isError ? 'var(--danger)' : 'var(--text-secondary)';
      element.setAttribute('role', isError ? 'alert' : 'status');
    });
  },

  renderConversationPicker: function() {
    const select = document.getElementById('conversation-select');
    const removeButton = document.getElementById('btn-delete-conversation');
    if (!select) return;
    select.replaceChildren(new Option('No saved conversation selected', ''));
    this.state.conversations.forEach((conversation) => {
      const option = new Option(`${conversation.sourceName || 'Conversation'} · ${conversation.messages.length} messages`, conversation.id);
      select.add(option);
    });
    select.value = this.state.activeConversationId || '';
    if (removeButton) removeButton.disabled = !select.value;
  },

  renderSecurityStatus: function() {
    const authStatus = document.getElementById('security-auth-status');
    const mfaStatus = document.getElementById('security-mfa-status');
    if (!authStatus || !mfaStatus) return;
    if (!this.currentUser) {
      authStatus.textContent = 'You are signed out. Sign in to view Firebase-reported authentication methods.';
      mfaStatus.textContent = 'No MFA status is available while signed out. Aura does not provide MFA enrollment controls.';
      return;
    }
    const providers = [...new Set((this.currentUser.providerData || []).map((item) => {
      if (item.providerId === 'password') return 'email/password';
      if (item.providerId === 'google.com') return 'Google';
      return item.providerId;
    }))];
    authStatus.textContent = `Firebase account methods: ${providers.length ? providers.join(', ') : 'not reported'}; email ${this.currentUser.emailVerified ? 'verified' : 'not verified'}.`;
    const factors = this.currentUser.multiFactor && this.currentUser.multiFactor.enrolledFactors;
    mfaStatus.textContent = factors && factors.length
      ? `${factors.length} second factor(s) are reported by Firebase. Aura does not currently manage factor enrollment or recovery.`
      : 'No enrolled second factor is reported by Firebase. Aura does not implement MFA enrollment. Firebase MFA requires Authentication with Identity Platform and verified email; the project configuration has not been inspected.';
  },

  startNewConversation: function(sourceName = 'Pasted transcript', sourceType = 'text') {
    this.pendingImport = { sourceName, sourceType };
    this.draftHasChanges = false;
    this.state.activeConversationId = null;
    this.state.simMessages = [];
    this.state.simConversationId = null;
    this.state.simAnalysisVersion = null;
    const select = document.getElementById('conversation-select');
    const textarea = document.getElementById('pasted-chat-text');
    if (select) select.value = '';
    if (textarea) textarea.value = '';
    const deleteButton = document.getElementById('btn-delete-conversation');
    if (deleteButton) deleteButton.disabled = true;
    this.setUploadStatus('New transcript draft. Existing saved conversations remain unchanged until you analyze and save this one.');
    this.renderCurrentView();
  },

  selectConversation: function(id) {
    const conversation = this.state.conversations.find((item) => item.id === id);
    if (!conversation) return;
    this.state.activeConversationId = conversation.id;
    if (this.state.simConversationId !== conversation.id) {
      this.state.simMessages = [];
      this.state.simConversationId = null;
      this.state.simAnalysisVersion = null;
    }
    this.pendingImport = null;
    this.draftHasChanges = false;
    document.getElementById('pasted-chat-text').value = auraConversationService.toEditableText(conversation);
    this.setUploadStatus(`Loaded “${conversation.sourceName}” for review. Edit it if needed, then run analysis to save a new version.`);
    this.renderConversationPicker();
    this.saveState();
    this.renderCurrentView();
  },

  deleteSelectedConversation: function() {
    const conversation = this.getActiveConversation();
    if (!conversation || !confirm(`Delete “${conversation.sourceName}” and its local analysis and practice history from this browser?`)) return;
    this.state.conversations = this.state.conversations.filter((item) => item.id !== conversation.id);
    this.state.analyses = this.state.analyses.filter((item) => item.conversationId !== conversation.id);
    if (this.state.simConversationId === conversation.id) {
      this.state.simMessages = [];
      this.state.simConversationId = null;
      this.state.simAnalysisVersion = null;
    }
    this.state.activeConversationId = null;
    this.startNewConversation();
    this.renderConversationPicker();
    this.saveState();
    this.renderCurrentView();
  },

  importTranscriptFile: async function(file) {
    if (!file) return;
    const extension = file.name.toLowerCase().split('.').pop();
    const acceptedTypes = extension === 'json' ? ['application/json', 'text/json'] : ['text/plain'];
    if (!['txt', 'json'].includes(extension)) {
      this.setUploadStatus('Unsupported file type. Choose a .txt or .json transcript; images and PDFs are not supported.', true);
      return;
    }
    if (file.type && !acceptedTypes.includes(file.type.toLowerCase())) {
      this.setUploadStatus('The file extension and reported file type do not match. Save it as a plain text or JSON transcript and try again.', true);
      return;
    }
    if (!file.size || file.size > auraConversationService.MAX_BYTES) {
      this.setUploadStatus(file.size ? 'This file exceeds Aura’s 1 MiB limit.' : 'This file is empty.', true);
      return;
    }
    try {
      const content = await file.text();
      const parsed = auraConversationService.normalizeTranscript(content, { format: extension === 'json' ? 'json' : 'text' });
      document.getElementById('pasted-chat-text').value = auraConversationService.toEditableText(parsed);
      this.pendingImport = { sourceName: file.name, sourceType: extension };
      this.state.activeConversationId = null;
      this.state.simMessages = [];
      this.state.simConversationId = null;
      this.state.simAnalysisVersion = null;
      this.draftHasChanges = false;
      this.renderConversationPicker();
      this.setUploadStatus(`Read ${parsed.messages.length} messages locally from “${file.name}”. Review or edit the preview, then run analysis to save it.${parsed.extractionWarnings ? ` ${parsed.extractionWarnings} line(s) could not be assigned to a speaker and were omitted.` : ''}`);
    } catch (error) {
      this.setUploadStatus(error && error.message ? error.message : 'The file could not be read as a supported transcript.', true);
    }
  },

  analyzeDraft: async function() {
    if (!this.currentUser) { this.switchView('auth'); return; }
    if (this.analysisBusy) return;
    const button = document.getElementById('btn-analyze-paste');
    const text = document.getElementById('pasted-chat-text').value;
    this.analysisBusy = true;
    if (button) { button.disabled = true; button.textContent = 'Analyzing locally…'; }
    try {
      const existing = !this.pendingImport && this.getActiveConversation();
      const sameId = existing ? existing.id : null;
      const sameCreatedAt = existing ? existing.createdAt : null;
      const conversation = auraConversationService.normalizeTranscript(text, {
        id: sameId || undefined,
        version: existing ? existing.version + 1 : 1,
        createdAt: sameCreatedAt || undefined,
        sourceName: this.pendingImport?.sourceName || existing?.sourceName || 'Pasted transcript',
        sourceType: this.pendingImport?.sourceType || existing?.sourceType || 'text'
      });
      if (!existing && this.state.conversations.length >= 10) {
        throw new Error('Aura stores up to 10 conversations in this browser. Delete one explicitly before adding another.');
      }
      const analysis = await auraConversationService.analyzeConversation(conversation, auraConversationService.localHeuristicProvider);
      const index = this.state.conversations.findIndex((item) => item.id === conversation.id);
      if (index >= 0) this.state.conversations[index] = conversation;
      else this.state.conversations.unshift(conversation);
      this.state.analyses = this.state.analyses.filter((item) => item.conversationId !== conversation.id);
      this.state.analyses.push(analysis);
      this.state.activeConversationId = conversation.id;
      this.state.simMessages = [];
      this.state.simConversationId = null;
      this.state.simAnalysisVersion = null;
      this.pendingImport = null;
      this.draftHasChanges = false;
      this.renderConversationPicker();
      const persisted = this.saveState();
      this.setUploadStatus(persisted
        ? `Saved and analyzed ${conversation.messages.length} messages locally. No transcript was sent to an analysis provider.${conversation.extractionWarnings ? ` ${conversation.extractionWarnings} unassigned line(s) were omitted.` : ''}`
        : 'Analysis completed in memory but could not be saved to browser storage. Export the data before refreshing or close this tab.', !persisted);
      if (auraEngines.detectCrisis(text)) {
        document.getElementById('crisis-alert-banner').classList.remove('hidden');
      }
      this.switchView('analysis');
    } catch (error) {
      this.setUploadStatus(error && error.message ? error.message : 'Aura could not analyze this transcript.', true);
    } finally {
      this.analysisBusy = false;
      if (button) { button.disabled = false; button.textContent = 'Run Analysis 🚀'; }
    }
  },

  renderSimulator: function() {
    const conversation = this.getActiveConversation();
    const analysis = this.getActiveAnalysis();
    const ready = Boolean(conversation && analysis && !this.draftHasChanges);
    const input = document.getElementById('sim-input-text');
    const send = document.getElementById('btn-sim-send');
    const note = document.getElementById('sim-context-note');
    document.getElementById('sim-objective').value = this.state.simulationObjective || 'clarification';
    input.disabled = !ready;
    send.disabled = !ready;
    if (!ready) {
      this.state.simMessages = [];
      note.textContent = this.draftHasChanges
        ? 'The selected transcript has edits that have not been analyzed. Re-run analysis before practicing.'
        : 'Select and analyze a conversation first. Practice content is fictional.';
      this.state.simConversationId = null;
      this.state.simAnalysisVersion = null;
    } else {
      note.textContent = `Practice context: ${conversation.sourceName} · recent messages and cited findings from this conversation. Every generated reply is fictional, not a prediction.`;
      if (this.state.simConversationId !== conversation.id || this.state.simAnalysisVersion !== analysis.analysisVersion) {
        this.state.simMessages = this.buildSimulationContext(conversation, analysis);
        this.state.simConversationId = conversation.id;
        this.state.simAnalysisVersion = analysis.analysisVersion;
        this.saveState();
      }
      const recommendation = analysis.recommendations[0];
      document.getElementById('sim-advice-text').textContent = recommendation
        ? `${recommendation.text}${recommendation.basedOnFindingIds.length ? ` Evidence: ${recommendation.basedOnFindingIds.join(', ')}.` : ''}`
        : 'No recommendation is available for this analysis.';
    }
    auraUI.renderSimulator(this.state, conversation);
  },

  buildSimulationContext: function(conversation, analysis) {
    const recentIds = conversation.messages.slice(-6).map((message) => message.id);
    const citedIds = analysis.findings.flatMap((finding) => finding.evidenceMessageIds).slice(0, 4);
    const selected = new Set([...citedIds, ...recentIds]);
    return conversation.messages
      .filter((message) => selected.has(message.id))
      .map((message) => ({
        role: 'context',
        messageId: message.id,
        conversationId: conversation.id,
        analysisVersion: analysis.analysisVersion
      }));
  },

  loadState: function(uid) {
    this.state = createDefaultState();
    const key = this.storageKey(uid);
    let raw = null;
    try {
      raw = key && localStorage.getItem(key);
    } catch (_) {
      this.storageUnavailable = true;
      this.setUploadStatus('Browser storage is unavailable. Aura can work with the current transcript temporarily, but cannot save it here.', true);
    }
    if (raw) {
      try {
        const parsed = JSON.parse(raw);
        this.state = { ...this.state, ...parsed };
        delete this.state.activeAnalysis;
        delete this.state.audioInterval;
        delete this.state.audioPlaying;
        delete this.state.audioProgress;
        this.state.conversations = Array.isArray(parsed.conversations) ? parsed.conversations.filter((item) => item && typeof item.id === 'string' && Array.isArray(item.messages)) : [];
        this.state.analyses = Array.isArray(parsed.analyses) ? parsed.analyses.filter((item) => item && typeof item.conversationId === 'string' && Array.isArray(item.findings) && Array.isArray(item.recommendations)) : [];
        this.state.journalEntries = Array.isArray(parsed.journalEntries) ? parsed.journalEntries.filter((item) => item && typeof item.id === 'string') : [];
        this.state.completedLessons = Array.isArray(parsed.completedLessons) ? parsed.completedLessons.filter((item) => typeof item === 'string') : [];
        this.state.simMessages = Array.isArray(parsed.simMessages) ? parsed.simMessages.filter((item) => item && typeof item === 'object') : [];
        if (!this.state.conversations.some((item) => item.id === this.state.activeConversationId)) {
          this.state.activeConversationId = this.state.conversations[this.state.conversations.length - 1]?.id || null;
        }
        // Do not restore mock analysis or an unrelated legacy simulator thread.
        if (!this.state.simConversationId || this.state.simConversationId !== this.state.activeConversationId) {
          this.state.simMessages = [];
          this.state.simConversationId = null;
          this.state.simAnalysisVersion = null;
        }
      } catch (e) {
        console.error("Failed to parse local Aura state.", { name: e && e.name });
      }
    }
    this.renderConversationPicker();
  },

  handleAuthStateChanged: function(user) {
    const previousUid = this.currentUser && this.currentUser.uid;
    const nextUid = user && user.uid;
    if (previousUid && previousUid !== nextUid) this.clearPrivateSessionUI();
    this.currentUser = user || null;
    if (!user) {
      this.state = createDefaultState();
      document.getElementById('sidebar').classList.add('hidden');
      this.renderSecurityStatus();
      this.renderConversationPicker();
      this.setUploadStatus('');
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
    this.switchView(this.hasCompletedOnboarding() ? 'dashboard' : 'onboarding');
    this.renderSecurityStatus();
    this.logAudit('Firebase authentication state updated.');
  },

  clearPrivateSessionUI: function() {
    ['pasted-chat-text', 'boundary-draft-input', 'boundary-translation-output', 'journal-entry-text', 'sim-input-text', 'auth-email', 'auth-password', 'onboard-name'].forEach((id) => {
      const field = document.getElementById(id);
      if (field) { field.value = ''; field.textContent = ''; }
    });
    const crisis = document.getElementById('crisis-alert-banner');
    if (crisis) crisis.classList.add('hidden');
    const report = document.getElementById('print-report');
    if (report) report.replaceChildren();
    ['analysis-findings', 'analysis-recommendations', 'analysis-evidence', 'sim-chat-box', 'dashboard-patterns-list', 'dashboard-actions-list', 'journal-entries-list'].forEach((id) => {
      const container = document.getElementById(id);
      if (container) container.replaceChildren();
    });
    const analysisView = document.getElementById('analysis-current');
    if (analysisView) analysisView.classList.add('hidden');
    ['analysis-summary', 'analysis-limitations', 'analysis-speakers', 'analysis-source-name', 'analysis-method-note'].forEach((id) => {
      const field = document.getElementById(id);
      if (field) field.textContent = '';
    });
    const logs = document.getElementById('settings-audit-logs');
    if (logs) logs.textContent = 'No recent security events.';
    document.querySelectorAll('.wizard-option-card.selected').forEach((card) => card.classList.remove('selected'));
    this.pendingImport = null;
    this.draftHasChanges = false;
    this.storageUnavailable = false;
    this.setUploadStatus('');
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
    const buttons = ['btn-auth-submit', 'btn-google-signin', 'btn-signout'];
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
      viewId = this.hasCompletedOnboarding() ? 'dashboard' : 'onboarding';
    } else if (this.currentUser && !this.hasCompletedOnboarding() && !['landing', 'onboarding'].includes(viewId)) {
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
    const conversation = this.getActiveConversation();
    const analysis = this.draftHasChanges ? null : this.getActiveAnalysis();
    
    // Update profile displays
    const letters = (this.state.username || "US").substring(0,2).toUpperCase();
    document.getElementById('avatar-letters').textContent = letters;
    document.getElementById('profile-display-name').textContent = this.state.username || "User";
    
    if (view === 'dashboard') {
      auraUI.renderDashboard(this.state, analysis, conversation);
    } else if (view === 'analysis') {
      auraUI.renderAnalysis(analysis, conversation);
    } else if (view === 'reality-check') {
      auraUI.renderRealityCheck(analysis, this.state.straightAnswerMode, conversation);
    } else if (view === 'simulator') {
      this.renderSimulator();
    } else if (view === 'growth') {
      auraUI.renderGrowthHub(this.state);
    } else if (view === 'settings') {
      this.renderSecurityStatus();
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
        const step = this.closest('.wizard-step-content').id;
        self.logAudit(`Updated onboarding choice in ${step}.`);
      });
    });

    const nextBtn = document.getElementById('btn-onboard-next');
    const backBtn = document.getElementById('btn-onboard-back');
    const progress = document.getElementById('wizard-progress');
    const answerError = document.getElementById('wizard-answer-error');

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
      nextBtn.textContent = (currentStep === totalSteps) ? 'Finish & Open Aura' : 'Continue';
    };

    nextBtn.addEventListener('click', () => {
      const currentQuestion = document.getElementById(`step-${currentStep}`);
      if (!currentQuestion.querySelector('.wizard-option-card.selected')) {
        answerError.classList.remove('hidden');
        currentQuestion.querySelector('.wizard-option-card')?.focus();
        return;
      }
      answerError.classList.add('hidden');
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
        
        const selectedValue = (stepId, fallback) => {
          const selected = document.querySelector(`#${stepId} .wizard-option-card.selected`);
          return selected ? selected.getAttribute('data-value') : fallback;
        };
        self.state.onboardingPreferences = {
          messageResponse: selectedValue('step-1', null),
          conflictResponse: selectedValue('step-2', null),
          situationResponse: selectedValue('step-3', null),
          supportNeed: selectedValue('step-4', null),
          goal: selectedValue('step-5', null)
        };
        
        self.state.onboarded = true;
        self.state.onboardingVersion = 2;
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

    document.getElementById('btn-signout').addEventListener('click', () => {
      const button = document.getElementById('btn-signout');
      self.runAuthAction(button, 'Signing out…', (firebase) => firebase.signOut(firebase.auth));
    });

    // Conversation library, upload, review, and local analysis workflow.
    document.getElementById('btn-new-conversation').addEventListener('click', () => self.startNewConversation());
    document.getElementById('btn-delete-conversation').addEventListener('click', () => self.deleteSelectedConversation());
    document.getElementById('conversation-select').addEventListener('change', (event) => {
      if (event.target.value) self.selectConversation(event.target.value);
      else self.startNewConversation();
    });
    document.getElementById('pasted-chat-text').addEventListener('input', () => {
      const selected = self.getActiveConversation();
      if (selected) {
        self.draftHasChanges = true;
        self.setUploadStatus('This saved transcript has edits that are not yet analyzed. Re-run analysis to update its findings.');
      }
    });
    document.getElementById('btn-analyze-paste').addEventListener('click', () => self.analyzeDraft());

    const fileInput = document.getElementById('chat-file-input');
    const dropzone = document.getElementById('chat-dropzone');
    fileInput.addEventListener('change', async () => {
      await self.importTranscriptFile(fileInput.files && fileInput.files[0]);
      fileInput.value = '';
    });
    dropzone.addEventListener('click', (event) => {
      if (!event.target.closest('label') && event.target !== fileInput) fileInput.click();
    });
    dropzone.addEventListener('keydown', (event) => {
      if ((event.key === 'Enter' || event.key === ' ') && event.target === dropzone) {
        event.preventDefault();
        fileInput.click();
      }
    });
    ['dragenter', 'dragover'].forEach((type) => dropzone.addEventListener(type, (event) => {
      event.preventDefault();
      dropzone.classList.add('dragover');
    }));
    ['dragleave', 'drop'].forEach((type) => dropzone.addEventListener(type, (event) => {
      event.preventDefault();
      dropzone.classList.remove('dragover');
    }));
    dropzone.addEventListener('drop', async (event) => {
      await self.importTranscriptFile(event.dataTransfer && event.dataTransfer.files[0]);
    });

    const loadSample = (sample, label) => {
      self.startNewConversation(label, 'sample');
      document.getElementById('pasted-chat-text').value = sample;
      self.setUploadStatus(`${label} loaded as a new draft. Review it before saving and analyzing.`);
      self.logAudit('Sample conversation loaded for review.');
    };
    document.getElementById('btn-sample-anxious').addEventListener('click', () => loadSample(auraData.samples.anxious, 'Sample conversation 1'));
    document.getElementById('btn-sample-passive').addEventListener('click', () => loadSample(auraData.samples.passive, 'Sample conversation 2'));
    document.getElementById('btn-sample-secure').addEventListener('click', () => loadSample(auraData.samples.secure, 'Sample conversation 3'));

    // Close crisis banner
    document.getElementById('btn-close-crisis-banner').addEventListener('click', () => {
      document.getElementById('crisis-alert-banner').classList.add('hidden');
    });

    // Open the browser's native print flow. The user must choose Save as PDF.
    document.getElementById('btn-export-pdf').addEventListener('click', () => {
      if (!self.getActiveAnalysis() || self.draftHasChanges) return;
      auraUI.renderPrintReport(self.getActiveAnalysis(), self.getActiveConversation(), self.state.simMessages);
      document.getElementById('analysis-method-note').textContent = 'Print dialog opened. Choose “Save as PDF” to create the report; Aura does not claim a file was saved until you complete that browser step.';
      window.print();
      self.logAudit('Print / PDF report requested.');
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
        auraUI.renderRealityCheck(self.draftHasChanges ? null : self.getActiveAnalysis(), checked, self.getActiveConversation());
      }
      self.logAudit(`Toggled Straight-Answer Mode to: ${checked}`);
    };

    gSwitch.addEventListener('change', (e) => updateStraightState(e.target.checked));
    rSwitch.addEventListener('change', (e) => updateStraightState(e.target.checked));

    // Boundary Translation trigger
    document.getElementById('btn-translate-boundary').addEventListener('click', () => {
      const input = document.getElementById('boundary-draft-input').value.trim();
      if (!input) return;

      const output = auraEngines.translateBoundary(input, self.getActiveAnalysis());
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
        try { if (key) localStorage.removeItem(key); }
        catch (_) { self.setUploadStatus('Aura could not clear browser storage. Remove this site’s data in your browser settings.', true); }
        self.state = createDefaultState();
        self.renderConversationPicker();
        self.renderSecurityStatus();
        self.switchView(self.currentUser ? 'onboarding' : 'landing');
        self.logAudit("Local data clear requested.");
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
    
    const lessonBody = document.getElementById('course-lesson-body');
    lessonBody.textContent = lesson.body;
    lessonBody.style.whiteSpace = 'pre-line';

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

  // Setup Chat Simulator initial state
  setupSimulator: function() {
    const self = this;
    document.getElementById('btn-sim-send').addEventListener('click', () => self.sendSimMessage());
    document.getElementById('sim-input-text').addEventListener('keydown', (e) => {
      if (e.key === 'Enter') self.sendSimMessage();
    });
    document.getElementById('btn-reset-simulator').addEventListener('click', () => self.resetSimulator());
    document.getElementById('sim-objective').addEventListener('change', (event) => {
      self.state.simulationObjective = event.target.value;
      self.saveState();
    });
  },

  resetSimulator: function() {
    const conversation = this.getActiveConversation();
    const analysis = this.getActiveAnalysis();
    if (!conversation || !analysis || this.draftHasChanges) {
      this.state.simMessages = [];
      this.state.simConversationId = null;
      this.state.simAnalysisVersion = null;
      this.renderSimulator();
      return;
    }
    this.state.simMessages = this.buildSimulationContext(conversation, analysis);
    this.state.simConversationId = conversation.id;
    this.state.simAnalysisVersion = analysis.analysisVersion;
    this.saveState();
    this.renderSimulator();
    this.logAudit('Practice session reset for selected conversation.');
  },

  // Send message in simulator
  sendSimMessage: function() {
    const conversation = this.getActiveConversation();
    const analysis = this.getActiveAnalysis();
    if (!conversation || !analysis || this.draftHasChanges || this.state.simConversationId !== conversation.id || this.state.simAnalysisVersion !== analysis.analysisVersion) return;
    const input = document.getElementById('sim-input-text');
    const msgText = input.value.trim();
    if (!msgText) return;
    if (msgText.length > 2000) {
      document.getElementById('sim-prediction-alert').textContent = 'Practice drafts are limited to 2,000 characters.';
      return;
    }
    if (this.state.simMessages.length >= 100) {
      document.getElementById('sim-prediction-alert').textContent = 'This practice session reached its 100-message limit. Reset it to start another session.';
      return;
    }

    const metadata = { conversationId: conversation.id, analysisVersion: analysis.analysisVersion };
    this.state.simMessages.push({ role: 'user', text: msgText, ...metadata });
    input.value = "";
    const review = auraConversationService.reviewDraft(msgText);
    const alertBox = document.getElementById('sim-prediction-alert');
    alertBox.textContent = review.note;
    alertBox.className = 'insight-item';
    const objective = document.getElementById('sim-objective').value;
    this.state.simulationObjective = objective;
    this.state.simMessages.push({
      role: 'simulation',
      text: auraConversationService.createPracticeReply(objective, conversation.messages[conversation.messages.length - 1]),
      ...metadata
    });
    const recommendation = analysis.recommendations.find((item) => !item.basedOnFindingIds.length || item.basedOnFindingIds.some((id) => analysis.findings.some((finding) => finding.id === id)));
    if (recommendation) {
      this.state.simMessages.push({ role: 'feedback', text: `Possible next step: ${recommendation.text}`, ...metadata });
    }
    this.saveState();
    auraUI.renderSimulator(this.state, conversation);
    this.logAudit('Practice draft reviewed locally.');
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

