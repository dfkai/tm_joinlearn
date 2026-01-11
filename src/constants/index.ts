import type { ColorId, TetrominoType } from '../types';

// ============ 游戏常量 ============

export const BOARD_SIZE = 10;
export const CELL_SIZE = 40;
export const TIME_LIMIT = 10;

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

// 动画时间常量
export const ANIMATION = {
  MATCH_HIGHLIGHT: 500,
  CLEAR_VANISH: 300,
  GRAVITY_FALL: 400,
  SOUL_BOMB_CHARGE: 800,
} as const;
