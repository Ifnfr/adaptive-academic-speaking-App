import type { PodchatTopic, PodchatDifficulty } from "./podchat";

const TOPIC_OPENERS: Record<PodchatTopic, string[]> = {
  Economics: [
    "Welcome to Podchat. Let's discuss how everyday prices influence the choices people make. What example from daily life would you like to start with?",
    "Welcome to Podchat. Today we're exploring the impact of inflation on household budgets. How have you noticed prices changing recently?",
    "Welcome to Podchat. Let's talk about the concept of opportunity cost. What's a recent decision where you had to weigh trade-offs?",
    "Welcome to Podchat. Today we are looking at the tools central banks use to control the money supply. How do changes in interest rates affect your own financial planning?",
    "Welcome to Podchat. Let's examine how shifting demographics and remote work are altering the job landscape. What changes have you observed in the career paths available in your field?",
    "Welcome to Podchat. We are discussing the widening gap between the wealthy and the poor in modern societies. What policies or initiatives do you believe could help reduce economic inequality?",
    "Welcome to Podchat. Today we are talking about globalization and international trade barriers. How do you think import tariffs impact the availability and cost of goods in your local market?",
    "Welcome to Podchat. Let's explore how psychological factors and cognitive biases influence financial decisions. What is a time you made an irrational purchase based on emotional marketing?",
    "Welcome to Podchat. We are focusing on the challenges developing nations face in building infrastructure and industry. What role should foreign aid or investment play in supporting these economies?",
    "Welcome to Podchat. Let's discuss how government spending and taxation levels affect economic growth. Do you think governments should run deficits to fund public services, or prioritize balancing the budget?"
  ],
  Technology: [
    "Welcome to Podchat. Let's explore how technology changes the way people study and work. Which technology trend feels most important to you right now?",
    "Welcome to Podchat. Today we're looking at the rise of artificial intelligence. How do you see AI impacting your field of interest?",
    "Welcome to Podchat. Let's discuss digital privacy. How concerned are you about the data collected by apps and websites you use daily?",
    "Welcome to Podchat. Today we are discussing how automation and robotics are replacing manual labor. What industries do you think will be most disrupted by these changes in the next decade?",
    "Welcome to Podchat. Let's talk about user ownership and control of personal information online. How comfortable are you with large corporations storing your browsing history on foreign servers?",
    "Welcome to Podchat. We are exploring the collaborative world of open-source software development. What benefits or drawbacks do you see when software code is made freely available to the public?",
    "Welcome to Podchat. Let's look at the growing threat of cyberattacks on individuals and governments. What steps do you personally take to keep your digital accounts secure?",
    "Welcome to Podchat. Today we are talking about biotechnology, such as genetic editing and cloning. What ethical boundaries do you believe researchers should respect in these fields?",
    "Welcome to Podchat. Let's discuss the digital divide and the unequal access to high-speed internet globally. What can governments do to ensure remote or low-income communities are not left behind technologically?",
    "Welcome to Podchat. We are examining how a few massive tech platforms dominate online search, shopping, and communication. Do you think these companies should be broken up to encourage competition?"
  ],
  "Philosophy & Ethics": [
    "Welcome to Podchat. Let's delve into the ethical implications of modern scientific advancements. What area of science do you think requires the most ethical oversight?",
    "Welcome to Podchat. Today we're discussing the concept of justice. How would you define a truly just society?",
    "Welcome to Podchat. Let's explore moral relativism versus objective truth. Do you believe some moral principles are universal?",
    "Welcome to Podchat. Today we are talking about free will and determinism. If all our actions are shaped by our biology and environment, to what extent can we be held morally responsible for our choices?",
    "Welcome to Podchat. Let's explore what makes you the same person over time despite physical and mental changes. Is identity defined by memory, consciousness, or something else entirely?",
    "Welcome to Podchat. We are discussing the social contract theory and our obligation to obey laws. Under what circumstances, if any, do you believe citizens have a moral right to rebel against their government?",
    "Welcome to Podchat. Let's discuss our duty to seek out truth and verify information. Is it morally wrong to hold beliefs without sufficient evidence, even if they don't harm anyone?",
    "Welcome to Podchat. Today we are exploring the moral status of non-human animals. Do you believe animals have rights similar to humans, or does our intelligence justify using them for food and research?",
    "Welcome to Podchat. Let's talk about finding meaning in a world without inherent purpose. How do you create meaning and value in your own life when faced with existential uncertainty?",
    "Welcome to Podchat. We are examining the balance between individual liberty and collective security. How much personal freedom should citizens be willing to sacrifice for public safety?"
  ],
  "Science & Discovery": [
    "Welcome to Podchat. Let's discuss recent breakthroughs in space exploration. What recent discovery has fascinated you the most?",
    "Welcome to Podchat. Today we're talking about climate change mitigation strategies. Which approach do you think holds the most promise?",
    "Welcome to Podchat. Let's explore the role of science in shaping public policy. How much influence should scientific consensus have on government decisions?",
    "Welcome to Podchat. Today we are discussing the role of genetics in determining health and behavior. How much of our personality and potential do you think is written in our DNA?",
    "Welcome to Podchat. Let's explore the mysterious deep ocean, much of which remains completely unexplored. What motivates us to spend billions exploring outer space when our own oceans are still a mystery?",
    "Welcome to Podchat. We are looking at how the brain processes emotions and memories. If science could map every neuron in your brain, do you think it would fully explain your conscious experiences?",
    "Welcome to Podchat. Let's discuss quantum mechanics and the strange behavior of particles at the subatomic level. How does the idea that particles can exist in multiple states at once challenge your view of reality?",
    "Welcome to Podchat. Today we are talking about global preparedness for future pandemics. What lessons do you think humanity should have learned from recent global health crises?",
    "Welcome to Podchat. Let's examine how scientific research is funded. Should governments prioritize funding projects with immediate practical applications, or support basic curiosity-driven research?",
    "Welcome to Podchat. We are discussing the reliability of the scientific peer review process. How can the scientific community prevent biased or incorrect research from being published and accepted as truth?"
  ],
  "Education & Learning": [
    "Welcome to Podchat. Let's talk about the future of traditional universities. Do you think a college degree is as valuable today as it was in the past?",
    "Welcome to Podchat. Today we're discussing alternative education models. How effective do you think self-directed learning and online courses are?",
    "Welcome to Podchat. Let's explore the purpose of education. Should education focus primarily on career preparation or personal development?",
    "Welcome to Podchat. Today we are discussing the importance of early childhood education. How do you think a child's environment before age five impacts their long-term learning ability?",
    "Welcome to Podchat. Let's talk about vocational training and trade schools. Do you think modern school systems focus too much on academic paths and not enough on practical skills?",
    "Welcome to Podchat. We are exploring how schools teach critical thinking versus memorization. What is one topic or skill you wish you had been taught how to analyze critically when you were in school?",
    "Welcome to Podchat. Let's discuss how children learn languages so easily compared to adults. What has been your biggest challenge in trying to acquire a new language later in life?",
    "Welcome to Podchat. Today we are focusing on how classrooms accommodate neurodiverse students, such as those with ADHD or autism. How can schools adapt their environments to support different learning styles?",
    "Welcome to Podchat. Let's examine how socioeconomic status affects access to quality education. What steps should be taken to ensure that children in poorer districts receive the same opportunities as those in wealthy areas?",
    "Welcome to Podchat. We are discussing the role of teachers versus technology in the classroom. Can digital tools and AI tutors ever replace the mentorship and emotional support of a human teacher?"
  ],
  "Society & Culture": [
    "Welcome to Podchat. Let's discuss the impact of social media on cultural norms. How has social media changed the way we interact with each other?",
    "Welcome to Podchat. Today we're talking about globalization and cultural identity. Do you think globalization is leading to a homogenization of cultures?",
    "Welcome to Podchat. Let's explore the changing role of art in society. What function does art serve in the modern world?",
    "Welcome to Podchat. Today we are looking at how rapid urbanization affects social connection and community. Do you think living in a busy city makes people feel more connected, or more isolated?",
    "Welcome to Podchat. Let's talk about the evolving expectations of gender roles in modern society. How have the roles of men and women changed in your community over the past generation?",
    "Welcome to Podchat. We are exploring the role of religion and secularism in public life. How should societies balance freedom of religious expression with the need for neutral public spaces?",
    "Welcome to Podchat. Let's discuss the challenges of an aging global population. How should communities adapt to support older citizens when birth rates are declining?",
    "Welcome to Podchat. Today we are talking about mental health awareness. What steps do you think are most important for reducing the social stigma around seeking therapy or treatment?",
    "Welcome to Podchat. Let's examine how immigration and multiculturalism shape national identity. How does your own community celebrate and integrate diverse cultural backgrounds?",
    "Welcome to Podchat. We are discussing the cultural divide between generations, such as Baby Boomers, Millennials, and Gen Z. What do you think is the biggest source of misunderstanding between older and younger people today?"
  ],
  "Global Issues & Environment": [
    "Welcome to Podchat. Let's discuss international cooperation on environmental challenges. How effective do you think global climate agreements have been?",
    "Welcome to Podchat. Today we're talking about sustainable development. How can we balance economic growth with environmental protection?",
    "Welcome to Podchat. Let's explore the issue of resource depletion. What steps should we take to ensure resources are available for future generations?",
    "Welcome to Podchat. Today we are looking at the global crisis of freshwater scarcity. What actions can individuals and local governments take to protect and conserve our water supplies?",
    "Welcome to Podchat. Let's discuss the rapid loss of animal and plant species worldwide. Why should we care about the extinction of lesser-known species, and what can be done to protect their habitats?",
    "Welcome to Podchat. We are exploring the concept of climate refugees—people forced to leave their homes due to rising sea levels or extreme weather. How should the international community prepare for this growing humanitarian challenge?",
    "Welcome to Podchat. Let's examine our global food supply chain and the environmental impact of agriculture. How can we feed a growing global population without further destroying the planet's ecosystems?",
    "Welcome to Podchat. Today we are talking about nuclear energy as a clean power source. Do you believe the benefits of nuclear energy outweigh the safety risks and the challenges of radioactive waste?",
    "Welcome to Podchat. Let's discuss carbon offsetting and carbon taxes. Do you think charging companies for their greenhouse gas emissions is an effective way to slow down global warming?",
    "Welcome to Podchat. We are focusing on the role of indigenous communities in protecting natural environments. What can modern environmental movements learn from traditional methods of land stewardship?"
  ],
  "Daily Life & Casual Conversation": [
    "Welcome to Podchat! Let's just have a relaxed chat. What's something interesting that happened to you this week?",
    "Welcome to Podchat. I'd love to hear about your hobbies. What do you enjoy doing in your free time?",
    "Welcome to Podchat! Let's talk about travel. If you could visit any place in the world right now, where would it be and why?",
    "Welcome to Podchat! Let's talk about cooking and food culture. Do you prefer eating out at restaurants or preparing meals at home, and what is your favorite dish to cook?",
    "Welcome to Podchat! Let's discuss the role of music in your daily life. How does your favorite playlist affect your mood, and what genre of music do you listen to most?",
    "Welcome to Podchat! Today we are talking about sports and physical activity. Do you prefer playing sports, watching them, or just staying active in other ways, and why?",
    "Welcome to Podchat. Let's explore the meaning of close friendships. How do you maintain connections with friends when life gets busy, and what qualities do you value most in a friend?",
    "Welcome to Podchat! Today we're looking at local communities and neighborhoods. How involved are you in your local community, and what is your favorite spot in your town?",
    "Welcome to Podchat! Let's talk about books and reading habits. Do you prefer physical books, e-readers, or audiobooks, and what is a book that has had a significant impact on you?",
    "Welcome to Podchat! Let's discuss your personal goals and future aspirations. Where do you see yourself in five years, and what steps are you currently taking to get there?"
  ]
};

