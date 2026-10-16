// Small, deterministic helpers used by the browser-only app.
const auraEngines = {
  detectCrisis: function(text) {
    const terms = [
      'hurt myself', 'end it all', 'do not want to live', "don't want to live",
      'want to die', 'kill myself', 'self harm', 'suicide', 'ending my life'
    ];
    const lower = String(text || '').toLowerCase();
    return terms.some((term) => lower.includes(term));
  },

  generateRealityCheck: function(analysis, concise) {
    if (!analysis) return 'No current analysis is available. Select a transcript and run the local text scan first.';
    const lines = [concise ? 'Concise evidence notes' : 'Transcript-linked observations', analysis.summary, ''];
    if (analysis.findings.length) {
      lines.push('Observed markers:');
      analysis.findings.forEach((finding) => {
        lines.push(`• ${finding.title} [${finding.evidenceMessageIds.join(', ')}]`);
      });
    } else {
      lines.push('No configured language markers were found. This does not mean that the conversation has no important context.');
    }
    lines.push('', 'Possible next steps:');
    analysis.recommendations.forEach((item) => lines.push(`• ${item.text}${item.basedOnFindingIds.length ? ` [${item.basedOnFindingIds.join(', ')}]` : ''}`));
    lines.push('', analysis.limitations);
    return lines.join('\n');
  },

  translateBoundary: function(inputText, analysis) {
    const draft = String(inputText || '').trim();
    if (!draft) return '';
    const sourceNote = analysis && analysis.conversationId
      ? `For the conversation currently selected (${analysis.conversationId}), `
      : '';
    const concern = draft.length > 240 ? `${draft.slice(0, 237)}…` : draft;
    return `${sourceNote}a possible rewrite is: “I want to discuss this specific concern: ${concern}. I would like us to agree on one practical next step. What would feel workable to you?” This is an editable communication template, not a claim about anyone’s intent or response.`;
  }
};
