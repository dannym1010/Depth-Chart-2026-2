import React, { useState } from 'react';
import { X, Plus, Sparkles, Check, BookOpen } from 'lucide-react';
import { DefensivePositionCategory, WhiteboardDrill, DEFENSIVE_POSITION_GROUPS } from './whiteboardDrillData';
import { WhiteboardToken, WhiteboardArrow, WhiteboardZoneBubble } from '../../types';

interface AddWhiteboardDrillModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaveDrill: (drill: WhiteboardDrill) => void;
  defaultCategory?: DefensivePositionCategory;
  currentBoardTokens?: WhiteboardToken[];
  currentBoardArrows?: WhiteboardArrow[];
  currentBoardZones?: WhiteboardZoneBubble[];
}

export const AddWhiteboardDrillModal: React.FC<AddWhiteboardDrillModalProps> = ({
  isOpen,
  onClose,
  onSaveDrill,
  defaultCategory = 'OFFENSE',
  currentBoardTokens = [],
  currentBoardArrows = [],
  currentBoardZones = [],
}) => {
  const [category, setCategory] = useState<DefensivePositionCategory>(defaultCategory);
  const [title, setTitle] = useState('');
  const [subtitle, setSubtitle] = useState('');
  const [objective, setObjective] = useState('');
  const [setup, setSetup] = useState('');
  const [equipment, setEquipment] = useState('');
  const [instructionsText, setInstructionsText] = useState('');
  const [cuesText, setCuesText] = useState('');
  const [faultsText, setFaultsText] = useState('');
  const [diagramType, setDiagramType] = useState<'current_board' | 'description_only' | 'blank_tokens'>('current_board');

  if (!isOpen) return null;

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      alert('Please enter a drill title.');
      return;
    }

    const catGroup = DEFENSIVE_POSITION_GROUPS.find((g) => g.id === category);
    const categoryLabel = catGroup ? catGroup.label : category;

    const instructions = instructionsText
      .split('\n')
      .map((s) => s.trim())
      .filter(Boolean);

    const cues = cuesText
      .split('\n')
      .map((s) => s.trim())
      .filter(Boolean);

    const faults = faultsText
      .split('\n')
      .map((s) => s.trim())
      .filter(Boolean);

    let phases: WhiteboardDrill['phases'] = [];

    if (diagramType === 'current_board' && (currentBoardTokens.length > 0 || currentBoardArrows.length > 0)) {
      phases = [
        {
          name: 'PHASE 1: INITIAL ALIGNMENT & EXECUTION',
          description: objective || 'Execute primary assignments and technique.',
          tokens: [...currentBoardTokens],
          arrows: [...currentBoardArrows],
          zones: [...currentBoardZones],
        },
      ];
    } else if (diagramType === 'blank_tokens') {
      // Create sensible default starter tokens based on category
      if (category === 'OFFENSE') {
        phases = [
          {
            name: 'PHASE 1: OFFENSIVE ALIGNMENT',
            description: 'Offensive alignment and initial track.',
            tokens: [
              { id: 'c-1', type: 'O', label: 'C', x: 350, y: 240, color: '#1a1a24' },
              { id: 'qb-1', type: 'O', label: 'QB', x: 350, y: 280, color: '#d91b24' },
              { id: 'rb-1', type: 'O', label: 'RB', x: 350, y: 320, color: '#2563eb' },
              { id: 'wr-1', type: 'O', label: 'WR', x: 180, y: 240, color: '#2563eb' },
            ],
            arrows: [
              { id: 'a-1', type: 'run', startX: 350, startY: 320, endX: 350, endY: 220, color: '#2563eb', label: 'Burst' },
            ],
            zones: [],
          },
        ];
      } else {
        phases = [
          {
            name: 'PHASE 1: DEFENSIVE ALIGNMENT',
            description: 'Defensive alignment and attack track.',
            tokens: [
              { id: 'x-1', type: 'X', label: category === 'DL' ? 'DT' : category === 'DE' ? 'DE' : category === 'DB' ? 'CB' : 'LB', x: 350, y: 280, color: '#0052cc' },
              { id: 'o-1', type: 'O', label: 'OFF', x: 350, y: 220, color: '#d91b24' },
            ],
            arrows: [
              { id: 'a-1', type: 'tackle', startX: 350, startY: 280, endX: 350, endY: 230, color: '#0052cc', label: 'Attack Fit' },
            ],
            zones: [],
          },
        ];
      }
    }

    const newDrill: WhiteboardDrill = {
      id: `custom-drill-${Date.now()}`,
      category,
      categoryLabel,
      title: title.toUpperCase(),
      subtitle: subtitle || 'Custom Coaching Drill',
      objective: objective || 'Ingrain critical youth football fundamentals.',
      setup: setup || 'Field markings, cones and footballs.',
      equipment: equipment || 'Cones, footballs, shields.',
      instructions: instructions.length > 0 ? instructions : ['Align in stance on whistle.', 'Execute assignment with violent footwork.', 'Finish through the whistle.'],
      cues: cues.length > 0 ? cues : ['Stay low', 'Keep feet buzzing', 'Finish through whistle'],
      faults: faults.length > 0 ? faults : ['False step on snap', 'High pad level'],
      phases,
    };

    onSaveDrill(newDrill);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-xs animate-in fade-in">
      <div className="w-full max-w-2xl bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800 bg-slate-950/60">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-emerald-600/20 text-emerald-400 rounded-xl border border-emerald-500/30">
              <Plus className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-black text-white uppercase tracking-wide">
                Add New Whiteboard Drill
              </h2>
              <p className="text-xs text-slate-400">
                Creates a new drill for the whiteboard and syncs with the left navigation tree
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSave} className="flex-1 overflow-y-auto p-5 space-y-4 text-xs">
          {/* Category & Title */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-slate-300 font-bold mb-1">Position Group / Folder</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as DefensivePositionCategory)}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white font-bold focus:outline-none focus:border-emerald-500"
              >
                {DEFENSIVE_POSITION_GROUPS.filter((g) => g.id !== 'ALL').map((group) => (
                  <option key={group.id} value={group.id}>
                    {group.icon} {group.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="sm:col-span-2">
              <label className="block text-slate-300 font-bold mb-1">
                Drill Title <span className="text-emerald-400">*</span>
              </label>
              <input
                type="text"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g., QB: SPRINT-OUT PASSING & BOOTLEG"
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white font-bold placeholder-slate-500 focus:outline-none focus:border-emerald-500"
              />
            </div>
          </div>

          {/* Subtitle & Equipment */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-300 font-bold mb-1">Technique Subtitle</label>
              <input
                type="text"
                value={subtitle}
                onChange={(e) => setSubtitle(e.target.value)}
                placeholder="e.g., Pocket Depth, Throw on Run & High-Low Read"
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-slate-200 placeholder-slate-500 focus:outline-none focus:border-emerald-500"
              />
            </div>
            <div>
              <label className="block text-slate-300 font-bold mb-1">Equipment Needed</label>
              <input
                type="text"
                value={equipment}
                onChange={(e) => setEquipment(e.target.value)}
                placeholder="e.g., 4 cones, 3 footballs, 2 hand pads"
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-slate-200 placeholder-slate-500 focus:outline-none focus:border-emerald-500"
              />
            </div>
          </div>

          {/* Objective & Setup */}
          <div>
            <label className="block text-slate-300 font-bold mb-1">Drill Objective & Focus</label>
            <textarea
              rows={2}
              value={objective}
              onChange={(e) => setObjective(e.target.value)}
              placeholder="What core technique, footwork, or assignment are athletes mastering?"
              className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-slate-200 placeholder-slate-500 focus:outline-none focus:border-emerald-500"
            />
          </div>

          <div>
            <label className="block text-slate-300 font-bold mb-1">Field Setup & Alignment</label>
            <input
              type="text"
              value={setup}
              onChange={(e) => setSetup(e.target.value)}
              placeholder="e.g., 20-yard line, hash marks, 2 single-file lines facing each other"
              className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-slate-200 placeholder-slate-500 focus:outline-none focus:border-emerald-500"
            />
          </div>

          {/* Diagram Type Option */}
          <div className="p-3 bg-slate-950/60 border border-slate-800 rounded-xl space-y-2">
            <span className="block text-slate-300 font-black uppercase text-[11px] tracking-wider">
              Whiteboard Diagram Option
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <label
                className={`flex items-start gap-2 p-2.5 rounded-xl border cursor-pointer transition-all ${
                  diagramType === 'current_board'
                    ? 'bg-emerald-950/40 border-emerald-500 text-white'
                    : 'bg-slate-800/60 border-slate-700 text-slate-400'
                }`}
              >
                <input
                  type="radio"
                  name="diagramType"
                  checked={diagramType === 'current_board'}
                  onChange={() => setDiagramType('current_board')}
                  className="mt-0.5"
                />
                <div>
                  <span className="font-bold text-xs block text-slate-200">Current Whiteboard</span>
                  <span className="text-[10px] text-slate-400 block leading-tight">
                    Snapshot tokens & lines currently on canvas ({currentBoardTokens.length} tokens)
                  </span>
                </div>
              </label>

              <label
                className={`flex items-start gap-2 p-2.5 rounded-xl border cursor-pointer transition-all ${
                  diagramType === 'blank_tokens'
                    ? 'bg-emerald-950/40 border-emerald-500 text-white'
                    : 'bg-slate-800/60 border-slate-700 text-slate-400'
                }`}
              >
                <input
                  type="radio"
                  name="diagramType"
                  checked={diagramType === 'blank_tokens'}
                  onChange={() => setDiagramType('blank_tokens')}
                  className="mt-0.5"
                />
                <div>
                  <span className="font-bold text-xs block text-slate-200">Default Diagram</span>
                  <span className="text-[10px] text-slate-400 block leading-tight">
                    Generate starter tokens for this position
                  </span>
                </div>
              </label>

              <label
                className={`flex items-start gap-2 p-2.5 rounded-xl border cursor-pointer transition-all ${
                  diagramType === 'description_only'
                    ? 'bg-emerald-950/40 border-emerald-500 text-white'
                    : 'bg-slate-800/60 border-slate-700 text-slate-400'
                }`}
              >
                <input
                  type="radio"
                  name="diagramType"
                  checked={diagramType === 'description_only'}
                  onChange={() => setDiagramType('description_only')}
                  className="mt-0.5"
                />
                <div>
                  <span className="font-bold text-xs block text-slate-200">Description Only</span>
                  <span className="text-[10px] text-slate-400 block leading-tight">
                    No diagram needed (shows normal instructions card)
                  </span>
                </div>
              </label>
            </div>
          </div>

          {/* Instructions, Cues & Faults */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-slate-300 font-bold mb-1">
                Step-by-Step Execution (1 per line)
              </label>
              <textarea
                rows={3}
                value={instructionsText}
                onChange={(e) => setInstructionsText(e.target.value)}
                placeholder="1. On whistle, fire first step&#10;2. Strike breastplate&#10;3. Drive 5 yards"
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-2.5 py-2 text-slate-200 placeholder-slate-500 focus:outline-none focus:border-emerald-500 font-mono text-[11px]"
              />
            </div>
            <div>
              <label className="block text-slate-300 font-bold mb-1">
                Coaching Cues (1 per line)
              </label>
              <textarea
                rows={3}
                value={cuesText}
                onChange={(e) => setCuesText(e.target.value)}
                placeholder="Stay low in tunnel&#10;Violent hand strike&#10;Eyes up through cage"
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-2.5 py-2 text-slate-200 placeholder-slate-500 focus:outline-none focus:border-emerald-500 font-mono text-[11px]"
              />
            </div>
            <div>
              <label className="block text-slate-300 font-bold mb-1">
                Common Faults (1 per line)
              </label>
              <textarea
                rows={3}
                value={faultsText}
                onChange={(e) => setFaultsText(e.target.value)}
                placeholder="False step on snap&#10;Dropping head&#10;Reaching outside jersey frame"
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-2.5 py-2 text-slate-200 placeholder-slate-500 focus:outline-none focus:border-emerald-500 font-mono text-[11px]"
              />
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-750 text-slate-300 rounded-xl font-bold cursor-pointer transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-black shadow-md flex items-center gap-1.5 cursor-pointer transition-colors"
            >
              <Check className="w-4 h-4" />
              <span>Save & Add Drill</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
