import React, { useRef, useEffect, useState, useCallback } from 'react';
import { WhiteboardToken, WhiteboardArrow, WhiteboardZoneBubble, WhiteboardTextElement } from '../../types';
import {
  Trash2,
  Edit2,
  Move,
  Type,
  Plus,
  Check,
  X,
  Maximize2,
  Minimize2,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Shield,
  CircleDot,
  Zap,
  Play,
  Pause,
  Repeat,
  Square,
  Circle,
  Triangle,
  Star,
  Copy,
  Palette,
} from 'lucide-react';

export function isColorLight(colorHex?: string): boolean {
  if (!colorHex) return false;
  if (colorHex === '#ffffff' || colorHex.toLowerCase() === 'white') return true;
  const hex = colorHex.replace('#', '');
  if (hex.length === 6) {
    const r = parseInt(hex.substring(0, 2), 16);
    const g = parseInt(hex.substring(2, 4), 16);
    const b = parseInt(hex.substring(4, 6), 16);
    const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    return luminance > 0.65;
  }
  return false;
}

export function isDefenseToken(token: WhiteboardToken): boolean {
  if (token.type === 'letter' || token.type === 'X') return true;
  const idLower = (token.id || '').toLowerCase();
  if (idLower.startsWith('def-') || idLower.startsWith('d-') || idLower.includes('def')) return true;
  if (token.type === 'square' || token.isSquare) return false;
  const defLabels = [
    'E', 'T', 'N', 'DE', 'DT', 'NT', 'E9', 'T3', 'T1', 'E5',
    'MLB', 'OLB', 'ILB', 'M', 'W', 'S', 'R', 'FS', 'SS', 'CB',
    'C1', 'C2', 'SAM', 'MIKE', 'WILL', 'ROV', 'BUCK', 'NB', 'DB', 'LB', 'DL', 'ROVER', 'FREE', 'STRONG'
  ];
  const lbl = (token.label || '').trim().toUpperCase();
  if (defLabels.includes(lbl)) {
    // If it's a Center with square or y < 200, check if offense
    if (lbl === 'C' && token.y <= 200) return false;
    return true;
  }
  return false;
}

export function isOffenseToken(token: WhiteboardToken): boolean {
  if (token.type === 'square' || token.isSquare) return true;
  if (token.type === 'O') return true;
  const idLower = (token.id || '').toLowerCase();
  if (idLower.startsWith('off-') || idLower.startsWith('o-') || idLower.includes('off')) return true;
  const offLabels = ['C', 'LG', 'RG', 'LT', 'RT', 'TE', 'WR', 'QB', 'FB', 'TB', 'HB', 'RB', 'SB', 'Z', 'Y', 'H', 'F', 'X', '1', '2', '3', '4'];
  const lbl = (token.label || '').trim().toUpperCase();
  if (offLabels.includes(lbl) && !isDefenseToken(token)) return true;
  return false;
}

interface WhiteboardCanvasProps {
  tokens: WhiteboardToken[];
  arrows: WhiteboardArrow[];
  zones: WhiteboardZoneBubble[];
  textElements?: WhiteboardTextElement[];
  isDrawingMode: boolean;
  penColor: string;
  penWidth: number;
  stampMode: 'none' | 'O' | 'X' | 'letter' | 'blitz' | 'zone' | 'text' | 'square' | 'triangle' | 'diamond' | 'circle_zone' | 'star';
  stampLabel: string;
  stampColor?: string;
  stampFillMode?: 'fill' | 'nofill';
  stampZoneShape?: 'ellipse' | 'circle' | 'rect';
  onUpdateTokens: (tokens: WhiteboardToken[]) => void;
  onUpdateArrows: (arrows: WhiteboardArrow[]) => void;
  onUpdateZones: (zones: WhiteboardZoneBubble[]) => void;
  onUpdateTextElements?: (texts: WhiteboardTextElement[]) => void;
  onSelectElement: (type: 'token' | 'arrow' | 'zone' | 'text' | null, id: string | null) => void;
  selectedId: string | null;
  selectedType: 'token' | 'arrow' | 'zone' | 'text' | null;
  sketchPadRef: React.RefObject<HTMLCanvasElement | null>;
  diagramKeys?: { text: string; isHighlight?: boolean }[];
  showCoachingInset?: boolean;
  showLabels?: boolean;
  zoneShadeMode?: 'dim' | 'soft' | 'outline' | 'standard';
  fieldTheme?: 'professional_hudl' | 'classic_chalk' | 'grass';
  fieldSizePreset?: 'standard' | 'wide' | 'jumbo' | 'stadium';
  readOnly?: boolean;
}

