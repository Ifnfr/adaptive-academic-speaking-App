import { LearningPathPhase } from './types';

export const phase2Curriculum: LearningPathPhase = {
  id: 'everyday-interaction',
  pathId: 'beginner-confidence-ladder',
  title: 'Everyday Interaction',
  description: 'Mulai bisa bertanya, menjawab, menyatakan pilihan, dan memberi satu alasan sederhana dalam percakapan sehari-hari.',
  durationDays: 14,
  units: [
    {
      id: 'asking-and-answering',
      phaseId: 'everyday-interaction',
      title: 'Asking and Answering',
      description: 'Belajar mengajukan pertanyaan rutin dan menjawabnya secara bergantian.',
      unitNumber: 3,
      days: [
        {
          dayNumber: 15,
          unitId: 'asking-and-answering',
          title: 'Pertanyaan Dasar (Basic Questions)',
          cards: [
            {
              id: 'card-d15-c1',
              dayNumber: 15,
              unitId: 'asking-and-answering',
              type: 'sentence-builder',
              title: 'Are you tired?',
              targetPhrases: ['Are you tired', 'Is it in Jakarta'],
              learnerInstruction: 'Arrange the words to ask basic routine questions.',
              indonesianExplanation: 'Susun kata untuk menanyakan kondisi atau lokasi dasar.',
              scaffold: 'Are you [adjective] / Is it in [place]',
              cta: 'Build sentence',
              estimatedMinutes: 3,
              completionRule: 'attempted',
              linkedEngine: 'sentence-builder',
              mobileLayoutHint: 'standard'
            },
            {
              id: 'card-d15-c2',
              dayNumber: 15,
              unitId: 'asking-and-answering',
              type: 'micro-speaking',
              title: 'Asking basic questions',
              targetPhrases: ['Are you tired?', 'Is it in Jakarta?'],
              learnerInstruction: 'Pronounce the routine questions clearly.',
              indonesianExplanation: 'Ucapkan kalimat pertanyaan dasar dengan lantang.',
              scaffold: 'Are you tired? / Is it in Jakarta?',
              cta: 'Start Speaking',
              estimatedMinutes: 2,
              completionRule: 'recorded',
              linkedEngine: 'micro-speaking',
              mobileLayoutHint: 'standard'
            }
          ]
        },
        {
          dayNumber: 16,
          unitId: 'asking-and-answering',
          title: 'Klarifikasi Kebutuhan (Clarifying Needs)',
          cards: [
            {
              id: 'card-d16-c1',
              dayNumber: 16,
              unitId: 'asking-and-answering',
              type: 'pronunciation-awareness',
              title: 'This and That sound differences',
              targetPhrases: ['this', 'that'],
              learnerInstruction: 'Identify the correct word pronunciation for this and that.',
              indonesianExplanation: 'Bedakan pengucapan antara "this" dan "that".',
              scaffold: 'Listen and select the word you hear.',
              cta: 'Start Practice',
              estimatedMinutes: 2,
              completionRule: 'completed',
              linkedEngine: 'pronunciation-awareness',
              mobileLayoutHint: 'compact',
              pronunciationFocus: {
                pairs: [{ wordA: 'this', wordB: 'these', correct: 'A' }],
                instruction: 'Choose the correct word.'
              }
            },
            {
              id: 'card-d16-c2',
              dayNumber: 16,
              unitId: 'asking-and-answering',
              type: 'guided-word',
              title: 'I need this',
              targetPhrases: ['I need this', 'I think so'],
              learnerInstruction: 'Listen and repeat key vocabulary for clarification.',
              indonesianExplanation: 'Dengarkan dan ulangi cara mengklarifikasi kebutuhan.',
              scaffold: 'I need this / I think so',
              cta: 'Start Practice',
              estimatedMinutes: 2,
              completionRule: 'recorded',
              linkedEngine: 'guided-word',
              mobileLayoutHint: 'compact'
            }
          ]
        },
        {
          dayNumber: 17,
          unitId: 'asking-and-answering',
          title: 'Pertanyaan Rutinitas (Routines)',
          cards: [
            {
              id: 'card-d17-c1',
              dayNumber: 17,
              unitId: 'asking-and-answering',
              type: 'phrase-pattern',
              title: 'Routine Questions',
              targetPhrases: ['Do you study every day?', 'Do you eat breakfast every day?'],
              learnerInstruction: 'Fill the routine verb to ask about habits.',
              indonesianExplanation: 'Lengkapi pola kalimat tanya untuk rutinitas sehari-hari.',
              scaffold: 'Do you [verb] every day?',
              cta: 'Practice Phrases',
              estimatedMinutes: 3,
              completionRule: 'recorded',
              linkedEngine: 'phrase-pattern',
              mobileLayoutHint: 'standard'
            },
            {
              id: 'card-d17-c2',
              dayNumber: 17,
              unitId: 'asking-and-answering',
              type: 'micro-speaking',
              title: 'Habit speaking practice',
              targetPhrases: ['Do you study every day?'],
              learnerInstruction: 'Ask about daily routine with clear voice.',
              indonesianExplanation: 'Ucapkan kalimat tanya tentang rutinitas dengan jelas.',
              scaffold: 'Do you study every day?',
              cta: 'Start Speaking',
              estimatedMinutes: 2,
              completionRule: 'recorded',
              linkedEngine: 'micro-speaking',
              mobileLayoutHint: 'standard'
            }
          ]
        },
        {
          dayNumber: 18,
          unitId: 'asking-and-answering',
          title: 'Kelancaran Berekspresi (Expressing States)',
          cards: [
            {
              id: 'card-d18-c1',
              dayNumber: 18,
              unitId: 'asking-and-answering',
              type: 'micro-speaking',
              title: 'Fluency Sprint: Personal States',
              targetPhrases: ['I am very busy today', 'I am very happy today'],
              learnerInstruction: 'Read the full sentence quickly to practice conversational fluency.',
              indonesianExplanation: 'Latih kelancaran berbicara dengan mengucapkan kalimat secara cepat.',
              scaffold: 'I am very [state] today',
              cta: 'Start Speaking',
              estimatedMinutes: 3,
              completionRule: 'recorded',
              linkedEngine: 'micro-speaking',
              mobileLayoutHint: 'standard',
              speakingMode: 'fluency-sprint',
              timeLimitsSeconds: [30, 20, 15]
            }
          ]
        },
        {
          dayNumber: 19,
          unitId: 'asking-and-answering',
          title: 'Percakapan Bergantian (Turn Taking)',
          cards: [
            {
              id: 'card-d19-c1',
              dayNumber: 19,
              unitId: 'asking-and-answering',
              type: 'supported-conversation',
              title: 'Greeting Exchange',
              targetPhrases: ['I am fine. And you?', 'How about you?'],
              learnerInstruction: 'Select a scripted response to continue the conversation.',
              indonesianExplanation: 'Pilih jawaban percakapan untuk merespon pertanyaan.',
              scaffold: 'tutor: How are you? -> learner: I am fine. And you?',
              cta: 'Start Conversation',
              estimatedMinutes: 3,
              completionRule: 'completed',
              linkedEngine: 'supported-conversation',
              mobileLayoutHint: 'scrollable',
              conversationPrompt: {
                tutorTurn: 'How are you?',
                options: [
                  { id: 'opt1', text: 'I am fine. And you?' },
                  { id: 'opt2', text: 'I am good. How about you?' }
                ]
              }
            }
          ]
        },
        {
          dayNumber: 20,
          unitId: 'asking-and-answering',
          title: 'Review Unit 3',
          cards: [
            {
              id: 'card-d20-c1',
              dayNumber: 20,
              unitId: 'asking-and-answering',
              type: 'reflection-card',
              title: 'Unit 3 Reflection',
              targetPhrases: ['I can ask questions', 'I feel confident'],
              learnerInstruction: 'Reflect on your Unit 3 learning progress.',
              indonesianExplanation: 'Renungkan kemajuan belajar Anda di Unit 3.',
              scaffold: 'Select how confident you feel speaking routine questions.',
              cta: 'Reflect Now',
              estimatedMinutes: 2,
              completionRule: 'completed',
              linkedEngine: 'reflection-card',
              mobileLayoutHint: 'compact',
              reflectionPrompt: {
                question: 'How confident do you feel asking routine questions?',
                options: ['Very confident', 'Need more practice', 'Not confident yet']
              }
            },
            {
              id: 'card-d20-c2',
              dayNumber: 20,
              unitId: 'asking-and-answering',
              type: 'weekly-checkpoint',
              title: 'Unit 3 Checkpoint',
              targetPhrases: ['Are you busy every day?', 'I am fine. And you?'],
              learnerInstruction: 'Review Unit 3 target structures.',
              indonesianExplanation: 'Evaluasi pemahaman kalimat tanya dan respon di Unit 3.',
              scaffold: 'Are you busy every day? / I am fine. And you?',
              cta: 'Complete Checkpoint',
              estimatedMinutes: 5,
              completionRule: 'completed',
              linkedEngine: 'weekly-checkpoint',
              mobileLayoutHint: 'scrollable'
            }
          ]
        },
        {
          dayNumber: 21,
          unitId: 'asking-and-answering',
          title: 'Kalimat Korektif (Repair Phrases)',
          cards: [
            {
              id: 'card-d21-c1',
              dayNumber: 21,
              unitId: 'asking-and-answering',
              type: 'guided-word',
              title: 'Repeat Phrase',
              targetPhrases: ['Can you repeat', 'I do not understand'],
              learnerInstruction: 'Listen and repeat key communication repair phrases.',
              indonesianExplanation: 'Dengarkan dan tirukan kalimat untuk meminta pengulangan.',
              scaffold: 'Can you repeat / I do not understand',
              cta: 'Start Practice',
              estimatedMinutes: 2,
              completionRule: 'recorded',
              linkedEngine: 'guided-word',
              mobileLayoutHint: 'compact'
            },
            {
              id: 'card-d21-c2',
              dayNumber: 21,
              unitId: 'asking-and-answering',
              type: 'micro-speaking',
              title: 'Using Repair Phrases',
              targetPhrases: ['Can you repeat?'],
              learnerInstruction: 'Speak the communication repair helper phrase.',
              indonesianExplanation: 'Ucapkan kalimat minta pengulangan dengan jelas.',
              scaffold: 'Can you repeat?',
              cta: 'Start Speaking',
              estimatedMinutes: 2,
              completionRule: 'recorded',
              linkedEngine: 'micro-speaking',
              mobileLayoutHint: 'standard'
            }
          ]
        }
      ]
    },
    {
      id: 'expressing-preferences',
      phaseId: 'everyday-interaction',
      title: 'Expressing Simple Preferences',
      description: 'Belajar menyatakan pilihan suka atau tidak suka beserta alasan sederhana.',
      unitNumber: 4,
      days: [
        {
          dayNumber: 22,
          unitId: 'expressing-preferences',
          title: 'Menyatakan Kesukaan (Stating Likes)',
          cards: [
            {
              id: 'card-d22-c1',
              dayNumber: 22,
              unitId: 'expressing-preferences',
              type: 'phrase-pattern',
              title: 'Stating Likes',
              targetPhrases: ['I like coffee', 'I like tea'],
              learnerInstruction: 'State what you like using the pattern.',
              indonesianExplanation: 'Nyatakan hal yang Anda sukai dengan pola kalimat.',
              scaffold: 'I like [noun]',
              cta: 'Practice Phrases',
              estimatedMinutes: 3,
              completionRule: 'recorded',
              linkedEngine: 'phrase-pattern',
              mobileLayoutHint: 'standard'
            },
            {
              id: 'card-d22-c2',
              dayNumber: 22,
              unitId: 'expressing-preferences',
              type: 'sentence-builder',
              title: 'I prefer coffee',
              targetPhrases: ['I prefer tea', 'I prefer coffee'],
              learnerInstruction: 'Build sentences stating preferences.',
              indonesianExplanation: 'Susun kata untuk menyatakan pilihan yang lebih disukai.',
              scaffold: 'I prefer [noun]',
              cta: 'Build Sentence',
              estimatedMinutes: 4,
              completionRule: 'attempted',
              linkedEngine: 'sentence-builder',
              mobileLayoutHint: 'standard'
            }
          ]
        },
        {
          dayNumber: 23,
          unitId: 'expressing-preferences',
          title: 'Menyatakan Ketidaksukaan (Stating Dislikes)',
          cards: [
            {
              id: 'card-d23-c1',
              dayNumber: 23,
              unitId: 'expressing-preferences',
              type: 'phrase-pattern',
              title: 'Dislikes Pattern',
              targetPhrases: ['I do not like milk', 'I hate cold weather'],
              learnerInstruction: 'Fill the slot to express dislikes.',
              indonesianExplanation: 'Lengkapi kalimat untuk menyatakan ketidaksukaan.',
              scaffold: 'I do not like [noun] / I hate [noun]',
              cta: 'Practice Phrases',
              estimatedMinutes: 3,
              completionRule: 'recorded',
              linkedEngine: 'phrase-pattern',
              mobileLayoutHint: 'standard'
            },
            {
              id: 'card-d23-c2',
              dayNumber: 23,
              unitId: 'expressing-preferences',
              type: 'micro-speaking',
              title: 'Speaking Dislikes',
              targetPhrases: ['I do not like milk.'],
              learnerInstruction: 'Speak your dislike phrase clearly.',
              indonesianExplanation: 'Ucapkan kalimat ketidaksukaan dengan lantang.',
              scaffold: 'I do not like milk.',
              cta: 'Start Speaking',
              estimatedMinutes: 2,
              completionRule: 'recorded',
              linkedEngine: 'micro-speaking',
              mobileLayoutHint: 'standard'
            }
          ]
        },
        {
          dayNumber: 24,
          unitId: 'expressing-preferences',
          title: 'Memberikan Alasan (Giving Reasons)',
          cards: [
            {
              id: 'card-d24-c1',
              dayNumber: 24,
              unitId: 'expressing-preferences',
              type: 'sentence-builder',
              title: 'Because it is good',
              targetPhrases: ['because it is good', 'because it is hot'],
              learnerInstruction: 'Build sentences adding simple reasons.',
              indonesianExplanation: 'Susun kata untuk menyertakan alasan sederhana.',
              scaffold: 'because it is [adjective]',
              cta: 'Build Sentence',
              estimatedMinutes: 4,
              completionRule: 'attempted',
              linkedEngine: 'sentence-builder',
              mobileLayoutHint: 'standard'
            },
            {
              id: 'card-d24-c2',
              dayNumber: 24,
              unitId: 'expressing-preferences',
              type: 'guided-word',
              title: 'Because explanation',
              targetPhrases: ['because'],
              learnerInstruction: 'Listen to model pronunciation of transition words.',
              indonesianExplanation: 'Dengarkan kata penyambung untuk menyatakan alasan.',
              scaffold: 'because',
              cta: 'Start Practice',
              estimatedMinutes: 2,
              completionRule: 'recorded',
              linkedEngine: 'guided-word',
              mobileLayoutHint: 'compact'
            }
          ]
        },
        {
          dayNumber: 25,
          unitId: 'expressing-preferences',
          title: 'Bertanya Pilihan (Asking Preferences)',
          cards: [
            {
              id: 'card-d25-c1',
              dayNumber: 25,
              unitId: 'expressing-preferences',
              type: 'supported-conversation',
              title: 'Asking X or Y',
              targetPhrases: ['Do you like tea or coffee?'],
              learnerInstruction: 'Choose a preference response option.',
              indonesianExplanation: 'Pilih opsi jawaban mengenai kesukaan Anda.',
              scaffold: 'tutor: Do you like tea or coffee? -> learner: I like coffee.',
              cta: 'Start Conversation',
              estimatedMinutes: 3,
              completionRule: 'completed',
              linkedEngine: 'supported-conversation',
              mobileLayoutHint: 'scrollable',
              conversationPrompt: {
                tutorTurn: 'Do you like tea or coffee?',
                options: [
                  { id: 'opt1', text: 'I like tea.' },
                  { id: 'opt2', text: 'I like coffee.' }
                ]
              }
            }
          ]
        },
        {
          dayNumber: 26,
          unitId: 'expressing-preferences',
          title: 'Kalimat Lengkap (Extended Preferences)',
          cards: [
            {
              id: 'card-d26-c1',
              dayNumber: 26,
              unitId: 'expressing-preferences',
              type: 'micro-speaking',
              title: 'Extended preferences',
              targetPhrases: ['I like coffee because it is hot.', 'I like tea because it is good.'],
              learnerInstruction: 'Speak a preference along with a single simple reason.',
              indonesianExplanation: 'Ucapkan pilihan beserta alasan sederhana secara lisan.',
              scaffold: 'I like [noun] because it is [adjective].',
              cta: 'Start Speaking',
              estimatedMinutes: 3,
              completionRule: 'recorded',
              linkedEngine: 'micro-speaking',
              mobileLayoutHint: 'scrollable',
              speakingMode: 'fluency-sprint',
              timeLimitsSeconds: [30, 20, 15]
            }
          ]
        },
        {
          dayNumber: 27,
          unitId: 'expressing-preferences',
          title: 'Review Unit 4',
          cards: [
            {
              id: 'card-d27-c1',
              dayNumber: 27,
              unitId: 'expressing-preferences',
              type: 'reflection-card',
              title: 'Unit 4 Reflection',
              targetPhrases: ['I can express preference'],
              learnerInstruction: 'Reflect on your Unit 4 learning progress.',
              indonesianExplanation: 'Renungkan perkembangan belajar Anda di Unit 4.',
              scaffold: 'Select how confident you feel stating preferences and reasons.',
              cta: 'Reflect Now',
              estimatedMinutes: 2,
              completionRule: 'completed',
              linkedEngine: 'reflection-card',
              mobileLayoutHint: 'compact',
              reflectionPrompt: {
                question: 'How confident do you feel stating preferences and reasons?',
                options: ['Very confident', 'Need more practice', 'Not confident yet']
              }
            },
            {
              id: 'card-d27-c2',
              dayNumber: 27,
              unitId: 'expressing-preferences',
              type: 'weekly-checkpoint',
              title: 'Unit 4 Checkpoint',
              targetPhrases: ['I prefer coffee because it is hot.'],
              learnerInstruction: 'Assess your preference structures.',
              indonesianExplanation: 'Evaluasi kalimat pilihan dan alasan sederhana di Unit 4.',
              scaffold: 'I prefer coffee because it is hot.',
              cta: 'Complete Checkpoint',
              estimatedMinutes: 5,
              completionRule: 'completed',
              linkedEngine: 'weekly-checkpoint',
              mobileLayoutHint: 'scrollable'
            }
          ]
        },
        {
          dayNumber: 28,
          unitId: 'expressing-preferences',
          title: 'Evaluasi Capstone (Phase 2 Capstone)',
          cards: [
            {
              id: 'card-d28-c1',
              dayNumber: 28,
              unitId: 'expressing-preferences',
              type: 'supported-conversation',
              title: 'Everyday Conversation Capstone',
              targetPhrases: ['Hi, I am Alex. I like coffee because it is hot.'],
              learnerInstruction: 'Select response representing your profile to finish.',
              indonesianExplanation: 'Pilih jawaban lengkap tentang diri Anda untuk menyelesaikan modul.',
              scaffold: 'Hi, I am [Name]. I like [Preferences] because [Reason].',
              cta: 'Complete Capstone',
              estimatedMinutes: 4,
              completionRule: 'completed',
              linkedEngine: 'supported-conversation',
              mobileLayoutHint: 'scrollable',
              conversationPrompt: {
                tutorTurn: 'Welcome back! Can you introduce yourself and say what you prefer?',
                options: [
                  { id: 'opt1', text: 'Hi, I am Alex. I like coffee because it is hot.' },
                  { id: 'opt2', text: 'Hi, I am Taylor. I like tea because it is sweet.' }
                ]
              }
            }
          ]
        }
      ]
    }
  ]
};
