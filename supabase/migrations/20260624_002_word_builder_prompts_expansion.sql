-- =============================================================================
-- Migration: 20260624_002_word_builder_prompts_expansion
-- Inserts 45 new prompts into the word_builder_prompts table.
-- =============================================================================

insert into word_builder_prompts (prompt_text, topic_domain, mode, implied_structures) values

-- ECONOMICS (10 new prompts)
('Explain what happens to a country''s exports when its currency becomes stronger against other currencies.', 'economics', 'guided', '["tense", "auxiliary_verb"]'),
('Describe the difference between a progressive tax system and a flat tax system.', 'economics', 'guided', '["auxiliary_verb", "article"]'),
('Explain why some economists argue that a minimum wage increase can lead to unemployment.', 'economics', 'guided', '["tense", "verb_form"]'),
('Describe what a budget deficit means and how it affects future generations.', 'economics', 'guided', '["auxiliary_verb", "tense"]'),
('Explain the relationship between supply, demand, and the price of a product when supply suddenly decreases.', 'economics', 'guided', '["tense", "subject_verb_agreement"]'),
('Describe how foreign direct investment can benefit a developing country.', 'economics', 'guided', '["auxiliary_verb", "verb_form"]'),
('Explain what the informal economy is and why it exists in many developing nations.', 'economics', 'guided', '["auxiliary_verb", "subject_verb_agreement"]'),
('Describe how a recession affects employment, consumer spending, and business investment at the same time.', 'economics', 'guided', '["tense", "subject_verb_agreement"]'),
('Explain what is meant by the term ''comparative advantage'' and give a real-world example.', 'economics', 'guided', '["auxiliary_verb", "verb_form"]'),
('Describe the role of microfinance in helping small businesses grow in low-income communities.', 'economics', 'guided', '["tense", "preposition"]'),

-- TECHNOLOGY (10 new prompts)
('Explain how machine learning systems are trained and what kind of data they require.', 'technology', 'guided', '["auxiliary_verb", "tense"]'),
('Describe the potential risks of storing personal medical records in cloud-based systems.', 'technology', 'guided', '["verb_form", "article"]'),
('Explain what net neutrality means and why it matters for everyday internet users.', 'technology', 'guided', '["auxiliary_verb", "subject_verb_agreement"]'),
('Describe how renewable energy technology is changing the way electricity is produced and distributed.', 'technology', 'guided', '["auxiliary_verb", "tense"]'),
('Explain the difference between augmented reality and virtual reality, and give one use case for each.', 'technology', 'guided', '["article", "preposition"]'),
('Describe how social media algorithms decide what content appears in a user''s feed.', 'technology', 'guided', '["tense", "verb_form"]'),
('Explain what end-to-end encryption is and why it is important for protecting private communication.', 'technology', 'guided', '["auxiliary_verb", "article"]'),
('Describe the environmental impact of large-scale data centers that power cloud computing services.', 'technology', 'guided', '["tense", "preposition"]'),
('Explain how platforms like YouTube or TikTok use recommendation systems to keep users engaged longer.', 'technology', 'guided', '["tense", "verb_form"]'),
('Describe what open-source software is and explain one advantage and one disadvantage of using it.', 'technology', 'guided', '["auxiliary_verb", "article"]'),

-- DAILY HABITS (10 new prompts)
('Describe how your study habits have changed since you started university compared to high school.', 'daily_habits', 'guided', '["tense", "preposition"]'),
('Explain what you do to stay focused when you are studying a difficult subject for a long time.', 'daily_habits', 'guided', '["tense", "subject_verb_agreement"]'),
('Describe the way you organize your time when you have multiple deadlines approaching at once.', 'daily_habits', 'guided', '["tense", "preposition"]'),
('Explain how your eating habits affect your energy levels and concentration throughout the day.', 'daily_habits', 'guided', '["tense", "subject_verb_agreement"]'),
('Describe what you typically do in the first hour after waking up and why you have developed this routine.', 'daily_habits', 'guided', '["tense", "auxiliary_verb"]'),
('Explain how you decide which tasks to prioritize when everything feels equally urgent.', 'daily_habits', 'guided', '["tense", "verb_form"]'),
('Describe a habit you recently tried to build or break and explain what made it difficult.', 'daily_habits', 'guided', '["tense", "auxiliary_verb"]'),
('Explain how spending time outdoors or exercising affects your mental clarity and mood.', 'daily_habits', 'guided', '["tense", "subject_verb_agreement"]'),
('Describe how you wind down at the end of a long day and prepare yourself for the next one.', 'daily_habits', 'guided', '["tense", "preposition"]'),
('Explain the role that social interaction plays in your daily wellbeing and motivation to study.', 'daily_habits', 'guided', '["tense", "article"]'),

-- OPINION (15 new prompts)
('Explain whether you think social media does more harm than good for teenagers and young adults.', 'opinion', 'guided', '["auxiliary_verb", "tense"]'),
('Describe your view on whether universities should make attendance at lectures mandatory or optional.', 'opinion', 'guided', '["verb_form", "auxiliary_verb"]'),
('Explain your opinion on whether governments should limit how much time children spend on smartphones.', 'opinion', 'guided', '["auxiliary_verb", "verb_form"]'),
('Describe whether you believe gap years before university are beneficial or a waste of time.', 'opinion', 'guided', '["auxiliary_verb", "article"]'),
('Explain your perspective on whether English should be taught as a compulsory subject in all schools worldwide.', 'opinion', 'guided', '["auxiliary_verb", "verb_form"]'),
('Describe your view on whether working from home is better or worse for productivity than working in an office.', 'opinion', 'guided', '["tense", "preposition"]'),
('Explain whether you think it is the responsibility of wealthy nations to accept climate refugees.', 'opinion', 'guided', '["auxiliary_verb", "article"]'),
('Describe your opinion on whether artificial intelligence will eventually replace most human jobs.', 'opinion', 'guided', '["tense", "auxiliary_verb"]'),
('Explain your view on whether public transportation should be made free for all citizens in large cities.', 'opinion', 'guided', '["auxiliary_verb", "verb_form"]'),
('Describe whether you believe that online learning can ever fully replace traditional classroom education.', 'opinion', 'guided', '["auxiliary_verb", "tense"]'),
('Explain your perspective on whether it is ethical for companies to use personal data to personalize advertising.', 'opinion', 'guided', '["auxiliary_verb", "verb_form"]'),
('Describe your view on whether people have a moral obligation to reduce their carbon footprint individually.', 'opinion', 'guided', '["auxiliary_verb", "article"]'),
('Explain whether you think economic growth and environmental sustainability can coexist in the long term.', 'opinion', 'guided', '["auxiliary_verb", "tense"]'),
('Describe your opinion on whether it is fair that elite universities admit students based on legacy status.', 'opinion', 'guided', '["auxiliary_verb", "subject_verb_agreement"]'),
('Explain your view on whether mental health education should be a core part of the school curriculum.', 'opinion', 'guided', '["auxiliary_verb", "verb_form"]');
