import type { ColorId, TetrominoType, GameConfig, InputAction } from '../types';

// ============ 游戏常量 ============

export const BOARD_SIZE = 10;
export const CELL_SIZE = 40;

// 颜色配置
export const COLORS = ['#FF3B3F', '#4A90E2', '#FFD700'] as const;
export const COLOR_IDS: ColorId[] = ['red', 'blue', 'yellow'];

// 颜色映射
export const COLOR_MAP: Record<ColorId, string> = {
  red: '#FF3B3F',
  blue: '#4A90E2',
  yellow: '#FFD700',
};

// 俄罗斯方块形状定义
export const TETROMINOS: Record<TetrominoType, number[][]> = {
  I: [
    [0, 0, 0, 0],
    [1, 1, 1, 1],
    [0, 0, 0, 0],
    [0, 0, 0, 0]
  ],
  O: [
    [1, 1],
    [1, 1]
  ],
  T: [
    [0, 1, 0],
    [1, 1, 1],
    [0, 0, 0]
  ],
  L: [
    [0, 0, 1],
    [1, 1, 1],
    [0, 0, 0]
  ],
  J: [
    [1, 0, 0],
    [1, 1, 1],
    [0, 0, 0]
  ],
  S: [
    [0, 1, 1],
    [1, 1, 0],
    [0, 0, 0]
  ],
  Z: [
    [1, 1, 0],
    [0, 1, 1],
    [0, 0, 0]
  ]
};

// 游戏配置
export const GAME_CONFIG: GameConfig = {
  initialDropInterval: 1000,   // 1秒下落一格
  minDropInterval: 100,        // 最快0.1秒
  softDropMultiplier: 20,      // 软降速度20倍
  levelUpScore: 500,           // 每500分升级
  lockDelay: 500,              // 落地后0.5秒锁定
};

// 方块生成位置（顶部中间）
export const SPAWN_POSITION = {
  x: Math.floor(BOARD_SIZE / 2) - 2,  // 居中
  y: 0,                                // 顶部
};

// 键盘映射
export const KEY_BINDINGS: Record<string, InputAction> = {
  'ArrowLeft': 'move_left',
  'KeyA': 'move_left',
  'ArrowRight': 'move_right',
  'KeyD': 'move_right',
  'ArrowUp': 'rotate',
  'KeyW': 'rotate',
  'ArrowDown': 'soft_drop',
  'KeyS': 'soft_drop',
  'Space': 'hard_drop',
  'Escape': 'pause',
  'KeyP': 'pause',
};

// 动画时间常量
export const ANIMATION = {
  MATCH_HIGHLIGHT: 500,
  CLEAR_VANISH: 300,
  GRAVITY_FALL: 400,
  SOUL_BOMB_CHARGE: 800,
} as const;
