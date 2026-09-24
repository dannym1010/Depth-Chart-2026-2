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
  Home as HomeIcon,
} from 'lucide-react';
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
  { id: 'game_day', label: '🏆 Game Day Hub', icon: Swords },
  { id: 'hudl_scout', label: '📊 Hudl Scout', icon: Target },
  { id: 'schedule', label: '📅 Schedule', icon: Calendar },
  { id: 'compliance', label: '⚡ Compliance & Hours', icon: Zap },
  { id: 'ppr', label: '📊 PFF', icon: Activity },
  { id: 'depth_chart', label: '📋 Depth Chart', icon: ClipboardList },
  { id: 'practice', label: '📋 Practice Plan', icon: ClipboardList },
  { id: 'drills', label: '🏋️ Drill Library', icon: Dumbbell },
  { id: 'guide', label: '📖 Playbooks & Guides', icon: BookOpen },
  { id: 'whiteboard', label: '🖍️ Whiteboard Playbook', icon: PenTool },
  { id: 'users', label: '👥 Staff & Access', icon: Users, adminOnly: true },
];
