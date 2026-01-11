import type { Cell, Piece, ColorId, TetrominoType } from '../types';
import { BOARD_SIZE, COLOR_IDS, COLORS, TETROMINOS } from '../constants';

/**
 * 检查方块是否可以放置在指定位置
 */
export const canPlaceAt = (
  shape: (ColorId | null)[][],
  boardX: number,
  boardY: number,
  board: (Cell | null)[][]
): boolean => {
  for (let y = 0; y < shape.length; y++) {
    for (let x = 0; x < shape[y].length; x++) {
      if (shape[y][x]) {
        const newY = boardY + y;
        const newX = boardX + x;
        if (newX < 0 || newX >= BOARD_SIZE || newY < 0 || newY >= BOARD_SIZE) return false;
        if (board[newY][newX]) return false;
      }
    }
  }
  return true;
};

/**
 * 寻找形状的随机有效位置
 */
export const findValidPosition = (
  shape: (ColorId | null)[][],
  board: (Cell | null)[][]
): { x: number; y: number } | null => {
  const possiblePositions: { x: number; y: number }[] = [];

  for (let y = 0; y <= BOARD_SIZE - shape.length; y++) {
    for (let x = 0; x <= BOARD_SIZE - shape[0].length; x++) {
      if (canPlaceAt(shape, x, y, board)) {
        possiblePositions.push({ x, y });
      }
    }
  }

  if (possiblePositions.length === 0) return null;
  return possiblePositions[Math.floor(Math.random() * possiblePositions.length)];
};

/**
 * 生成随机方块
 */
export const generatePiece = (board: (Cell | null)[][]): Piece | null => {
  const shapes = Object.keys(TETROMINOS) as TetrominoType[];
  const randomShape = shapes[Math.floor(Math.random() * shapes.length)];
  const shape = TETROMINOS[randomShape];

  // 每个格子随机颜色
  const coloredShape: (ColorId | null)[][] = shape.map((row: number[]) =>
    row.map((cell: number) => cell ? COLOR_IDS[Math.floor(Math.random() * COLORS.length)] : null)
  );

  const validPos = findValidPosition(coloredShape, board);

  if (!validPos) {
    return null;
  }

  return { shape: coloredShape, x: validPos.x, y: validPos.y };
};

/**
 * 旋转方块：绕方阵中心顺时针旋转 90 度
 */
export const rotatePiece = (piece: Piece): Piece => {
  const shape = piece.shape;
  const n = shape.length;
  const newShape: (ColorId | null)[][] = Array(n).fill(null).map(() => Array(n).fill(null));

  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      newShape[x][n - 1 - y] = shape[y][x];
    }
  }

  return { ...piece, shape: newShape };
};
