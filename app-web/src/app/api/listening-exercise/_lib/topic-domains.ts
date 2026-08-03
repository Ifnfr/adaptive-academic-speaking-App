export interface TopicDomain {
  id: string;
  label: string;
  subtopics: string[];
}

export const TOPIC_DOMAINS: TopicDomain[] = [
  {
    id: "environmental-science-sustainability",
    label: "Environmental Science & Sustainability",
    subtopics: [
      "Urban Vertical Farming Systems",
      "Ocean Acidification and Coral Reef Ecosystems",
      "Renewable Energy Storage in Grid Microgrids",
      "Reforestation and Carbon Sequestration Tech",
      "Deforestation and Local Microclimates",
      "Plastic Waste Recycling Innovations",
    ],
  },
  {
    id: "history",
    label: "History",
    subtopics: [
      "The Construction of the Transatlantic Telegraph Cable",
      "Agricultural Breakthroughs in Ancient Mesopotamia",
      "The Development of Early Printing Presses",
      "Silk Road Trade Routes and Cultural Exchange",
      "The Evolution of Navigational Instruments",
      "Maritime Trade Networks in the Renaissance",
    ],
  },
  {
    id: "technology-innovation",
    label: "Technology & Innovation",
    subtopics: [
      "Autonomous Electric Public Transit Vehicles",
      "Additive Manufacturing in Aerospace Engineering",
      "Smart Grid Systems for Energy Distribution",
      "Quantum Computing Foundations and Encryption",
      "Sensor Networks in Precision Agriculture",
      "Biometric Authentication in Mobile Security",
    ],
  },
  {
    id: "business-economics",
    label: "Business & Economics",
    subtopics: [
      "Microfinance and Small Business Growth",
      "Supply Chain Optimization in Global Logistics",
      "The Sharing Economy and Modern Consumer Behavior",
      "Corporate Sustainability Reporting Standards",
      "Digital Currencies and Central Bank Policies",
      "E-Commerce Logistics and Last-Mile Delivery",
    ],
  },
  {
    id: "health-medicine",
    label: "Health & Medicine",
    subtopics: [
      "The Biology of Human Sleep Cycles",
      "Targeted Drug Delivery Systems in Oncology",
      "Cardiovascular Fitness and Metabolic Health",
      "Vaccine Development and mRNA Technology",
      "Nutritional Biochemistry and Gut Microbiota",
      "Telemedicine Innovations in Rural Healthcare",
    ],
  },
  {
    id: "psychology-human-behavior",
    label: "Psychology & Human Behavior",
    subtopics: [
      "Cognitive Biases in Decision Making",
      "The Neural Mechanisms of Habit Formation",
      "Emotional Intelligence in Leadership Development",
      "Language Acquisition in Early Childhood",
      "The Psychology of Time Perception",
      "Social Influence and Group Conformity Dynamics",
    ],
  },
  {
    id: "arts-culture",
    label: "Arts & Culture",
    subtopics: [
      "Acoustic Architecture in Ancient Amphitheaters",
      "The Conservation of Oil Paintings in Museums",
      "The Evolution of Cinematic Sound Design",
      "Folk Music Preservation and Digital Archiving",
      "Architectural Design of Modern Sustainable Buildings",
      "The History and Evolution of Typography",
    ],
  },
  {
    id: "society-politics",
    label: "Society & Politics",
    subtopics: [
      "Urban Planning for Walkable Cities",
      "Public Library Systems as Community Hubs",
      "Civic Education Programs in Secondary Schools",
      "The History of Public Parks and Green Spaces",
      "Community Emergency Preparedness Frameworks",
      "Demographic Shifts and Urban Housing Demand",
    ],
  },
  {
    id: "space-physical-science",
    label: "Space & Physical Science",
    subtopics: [
      "Exoplanet Detection Methods in Astrophysics",
      "The Formation of Solar System Gas Giants",
      "Satellite Radar Technology for Earth Observation",
      "Subatomic Particle Physics and Accelerators",
      "The Thermodynamics of Thermal Insulation",
      "Asteroid Trajectory Tracking and Deflection",
    ],
  },
  {
    id: "sports-recreation",
    label: "Sports & Recreation",
    subtopics: [
      "Biomechanics of High-Performance Athletic Footwear",
      "High-Altitude Endurance Training Physiology",
      "The Evolution of Modern Sports Officiating Technology",
      "Sports Nutrition and Glycogen Recovery",
      "Ergonomics and Safety in Outdoor Climbing Gear",
      "The Physics of Aerodynamics in Cycling",
    ],
  },
  {
    id: "food-nutrition",
    label: "Food & Nutrition",
    subtopics: [
      "Fermentation Processes in Food Preservation",
      "Plant-Based Protein Alternatives Chemistry",
      "Micronutrient Absorption and Dietary Fiber",
      "Food Cold-Chain Logistics and Quality Control",
      "Sensory Science and Flavor Perception",
      "The History of Cocoa Cultivation and Chocolate",
    ],
  },
  {
    id: "travel-geography",
    label: "Travel & Geography",
    subtopics: [
      "Glacial Erosion and Alpine Landscape Formation",
      "Sustainable Ecotourism in Tropical Rainforests",
      "Volcanic Island Formation in Ocean Trench Basins",
      "The Cartography of Deep Ocean Trenches",
      "Monsoon Systems and Agricultural Water Cycles",
      "Desalination Technologies in Arid Coastal Regions",
    ],
  },
];

export const TOPIC_DOMAIN_IDS: string[] = TOPIC_DOMAINS.map((domain) => domain.id);

export function selectSessionDomains(
  recentSessionDomains: Array<{ createdAt: string; domains: string[] }>,
  count: number = 3
): Array<{ domainId: string; topic: string }> {
  const domainLastUsedMap = new Map<string, number>();

  for (const session of recentSessionDomains) {
    const timestamp = new Date(session.createdAt).getTime();
    if (isNaN(timestamp)) continue;

    if (Array.isArray(session.domains)) {
      for (const domainId of session.domains) {
        const existing = domainLastUsedMap.get(domainId);
        if (existing === undefined || timestamp > existing) {
          domainLastUsedMap.set(domainId, timestamp);
        }
      }
    }
  }

  const sortedDomains = [...TOPIC_DOMAINS].sort((a, b) => {
    const lastUsedA = domainLastUsedMap.get(a.id) ?? -1;
    const lastUsedB = domainLastUsedMap.get(b.id) ?? -1;

    if (lastUsedA !== lastUsedB) {
      return lastUsedA - lastUsedB;
    }

    return TOPIC_DOMAINS.indexOf(a) - TOPIC_DOMAINS.indexOf(b);
  });

  const selected = sortedDomains.slice(0, Math.min(count, sortedDomains.length));

  return selected.map((domain) => {
    const randomIndex = Math.floor(Math.random() * domain.subtopics.length);
    const topic = domain.subtopics[randomIndex];
    return {
      domainId: domain.id,
      topic,
    };
  });
}
