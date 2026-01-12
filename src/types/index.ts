// ============ 游戏类型定义 ============

export type ColorId = 'red' | 'blue' | 'yellow';
export type TetrominoType = 'I' | 'O' | 'T' | 'L' | 'J' | 'S' | 'Z';

// 游戏状态
export type GameState = 'idle' | 'playing' | 'paused' | 'gameover';

// 输入动作
export type InputAction =
  | 'move_left'
  | 'move_right'
  | 'rotate'
  | 'soft_drop'
  | 'hard_drop'
  | 'pause';

// 游戏配置
export interface GameConfig {
  initialDropInterval: number;  // 初始下落间隔 (ms)
  minDropInterval: number;      // 最小下落间隔 (ms)
  softDropMultiplier: number;   // 软降加速倍数
  levelUpScore: number;         // 升级所需分数
  lockDelay: number;            // 落地后锁定延迟 (ms)
}

export interface Cell {
  color: ColorId;
  pieceId: number;
}

export interface Piece {
  shape: (ColorId | null)[][];
  x: number;
  y: number;
  pieceId?: number;
  type?: TetrominoType;  // 方块类型
}

// 硬降预览位置
export interface GhostPosition {
  x: number;
  y: number;
}

export interface SoulCounters {
  red: number;
  blue: number;
  yellow: number;
}

export interface Combo {
  x: number;
  y: number;
  id: number;
}

// 粒子效果
export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  color: string;
  size: number;
  life: number;
  maxLife: number;
}

// 区域消除检查结果
export interface ClusterCheckResult {
  cleared: boolean;
  count: number;
  eliminating: Set<string>;
  matchedColors: ColorId[];
}

export interface LineCheckResult {
  cleared: boolean;
  count: number;
  eliminating: Set<string>;
  perfectEliminating: Set<string>;
  perfectLines: { type: 'row' | 'col'; index: number }[];
}

export interface GomokuCheckResult {
  cleared: boolean;
  count: number;
  eliminating: Set<string>;
  matchedColors: ColorId[];
}

// 关卡系统
export type GameMode = 'score' | 'level';

export interface LevelTarget {
  red?: number;
  blue?: number;
  yellow?: number;
}

export interface LevelProgress {
  red: number;
  blue: number;
  yellow: number;
}
