// Browser-only conversation workflow. This service never sends transcript text
// to a network provider; results are deterministic local heuristics, not AI.
const auraConversationService = (() => {
  const MAX_BYTES = 1024 * 1024;
  const MAX_MESSAGES = 10000;
  const EMOTIONAL_RESPONSE_POINTS = Object.freeze({
    messageResponse: Object.freeze({ reread: 55, ask: 85, reply: 60, pause: 90 }),
    conflictResponse: Object.freeze({ explain: 70, withdraw: 45, resolve: 55, return: 90 }),
    situationResponse: Object.freeze({ assume: 40, context: 90, followup: 50, revisit: 75 })
  });
  const ONBOARDING_REFLECTIONS = Object.freeze({
    messageResponse: Object.freeze({
      reread: ['Rechecking unclear messages', 'You chose to reread and wonder what an unclear message means.', 'Write down the exact words separately from your interpretation, then decide whether one neutral question would help.'],
      ask: ['Seeking direct clarification', 'You chose to ask a direct question when a message feels unclear.', 'Keep the question specific and open, so the other person can clarify without having to defend an assumption.'],
      reply: ['Responding quickly to uncertainty', 'You chose to reply quickly to clear up an unclear message.', 'Pause briefly and identify the one thing you want clarified before sending a reply.'],
      pause: ['Pausing before responding', 'You chose to step away and return to an unclear message later.', 'Choose a time to revisit it, so a useful pause does not become an unresolved conversation.']
    }),
    conflictResponse: Object.freeze({
      explain: ['Explaining your point in detail', 'You chose to explain your point in detail when a disagreement gets tense.', 'Try stating one concern and one request at a time, then check what the other person heard.'],
      withdraw: ['Stepping away during tension', 'You chose to go quiet or step away when a disagreement gets tense.', 'If you need a break, say that directly and suggest when you can return to the conversation.'],
      resolve: ['Wanting to resolve tension quickly', 'You chose to try to resolve a disagreement immediately.', 'Check whether both people are ready to talk; agree on one issue to address first.'],
      return: ['Pausing with a plan to return', 'You chose to take a pause and agree when to continue.', 'Keep using a clear return time and start again with one shared question or request.']
    }),
    situationResponse: Object.freeze({
      assume: ['Worry after an unexpectedly short reply', 'You chose that a shorter-than-expected reply can make you worry something is wrong.', 'Separate what the reply literally says from what you fear it means before deciding how to respond.'],
      context: ['Checking context before concluding', 'You chose to consider other context and ask if needed after a short reply.', 'Use the context you know; if something important remains unclear, ask one direct question.'],
      followup: ['Following up quickly', 'You chose to send another message right away after a short reply.', 'Give the conversation some space, then send one clear follow-up only if you still need an answer.'],
      revisit: ['Waiting until ready to respond', 'You chose to wait until you feel ready after receiving a short reply.', 'Set a time to check back in with yourself, and decide whether a response is actually needed.']
    })
  });
  const SUPPORT_MOVES = Object.freeze({
    clarify: 'Before setting a boundary, write one sentence naming what you need.',
    wording: 'Draft one respectful sentence that names your concern and makes a clear request.',
    facts: 'Make two short notes: what you observed and what you are interpreting.',
    plan: 'Write the boundary and one action you will take if it is not respected.'
  });
  const GOAL_MOVES = Object.freeze({
    understand: 'Choose one message and separate its observable wording from your interpretation.',
    communicate: 'Pick one conversation and define the single point you want to communicate.',
    practice: 'Try a draft in the practice tool, then edit it so it sounds like you.',
    reflect: 'Note one response pattern you want to keep and one you want to try differently.'
  });

  function buildOnboardingReflections(preferences) {
    if (!preferences || typeof preferences !== 'object') return { patterns: [], moves: [] };
    const patterns = Object.entries(ONBOARDING_REFLECTIONS).flatMap(([key, choices]) => {
      const reflection = choices[preferences[key]];
      return reflection ? [{ title: reflection[0], observation: reflection[1], nextStep: reflection[2] }] : [];
    });
    const moves = [
      SUPPORT_MOVES[preferences.supportNeed] && { label: 'Based on your support preference', text: SUPPORT_MOVES[preferences.supportNeed] },
      GOAL_MOVES[preferences.goal] && { label: 'Based on your goal', text: GOAL_MOVES[preferences.goal] }
    ].filter(Boolean);
    return { patterns, moves };
  }

  function calculateEmotionalResponseScore(preferences) {
    if (!preferences || typeof preferences !== 'object') return null;
    const dimensions = [
      { key: 'messageResponse', label: 'Unclear messages' },
      { key: 'conflictResponse', label: 'Tense conversations' },
      { key: 'situationResponse', label: 'Unexpected short replies' }
    ].map((dimension) => {
      const points = EMOTIONAL_RESPONSE_POINTS[dimension.key][preferences[dimension.key]];
      return Number.isFinite(points) ? { ...dimension, points } : null;
    });
    if (dimensions.some((dimension) => !dimension)) return null;
    return {
      score: Math.round(dimensions.reduce((total, dimension) => total + dimension.points, 0) / dimensions.length),
      dimensions
    };
  }

  function makeId(prefix) {
    const value = globalThis.crypto && typeof globalThis.crypto.randomUUID === 'function'
      ? globalThis.crypto.randomUUID()
      : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
    return `${prefix}-${value}`;
  }

  function byteLength(text) {
    return typeof TextEncoder === 'function'
      ? new TextEncoder().encode(text).length
      : unescape(encodeURIComponent(text)).length;
  }

  function checkText(input) {
    if (typeof input !== 'string' || !input.trim()) {
      throw new Error('The transcript is empty. Add readable conversation text first.');
    }
    if (byteLength(input) > MAX_BYTES) {
      throw new Error('The transcript exceeds Aura’s 1 MiB limit. Split it into smaller conversations.');
    }
  }

  function parseJsonTranscript(input) {
    let parsed;
    try {
      parsed = JSON.parse(input);
    } catch (_) {
      throw new Error('This JSON file is malformed. Check its syntax and try again.');
    }
    const source = Array.isArray(parsed) ? parsed : parsed && parsed.messages;
    if (!Array.isArray(source)) {
      throw new Error('JSON transcripts must be an array or an object with a messages array.');
    }
    let rejected = 0;
    const messages = source.map((item) => {
      if (!item || typeof item !== 'object') { rejected++; return null; }
      const speaker = String(item.speaker ?? item.sender ?? item.name ?? '').trim().slice(0, 100);
      const text = String(item.text ?? item.message ?? '').trim();
      if (!speaker || !text) { rejected++; return null; }
      const timestampValue = item.timestamp ?? item.date ?? null;
      return {
        speaker,
        text,
        timestamp: timestampValue == null ? null : String(timestampValue).trim().slice(0, 100)
      };
    }).filter(Boolean);
    return { messages, rejected };
  }

  function parseTextTranscript(input) {
    const messages = [];
    const unassigned = [];
    const lines = input.replace(/^\uFEFF/, '').split(/\r\n?|\n/);
    const whatsapp = /^\s*\[([^\]]{1,100})\]\s*([^:]{1,100}):\s?(.*)$/;
    const whatsappUnbracketed = /^\s*(\d{1,4}[/-]\d{1,2}[/-]\d{2,4},\s*\d{1,2}:\d{2}(?:\s*[AP]M)?)\s+-\s+([^:]{1,100}):\s?(.*)$/i;
    const standard = /^\s*([^:\r\n]{1,100}):\s?(.*)$/;
    let current = null;
    lines.forEach((line) => {
      if (!line.trim()) return;
      const match = line.match(whatsapp) || line.match(whatsappUnbracketed) || line.match(standard);
      if (match) {
        current = {
          timestamp: match.length === 4 ? match[1].trim() : null,
          speaker: (match.length === 4 ? match[2] : match[1]).trim(),
          text: (match.length === 4 ? match[3] : match[2]).trim()
        };
        if (current.speaker && current.text) messages.push(current);
        else { unassigned.push(line); current = null; }
      } else if (current) {
        current.text += `\n${line.trimEnd()}`;
      } else {
        unassigned.push(line);
      }
    });
    return { messages, rejected: unassigned.length };
  }

  function normalizeTranscript(input, options = {}) {
    checkText(input);
    const result = options.format === 'json'
      ? parseJsonTranscript(input)
      : parseTextTranscript(input);
    if (!result.messages.length) {
      throw new Error('No readable messages found. Use “Speaker: message” lines or a JSON messages array.');
    }
    if (result.messages.length > MAX_MESSAGES) {
      throw new Error(`This transcript has more than ${MAX_MESSAGES} messages. Split it into smaller conversations.`);
    }
    const messages = result.messages.map((message, index) => ({
      id: `m${index + 1}`,
      sequence: index + 1,
      speaker: message.speaker,
      timestamp: message.timestamp || null,
      text: message.text
    }));
    const speakers = [...new Set(messages.map((message) => message.speaker))];
    return {
      id: options.id || makeId('conversation'),
      version: Number.isInteger(options.version) && options.version > 0 ? options.version : 1,
      sourceName: String(options.sourceName || 'Pasted transcript').slice(0, 180),
      sourceType: options.sourceType || (options.format === 'json' ? 'json' : 'text'),
      createdAt: options.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      speakers,
      messages,
      extractionWarnings: result.rejected
    };
  }

  function toEditableText(conversation) {
    return (conversation.messages || []).map((message) => {
      const timestamp = message.timestamp ? `[${message.timestamp}] ` : '';
      return `${timestamp}${message.speaker}: ${message.text}`;
    }).join('\n');
  }

  function analyzeLocally(conversation) {
    if (!conversation || !Array.isArray(conversation.messages) || !conversation.messages.length) {
      throw new Error('Choose a conversation with readable messages before analyzing.');
    }
    const messages = conversation.messages;
    const speakers = [...new Set(messages.map((message) => message.speaker))];
    const firstSpeaker = speakers[0] || 'Speaker 1';
    const otherSpeakers = speakers.slice(1);
    const patterns = [
      { id: 'absolute-language', title: 'Absolute wording', re: /\b(always|never|every time|constantly)\b/i, note: 'Absolute wording appears in these messages. It can make a specific concern harder to discuss; this scan cannot determine how it was intended.' },
      { id: 'first-person', title: 'First-person feelings or needs', re: /\b(i feel|i felt|i need|i would like|i want)\b/i, note: 'These messages use first-person language to describe a feeling, need, or preference.' },
      { id: 'explicit-emotion-words', title: 'Explicit emotion words', re: /\b(worried|anxious|upset|frustrated|lonely|calm|angry|scared|hurt|overwhelmed|sad|afraid)\b/i, note: 'These messages explicitly contain emotion words. Aura does not infer a speaker’s emotional state from them.' },
      { id: 'requests', title: 'Requests or proposals', re: /\b(can we|could you|would you|please|i’d like|i'd like|let’s|let's)\b/i, note: 'These messages contain a request or proposal.' },
      { id: 'questions', title: 'Questions or clarification attempts', re: /\?/i, note: 'These messages contain a question. A text scan cannot determine whether there is a misunderstanding.' },
      { id: 'repair', title: 'Acknowledgement or repair language', re: /\b(sorry|i apologize|thank you|appreciate|i understand|i hear you)\b/i, note: 'These messages contain acknowledgement or repair language.' },
      { id: 'boundaries', title: 'Stated limits or boundaries', re: /\b(i need to|i can’t|i can't|i will not|i won’t|i won't|not comfortable|my boundary)\b/i, note: 'These messages state a limit or comfort boundary.' }
    ];
    const findings = patterns.map((pattern) => {
      const evidenceMessageIds = messages.filter((message) => pattern.re.test(message.text)).map((message) => message.id);
      if (!evidenceMessageIds.length) return null;
      return {
        id: pattern.id,
        title: pattern.title,
        observation: pattern.note,
        evidenceMessageIds,
        confidence: 'limited text marker'
      };
    }).filter(Boolean);

    const messageCounts = Object.fromEntries(speakers.map((speaker) => [
      speaker,
      messages.filter((message) => message.speaker === speaker).length
    ]));
    const topicCues = [];
    const topicPatterns = [
      ['response timing', /\b(reply|replied|text|message|respond|response)\b/i],
      ['shared tasks', /\b(clean|chore|dish|dishes|housework|task)\b/i],
      ['time together', /\b(time together|date|weekend|schedule|plans?)\b/i]
    ];
    topicPatterns.forEach(([label, re]) => {
      const ids = messages.filter((message) => re.test(message.text)).map((message) => message.id);
      if (ids.length) {
        topicCues.push({ label, evidenceMessageIds: ids });
        if (ids.length > 1) findings.push({
          id: `topic-${label.replace(/\s+/g, '-')}`,
          title: 'Repeated topic cue',
          observation: `The phrase pattern for “${label}” appears in ${ids.length} messages. This is a word-count observation, not proof of an ongoing conflict or its cause.`,
          evidenceMessageIds: ids,
          confidence: 'repeated word cue'
        });
      }
    });

    const conversationId = conversation.id;
    const analysisVersion = conversation.version;
    const recommendations = [];
    const find = (id) => findings.find((item) => item.id === id);
    if (find('absolute-language')) recommendations.push({
      id: 'specific-observation',
      text: 'If it fits your intent, replace absolute wording with one specific event, its impact on you, and a concrete request.',
      basedOnFindingIds: ['absolute-language']
    });
    if (find('first-person') && !find('requests')) recommendations.push({
      id: 'clear-request',
      text: 'Consider pairing the stated feeling or need with one specific, doable request.',
      basedOnFindingIds: ['first-person']
    });
    if (!find('first-person') && messages.length) recommendations.push({
      id: 'state-your-experience',
      text: 'If useful, describe your own observation or feeling, then ask one open question. This is a general communication option, not a conclusion about either speaker.',
      basedOnFindingIds: findings.slice(0, 1).map((item) => item.id)
    });
    if (find('boundaries')) recommendations.push({
      id: 'keep-boundary-specific',
      text: 'Keep the stated limit concrete and describe what action you will take to honor it.',
      basedOnFindingIds: ['boundaries']
    });
    if (find('questions')) recommendations.push({
      id: 'clarify-uncertainty',
      text: 'If a point is still unclear, ask one neutral question about that specific point before deciding what it means.',
      basedOnFindingIds: ['questions']
    });
    if (!recommendations.length) recommendations.push({
      id: 'clarify-next-step',
      text: 'Ask each person what specific next step would help; this transcript scan found no strong language markers to guide more tailored advice.',
      basedOnFindingIds: []
    });

    const markerSummary = findings.length
      ? `The local scan found ${findings.map((item) => item.title.toLowerCase()).join(', ')}.`
      : 'The local scan found none of its configured language markers.';
    return {
      id: makeId('analysis'),
      conversationId,
      analysisVersion,
      method: 'local-heuristic',
      sourceName: conversation.sourceName,
      analyzedAt: new Date().toISOString(),
      participants: speakers,
      primarySpeaker: firstSpeaker,
      otherSpeakers,
      messageCount: messages.length,
      messageCounts,
      topicCues,
      findings,
      recommendations,
      summary: `This transcript contains ${messages.length} messages from ${speakers.length} ${speakers.length === 1 ? 'speaker' : 'speakers'}. ${markerSummary} These are text-pattern observations only; Aura does not infer intent, diagnose people, or predict anyone’s response.`,
      limitations: 'Local heuristic analysis, not AI or clinical advice. It does not infer intent, diagnose people, or assess relationship safety.'
    };
  }

  const localHeuristicProvider = Object.freeze({
    id: 'local-heuristic',
    analyze: analyzeLocally
  });

  async function analyzeConversation(conversation, provider = localHeuristicProvider) {
    if (!provider || typeof provider.analyze !== 'function') {
      throw new Error('The selected analysis provider is unavailable.');
    }
    let result;
    try {
      result = await provider.analyze(conversation);
    } catch (_) {
      throw new Error('The selected analysis provider could not complete this transcript. Try the local provider or retry later.');
    }
    if (!result || result.conversationId !== conversation.id || result.analysisVersion !== conversation.version) {
      throw new Error('The analysis result does not match the selected transcript version and was not saved.');
    }
    return result;
  }

  function reviewDraft(text) {
    const value = String(text || '');
    const markers = [];
    if (/\bi feel\b/i.test(value)) markers.push('uses first-person feeling language');
    if (/\b(always|never|selfish|lazy)\b/i.test(value)) markers.push('contains absolute or blaming wording');
    if (/\b(can we|could we|could you|would you|please|i’d like|i'd like)\b/i.test(value)) markers.push('includes a concrete request');
    if (/\b(i need to|i can’t|i can't|i won't|i will not|not comfortable)\b/i.test(value)) markers.push('states a limit');
    return {
      markers,
      note: markers.length
        ? `Text check: ${markers.join('; ')}. This describes wording in your draft, not another person’s likely reaction.`
        : 'No configured wording markers found. This is not a prediction of how anyone will respond.'
    };
  }

  function createPracticeReply(objective, latestMessage) {
    if (!latestMessage) return 'Practice reply (fictional): What would you like us to work through first?';
    const text = latestMessage.text.toLowerCase();
    const topic = /\b(clean|chore|dish|housework|task)\b/.test(text)
      ? 'the shared-task concern in the excerpt'
      : /\b(reply|replied|texts?|message|respond|response)\b/.test(text)
        ? 'the response-timing concern in the excerpt'
        : /\b(schedule|weekend|plan|time together|date)\b/.test(text)
          ? 'the plans discussed in the excerpt'
          : 'the concern in the excerpt';
    let reply;
    if (objective === 'boundary') reply = `I hear that ${topic} matters to you. What would help us discuss it respectfully?`;
    else if (objective === 'deescalation') reply = `I want to discuss ${topic} calmly. Would a pause and a time to return help?`;
    else if (objective === 'repair') reply = `Thank you for explaining ${topic}. What is one next step that would feel workable?`;
    else reply = `I want to understand ${topic}. What part would you like us to clarify first?`;
    return `Fictional practice response: “${reply}” This is an exercise based on a text cue, not a prediction of the other speaker.`;
  }

  return Object.freeze({
    MAX_BYTES,
    MAX_MESSAGES,
    calculateEmotionalResponseScore,
    buildOnboardingReflections,
    normalizeTranscript,
    toEditableText,
    analyzeConversation,
    localHeuristicProvider,
    reviewDraft,
    createPracticeReply
  });
})();
