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
      "Biodiversity Losses in Wetland Habitats",
      "Geothermal Energy Extraction Methods",
      "Soil Degradation and Erosion Prevention",
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
      "The History of Early Postal and Courier Systems",
      "Industrial Revolution Textile Mill Innovations",
      "Ancient Canal and Irrigation Engineering",
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
      "Wireless Sensor Networks for Structural Monitoring",
      "Fiber Optic Communications Infrastructure",
      "Augmented Reality Applications in Industrial Training",
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
      "Franchising Business Models and Expansion Strategies",
      "Venture Capital Funding in Technology Startups",
      "Behavioral Economics and Consumer Choice Architecture",
    ],
  },
  {
    id: "health-medicine",
    label: "Health & Medicine",
    subtopics: [
      "The Biology of Human Sleep Cycles",
      "Targeted Drug Delivery Systems in Oncology",
      "Cardiovascular Fitness and Metabolic Health",
      "Robotic-Assisted Surgery Techniques",
      "Nutritional Biochemistry and Gut Microbiota",
      "Telemedicine Innovations in Rural Healthcare",
      "Advances in Non-Invasive Medical Imaging",
      "Prosthetics and Neural Interface Design",
      "Public Health Interventions in Urban Populations",
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
      "Attention Span Dynamics in Digital Environments",
      "Motivation and Intrinsic Reward Systems",
      "Cross-Cultural Communication Patterns",
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
      "The Restoration of Historic Stained Glass Windows",
      "Traditional Pottery Techniques across Cultures",
      "Modern Sculpture and Material Experimentation",
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
      "Universal Accessibility Design in Public Transport",
      "Municipal Waste Management Policies",
      "The Evolution of Public Broadcasting Service Models",
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
      "Atmospheric Chemistry of Terrestrial Planets",
      "Deep-Space Optical Communication Networks",
      "Oceanic Currents and Thermal Heat Transport",
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
      "Hydration Strategies in Extreme Temperature Sports",
      "Preventive Rehabilitation in Adolescent Athletics",
      "Hydrodynamics in Competitive Swimming Technique",
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
      "Food Emulsions and Texture Stabilization",
      "Sustainable Aquaculture and Fish Feed Formulation",
      "Post-Harvest Processing and Crop Loss Reduction",
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
      "Cave Systems and Karst Topography Dynamics",
      "River Delta Formation and Sediment Transport",
      "High-Altitude Mountain Pass Logistics",
    ],
  },
];

export const TOPIC_DOMAIN_IDS: string[] = TOPIC_DOMAINS.map((domain) => domain.id);

export function selectSessionDomains(
  recentSessions: Array<{ createdAt: string; sections: Array<{ domainId: string; topic: string }> }>,
  count: number = 3
): Array<{ domainId: string; topic: string }> {
  const domainLastUsedMap = new Map<string, number>();
  const subtopicLastUsedMap = new Map<string, number>();

  for (const session of recentSessions) {
    const timestamp = new Date(session.createdAt).getTime();
    if (isNaN(timestamp)) continue;

    if (Array.isArray(session.sections)) {
      for (const entry of session.sections) {
        if (!entry?.domainId) continue;

        const existingDomain = domainLastUsedMap.get(entry.domainId);
        if (existingDomain === undefined || timestamp > existingDomain) {
          domainLastUsedMap.set(entry.domainId, timestamp);
        }

        if (entry.topic) {
          const subtopicKey = `${entry.domainId}::${entry.topic}`;
          const existingSubtopic = subtopicLastUsedMap.get(subtopicKey);
          if (existingSubtopic === undefined || timestamp > existingSubtopic) {
            subtopicLastUsedMap.set(subtopicKey, timestamp);
          }
        }
      }
    }
  }

  const domainTieBreakPriority = new Map<string, number>();
  for (const domain of TOPIC_DOMAINS) {
    domainTieBreakPriority.set(domain.id, Math.random());
  }

  const sortedDomains = [...TOPIC_DOMAINS].sort((a, b) => {
    const lastUsedA = domainLastUsedMap.get(a.id) ?? -1;
    const lastUsedB = domainLastUsedMap.get(b.id) ?? -1;

    if (lastUsedA !== lastUsedB) {
      return lastUsedA - lastUsedB;
    }

    return (domainTieBreakPriority.get(a.id) ?? 0) - (domainTieBreakPriority.get(b.id) ?? 0);
  });

  const selectedDomains = sortedDomains.slice(0, Math.min(count, sortedDomains.length));

  return selectedDomains.map((domain) => {
    const subtopicTieBreakPriority = new Map<string, number>();
    for (const subtopic of domain.subtopics) {
      subtopicTieBreakPriority.set(subtopic, Math.random());
    }

    const sortedSubtopics = [...domain.subtopics].sort((a, b) => {
      const lastUsedA = subtopicLastUsedMap.get(`${domain.id}::${a}`) ?? -1;
      const lastUsedB = subtopicLastUsedMap.get(`${domain.id}::${b}`) ?? -1;

      if (lastUsedA !== lastUsedB) {
        return lastUsedA - lastUsedB;
      }

      return (subtopicTieBreakPriority.get(a) ?? 0) - (subtopicTieBreakPriority.get(b) ?? 0);
    });

    return {
      domainId: domain.id,
      topic: sortedSubtopics[0],
    };
  });
}
