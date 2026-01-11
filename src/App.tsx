import { useState, useEffect, useRef } from 'react';
import { Sparkles, Clock } from 'lucide-react';

// 类型和常量
import type { Cell, Piece, ColorId, DragPosition, PreviewPosition, SoulCounters, Combo, TetrominoType } from './types';
import { BOARD_SIZE, CELL_SIZE, TIME_LIMIT, COLOR_IDS, COLORS, TETROMINOS } from './constants';

const GomokuTetris = () => {
  const [board, setBoard] = useState<(Cell | null)[][]>(Array(BOARD_SIZE).fill(null).map(() => Array(BOARD_SIZE).fill(null)));
  const pieceIdCounter = useRef(1);
  const [score, setScore] = useState(0);
  const [highScore, setHighScore] = useState(() => {
    return parseInt(localStorage.getItem('gomoku_high_score') || '0');
  });
  const [currentPiece, setCurrentPiece] = useState<Piece | null>(null);
  const [nextPiece, setNextPiece] = useState<Piece | null>(null);
  const [dragging, setDragging] = useState(false);
  const [dragPos, setDragPos] = useState<DragPosition>({ x: 0, y: 0 });
  const [dragStartPos, setDragStartPos] = useState<DragPosition | null>(null);
  const [previewPos, setPreviewPos] = useState<PreviewPosition | null>(null);
  const [timeLeft, setTimeLeft] = useState(TIME_LIMIT);
  const [gameOver, setGameOver] = useState(false);
  const [combos, setCombos] = useState<Combo[]>([]);
  const [justDropped, setJustDropped] = useState(false);
  const [startedOnPiece, setStartedOnPiece] = useState(false);
  const [clearingCells, setClearingCells] = useState<Set<string>>(new Set());
  const [matchingCells, setMatchingCells] = useState<Set<string>>(new Set());
  const [isSettling, setIsSettling] = useState(false);
  const [isWaitingToStart, setIsWaitingToStart] = useState(true);
  const [isTouchSession, setIsTouchSession] = useState(false);
  const [fallingOffsets, setFallingOffsets] = useState<Record<string, number>>({});
  const [fallingStartTime, setFallingStartTime] = useState(0);
  const [isShaking, setIsShaking] = useState(false);
  const [soulCounters, setSoulCounters] = useState<SoulCounters>({ red: 0, blue: 0, yellow: 0 });
  const [soulBombReady, setSoulBombReady] = useState<Record<ColorId, boolean>>({ red: false, blue: false, yellow: false });
  const [activeSoulBomb, setActiveSoulBomb] = useState<ColorId | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationFrame = useRef(0);

  // 寻找形状的随机有效位置
  const findValidPosition = (shape: (ColorId | null)[][], currentBoard: (Cell | null)[][]): { x: number; y: number } | null => {
    const possiblePositions: { x: number; y: number }[] = [];
    for (let y = 0; y <= BOARD_SIZE - shape.length; y++) {
      for (let x = 0; x <= BOARD_SIZE - shape[0].length; x++) {
        if (canPlaceAt(shape, x, y, currentBoard)) {
          possiblePositions.push({ x, y });
        }
      }
    }

    if (possiblePositions.length === 0) return null;
    return possiblePositions[Math.floor(Math.random() * possiblePositions.length)];
  };

  // 生成随机方块（严格检查不能有任何重叠）
  const generatePiece = (currentBoard: (Cell | null)[][] = board): Piece | null => {
    const shapes = Object.keys(TETROMINOS) as TetrominoType[];
    const randomShape = shapes[Math.floor(Math.random() * shapes.length)];
    const shape = TETROMINOS[randomShape];
    // 每个格子随机颜色
    const coloredShape: (ColorId | null)[][] = shape.map((row: number[]) =>
      row.map((cell: number) => cell ? COLOR_IDS[Math.floor(Math.random() * COLORS.length)] : null)
    );

    const validPos = findValidPosition(coloredShape, currentBoard);

    // 如果没有可用位置，返回仅包含形状的对象（或者null，取决于逻辑）
    // 为了保持一致性，如果无法放置，我们仍然可以返回null
    if (!validPos) {
      return null;
    }

    return { shape: coloredShape, x: validPos.x, y: validPos.y };
  };

  // 检查是否可以放置
  const canPlaceAt = (shape: (ColorId | null)[][], boardX: number, boardY: number, currentBoard: (Cell | null)[][]): boolean => {
    for (let y = 0; y < shape.length; y++) {
      for (let x = 0; x < shape[y].length; x++) {
        if (shape[y][x]) {
          const newY = boardY + y;
          const newX = boardX + x;
          if (newX < 0 || newX >= BOARD_SIZE || newY < 0 || newY >= BOARD_SIZE) return false;
          if (currentBoard[newY][newX]) return false;
        }
      }
    }
    return true;
  };

  // 初始化游戏 (由于有了 isWaitingToStart，初始化已由 startGame 负责)
  useEffect(() => {
    // 保持为空，由第一个 handleStart 触发 startGame
  }, []);

  // 倒计时
  useEffect(() => {
    if (gameOver || !currentPiece) return;

    const timer = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          fixCurrentPiece();
          return TIME_LIMIT;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [currentPiece, gameOver]);

  // 自动更新最高分
  useEffect(() => {
    if (score > highScore) {
      setHighScore(score);
      localStorage.setItem('gomoku_high_score', score.toString());
    }
  }, [score, highScore]);

  // 固定指定方块（用于自动触发）
  const fixPieceOnBoard = (pieceToFix: Piece) => {
    const newBoard = board.map(row => [...row]);
    const pieceId = pieceIdCounter.current++;

    for (let y = 0; y < pieceToFix.shape.length; y++) {
      for (let x = 0; x < pieceToFix.shape[y].length; x++) {
        const color = pieceToFix.shape[y][x];
        if (color) {
          newBoard[pieceToFix.y + y][pieceToFix.x + x] = { color, pieceId };
        }
      }
    }
    processPlacement(newBoard);
  };

  // 检查如果放置该方块是否会触发任何消除
  const wouldTriggerElimination = (pieceToCheck: Piece) => {
    const tempBoard = board.map(row => [...row]);
    // 模拟放置
    for (let y = 0; y < pieceToCheck.shape.length; y++) {
      for (let x = 0; x < pieceToCheck.shape[y].length; x++) {
        if (pieceToCheck.shape[y][x]) {
          const ny = pieceToCheck.y + y;
          const nx = pieceToCheck.x + x;
          if (ny >= 0 && ny < BOARD_SIZE && nx >= 0 && nx < BOARD_SIZE) {
            tempBoard[ny][nx] = { color: pieceToCheck.shape[y][x]!, pieceId: -1 }; // 临时 ID
          }
        }
      }
    }
    return checkLines(tempBoard).cleared || checkGomoku(tempBoard).cleared;
  };

  // 固定当前方块（手动按钮或倒计时结束调用）
  const fixCurrentPiece = () => {
    if (!currentPiece) return;
    fixPieceOnBoard(currentPiece);
  };

  // 处理方块放置（放置瞬间调用）
  const processPlacement = async (newBoard: (Cell | null)[][]): Promise<void> => {
    setIsSettling(true);
    const clearedBoard = await processClear(newBoard);
    setBoard(clearedBoard);
    setIsSettling(false);

    // 必须为 nextPiece 重新寻找有效位置，因为棋盘已经改变
    // 之前的 nextPiece.x/y 是基于旧棋盘计算 of nextPiece.x/y 是基于旧棋盘计算的，可能现在已经无效
    if (nextPiece) {
      const validPos = findValidPosition(nextPiece.shape, clearedBoard);

      if (!validPos) {
        // 如果无法为当前形状找到位置，游戏结束
        setGameOver(true);
        setCurrentPiece(null);
        setNextPiece(null);
        return;
      }

      // 更新 currentPiece 为 nextPiece 的形状，但使用新的有效位置
      setCurrentPiece({ ...nextPiece, x: validPos.x, y: validPos.y });

      // 生成新的 nextPiece
      const nextNewPiece = generatePiece(clearedBoard);

      // 如果无法生成下一个方块，通常不意味着立即结束游戏，
      // 而是意味着当前方块之后就没有新方块了（或者可以视作游戏结束的预兆）
      // 这里简便起见，如果生成失败，就设为null，稍后处理或再次尝试
      if (!nextNewPiece) {
        // 极端情况：棋盘极满，当前方块能放，但下一个完全没地方放
        setNextPiece(null);
      } else {
        setNextPiece(nextNewPiece);
      }

      setTimeLeft(TIME_LIMIT);
    } else {
      // 理论上不应该进入这里（除非初始化失败），重新尝试初始化
      const newPiece = generatePiece(clearedBoard);
      if (newPiece) {
        setCurrentPiece(newPiece);
        setNextPiece(generatePiece(clearedBoard));
        setTimeLeft(TIME_LIMIT);
      } else {
        setGameOver(true);
      }
    }
  };

  // 旋转方块：绕方阵中心顺时针旋转 90 度
  const rotatePiece = (piece: { shape: (string | null)[][], x: number, y: number }) => {
    const shape = piece.shape;
    const n = shape.length;
    // 创建新方阵
    const newShape = Array(n).fill(null).map(() => Array(n).fill(null));

    for (let y = 0; y < n; y++) {
      for (let x = 0; x < n; x++) {
        // 顺时针旋转坐标转换: (y, x) -> (x, n - 1 - y)
        newShape[x][n - 1 - y] = shape[y][x];
      }
    }

    return { ...piece, shape: newShape };
  };

  // 检查五子连珠 (Gomoku - 得分机制)
  const checkGomoku = (currentBoard: (Cell | null)[][]) => {
    let cleared = false;
    let clearCount = 0;
    const toRemove = new Set<string>();

    const directions = [
      { dy: 0, dx: 1 },  // 水平
      { dy: 1, dx: 0 },  // 垂直
      { dy: 1, dx: 1 },  // 对角线 \
      { dy: 1, dx: -1 }  // 对角线 /
    ];

    const matchedColors = new Set<string>();
    for (let y = 0; y < BOARD_SIZE; y++) {
      for (let x = 0; x < BOARD_SIZE; x++) {
        const cell = currentBoard[y][x];
        if (!cell) continue;
        const color = cell.color;

        for (const { dy, dx } of directions) {
          const line: [number, number][] = [[y, x]];
          for (let i = 1; i < 5; i++) {
            const ny = y + dy * i;
            const nx = x + dx * i;
            if (ny < 0 || ny >= BOARD_SIZE || nx < 0 || nx >= BOARD_SIZE) break;
            const nextCell = currentBoard[ny][nx];
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

    return { cleared, count: clearCount, eliminating: toRemove, matchedColors: Array.from(matchedColors) };
  };

  // 检查行/列消除 (多级消除判定)
  const checkLines = (currentBoard: (Cell | null)[][]) => {
    let cleared = false;
    let clearCount = 0;
    const allEliminating = new Set<string>();
    const perfectEliminating = new Set<string>(); // 存储 Perfect Clear 的格子
    const perfectLines: { type: 'row' | 'col', index: number }[] = [];

    // 1. 标准行消除 (生存机制)：只要满10格，不论颜色
    for (let y = 0; y < BOARD_SIZE; y++) {
      const row = currentBoard[y];
      if (row.every(cell => cell !== null)) {
        // 检查是否是 Perfect Row (同色满行)
        const firstColor = row[0]?.color;
        const isPerfect = row.every(cell => cell?.color === firstColor);

        cleared = true;
        clearCount += isPerfect ? 3 : 1; // Perfect 权重更高
        for (let x = 0; x < BOARD_SIZE; x++) {
          allEliminating.add(`${y},${x}`);
          if (isPerfect) perfectEliminating.add(`${y},${x}`);
        }
        if (isPerfect) perfectLines.push({ type: 'row', index: y });
      }
    }

    // 2. 完美列消除 (高阶奖励)：只有满 10 格且同色才消除
    for (let x = 0; x < BOARD_SIZE; x++) {
      const col = Array.from({ length: BOARD_SIZE }, (_, y) => currentBoard[y][x]);
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

  // 执行色魂炸弹：清除全场指定颜色
  const executeSoulBomb = async (color: ColorId, currentBoard: (Cell | null)[][]): Promise<(Cell | null)[][]> => {
    // 1. 全场变暗 + 目标色块抖动蓄力 (大招前摇)
    setActiveSoulBomb(color);
    setIsShaking(true);
    await new Promise(r => setTimeout(r, 800));
    setIsShaking(false);
    setActiveSoulBomb(null);

    // 2. 找出所有该颜色的格子
    const toRemove = new Set<string>();
    for (let y = 0; y < BOARD_SIZE; y++) {
      for (let x = 0; x < BOARD_SIZE; x++) {
        if (currentBoard[y][x]?.color === color) {
          toRemove.add(`${y},${x}`);
        }
      }
    }

    // 3. 高亮 + 消除动画
    if (toRemove.size > 0) {
      setMatchingCells(toRemove);
      await new Promise(r => setTimeout(r, 500));
      setMatchingCells(new Set());

      setClearingCells(toRemove);
      await new Promise(r => setTimeout(r, 300));
      setClearingCells(new Set());
    }

    // 4. 数据层移除
    const nb = currentBoard.map(row => [...row]);
    toRemove.forEach(key => {
      const [y, x] = key.split(',').map(Number);
      nb[y][x] = null;
    });

    // 5. 应用重力
    let fellThisPass = true;
    while (fellThisPass) {
      fellThisPass = false;
      for (let y = BOARD_SIZE - 2; y >= 0; y--) {
        for (let x = 0; x < BOARD_SIZE; x++) {
          if (nb[y][x] && nb[y + 1][x] === null) {
            nb[y + 1][x] = nb[y][x];
            nb[y][x] = null;
            fellThisPass = true;
          }
        }
      }
    }

    // 重置对应的计数器
    setSoulCounters(prev => ({ ...prev, [color]: 0 }));
    return nb;
  };

// 处理消除核心引擎
const processClear = async (initialBoard: (Cell | null)[][]): Promise<(Cell | null)[][]> => {
  let currentBoard = initialBoard;
  let totalScore = 0;

  // 用来在循环内同步判断色魂
  const currentSoulCounts: SoulCounters = { ...soulCounters };

  let continueProcessing = true;
  while (continueProcessing) {
    continueProcessing = false;
    const lineResult = checkLines(currentBoard);
    const gomokuResult = checkGomoku(currentBoard);

    const allEliminating = new Set([...lineResult.eliminating, ...gomokuResult.eliminating]);

    if (allEliminating.size > 0) {
      // 1. 处理 Gomoku 色魂累积（改为手动激活模式）
      if (gomokuResult.matchedColors.length > 0) {
        const newSoulBombReady = { ...soulBombReady };
        gomokuResult.matchedColors.forEach(c => {
          const color = c as ColorId;
          currentSoulCounts[color] = Math.min(3, currentSoulCounts[color] + 1);
          if (currentSoulCounts[color] >= 3) {
            newSoulBombReady[color] = true;
          }
        });
        setSoulCounters({ ...currentSoulCounts });
        setSoulBombReady(newSoulBombReady);
      }

      // 2. 动画阶段 1: 匹配高亮 (Highlight Phase) - 锁定 500ms
      setMatchingCells(allEliminating);
      setBoard(currentBoard);
      await new Promise(r => setTimeout(r, 500));
      setMatchingCells(new Set());

      // 3. 动画阶段 2: 消除炸裂 (Vanish Phase) - 锁定 300ms
      setClearingCells(allEliminating);

      // 计算得分 (在此刻计算，配合消除动画)
      totalScore += lineResult.count * 10 + gomokuResult.count * 30;

      // 数据层移除
      const nextBoard = currentBoard.map(row => [...row]);
      allEliminating.forEach(key => {
        const [y, x] = key.split(',').map(Number);
        nextBoard[y][x] = null;
      });

      // 渲染消除状态 (格子还在，但是处于炸裂动画中)
      // 注意：我们先不更新 setBoard 为 nextBoard，而是保持 currentBoard 但带有 clearingCells 标记
      // 这样 drawCell 依然能画出它们，并应用炸裂特效
      await new Promise(r => setTimeout(r, 300));

      setClearingCells(new Set());
      setBoard(nextBoard); // 动画结束，视觉上移除

      // 4. 动画阶段 3: 全局物理下落 (Gravity Phase)
      const newOffsets: Record<string, number> = {};
      let blocksShifted = false;
      let fellThisPass = true;

      while (fellThisPass) {
        fellThisPass = false;
        for (let y = BOARD_SIZE - 2; y >= 0; y--) {
          for (let x = 0; x < BOARD_SIZE; x++) {
            const cell = nextBoard[y][x];
            if (cell && nextBoard[y + 1][x] === null) {
              nextBoard[y + 1][x] = cell;
              nextBoard[y][x] = null;
              newOffsets[`${y + 1},${x}`] = (newOffsets[`${y},${x}`] || 0) + CELL_SIZE;
              delete newOffsets[`${y},${x}`];
              fellThisPass = true;
              blocksShifted = true;
            }
          }
        }
      }

      if (blocksShifted) {
        setBoard(nextBoard);
        setFallingOffsets(newOffsets);
        setFallingStartTime(Date.now());
        await new Promise(r => setTimeout(r, 400)); // 等待下落动画
        setFallingOffsets({});
        setFallingStartTime(0);
      }

      currentBoard = nextBoard;
      setBoard(currentBoard);
      continueProcessing = true;

      // 色魂炸弹现在改为手动激活，不再自动触发

      const comboCount = lineResult.count + gomokuResult.count;
      if (comboCount > 0) {
        setCombos(prev => [...prev, {
          x: BOARD_SIZE * CELL_SIZE / 2,
          y: BOARD_SIZE * CELL_SIZE / 2,
          id: Date.now()
        }]);
      }
    }
  }

  if (totalScore > 0) setScore(prev => prev + totalScore);
  return currentBoard;
};

// 鼠标/触摸事件处理
const handleStart = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement> | MouseEvent | TouchEvent) => {
  if (isSettling) return; // 动画结算中禁止操作
  // 防止移动端端双重触发 (点击和触摸)
  if (e.type.includes('touch')) {
    e.preventDefault();
  }

  if (gameOver) {
    resetGame();
    return;
  }
  if (isWaitingToStart) {
    startGame();
    return;
  }
  if (!currentPiece || justDropped) return;

  const canvas = canvasRef.current;
  if (!canvas) return;

  // 全局监听移动和抬起，确保拖出边界依然顺滑
  if (!e.type.includes('touch')) {
    window.addEventListener('mousemove', handleMove);
    window.addEventListener('mouseup', handleEnd);
  } else {
    window.addEventListener('touchmove', handleMove, { passive: false });
    window.addEventListener('touchend', handleEnd, { passive: false });
  }

  const rect = canvas.getBoundingClientRect();
  const scaleX = canvas.width / rect.width;
  const scaleY = canvas.height / rect.height;

  const clientX = 'touches' in e ? (e.touches[0]?.clientX || ('changedTouches' in e ? e.changedTouches?.[0]?.clientX : 0)) : e.clientX;
  const clientY = 'touches' in e ? (e.touches[0]?.clientY || ('changedTouches' in e ? e.changedTouches?.[0]?.clientY : 0)) : e.clientY;
  const x = (clientX - rect.left) * scaleX;
  const y = (clientY - rect.top) * scaleY;

  const boardX = Math.floor(x / CELL_SIZE);
  const boardY = Math.floor(y / CELL_SIZE);

  const isTouch = e.type.includes('touch');
  setIsTouchSession(isTouch);

  // 优化：移动端放宽判定区域（增加 2 格缓冲区），鼠标维持 1 格
  const n = currentPiece.shape.length;
  const padding = isTouch ? 2 : 1;
  const isInSafeZone = (
    boardX >= currentPiece.x - padding &&
    boardX < currentPiece.x + n + padding &&
    boardY >= currentPiece.y - padding &&
    boardY < currentPiece.y + n + padding
  );

  setDragging(true); // 开始记录交互状态
  setStartedOnPiece(isInSafeZone);
  setDragPos({ x, y });
  setDragStartPos({ x, y });
};

const handleMove = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement> | MouseEvent | TouchEvent) => {
  if (!dragging || !currentPiece || gameOver) return;

  e.preventDefault();

  const canvas = canvasRef.current;
  if (!canvas) return;
  const rect = canvas.getBoundingClientRect();
  // 核心优化：补偿 CSS 缩放引起的坐标偏移
  const scaleX = canvas.width / rect.width;
  const scaleY = canvas.height / rect.height;

  const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
  const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
  const x = (clientX - rect.left) * scaleX;
  const y = (clientY - rect.top) * scaleY;

  const isTouch = e.type.includes('touch');
  setDragPos({ x, y });

  // 只有点在色块上开始的拖拽才更新预览和位置
  if (startedOnPiece) {
    // 优化：计算色块矩阵中实际占用的边界 (用于精确中心对齐)
    let minX = currentPiece.shape[0].length, maxX = 0;
    let minY = currentPiece.shape.length, maxY = 0;
    currentPiece.shape.forEach((row, ry) => {
      row.forEach((cell, rx) => {
        if (cell) {
          minX = Math.min(minX, rx);
          maxX = Math.max(maxX, rx);
          minY = Math.min(minY, ry);
          maxY = Math.max(maxY, ry);
        }
      });
    });

    const actualWidth = maxX - minX + 1;
    const actualHeight = maxY - minY + 1;

    // 动态偏移补偿：手指下方显示位移，靠近边缘稍微收缩以防遮挡
    const normY = y / canvas.height;

    // 基础偏移：触摸模式偏移 1.5 格，鼠标模式居中
    const baseOffsetBase = isTouch ? -(CELL_SIZE * 1.5) : 0;

    // 边缘贴合：越靠近顶部，偏移越小 (变得更贴合手指)
    const edgeCompressionY = normY < 0.2 ? (0.6 + (normY / 0.2) * 0.4) : 1.0;
    const dynamicOffsetY = baseOffsetBase * edgeCompressionY;

    // 让色块的“形状中心”跟随指尖 (rawX/rawY 为网格左上角的像素逻辑位置)
    const rawX = x - (minX + actualWidth / 2) * CELL_SIZE;
    const rawY = y + dynamicOffsetY - (minY + actualHeight / 2) * CELL_SIZE;

    // 逻辑落点位置：使用稳定四舍五入，消除漂移感
    const boardX = Math.round(rawX / CELL_SIZE);
    const boardY = Math.round(rawY / CELL_SIZE);

    // 验证位置：检查该 Piece 占据的每一个格是否完整进入 10x10
    let allInside = true;
    currentPiece.shape.forEach((row, ry) => {
      row.forEach((cell, rx) => {
        if (cell) {
          const tx = boardX + rx;
          const ty = boardY + ry;
          if (tx < 0 || tx >= BOARD_SIZE || ty < 0 || ty >= BOARD_SIZE) allInside = false;
        }
      });
    });

    const canPlace = allInside && canPlaceAt(currentPiece.shape, boardX, boardY, board);
    setPreviewPos({ x: boardX, y: boardY, valid: canPlace });
  }
};

const handleEnd = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement> | MouseEvent | TouchEvent) => {
  if (!dragging || !currentPiece || gameOver || justDropped) return;

  // 防止移动端双重触发
  if (e.type.includes('touch')) {
    e.preventDefault();
  }

  const canvas = canvasRef.current;
  if (!canvas) return;
  const rect = canvas.getBoundingClientRect();
  const scaleX = canvas.width / rect.width;
  const scaleY = canvas.height / rect.height;

  const clientX = 'changedTouches' in e ? (e.changedTouches?.[0]?.clientX || (dragPos.x / scaleX + rect.left)) : e.clientX;
  const clientY = 'changedTouches' in e ? (e.changedTouches?.[0]?.clientY || (dragPos.y / scaleY + rect.top)) : e.clientY;
  const x = (clientX - rect.left) * scaleX;
  const y = (clientY - rect.top) * scaleY;

  // 检查是否是点击（移动距离小于阈值，移动端放宽到 15px）
  if (!dragStartPos) return;
  const deltaX = Math.abs(x - dragStartPos.x);
  const deltaY = Math.abs(y - dragStartPos.y);
  const clickLimit = e.type.includes('touch') ? 15 : 8;
  const isClick = deltaX < clickLimit && deltaY < clickLimit;

  if (isClick && !justDropped) {
    if (startedOnPiece) {
      // 1. 点按活跃色块 -> 触发旋转
      const rotated = rotatePiece(currentPiece);

      // 旋转时也应用边界检查和 Wall Kick
      const n = rotated.shape.length;
      const bestX = Math.max(0, Math.min(BOARD_SIZE - n, rotated.x));
      const bestY = Math.max(0, Math.min(BOARD_SIZE - n, rotated.y));
      const baseRotated = { ...rotated, x: bestX, y: bestY };

      if (canPlaceAt(baseRotated.shape, baseRotated.x, baseRotated.y, board)) {
        if (wouldTriggerElimination(baseRotated)) {
          fixPieceOnBoard(baseRotated);
        } else {
          setCurrentPiece(baseRotated);
        }
      } else {
        // Wall Kick
        let adjusted = false;
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            const tx = Math.max(0, Math.min(BOARD_SIZE - n, baseRotated.x + dx));
            const ty = Math.max(0, Math.min(BOARD_SIZE - n, baseRotated.y + dy));
            if (canPlaceAt(baseRotated.shape, tx, ty, board)) {
              const movedRotated = { ...baseRotated, x: tx, y: ty };
              if (wouldTriggerElimination(movedRotated)) {
                fixPieceOnBoard(movedRotated);
              } else {
                setCurrentPiece(movedRotated);
              }
              adjusted = true;
              break;
            }
          }
          if (adjusted) break;
        }
      }
    } else {
      fixCurrentPiece();
    }
  } else if (startedOnPiece && previewPos && previewPos.valid) {
    // 3. 长按/拖拽活跃色块落点有效
    const newPiecePos = { ...currentPiece, x: previewPos.x, y: previewPos.y };
    // 如果放下即促成了连线，直接固定消失，不用等确认
    if (wouldTriggerElimination(newPiecePos)) {
      fixPieceOnBoard(newPiecePos);
    } else {
      setCurrentPiece(newPiecePos);
      setJustDropped(true);
      setTimeout(() => setJustDropped(false), 200);
    }
  }

  // 重置所有交互状态
  setDragging(false);
  setStartedOnPiece(false);
  setPreviewPos(null);
  setDragStartPos(null);

  // 移除全局监听
  window.removeEventListener('mousemove', handleMove);
  window.removeEventListener('mouseup', handleEnd);
  window.removeEventListener('touchmove', handleMove);
  window.removeEventListener('touchend', handleEnd);
};

// 绘制单个方块
const drawCell = (ctx: CanvasRenderingContext2D, x: number, y: number, cellData: Cell | string, alpha = 1, isMuted = false, isPixel = false) => {
  const colorId = typeof cellData === 'string' ? cellData : cellData.color;
  let color;
  if (colorId === 'red') color = '#FF3B3F';
  else if (colorId === 'blue') color = '#4A90E2';
  else if (colorId === 'yellow') color = '#FFD700';
  else return;

  // 视觉弱化非活跃块 (稍微降低透明度，但不改变颜色饱和度)
  if (isMuted) {
    alpha *= 0.85;
  }

  let drawX = isPixel ? x : x * CELL_SIZE;
  let drawY = isPixel ? y : y * CELL_SIZE;
  let size = CELL_SIZE;

  // Phase 1: 匹配高亮 (Matching) - 闪烁白光确认
  if (!isPixel && matchingCells.has(`${y},${x}`)) {
    const time = Date.now();
    const flash = Math.abs(Math.sin(time / 100)); // 快速白色闪烁
    ctx.globalAlpha = 1;

    // 绘制底层颜色
    ctx.fillStyle = color;
    ctx.fillRect(drawX + 2, drawY + 2, size - 4, size - 4);

    // 叠加高亮层
    ctx.fillStyle = `rgba(255, 255, 255, ${0.4 + flash * 0.4})`;
    ctx.fillRect(drawX + 2, drawY + 2, size - 4, size - 4);

    // 边框高亮
    ctx.strokeStyle = '#FFFFFF';
    ctx.lineWidth = 3;
    ctx.strokeRect(drawX + 2, drawY + 2, size - 4, size - 4);
    return; // 匹配阶段无需后续绘制
  }

  // Phase 2: 消除动画 (Clearing) - 爆炸/缩小
  if (!isPixel && clearingCells.has(`${y},${x}`)) {
    // 爆炸特效：缩放感
    const scale = 1 - (Date.now() % 500) / 500; // 持续缩小直到消失

    alpha = Math.min(alpha, scale);
    size *= Math.max(0, scale);

    // 保持中心对齐
    drawX += (CELL_SIZE - size) / 2;
    drawY += (CELL_SIZE - size) / 2;
  }

  if (!isPixel && fallingStartTime > 0 && fallingOffsets[`${y},${x}`]) {
    // 时间驱动的丝滑下落模拟
    const elapsed = Date.now() - fallingStartTime;
    const progress = Math.min(1, elapsed / 400); // 400ms 动画
    // 从落差点 (fallingOffsets) 滑动到 0
    drawY -= fallingOffsets[`${y},${x}`] * (1 - progress);
  }

  ctx.globalAlpha = alpha;
  ctx.fillStyle = color;
  ctx.fillRect(drawX + 2, drawY + 2, size - 4, size - 4);

  // 添加高光效果
  const highlight = ctx.createRadialGradient(
    drawX + size * 0.3,
    drawY + size * 0.3,
    0,
    drawX + size * 0.5,
    drawY + size * 0.5,
    size * 0.7
  );
  highlight.addColorStop(0, 'rgba(255,255,255,0.4)');
  highlight.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = highlight;
  ctx.fillRect(drawX + 2, drawY + 2, size - 4, size - 4);

  ctx.globalAlpha = 1;

  // 活跃色块外边框加强
  if (!isMuted) {
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 3;
    ctx.strokeRect(drawX + 2, drawY + 2, size - 4, size - 4);

    // 额外的外层发光
    ctx.shadowBlur = 15;
    ctx.shadowColor = 'rgba(255,255,255,0.7)';
    ctx.strokeRect(drawX + 1, drawY + 1, size - 2, size - 2);
    ctx.shadowBlur = 0;
  } else {
    ctx.strokeStyle = 'rgba(255,255,255,0.4)';
    ctx.lineWidth = 1;
    ctx.strokeRect(drawX + 2, drawY + 2, size - 4, size - 4);
  }
};

// 绘制游戏
useEffect(() => {
  const canvas = canvasRef.current;
  if (!canvas) return;

  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const draw = () => {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // 绘制网格
    ctx.strokeStyle = '#e0e0e0';
    ctx.lineWidth = 1;
    for (let i = 0; i <= BOARD_SIZE; i++) {
      ctx.beginPath();
      ctx.moveTo(i * CELL_SIZE, 0);
      ctx.lineTo(i * CELL_SIZE, BOARD_SIZE * CELL_SIZE);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(0, i * CELL_SIZE);
      ctx.lineTo(BOARD_SIZE * CELL_SIZE, i * CELL_SIZE);
      ctx.stroke();
    }

    // 绘制固定的方块
    board.forEach((row, y) => {
      row.forEach((cell, x) => {
        if (cell) {
          drawCell(ctx, x, y, cell, 1, true);
        }
      });
    });

    // 绘制预览位置
    if (dragging && previewPos && currentPiece) {
      currentPiece.shape.forEach((row, dy) => {
        row.forEach((cell, dx) => {
          if (cell) {
            const px = previewPos.x + dx;
            const py = previewPos.y + dy;
            // 移除原有的边界裁剪 if，允许方块视觉上“拖出去”
            drawCell(ctx, px, py, cell, 0.25, false, false);

            // 如果位置无效，叠加一层红色滤镜
            if (!previewPos.valid) {
              ctx.fillStyle = 'rgba(255,0,0,0.2)';
              ctx.fillRect(px * CELL_SIZE + 2, py * CELL_SIZE + 2, CELL_SIZE - 4, CELL_SIZE - 4);
            }
          }
        });
      });
    }

    // 绘制当前方块 (当没有在拖拽该方块时显示)
    if (currentPiece && (!dragging || !startedOnPiece)) {
      const pulse = Math.sin(Date.now() / 200) * 0.3 + 0.7;

      ctx.save();
      currentPiece.shape.forEach((row, y) => {
        row.forEach((cell, x) => {
          if (cell) {
            const posX = currentPiece.x + x;
            const posY = currentPiece.y + y;

            ctx.shadowBlur = 20 * pulse;
            ctx.shadowColor = cell === 'red' ? '#FF3B3F' : cell === 'blue' ? '#4A90E2' : '#FFD700';
            drawCell(ctx, posX, posY, cell);
          }
        });
      });

      ctx.restore();
    }

    // 绘制拖拽中的方块
    if (dragging && startedOnPiece && currentPiece) {
      ctx.save();
      // 中心对齐
      const offsetX = dragPos.x - (currentPiece.shape[0].length * CELL_SIZE) / 2;
      // 移动端向上偏移，防止手指打架
      const baseOffsetY = isTouchSession ? -(CELL_SIZE * 1.5) : -(currentPiece.shape.length * CELL_SIZE) / 2;
      const offsetY = dragPos.y + baseOffsetY;

      currentPiece.shape.forEach((row, dy) => {
        row.forEach((cell, dx) => {
          if (cell) {
            const px = offsetX + dx * CELL_SIZE;
            const py = offsetY + dy * CELL_SIZE;
            drawCell(ctx, px, py, cell, 0.95, false, true);
          }
        });
      });

      ctx.restore();
    }

    animationFrame.current = requestAnimationFrame(draw);
  };

  draw();

  return () => {
    if (animationFrame.current) {
      cancelAnimationFrame(animationFrame.current);
    }
  };
}, [board, currentPiece, dragging, dragPos, previewPos, clearingCells, matchingCells, fallingOffsets, fallingStartTime]);

useEffect(() => {
  if (combos.length > 0) {
    const timer = setTimeout(() => {
      setCombos(prev => prev.slice(1));
    }, 1000);
    return () => clearTimeout(timer);
  }
}, [combos]);

const resetGame = () => {
  const emptyBoard = Array(BOARD_SIZE).fill(null).map(() => Array(BOARD_SIZE).fill(null));
  setBoard(emptyBoard);
  setScore(0);
  const first = generatePiece(emptyBoard);
  const second = generatePiece(emptyBoard);
  setCurrentPiece(first);
  setNextPiece(second);
  setTimeLeft(TIME_LIMIT);
  setGameOver(false);
  setIsWaitingToStart(false);
  setDragging(false);
  setStartedOnPiece(false);
  setPreviewPos(null);
  setDragStartPos(null);
  setJustDropped(false);
  setCombos([]);
  setSoulCounters({ red: 0, blue: 0, yellow: 0 });
  setSoulBombReady({ red: false, blue: false, yellow: false });
};

const startGame = () => {
  const first = generatePiece();
  const second = generatePiece();
  setCurrentPiece(first);
  setNextPiece(second);
  setTimeLeft(TIME_LIMIT);
  setIsWaitingToStart(false);
};

// 手动激活色魂炸弹
const handleSoulBombActivate = async (color: ColorId) => {
  if (!soulBombReady[color] || isSettling) return;

  setIsSettling(true);
  const newBoard = await executeSoulBomb(color, board);

  // 重置该颜色的状态
  setSoulBombReady(prev => ({ ...prev, [color]: false }));
  setSoulCounters(prev => ({ ...prev, [color]: 0 }));

  // 继续处理可能的连锁反应
  const clearedBoard = await processClear(newBoard);
  setBoard(clearedBoard);
  setIsSettling(false);
};

return (
  <div className="flex flex-col items-center justify-center min-h-screen bg-[#F0F2F5] p-2 sm:p-4 font-sans text-[#1A1A1A]">
    {/* 游戏主容器：桌面端横向，移动端纵向 */}
    <div className={`flex flex-col lg:flex-row gap-4 lg:gap-8 items-stretch lg:items-start max-w-full transform transition-transform duration-100 ${isShaking ? 'animate-bounce' : ''}`}>

      {/* 左/中：侧边信息栏 (移动端放上面) */}
      <div className="flex flex-row lg:flex-col gap-3 w-full lg:w-48 overflow-x-auto lg:overflow-visible pb-2 lg:pb-0">
        <div className="flex-1 bg-white p-3 lg:p-4 rounded-xl shadow-sm border border-gray-100 min-w-[100px]">
          <h3 className="text-xs lg:text-sm font-semibold text-gray-500 mb-1 uppercase tracking-wider text-center lg:text-left">得分</h3>
          <p className="text-2xl lg:text-3xl font-black text-indigo-600 text-center lg:text-left">{score}</p>
        </div>

        <div className="flex-1 bg-white p-3 lg:p-4 rounded-xl shadow-sm border border-gray-100 min-w-[100px]">
          <h3 className="text-xs lg:text-sm font-semibold text-gray-500 mb-1 uppercase tracking-wider text-center lg:text-left">最高分</h3>
          <p className="text-2xl lg:text-3xl font-black text-amber-500 text-center lg:text-left">{highScore}</p>
        </div>

        {/* 色魂插槽 */}
        <div className={`flex flex-col gap-2 p-3 bg-white rounded-2xl shadow-sm border border-gray-100 min-w-[120px] transition-all duration-300 ${activeSoulBomb ? 'ring-2 ring-offset-2 ring-opacity-50' : ''} ${activeSoulBomb === 'red' ? 'ring-[#FF3B3F]' : activeSoulBomb === 'blue' ? 'ring-[#4A90E2]' : activeSoulBomb === 'yellow' ? 'ring-[#FFD700]' : ''}`}>
          <div className="text-[10px] font-bold text-gray-400 mb-1">COLOR SOULS</div>
          {(['red', 'blue', 'yellow'] as const).map(color => (
            <div key={color} className="flex items-center gap-2">
              <div className={`w-2.5 h-2.5 rounded-full ${color === 'red' ? 'bg-[#FF3B3F]' : color === 'blue' ? 'bg-[#4A90E2]' : 'bg-[#FFD700]'} ${soulBombReady[color] ? 'animate-pulse' : ''}`} />
              <div className="flex-1 h-1 bg-gray-100 rounded-full overflow-hidden">
                <div className={`h-full transition-all duration-500 ${color === 'red' ? 'bg-[#FF3B3F]' : color === 'blue' ? 'bg-[#4A90E2]' : 'bg-[#FFD700]'}`} style={{ width: `${(soulCounters[color] / 3) * 100}%` }} />
              </div>
              {soulBombReady[color] ? (
                <button
                  onClick={() => handleSoulBombActivate(color)}
                  className={`text-[8px] font-bold px-1.5 py-0.5 rounded text-white animate-pulse ${color === 'red' ? 'bg-[#FF3B3F]' : color === 'blue' ? 'bg-[#4A90E2]' : 'bg-[#FFD700]'}`}
                >
                  GO!
                </button>
              ) : (
                <div className="text-[9px] font-bold text-gray-500">{soulCounters[color]}/3</div>
              )}
            </div>
          ))}
        </div>

        <div className="flex-1 bg-white p-3 lg:p-4 rounded-xl shadow-sm border border-gray-100 min-w-[100px] flex flex-col items-center justify-center">
          <div className="flex items-center gap-1 mb-1">
            <Clock size={14} className="text-rose-500" />
            <h3 className="text-xs lg:text-sm font-semibold text-gray-500 uppercase tracking-wider">计时</h3>
          </div>
          <p className={`text-2xl lg:text-3xl font-black ${timeLeft <= 3 ? 'text-rose-600 animate-pulse' : 'text-gray-700'}`}>
            {timeLeft}s
          </p>
        </div>
      </div>

      {/* 核心：棋盘区 */}
      <div className="flex flex-col items-center">
        <div className="bg-white p-2 lg:p-4 rounded-2xl shadow-xl border-4 border-white mb-4">
          <h1 className="text-2xl lg:text-4xl font-black text-center mb-2 lg:mb-4 tracking-tighter text-gray-800 italic">
            俄罗斯消消乐
          </h1>

          <div className="relative">
            <canvas
              ref={canvasRef}
              width={BOARD_SIZE * CELL_SIZE}
              height={BOARD_SIZE * CELL_SIZE}
              className="rounded-lg shadow-inner bg-gray-50 max-w-[90vw] h-auto"
              style={{ touchAction: 'none', cursor: dragging ? 'grabbing' : 'grab' }}
              onMouseDown={handleStart}
              onMouseMove={handleMove}
              onMouseUp={handleEnd}
              onMouseLeave={handleEnd}
              onTouchStart={handleStart}
              onTouchMove={handleMove}
              onTouchEnd={handleEnd}
            />

            {combos.map(combo => (
              <div
                key={combo.id}
                className="absolute pointer-events-none"
                style={{
                  left: combo.x - 24,
                  top: combo.y - 24,
                  animation: 'ping 1s cubic-bezier(0, 0, 0.2, 1)'
                }}
              >
                <Sparkles className="text-yellow-400 w-12 h-12" />
              </div>
            ))}

            {gameOver && (
              <div
                className="absolute inset-0 bg-gray-900/80 backdrop-blur-sm flex items-center justify-center rounded-lg z-10 cursor-pointer"
                onClick={resetGame}
              >
                <div className="text-center p-8 bg-white rounded-2xl shadow-2xl scale-110" onClick={e => e.stopPropagation()}>
                  <h2 className="text-3xl font-black mb-2 text-gray-800 uppercase italic">游戏结束</h2>
                  <p className="text-lg text-gray-500 mb-6">本次得分: <span className="font-bold text-indigo-600">{score}</span></p>
                  <button
                    onClick={resetGame}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white px-8 py-3 rounded-full font-bold shadow-lg transform hover:scale-105 active:scale-95 transition-all w-full"
                  >
                    重新开始
                  </button>
                </div>
              </div>
            )}

            {isWaitingToStart && (
              <div
                className="absolute inset-0 flex items-center justify-center z-10 cursor-pointer group"
                onClick={startGame}
              >
                <div className="bg-white/90 backdrop-blur px-6 py-3 rounded-full shadow-xl border border-indigo-100 transform group-hover:scale-110 transition-all duration-300">
                  <p className="text-indigo-600 font-black text-xl flex items-center gap-2">
                    <Sparkles className="w-5 h-5 animate-pulse" />
                    点击开始新回合
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* 移动端底 部按钮 */}
        <button
          onClick={resetGame}
          className="lg:hidden w-full bg-indigo-600 text-white py-3 rounded-xl font-bold shadow-md active:bg-indigo-700 mb-4"
        >
          重开一局
        </button>
      </div>

      {/* 右侧：辅助栏 (PC可见) */}
      <div className="hidden lg:flex flex-col gap-4 w-56">
        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 text-center">
          <h3 className="font-bold text-gray-500 mb-3 uppercase tracking-widest text-xs">下一个</h3>
          {nextPiece && (
            <div className="inline-block p-2 rounded-lg bg-gray-50 border border-gray-100">
              {nextPiece.shape.map((row, y) => (
                <div key={y} className="flex">
                  {row.map((cell, x) => {
                    let bgColor = 'transparent';
                    if (cell === 'red') bgColor = '#FF3B3F';
                    else if (cell === 'blue') bgColor = '#4A90E2';
                    else if (cell === 'yellow') bgColor = '#FFD700';

                    return (
                      <div
                        key={x}
                        className={`w-6 h-6 m-0.5 rounded-sm ${cell ? 'shadow-sm border border-white/20' : ''}`}
                        style={{ backgroundColor: bgColor }}
                      />
                    );
                  })}
                </div>
              ))}
            </div>
          )}
        </div>

        <button
          onClick={resetGame}
          className="w-full bg-white text-gray-700 py-4 rounded-xl font-bold shadow-sm border border-gray-200 hover:bg-gray-50 transition-colors"
        >
          重开一局
        </button>

        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex flex-col items-center">
          <h3 className="font-bold text-gray-500 mb-4 uppercase tracking-widest text-xs text-center">手机扫码玩</h3>
          <div className="w-32 h-32 bg-gray-100 rounded-lg flex items-center justify-center border-2 border-dashed border-gray-200 relative overflow-hidden group">
            <div className="text-gray-300 text-[10px] text-center px-4">
              <div className="mb-1 uppercase">QR CODE</div>
              <div>[PLACEHOLDER]</div>
            </div>
            <div className="absolute inset-0 p-2 opacity-10">
              <div className="w-full h-full bg-[radial-gradient(#000_1px,transparent_1px)] [background-size:4px_4px]"></div>
            </div>
          </div>
          <p className="mt-3 text-[10px] text-gray-400 text-center leading-relaxed font-medium">
            随时随地<br />开启竞技挑战
          </p>
        </div>
      </div>

    </div>
  </div>
);
};

export default GomokuTetris;
