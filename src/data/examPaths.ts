import { ExamPath } from '../types';

export const DEFAULT_EXAM_PATHS: ExamPath[] = [
  {
    category: 'IELTS',
    title: 'IELTS',
    description: 'Build your skills. Get your bands.',
    bgImage: '/images/exams/ielts.jpg',
    badgeText: 'GB',
    scriptWords: ['Study', 'Work', 'Settle'],
    redirectTarget: 'catalog',
  },
  {
    category: 'OET',
    title: 'OET',
    description: 'Your career in healthcare, starts here.',
    bgImage: '/images/exams/oet.jpg',
    isMedicalCross: true,
    scriptWords: ['Care', 'Connect', 'Grow'],
    redirectTarget: 'catalog',
  },
  {
    category: 'PTE',
    title: 'PTE',
    description: 'Prove your English. Open global opportunities.',
    bgImage: '/images/exams/pte.jpg',
    badgeText: 'PTE',
    scriptWords: ['Global', 'Career', 'Ahead'],
    redirectTarget: 'catalog',
  },
  {
    category: 'German',
    title: 'German',
    description: 'Learn German. Expand your world.',
    bgImage: '/images/exams/german.jpg',
    badgeText: 'DE',
    scriptWords: ['Learn', 'Explore', 'Belong'],
    redirectTarget: 'catalog',
  },
];
