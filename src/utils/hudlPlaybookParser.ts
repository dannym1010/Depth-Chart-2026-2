import { WhiteboardDrill } from '../components/whiteboard/whiteboardDrillData';
import { WhiteboardToken, WhiteboardArrow, WhiteboardTextElement, PlayResponsibility } from '../types';
import { HUDL_10U_DEFENSE_INSTALL_PLAYS, HUDL_DEFENSIVE_BASE_NOTES, BASE_44_RESPONSIBILITIES } from '../data/hudl10UDefenseData';

export interface HudlImportResult {
  plays: WhiteboardDrill[];
  playbookName: string;
  totalParsed: number;
}

/**
 * Parses raw text extracted from a Hudl Playbook PDF or clipboard export
 */
export function parseHudlTextToPlays(text: string, defaultName = 'Imported Hudl Playbook'): WhiteboardDrill[] {
  if (!text || !text.trim()) return [];

  // Check if text matches the 10U Mahopac Indians Defense Install
  const isMahopacDefense =
    text.includes('4-4 BASE STACK') ||
    text.includes('10U DEFENSE') ||
    text.includes('Pursuing Gap responsible defense') ||
    text.includes('BLOW STING') ||
    text.includes('DOUBLE DOG');

  if (isMahopacDefense) {
    return HUDL_10U_DEFENSE_INSTALL_PLAYS;
  }

  // Generic play parser
  const rawSections = text.split(/(?=Play\s*\d+|[0-9]+-[0-9]+\s+[A-Z]+|FORMATION:)/i).filter((s) => s.trim().length > 20);

  if (rawSections.length === 0) {
    // Single play parse
    const play = parseSinglePlaySection(text, 'Play 1', defaultName);
    return [play];
  }

  return rawSections.map((sec, idx) => {
    const lines = sec.trim().split('\n').map((l) => l.trim()).filter(Boolean);
    const title = lines[0] || `Play ${idx + 1}`;
    return parseSinglePlaySection(sec, title, defaultName);
  });
}

