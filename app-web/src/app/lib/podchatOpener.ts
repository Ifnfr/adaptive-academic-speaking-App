import type { PodchatTopic, PodchatDifficulty } from "./podchat";

const TOPIC_OPENERS: Record<PodchatTopic, string[]> = {
  Economics: [
    "Welcome to Podchat. Let's discuss how everyday prices influence the choices people make. What example from daily life would you like to start with?",
    "Welcome to Podchat. Today we're exploring the impact of inflation on household budgets. How have you noticed prices changing recently?",
    "Welcome to Podchat. Let's talk about the concept of opportunity cost. What's a recent decision where you had to weigh trade-offs?"
  ],
  Technology: [
    "Welcome to Podchat. Let's explore how technology changes the way people study and work. Which technology trend feels most important to you right now?",
    "Welcome to Podchat. Today we're looking at the rise of artificial intelligence. How do you see AI impacting your field of interest?",
    "Welcome to Podchat. Let's discuss digital privacy. How concerned are you about the data collected by apps and websites you use daily?"
  ],
  "Philosophy & Ethics": [
    "Welcome to Podchat. Let's delve into the ethical implications of modern scientific advancements. What area of science do you think requires the most ethical oversight?",
    "Welcome to Podchat. Today we're discussing the concept of justice. How would you define a truly just society?",
    "Welcome to Podchat. Let's explore moral relativism versus objective truth. Do you believe some moral principles are universal?"
  ],
  "Science & Discovery": [
    "Welcome to Podchat. Let's discuss recent breakthroughs in space exploration. What recent discovery has fascinated you the most?",
    "Welcome to Podchat. Today we're talking about climate change mitigation strategies. Which approach do you think holds the most promise?",
    "Welcome to Podchat. Let's explore the role of science in shaping public policy. How much influence should scientific consensus have on government decisions?"
  ],
  "Education & Learning": [
    "Welcome to Podchat. Let's talk about the future of traditional universities. Do you think a college degree is as valuable today as it was in the past?",
    "Welcome to Podchat. Today we're discussing alternative education models. How effective do you think self-directed learning and online courses are?",
    "Welcome to Podchat. Let's explore the purpose of education. Should education focus primarily on career preparation or personal development?"
  ],
  "Society & Culture": [
    "Welcome to Podchat. Let's discuss the impact of social media on cultural norms. How has social media changed the way we interact with each other?",
    "Welcome to Podchat. Today we're talking about globalization and cultural identity. Do you think globalization is leading to a homogenization of cultures?",
    "Welcome to Podchat. Let's explore the changing role of art in society. What function does art serve in the modern world?"
  ],
  "Global Issues & Environment": [
    "Welcome to Podchat. Let's discuss international cooperation on environmental challenges. How effective do you think global climate agreements have been?",
    "Welcome to Podchat. Today we're talking about sustainable development. How can we balance economic growth with environmental protection?",
    "Welcome to Podchat. Let's explore the issue of resource depletion. What steps should we take to ensure resources are available for future generations?"
  ],
  "Daily Life & Casual Conversation": [
    "Welcome to Podchat! Let's just have a relaxed chat. What's something interesting that happened to you this week?",
    "Welcome to Podchat. I'd love to hear about your hobbies. What do you enjoy doing in your free time?",
    "Welcome to Podchat! Let's talk about travel. If you could visit any place in the world right now, where would it be and why?"
  ]
};

const EXPERT_OPENERS: Record<PodchatTopic, string[]> = {
  Economics: [
    "Welcome. To begin our rigorous examination of macroeconomic policy, could you articulate your perspective on the efficacy of quantitative easing in a high-inflation environment?",
  ],
  Technology: [
    "Welcome. Let us critically evaluate the socio-technical implications of decentralized architectures. What are the primary vulnerabilities you see in current blockchain implementations?",
  ],
  "Philosophy & Ethics": [
    "Welcome. I'd like us to deconstruct utilitarian approaches to contemporary moral dilemmas. What is the most significant flaw in applying a strict utilitarian calculus to global health policy?",
  ],
  "Science & Discovery": [
    "Welcome. Let's critically examine the methodology of recent longitudinal studies in epigenetics. Where do you see the most significant confounding variables in this research?",
  ],
  "Education & Learning": [
    "Welcome. Our focus today is a structural critique of modern pedagogy. How do standardized assessment frameworks systematically disadvantage marginalized cognitive profiles?",
  ],
  "Society & Culture": [
    "Welcome. Let's engage in a sociological analysis of late-stage capitalism. How do modern consumption patterns reflect deeper shifts in collective identity?",
  ],
  "Global Issues & Environment": [
    "Welcome. I want us to evaluate the geopolitical implications of transitioning to renewable energy grids. How will this shift alter traditional spheres of influence?",
  ],
  "Daily Life & Casual Conversation": [
    "Welcome. While our topic is daily life, let's explore the anthropological significance of our daily routines. How do your mundane habits reflect broader societal structures?",
  ]
};

export function getPodchatOpener(topic: PodchatTopic, difficulty: PodchatDifficulty, seed?: string): string {
  // Simple hash for seed
  let hash = 0;
  if (seed) {
    for (let i = 0; i < seed.length; i++) {
      hash = (hash << 5) - hash + seed.charCodeAt(i);
      hash |= 0;
    }
    hash = Math.abs(hash);
  }

  if (difficulty === "Expert") {
    const openers = EXPERT_OPENERS[topic];
    if (openers && openers.length > 0) {
      const index = seed ? hash % openers.length : Math.floor(Math.random() * openers.length);
      return openers[index];
    }
  }

  const openers = TOPIC_OPENERS[topic];
  if (openers && openers.length > 0) {
    const index = seed ? hash % openers.length : Math.floor(Math.random() * openers.length);
    return openers[index];
  }

  return "Welcome to Podchat. Let's start our conversation. What would you like to talk about today?";
}
