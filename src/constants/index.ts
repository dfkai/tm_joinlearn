import type { ColorId, TetrominoType, GameConfig, InputAction, LevelTarget } from '../types';

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

// 关卡配置
// initialBlocks: 初始色块数量（底部随机分布）
// dropSpeed: 下落间隔（毫秒），越小越快
export const LEVELS: LevelTarget[] = [
  { yellow: 12, initialBlocks: 0, dropSpeed: 1000 },                          // 第1关: 空棋盘起步
  { yellow: 12, red: 12, initialBlocks: 5, dropSpeed: 950 },                  // 第2关: 5个初始色块
  { yellow: 15, red: 15, blue: 12, initialBlocks: 8, dropSpeed: 900 },        // 第3关: 8个初始色块
  { red: 18, blue: 18, yellow: 18, initialBlocks: 12, dropSpeed: 850 },       // 第4关: 12个初始色块
  { red: 22, blue: 22, yellow: 22, initialBlocks: 15, dropSpeed: 800 },       // 第5关: 15个初始色块
  { red: 25, blue: 25, yellow: 25, initialBlocks: 18, dropSpeed: 750 },       // 第6关: 18个初始色块
  { red: 30, blue: 30, yellow: 30, initialBlocks: 22, dropSpeed: 700 },       // 第7关: 22个初始色块
  { red: 35, blue: 35, yellow: 35, initialBlocks: 25, dropSpeed: 650 },       // 第8关: 25个初始色块
  { red: 40, blue: 40, yellow: 40, initialBlocks: 28, dropSpeed: 600 },       // 第9关: 28个初始色块
  { red: 50, blue: 50, yellow: 50, initialBlocks: 32, dropSpeed: 500 },       // 第10关: 32个初始色块
];