function parseSinglePlaySection(sectionText: string, title: string, playbookName: string): WhiteboardDrill {
  const lines = sectionText.split('\n').map((l) => l.trim()).filter(Boolean);
  const id = `hudl-play-${Date.now()}-${Math.floor(Math.random() * 10000)}`;

  // Extract formation name if present
  let formation = 'Standard Formation';
  const formationMatch = sectionText.match(/vs\s+([A-Z0-9\s]+)|Formation:\s*([^\n]+)/i);
  if (formationMatch) {
    formation = (formationMatch[1] || formationMatch[2] || 'Standard').trim();
  }

  // Detect stunts / blitzes
  const isBlitz = /blitz|dog|sting|fire|shoot|storm/i.test(title);
  const isCross = /cross|slant|twist/i.test(title);
  const isPinch = /pinch/i.test(title);
  const isFan = /fan/i.test(title);

  // Parse responsibilities table if present
  const responsibilities: PlayResponsibility[] = [];
  const posRegex = /\b(FS|SS|S|M|W|R|T3|T1|DT|NT|DE|E9|E5|E|C|CB|MLB|OLB|ILB)\b\s*[:|-]?\s*(.*?)(?=\b(FS|SS|S|M|W|R|T3|T1|DT|NT|DE|E9|E5|E|C|CB|MLB|OLB|ILB)\b|$)/gis;
  let match;

  while ((match = posRegex.exec(sectionText)) !== null) {
    const pos = match[1].toUpperCase();
    const details = match[2].trim();
    if (details.length > 3) {
      responsibilities.push({
        position: pos,
        alignment: 'Standard Alignment',
        runResponsibility: details.split('\n')[0] || details,
        passResponsibility: details.split('\n').slice(1).join(' ') || 'Zone coverage',
      });
    }
  }

  const finalResponsibilities = responsibilities.length >= 4 ? responsibilities : BASE_44_RESPONSIBILITIES;

  // Base Offense (21 L / Pro-I) - Spaced Out Alignment
  const offensiveTokens: WhiteboardToken[] = [
    { id: `off-c-${id}`, type: 'square', label: 'C', x: 350, y: 195, color: '#0f172a', isSquare: true },
    { id: `off-lg-${id}`, type: 'O', label: 'G', x: 306, y: 195, color: '#0f172a' },
    { id: `off-rg-${id}`, type: 'O', label: 'G', x: 394, y: 195, color: '#0f172a' },
    { id: `off-lt-${id}`, type: 'O', label: 'T', x: 262, y: 195, color: '#0f172a' },
    { id: `off-rt-${id}`, type: 'O', label: 'T', x: 438, y: 195, color: '#0f172a' },
    { id: `off-te-${id}`, type: 'O', label: 'Y', x: 218, y: 195, color: '#0f172a' },
    { id: `off-wr-z-${id}`, type: 'O', label: 'Z', x: 110, y: 195, color: '#0f172a' },
    { id: `off-wr-x-${id}`, type: 'O', label: 'X', x: 590, y: 195, color: '#0f172a' },
    { id: `off-qb-${id}`, type: 'O', label: '1', x: 350, y: 150, color: '#0f172a' },
    { id: `off-fb-${id}`, type: 'O', label: '2', x: 350, y: 105, color: '#0f172a' },
    { id: `off-tb-${id}`, type: 'O', label: '3', x: 350, y: 60, color: '#0f172a' },
  ];

  // Base Defense (4-4 Stack) - Spaced Out Red No-Fill Defensive Tokens
  const defensiveTokens: WhiteboardToken[] = [
    { id: `def-e9-${id}`, type: 'letter', label: 'E9', x: 190, y: 230, color: '#ef4444', fillMode: 'nofill' },
    { id: `def-t3-${id}`, type: 'letter', label: 'T3', x: 285, y: 230, color: '#ef4444', fillMode: 'nofill' },
    { id: `def-t1-${id}`, type: 'letter', label: 'T1', x: 380, y: 230, color: '#ef4444', fillMode: 'nofill' },
    { id: `def-e5-${id}`, type: 'letter', label: 'E5', x: 495, y: 230, color: '#ef4444', fillMode: 'nofill' },
    { id: `def-s-${id}`, type: 'letter', label: 'S', x: 190, y: 280, color: '#ef4444', fillMode: 'nofill' },
    { id: `def-m-${id}`, type: 'letter', label: 'M', x: 295, y: 290, color: '#ef4444', fillMode: 'nofill' },
    { id: `def-w-${id}`, type: 'letter', label: 'W', x: 395, y: 290, color: '#ef4444', fillMode: 'nofill' },
    { id: `def-r-${id}`, type: 'letter', label: 'R', x: 505, y: 280, color: '#ef4444', fillMode: 'nofill' },
    { id: `def-cl-${id}`, type: 'letter', label: 'C', x: 100, y: 260, color: '#ef4444', fillMode: 'nofill' },
    { id: `def-cr-${id}`, type: 'letter', label: 'C', x: 600, y: 260, color: '#ef4444', fillMode: 'nofill' },
    { id: `def-fs-${id}`, type: 'letter', label: 'FS', x: 350, y: 390, color: '#ef4444', fillMode: 'nofill' },
  ];

  // Stunt / Blitz arrows
  const arrows: WhiteboardArrow[] = [];
  if (isBlitz) {
    arrows.push(
      { id: `a-blitz-s-${id}`, type: 'curved', startX: 190, startY: 280, endX: 170, endY: 195, controlX: 175, controlY: 235, color: '#ef4444' },
      { id: `a-blitz-e9-${id}`, type: 'curved', startX: 190, startY: 230, endX: 240, endY: 195, controlX: 220, controlY: 205, color: '#ef4444' }
    );
  } else if (isCross) {
    arrows.push(
      { id: `a-t1-cross-${id}`, type: 'straight', startX: 380, startY: 230, endX: 330, endY: 195, color: '#ef4444' },
      { id: `a-t3-cross-${id}`, type: 'curved', startX: 285, startY: 230, endX: 400, endY: 195, controlX: 340, controlY: 240, color: '#ef4444' }
    );
  } else if (isFan) {
    arrows.push(
      { id: `a-t3-fan-${id}`, type: 'straight', startX: 285, startY: 230, endX: 260, endY: 195, color: '#ef4444' },
      { id: `a-t1-fan-${id}`, type: 'straight', startX: 380, startY: 230, endX: 410, endY: 195, color: '#ef4444' }
    );
  } else if (isPinch) {
    arrows.push(
      { id: `a-e5-pinch-${id}`, type: 'straight', startX: 495, startY: 230, endX: 460, endY: 195, color: '#ef4444' },
      { id: `a-t1-pinch-${id}`, type: 'straight', startX: 380, startY: 230, endX: 360, endY: 195, color: '#ef4444' },
      { id: `a-t3-pinch-${id}`, type: 'straight', startX: 285, startY: 230, endX: 310, endY: 195, color: '#ef4444' },
      { id: `a-e9-pinch-${id}`, type: 'straight', startX: 190, startY: 230, endX: 225, endY: 195, color: '#ef4444' }
    );
  }

  const textElements: WhiteboardTextElement[] = [
    {
      id: `txt-notes-${id}`,
      text: '-Flow = direction of the ball\n-We are a Pursuing Gap responsible defense\n-something goes away something is coming back.\n11 guys on the tackle every play',
      x: 95,
      y: 440,
      fontSize: 11,
      color: '#1e293b',
      fontWeight: '700',
      align: 'left',
    },
  ];

  return {
    id,
    category: 'SCHEME',
    categoryLabel: 'Hudl Install',
    title: title.toUpperCase(),
    subtitle: formation,
    objective: `Complete defensive scheme and assignment package for ${title}. Gap sound, high-motor pursuit defense.`,
    setup: `Offense aligned in ${formation}. Line of scrimmage set at 20-yard line. 11 guys pursuing gap responsibility.`,
    cues: [
      '"Flow = direction of the ball!"',
      '"We are a Pursuing Gap responsible defense!"',
      '"Something goes away, something is coming back!"',
      '"11 guys on the tackle every play!"',
    ],
    faults: ['Losing outside edge contain.', 'Biting on play-action counter.'],
    notes: HUDL_DEFENSIVE_BASE_NOTES,
    responsibilities: finalResponsibilities,
    hudlPlaybookName: playbookName,
    formationName: formation,
    phases: [
      {
        name: 'Base Alignment & Stunt',
        description: `Alignment and assignments for ${title}`,
        tokens: [...offensiveTokens, ...defensiveTokens],
        arrows,
        zones: [],
        textElements,
      },
    ],
  };
}

/**
 * Extracts text from an uploaded PDF file in browser using pdfjs-dist
 */
export async function extractTextFromPdf(file: File): Promise<string> {
  try {
    const pdfjsLib = await import('pdfjs-dist');
    // Set worker src or configure for vite
    if (!pdfjsLib.GlobalWorkerOptions.workerSrc) {
      pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version || '4.10.38'}/pdf.worker.min.mjs`;
    }

    const arrayBuffer = await file.arrayBuffer();
    const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
    const pdf = await loadingTask.promise;
    let fullText = '';

    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const textContent = await page.getTextContent();
      const pageText = textContent.items
        .map((item: any) => item.str || '')
        .join(' ');
      fullText += `\n--- PAGE ${i} ---\n` + pageText;
    }

    return fullText;
  } catch (err) {
    console.warn('Direct PDF text extraction failed, falling back to binary string inspection:', err);
    // Fallback binary reader for text streams in PDF
    const buffer = await file.arrayBuffer();
    const decoder = new TextDecoder('utf-8', { fatal: false });
    const raw = decoder.decode(buffer);
    return raw;
  }
}
