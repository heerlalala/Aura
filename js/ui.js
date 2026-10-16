// Aura UI renderer. User-provided transcript and journal text is inserted with
// textContent; report exports are built from the selected UID-scoped records.
const auraUI = {
  escapeHTML: function(value) {
    return String(value ?? '').replace(/[&<>"']/g, (character) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    })[character]);
  },

  element: function(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  },

  renderDashboard: function(state, analysis, conversation) {
    document.getElementById('dash-username').textContent = state.username || 'User';
    document.getElementById('score-text').textContent = analysis ? String(analysis.messageCount) : '—';
    document.querySelector('#view-dashboard .score-label').textContent = 'Messages';
    document.querySelector('#view-dashboard .score-card h4').textContent = 'Selected transcript';
    document.querySelector('#view-dashboard .score-card p').textContent = analysis
      ? 'Message count from the selected transcript. It is not a relationship-quality score.'
      : 'Analyze a transcript to see source-grounded observations here.';
    const effort = document.getElementById('dash-effort-status');
    effort.className = 'badge badge-primary';
    effort.textContent = analysis ? `${analysis.participants.length} speaker(s)` : 'No transcript';
    const dynamicCard = document.querySelector('#view-dashboard .grid-3 .glass-panel:nth-child(2)');
    if (dynamicCard) {
      dynamicCard.querySelectorAll('span').forEach((span, index) => {
        if (index === 0) span.textContent = 'Source';
        if (index === 1) span.textContent = conversation ? conversation.sourceName : '—';
        if (index === 2) span.textContent = 'Topics mentioned';
        if (index === 3) span.textContent = analysis && analysis.topicCues.length ? analysis.topicCues.map((item) => item.label).join(', ') : 'No topic marker';
        if (index === 4) span.textContent = 'Analysis method';
        if (index === 5) span.textContent = analysis ? 'Local text heuristics' : 'Not analyzed';
      });
    }
    const patternBox = document.getElementById('dashboard-patterns-list');
    patternBox.replaceChildren();
    const actionsBox = document.getElementById('dashboard-actions-list');
    actionsBox.replaceChildren();
    if (!analysis) {
      patternBox.appendChild(this.element('p', 'insight-item', 'No current analysis. Choose a transcript in the Upload Center and run the local scan.'));
      actionsBox.appendChild(this.element('p', 'insight-item', 'Recommendations are generated only from an analyzed conversation.'));
    } else {
      analysis.findings.forEach((finding) => {
        const card = this.element('div', 'insight-item');
        card.append(this.element('strong', '', finding.title), this.element('p', '', `${finding.observation} Evidence: ${finding.evidenceMessageIds.join(', ')}.`));
        patternBox.appendChild(card);
      });
      if (!analysis.findings.length) patternBox.appendChild(this.element('p', 'insight-item', 'No configured wording markers found in this transcript.'));
      analysis.recommendations.slice(0, 3).forEach((recommendation) => {
        const card = this.element('div', 'insight-item success');
        card.append(this.element('strong', '', 'Possible next step'), this.element('p', '', `${recommendation.text}${recommendation.basedOnFindingIds.length ? ` Evidence: ${recommendation.basedOnFindingIds.join(', ')}.` : ''}`));
        actionsBox.appendChild(card);
      });
    }
    document.getElementById('dash-course-progress-text').textContent = `${state.completedLessons.length} of 9 lessons`;
    document.getElementById('dash-course-progress-bar').style.width = `${Math.round((state.completedLessons.length / 9) * 100)}%`;
    document.getElementById('dash-journal-count').textContent = `${state.journalEntries.length} Entries`;
  },

  renderAnalysis: function(analysis, conversation) {
    const current = document.getElementById('analysis-current');
    const note = document.getElementById('analysis-method-note');
    const button = document.getElementById('btn-export-pdf');
    const report = document.getElementById('print-report');
    report.replaceChildren();
    if (!analysis || !conversation || analysis.conversationId !== conversation.id || analysis.analysisVersion !== conversation.version) {
      current.classList.add('hidden');
      button.disabled = true;
      document.getElementById('analysis-report-title').textContent = conversation
        ? 'This transcript has not been analyzed in its current version. Review it in Upload Center and run analysis.'
        : 'Choose or add a transcript to see source-grounded observations.';
      note.textContent = 'No current analysis is available. Aura does not generate default or sample findings without a transcript.';
      return;
    }
    current.classList.remove('hidden');
    button.disabled = false;
    const title = `${conversation.sourceName} · version ${conversation.version}`;
    document.getElementById('analysis-report-title').textContent = title;
    const persistence = typeof app !== 'undefined' && app.storageUnavailable
      ? 'Browser storage is unavailable; this working copy may not survive a refresh.'
      : 'Stored in this signed-in user’s browser-local state only; it does not sync to a server.';
    note.textContent = `Local heuristic scan · ${analysis.messageCount} messages · no AI provider or third-party analysis service is configured. ${persistence}`;
    document.getElementById('analysis-message-count').textContent = String(analysis.messageCount);
    document.getElementById('analysis-speakers').textContent = analysis.participants.join(', ');
    document.getElementById('analysis-source-name').textContent = conversation.sourceName;
    document.getElementById('analysis-summary').textContent = analysis.summary;
    document.getElementById('analysis-limitations').textContent = analysis.limitations;

    const messageMap = new Map(conversation.messages.map((message) => [message.id, message]));
    const findings = document.getElementById('analysis-findings');
    findings.replaceChildren();
    if (!analysis.findings.length) findings.appendChild(this.element('p', 'insight-item', 'No configured language markers were found. That does not establish that the conversation is problem-free.'));
    analysis.findings.forEach((finding) => {
      const card = this.element('div', 'insight-item');
      card.append(this.element('strong', '', finding.title), this.element('p', '', finding.observation));
      const refs = finding.evidenceMessageIds.map((id) => `${id}${messageMap.has(id) ? ` (${messageMap.get(id).speaker})` : ''}`).join(', ');
      card.appendChild(this.element('small', '', `Evidence references: ${refs}. ${finding.confidence}.`));
      findings.appendChild(card);
    });

    const recommendations = document.getElementById('analysis-recommendations');
    recommendations.replaceChildren();
    analysis.recommendations.forEach((item) => {
      const card = this.element('div', 'insight-item success');
      card.append(this.element('p', '', item.text));
      card.appendChild(this.element('small', '', item.basedOnFindingIds.length ? `Based on finding(s): ${item.basedOnFindingIds.join(', ')}.` : 'General next-step prompt; no specific marker supported a more tailored recommendation.'));
      recommendations.appendChild(card);
    });

    const evidence = document.getElementById('analysis-evidence');
    evidence.replaceChildren();
    conversation.messages.forEach((message) => {
      const line = this.element('p', 'transcript-evidence');
      const timestamp = message.timestamp ? ` · ${message.timestamp}` : '';
      line.append(this.element('strong', '', `[${message.id}] ${message.speaker}${timestamp}: `), document.createTextNode(message.text));
      evidence.appendChild(line);
    });
  },

  renderRealityCheck: function(analysis, concise) {
    const consoleText = document.getElementById('reality-talk-content');
    consoleText.textContent = auraEngines.generateRealityCheck(analysis, concise);
  },

  renderSimulator: function(state, conversation) {
    const chatArea = document.getElementById('sim-chat-box');
    chatArea.replaceChildren();
    const labels = { context: 'Source excerpt', user: 'Your practice draft', simulation: 'Fictional practice reply', feedback: 'Wording note' };
    (state.simMessages || []).forEach((message) => {
      const bubble = this.element('div', `sim-message ${message.role}`);
      bubble.append(this.element('small', 'sim-message-label', labels[message.role] || 'Practice content'));
      let text = message.text || '';
      if (message.role === 'context') {
        const source = conversation && conversation.messages.find((item) => item.id === message.messageId);
        text = source ? `${source.speaker}${source.timestamp ? ` · ${source.timestamp}` : ''}: ${source.text}` : 'Source excerpt is not available in this conversation version.';
      }
      bubble.appendChild(this.element('div', '', text));
      chatArea.appendChild(bubble);
    });
    if (!state.simMessages || !state.simMessages.length) {
      chatArea.appendChild(this.element('p', 'insight-item', 'No practice session is active for the current analysis.'));
    }
    chatArea.scrollTop = chatArea.scrollHeight;
  },

  renderPrintReport: function(analysis, conversation, simulationMessages) {
    const root = document.getElementById('print-report');
    root.replaceChildren();
    const add = (tag, text) => { const node = this.element(tag, '', text); root.appendChild(node); return node; };
    add('h1', 'Aura conversation notes');
    add('p', `${conversation.sourceName} · report version ${analysis.analysisVersion} · created ${new Date().toLocaleString()}`);
    add('h2', 'Summary');
    add('p', analysis.summary);
    add('p', analysis.limitations);
    add('h2', 'Observed language markers');
    const messageMap = new Map(conversation.messages.map((message) => [message.id, message]));
    if (!analysis.findings.length) add('p', 'No configured language markers were found.');
    analysis.findings.forEach((finding) => {
      add('h3', finding.title);
      add('p', finding.observation);
      finding.evidenceMessageIds.forEach((id) => {
        const message = messageMap.get(id);
        if (message) add('blockquote', `[${id}] ${message.speaker}${message.timestamp ? ` · ${message.timestamp}` : ''}: ${message.text}`);
      });
    });
    add('h2', 'Possible next steps');
    analysis.recommendations.forEach((item) => add('p', `${item.text}${item.basedOnFindingIds.length ? ` (Finding references: ${item.basedOnFindingIds.join(', ')})` : ''}`));
    const matchingSimulation = (simulationMessages || []).filter((item) => item.conversationId === conversation.id && item.analysisVersion === analysis.analysisVersion);
    if (matchingSimulation.length) {
      add('h2', 'Fictional practice session');
      matchingSimulation.forEach((message) => {
        if (message.role === 'context') {
          const source = messageMap.get(message.messageId);
          if (source) add('blockquote', `[${source.id}] ${source.speaker}${source.timestamp ? ` · ${source.timestamp}` : ''}: ${source.text}`);
        } else {
          add('p', `${labelsForRole(message.role)}: ${message.text}`);
        }
      });
    }
    add('p', `Report source contains ${conversation.messages.length} messages from ${conversation.speakers.join(', ')}. Generated content is not an assessment or prediction.`);
    function labelsForRole(role) {
      return ({ context: 'Source excerpt', user: 'Your draft', simulation: 'Fictional reply', feedback: 'Wording note' })[role] || 'Practice';
    }
  },

  renderGrowthHub: function(state) {
    const totalLessons = 9;
    const countEq = state.completedLessons.filter((lesson) => lesson.startsWith('eq_')).length;
    const countBound = state.completedLessons.filter((lesson) => lesson.startsWith('bound_')).length;
    const countComm = state.completedLessons.filter((lesson) => lesson.startsWith('comm_')).length;
    document.getElementById('progress-eq').style.width = `${Math.round((countEq / 3) * 100)}%`;
    document.getElementById('progress-boundaries').style.width = `${Math.round((countBound / 3) * 100)}%`;
    document.getElementById('progress-comm').style.width = `${Math.round((countComm / 3) * 100)}%`;
    const promptIndex = new Date().getDate() % auraData.journalPrompts.length;
    document.getElementById('journal-daily-prompt').textContent = auraData.journalPrompts[promptIndex];
    const diaryBox = document.getElementById('journal-entries-list');
    diaryBox.replaceChildren();
    if (!state.journalEntries.length) {
      diaryBox.appendChild(this.element('p', '', 'No journal entries logged yet. Write one above!'));
      return;
    }
    state.journalEntries.forEach((entry) => {
      const card = this.element('div', 'glass-panel journal-entry-card animate-fade-in');
      const header = this.element('div', 'journal-header');
      const date = this.element('span', '', entry.date);
      date.style.cssText = 'font-size:0.75rem; color:var(--secondary); font-weight:600;';
      const remove = this.element('button', 'btn btn-secondary', 'Delete entry');
      remove.type = 'button';
      remove.setAttribute('aria-label', `Delete entry from ${entry.date}`);
      remove.addEventListener('click', () => app.deleteJournal(entry.id));
      header.append(date, remove);
      const prompt = this.element('small', '', `Prompt: ${entry.prompt}`);
      const text = this.element('p', '', entry.text);
      text.style.whiteSpace = 'pre-wrap';
      card.append(header, prompt, text);
      diaryBox.appendChild(card);
    });
  }
};
