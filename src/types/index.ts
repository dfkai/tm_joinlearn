// ============ 游戏类型定义 ============

export type ColorId = 'red' | 'blue' | 'yellow';
export type TetrominoType = 'I' | 'O' | 'T' | 'L' | 'J' | 'S' | 'Z';

export interface Cell {
  color: ColorId;
  pieceId: number;
}

export interface Piece {
  shape: (ColorId | null)[][];
  x: number;
  y: number;
  pieceId?: number;
}

export interface DragPosition {
  x: number;
  y: number;
}

export interface PreviewPosition {
  x: number;
  y: number;
  valid: boolean;
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
