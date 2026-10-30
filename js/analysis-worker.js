// Run CPU-heavy transcript scoring away from the page's rendering thread.
importScripts('conversation-service.js');

self.addEventListener('message', async (event) => {
  try {
    const { operation, payload } = event.data;
    if (operation === 'normalize') {
      const conversation = auraConversationService.normalizeTranscript(payload.text, payload.options);
      self.postMessage({ conversation });
      return;
    }
    if (operation === 'analyze-text') {
      const conversation = auraConversationService.normalizeTranscript(payload.text, payload.options);
      const selected = auraConversationService.filterConversationByDate(conversation, payload.period);
      const analysis = await auraConversationService.analyzeConversation(selected);
      self.postMessage({ conversation, analysis });
      return;
    }
    const analysis = await auraConversationService.analyzeConversation(payload);
    self.postMessage({ analysis });
  } catch (error) {
    self.postMessage({ error: error && error.message ? error.message : 'Local analysis failed.' });
  }
});
