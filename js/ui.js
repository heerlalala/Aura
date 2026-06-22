// Aura UI Renderer Module

const auraUI = {
  
  // Update circular gauge score indicator
  updateScoreDial: function(elementId, value) {
    const ring = document.getElementById(elementId);
    if (!ring) return;
    
    // Radius = 64, Circumference = 2 * PI * r = 402
    const maxOffset = 402;
    const offset = maxOffset - (value / 100) * maxOffset;
    ring.style.strokeDashoffset = offset;
  },

  // Render Dashboard main widgets
  renderDashboard: function(state, analysis) {
    // Set username
    document.getElementById('dash-username').textContent = state.username || "Alex";
    
    // Update Score Dial
    document.getElementById('score-text').textContent = analysis.harmonyScore;
    this.updateScoreDial('score-ring', analysis.harmonyScore);

    // Effort status label
    const effortStatus = document.getElementById('dash-effort-status');
    effortStatus.textContent = `${analysis.userEffortPercent}% Effort`;
    if (analysis.userEffortPercent >= 45 && analysis.userEffortPercent <= 55) {
      effortStatus.className = "badge badge-success";
      effortStatus.textContent = "Balanced (" + analysis.userEffortPercent + "%)";
    } else {
      effortStatus.className = "badge badge-warning";
      effortStatus.textContent = "Imbalanced (" + analysis.userEffortPercent + "%)";
    }

    // Render active patterns list
    const patternBox = document.getElementById('dashboard-patterns-list');
    patternBox.innerHTML = "";
    
    // Base active patterns from template data or calculation
    const patternSource = (analysis.harmonyScore < 75) 
      ? auraData.adviceTemplates.anxious.patterns 
      : auraData.adviceTemplates.secure.patterns;

    patternSource.forEach(pattern => {
      const el = document.createElement('div');
      el.className = "insight-item";
      if (analysis.harmonyScore < 75) el.classList.add("danger");
      el.innerHTML = `<strong>${pattern.split(':')[0]}:</strong><p style="font-size:0.85rem; color:var(--text-secondary); margin-top:0.25rem;">${pattern.split(':')[1] || "Active loop detected."}</p>`;
      patternBox.appendChild(el);
    });

    // Render dashboard action recommendations
    const actionsBox = document.getElementById('dashboard-actions-list');
    actionsBox.innerHTML = "";
    
    const adviceSource = (analysis.harmonyScore < 75) 
      ? auraData.adviceTemplates.anxious.actions 
      : auraData.adviceTemplates.secure.actions;

    adviceSource.slice(0, 3).forEach(action => {
      const el = document.createElement('div');
      el.className = "insight-item success";
      el.innerHTML = `<strong>Recommendation:</strong><p style="font-size:0.85rem; color:var(--text-secondary); margin-top:0.25rem;">${action}</p>`;
      actionsBox.appendChild(el);
    });

    // Render Growth progress trackers
    document.getElementById('dash-course-progress-text').textContent = `${state.completedLessons.length} of 9 lessons`;
    const percent = Math.round((state.completedLessons.length / 9) * 100);
    document.getElementById('dash-course-progress-bar').style.width = percent + "%";
    document.getElementById('dash-journal-count').textContent = `${state.journalEntries.length} Entries`;
  },

  // Render Analyzer reports view
  renderAnalysis: function(analysis) {
    document.getElementById('analysis-report-title').textContent = `Analyzing conversation between ${analysis.user} and ${analysis.partner}`;
    
    // Overview Harmony score
    document.getElementById('report-score-val').textContent = analysis.harmonyScore;
    this.updateScoreDial('report-score-ring', analysis.harmonyScore);

    // Urgency Badge
    const urgBadge = document.getElementById('report-urgency-badge');
    urgBadge.textContent = analysis.urgency + " Escalation Risk";
    if (analysis.urgency === "High") {
      urgBadge.className = "badge badge-danger";
    } else if (analysis.urgency === "Medium") {
      urgBadge.className = "badge badge-warning";
    } else {
      urgBadge.className = "badge badge-success";
    }
    
    document.getElementById('report-urgency-description').textContent = analysis.urgencyDesc;
    document.getElementById('report-trigger-text').textContent = analysis.primaryTrigger;

    // Executive Summary construction
    let summaryText = "";
    if (analysis.harmonyScore < 50) {
      summaryText = `This conversation reveals significant emotional tension between ${analysis.user} and ${analysis.partner}. The presence of absolute accusations and defensive responses has created an escalatory feedback loop. Effort is heavily skewed, leading to frustration and withdrawal from one participant. We suggest taking an immediate cooling-off break before attempting to speak again.`;
    } else if (analysis.harmonyScore < 75) {
      summaryText = `The conversation between ${analysis.user} and ${analysis.partner} shows a typical pursue-withdraw dynamic. One partner is communicating with anxiety, urging for immediate clarity, which causes the other to withdraw to seek safety. While trust markers are intact, vulnerability feels guarded. Focus on active listening and avoiding absolute statements.`;
    } else {
      summaryText = `An excellent conversation between ${analysis.user} and ${analysis.partner}. Both speakers displayed secure attachment traits, stated their concerns clearly without blaming, and actively looked for scheduling or division compromises. Trust is high, and the effort distribution is exceptionally balanced.`;
    }
    document.getElementById('report-summary-text').textContent = summaryText;

    // Render user tone charts (custom SVG/CSS bars)
    document.getElementById('report-user-tone-title').textContent = `${analysis.user}'s Emotional Tone`;
    const userChart = document.getElementById('report-user-tone-chart');
    userChart.innerHTML = "";
    Object.keys(analysis.userTones).forEach(tone => {
      const val = analysis.userTones[tone];
      const row = document.createElement('div');
      row.className = "chart-bar-row";
      row.innerHTML = `
        <div class="chart-bar-label">${tone}</div>
        <div class="chart-bar-track"><div class="chart-bar-fill" style="width: ${val}%;"></div></div>
        <div class="chart-bar-val">${val}%</div>
      `;
      userChart.appendChild(row);
    });

    // Render partner tone charts
    document.getElementById('report-partner-tone-title').textContent = `${analysis.partner}'s Emotional Tone`;
    const partnerChart = document.getElementById('report-partner-tone-chart');
    partnerChart.innerHTML = "";
    Object.keys(analysis.partnerTones).forEach(tone => {
      const val = analysis.partnerTones[tone];
      const row = document.createElement('div');
      row.className = "chart-bar-row";
      row.innerHTML = `
        <div class="chart-bar-label">${tone}</div>
        <div class="chart-bar-track"><div class="chart-bar-fill" style="width: ${val}%;"></div></div>
        <div class="chart-bar-val">${val}%</div>
      `;
      partnerChart.appendChild(row);
    });

    // Effort Balance Pointer Calculation (stroke-dashoffset range [290, 0] centered at 145)
    // 0 is fully left, 290 is fully right. Pointer coordinates: cx = 20 to 200 (cx = 20 + 1.8 * UserEffort)
    const cxVal = Math.max(20, Math.min(200, 20 + (1.8 * analysis.userEffortPercent)));
    document.getElementById('effort-scale-pointer').setAttribute('cx', cxVal);
    document.getElementById('effort-label-left').textContent = `${analysis.user} (${analysis.userEffortPercent}%)`;
    document.getElementById('effort-label-right').textContent = `${analysis.partner} (${analysis.partnerEffortPercent}%)`;

    let effortMsg = "Effort is balanced in this conversation.";
    if (analysis.userEffortPercent > 60) {
      effortMsg = `${analysis.user} is over-contributing, indicating a pursuit loop.`;
    } else if (analysis.userEffortPercent < 40) {
      effortMsg = `${analysis.partner} is over-contributing or ${analysis.user} is shutting down.`;
    }
    document.getElementById('effort-summary-msg').textContent = effortMsg;

    // Trust safety index metrics
    document.getElementById('report-trust-val').textContent = `${analysis.trustIndex}%`;
    document.getElementById('report-trust-bar').style.width = `${analysis.trustIndex}%`;
    document.getElementById('report-vuln-val').textContent = `${analysis.vulnerabilityIndex}%`;
    document.getElementById('report-vuln-bar').style.width = `${analysis.vulnerabilityIndex}%`;
    document.getElementById('report-defense-val').textContent = `${analysis.defensivenessIndex}%`;
    document.getElementById('report-defense-bar').style.width = `${analysis.defensivenessIndex}%`;

    // Red Flags List
    const redBox = document.getElementById('report-red-flags');
    redBox.innerHTML = "";
    if (analysis.redFlags.length === 0) {
      redBox.innerHTML = `<div class="insight-item success">No critical red flags detected in this conversation sample.</div>`;
    } else {
      analysis.redFlags.forEach(flag => {
        const div = document.createElement('div');
        div.className = "flag-box red animate-fade-in";
        div.innerHTML = `
          <div class="flag-title">🚩 ${flag.speaker} used '${flag.flag}'</div>
          <p style="font-size:0.85rem; color:var(--text-secondary); margin-top:0.25rem;">Context: "${flag.text}"</p>
          <small style="color:var(--text-muted); display:block; margin-top:0.25rem;">Reason: ${flag.reason}</small>
        `;
        redBox.appendChild(div);
      });
    }

    // Green Flags List
    const greenBox = document.getElementById('report-green-flags');
    greenBox.innerHTML = "";
    if (analysis.greenFlags.length === 0) {
      greenBox.innerHTML = `<div class="insight-item" style="border-left-color:var(--border-color)">No vulnerability markers detected. Try referencing feelings directly.</div>`;
    } else {
      analysis.greenFlags.forEach(flag => {
        const div = document.createElement('div');
        div.className = "flag-box green animate-fade-in";
        div.innerHTML = `
          <div class="flag-title">🟢 ${flag.speaker} used '${flag.flag}'</div>
          <p style="font-size:0.85rem; color:var(--text-secondary); margin-top:0.25rem;">Context: "${flag.text}"</p>
          <small style="color:var(--text-muted); display:block; margin-top:0.25rem;">Reason: ${flag.reason}</small>
        `;
        greenBox.appendChild(div);
      });
    }
  },

  // Render Reality Check console
  renderRealityCheck: function(analysis, straightMode) {
    const consoleText = document.getElementById('reality-talk-content');
    consoleText.innerHTML = auraEngines.generateRealityCheck(analysis, straightMode);
    
    // Responsibility slider configuration
    const slider = document.getElementById('reality-responsibility-slider');
    slider.value = analysis.userEffortPercent;
    document.getElementById('slider-user-label').textContent = `${analysis.user} (${analysis.userEffortPercent}%)`;
    document.getElementById('slider-partner-label').textContent = `${analysis.partner} (${analysis.partnerEffortPercent}%)`;
  },

  // Render Simulator Chat Log
  renderSimulator: function(state) {
    const chatArea = document.getElementById('sim-chat-box');
    chatArea.innerHTML = "";

    state.simMessages.forEach(msg => {
      const bubble = document.createElement('div');
      bubble.className = `sim-message ${msg.role}`;
      bubble.textContent = msg.text;
      chatArea.appendChild(bubble);
    });

    // Scroll to bottom
    chatArea.scrollTop = chatArea.scrollHeight;
  },

  // Render Growth hub dashboard
  renderGrowthHub: function(state) {
    // Highlight completed courses progress ratios
    const totalLessons = 9;
    const progressPercent = Math.round((state.completedLessons.length / totalLessons) * 100);
    
    const countEq = state.completedLessons.filter(l => l.startsWith('eq_')).length;
    const countBound = state.completedLessons.filter(l => l.startsWith('bound_')).length;
    const countComm = state.completedLessons.filter(l => l.startsWith('comm_')).length;
    
    document.getElementById('progress-eq').style.width = Math.round((countEq / 3) * 100) + "%";
    document.getElementById('progress-boundaries').style.width = Math.round((countBound / 3) * 100) + "%";
    document.getElementById('progress-comm').style.width = Math.round((countComm / 3) * 100) + "%";

    // Daily reflection prompt update
    const promptIndex = new Date().getDate() % auraData.journalPrompts.length;
    document.getElementById('journal-daily-prompt').textContent = auraData.journalPrompts[promptIndex];

    // Render Diary log list
    const diaryBox = document.getElementById('journal-entries-list');
    diaryBox.innerHTML = "";

    if (state.journalEntries.length === 0) {
      diaryBox.innerHTML = `<p style="font-size:0.85rem; color:var(--text-muted); text-align:center; padding:1rem 0;">No journal entries logged yet. Write one above!</p>`;
    } else {
      state.journalEntries.forEach(entry => {
        const div = document.createElement('div');
        div.className = "glass-panel journal-entry-card animate-fade-in";
        div.innerHTML = `
          <div class="journal-header">
            <span style="font-size:0.75rem; color:var(--secondary); font-weight:600;">${entry.date}</span>
            <span style="font-size:0.75rem; color:var(--text-muted); cursor:pointer;" onclick="app.deleteJournal('${entry.id}')">✕ Delete</span>
          </div>
          <small style="color:var(--text-muted); display:block; margin-bottom:0.25rem;">Prompt: "${entry.prompt}"</small>
          <p style="font-size:0.9rem; color:var(--text-secondary); white-space:pre-wrap;">${entry.text}</p>
        `;
        diaryBox.appendChild(div);
      });
    }
  }
};