export const WhiteboardCanvas: React.FC<WhiteboardCanvasProps> = ({
  tokens,
  arrows,
  zones,
  textElements = [],
  isDrawingMode,
  penColor,
  penWidth,
  stampMode,
  stampLabel,
  stampColor,
  stampFillMode = 'fill',
  stampZoneShape = 'circle',
  onUpdateTokens,
  onUpdateArrows,
  onUpdateZones,
  onUpdateTextElements,
  onSelectElement,
  selectedId,
  selectedType,
  sketchPadRef,
  diagramKeys,
  showCoachingInset = false,
  showLabels = true,
  zoneShadeMode = 'dim',
  fieldSizePreset = 'wide',
  readOnly = false,
}) => {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const svgContainerRef = useRef<HTMLDivElement | null>(null);

  // Field size & zoom controls
  const [fieldViewMode, setFieldViewMode] = useState<'standard' | 'wide' | 'jumbo' | 'stadium'>(fieldSizePreset);
  const [zoomLevel, setZoomLevel] = useState<number>(1.0);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);

  // Measure actual DOM dimensions of the SVG viewing area so viewBox matches exact aspect ratio
  const [svgDimensions, setSvgDimensions] = useState<{ width: number; height: number }>({
    width: 1100,
    height: 600,
  });

  useEffect(() => {
    const el = svgContainerRef.current;
    if (!el) return;

    const measure = () => {
      const rect = el.getBoundingClientRect();
      if (rect.width > 50 && rect.height > 50) {
        setSvgDimensions({
          width: Math.round(rect.width),
          height: Math.round(rect.height),
        });
      }
    };

    measure();
    const ro = new ResizeObserver(() => measure());
    ro.observe(el);
    window.addEventListener('resize', measure);
    return () => {
      ro.disconnect();
      window.removeEventListener('resize', measure);
    };
  }, []);

  // Play Animation Engine State
  const [isAnimationMode, setIsAnimationMode] = useState<boolean>(false);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [animProgress, setAnimProgress] = useState<number>(0);
  const [animSpeed, setAnimSpeed] = useState<number>(1.0);
  const [isLooping, setIsLooping] = useState<boolean>(true);
  const [showTrails, setShowTrails] = useState<boolean>(true);
  const animFrameRef = useRef<number | null>(null);
  const lastTimestampRef = useRef<number | null>(null);

  // Editing text inline
  const [editingTextId, setEditingTextId] = useState<string | null>(null);
  const [editingTextValue, setEditingTextValue] = useState('');

  // Dragging state supporting tokens, text elements, arrow parts, and zone parts
  const [dragState, setDragState] = useState<{
    type:
      | 'token'
      | 'text'
      | 'arrow-start'
      | 'arrow-end'
      | 'arrow-control'
      | 'arrow-whole'
      | 'arrow-label'
      | 'zone-body'
      | 'zone-resize'
      | 'zone-label';
    id: string;
    offsetX: number;
    offsetY: number;
    initialData?: any;
  } | null>(null);

  // Freehand drawing state
  const [isDrawing, setIsDrawing] = useState(false);

  // Center of football play action (LOS is y=200, Center is x=350)
  const centerX = 350;
  const centerY = 230;

  // Base height per preset mode:
  const baseTargetHeight =
    fieldViewMode === 'standard'
      ? 500
      : fieldViewMode === 'wide'
      ? 560
      : fieldViewMode === 'jumbo'
      ? 620
      : 700;

  // Maintain aspect ratio matching the exact container viewing dimensions
  const aspect =
    svgDimensions.width > 0 && svgDimensions.height > 0
      ? svgDimensions.width / svgDimensions.height
      : 1.65;

  // ViewBox height and width scaled inversely by zoomLevel
  const viewBoxHeight = Math.round(baseTargetHeight / zoomLevel);
  const viewBoxWidth = Math.round(viewBoxHeight * aspect);

  const viewBoxMinX = Math.round(centerX - viewBoxWidth / 2);
  const viewBoxMinY = Math.round(centerY - viewBoxHeight / 2);
  const viewBoxStr = `${viewBoxMinX} ${viewBoxMinY} ${viewBoxWidth} ${viewBoxHeight}`;

  // Dynamic field boundaries extending to the full visible canvas (seamlessly filling the entire area without white borders)
  const fieldLeft = viewBoxMinX;
  const fieldRight = viewBoxMinX + viewBoxWidth;
  const fieldTop = viewBoxMinY;
  const fieldBottom = viewBoxMinY + viewBoxHeight;
  const fieldWidth = fieldRight - fieldLeft;
  const fieldHeight = fieldBottom - fieldTop;

  // Animation Loop via requestAnimationFrame
  useEffect(() => {
    if (!isPlaying) {
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current);
        animFrameRef.current = null;
      }
      lastTimestampRef.current = null;
      return;
    }

    const loop = (timestamp: number) => {
      if (lastTimestampRef.current === null) {
        lastTimestampRef.current = timestamp;
      }
      const elapsed = timestamp - lastTimestampRef.current;
      lastTimestampRef.current = timestamp;

      const duration = 2800 / animSpeed;
      const delta = elapsed / duration;

      setAnimProgress((prev) => {
        const next = prev + delta;
        if (next >= 1.0) {
          if (isLooping) {
            return 0;
          } else {
            setIsPlaying(false);
            return 1.0;
          }
        }
        return next;
      });

      animFrameRef.current = requestAnimationFrame(loop);
    };

    animFrameRef.current = requestAnimationFrame(loop);

    return () => {
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current);
      }
    };
  }, [isPlaying, animSpeed, isLooping]);

  // Spacebar to toggle Play/Pause when in Animation Mode
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.code === 'Space' && isAnimationMode && document.activeElement?.tagName !== 'INPUT') {
        e.preventDefault();
        setIsPlaying((p) => !p);
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [isAnimationMode]);

  // Helper to get animated coordinates and matching arrow for a token
  const getAnimatedTokenInfo = useCallback(
    (token: WhiteboardToken) => {
      if (!isAnimationMode || animProgress === 0) {
        return { currentX: token.x, currentY: token.y, matchingArrow: null };
      }

      let closestArrow: WhiteboardArrow | null = null;
      let minDistance = 50;

      for (const arrow of arrows) {
        const dx = arrow.startX - token.x;
        const dy = arrow.startY - token.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < minDistance) {
          minDistance = dist;
          closestArrow = arrow;
        }
      }

      if (!closestArrow) {
        if (isDefenseToken(token) && token.y < 200) {
          return { currentX: token.x, currentY: token.y + animProgress * 15, matchingArrow: null };
        }
        return { currentX: token.x, currentY: token.y, matchingArrow: null };
      }

      const t = animProgress;
      if (closestArrow.controlX !== undefined && closestArrow.controlY !== undefined) {
        const u = 1 - t;
        const curX = u * u * closestArrow.startX + 2 * u * t * closestArrow.controlX + t * t * closestArrow.endX;
        const curY = u * u * closestArrow.startY + 2 * u * t * closestArrow.controlY + t * t * closestArrow.endY;
        return { currentX: curX, currentY: curY, matchingArrow: closestArrow };
      } else {
        const curX = closestArrow.startX + t * (closestArrow.endX - closestArrow.startX);
        const curY = closestArrow.startY + t * (closestArrow.endY - closestArrow.startY);
        return { currentX: curX, currentY: curY, matchingArrow: closestArrow };
      }
    },
    [isAnimationMode, animProgress, arrows]
  );

  // Helper to get SVG coordinates from mouse or touch
  const getSvgCoordinates = useCallback(
    (clientX: number, clientY: number) => {
      if (!svgRef.current) return { x: 0, y: 0 };
      const svg = svgRef.current;
      const pt = svg.createSVGPoint();
      pt.x = clientX;
      pt.y = clientY;
      const svgP = pt.matrixTransform(svg.getScreenCTM()?.inverse());
      return {
        x: Math.round(Math.max(fieldLeft + 4, Math.min(fieldRight - 4, svgP.x))),
        y: Math.round(Math.max(fieldTop + 4, Math.min(fieldBottom - 4, svgP.y))),
      };
    },
    [fieldLeft, fieldRight, fieldTop, fieldBottom]
  );

  // Handle escape key to exit fullscreen
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isFullscreen) {
        setIsFullscreen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isFullscreen]);

  // Handle Canvas Resize for Sketch Pad
  useEffect(() => {
    const handleResize = () => {
      if (!containerRef.current || !sketchPadRef.current) return;
      const canvas = sketchPadRef.current;
      const rect = containerRef.current.getBoundingClientRect();
      if (canvas.width !== rect.width || canvas.height !== rect.height) {
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = canvas.width;
        tempCanvas.height = canvas.height;
        const tempCtx = tempCanvas.getContext('2d');
        if (tempCtx && canvas.width > 0 && canvas.height > 0) {
          tempCtx.drawImage(canvas, 0, 0);
        }
        canvas.width = rect.width;
        canvas.height = rect.height;
        const ctx = canvas.getContext('2d');
        if (ctx && tempCanvas.width > 0 && tempCanvas.height > 0) {
          ctx.drawImage(tempCanvas, 0, 0, rect.width, rect.height);
        }
      }
    };

    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [sketchPadRef]);

  // Canvas Drawing Handlers
  const handleCanvasMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawingMode || !sketchPadRef.current || readOnly) return;
    const canvas = sketchPadRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.strokeStyle = penColor;
    ctx.lineWidth = penWidth;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    setIsDrawing(true);
  };

  const handleCanvasMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing || !isDrawingMode || !sketchPadRef.current || readOnly) return;
    const canvas = sketchPadRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const handleCanvasMouseUp = () => {
    setIsDrawing(false);
  };

  const handleCanvasTouchStart = (e: React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawingMode || !sketchPadRef.current || e.touches.length === 0 || readOnly) return;
    e.preventDefault();
    const canvas = sketchPadRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const rect = canvas.getBoundingClientRect();
    const touch = e.touches[0];
    const x = touch.clientX - rect.left;
    const y = touch.clientY - rect.top;

    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.strokeStyle = penColor;
    ctx.lineWidth = penWidth;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    setIsDrawing(true);
  };

  const handleCanvasTouchMove = (e: React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawing || !isDrawingMode || !sketchPadRef.current || e.touches.length === 0 || readOnly) return;
    e.preventDefault();
    const canvas = sketchPadRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const rect = canvas.getBoundingClientRect();
    const touch = e.touches[0];
    const x = touch.clientX - rect.left;
    const y = touch.clientY - rect.top;

    ctx.lineTo(x, y);
    ctx.stroke();
  };

  // Stamp click on SVG field
  const handleSvgClick = (e: React.MouseEvent<SVGSVGElement>) => {
    if (isDrawingMode || readOnly) return;
    if (stampMode === 'none') {
      // Deselect if clicking on empty field background
      if (e.target === svgRef.current || (e.target as HTMLElement).id === 'fieldBackground') {
        onSelectElement(null, null);
        setEditingTextId(null);
      }
      return;
    }

    const { x, y } = getSvgCoordinates(e.clientX, e.clientY);

    if (stampMode === 'triangle') {
      const newToken: WhiteboardToken = {
        id: `tri-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        type: 'triangle',
        label: stampLabel || 'S',
        x,
        y,
        color: stampColor || '#dc2626',
        fillMode: stampFillMode || 'fill',
      };
      onUpdateTokens([...tokens, newToken]);
      onSelectElement('token', newToken.id);
    } else if (stampMode === 'diamond') {
      const newToken: WhiteboardToken = {
        id: `dia-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        type: 'diamond',
        label: stampLabel || 'H',
        x,
        y,
        color: stampColor || '#1d4ed8',
        fillMode: stampFillMode || 'fill',
      };
      onUpdateTokens([...tokens, newToken]);
      onSelectElement('token', newToken.id);
    } else if (stampMode === 'star') {
      const newToken: WhiteboardToken = {
        id: `star-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        type: 'star',
        label: stampLabel || '*',
        x,
        y,
        color: stampColor || '#d97706',
        fillMode: stampFillMode || 'fill',
      };
      onUpdateTokens([...tokens, newToken]);
      onSelectElement('token', newToken.id);
    } else if (stampMode === 'circle_zone') {
      const newZone: WhiteboardZoneBubble = {
        id: `zone-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        name: stampLabel || 'ZONE',
        cx: x,
        cy: y,
        rx: 52,
        ry: 52,
        shape: 'circle',
        fillMode: stampFillMode || 'fill',
        color: stampColor || '#0284c7',
        opacity: 0.22,
      };
      onUpdateZones([...zones, newZone]);
      onSelectElement('zone', newZone.id);
    } else if (stampMode === 'O') {
      const newToken: WhiteboardToken = {
        id: `o-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        type: 'O',
        label: stampLabel || '',
        x,
        y,
        color: stampColor || (stampLabel === 'C' ? '#1d4ed8' : '#1d4ed8'),
        fillMode: stampFillMode || 'fill',
      };
      onUpdateTokens([...tokens, newToken]);
      onSelectElement('token', newToken.id);
    } else if (stampMode === 'square') {
      const newToken: WhiteboardToken = {
        id: `sq-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        type: 'square',
        label: stampLabel || 'C',
        x,
        y,
        color: stampColor || '#1d4ed8',
        fillMode: stampFillMode || 'fill',
        isSquare: true,
      };
      onUpdateTokens([...tokens, newToken]);
      onSelectElement('token', newToken.id);
    } else if (stampMode === 'letter' || stampMode === 'X') {
      const newToken: WhiteboardToken = {
        id: `def-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        type: stampMode === 'X' ? 'X' : 'letter',
        label: stampLabel || (stampMode === 'X' ? 'X' : 'M'),
        x,
        y,
        color: stampColor || '#dc2626',
        fillMode: stampFillMode || 'fill',
      };
      onUpdateTokens([...tokens, newToken]);
      onSelectElement('token', newToken.id);
    } else if (stampMode === 'text') {
      const newText: WhiteboardTextElement = {
        id: `txt-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        text: stampLabel || 'Coaching Note',
        x,
        y,
        fontSize: 11,
        color: stampColor || '#0f172a',
        fontWeight: '700',
        align: 'left',
      };
      if (onUpdateTextElements) {
        onUpdateTextElements([...textElements, newText]);
      }
      onSelectElement('text', newText.id);
    } else if (stampMode === 'blitz') {
      const newArrow: WhiteboardArrow = {
        id: `arrow-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        type: 'blitz',
        startX: x,
        startY: y,
        endX: x,
        endY: Math.max(40, y - 70),
        color: stampColor || '#dc2626',
        label: stampLabel || '',
      };
      onUpdateArrows([...arrows, newArrow]);
      onSelectElement('arrow', newArrow.id);
    } else if (stampMode === 'zone') {
      const newZone: WhiteboardZoneBubble = {
        id: `zone-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        name: stampLabel || 'DEEP 1/3',
        cx: x,
        cy: y,
        rx: 75,
        ry: 35,
        shape: stampZoneShape || 'ellipse',
        fillMode: stampFillMode || 'fill',
        color: stampColor || '#0284c7',
        opacity: 0.18,
      };
      onUpdateZones([...zones, newZone]);
      onSelectElement('zone', newZone.id);
    }
  };

  // Pointer move during drag
  const handlePointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
    if (!dragState || readOnly) return;

    const { x, y } = getSvgCoordinates(e.clientX, e.clientY);

    if (dragState.type === 'token') {
      onUpdateTokens(
        tokens.map((t) =>
          t.id === dragState.id
            ? { ...t, x: Math.round(x - dragState.offsetX), y: Math.round(y - dragState.offsetY) }
            : t
        )
      );
    } else if (dragState.type === 'text') {
      if (onUpdateTextElements) {
        onUpdateTextElements(
          textElements.map((txt) =>
            txt.id === dragState.id
              ? { ...txt, x: Math.round(x - dragState.offsetX), y: Math.round(y - dragState.offsetY) }
              : txt
          )
        );
      }
    } else if (dragState.type === 'arrow-start') {
      onUpdateArrows(
        arrows.map((a) => (a.id === dragState.id ? { ...a, startX: x, startY: y } : a))
      );
    } else if (dragState.type === 'arrow-end') {
      onUpdateArrows(
        arrows.map((a) => (a.id === dragState.id ? { ...a, endX: x, endY: y } : a))
      );
    } else if (dragState.type === 'arrow-control') {
      onUpdateArrows(
        arrows.map((a) => (a.id === dragState.id ? { ...a, controlX: x, controlY: y } : a))
      );
    } else if (dragState.type === 'arrow-label') {
      onUpdateArrows(
        arrows.map((a) => (a.id === dragState.id ? { ...a, labelX: x, labelY: y } : a))
      );
    } else if (dragState.type === 'arrow-whole') {
      const dx = x - dragState.initialData.mouseX;
      const dy = y - dragState.initialData.mouseY;
      onUpdateArrows(
        arrows.map((a) => {
          if (a.id !== dragState.id) return a;
          const init = dragState.initialData;
          return {
            ...a,
            startX: Math.round(init.startX + dx),
            startY: Math.round(init.startY + dy),
            endX: Math.round(init.endX + dx),
            endY: Math.round(init.endY + dy),
            controlX: a.controlX !== undefined ? Math.round(init.controlX + dx) : undefined,
            controlY: a.controlY !== undefined ? Math.round(init.controlY + dy) : undefined,
            labelX: a.labelX !== undefined ? Math.round(init.labelX + dx) : undefined,
            labelY: a.labelY !== undefined ? Math.round(init.labelY + dy) : undefined,
          };
        })
      );
    } else if (dragState.type === 'zone-body') {
      onUpdateZones(
        zones.map((z) =>
          z.id === dragState.id
            ? { ...z, cx: Math.round(x - dragState.offsetX), cy: Math.round(y - dragState.offsetY) }
            : z
        )
      );
    } else if (dragState.type === 'zone-label') {
      onUpdateZones(
        zones.map((z) => (z.id === dragState.id ? { ...z, labelX: x, labelY: y } : z))
      );
    } else if (dragState.type === 'zone-resize') {
      const zone = zones.find((z) => z.id === dragState.id);
      if (zone) {
        if (zone.shape === 'circle') {
          const radius = Math.max(25, Math.round(Math.sqrt((x - zone.cx) ** 2 + (y - zone.cy) ** 2)));
          onUpdateZones(
            zones.map((z) => (z.id === dragState.id ? { ...z, rx: radius, ry: radius } : z))
          );
        } else {
          const newRx = Math.max(25, Math.abs(x - zone.cx));
          const newRy = Math.max(18, Math.abs(y - zone.cy));
          onUpdateZones(
            zones.map((z) => (z.id === dragState.id ? { ...z, rx: newRx, ry: newRy } : z))
          );
        }
      }
    }
  };

  const handlePointerUp = () => {
    setDragState(null);
  };

  // Delete selected item
  const handleDeleteSelected = () => {
    if (!selectedId) return;
    if (selectedType === 'token') {
      onUpdateTokens(tokens.filter((t) => t.id !== selectedId));
    } else if (selectedType === 'arrow') {
      onUpdateArrows(arrows.filter((a) => a.id !== selectedId));
    } else if (selectedType === 'zone') {
      onUpdateZones(zones.filter((z) => z.id !== selectedId));
    } else if (selectedType === 'text' && onUpdateTextElements) {
      onUpdateTextElements(textElements.filter((txt) => txt.id !== selectedId));
    }
    onSelectElement(null, null);
  };

  // Save edited text
  const handleSaveTextEdit = () => {
    if (!editingTextId || !onUpdateTextElements) return;
    onUpdateTextElements(
      textElements.map((txt) => (txt.id === editingTextId ? { ...txt, text: editingTextValue } : txt))
    );
    setEditingTextId(null);
  };

  return (
    <div
      ref={containerRef}
      className={`relative w-full h-full select-none overflow-hidden bg-white rounded-xl shadow-inner border border-slate-300 flex flex-col ${
        isFullscreen
          ? 'fixed inset-0 z-50 rounded-none border-none shadow-2xl bg-slate-950 flex flex-col p-3 sm:p-5'
          : 'min-h-[560px] sm:min-h-[640px]'
      }`}
      style={{
        background: isFullscreen ? '#020617' : '#ffffff',
      }}
    >
      {/* 0. PRO TOP FIELD TOOLBAR: Offense/Defense Legend + Field Zoom & View Controls */}
      <div className="w-full bg-slate-900 text-white px-3 sm:px-4 py-2 flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 z-30 text-xs select-none">
        {/* Left: High-Contrast Legend Bar */}
        <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
          <div className="flex items-center gap-1.5 bg-blue-950/80 border border-blue-600/70 px-2.5 py-1 rounded-md">
            <span className="w-3.5 h-3.5 rounded-full bg-white border-2 border-blue-600 flex items-center justify-center font-bold text-[9px] text-blue-800">
              O
            </span>
            <span className="font-extrabold tracking-wide text-blue-200 text-[11px]">
              OFFENSE (Blue & White)
            </span>
          </div>

          <div className="flex items-center gap-1.5 bg-red-950/80 border border-red-600/70 px-2.5 py-1 rounded-md">
            <span className="w-3.5 h-3.5 rounded-full bg-red-600 border border-red-400 shadow-sm flex items-center justify-center font-bold text-[8px] text-white">
              D
            </span>
            <span className="font-extrabold tracking-wide text-red-200 text-[11px]">
              DEFENSE (Crimson Red)
            </span>
          </div>

          <div className="hidden md:flex items-center gap-1 text-[11px] text-slate-400">
            <Zap className="w-3 h-3 text-red-400" />
            <span>Rush/Stunt</span>
            <span className="mx-1 text-slate-600">•</span>
            <Shield className="w-3 h-3 text-sky-400" />
            <span>Zones</span>
          </div>
        </div>

        {/* Right: Field View Selector + Extended Zoom + Animate Play + Fullscreen */}
        <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
          {/* Field Size Presets */}
          <div className="flex items-center bg-slate-800 p-0.5 rounded-lg border border-slate-700">
            <button
              type="button"
              onClick={() => setFieldViewMode('standard')}
              title="Standard Field (4:3)"
              className={`px-2 py-0.5 rounded text-[10.5px] font-bold transition-colors ${
                fieldViewMode === 'standard' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-300 hover:text-white'
              }`}
            >
              Standard
            </button>
            <button
              type="button"
              onClick={() => setFieldViewMode('wide')}
              title="Pro Wide Field (More sideline and backfield space)"
              className={`px-2.5 py-0.5 rounded text-[10.5px] font-bold transition-colors ${
                fieldViewMode === 'wide' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-300 hover:text-white'
              }`}
            >
              Pro Wide
            </button>
            <button
              type="button"
              onClick={() => setFieldViewMode('jumbo')}
              title="Jumbo Field (Maximum width for spread formations)"
              className={`px-2 py-0.5 rounded text-[10.5px] font-bold transition-colors ${
                fieldViewMode === 'jumbo' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-300 hover:text-white'
              }`}
            >
              Jumbo
            </button>
            <button
              type="button"
              onClick={() => setFieldViewMode('stadium')}
              title="Stadium Arena (Extended field filling the whole area)"
              className={`px-2.5 py-0.5 rounded text-[10.5px] font-bold transition-colors ${
                fieldViewMode === 'stadium' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-300 hover:text-white'
              }`}
            >
              Stadium
            </button>
          </div>

          {/* Extended Zoom Controls */}
          <div className="flex items-center bg-slate-800 p-0.5 rounded-lg border border-slate-700">
            <button
              type="button"
              onClick={() => setZoomLevel((z) => Math.max(0.40, Math.round((z - 0.15) * 100) / 100))}
              title="Zoom Out (Down to 40%)"
              className="p-1 text-slate-300 hover:text-white rounded hover:bg-slate-700 cursor-pointer"
            >
              <ZoomOut className="w-3.5 h-3.5" />
            </button>
            <span className="text-[10px] font-mono px-1.5 font-bold text-slate-300 min-w-[36px] text-center">
              {Math.round(zoomLevel * 100)}%
            </span>
            <button
              type="button"
              onClick={() => setZoomLevel((z) => Math.min(2.0, Math.round((z + 0.15) * 100) / 100))}
              title="Zoom In (Up to 200%)"
              className="p-1 text-slate-300 hover:text-white rounded hover:bg-slate-700 cursor-pointer"
            >
              <ZoomIn className="w-3.5 h-3.5" />
            </button>
            {zoomLevel !== 1.0 && (
              <button
                type="button"
                onClick={() => setZoomLevel(1.0)}
                title="Reset Zoom to 100%"
                className="p-1 text-amber-400 hover:text-amber-300 rounded hover:bg-slate-700 cursor-pointer ml-0.5"
              >
                <RotateCcw className="w-3 h-3" />
              </button>
            )}
          </div>

          {/* Dedicated Play Animation Button */}
          <button
            type="button"
            onClick={() => {
              const next = !isAnimationMode;
              setIsAnimationMode(next);
              if (next) {
                setIsPlaying(true);
              } else {
                setIsPlaying(false);
                setAnimProgress(0);
              }
            }}
            title="Animate the play movements along routes and assignments"
            className={`px-2.5 py-1 rounded-lg font-bold text-[11px] transition-all flex items-center gap-1.5 cursor-pointer border ${
              isAnimationMode
                ? 'bg-emerald-600 border-emerald-400 text-white shadow-md ring-2 ring-emerald-400/40'
                : 'bg-slate-800 hover:bg-slate-700 border-slate-700 text-slate-200 hover:text-white'
            }`}
          >
            <Play className={`w-3.5 h-3.5 ${isAnimationMode && isPlaying ? 'fill-amber-300 text-amber-300 animate-pulse' : 'fill-current'}`} />
            <span>{isAnimationMode ? (isPlaying ? 'Playing...' : 'Paused') : 'Animate Play'}</span>
          </button>

          {/* Fullscreen Toggle */}
          <button
            type="button"
            onClick={() => setIsFullscreen((prev) => !prev)}
            title={isFullscreen ? 'Exit Fullscreen (Esc)' : 'Expand Fullscreen Field'}
            className="p-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 hover:text-white rounded-lg transition-colors cursor-pointer flex items-center gap-1"
          >
            {isFullscreen ? (
              <>
                <Minimize2 className="w-3.5 h-3.5 text-amber-400" />
                <span className="text-[10.5px] font-bold text-amber-400 hidden sm:inline">Exit</span>
              </>
            ) : (
              <>
                <Maximize2 className="w-3.5 h-3.5" />
                <span className="text-[10.5px] font-bold hidden sm:inline">Expand</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Floating Comprehensive Inspector for Selected Item */}
      {selectedId && !readOnly && !isDrawingMode && (
        <div className="absolute top-14 right-3 z-30 flex items-center gap-2 flex-wrap bg-slate-900/95 text-white px-3 py-1.5 rounded-xl shadow-2xl backdrop-blur-md border border-slate-700 text-xs animate-in fade-in max-w-[95%]">
          <span className="font-bold text-slate-300 capitalize text-[11px]">
            {selectedType}:
          </span>

          {/* Token Customization Inspector */}
          {selectedType === 'token' && (() => {
            const token = tokens.find((t) => t.id === selectedId);
            if (!token) return null;
            return (
              <div className="flex items-center gap-2 flex-wrap">
                {/* Text / Label Input */}
                <div className="flex items-center bg-slate-800 rounded px-1.5 py-0.5 border border-slate-700">
                  <span className="text-[10px] text-slate-400 mr-1 font-bold">Text:</span>
                  <input
                    type="text"
                    value={token.label}
                    onChange={(e) => {
                      const newLabel = e.target.value;
                      onUpdateTokens(tokens.map((t) => (t.id === token.id ? { ...t, label: newLabel } : t)));
                    }}
                    placeholder="Label"
                    className="bg-transparent text-white font-black text-xs w-14 focus:w-20 transition-all outline-none"
                  />
                </div>

                {/* Shape Switcher */}
                <div className="flex items-center bg-slate-800 rounded p-0.5 border border-slate-700">
                  {[
                    { shape: 'O', title: 'Circle', icon: Circle },
                    { shape: 'square', title: 'Square', icon: Square },
                    { shape: 'triangle', title: 'Triangle', icon: Triangle },
                    { shape: 'diamond', title: 'Diamond', icon: Shield },
                    { shape: 'star', title: 'Star', icon: Star },
                    { shape: 'X', title: 'X', icon: X },
                  ].map((s) => {
                    const Icon = s.icon;
                    const isActive =
                      token.type === s.shape ||
                      (s.shape === 'square' && token.isSquare) ||
                      (s.shape === 'O' && token.type === 'O' && !token.isSquare);
                    return (
                      <button
                        key={s.shape}
                        type="button"
                        onClick={() => {
                          if (s.shape === 'square') {
                            onUpdateTokens(tokens.map((t) => (t.id === token.id ? { ...t, type: 'square', isSquare: true } : t)));
                          } else if (s.shape === 'O') {
                            onUpdateTokens(tokens.map((t) => (t.id === token.id ? { ...t, type: 'O', isSquare: false } : t)));
                          } else {
                            onUpdateTokens(tokens.map((t) => (t.id === token.id ? { ...t, type: s.shape as any, isSquare: false } : t)));
                          }
                        }}
                        title={s.title}
                        className={`p-1 rounded cursor-pointer transition-colors ${
                          isActive ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white hover:bg-slate-700'
                        }`}
                      >
                        <Icon className="w-3.5 h-3.5" />
                      </button>
                    );
                  })}
                </div>

                {/* Fill Mode Toggle: Solid Fill vs No Fill */}
                <div className="flex items-center bg-slate-800 rounded p-0.5 border border-slate-700">
                  <button
                    type="button"
                    onClick={() => {
                      onUpdateTokens(tokens.map((t) => (t.id === token.id ? { ...t, fillMode: 'fill' } : t)));
                    }}
                    className={`px-2 py-0.5 rounded text-[10.5px] font-bold cursor-pointer transition-colors ${
                      token.fillMode !== 'nofill' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'
                    }`}
                    title="Solid Fill Background"
                  >
                    Fill
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      onUpdateTokens(tokens.map((t) => (t.id === token.id ? { ...t, fillMode: 'nofill' } : t)));
                    }}
                    className={`px-2 py-0.5 rounded text-[10.5px] font-bold cursor-pointer transition-colors ${
                      token.fillMode === 'nofill' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'
                    }`}
                    title="Hollow / No Fill (Outline only)"
                  >
                    No Fill
                  </button>
                </div>

                {/* Color Swatches */}
                <div className="flex items-center gap-1 bg-slate-800 p-1 rounded border border-slate-700">
                  {[
                    { color: '#1d4ed8', title: 'Royal Blue' },
                    { color: '#dc2626', title: 'Crimson Red' },
                    { color: '#16a34a', title: 'Emerald Green' },
                    { color: '#d97706', title: 'Gold Amber' },
                    { color: '#7c3aed', title: 'Purple' },
                    { color: '#ea580c', title: 'Orange' },
                    { color: '#0f172a', title: 'Slate Black' },
                    { color: '#ffffff', title: 'Crisp White' },
                  ].map((c) => (
                    <button
                      key={c.color}
                      type="button"
                      onClick={() => {
                        onUpdateTokens(tokens.map((t) => (t.id === token.id ? { ...t, color: c.color } : t)));
                      }}
                      title={c.title}
                      className={`w-4 h-4 rounded-full border cursor-pointer transition-transform ${
                        token.color === c.color ? 'scale-125 border-white ring-2 ring-blue-400' : 'border-slate-500 hover:scale-110'
                      }`}
                      style={{ backgroundColor: c.color }}
                    />
                  ))}
                  <input
                    type="color"
                    value={token.color || '#1d4ed8'}
                    onChange={(e) => {
                      const newCol = e.target.value;
                      onUpdateTokens(tokens.map((t) => (t.id === token.id ? { ...t, color: newCol } : t)));
                    }}
                    title="Custom Color"
                    className="w-4 h-4 rounded cursor-pointer bg-transparent border-0 p-0"
                  />
                </div>

                {/* Duplicate */}
                <button
                  type="button"
                  onClick={() => {
                    const clone: WhiteboardToken = {
                      ...token,
                      id: `tok-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
                      x: token.x + 24,
                      y: token.y + 24,
                    };
                    onUpdateTokens([...tokens, clone]);
                    onSelectElement('token', clone.id);
                  }}
                  title="Duplicate Element"
                  className="p-1 rounded hover:bg-slate-700 text-slate-300 hover:text-white transition-colors cursor-pointer"
                >
                  <Copy className="w-3.5 h-3.5" />
                </button>
              </div>
            );
          })()}

          {/* Zone Customization Inspector */}
          {selectedType === 'zone' && (() => {
            const zone = zones.find((z) => z.id === selectedId);
            if (!zone) return null;
            return (
              <div className="flex items-center gap-2 flex-wrap">
                {/* Zone Label Input */}
                <div className="flex items-center bg-slate-800 rounded px-1.5 py-0.5 border border-slate-700">
                  <span className="text-[10px] text-slate-400 mr-1 font-bold">Zone:</span>
                  <input
                    type="text"
                    value={zone.name}
                    onChange={(e) => {
                      const newName = e.target.value;
                      onUpdateZones(zones.map((z) => (z.id === zone.id ? { ...z, name: newName } : z)));
                    }}
                    placeholder="Zone Name"
                    className="bg-transparent text-white font-black text-xs w-20 focus:w-28 transition-all outline-none"
                  />
                </div>

                {/* Zone Shape: Circle vs Oval vs Rect */}
                <div className="flex items-center bg-slate-800 rounded p-0.5 border border-slate-700">
                  <button
                    type="button"
                    onClick={() => {
                      const maxR = Math.max(zone.rx, zone.ry);
                      onUpdateZones(zones.map((z) => (z.id === zone.id ? { ...z, shape: 'circle', rx: maxR, ry: maxR } : z)));
                    }}
                    className={`px-2 py-0.5 rounded text-[10.5px] font-bold cursor-pointer transition-colors ${
                      zone.shape === 'circle' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    Circle
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      onUpdateZones(zones.map((z) => (z.id === zone.id ? { ...z, shape: 'ellipse' } : z)));
                    }}
                    className={`px-2 py-0.5 rounded text-[10.5px] font-bold cursor-pointer transition-colors ${
                      zone.shape !== 'circle' && zone.shape !== 'rect' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    Oval
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      onUpdateZones(zones.map((z) => (z.id === zone.id ? { ...z, shape: 'rect' } : z)));
                    }}
                    className={`px-2 py-0.5 rounded text-[10.5px] font-bold cursor-pointer transition-colors ${
                      zone.shape === 'rect' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    Box
                  </button>
                </div>

                {/* Zone Fill Mode */}
                <div className="flex items-center bg-slate-800 rounded p-0.5 border border-slate-700">
                  <button
                    type="button"
                    onClick={() => {
                      onUpdateZones(zones.map((z) => (z.id === zone.id ? { ...z, fillMode: 'fill' } : z)));
                    }}
                    className={`px-2 py-0.5 rounded text-[10.5px] font-bold cursor-pointer transition-colors ${
                      zone.fillMode !== 'nofill' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    Fill
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      onUpdateZones(zones.map((z) => (z.id === zone.id ? { ...z, fillMode: 'nofill' } : z)));
                    }}
                    className={`px-2 py-0.5 rounded text-[10.5px] font-bold cursor-pointer transition-colors ${
                      zone.fillMode === 'nofill' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    Outline
                  </button>
                </div>

                {/* Color Swatches */}
                <div className="flex items-center gap-1 bg-slate-800 p-1 rounded border border-slate-700">
                  {['#0284c7', '#dc2626', '#16a34a', '#d97706', '#7c3aed', '#0f172a'].map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => {
                        onUpdateZones(zones.map((z) => (z.id === zone.id ? { ...z, color: c } : z)));
                      }}
                      className={`w-4 h-4 rounded-full border cursor-pointer transition-transform ${
                        zone.color === c ? 'scale-125 border-white ring-2 ring-blue-400' : 'border-slate-500 hover:scale-110'
                      }`}
                      style={{ backgroundColor: c }}
                    />
                  ))}
                  <input
                    type="color"
                    value={zone.color || '#0284c7'}
                    onChange={(e) => {
                      const newCol = e.target.value;
                      onUpdateZones(zones.map((z) => (z.id === zone.id ? { ...z, color: newCol } : z)));
                    }}
                    className="w-4 h-4 rounded cursor-pointer bg-transparent border-0 p-0"
                  />
                </div>
              </div>
            );
          })()}

          {/* Text Element Edit */}
          {selectedType === 'text' && (
            <button
              onClick={() => {
                const targetText = textElements.find((t) => t.id === selectedId);
                if (targetText) {
                  setEditingTextId(targetText.id);
                  setEditingTextValue(targetText.text);
                }
              }}
              title="Edit text content"
              className="p-1 rounded hover:bg-slate-700 text-blue-400 hover:text-blue-300 transition-colors cursor-pointer flex items-center gap-1"
            >
              <Edit2 className="w-3.5 h-3.5" />
              <span>Edit Text</span>
            </button>
          )}

          {/* Delete Action */}
          <button
            onClick={handleDeleteSelected}
            title="Delete element"
            className="p-1 rounded hover:bg-red-900/60 text-red-400 hover:text-red-300 transition-colors cursor-pointer ml-1"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Floating Play Animation Controller Dock */}
      {isAnimationMode && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-40 bg-slate-950/95 backdrop-blur-md text-white px-4 py-2.5 rounded-2xl shadow-2xl border border-slate-700/80 flex items-center gap-3 animate-in fade-in slide-in-from-bottom-3 select-none">
          {/* Play / Pause Toggle */}
          <button
            type="button"
            onClick={() => setIsPlaying(!isPlaying)}
            className={`px-3 py-1.5 rounded-xl font-bold flex items-center gap-1.5 transition-all cursor-pointer shadow-md ${
              isPlaying
                ? 'bg-amber-500 text-slate-950 hover:bg-amber-400'
                : 'bg-emerald-600 text-white hover:bg-emerald-500 ring-2 ring-emerald-400/40'
            }`}
          >
            {isPlaying ? <Pause className="w-4 h-4 fill-current" /> : <Play className="w-4 h-4 fill-current" />}
            <span className="text-xs">{isPlaying ? 'Pause' : 'Play'}</span>
          </button>

          {/* Reset to Pre-Snap */}
          <button
            type="button"
            onClick={() => {
              setIsPlaying(false);
              setAnimProgress(0);
            }}
            className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-lg transition-colors cursor-pointer"
            title="Reset to Pre-Snap Alignment (0%)"
          >
            <RotateCcw className="w-4 h-4" />
          </button>

          {/* Timeline Scrub Slider */}
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-mono font-bold text-slate-400 min-w-[32px] text-right">
              {Math.round(animProgress * 100)}%
            </span>
            <input
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={animProgress}
              onChange={(e) => {
                setIsPlaying(false);
                setAnimProgress(parseFloat(e.target.value));
              }}
              className="w-28 sm:w-44 accent-emerald-400 cursor-pointer"
              title="Scrub play timeline"
            />
          </div>

          {/* Speed Presets */}
          <div className="flex items-center bg-slate-900 rounded-lg p-0.5 border border-slate-800 text-[11px]">
            {[0.5, 1.0, 1.5].map((speed) => (
              <button
                key={speed}
                type="button"
                onClick={() => setAnimSpeed(speed)}
                className={`px-2 py-0.5 rounded font-bold transition-colors cursor-pointer ${
                  animSpeed === speed ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {speed}x
              </button>
            ))}
          </div>

          {/* Loop Toggle */}
          <button
            type="button"
            onClick={() => setIsLooping(!isLooping)}
            className={`p-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
              isLooping ? 'bg-blue-950 text-blue-300 border border-blue-700' : 'bg-slate-900 text-slate-500 hover:text-slate-300'
            }`}
            title={isLooping ? 'Loop is ON' : 'Loop is OFF'}
          >
            <Repeat className="w-4 h-4" />
          </button>

          {/* Motion Trails Toggle */}
          <button
            type="button"
            onClick={() => setShowTrails(!showTrails)}
            className={`px-2 py-1 rounded-lg text-[10.5px] font-bold transition-colors cursor-pointer ${
              showTrails ? 'bg-indigo-950 text-indigo-300 border border-indigo-700' : 'bg-slate-900 text-slate-500'
            }`}
            title="Toggle Ghost Footsteps & Route Trails"
          >
            Trails
          </button>

          {/* Close Dock */}
          <button
            type="button"
            onClick={() => {
              setIsPlaying(false);
              setAnimProgress(0);
              setIsAnimationMode(false);
            }}
            className="p-1 text-slate-400 hover:text-white rounded-md hover:bg-slate-800 ml-1 cursor-pointer"
            title="Exit Animation Mode"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Freehand Sketch Canvas Layer */}
      <canvas
        ref={sketchPadRef}
        onMouseDown={handleCanvasMouseDown}
        onMouseMove={handleCanvasMouseMove}
        onMouseUp={handleCanvasMouseUp}
        onTouchStart={handleCanvasTouchStart}
        onTouchMove={handleCanvasTouchMove}
        onTouchEnd={handleCanvasMouseUp}
        className={`absolute inset-0 z-20 w-full h-full ${
          isDrawingMode ? 'cursor-crosshair pointer-events-auto' : 'pointer-events-none'
        }`}
      />

      {/* Main Professional Football Field SVG Layer */}
      <div ref={svgContainerRef} className="relative flex-1 w-full h-full min-h-[500px] overflow-hidden bg-white">
        <svg
          ref={svgRef}
          viewBox={viewBoxStr}
          preserveAspectRatio="none"
          className="w-full h-full block relative z-10"
          onClick={handleSvgClick}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
        >
          <defs>
            <filter id="wbMarkerGlow" x="-15%" y="-15%" width="130%" height="130%">
              <feGaussianBlur stdDeviation="0.2" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>

            {/* Defense Crimson Gradient */}
            <linearGradient id="wbDefenseGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#ef4444" />
              <stop offset="100%" stopColor="#b91c1c" />
            </linearGradient>

            {/* Defense Crimson Drop Shadow */}
            <filter id="wbDefenseShadow" x="-25%" y="-25%" width="150%" height="150%">
              <feDropShadow dx="0" dy="2" stdDeviation="2.5" floodColor="#b91c1c" floodOpacity="0.45" />
            </filter>

            {/* Offense Royal Blue Drop Shadow */}
            <filter id="wbOffenseShadow" x="-25%" y="-25%" width="150%" height="150%">
              <feDropShadow dx="0" dy="2" stdDeviation="2.5" floodColor="#1d4ed8" floodOpacity="0.30" />
            </filter>

            {/* Marker Arrowheads */}
            <marker id="arrowhead-red" viewBox="0 0 10 10" refX="7" refY="5" markerWidth="6" markerHeight="6" orient="auto">
              <path d="M 0 1 L 10 5 L 0 9 z" fill="#dc2626" />
            </marker>
            <marker id="arrowhead-blue" viewBox="0 0 10 10" refX="7" refY="5" markerWidth="6" markerHeight="6" orient="auto">
              <path d="M 0 1 L 10 5 L 0 9 z" fill="#1d4ed8" />
            </marker>
            <marker id="arrowhead-green" viewBox="0 0 10 10" refX="7" refY="5" markerWidth="6" markerHeight="6" orient="auto">
              <path d="M 0 1 L 10 5 L 0 9 z" fill="#058538" />
            </marker>
            <marker id="arrowhead-black" viewBox="0 0 10 10" refX="7" refY="5" markerWidth="6" markerHeight="6" orient="auto">
              <path d="M 0 1 L 10 5 L 0 9 z" fill="#0f172a" />
            </marker>
            <marker id="arrowhead-orange" viewBox="0 0 10 10" refX="7" refY="5" markerWidth="6" markerHeight="6" orient="auto">
              <path d="M 0 1 L 10 5 L 0 9 z" fill="#e06c00" />
            </marker>
            <marker id="arrowhead-purple" viewBox="0 0 10 10" refX="7" refY="5" markerWidth="6" markerHeight="6" orient="auto">
              <path d="M 0 1 L 10 5 L 0 9 z" fill="#7c3aed" />
            </marker>

            {/* Blocker T-Bar */}
            <marker id="t-bar-end" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="8" markerHeight="8" orient="auto">
              <line x1="5" y1="0" x2="5" y2="10" stroke="#1d4ed8" strokeWidth="3.2" strokeLinecap="round" />
            </marker>
          </defs>

          {/* Clickable broad field background */}
          <rect
            id="fieldBackground"
            x={viewBoxMinX - 100}
            y={viewBoxMinY - 100}
            width={viewBoxWidth + 200}
            height={viewBoxHeight + 200}
            fill="#ffffff"
          />

          {/* Professional Football Field Markings - Dynamic Grid Lines, Hashes & Yard Numbers spanning full canvas */}
          <g id="fieldLines" className="select-none pointer-events-none">
            {/* Outer Field Boundary Box */}
            <rect
              x={fieldLeft}
              y={fieldTop}
              width={fieldWidth}
              height={fieldHeight}
              rx="6"
              fill="none"
              stroke="#94a3b8"
              strokeWidth="2"
            />

            {/* Dynamic 5-Yard & 10-Yard Grid Lines across entire visible field */}
            {(() => {
              const lines: React.ReactNode[] = [];
              const startY = Math.floor((fieldTop + 20) / 40) * 40;
              const endY = Math.ceil((fieldBottom - 20) / 40) * 40;

              for (let yLine = startY; yLine <= endY; yLine += 40) {
                if (yLine === 200) continue; // LOS is drawn separately as solid blue line
                const isMajor = (yLine - 200) % 80 === 0;
                lines.push(
                  <line
                    key={`grid-${yLine}`}
                    x1={fieldLeft}
                    y1={yLine}
                    x2={fieldRight}
                    y2={yLine}
                    stroke={isMajor ? '#cbd5e1' : '#f1f5f9'}
                    strokeWidth={isMajor ? 1.2 : 1}
                    strokeDasharray={isMajor ? '4,4' : undefined}
                  />
                );
              }
              return lines;
            })()}

            {/* Blue Line of Scrimmage (LOS) at y: 200 */}
            <line
              x1={fieldLeft}
              y1="200"
              x2={fieldRight}
              y2="200"
              stroke="#2563eb"
              strokeWidth="3.2"
            />

            {/* Inbounds Hash Marks Columns across the full vertical field */}
            <line
              x1="270"
              y1={fieldTop + 6}
              x2="270"
              y2={fieldBottom - 6}
              stroke="#cbd5e1"
              strokeWidth="1.2"
              strokeDasharray="3,7"
            />
            <line
              x1="430"
              y1={fieldTop + 6}
              x2="430"
              y2={fieldBottom - 6}
              stroke="#cbd5e1"
              strokeWidth="1.2"
              strokeDasharray="3,7"
            />

            {/* Sideline Hash Ticks & Inbounds Hash Crosses */}
            {(() => {
              const hashes: React.ReactNode[] = [];
              const startY = Math.floor((fieldTop + 10) / 20) * 20;
              const endY = Math.ceil((fieldBottom - 10) / 20) * 20;

              for (let yVal = startY; yVal <= endY; yVal += 20) {
                hashes.push(
                  <g key={`hash-${yVal}`}>
                    {/* Sideline Left Hash Tick */}
                    <line x1={fieldLeft} y1={yVal} x2={fieldLeft + 9} y2={yVal} stroke="#94a3b8" strokeWidth="1.2" />
                    {/* Sideline Right Hash Tick */}
                    <line x1={fieldRight - 9} y1={yVal} x2={fieldRight} y2={yVal} stroke="#94a3b8" strokeWidth="1.2" />
                    {/* College/Pro Inbounds Hashes */}
                    <line x1="266" y1={yVal} x2="274" y2={yVal} stroke="#cbd5e1" strokeWidth="1.2" />
                    <line x1="426" y1={yVal} x2="434" y2={yVal} stroke="#cbd5e1" strokeWidth="1.2" />
                  </g>
                );
              }
              return hashes;
            })()}

            {/* Sideline Yard Numbers (10, 20, 30, 40, 50, etc.) placed automatically along both sidelines */}
            {(() => {
              const numbers: React.ReactNode[] = [];
              const startY = Math.floor((fieldTop + 30) / 80) * 80;
              const endY = Math.ceil((fieldBottom - 30) / 80) * 80;

              for (let yVal = startY; yVal <= endY; yVal += 80) {
                const distYards = Math.round(Math.abs(yVal - 200) / 8);
                if (distYards === 0) continue; // Skip LOS
                const numLabel = distYards <= 50 ? distYards : 100 - distYards;
                if (numLabel <= 0) continue;

                numbers.push(
                  <React.Fragment key={`num-${yVal}`}>
                    {/* Right Sideline Yard Number */}
                    <g transform={`translate(${fieldRight - 44}, ${yVal}) rotate(90)`} opacity="0.40">
                      <text fontFamily="'Space Grotesk', sans-serif" fontSize="18" fontWeight="800" fill="#64748b" textAnchor="middle">
                        {numLabel}
                      </text>
                    </g>
                    {/* Left Sideline Yard Number */}
                    <g transform={`translate(${fieldLeft + 44}, ${yVal}) rotate(-90)`} opacity="0.40">
                      <text fontFamily="'Space Grotesk', sans-serif" fontSize="18" fontWeight="800" fill="#64748b" textAnchor="middle">
                        {numLabel}
                      </text>
                    </g>
                  </React.Fragment>
                );
              }
              return numbers;
            })()}

            {/* High-Contrast LOS Badges pinned to sidelines */}
            <g transform={`translate(${fieldLeft + 2}, 189)`}>
              <rect width="32" height="22" rx="4" fill="#2563eb" />
              <text x="16" y="15" fontFamily="'Space Grotesk', sans-serif" fontSize="10" fontWeight="900" fill="#ffffff" textAnchor="middle">
                LOS
              </text>
            </g>
            <g transform={`translate(${fieldRight - 34}, 189)`}>
              <rect width="32" height="22" rx="4" fill="#2563eb" />
              <text x="16" y="15" fontFamily="'Space Grotesk', sans-serif" fontSize="10" fontWeight="900" fill="#ffffff" textAnchor="middle">
                LOS
              </text>
            </g>
          </g>

        {/* 1. Zone Coverage Bubbles Layer */}
        <g id="zoneBubblesLayer">
          {zones.map((zone) => {
            const isSelected = selectedType === 'zone' && selectedId === zone.id;
            const labelX = zone.labelX !== undefined ? zone.labelX : zone.cx;
            const labelY = zone.labelY !== undefined ? zone.labelY : zone.cy - zone.ry - 12;

            return (
              <g key={zone.id}>
                {/* Main Zone Ellipse */}
                <ellipse
                  cx={zone.cx}
                  cy={zone.cy}
                  rx={zone.rx}
                  ry={zone.ry}
                  fill={zone.color}
                  fillOpacity={zoneShadeMode === 'outline' ? 0.04 : zone.opacity || 0.18}
                  stroke={zone.color}
                  strokeWidth={isSelected ? 3 : 2}
                  strokeDasharray="6,4"
                  className={readOnly ? 'pointer-events-none' : 'cursor-move'}
                  onPointerDown={(e) => {
                    if (readOnly) return;
                    e.stopPropagation();
                    onSelectElement('zone', zone.id);
                    const { x, y } = getSvgCoordinates(e.clientX, e.clientY);
                    setDragState({
                      type: 'zone-body',
                      id: zone.id,
                      offsetX: x - zone.cx,
                      offsetY: y - zone.cy,
                    });
                  }}
                />

                {/* Movable Zone Label Badge */}
                {showLabels && zone.name && (
                  <g
                    transform={`translate(${labelX}, ${labelY})`}
                    className={readOnly ? 'pointer-events-none' : 'cursor-grab active:cursor-grabbing select-none'}
                    onPointerDown={(e) => {
                      if (readOnly) return;
                      e.stopPropagation();
                      onSelectElement('zone', zone.id);
                      const { x, y } = getSvgCoordinates(e.clientX, e.clientY);
                      setDragState({
                        type: 'zone-label',
                        id: zone.id,
                        offsetX: x - labelX,
                        offsetY: y - labelY,
                      });
                    }}
                  >
                    <rect
                      x={-(zone.name.length * 4.5 + 10)}
                      y="-10"
                      width={zone.name.length * 9 + 20}
                      height="20"
                      rx="6"
                      fill="#ffffff"
                      stroke={zone.color}
                      strokeWidth="1.5"
                      filter="drop-shadow(0 1px 3px rgba(0,0,0,0.2))"
                    />
                    <text
                      x="0"
                      y="4"
                      fontFamily="'Space Grotesk', sans-serif"
                      fontSize="9.5"
                      fontWeight="800"
                      textAnchor="middle"
                      fill={zone.color}
                    >
                      {zone.name}
                    </text>
                  </g>
                )}

                {/* Resize Handle when selected */}
                {isSelected && !readOnly && (
                  <circle
                    cx={zone.cx + zone.rx}
                    cy={zone.cy}
                    r="7"
                    fill="#ffffff"
                    stroke={zone.color}
                    strokeWidth="2.5"
                    className="cursor-ew-resize"
                    onPointerDown={(e) => {
                      e.stopPropagation();
                      setDragState({
                        type: 'zone-resize',
                        id: zone.id,
                        offsetX: 0,
                        offsetY: 0,
                      });
                    }}
                  />
                )}
              </g>
            );
          })}
        </g>

        {/* 2. Arrows Layer (Blitz / Stunts / Scrapes) */}
        <g id="arrowsLayer">
          {arrows.map((arrow) => {
            const isSelected = selectedType === 'arrow' && selectedId === arrow.id;
            const markerColor =
              arrow.color === '#d91b24' || arrow.color === '#dc2626'
                ? 'arrowhead-red'
                : arrow.color === '#0052cc' || arrow.color === '#2563eb' || arrow.color === '#3b82f6'
                ? 'arrowhead-blue'
                : arrow.color === '#058538' || arrow.color === '#16a34a'
                ? 'arrowhead-green'
                : arrow.color === '#e06c00' || arrow.color === '#ea580c'
                ? 'arrowhead-orange'
                : arrow.color === '#7c3aed' || arrow.color === '#8b5cf6' || arrow.dashed
                ? 'arrowhead-purple'
                : 'arrowhead-black';

            let pathD = '';
            if (arrow.type === 'curved' && arrow.controlX !== undefined && arrow.controlY !== undefined) {
              pathD = `M ${arrow.startX} ${arrow.startY} Q ${arrow.controlX} ${arrow.controlY} ${arrow.endX} ${arrow.endY}`;
            } else if (arrow.type === 'blitz') {
              const midX = (arrow.startX + arrow.endX) / 2 + (arrow.controlX ? arrow.controlX - arrow.startX : 0);
              const midY = (arrow.startY + arrow.endY) / 2 + (arrow.controlY ? arrow.controlY - arrow.startY : 0);
              pathD = `M ${arrow.startX} ${arrow.startY} Q ${midX} ${midY} ${arrow.endX} ${arrow.endY}`;
            } else {
              pathD = `M ${arrow.startX} ${arrow.startY} L ${arrow.endX} ${arrow.endY}`;
            }

            const markerEnd = arrow.type === 'block' ? 'url(#t-bar-end)' : `url(#${markerColor})`;

            // Calculate label coordinates (movable)
            const defaultLabelX =
              arrow.type === 'curved' && arrow.controlX !== undefined
                ? (arrow.startX + arrow.controlX * 2 + arrow.endX) / 4
                : (arrow.startX + arrow.endX) / 2;
            const defaultLabelY =
              arrow.type === 'curved' && arrow.controlY !== undefined
                ? (arrow.startY + arrow.controlY * 2 + arrow.endY) / 4
                : (arrow.startY + arrow.endY) / 2 - 12;

            const labelX = arrow.labelX !== undefined ? arrow.labelX : defaultLabelX;
            const labelY = arrow.labelY !== undefined ? arrow.labelY : defaultLabelY;

            return (
              <g key={arrow.id}>
                {/* Thick hit area for easy drag of the whole arrow */}
                <path
                  d={pathD}
                  fill="none"
                  stroke="transparent"
                  strokeWidth="24"
                  className={readOnly ? 'pointer-events-none' : 'cursor-move'}
                  onPointerDown={(e) => {
                    if (readOnly) return;
                    e.stopPropagation();
                    onSelectElement('arrow', arrow.id);
                    const { x, y } = getSvgCoordinates(e.clientX, e.clientY);
                    setDragState({
                      type: 'arrow-whole',
                      id: arrow.id,
                      offsetX: 0,
                      offsetY: 0,
                      initialData: {
                        mouseX: x,
                        mouseY: y,
                        startX: arrow.startX,
                        startY: arrow.startY,
                        endX: arrow.endX,
                        endY: arrow.endY,
                        controlX: arrow.controlX,
                        controlY: arrow.controlY,
                        labelX: arrow.labelX,
                        labelY: arrow.labelY,
                      },
                    });
                  }}
                />

                {/* Visible Arrow Line */}
                <path
                  d={pathD}
                  fill="none"
                  stroke={arrow.color || '#0f172a'}
                  strokeWidth={isSelected ? 3.8 : 2.8}
                  strokeDasharray={arrow.dashed || arrow.type === 'drop' ? '6,4' : undefined}
                  markerEnd={markerEnd}
                  className="pointer-events-none"
                />

                {/* Movable Arrow Label */}
                {showLabels && arrow.label && (
                  <g
                    transform={`translate(${labelX}, ${labelY})`}
                    className={readOnly ? 'pointer-events-none' : 'cursor-grab active:cursor-grabbing select-none'}
                    onPointerDown={(e) => {
                      if (readOnly) return;
                      e.stopPropagation();
                      onSelectElement('arrow', arrow.id);
                      const { x, y } = getSvgCoordinates(e.clientX, e.clientY);
                      setDragState({
                        type: 'arrow-label',
                        id: arrow.id,
                        offsetX: x - labelX,
                        offsetY: y - labelY,
                      });
                    }}
                  >
                    <rect
                      x={-(arrow.label.length * 4 + 8)}
                      y="-9"
                      width={arrow.label.length * 8 + 16}
                      height="18"
                      rx="5"
                      fill="#ffffff"
                      stroke={arrow.color || '#0f172a'}
                      strokeWidth="1.2"
                      filter="drop-shadow(0 1px 2px rgba(0,0,0,0.18))"
                    />
                    <text
                      x="0"
                      y="3.5"
                      fontFamily="'Space Grotesk', sans-serif"
                      fontSize="9"
                      fontWeight="800"
                      textAnchor="middle"
                      fill={arrow.color || '#0f172a'}
                    >
                      {arrow.label}
                    </text>
                  </g>
                )}

                {/* Interactive Endpoint Handles when Selected */}
                {isSelected && !readOnly && (
                  <>
                    <circle
                      cx={arrow.startX}
                      cy={arrow.startY}
                      r="6.5"
                      fill="#ffffff"
                      stroke={arrow.color || '#0f172a'}
                      strokeWidth="2.5"
                      className="cursor-move"
                      onPointerDown={(e) => {
                        e.stopPropagation();
                        setDragState({ type: 'arrow-start', id: arrow.id, offsetX: 0, offsetY: 0 });
                      }}
                    />
                    <circle
                      cx={arrow.endX}
                      cy={arrow.endY}
                      r="6.5"
                      fill="#ffffff"
                      stroke={arrow.color || '#0f172a'}
                      strokeWidth="2.5"
                      className="cursor-move"
                      onPointerDown={(e) => {
                        e.stopPropagation();
                        setDragState({ type: 'arrow-end', id: arrow.id, offsetX: 0, offsetY: 0 });
                      }}
                    />
                    <circle
                      cx={arrow.controlX !== undefined ? arrow.controlX : (arrow.startX + arrow.endX) / 2}
                      cy={arrow.controlY !== undefined ? arrow.controlY : (arrow.startY + arrow.endY) / 2 - 20}
                      r="5.5"
                      fill="#fef08a"
                      stroke="#ca8a04"
                      strokeWidth="2"
                      className="cursor-crosshair"
                      onPointerDown={(e) => {
                        e.stopPropagation();
                        setDragState({ type: 'arrow-control', id: arrow.id, offsetX: 0, offsetY: 0 });
                      }}
                    />
                  </>
                )}
              </g>
            );
          })}
        </g>

        {/* 3. Player Tokens & Symbols Layer (Offense, Defense, Linemen, Backs) */}
        <g id="tokensLayer">
          {tokens.map((token) => {
            const isSelected = selectedType === 'token' && selectedId === token.id;
            const isDef = isDefenseToken(token);
            const isOff = isOffenseToken(token);

            // Compute animated position
            const animInfo = isAnimationMode
              ? getAnimatedTokenInfo(token)
              : { currentX: token.x, currentY: token.y, matchingArrow: null };
            const posX = animInfo.currentX;
            const posY = animInfo.currentY;

            // Determine Shape
            const effectiveShape =
              token.shape ||
              (token.type === 'square' || token.isSquare || (token.type === 'O' && token.label === 'C')
                ? 'square'
                : token.type === 'triangle'
                ? 'triangle'
                : token.type === 'diamond'
                ? 'diamond'
                : token.type === 'star'
                ? 'star'
                : token.type === 'X'
                ? 'X'
                : token.type === 'letter'
                ? 'letter'
                : token.type === 'ball'
                ? 'ball'
                : token.type === 'bag'
                ? 'bag'
                : token.type === 'cone'
                ? 'cone'
                : 'circle');

            // Determine Fill Mode & Colors
            const isNoFill = token.fillMode === 'nofill' || (isDef && (token.color === '#ef4444' || token.color === '#dc2626' || token.color === '#b91c1c'));
            const baseThemeColor = token.color || (isDef ? '#ef4444' : '#1d4ed8');

            const fill = isNoFill
              ? 'none'
              : token.color
              ? token.color
              : isDef
              ? 'url(#wbDefenseGradient)'
              : '#ffffff';

            const fillOpacity = isNoFill ? 0 : 1;
            const stroke = isNoFill ? baseThemeColor : token.color || (isDef ? '#ef4444' : '#1d4ed8');
            const strokeWidth = isNoFill ? 3.2 : 2.6;

            const textColor = isNoFill
              ? baseThemeColor
              : token.color
              ? token.color.toLowerCase() === '#ffffff'
                ? '#1d4ed8'
                : '#ffffff'
              : isDef
              ? '#ffffff'
              : '#1d4ed8';

            const upperLabel = (token.label || '').toUpperCase().trim();
            const upperSub = (token.subLabel || '').toUpperCase().trim();
            const isBallCarrier = upperLabel === 'RB' || upperLabel === 'TB' || upperLabel === 'FB' || upperLabel === 'HB' || upperLabel.includes('BALL') || upperLabel.includes('CARRIER') || upperSub.includes('CARRIER') || upperSub.includes('BALL');
            const isDefenderStance = isDef && !token.type?.includes('ball') && token.type !== 'bag' && token.type !== 'cone';

            return (
              <React.Fragment key={token.id}>
                {/* Movement Trail during Animation */}
                {isAnimationMode && showTrails && animProgress > 0.03 && (
                  <g className="pointer-events-none select-none opacity-50">
                    <line
                      x1={token.x}
                      y1={token.y}
                      x2={posX}
                      y2={posY}
                      stroke={token.color || (isDef ? '#dc2626' : '#2563eb')}
                      strokeWidth="2"
                      strokeDasharray="4,4"
                    />
                    <circle
                      cx={token.x}
                      cy={token.y}
                      r="4.5"
                      fill="none"
                      stroke={token.color || (isDef ? '#dc2626' : '#2563eb')}
                      strokeWidth="1.2"
                    />
                  </g>
                )}

                <g
                  transform={`translate(${posX}, ${posY})`}
                  className={readOnly ? 'pointer-events-none select-none' : 'cursor-grab active:cursor-grabbing select-none'}
                  onPointerDown={(e) => {
                    if (readOnly) return;
                    e.stopPropagation();
                    onSelectElement('token', token.id);
                    const { x, y } = getSvgCoordinates(e.clientX, e.clientY);
                    setDragState({
                      type: 'token',
                      id: token.id,
                      offsetX: x - token.x,
                      offsetY: y - token.y,
                    });
                  }}
                >
                  {/* Selected Halo Ring */}
                  {isSelected && (
                    <circle
                      cx="0"
                      cy="0"
                      r="23"
                      fill="none"
                      stroke={isDef ? '#ef4444' : '#2563eb'}
                      strokeWidth="2.8"
                      strokeDasharray="4,3"
                    />
                  )}

                  {/* Token Rendering based on Shape & Styling */}
                  {effectiveShape === 'square' ? (
                    // Square Token
                    <g filter="url(#wbOffenseShadow)">
                      <rect
                        x="-15"
                        y="-15"
                        width="30"
                        height="30"
                        rx="4"
                        fill={fill}
                        fillOpacity={fillOpacity}
                        stroke={stroke}
                        strokeWidth={strokeWidth}
                      />
                      <text
                        x="0"
                        y="5"
                        fontFamily="'Space Grotesk', -apple-system, sans-serif"
                        fontSize={token.label && token.label.length > 2 ? '10.5' : '13.5'}
                        fontWeight="900"
                        textAnchor="middle"
                        fill={textColor}
                        className="pointer-events-none select-none"
                      >
                        {token.label || 'C'}
                      </text>
                    </g>
                  ) : effectiveShape === 'triangle' ? (
                    // Triangle Token
                    <g filter="url(#wbDefenseShadow)">
                      <polygon
                        points="0,-18 17,14 -17,14"
                        fill={fill}
                        fillOpacity={fillOpacity}
                        stroke={stroke}
                        strokeWidth={strokeWidth}
                        strokeLinejoin="round"
                      />
                      <text
                        x="0"
                        y="6"
                        fontFamily="'Space Grotesk', -apple-system, sans-serif"
                        fontSize={token.label && token.label.length > 2 ? '10' : '12'}
                        fontWeight="900"
                        textAnchor="middle"
                        fill={textColor}
                        className="pointer-events-none select-none"
                      >
                        {token.label || 'T'}
                      </text>
                    </g>
                  ) : effectiveShape === 'diamond' ? (
                    // Diamond Token
                    <g filter="url(#wbOffenseShadow)">
                      <polygon
                        points="0,-18 16,0 0,18 -16,0"
                        fill={fill}
                        fillOpacity={fillOpacity}
                        stroke={stroke}
                        strokeWidth={strokeWidth}
                        strokeLinejoin="round"
                      />
                      <text
                        x="0"
                        y="4.5"
                        fontFamily="'Space Grotesk', -apple-system, sans-serif"
                        fontSize={token.label && token.label.length > 2 ? '10' : '12.5'}
                        fontWeight="900"
                        textAnchor="middle"
                        fill={textColor}
                        className="pointer-events-none select-none"
                      >
                        {token.label || 'D'}
                      </text>
                    </g>
                  ) : effectiveShape === 'star' ? (
                    // Star Token
                    <g filter="url(#wbOffenseShadow)">
                      <polygon
                        points="0,-18 5,-5 18,-4 8,5 11,18 0,10 -11,18 -8,5 -18,-4 -5,-5"
                        fill={fill}
                        fillOpacity={fillOpacity}
                        stroke={stroke}
                        strokeWidth="2.2"
                        strokeLinejoin="round"
                      />
                      <text
                        x="0"
                        y="4.5"
                        fontFamily="'Space Grotesk', -apple-system, sans-serif"
                        fontSize={token.label && token.label.length > 2 ? '9.5' : '11.5'}
                        fontWeight="900"
                        textAnchor="middle"
                        fill={textColor}
                        className="pointer-events-none select-none"
                      >
                        {token.label || 'S'}
                      </text>
                    </g>
                  ) : effectiveShape === 'X' ? (
                    // Defensive X Token
                    <g>
                      <circle
                        cx="0"
                        cy="0"
                        r="16"
                        fill={isNoFill ? 'none' : (token.color || '#0f172a')}
                        fillOpacity={isNoFill ? 0 : 1}
                        stroke={token.color || (isDef ? '#ef4444' : '#0f172a')}
                        strokeWidth={strokeWidth}
                      />
                      {token.label && token.label !== 'X' ? (
                        <text
                          x="0"
                          y="5"
                          fontFamily="'Space Grotesk', sans-serif"
                          fontSize={token.label.length > 2 ? '10' : '12'}
                          fontWeight="900"
                          textAnchor="middle"
                          fill={isNoFill ? (token.color || (isDef ? '#ef4444' : '#0f172a')) : '#ffffff'}
                          className="pointer-events-none select-none"
                        >
                          {token.label}
                        </text>
                      ) : (
                        <>
                          <line
                            x1="-6"
                            y1="-6"
                            x2="6"
                            y2="6"
                            stroke={isNoFill ? (token.color || (isDef ? '#ef4444' : '#0f172a')) : '#ffffff'}
                            strokeWidth="2.8"
                            strokeLinecap="round"
                          />
                          <line
                            x1="6"
                            y1="-6"
                            x2="-6"
                            y2="6"
                            stroke={isNoFill ? (token.color || (isDef ? '#ef4444' : '#0f172a')) : '#ffffff'}
                            strokeWidth="2.8"
                            strokeLinecap="round"
                          />
                        </>
                      )}
                    </g>
                  ) : token.type === 'ball' ? (
                    // Football Token
                    <g>
                      <ellipse cx="0" cy="0" rx="14" ry="9" fill="#92400e" stroke="#451a03" strokeWidth="1.8" transform="rotate(-25)" />
                      <line x1="-6" y1="0" x2="6" y2="0" stroke="#ffffff" strokeWidth="1.5" transform="rotate(-25)" />
                      <line x1="-3" y1="-3" x2="-3" y2="3" stroke="#ffffff" strokeWidth="1.2" transform="rotate(-25)" />
                      <line x1="0" y1="-3" x2="0" y2="3" stroke="#ffffff" strokeWidth="1.2" transform="rotate(-25)" />
                      <line x1="3" y1="-3" x2="3" y2="3" stroke="#ffffff" strokeWidth="1.2" transform="rotate(-25)" />
                    </g>
                  ) : token.type === 'bag' ? (
                    // Agile Dummy / Bag
                    <g>
                      <rect x="-16" y="-28" width="32" height="56" rx="10" fill="#ef4444" stroke="#991b1b" strokeWidth="2.5" />
                      <text x="0" y="4" fontFamily="'Space Grotesk', sans-serif" fontSize="10" textAnchor="middle" fill="#fff" fontWeight="bold">
                        {token.label}
                      </text>
                    </g>
                  ) : token.type === 'cone' ? (
                    // Cone / Pylon (Triangle Drill 3D style)
                    <g>
                      <polygon points="0,-12 9,7 -9,7" fill="#ea580c" stroke="#c2410c" strokeWidth="1.5" />
                      <ellipse cx="0" cy="7" rx="8" ry="2.5" fill="#c2410c" />
                      {token.label && token.label !== 'Cone' && (
                        <text x="13" y="4" fontFamily="'Space Grotesk', sans-serif" fontSize="10" fill="#ea580c" fontWeight="bold">
                          {token.label}
                        </text>
                      )}
                    </g>
                  ) : (
                    // Circle Token (Default: Offense, Defense, Custom)
                    <g filter={isDef && !token.color && !isNoFill ? 'url(#wbDefenseShadow)' : 'url(#wbOffenseShadow)'}>
                      {/* Athletic Stance Cleats / Feet for Defender (Triangle Drill style) */}
                      {isDefenderStance && (
                        <g className="pointer-events-none select-none" opacity="0.95">
                          <rect x="-16" y="-4" width="8" height="17" rx="3" fill="#93c5fd" stroke="#1d4ed8" strokeWidth="1.2" />
                          <rect x="8" y="-2" width="8" height="17" rx="3" fill="#1d4ed8" stroke="#1d4ed8" strokeWidth="1.2" />
                        </g>
                      )}
                      <circle
                        cx="0"
                        cy="0"
                        r="16.5"
                        fill={fill}
                        fillOpacity={fillOpacity}
                        stroke={stroke}
                        strokeWidth={strokeWidth}
                      />
                      {/* Inner rim highlight on defense gradient */}
                      {isDef && !token.color && !isNoFill && (
                        <circle
                          cx="0"
                          cy="0"
                          r="14.5"
                          fill="none"
                          stroke="#fca5a5"
                          strokeWidth="0.8"
                          strokeOpacity="0.6"
                        />
                      )}
                      {/* Football on hip for Ball Carrier (Triangle Drill style) */}
                      {isBallCarrier && (
                        <ellipse cx="13" cy="4" rx="6" ry="3.8" fill="#8B4513" stroke="#ffffff" strokeWidth="0.8" transform="rotate(25 13 4)" />
                      )}
                      {token.label && token.label.trim() && token.label !== 'O' ? (
                        <text
                          x="0"
                          y={token.label.length > 2 ? '4.5' : '5'}
                          fontFamily="'Space Grotesk', sans-serif"
                          fontSize={token.label.length > 2 ? '10.5' : '13'}
                          fontWeight="900"
                          textAnchor="middle"
                          fill={textColor}
                          className="pointer-events-none select-none"
                        >
                          {token.label}
                        </text>
                      ) : token.label === 'O' ? (
                        <text
                          x="0"
                          y="5"
                          fontFamily="'Space Grotesk', sans-serif"
                          fontSize="13"
                          fontWeight="900"
                          textAnchor="middle"
                          fill={textColor}
                          className="pointer-events-none select-none"
                        >
                          O
                        </text>
                      ) : (
                        // Blank circle with center dot
                        <circle cx="0" cy="0" r="3.5" fill={textColor} />
                      )}
                    </g>
                  )}

                  {/* SubLabel pill badge matching Triangle Drill */}
                  {showLabels && token.subLabel && (
                  <g transform="translate(0, 27)" className="pointer-events-none select-none">
                    <rect
                      x={-Math.max(token.subLabel.length * 4.2 + 10, 28) / 2}
                      y="-7"
                      width={Math.max(token.subLabel.length * 4.2 + 10, 28)}
                      height="14"
                      rx="4"
                      fill="#ffffff"
                      fillOpacity="0.96"
                      stroke={isDef ? '#1d4ed8' : '#64748b'}
                      strokeWidth="1"
                    />
                    <text
                      x="0"
                      y="3.5"
                      fontFamily="'Space Grotesk', sans-serif"
                      fontSize="8"
                      fontWeight="700"
                      textAnchor="middle"
                      fill={isDef ? '#1e3a8a' : '#334155'}
                    >
                      {token.subLabel}
                    </text>
                  </g>
                  )}
                </g>
              </React.Fragment>
            );
        })}
        </g>

        {/* 4. MOVABLE TEXT & COACHING NOTES LAYER (Critical User Requirement) */}
        <g id="textElementsLayer">
          {textElements.map((txt) => {
            const isSelected = selectedType === 'text' && selectedId === txt.id;
            const isEditing = editingTextId === txt.id;
            const lines = txt.text.split('\n');
            const fontSize = txt.fontSize || 11;
            const lineHeight = fontSize * 1.35;
            const longestLineLength = Math.max(...lines.map((l) => l.length), 10);
            const boxWidth = Math.max(longestLineLength * (fontSize * 0.58) + 16, 80);
            const boxHeight = lines.length * lineHeight + 12;

            return (
              <g
                key={txt.id}
                transform={`translate(${txt.x}, ${txt.y})`}
                className={readOnly ? 'pointer-events-none select-none' : 'cursor-grab active:cursor-grabbing select-none'}
                onPointerDown={(e) => {
                  if (readOnly) return;
                  e.stopPropagation();
                  onSelectElement('text', txt.id);
                  const { x, y } = getSvgCoordinates(e.clientX, e.clientY);
                  setDragState({
                    type: 'text',
                    id: txt.id,
                    offsetX: x - txt.x,
                    offsetY: y - txt.y,
                  });
                }}
                onDoubleClick={(e) => {
                  if (readOnly) return;
                  e.stopPropagation();
                  setEditingTextId(txt.id);
                  setEditingTextValue(txt.text);
                }}
              >
                {/* Subtle Box Background with crisp border */}
                <rect
                  x="-6"
                  y="-4"
                  width={boxWidth}
                  height={boxHeight}
                  rx="6"
                  fill={isSelected ? '#eff6ff' : txt.backgroundColor || '#ffffff'}
                  fillOpacity="0.94"
                  stroke={isSelected ? '#2563eb' : txt.isBoxed ? '#94a3b8' : 'transparent'}
                  strokeWidth={isSelected ? 1.8 : 1}
                  strokeDasharray={isSelected ? '4,3' : undefined}
                  filter="drop-shadow(0 1px 3px rgba(0,0,0,0.12))"
                />

                {/* Multiline text rendering */}
                {lines.map((line, idx) => (
                  <text
                    key={idx}
                    x="2"
                    y={fontSize + idx * lineHeight}
                    fontFamily="'Space Grotesk', -apple-system, sans-serif"
                    fontSize={fontSize}
                    fontWeight={txt.fontWeight || '700'}
                    fill={txt.color || '#0f172a'}
                    textAnchor="start"
                    className="pointer-events-none select-none"
                  >
                    {line}
                  </text>
                ))}

                {/* Movable Handle badge when selected */}
                {isSelected && !readOnly && (
                  <g transform={`translate(${boxWidth - 10}, -10)`}>
                    <circle r="7" fill="#2563eb" />
                    <text x="0" y="3" fontSize="8" fill="#fff" textAnchor="middle" fontWeight="bold">
                      ⋮⋮
                    </text>
                  </g>
                )}
              </g>
            );
          })}
        </g>
      </svg>
      </div>

      {/* Inline Text Editor Overlay when double-clicked */}
      {editingTextId && (
        <div className="absolute inset-0 z-40 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-[2px]">
          <div className="bg-white rounded-xl shadow-2xl p-4 border border-slate-300 w-full max-w-md animate-in zoom-in-95">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                <Edit2 className="w-3.5 h-3.5 text-blue-600" />
                Edit Coaching Note / Whiteboard Text
              </span>
              <button
                onClick={() => setEditingTextId(null)}
                className="p-1 text-slate-400 hover:text-slate-700 rounded"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <textarea
              value={editingTextValue}
              onChange={(e) => setEditingTextValue(e.target.value)}
              rows={4}
              className="w-full text-xs font-mono p-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
              placeholder="Enter text..."
              autoFocus
            />
            <div className="flex justify-end gap-2 mt-3">
              <button
                onClick={() => setEditingTextId(null)}
                className="px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-100 rounded-lg font-semibold"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveTextEdit}
                className="px-4 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-bold hover:bg-blue-700 flex items-center gap-1.5"
              >
                <Check className="w-3.5 h-3.5" />
                Save Text
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