const EXPERT_OPENERS: Record<PodchatTopic, string[]> = {
  Economics: [
    "Welcome. To begin our rigorous examination of macroeconomic policy, could you articulate your perspective on the efficacy of quantitative easing in a high-inflation environment?",
    "Welcome to Podchat. Let us analyze the structural shifts in contemporary labor markets, specifically the rise of monopsonistic competition. How does employer concentration affect wage elasticity and collective bargaining power?",
    "Welcome to Podchat. Let's engage with Thomas Piketty's thesis on wealth inequality, specifically the relationship where the rate of return on capital exceeds economic growth. What fiscal mechanisms are most viable to mitigate this systemic imbalance?",
    "Welcome to Podchat. Today we are evaluating the validity of the Heckscher-Ohlin model of international trade under modern conditions of capital mobility. To what extent does empirical evidence support the Stolper-Samuelson theorem in post-industrial economies?",
    "Welcome to Podchat. Let's deconstruct the classical assumption of rational expectations using behavioral models of bounded rationality. How do systemic cognitive biases undermine the market efficiency hypothesis in financial asset pricing?",
    "Welcome to Podchat. Let's examine the policy coordination problems between independent monetary authorities and expansionary fiscal departments. What are the macroprudential implications of running persistent fiscal deficits when interest rates reside near the zero lower bound?"
  ],
  Technology: [
    "Welcome. Let us critically evaluate the socio-technical implications of decentralized architectures. What are the primary vulnerabilities you see in current blockchain implementations?",
    "Welcome to Podchat. Let us dissect the socio-economic ramifications of technological unemployment driven by advanced machine learning models. How should public policy adapt to a structural decline in the demand for cognitive labor?",
    "Welcome to Podchat. Let's analyze the concept of surveillance capitalism and the commodification of behavioral surplus. How do current regulatory frameworks like GDPR fail to address the asymmetries of corporate data aggregation?",
    "Welcome to Podchat. Today we are investigating cryptographic security protocols in the era of quantum computing. What are the primary challenges in transitioning to post-quantum cryptography before RSA encryption becomes obsolete?",
    "Welcome to Podchat. Let us critically examine the bioethical discourse surrounding somatic versus germline CRISPR gene editing. Where do you draw the distinction between therapeutic intervention and genetic enhancement?",
    "Welcome to Podchat. Let's explore the dynamics of network externalities and two-sided platform markets in establishing natural monopolies. How do proprietary API ecosystems limit interoperability and suppress competitive innovation?"
  ],
  "Philosophy & Ethics": [
    "Welcome. I'd like us to deconstruct utilitarian approaches to contemporary moral dilemmas. What is the most significant flaw in applying a strict utilitarian calculus to global health policy?",
    "Welcome to Podchat. Let us evaluate the philosophical implications of Libet's neuroscientific experiments on voluntary action. To what extent do these findings undermine classical libertarian accounts of free will?",
    "Welcome to Podchat. Let's examine Derek Parfit's reductionist view of personal identity, particularly his teletransportation thought experiment. Does survival require the preservation of physical continuity, or is psychological connectedness sufficient?",
    "Welcome to Podchat. We are critiquing John Rawls's concept of the original position and the veil of ignorance. How effectively does this heuristic address systemic historical injustices in distributing primary social goods?",
    "Welcome to Podchat. Let's discuss the intersection of virtue epistemology and epistemic injustice, specifically testimonial versus hermeneutical injustice. How can dominant epistemic communities systematically devalue the credibility of marginalized speakers?",
    "Welcome to Podchat. Let's analyze Jean-Paul Sartre's concept of bad faith and existential dread. How does the phenomenology of choice manifest when individuals attempt to escape their radical freedom through social roles?"
  ],
  "Science & Discovery": [
    "Welcome. Let's critically examine the methodology of recent longitudinal studies in epigenetics. Where do you see the most significant confounding variables in this research?",
    "Welcome to Podchat. Let us discuss the biogeochemical processes governing hydrothermal vent ecosystems. What are the thermodynamic implications of chemosynthesis for our understanding of abiogenesis?",
    "Welcome to Podchat. Let's examine the integrated information theory of consciousness, or IIT. How does this mathematical framework resolve the hard problem of consciousness compared to traditional physicalism?",
    "Welcome to Podchat. Today we are evaluating the philosophical implications of Bell's theorem and the experimental violation of local realism. Which interpretation of quantum mechanics best reconciles non-locality with special relativity?",
    "Welcome to Podchat. Let us analyze the structural incentives leading to publication bias and the replication crisis in the behavioral sciences. How can preregistration of study designs alter the p-hacking behavior of researchers?",
    "Welcome to Podchat. Let's discuss the debate between adaptationist programs and neutral theory in evolutionary biology. To what extent does genetic drift, rather than natural selection, account for genomic diversity at the molecular level?"
  ],
  "Education & Learning": [
    "Welcome. Our focus today is a structural critique of modern pedagogy. How do standardized assessment frameworks systematically disadvantage marginalized cognitive profiles?",
    "Welcome to Podchat. Let us examine Jean Piaget's stages of cognitive development versus Lev Vygotsky's sociocultural theory. How does the zone of proximal development manifest in collaborative peer interactions?",
    "Welcome to Podchat. Let's analyze Paulo Freire's critique of the banking model of education. How does dialogical pedagogy foster critical consciousness in students compared to traditional instructional methods?",
    "Welcome to Podchat. Today we are evaluating Noam Chomsky's universal grammar hypothesis versus connectionist models of language acquisition. How does the poverty of the stimulus argument hold up against deep learning natural language processing?",
    "Welcome to Podchat. Let us discuss Pierre Bourdieu's concept of cultural capital and its reproduction through formal educational institutions. In what ways do school curricula validate dominant class dispositions while marginalizing others?",
    "Welcome to Podchat. Let's analyze the relationship between working memory capacity, intrinsic cognitive load, and instructional design for neurodivergent learners. How can educators optimize schema acquisition without overloading executive functions?"
  ],
  "Society & Culture": [
    "Welcome. Let's engage in a sociological analysis of late-stage capitalism. How do modern consumption patterns reflect deeper shifts in collective identity?",
    "Welcome to Podchat. Let us analyze the spatial segregation and capital accumulation dynamics of urban gentrification. How do local housing policies fail to mitigate the displacement of low-income populations?",
    "Welcome to Podchat. Let's discuss Charles Taylor's critique of the secularization thesis in A Secular Age. How has the emergence of the immanent frame altered the search for transcendent meaning in pluralistic societies?",
    "Welcome to Podchat. Today we are evaluating the biopolitical implications of shifting demographic dependency ratios in post-industrial states. How does the economic pressure on pension and healthcare systems reshape state valuation of senior life?",
    "Welcome to Podchat. Let us critique the assimilationist versus multicultural models of immigrant integration using Homi Bhabha's concept of cultural hybridity. How does the third space challenge state-constructed narratives of national identity?",
    "Welcome to Podchat. Let's analyze how generation-specific habitus, shaped by distinct economic and technological environments, creates conflicting class consciousness. How does this manifest in debates over housing equity and environmental policy?"
  ],
  "Global Issues & Environment": [
    "Welcome. I want us to evaluate the geopolitical implications of transitioning to renewable energy grids. How will this shift alter traditional spheres of influence?",
    "Welcome to Podchat. Let us analyze the geopolitical concept of hydro-hegemony in transboundary river basins. How do upstream dam projects alter the security and agricultural stability of downstream nations?",
    "Welcome to Podchat. Let's evaluate the valuation of ecosystem services within ecological economics. How do traditional GDP metrics fail to account for the depreciation of natural capital and biodiversity loss?",
    "Welcome to Podchat. Today we are examining the status of climate-induced displaced persons under international law. What are the primary legal obstacles to extending the 1951 Refugee Convention status to environmental migrants?",
    "Welcome to Podchat. Let us critically evaluate the industrial food system through the lens of metabolic rift. How can agroecological transitions address the disruption of global nitrogen and phosphorus cycles?",
    "Welcome to Podchat. Let's dissect the efficacy of Article 6 of the Paris Agreement regarding international carbon markets. To what extent do carbon offsets risk greenwashing and double-counting without robust verification mechanisms?"
  ],
  "Daily Life & Casual Conversation": [
    "Welcome. While our topic is daily life, let's explore the anthropological significance of our daily routines. How do your mundane habits reflect broader societal structures?",
    "Welcome to Podchat. Let us analyze the sociological concept of foodways and culinary identity. How does the choice of ingredients and cooking techniques serve as a marker of social distinction and class?",
    "Welcome to Podchat. Let's explore the cognitive and cultural dimensions of music perception. How do specific tonal systems and rhythmic patterns shape the emotional response and collective memory of a community?",
    "Welcome to Podchat. Today we are evaluating the role of professional sports as a modern form of civic ritual. How do corporate sponsorships and athletic performance metrics reflect broader capitalist ideologies of optimization?",
    "Welcome to Podchat. Let us dissect the concept of social capital, specifically the distinction between bonding and bridging social capital in modern friendships. How have digital communication platforms altered the density of these networks?",
    "Welcome to Podchat. Let's analyze the concept of the third place, as defined by Ray Oldenburg. How does the decline of accessible, non-commercial public spaces impact the social cohesion and political engagement of a local neighborhood?"
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
