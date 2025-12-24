
import { Language, Scenario, VoiceOption } from './types';

export const LANGUAGES: Language[] = [
  { id: 'en', name: 'English', nativeName: 'English', flag: '🇺🇸', voice: 'Puck' },
  { id: 'es', name: 'Spanish', nativeName: 'Español', flag: '🇪🇸', voice: 'Kore' },
  { id: 'fr', name: 'French', nativeName: 'Français', flag: '🇫🇷', voice: 'Zephyr' },
  { id: 'de', name: 'German', nativeName: 'Deutsch', flag: '🇩🇪', voice: 'Charon' },
  { id: 'jp', name: 'Japanese', nativeName: '日本語', flag: '🇯🇵', voice: 'Fenrir' },
  { id: 'it', name: 'Italian', nativeName: 'Italiano', flag: '🇮🇹', voice: 'Kore' },
  { id: 'pt', name: 'Portuguese', nativeName: 'Português', flag: '🇧🇷', voice: 'Zephyr' },
  { id: 'kr', name: 'Korean', nativeName: '한국어', flag: '🇰🇷', voice: 'Puck' },
  { id: 'cn', name: 'Chinese', nativeName: '中文', flag: '🇨🇳', voice: 'Charon' },
  { id: 'ru', name: 'Russian', nativeName: 'Русский', flag: '🇷🇺', voice: 'Fenrir' },
  { id: 'ar', name: 'Arabic', nativeName: 'العربية', flag: '🇸🇦', voice: 'Zephyr' },
  { id: 'in', name: 'Hindi', nativeName: 'हिन्दी', flag: '🇮🇳', voice: 'Kore' },
  { id: 'tr', name: 'Turkish', nativeName: 'Türkçe', flag: '🇹🇷', voice: 'Puck' },
  { id: 'nl', name: 'Dutch', nativeName: 'Nederlands', flag: '🇳🇱', voice: 'Charon' },
  { id: 'se', name: 'Swedish', nativeName: 'Svenska', flag: '🇸🇪', voice: 'Zephyr' },
  { id: 'no', name: 'Norwegian', nativeName: 'Norsk', flag: '🇳🇴', voice: 'Fenrir' },
  { id: 'dk', name: 'Danish', nativeName: 'Dansk', flag: '🇩🇰', voice: 'Kore' },
  { id: 'fi', name: 'Finnish', nativeName: 'Suomi', flag: '🇫🇮', voice: 'Puck' },
  { id: 'pl', name: 'Polish', nativeName: 'Polski', flag: '🇵🇱', voice: 'Charon' },
  { id: 'gr', name: 'Greek', nativeName: 'Ελληνικά', flag: '🇬🇷', voice: 'Zephyr' },
  { id: 'th', name: 'Thai', nativeName: 'ไทย', flag: '🇹🇭', voice: 'Kore' },
  { id: 'vn', name: 'Vietnamese', nativeName: 'Tiếng Việt', flag: '🇻🇳', voice: 'Puck' },
  { id: 'id', name: 'Indonesian', nativeName: 'Bahasa Indonesia', flag: '🇮🇩', voice: 'Fenrir' },
  { id: 'il', name: 'Hebrew', nativeName: 'עברית', flag: '🇮🇱', voice: 'Charon' },
  { id: 'ua', name: 'Ukrainian', nativeName: 'Українська', flag: '🇺🇦', voice: 'Zephyr' },
];

export const VOICE_DETAILS: { id: VoiceOption; name: string; description: string }[] = [
  { id: 'Puck', name: 'Puck', description: 'Energetic & Friendly' },
  { id: 'Charon', name: 'Charon', description: 'Calm & Sophisticated' },
  { id: 'Kore', name: 'Kore', description: 'Bright & Clear' },
  { id: 'Fenrir', name: 'Fenrir', description: 'Deep & Resonant' },
  { id: 'Zephyr', name: 'Zephyr', description: 'Smooth & Gentle' },
];

export const SCENARIOS: Scenario[] = [
  {
    id: 'casual',
    title: 'Casual Chat',
    description: 'Practice everyday conversation about hobbies, weather, and life.',
    icon: '💬',
    prompt: 'You are a friendly neighbor. Keep the conversation light and casual.',
    details: [
      'Small talk essentials',
      'Describing interests',
      'Informal greetings',
      'Present tense mastery'
    ]
  },
  {
    id: 'ordering',
    title: 'At a Restaurant',
    description: 'Practice ordering food, asking for the bill, and making reservations.',
    icon: '🍕',
    prompt: 'You are a polite waiter at a busy restaurant. Start by greeting the customer.',
    details: [
      'Food & drink vocabulary',
      'Polite requests',
      'Quantities and numbers',
      'Handling payment'
    ]
  },
  {
    id: 'interview',
    title: 'Job Interview',
    description: 'Practice answering common interview questions in a professional setting.',
    icon: '💼',
    prompt: 'You are a professional HR manager. Conduct a formal interview for a software developer position.',
    details: [
      'Professional vocabulary',
      'Describing achievements',
      'Formal honorifics',
      'Future goals phrasing'
    ]
  },
  {
    id: 'travel',
    title: 'Travel & Airport',
    description: 'Practice checking in, asking for directions, and navigating a city.',
    icon: '✈️',
    prompt: 'You are an airport check-in agent. Guide the traveler through the check-in process.',
    details: [
      'Wayfinding phrases',
      'Emergency vocabulary',
      'Airport procedures',
      'Asking for help'
    ]
  }
];

export const DIFFICULTIES = ['Beginner', 'Intermediate', 'Advanced'] as const;

export const SYSTEM_PROMPT_TEMPLATE = (lang: string, scenario: string, difficulty: string) => `
You are a highly skilled and patient language tutor for a student learning ${lang}.
The current scenario is: ${scenario}.
The student's level is: ${difficulty}.

INSTRUCTIONS:
1. Speak exclusively in ${lang} as much as possible.
2. If the level is Beginner, use simple vocabulary, speak slowly, and occasionally provide short English translations for complex phrases.
3. If the level is Advanced, challenge the student with complex grammar and natural idioms.
4. Correct the student's mistakes gently after they finish speaking.
5. Keep the conversation engaging and ask open-ended questions.
6. Your goal is to help the student gain confidence in speaking.
`;
