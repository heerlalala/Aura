// Aura Application Master Controller

const app = {
  // Application State
  state: {
    username: "Alex",
    relationshipStatus: "dating",
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
  },

  // Initialize App
  init: function() {
    this.loadState();
    this.setupViewRouter();
    this.setupEventListeners();
    this.setupOnboardingWizard();
    this.setupSimulator();
    
    // Set active analysis default if not loaded
    if (!this.state.activeAnalysis) {
      this.state.activeAnalysis = auraEngines.getDefaultAnalysis();
    }
    
    // Switch to landing or dashboard depending on onboarding status
    if (this.state.onboarded) {
      document.getElementById('sidebar').classList.remove('hidden');
      this.switchView('dashboard');
    } else {
      this.switchView('landing');
    }
    
    this.startSakuraFalling();
    this.logAudit("Aura Engine initialized successfully.");
  },

  // Sync state to local storage
  saveState: function() {
    localStorage.setItem('aura_state_vault', JSON.stringify(this.state));
  },

  // Load state from local storage
  loadState: function() {
    const raw = localStorage.getItem('aura_state_vault');
    if (raw) {
      try {
        const parsed = JSON.parse(raw);
        this.state = { ...this.state, ...parsed };
      } catch (e) {
        console.error("Failed to parse Local Data Vault. Resetting...", e);
      }
    }
  },

  // Log to Settings Console
  logAudit: function(msg) {
    const logs = document.getElementById('settings-audit-logs');
    if (logs) {
      const now = new Date();
      const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      logs.innerHTML += `[${timeStr}] ${msg}<br>`;
      logs.scrollTop = logs.scrollHeight;
    }
  },

  // Page view switching router
  switchView: function(viewId) {
    // If not onboarded and trying to view interior panels, force onboarding
    if (!this.state.onboarded && viewId !== 'landing' && viewId !== 'auth' && viewId !== 'onboarding') {
      this.switchView('onboarding');
      return;
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
      } else {
        item.classList.remove('active');
      }
    });

    // Update active state in Mobile Bottom Bar
    const mobileNavItems = document.querySelectorAll('.mobile-nav-item');
    mobileNavItems.forEach(item => {
      if (item.getAttribute('data-view') === viewId) {
        item.classList.add('active');
      } else {
        item.classList.remove('active');
      }
    });

    // Run custom rendering functions per view
    this.renderCurrentView();
    this.logAudit(`Switched view to: ${viewId}`);
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
    
    // Sidebar clicks
    document.querySelectorAll('.menu-item').forEach(item => {
      item.addEventListener('click', function() {
        const view = this.getAttribute('data-view');
        self.switchView(view);
      });
    });

    // Mobile menu toggle
    const menuBtn = document.getElementById('mobile-menu-trigger');
    const sidebar = document.getElementById('sidebar');
    if (menuBtn && sidebar) {
      menuBtn.addEventListener('click', () => {
        sidebar.classList.toggle('hidden');
      });
    }

    // Close mobile menu on sidebar click
    document.querySelectorAll('.menu-item').forEach(item => {
      item.addEventListener('click', () => {
        if (window.innerWidth <= 968) {
          sidebar.classList.add('hidden');
        }
      });
    });
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
        // Collect form data and complete onboarding
        const nameVal = document.getElementById('onboard-name').value.trim() || "Alex";
        self.state.username = nameVal;
        
        const selectedStatusCard = document.querySelector('#step-3 .wizard-option-card.selected');
        self.state.relationshipStatus = selectedStatusCard ? selectedStatusCard.getAttribute('data-value') : 'dating';
        
        self.state.onboarded = true;
        self.saveState();

        document.getElementById('sidebar').classList.remove('hidden');
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

    // Welcome start
    document.getElementById('btn-landing-start').addEventListener('click', () => {
      self.switchView('onboarding');
    });

    document.getElementById('btn-landing-auth').addEventListener('click', () => {
      self.switchView('auth');
    });

    // Auth screen submits
    document.getElementById('btn-auth-submit').addEventListener('click', () => {
      const email = document.getElementById('auth-email').value;
      const pass = document.getElementById('auth-password').value;
      const mfaSec = document.getElementById('mfa-section');

      if (email && pass) {
        // If MFA section is already visible, complete login
        if (!mfaSec.classList.contains('hidden')) {
          self.state.onboarded = true;
          self.saveState();
          document.getElementById('sidebar').classList.remove('hidden');
          self.switchView('dashboard');
        } else {
          // Trigger MFA verification step simulation
          mfaSec.classList.remove('hidden');
          document.getElementById('btn-auth-submit').textContent = "Verify & Access";
          self.logAudit("MFA code generated. Awaiting device verification input.");
        }
      }
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
        localStorage.removeItem('aura_state_vault');
        self.state = {
          username: "Alex",
          relationshipStatus: "dating",
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
        };
        document.getElementById('sidebar').classList.add('hidden');
        self.switchView('landing');
        alert("All local cookies and cache parameters cleared.");
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
    container.style.cssText = 'position: absolute; top: 0; left: 0; width: 100%; height: 100%; overflow: hidden; pointer-events: none; z-index: 0;';
    
    const landing = document.getElementById('view-landing');
    if (!landing) return;
    
    landing.style.position = 'relative';
    landing.appendChild(container);

    const petalCount = 15;
    for (let i = 0; i < petalCount; i++) {
      this.spawnPetal(container);
    }
  },

  spawnPetal: function(container) {
    const petal = document.createElement('div');
    petal.className = 'sakura-petal';
    
    const left = Math.random() * 100;
    const delay = Math.random() * 8;
    const duration = 6 + Math.random() * 6;
    const size = 6 + Math.random() * 8;
    
    petal.style.left = `${left}%`;
    petal.style.width = `${size}px`;
    petal.style.height = `${size}px`;
    petal.style.animationDelay = `${delay}s`;
    petal.style.animationDuration = `${duration}s`;
    
    container.appendChild(petal);
  }
};

// Start app on DOM content loaded
window.addEventListener('DOMContentLoaded', () => {
  app.init();
});
