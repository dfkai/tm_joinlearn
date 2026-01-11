import type { Cell, ColorId, LineCheckResult, GomokuCheckResult } from '../types';
import { BOARD_SIZE } from '../constants';

/**
 * 检查五子连珠 (Gomoku - 得分机制)
 */
export const checkGomoku = (board: (Cell | null)[][]): GomokuCheckResult => {
  let cleared = false;
  let clearCount = 0;
  const toRemove = new Set<string>();
  const matchedColors = new Set<ColorId>();

  const directions = [
    { dy: 0, dx: 1 },  // 水平
    { dy: 1, dx: 0 },  // 垂直
    { dy: 1, dx: 1 },  // 对角线 \
    { dy: 1, dx: -1 }  // 对角线 /
  ];

  for (let y = 0; y < BOARD_SIZE; y++) {
    for (let x = 0; x < BOARD_SIZE; x++) {
      const cell = board[y][x];
      if (!cell) continue;
      const color = cell.color;

      for (const { dy, dx } of directions) {
        const line: [number, number][] = [[y, x]];
        for (let i = 1; i < 5; i++) {
          const ny = y + dy * i;
          const nx = x + dx * i;
          if (ny < 0 || ny >= BOARD_SIZE || nx < 0 || nx >= BOARD_SIZE) break;
          const nextCell = board[ny][nx];
          if (!nextCell || nextCell.color !== color) break;
          line.push([ny, nx]);
        }

        // 连珠判定：5连及以上
        if (line.length >= 5) {
          line.forEach(([ly, lx]) => toRemove.add(`${ly},${lx}`));
          cleared = true;
          clearCount++;
          matchedColors.add(color);
        }
      }
    }
  }

  return {
    cleared,
    count: clearCount,
    eliminating: toRemove,
    matchedColors: Array.from(matchedColors)
  };
};

/**
 * 检查行/列消除 (多级消除判定)
 */
export const checkLines = (board: (Cell | null)[][]): LineCheckResult => {
  let cleared = false;
  let clearCount = 0;
  const allEliminating = new Set<string>();
  const perfectEliminating = new Set<string>();
  const perfectLines: { type: 'row' | 'col'; index: number }[] = [];

  // 1. 标准行消除 (生存机制)：只要满10格，不论颜色
  for (let y = 0; y < BOARD_SIZE; y++) {
    const row = board[y];
    if (row.every(cell => cell !== null)) {
      const firstColor = row[0]?.color;
      const isPerfect = row.every(cell => cell?.color === firstColor);

      cleared = true;
      clearCount += isPerfect ? 3 : 1;
      for (let x = 0; x < BOARD_SIZE; x++) {
        allEliminating.add(`${y},${x}`);
        if (isPerfect) perfectEliminating.add(`${y},${x}`);
      }
      if (isPerfect) perfectLines.push({ type: 'row', index: y });
    }
  }

  // 2. 完美列消除 (高阶奖励)：只有满 10 格且同色才消除
  for (let x = 0; x < BOARD_SIZE; x++) {
    const col = Array.from({ length: BOARD_SIZE }, (_, y) => board[y][x]);
    if (col.every(cell => cell !== null)) {
      const firstColor = col[0]?.color;
      const isPerfect = col.every(cell => cell?.color === firstColor);

      if (isPerfect) {
        cleared = true;
        clearCount += 3;
        for (let y = 0; y < BOARD_SIZE; y++) {
          allEliminating.add(`${y},${x}`);
          perfectEliminating.add(`${y},${x}`);
        }
        perfectLines.push({ type: 'col', index: x });
      }
    }
  }

  return {
    cleared,
    count: clearCount,
    eliminating: allEliminating,
    perfectEliminating,
    perfectLines
  };
};

/**
 * 应用重力：让方块下落填充空隙
 * 返回新棋盘和下落偏移量
 */
export const applyGravity = (
  board: (Cell | null)[][]
): { board: (Cell | null)[][]; offsets: Record<string, number>; hasChanges: boolean } => {
  const newBoard = board.map(row => [...row]);
  const offsets: Record<string, number> = {};
  let hasChanges = false;
  let fellThisPass = true;

  while (fellThisPass) {
    fellThisPass = false;
    for (let y = BOARD_SIZE - 2; y >= 0; y--) {
      for (let x = 0; x < BOARD_SIZE; x++) {
        if (newBoard[y][x] && newBoard[y + 1][x] === null) {
          newBoard[y + 1][x] = newBoard[y][x];
          newBoard[y][x] = null;
          // 累积偏移量用于动画
          const cellSize = 40; // CELL_SIZE
          offsets[`${y + 1},${x}`] = (offsets[`${y},${x}`] || 0) + cellSize;
          delete offsets[`${y},${x}`];
          fellThisPass = true;
          hasChanges = true;
        }
      }
    }
  }

  return { board: newBoard, offsets, hasChanges };
};

/**
 * 从棋盘移除指定位置的方块
 */
export const removeCells = (
  board: (Cell | null)[][],
  cellsToRemove: Set<string>
): (Cell | null)[][] => {
  const newBoard = board.map(row => [...row]);
  cellsToRemove.forEach(key => {
    const [y, x] = key.split(',').map(Number);
    newBoard[y][x] = null;
  });
  return newBoard;
};

/**
 * 找出所有指定颜色的格子
 */
export const findCellsByColor = (
  board: (Cell | null)[][],
  color: ColorId
): Set<string> => {
  const cells = new Set<string>();
  for (let y = 0; y < BOARD_SIZE; y++) {
    for (let x = 0; x < BOARD_SIZE; x++) {
      if (board[y][x]?.color === color) {
        cells.add(`${y},${x}`);
      }
    }
  }
  return cells;
};
