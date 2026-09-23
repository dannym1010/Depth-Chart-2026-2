import { carmelLast2GamesCsv } from './carmelData';

export interface SampleDataset {
  id: string;
  name: string;
  opponent: string;
  offensiveScheme: string;
  description: string;
  playCount: number;
  csvContent: string;
}

// Only the uploaded Carmel dataset is kept. All non-uploaded datasets have been removed.
export const SAMPLE_DATASETS: SampleDataset[] = [
  {
    id: 'carmel-last-2-games',
    name: 'Carmel High School (Last 2 Games)',
    opponent: 'Carmel High School',
    offensiveScheme: 'Carmel High School',
    description: '156 Total Hudl Snaps (52 Carmel Offense, 56 Carmel Defense, Kicking & Stoppages). Standard Hudl ODK dataset.',
    playCount: 156,
    csvContent: carmelLast2GamesCsv,
  },
];
