import type { Cell, Piece, ColorId, TetrominoType, GhostPosition } from '../types';
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
        if (board[newY]?.[newX]) return false;
      }
    }
  }
  return true;
};

/**
 * 检查方块是否可以向下移动
 */
export const canMoveDown = (piece: Piece, board: (Cell | null)[][]): boolean => {
  return canPlaceAt(piece.shape, piece.x, piece.y + 1, board);
};

/**
 * 检查方块是否可以向左/右移动
 */
export const canMoveHorizontal = (
  piece: Piece,
  direction: -1 | 1,
  board: (Cell | null)[][]
): boolean => {
  return canPlaceAt(piece.shape, piece.x + direction, piece.y, board);
};

/**
 * 计算硬降落点（Ghost Piece位置）
 */
export const calculateGhostPosition = (
  piece: Piece,
  board: (Cell | null)[][]
): GhostPosition => {
  let ghostY = piece.y;

  // 逐行向下检测，直到碰撞
  while (canPlaceAt(piece.shape, piece.x, ghostY + 1, board)) {
    ghostY++;
  }

  return { x: piece.x, y: ghostY };
};

/**
 * 在顶部中间位置生成新方块
 */
export const spawnPiece = (board: (Cell | null)[][]): Piece | null => {
  const shapes = Object.keys(TETROMINOS) as TetrominoType[];
  const randomType = shapes[Math.floor(Math.random() * shapes.length)];
  const shape = TETROMINOS[randomType];

  // 每个格子随机颜色
  const coloredShape: (ColorId | null)[][] = shape.map((row: number[]) =>
    row.map((cell: number) => cell ? COLOR_IDS[Math.floor(Math.random() * COLORS.length)] : null)
  );

  // 计算生成位置（根据方块形状居中）
  const shapeWidth = coloredShape[0].length;
  const spawnX = Math.floor((BOARD_SIZE - shapeWidth) / 2);
  const spawnY = 0;

  // 检查是否可以生成（游戏结束判定）
  if (!canPlaceAt(coloredShape, spawnX, spawnY, board)) {
    return null; // 无法生成 = Game Over
  }

  return {
    shape: coloredShape,
    x: spawnX,
    y: spawnY,
    type: randomType
  };
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

/**
 * 尝试旋转并应用踢墙
 * 返回旋转后的方块，如果无法旋转则返回 null
 */
export const tryRotate = (
  piece: Piece,
  board: (Cell | null)[][]
): Piece | null => {
  const rotated = rotatePiece(piece);

  // 先尝试原位旋转
  if (canPlaceAt(rotated.shape, rotated.x, rotated.y, board)) {
    return rotated;
  }

  // 踢墙偏移尝试（标准 SRS 简化版）
  const kicks = [
    [0, 0],   // 原位
    [-1, 0],  // 左移 1
    [1, 0],   // 右移 1
    [0, -1],  // 上移 1
    [-1, -1], // 左上
    [1, -1],  // 右上
    [-2, 0],  // 左移 2（I 块需要）
    [2, 0],   // 右移 2（I 块需要）
    [0, -2],  // 上移 2
  ];

  for (const [dx, dy] of kicks) {
    const newX = rotated.x + dx;
    const newY = rotated.y + dy;
    if (canPlaceAt(rotated.shape, newX, newY, board)) {
      return { ...rotated, x: newX, y: newY };
    }
  }

  return null; // 无法旋转
};

/**
 * 检查放置后是否会触发任何消除
 * 用于即时固定判断
 */
export const wouldTriggerElimination = (
  piece: Piece,
  board: (Cell | null)[][],
  checkLines: (b: (Cell | null)[][]) => { cleared: boolean },
  checkGomoku: (b: (Cell | null)[][]) => { cleared: boolean }
): boolean => {
  const tempBoard = board.map(row => [...row]);

  // 模拟放置
  for (let y = 0; y < piece.shape.length; y++) {
    for (let x = 0; x < piece.shape[y].length; x++) {
      if (piece.shape[y][x]) {
        const ny = piece.y + y;
        const nx = piece.x + x;
        if (ny >= 0 && ny < BOARD_SIZE && nx >= 0 && nx < BOARD_SIZE) {
          tempBoard[ny][nx] = { color: piece.shape[y][x]!, pieceId: -1 };
        }
      }
    }
  }

  return checkLines(tempBoard).cleared || checkGomoku(tempBoard).cleared;
};
