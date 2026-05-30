import { LearningPath } from './types';

export const phase1Curriculum: LearningPath = {
  id: 'beginner-confidence-ladder',
  title: 'Beginner Confidence Ladder',
  description: 'Membangun rasa percaya diri berbicara bahasa Inggris dari tingkat dasar langkah demi langkah.',
  estimatedDurationDays: 14,
  phases: [
    {
      id: 'confidence-foundation',
      pathId: 'beginner-confidence-ladder',
      title: 'Confidence Foundation',
      description: 'Fase fondasi untuk membiasakan diri berbicara kata dan frasa sederhana dalam percakapan sehari-hari.',
      durationDays: 14,
      units: [
        {
          id: 'introduce-yourself',
          phaseId: 'confidence-foundation',
          title: 'Introduce Yourself',
          description: 'Belajar memperkenalkan diri, menyebutkan nama, asal, dan pekerjaan dasar.',
          unitNumber: 1,
          days: [
            {
              dayNumber: 1,
              unitId: 'introduce-yourself',
              title: 'Sapaan Dasar (Basic Greetings)',
              cards: [
                {
                  id: 'card-d1-c1',
                  dayNumber: 1,
                  unitId: 'introduce-yourself',
                  type: 'guided-word',
                  title: 'Greeting Someone',
                  targetPhrases: ['Hello', 'Good morning'],
                  learnerInstruction: 'Listen and repeat the greetings clearly.',
                  indonesianExplanation: 'Dengarkan dan ulangi kata sapaan dasar berikut dengan lantang.',
                  scaffold: 'Hello / Good morning',
                  cta: 'Start Practice',
                  estimatedMinutes: 2,
                  completionRule: 'recorded',
                  linkedEngine: 'guided-word',
                  mobileLayoutHint: 'compact'
                }
              ]
            },
            {
              dayNumber: 2,
              unitId: 'introduce-yourself',
              title: 'Menyebutkan Nama (Saying Your Name)',
              cards: [
                {
                  id: 'card-d2-c1',
                  dayNumber: 2,
                  unitId: 'introduce-yourself',
                  type: 'guided-word',
                  title: 'My Name Is',
                  targetPhrases: ['My name is'],
                  learnerInstruction: 'Say your name using the phrase template.',
                  indonesianExplanation: 'Ucapkan nama Anda menggunakan frasa "My name is...".',
                  scaffold: 'My name is [Name]',
                  cta: 'Start Practice',
                  estimatedMinutes: 2,
                  completionRule: 'recorded',
                  linkedEngine: 'guided-word',
                  mobileLayoutHint: 'compact'
                }
              ]
            },
            {
              dayNumber: 3,
              unitId: 'introduce-yourself',
              title: 'Asal Negara/Kota (Stating Origin)',
              cards: [
                {
                  id: 'card-d3-c1',
                  dayNumber: 3,
                  unitId: 'introduce-yourself',
                  type: 'phrase-pattern',
                  title: 'I am from...',
                  targetPhrases: ['I am from Indonesia', 'I live in Jakarta'],
                  learnerInstruction: 'Complete the pattern to say where you are from.',
                  indonesianExplanation: 'Lengkapi pola kalimat untuk menyebutkan dari mana Anda berasal.',
                  scaffold: 'I am from [Country/City]',
                  cta: 'Practice Phrases',
                  estimatedMinutes: 3,
                  completionRule: 'recorded',
                  linkedEngine: 'phrase-pattern',
                  mobileLayoutHint: 'standard'
                }
              ]
            },
            {
              dayNumber: 4,
              unitId: 'introduce-yourself',
              title: 'Pekerjaan (Describing Your Job)',
              cards: [
                {
                  id: 'card-d4-c1',
                  dayNumber: 4,
                  unitId: 'introduce-yourself',
                  type: 'sentence-builder',
                  title: 'I am a student / I work as...',
                  targetPhrases: ['I am a student', 'I work in an office'],
                  learnerInstruction: 'Build sentences describing your occupation.',
                  indonesianExplanation: 'Susun kalimat yang mendeskripsikan pekerjaan atau status Anda.',
                  scaffold: 'I am a [Job] / I work in [Place]',
                  cta: 'Build Sentence',
                  estimatedMinutes: 4,
                  completionRule: 'attempted',
                  linkedEngine: 'sentence-builder',
                  mobileLayoutHint: 'standard'
                }
              ]
            },
            {
              dayNumber: 5,
              unitId: 'introduce-yourself',
              title: 'Gabungan Perkenalan (Introduction Mix)',
              cards: [
                {
                  id: 'card-d5-c1',
                  dayNumber: 5,
                  unitId: 'introduce-yourself',
                  type: 'micro-speaking',
                  title: 'Self-Introduction Practice',
                  targetPhrases: ['Hello, my name is Alex. I am from Jakarta.'],
                  learnerInstruction: 'Give a very brief self-introduction aloud.',
                  indonesianExplanation: 'Ucapkan perkenalan singkat tentang diri Anda secara lisan.',
                  scaffold: 'Hello, my name is [Name]. I am from [City].',
                  cta: 'Start Speaking',
                  estimatedMinutes: 3,
                  completionRule: 'recorded',
                  linkedEngine: 'micro-speaking',
                  mobileLayoutHint: 'scrollable'
                }
              ]
            },
            {
              dayNumber: 6,
              unitId: 'introduce-yourself',
              title: 'Latihan Mandiri (Self Practice)',
              cards: [
                {
                  id: 'card-d6-c1',
                  dayNumber: 6,
                  unitId: 'introduce-yourself',
                  type: 'micro-speaking',
                  title: 'Greeting and Name',
                  targetPhrases: ['Nice to meet you', 'Glad to meet you'],
                  learnerInstruction: 'Express pleasure in meeting someone.',
                  indonesianExplanation: 'Latih ucapan senang bertemu dengan seseorang dalam bahasa Inggris.',
                  scaffold: 'Nice to meet you / Glad to meet you',
                  cta: 'Start Speaking',
                  estimatedMinutes: 3,
                  completionRule: 'recorded',
                  linkedEngine: 'micro-speaking',
                  mobileLayoutHint: 'standard'
                }
              ]
            },
            {
              dayNumber: 7,
              unitId: 'introduce-yourself',
              title: 'Evaluasi Mingguan 1 (Milestone 1)',
              cards: [
                {
                  id: 'card-d7-c1',
                  dayNumber: 7,
                  unitId: 'introduce-yourself',
                  type: 'weekly-checkpoint',
                  title: 'Unit 1 Checkpoint',
                  targetPhrases: ['Hello, my name is Alex. I am from Jakarta. Nice to meet you.'],
                  learnerInstruction: 'Combine your name, origin, and a greeting in one go.',
                  indonesianExplanation: 'Gabungkan sapaan, nama, asal, dan kalimat penutup dalam satu rekaman.',
                  scaffold: 'Hello, my name is [Name]. I am from [City]. Nice to meet you.',
                  cta: 'Complete Checkpoint',
                  estimatedMinutes: 5,
                  completionRule: 'completed',
                  linkedEngine: 'weekly-checkpoint',
                  mobileLayoutHint: 'scrollable'
                }
              ]
            }
          ]
        },
        {
          id: 'my-daily-life',
          phaseId: 'confidence-foundation',
          title: 'My Daily Life',
          description: 'Belajar mendeskripsikan aktivitas sehari-hari, rutinitas pagi, dan hobi sederhana.',
          unitNumber: 2,
          days: [
            {
              dayNumber: 8,
              unitId: 'my-daily-life',
              title: 'Aktivitas Pagi (Morning Routine)',
              cards: [
                {
                  id: 'card-d8-c1',
                  dayNumber: 8,
                  unitId: 'my-daily-life',
                  type: 'guided-word',
                  title: 'Morning Activities',
                  targetPhrases: ['Wake up', 'Get up'],
                  learnerInstruction: 'Repeat the common morning activities verbs.',
                  indonesianExplanation: 'Ulangi kosakata aktivitas pagi hari yang sering digunakan.',
                  scaffold: 'Wake up / Get up',
                  cta: 'Start Practice',
                  estimatedMinutes: 2,
                  completionRule: 'recorded',
                  linkedEngine: 'guided-word',
                  mobileLayoutHint: 'compact'
                }
              ]
            },
            {
              dayNumber: 9,
              unitId: 'my-daily-life',
              title: 'Sarapan dan Kopi (Breakfast)',
              cards: [
                {
                  id: 'card-d9-c1',
                  dayNumber: 9,
                  unitId: 'my-daily-life',
                  type: 'guided-word',
                  title: 'Breakfast Verbs',
                  targetPhrases: ['Eat breakfast', 'Drink coffee'],
                  learnerInstruction: 'Speak the breakfast actions clearly.',
                  indonesianExplanation: 'Ucapkan tindakan sarapan pagi dengan jelas.',
                  scaffold: 'Eat breakfast / Drink coffee',
                  cta: 'Start Practice',
                  estimatedMinutes: 2,
                  completionRule: 'recorded',
                  linkedEngine: 'guided-word',
                  mobileLayoutHint: 'compact'
                }
              ]
            },
            {
              dayNumber: 10,
              unitId: 'my-daily-life',
              title: 'Waktu Rutinitas (Talking About Time)',
              cards: [
                {
                  id: 'card-d10-c1',
                  dayNumber: 10,
                  unitId: 'my-daily-life',
                  type: 'phrase-pattern',
                  title: 'I wake up at...',
                  targetPhrases: ['I wake up at six', 'I eat breakfast at seven'],
                  learnerInstruction: 'Describe what time you do your daily tasks.',
                  indonesianExplanation: 'Jelaskan jam berapa Anda melakukan aktivitas sehari-hari.',
                  scaffold: 'I [Routine] at [Time]',
                  cta: 'Practice Phrases',
                  estimatedMinutes: 3,
                  completionRule: 'recorded',
                  linkedEngine: 'phrase-pattern',
                  mobileLayoutHint: 'standard'
                }
              ]
            },
            {
              dayNumber: 11,
              unitId: 'my-daily-life',
              title: 'Perjalanan (Commuting to Work/School)',
              cards: [
                {
                  id: 'card-d11-c1',
                  dayNumber: 11,
                  unitId: 'my-daily-life',
                  type: 'sentence-builder',
                  title: 'Transportation patterns',
                  targetPhrases: ['I go to work by motorcycle', 'I take the bus'],
                  learnerInstruction: 'Build sentences about your commute mode.',
                  indonesianExplanation: 'Susun kalimat mengenai cara Anda berangkat bekerja atau sekolah.',
                  scaffold: 'I go to [Destination] by [Vehicle]',
                  cta: 'Build Sentence',
                  estimatedMinutes: 4,
                  completionRule: 'attempted',
                  linkedEngine: 'sentence-builder',
                  mobileLayoutHint: 'standard'
                }
              ]
            },
            {
              dayNumber: 12,
              unitId: 'my-daily-life',
              title: 'Rutinitas Pagi Lengkap (Full Morning Description)',
              cards: [
                {
                  id: 'card-d12-c1',
                  dayNumber: 12,
                  unitId: 'my-daily-life',
                  type: 'micro-speaking',
                  title: 'Describe Your Morning',
                  targetPhrases: ['I wake up at six and eat breakfast.'],
                  learnerInstruction: 'Give a quick description of your morning schedule.',
                  indonesianExplanation: 'Berikan deskripsi singkat tentang rutinitas pagi Anda secara lisan.',
                  scaffold: 'I wake up at [Time] and [Routine].',
                  cta: 'Start Speaking',
                  estimatedMinutes: 3,
                  completionRule: 'recorded',
                  linkedEngine: 'micro-speaking',
                  mobileLayoutHint: 'scrollable'
                }
              ]
            },
            {
              dayNumber: 13,
              unitId: 'my-daily-life',
              title: 'Hobi Senggang (Free Time Activities)',
              cards: [
                {
                  id: 'card-d13-c1',
                  dayNumber: 13,
                  unitId: 'my-daily-life',
                  type: 'micro-speaking',
                  title: 'Hobbies',
                  targetPhrases: ['In my free time, I like to watch movies.'],
                  learnerInstruction: 'Talk about what you enjoy doing in your spare time.',
                  indonesianExplanation: 'Ceritakan aktivitas yang Anda sukai di waktu luang.',
                  scaffold: 'In my free time, I like to [Hobby].',
                  cta: 'Start Speaking',
                  estimatedMinutes: 3,
                  completionRule: 'recorded',
                  linkedEngine: 'micro-speaking',
                  mobileLayoutHint: 'standard'
                }
              ]
            },
            {
              dayNumber: 14,
              unitId: 'my-daily-life',
              title: 'Evaluasi Mingguan 2 (Milestone 2)',
              cards: [
                {
                  id: 'card-d14-c1',
                  dayNumber: 14,
                  unitId: 'my-daily-life',
                  type: 'weekly-checkpoint',
                  title: 'Unit 2 Checkpoint',
                  targetPhrases: ['I wake up early every day. In my free time, I play football.'],
                  learnerInstruction: 'Summarize your daily routine and a favorite free time activity.',
                  indonesianExplanation: 'Rangkum aktivitas harian Anda beserta hobi di waktu luang dalam satu rekaman.',
                  scaffold: 'I wake up at [Time]. In my free time, I [Hobby].',
                  cta: 'Complete Checkpoint',
                  estimatedMinutes: 5,
                  completionRule: 'completed',
                  linkedEngine: 'weekly-checkpoint',
                  mobileLayoutHint: 'scrollable'
                }
              ]
            }
          ]
        }
      ]
    }
  ]
};
