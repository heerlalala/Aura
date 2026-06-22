// Aura Application Data Store

const auraData = {
  // Sample Conversations for Parser demo
  samples: {
    anxious: `Alex: Why haven't you replied all day?
Taylor: I was in meetings, I told you that.
Alex: It takes 5 seconds to send a text. You are ignoring me.
Taylor: I'm not ignoring you, I'm just busy. Let's not do this now.
Alex: Do what? Ask to be treated like a priority?
Taylor: You always pick fights when I'm stressed. I need some space.
Alex: Oh, of course, shut down again. You never want to work through anything.
Taylor: I'm leaving my phone in the other room. Bye.`,

    passive: `Alex: Are you planning to help clean up the kitchen, or is that my job again?
Taylor: I literally washed a plate this morning.
Alex: Oh wow, a whole plate! My hero.
Taylor: You don't have to be so sarcastic. I've been working 10-hour days.
Alex: We both work. But somehow I manage to make dinner and clean up while you relax.
Taylor: Fine, I'll do it later. Happy?
Alex: No, don't worry about it. I'll just do it myself like always.`,

    secure: `Alex: Hey, I noticed we haven't spent much time together this week. I'm feeling a bit disconnected.
Taylor: Hey! I know, it's been a crazy week at work. I've been exhausted.
Alex: I understand you're tired. Can we schedule a movie night or just dinner this weekend? It would help me feel more connected.
Taylor: That sounds really nice. Let's block off Saturday night. I'll order our favorite food.
Alex: Thank you, I really appreciate you making time for us. Let's do that.
Taylor: Me too. Thanks for telling me how you feel without blaming me.`
  },

  // Personal Growth Hub Courses
  courses: {
    eq: {
      title: "Emotional Intelligence",
      lessons: [
        {
          id: "eq_1",
          title: "Identifying Your Emotional Triggers",
          body: "An emotional trigger is any topic or event that prompts a strong, immediate negative emotional response. In relationships, triggers often stem from past neglect or unresolved conflicts. When triggered, your logical brain (prefrontal cortex) is hijacked by your emotional center (amygdala).\n\n**Exercise:** Write down the last time you felt suddenly defensive or angry with your partner. Identify the underlying fear. Was it a fear of abandonment, rejection, or control?"
        },
        {
          id: "eq_2",
          title: "The 90-Second Rule of Self-Regulation",
          body: "When you are emotionally triggered, a chemical surge of adrenaline and cortisol floods your body. Neurologist Jill Bolte Taylor discovered that this chemical process takes exactly 90 seconds to flush through your system.\n\nIf you remain angry or anxious after 90 seconds, it is because you are fueling the physiological response with your thoughts. Next time you feel triggered, wait 90 seconds before typing a response. Breathe deeply, feel the physical sensation, and let it pass."
        },
        {
          id: "eq_3",
          title: "Mindfulness and Emotional Hijacking",
          body: "To prevent emotional hijacking, practice 'labelling'. Instead of saying 'You are making me crazy,' say to yourself 'I am feeling a sensation of frustration in my chest right now.' By labelling the emotion, you activate your logical prefrontal cortex, which dampens the amygdala's fight-or-flight distress signal."
        }
      ]
    },
    boundaries: {
      title: "Boundary Development",
      lessons: [
        {
          id: "bound_1",
          title: "What is a Healthy Boundary?",
          body: "A boundary is not an ultimatum to control someone else's behavior (e.g., 'You are not allowed to go out'). A boundary is a statement of what *you* will do to protect your peace (e.g., 'I want to talk, but if you raise your voice, I will exit the room').\n\nBoundaries protect your energy and prevent resentment. They are the key to mutual respect in any relationship."
        },
        {
          id: "bound_2",
          title: "Breaking Codependent Patterns",
          body: "Codependency occurs when your sense of self-worth is entirely tied to your partner's emotional state. If they are unhappy, you feel compelled to fix it immediately, often sacrificing your own boundaries.\n\n**Practice:** Next time your partner is in a bad mood, repeat this mantra: 'Their mood is theirs to carry. I can support them, but I do not need to absorb their stress.'"
        },
        {
          id: "bound_3",
          title: "Stating a Boundary Cleanly",
          body: "To state a boundary cleanly, use the three-part framework:\n1. State the observation: 'When we raise our voices during discussions...'\n2. State your boundary: '...I need to take a 20-minute break to cool down.'\n3. State the consequence/action: 'If we can't lower our voices, I will step outside.'"
        }
      ]
    },
    comm: {
      title: "Healthy Communication",
      lessons: [
        {
          id: "comm_1",
          title: "Using 'I' Statements vs. 'You' Statements",
          body: "Starting sentences with 'You' (e.g., 'You always ignore me') immediately triggers defensiveness in the listener because it sounds like an accusation. Starting with 'I' (e.g., 'I feel lonely when we go a day without talking') focuses on your experience rather than blaming them.\n\n**Framework:** 'I feel [emotion] when [action] occurs. I would appreciate it if we could [constructive request].'"
        },
        {
          id: "comm_2",
          title: "The Art of Active Listening",
          body: "Most people listen to reply, not to understand. Active listening means summarizing your partner's position before stating yours.\n\n**Practice:** Use phrases like: 'What I hear you saying is that you feel overwhelmed by your workload, and my questions feel like extra pressure. Is that correct?' Only when they agree should you state your perspective."
        },
        {
          id: "comm_3",
          title: "De-escalation Techniques in Heat",
          body: "When a conversation escalates, do not match the volume or speed of your partner. Slow your speech pattern down, lower your tone, and acknowledge their distress: 'I see that you are really upset right now. I want to hear what you have to say, but let's take a deep breath first.'"
        }
      ]
    }
  },

  // Daily Reflective Prompts
  journalPrompts: [
    "What boundary did you struggle to express clearly this week?",
    "When did you feel emotionally triggered today, and what underlying need was unmet?",
    "How did you handle conflict in your household growing up, and how does that affect you now?",
    "Write about a recent message you wanted to send in anger, but chose to rephrase.",
    "What is one thing your partner did recently that made you feel safe and appreciated?",
    "List three qualities you bring to a relationship that you are proud of."
  ],

  // Mock Advice Responses
  adviceTemplates: {
    anxious: {
      actions: [
        "Take a 15-minute screen break before sending follow-up messages.",
        "Replace accusatory texts with a simple check-in: 'Hope your day is going well! Let's chat when you are free.'",
        "Practice self-regulation: journal your anxious thoughts rather than texting them."
      ],
      patterns: [
        "Pursuit-Withdrawal Loop: High frequency texting when partner is unresponsive.",
        "Reassurance Seeking: Needing immediate confirmation of relationship safety."
      ]
    },
    passive: {
      actions: [
        "State your needs directly: 'I'm tired and could use some help cleaning the kitchen.'",
        "Avoid sarcasm; it acts as an emotional divider.",
        "Schedule weekly chore reviews to prevent resentment buildup."
      ],
      patterns: [
        "Passive-Aggression: Using sarcasm to express disappointment instead of speaking directly.",
        "Resentment accumulation: Keeping score of efforts rather than communicating."
      ]
    },
    secure: {
      actions: [
        "Acknowledge and validate your partner's efforts during planning.",
        "Keep doing weekly check-ins; they are highly effective.",
        "Maintain clarity in stating feelings without assigning blame."
      ],
      patterns: [
        "Collaborative Problem Solving: Focusing on scheduling options together.",
        "Assertive boundary setting with high safety indicators."
      ]
    }
  }
};
