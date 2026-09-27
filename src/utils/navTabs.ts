import type { ComponentType } from 'react';
import {
  Target,
  Swords,
  Zap,
  BookOpen,
  Dumbbell,
  ClipboardList,
  Users,
  Calendar,
  Smartphone,
  PenTool,
  Activity,
  Home as HomeIcon, Library } from 'lucide-react';
import type { UnitType } from '../types';

export interface NavTabItem {
  id: UnitType;
  label: string;
  icon: ComponentType<{ className?: string }>;
  adminOnly?: boolean;
}

export const DEFAULT_NAV_TABS: NavTabItem[] = [
  { id: 'home', label: '🏠 Home', icon: HomeIcon },
  { id: 'mobile_hub', label: '📱 Mobile HUD', icon: Smartphone },
  { id: 'call_sheet', label: '🏈 Call Sheet & Wristbands', icon: Swords },
  { id: 'hudl_scout', label: '📊 Hudl Scout', icon: Target },
  { id: 'schedule', label: '📅 Schedule', icon: Calendar },
  { id: 'compliance', label: '⚡ Compliance & Hours', icon: Zap },
  { id: 'playbook', label: '🏈 Play Library', icon: Library },
  { id: 'depth_chart', label: '📋 Depth Chart', icon: ClipboardList },
  { id: 'practice', label: '📋 Practice Plan', icon: ClipboardList },
  { id: 'drills', label: '🏋️ Drill Library', icon: Dumbbell },
  { id: 'whiteboard', label: '🖍️ Whiteboard Playbook', icon: PenTool },
  { id: 'users', label: '👥 Staff & Access', icon: Users, adminOnly: true },
];
