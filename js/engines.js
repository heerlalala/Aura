// Aura Core AI Engines Simulator

const auraEngines = {
  
  // Scans for extreme emotional distress or crisis keywords
  detectCrisis: function(text) {
    const crisisKeywords = [
      "hurt myself", "end it all", "don't want to live", "want to die", 
      "kill myself", "self harm", "suicide", "ending my life", "hate my life"
    ];
    const lower = text.toLowerCase();
    return crisisKeywords.some(keyword => lower.includes(keyword));
  },

  // Parse conversations line-by-line to extract speakers and calculate scores
  analyzeChat: function(rawText) {
    const lines = rawText.split('\n').filter(l => l.trim().includes(':'));
    if (lines.length === 0) {
      // Fallback/Default mock output if text isn't dialogue
      return this.getDefaultAnalysis();
    }

    const participants = [];
    const messages = [];

    // Extract speakers
    lines.forEach(line => {
      const parts = line.split(':');
      const sender = parts[0].trim();
      const text = parts.slice(1).join(':').trim();
      
      if (sender && text) {
        messages.push({ sender, text });
        if (!participants.includes(sender)) {
          participants.push(sender);
        }
      }
    });

    // We assume the first speaker is the "User" (Alex) and the second is the "Partner" (Taylor)
    const user = participants[0] || "Alex";
    const partner = participants[1] || "Taylor";

    // Effort metrics
    let userWordCount = 0;
    let userMsgCount = 0;
    let partnerWordCount = 0;
    let partnerMsgCount = 0;

    // Flag keywords
    const redFlagWords = ["always", "never", "selfish", "whatever", "fine", "screwed", "blaming", "shutting down", "ignore", "annoying", "tired of you"];
    const greenFlagWords = ["feel", "understand", "appreciate", "sorry", "thank you", "let's", "space", "agree", "calm", "love"];

    const redFlagsDetected = [];
    const greenFlagsDetected = [];

    // Tone analysis parameters
    let userAnxiety = 10;
    let userAnger = 10;
    let userSecure = 20;
    let partnerAvoidance = 10;
    let partnerAnger = 10;
    let partnerSecure = 20;

    messages.forEach(msg => {
      const textLower = msg.text.toLowerCase();
      const words = msg.text.split(/\s+/).length;

      // Classify Red Flags
      redFlagWords.forEach(flag => {
        if (textLower.includes(flag)) {
          redFlagsDetected.push({
            speaker: msg.sender,
            text: msg.text,
            flag: flag,
            reason: `Use of absolute language ('${flag}') triggers defensiveness.`
          });
        }
      });

      // Classify Green Flags
      greenFlagWords.forEach(flag => {
        if (textLower.includes(flag)) {
          greenFlagsDetected.push({
            speaker: msg.sender,
            text: msg.text,
            flag: flag,
            reason: `Vulnerability phrasing ('${flag}') opens communication pathways.`
          });
        }
      });

      if (msg.sender === user) {
        userWordCount += words;
        userMsgCount++;
        // Calculate anxiety & anger triggers
        if (textLower.includes('?') || textLower.includes('why') || textLower.includes('reply')) userAnxiety += 25;
        if (textLower.includes('!') || textLower.includes('selfish') || textLower.includes('always')) userAnger += 30;
        if (textLower.includes('feel') || textLower.includes('understand') || textLower.includes('sorry')) userSecure += 30;
      } else {
        partnerWordCount += words;
        partnerMsgCount++;
        // Calculate avoidance & anger triggers
        if (textLower.includes('busy') || textLower.includes('leave') || textLower.includes('space') || textLower.includes('ignore')) partnerAvoidance += 35;
        if (textLower.includes('fight') || textLower.includes('sarcastic') || textLower.includes('never')) partnerAnger += 25;
        if (textLower.includes('agree') || textLower.includes('appreciate') || textLower.includes('love')) partnerSecure += 30;
      }
    });

    // Normalize scores (0-100 scale)
    userAnxiety = Math.min(100, userAnxiety);
    userAnger = Math.min(100, userAnger);
    userSecure = Math.min(100, userSecure);
    partnerAvoidance = Math.min(100, partnerAvoidance);
    partnerAnger = Math.min(100, partnerAnger);
    partnerSecure = Math.min(100, partnerSecure);

    const totalWordCount = userWordCount + partnerWordCount;
    const userEffortPercent = totalWordCount > 0 ? Math.round((userWordCount / totalWordCount) * 100) : 50;
    const partnerEffortPercent = 100 - userEffortPercent;

    // Trust, Defensiveness, Vulnerability indexes
    const averageSecurity = (userSecure + partnerSecure) / 2;
    const averageFriction = (userAnger + partnerAnger) / 2;
    
    const trustIndex = Math.max(30, Math.round(averageSecurity - (averageFriction * 0.3)));
    const vulnerabilityIndex = Math.max(20, Math.round((userSecure + partnerAvoidance) / 2));
    const defensivenessIndex = Math.max(10, Math.round(averageFriction));

    // Harmony Score formula
    const harmonyScore = Math.max(20, Math.round(100 - (userAnxiety * 0.2) - (averageFriction * 0.4) - (Math.abs(50 - userEffortPercent) * 0.5)));

    // Conflict Urgency
    let urgency = "Low";
    let urgencyDesc = "Analysis detects low levels of defensive friction. Communication is collaborative.";
    if (defensivenessIndex > 65 || averageFriction > 60) {
      urgency = "High";
      urgencyDesc = "High defensive escalations detected. Suggesting immediate cooling-off periods.";
    } else if (defensivenessIndex > 40 || averageFriction > 35) {
      urgency = "Medium";
      urgencyDesc = "Moderate friction. Vulnerability is restricted. Guarded stances detected.";
    }

    // Determine primary trigger
    let primaryTrigger = "Communication Gap";
    if (rawText.toLowerCase().includes("reply") || rawText.toLowerCase().includes("text")) {
      primaryTrigger = "Delayed Responses";
    } else if (rawText.toLowerCase().includes("clean") || rawText.toLowerCase().includes("chore") || rawText.toLowerCase().includes("work")) {
      primaryTrigger = "Chore & Task Distribution";
    } else if (rawText.toLowerCase().includes("always") || rawText.toLowerCase().includes("never")) {
      primaryTrigger = "Absolute Accusations";
    }

    // Shorten lists to top 4 unique items for UI layout cleanliness
    const uniqueRedFlags = Array.from(new Set(redFlagsDetected.map(a => JSON.stringify(a)))).map(a => JSON.parse(a)).slice(0, 4);
    const uniqueGreenFlags = Array.from(new Set(greenFlagsDetected.map(a => JSON.stringify(a)))).map(a => JSON.parse(a)).slice(0, 4);

    return {
      user,
      partner,
      harmonyScore,
      userEffortPercent,
      partnerEffortPercent,
      trustIndex,
      vulnerabilityIndex,
      defensivenessIndex,
      urgency,
      urgencyDesc,
      primaryTrigger,
      userTones: {
        Anxiety: userAnxiety,
        Anger: userAnger,
        Secure: userSecure
      },
      partnerTones: {
        Avoidance: partnerAvoidance,
        Anger: partnerAnger,
        Secure: partnerSecure
      },
      redFlags: uniqueRedFlags,
      greenFlags: uniqueGreenFlags
    };
  },

  // Mock analysis in case parser input is invalid or initial load
  getDefaultAnalysis: function() {
    return {
      user: "Alex",
      partner: "Taylor",
      harmonyScore: 78,
      userEffortPercent: 52,
      partnerEffortPercent: 48,
      trustIndex: 74,
      vulnerabilityIndex: 60,
      defensivenessIndex: 45,
      urgency: "Medium",
      urgencyDesc: "Moderate friction. Communication displays signs of mutual anxiety.",
      primaryTrigger: "Communication Gap",
      userTones: { Anxiety: 40, Anger: 30, Secure: 70 },
      partnerTones: { Avoidance: 50, Anger: 25, Secure: 65 },
      redFlags: [
        { speaker: "Alex", text: "You always ignore me.", flag: "always", reason: "Absolute statement creates defensiveness." }
      ],
      greenFlags: [
        { speaker: "Taylor", text: "I appreciate you making time.", flag: "appreciate", reason: "Affirmation builds trust loops." }
      ]
    };
  },

  // Reality Check text generator based on scores
  generateRealityCheck: function(analysis, straightAnswerMode) {
    if (straightAnswerMode) {
      // Brutally honest evaluation
      let assessment = `**Reality Check Console (Straight-Answer Mode ACTIVE)**\n\n`;
      
      if (analysis.harmonyScore < 50) {
        assessment += `🚨 **The Verdict:** This interaction is highly toxic and unproductive. You both are speaking to defend yourselves, not to connect. \n\n`;
      } else if (analysis.harmonyScore < 75) {
        assessment += `⚠️ **The Verdict:** You are caught in a classic pursue-withdraw pattern. The conversation isn't completely broken, but you are walking on eggshells.\n\n`;
      } else {
        assessment += `✅ **The Verdict:** Excellent. This dialogue displays high emotional maturity. You are resolving conflicts as teammates rather than opponents.\n\n`;
      }

      assessment += `🔍 **Hard Truths:**\n`;
      
      // Analyze User (Alex)
      if (analysis.userTones.Anxiety > 50) {
        assessment += `- **You (${analysis.user})** are suffocating the conversation. Your anxiety-driven rapid fire texts ('always', 'never') are actively pushing ${analysis.partner} away. You are demanding validation rather than asking for connection.\n`;
      } else if (analysis.userTones.Anger > 50) {
        assessment += `- **You (${analysis.user})** are using passive-aggressive sarcasm. Sarcasm is emotional cowardice; state what you need directly instead of taking cheap jabs.\n`;
      } else {
        assessment += `- **You (${analysis.user})** have remained relatively stable, but you need to hold your boundaries without apologizing for them.\n`;
      }

      // Analyze Partner (Taylor)
      if (analysis.partnerTones.Avoidance > 50) {
        assessment += `- **${analysis.partner}** is stonewalling you. Putting their phone in another room or ignoring texts is an escape hatch to avoid vulnerability. They are refusing to co-regulate with you.\n`;
      } else if (analysis.partnerTones.Anger > 50) {
        assessment += `- **${analysis.partner}** is acting defensive and deflective. Instead of addressing the core issue, they are weaponizing their workload to make you feel guilty for asking for connection.\n`;
      } else {
        assessment += `- **${analysis.partner}** is demonstrating secure listening behaviors, but still displays anxiety under pressure.\n`;
      }

      return assessment;
    } else {
      // Soft, encouraging coaching tone
      let assessment = `**Relationship Coach Consultation**\n\n`;
      assessment += `This session shows that you both deeply care about this relationship, but are currently experiencing a slight bump in communication style alignment.\n\n`;
      assessment += `**Points of Growth:**\n`;
      assessment += `- **For You:** Focus on expressing your needs gently using 'I' statements. Instead of centering on what ${analysis.partner} isn't doing, focus on what would make you feel supported.\n`;
      assessment += `- **For ${analysis.partner}:** Encourage them to share when they are feeling overwhelmed early in the day, so their eventual need for quiet space doesn't feel like sudden withdrawal to you.`;
      return assessment;
    }
  },

  // Translates highly reactive drafts into clean emotional boundaries
  translateBoundary: function(inputText) {
    const textLower = inputText.toLowerCase();
    
    if (textLower.includes("always ignore") || textLower.includes("don't talk") || textLower.includes("never reply")) {
      return "I notice we've gone a few hours without speaking. I feel anxious when we lose contact. Let me know when you have 10 minutes to check in tonight so I can plan my evening.";
    }
    
    if (textLower.includes("selfish") || textLower.includes("only think of yourself") || textLower.includes("my job again")) {
      return "I am feeling overwhelmed with keeping up with our shared chores. I need us to divide the kitchen duties more evenly. Can we set aside 10 minutes this evening to figure out a schedule that works for both of us?";
    }
    
    if (textLower.includes("whatever") || textLower.includes("fine") || textLower.includes("don't care")) {
      return "I feel overloaded by how this discussion is going and I can tell you are stressed too. I want to resolve this, but I need a 20-minute break to calm down before we continue talking.";
    }

    // Default general translation framework
    return "I'm sharing this because our relationship is a priority for me. When [Action] occurs, I feel [Emotion]. Going forward, I would appreciate it if we could [Constructive Proposal]. Let's discuss if this works for you.";
  },

  // Simulator Outcome Predictor: rates the quality of a message
  predictOutcome: function(messageText) {
    const textLower = messageText.toLowerCase();
    
    let positive = 50;
    let defensive = 30;
    let withdrawal = 20;
    let alertText = "Your message tone is neutral. Expand details to see predictions.";
    let advice = "Try to avoid absolute words like 'always' or 'never' which immediately put people on the defensive.";

    if (textLower.includes("i feel") || textLower.includes("understand") || textLower.includes("appreciate")) {
      positive = 85;
      defensive = 10;
      withdrawal = 5;
      alertText = "✨ Optimal phrasing! High probability of collaborative response.";
      advice = "By using an 'I' statement and validating their perspective, you have lowered the emotional stakes significantly.";
    } else if (textLower.includes("you always") || textLower.includes("selfish") || textLower.includes("lazy")) {
      positive = 15;
      defensive = 75;
      withdrawal = 10;
      alertText = "⚠️ Danger: Accusatory phrasing likely to cause immediate retaliation.";
      advice = "This sentence starts with a blame statement. Rephrase to focus purely on your personal feelings or observation.";
    } else if (textLower.includes("fine") || textLower.includes("whatever") || textLower.includes("don't bother") || textLower.includes("forget it")) {
      positive = 10;
      defensive = 30;
      withdrawal = 60;
      alertText = "⚠️ Warning: Avoidant trigger detected. Partner likely to withdraw or stonewall.";
      advice = "Shutting down the conversation sarcastically is an avoidant trigger. State that you need space directly instead of using passive-aggressive closures.";
    }

    return {
      positive,
      defensive,
      withdrawal,
      alertText,
      advice
    };
  }
};
