import { useState, useEffect, useRef, useCallback } from 'react';
import { Sparkles, Smartphone } from 'lucide-react';

// 类型和常量
import type { Cell, Piece, ColorId, GhostPosition, Combo, GameState, Particle } from './types';
import { BOARD_SIZE, CELL_SIZE, GAME_CONFIG, KEY_BINDINGS } from './constants';

// 逻辑模块
import {
  spawnPiece,
  canMoveDown,
  canMoveHorizontal,
  tryRotate,
  calculateGhostPosition
} from './logic/pieceGenerator';
import { checkLines, checkGomoku, checkCluster, applyGravity, removeCells, findCellsByColor } from './logic/clearing';

// 颜色映射
const COLOR_MAP: Record<ColorId, string> = {
  red: '#FF3B3F',
  blue: '#4A90E2',
  yellow: '#FFD700'
};

const GomokuTetris = () => {
  // ============ 核心游戏状态 ============
  const [board, setBoard] = useState<(Cell | null)[][]>(
    Array(BOARD_SIZE).fill(null).map(() => Array(BOARD_SIZE).fill(null))
  );
  const pieceIdCounter = useRef(1);
  const [score, setScore] = useState(0);
  const [highScore, setHighScore] = useState(() => {
    return parseInt(localStorage.getItem('gomoku_high_score') || '0');
  });
  const [currentPiece, setCurrentPiece] = useState<Piece | null>(null);
  const [nextPiece, setNextPiece] = useState<Piece | null>(null);
  const [ghostPosition, setGhostPosition] = useState<GhostPosition | null>(null);

  // ============ 游戏控制状态 ============
  const [gameState, setGameState] = useState<GameState>('idle');
  const [level, setLevel] = useState(1);
  const [linesCleared, setLinesCleared] = useState(0);
  const [dropInterval, setDropInterval] = useState(GAME_CONFIG.initialDropInterval);
  const [isSoftDropping, setIsSoftDropping] = useState(false);

  // ============ 动画和视觉状态 ============
  const [combos, setCombos] = useState<Combo[]>([]);
  const [clearingCells, setClearingCells] = useState<Set<string>>(new Set());
  const [matchingCells, setMatchingCells] = useState<Set<string>>(new Set());
  const [isSettling, setIsSettling] = useState(false);
  const [fallingOffsets, setFallingOffsets] = useState<Record<string, number>>({});
  const [fallingStartTime, setFallingStartTime] = useState(0);
  const [isShaking, setIsShaking] = useState(false);
  const [particles, setParticles] = useState<Particle[]>([]);
  const [isExploding, setIsExploding] = useState(false);  // 爆炸中暂停下落

  // ============ 色魂系统（统一累积） ============
  const [soulCounter, setSoulCounter] = useState(0);  // 统一计数器 0-3
  const [lastGomokuColor, setLastGomokuColor] = useState<ColorId | null>(null);  // 最后一次五子连珠颜色
  const [activeSoulBomb, setActiveSoulBomb] = useState<ColorId | null>(null);

  // ============ Refs ============
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationFrame = useRef(0);
  const dropTimerRef = useRef<number | null>(null);
  const lockTimerRef = useRef<number | null>(null);

  // ============ 游戏初始化 ============
  const startGame = useCallback(() => {
    const emptyBoard = Array(BOARD_SIZE).fill(null).map(() => Array(BOARD_SIZE).fill(null));
    setBoard(emptyBoard);
    setScore(0);
    setLevel(1);
    setLinesCleared(0);
    setDropInterval(GAME_CONFIG.initialDropInterval);
    setSoulCounter(0);
    setLastGomokuColor(null);

    const first = spawnPiece(emptyBoard);
    const second = spawnPiece(emptyBoard);
    setCurrentPiece(first);
    setNextPiece(second);
    setGameState('playing');
  }, []);

  const resetGame = useCallback(() => {
    if (lockTimerRef.current) clearTimeout(lockTimerRef.current);
    if (dropTimerRef.current) clearInterval(dropTimerRef.current);
    startGame();
  }, [startGame]);

  // ============ 更新最高分 ============
  useEffect(() => {
    if (score > highScore) {
      setHighScore(score);
      localStorage.setItem('gomoku_high_score', score.toString());
    }
  }, [score, highScore]);

  // ============ 难度递增 ============
  useEffect(() => {
    const newLevel = Math.floor(score / GAME_CONFIG.levelUpScore) + 1;
    if (newLevel !== level) {
      setLevel(newLevel);
      const newInterval = Math.max(
        GAME_CONFIG.minDropInterval,
        GAME_CONFIG.initialDropInterval - (newLevel - 1) * 50
      );
      setDropInterval(newInterval);
    }
  }, [score, level]);

  // ============ Ghost Position 计算 ============
  useEffect(() => {
    if (currentPiece && gameState === 'playing') {
      const ghost = calculateGhostPosition(currentPiece, board);
      setGhostPosition(ghost);
    } else {
      setGhostPosition(null);
    }
  }, [currentPiece, board, gameState]);

  // ============ 锁定方块 ============
  const lockPiece = useCallback(async () => {
    if (!currentPiece) return;

    const newBoard = board.map(row => [...row]);
    const pieceId = pieceIdCounter.current++;

    // 把活跃方块的每个格子放到棋盘上
    for (let y = 0; y < currentPiece.shape.length; y++) {
      for (let x = 0; x < currentPiece.shape[y].length; x++) {
        const color = currentPiece.shape[y][x];
        if (color) {
          const boardY = currentPiece.y + y;
          const boardX = currentPiece.x + x;
          if (boardY >= 0 && boardY < BOARD_SIZE && boardX >= 0 && boardX < BOARD_SIZE) {
            newBoard[boardY][boardX] = { color, pieceId };
          }
        }
      }
    }

    // 立即清空活跃方块，让棋盘上的格子接管显示
    setCurrentPiece(null);
    setBoard(newBoard);

    await processPlacement(newBoard);
  }, [currentPiece, board]);

  // ============ 处理方块放置和消除 ============
  const processPlacement = async (newBoard: (Cell | null)[][]): Promise<void> => {
    setIsSettling(true);
    const clearedBoard = await processClear(newBoard);
    setBoard(clearedBoard);
    setIsSettling(false);

    // 使用预览的 nextPiece 作为新的 currentPiece
    if (nextPiece) {
      // 检查 nextPiece 是否可以放置（可能因为消除后棋盘变化）
      const spawnX = Math.floor((BOARD_SIZE - nextPiece.shape[0].length) / 2);
      const canSpawn = nextPiece.shape.every((row, dy) =>
        row.every((cell, dx) => {
          if (!cell) return true;
          const y = dy;
          const x = spawnX + dx;
          return y >= 0 && y < BOARD_SIZE && x >= 0 && x < BOARD_SIZE && !clearedBoard[y]?.[x];
        })
      );

      if (!canSpawn) {
        setGameState('gameover');
        setCurrentPiece(null);
        setNextPiece(null);
        return;
      }

      // nextPiece 变成 currentPiece，生成新的 nextPiece
      setCurrentPiece({ ...nextPiece, x: spawnX, y: 0 });
      setNextPiece(spawnPiece(clearedBoard));
    } else {
      const newPiece = spawnPiece(clearedBoard);
      if (newPiece) {
        setCurrentPiece(newPiece);
        setNextPiece(spawnPiece(clearedBoard));
      } else {
        setGameState('gameover');
      }
    }
  };

  // ============ 创建粒子效果 ============
  const createParticles = useCallback((cells: Set<string>, color: ColorId, count: number = 8) => {
    const newParticles: Particle[] = [];
    const colorHex = COLOR_MAP[color];
    // 添加白色闪光粒子
    const colors = [colorHex, colorHex, colorHex, '#FFFFFF', '#FFFFFF'];

    cells.forEach(key => {
      const [y, x] = key.split(',').map(Number);
      const centerX = x * CELL_SIZE + CELL_SIZE / 2;
      const centerY = y * CELL_SIZE + CELL_SIZE / 2;

      for (let i = 0; i < count; i++) {
        const angle = (Math.PI * 2 * i) / count + (Math.random() - 0.5) * 0.8;
        const speed = 3 + Math.random() * 5;
        const particleColor = colors[Math.floor(Math.random() * colors.length)];

        newParticles.push({
          x: centerX + (Math.random() - 0.5) * CELL_SIZE * 0.5,
          y: centerY + (Math.random() - 0.5) * CELL_SIZE * 0.5,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed - 3, // 向上弹
          color: particleColor,
          size: 2 + Math.random() * 5,
          life: 1,
          maxLife: 1
        });
      }
    });

    setParticles(prev => [...prev, ...newParticles]);
  }, []);

  // ============ 执行色魂炸弹 ============
  const executeSoulBomb = async (color: ColorId, boardToProcess: (Cell | null)[][]): Promise<(Cell | null)[][]> => {
    // 暂停当前方块下落
    setIsExploding(true);
    const pieceToRestore = currentPiece;

    // 震动预警
    setActiveSoulBomb(color);
    setIsShaking(true);
    await new Promise(r => setTimeout(r, 500));
    setIsShaking(false);

    const toRemove = findCellsByColor(boardToProcess, color);

    if (toRemove.size > 0) {
      // ===== 阶段1: 高亮 =====
      setMatchingCells(toRemove);
      await new Promise(r => setTimeout(r, 400));

      // ===== 阶段2: 整体消失 =====
      createParticles(toRemove, color, 12);
      setMatchingCells(new Set());
      setClearingCells(toRemove);
      await new Promise(r => setTimeout(r, 280));

      // 消失完成
      setClearingCells(new Set());
    }

    setActiveSoulBomb(null);

    // 移除格子
    let newBoard = removeCells(boardToProcess, toRemove);
    setBoard(newBoard);

    // ===== 阶段3: 等待 =====
    await new Promise(r => setTimeout(r, 150));

    // ===== 阶段4: 重力下落 =====
    const gravityResult = applyGravity(newBoard);
    if (gravityResult.hasChanges) {
      setFallingOffsets(gravityResult.offsets);
      setFallingStartTime(Date.now());
      setBoard(gravityResult.board);
      await new Promise(r => setTimeout(r, 420));
      setFallingOffsets({});
      setFallingStartTime(0);
    }

    // 重置计数器
    setSoulCounter(0);
    setLastGomokuColor(null);

    // 恢复方块下落
    if (pieceToRestore) {
      setCurrentPiece(pieceToRestore);
    }
    setIsExploding(false);

    return gravityResult.board;
  };

  // ============ 消除处理核心引擎 ============
  const processClear = async (initialBoard: (Cell | null)[][]): Promise<(Cell | null)[][]> => {
    let currentBoard = initialBoard;
    let totalScore = 0;
    let totalLines = 0;
    let currentSoulCount = soulCounter;
    let currentLastColor = lastGomokuColor;

    let continueProcessing = true;
    while (continueProcessing) {
      continueProcessing = false;

      // 检查三种消除类型
      const lineResult = checkLines(currentBoard);
      const gomokuResult = checkGomoku(currentBoard);
      const clusterResult = checkCluster(currentBoard);

      // 合并所有消除
      const allEliminating = new Set([
        ...lineResult.eliminating,
        ...gomokuResult.eliminating,
        ...clusterResult.eliminating
      ]);

      // 合并所有触发色魂的颜色
      const allMatchedColors = [
        ...gomokuResult.matchedColors,
        ...clusterResult.matchedColors
      ];

      if (allEliminating.size > 0) {
        // 处理色魂累积（五子连珠或区域消除都触发）
        if (allMatchedColors.length > 0) {
          currentLastColor = allMatchedColors[allMatchedColors.length - 1];
          currentSoulCount = Math.min(3, currentSoulCount + 1);
          setSoulCounter(currentSoulCount);
          setLastGomokuColor(currentLastColor);
        }

        totalScore += lineResult.count * 10 + gomokuResult.count * 30 + clusterResult.count * 25;
        totalLines += lineResult.count;

        // ===== 阶段1: 高亮闪烁 =====
        setMatchingCells(allEliminating);
        setBoard(currentBoard);
        await new Promise(r => setTimeout(r, 350));

        // ===== 阶段2: 整体消失 =====
        // 创建粒子
        allEliminating.forEach(key => {
          const [y, x] = key.split(',').map(Number);
          const cell = currentBoard[y][x];
          if (cell) {
            createParticles(new Set([key]), cell.color, 10);
          }
        });

        setMatchingCells(new Set());
        setClearingCells(allEliminating);
        await new Promise(r => setTimeout(r, 280));

        // 消失完成，立即移除
        const nextBoard = removeCells(currentBoard, allEliminating);
        setClearingCells(new Set());
        setBoard(nextBoard);

        // ===== 阶段3: 等待消失完全结束 =====
        await new Promise(r => setTimeout(r, 150));

        // ===== 阶段4: 重力下落 =====
        const gravityResult = applyGravity(nextBoard);
        if (gravityResult.hasChanges) {
          setFallingOffsets(gravityResult.offsets);
          setFallingStartTime(Date.now());
          setBoard(gravityResult.board);
          await new Promise(r => setTimeout(r, 420));
          setFallingOffsets({});
          setFallingStartTime(0);
        }

        currentBoard = gravityResult.board;
        setBoard(currentBoard);

        // 稳定后检查连锁
        await new Promise(r => setTimeout(r, 100));
        continueProcessing = true;

        const comboCount = lineResult.count + gomokuResult.count + clusterResult.count;
        if (comboCount > 0) {
          setCombos(prev => [...prev, {
            x: BOARD_SIZE * CELL_SIZE / 2,
            y: BOARD_SIZE * CELL_SIZE / 2,
            id: Date.now()
          }]);
        }

        // 检查是否触发色魂炸弹（达到3次）
        if (currentSoulCount >= 3 && currentLastColor) {
          currentBoard = await executeSoulBomb(currentLastColor, currentBoard);
          currentSoulCount = 0;
          currentLastColor = null;
          continueProcessing = true;
        }
      }
    }

    if (totalScore > 0) setScore(prev => prev + totalScore);
    if (totalLines > 0) setLinesCleared(prev => prev + totalLines);
    return currentBoard;
  };

  // ============ 硬降 ============
  const hardDrop = useCallback(() => {
    if (!currentPiece || !ghostPosition || gameState !== 'playing' || isSettling) return;

    const dropDistance = ghostPosition.y - currentPiece.y;
    setScore(prev => prev + dropDistance * 2);

    const droppedPiece = { ...currentPiece, y: ghostPosition.y };

    // 清除定时器
    if (lockTimerRef.current) clearTimeout(lockTimerRef.current);
    if (dropTimerRef.current) clearInterval(dropTimerRef.current);

    // 立即放到棋盘上
    const newBoard = board.map(row => [...row]);
    const pieceId = pieceIdCounter.current++;

    for (let y = 0; y < droppedPiece.shape.length; y++) {
      for (let x = 0; x < droppedPiece.shape[y].length; x++) {
        const color = droppedPiece.shape[y][x];
        if (color) {
          const boardY = droppedPiece.y + y;
          const boardX = droppedPiece.x + x;
          if (boardY >= 0 && boardY < BOARD_SIZE && boardX >= 0 && boardX < BOARD_SIZE) {
            newBoard[boardY][boardX] = { color, pieceId };
          }
        }
      }
    }

    // 清空活跃方块，更新棋盘
    setCurrentPiece(null);
    setBoard(newBoard);

    // 处理消除
    processPlacement(newBoard);
  }, [currentPiece, ghostPosition, gameState, isSettling, board]);

  // ============ 自动下落循环 ============
  useEffect(() => {
    // 爆炸中暂停下落
    if (gameState !== 'playing' || !currentPiece || isSettling || isExploding) return;

    const interval = isSoftDropping
      ? dropInterval / GAME_CONFIG.softDropMultiplier
      : dropInterval;

    dropTimerRef.current = window.setInterval(() => {
      setCurrentPiece(prev => {
        if (!prev) return null;

        if (canMoveDown(prev, board)) {
          if (isSoftDropping) {
            setScore(s => s + 1);
          }
          return { ...prev, y: prev.y + 1 };
        } else {
          // 触底，开始锁定延迟
          if (!lockTimerRef.current) {
            lockTimerRef.current = window.setTimeout(() => {
              lockPiece();
              lockTimerRef.current = null;
            }, GAME_CONFIG.lockDelay);
          }
          return prev;
        }
      });
    }, interval);

    return () => {
      if (dropTimerRef.current) clearInterval(dropTimerRef.current);
    };
  }, [gameState, currentPiece, board, dropInterval, isSoftDropping, isSettling, isExploding, lockPiece]);

  // ============ 粒子动画更新 ============
  useEffect(() => {
    if (particles.length === 0) return;

    const interval = setInterval(() => {
      setParticles(prev => prev
        .map(p => ({
          ...p,
          x: p.x + p.vx,
          y: p.y + p.vy,
          vy: p.vy + 0.15, // 重力
          life: p.life - 0.025
        }))
        .filter(p => p.life > 0)
      );
    }, 16);

    return () => clearInterval(interval);
  }, [particles.length]);

  // ============ 键盘输入处理 ============
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (gameState === 'idle') {
        startGame();
        return;
      }

      if (gameState === 'gameover') {
        resetGame();
        return;
      }

      if (gameState !== 'playing' || !currentPiece || isSettling) return;

      const action = KEY_BINDINGS[e.code];
      if (!action) return;

      e.preventDefault();

      switch (action) {
        case 'move_left':
          if (canMoveHorizontal(currentPiece, -1, board)) {
            setCurrentPiece(prev => prev ? { ...prev, x: prev.x - 1 } : null);
            // 移动时重置锁定延迟
            if (lockTimerRef.current) {
              clearTimeout(lockTimerRef.current);
              lockTimerRef.current = null;
            }
          }
          break;

        case 'move_right':
          if (canMoveHorizontal(currentPiece, 1, board)) {
            setCurrentPiece(prev => prev ? { ...prev, x: prev.x + 1 } : null);
            if (lockTimerRef.current) {
              clearTimeout(lockTimerRef.current);
              lockTimerRef.current = null;
            }
          }
          break;

        case 'rotate':
          const rotated = tryRotate(currentPiece, board);
          if (rotated) {
            setCurrentPiece(rotated);
            if (lockTimerRef.current) {
              clearTimeout(lockTimerRef.current);
              lockTimerRef.current = null;
            }
          }
          break;

        case 'soft_drop':
          setIsSoftDropping(true);
          break;

        case 'hard_drop':
          hardDrop();
          break;

        case 'pause':
          setGameState(prev => prev === 'playing' ? 'paused' : 'playing');
          break;
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      const action = KEY_BINDINGS[e.code];
      if (action === 'soft_drop') {
        setIsSoftDropping(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [gameState, currentPiece, board, isSettling, startGame, resetGame, hardDrop]);

  // ============ 绘制单个方块 ============
  const drawCell = (
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    cellData: Cell | string,
    alpha = 1,
    isMuted = false,
    isPixel = false
  ) => {
    const colorId = typeof cellData === 'string' ? cellData : cellData.color;
    let color;
    if (colorId === 'red') color = '#FF3B3F';
    else if (colorId === 'blue') color = '#4A90E2';
    else if (colorId === 'yellow') color = '#FFD700';
    else return;

    if (isMuted) alpha *= 0.85;

    let drawX = isPixel ? x : x * CELL_SIZE;
    let drawY = isPixel ? y : y * CELL_SIZE;
    let size = CELL_SIZE;

    // 匹配高亮动画
    if (!isPixel && matchingCells.has(`${y},${x}`)) {
      const time = Date.now();
      const flash = Math.abs(Math.sin(time / 80));
      ctx.globalAlpha = 1;
      ctx.fillStyle = color;
      ctx.fillRect(drawX + 2, drawY + 2, size - 4, size - 4);
      ctx.fillStyle = `rgba(255, 255, 255, ${0.5 + flash * 0.5})`;
      ctx.fillRect(drawX + 2, drawY + 2, size - 4, size - 4);
      ctx.strokeStyle = '#FFFFFF';
      ctx.lineWidth = 3;
      ctx.strokeRect(drawX + 2, drawY + 2, size - 4, size - 4);
      return;
    }

    // 消除动画 - 整体快速缩小消失
    if (!isPixel && clearingCells.has(`${y},${x}`)) {
      const time = Date.now() % 280;
      const progress = time / 280;

      // 快速缩小到中心消失
      const scale = 1 - progress;
      alpha = 1 - progress;
      size *= Math.max(0, scale);

      drawX += (CELL_SIZE - size) / 2;
      drawY += (CELL_SIZE - size) / 2;
    }

    // 下落动画 - 使用缓动函数模拟自然重力
    if (!isPixel && fallingStartTime > 0 && fallingOffsets[`${y},${x}`]) {
      const elapsed = Date.now() - fallingStartTime;
      const duration = 400; // 延长下落时间
      const progress = Math.min(1, elapsed / duration);
      // easeOutBounce 缓动 - 模拟落地微弹
      const easeOutBounce = (t: number): number => {
        if (t < 1 / 2.75) {
          return 7.5625 * t * t;
        } else if (t < 2 / 2.75) {
          return 7.5625 * (t -= 1.5 / 2.75) * t + 0.75;
        } else if (t < 2.5 / 2.75) {
          return 7.5625 * (t -= 2.25 / 2.75) * t + 0.9375;
        } else {
          return 7.5625 * (t -= 2.625 / 2.75) * t + 0.984375;
        }
      };
      const easedProgress = easeOutBounce(progress);
      drawY -= fallingOffsets[`${y},${x}`] * (1 - easedProgress);
    }

    ctx.globalAlpha = alpha;
    ctx.fillStyle = color;
    ctx.fillRect(drawX + 2, drawY + 2, size - 4, size - 4);

    // 高光效果
    const highlight = ctx.createRadialGradient(
      drawX + size * 0.3, drawY + size * 0.3, 0,
      drawX + size * 0.5, drawY + size * 0.5, size * 0.7
    );
    highlight.addColorStop(0, 'rgba(255,255,255,0.4)');
    highlight.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = highlight;
    ctx.fillRect(drawX + 2, drawY + 2, size - 4, size - 4);

    ctx.globalAlpha = 1;

    if (!isMuted) {
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 2;
      ctx.strokeRect(drawX + 2, drawY + 2, size - 4, size - 4);
    } else {
      ctx.strokeStyle = 'rgba(255,255,255,0.3)';
      ctx.lineWidth = 1;
      ctx.strokeRect(drawX + 2, drawY + 2, size - 4, size - 4);
    }
  };

  // ============ 绘制粒子 ============
  const drawParticles = (ctx: CanvasRenderingContext2D) => {
    particles.forEach(p => {
      ctx.save();
      ctx.globalAlpha = p.life;
      ctx.fillStyle = p.color;
      ctx.shadowBlur = 8;
      ctx.shadowColor = p.color;

      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size * p.life, 0, Math.PI * 2);
      ctx.fill();

      ctx.restore();
    });
  };

  // ============ Canvas 绘制循环 ============
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

      // 绘制固定方块
      board.forEach((row, y) => {
        row.forEach((cell, x) => {
          if (cell) {
            drawCell(ctx, x, y, cell, 1, true);
          }
        });
      });

      // 绘制 Ghost Piece（硬降预览）
      if (ghostPosition && currentPiece && gameState === 'playing') {
        ctx.save();
        ctx.globalAlpha = 0.25;
        currentPiece.shape.forEach((row, dy) => {
          row.forEach((cell, dx) => {
            if (cell) {
              const px = (ghostPosition.x + dx) * CELL_SIZE;
              const py = (ghostPosition.y + dy) * CELL_SIZE;
              ctx.strokeStyle = '#888';
              ctx.lineWidth = 2;
              ctx.setLineDash([4, 4]);
              ctx.strokeRect(px + 4, py + 4, CELL_SIZE - 8, CELL_SIZE - 8);
              ctx.setLineDash([]);
            }
          });
        });
        ctx.restore();
      }

      // 绘制当前方块
      if (currentPiece && gameState === 'playing') {
        const pulse = Math.sin(Date.now() / 200) * 0.15 + 0.85;
        ctx.save();
        currentPiece.shape.forEach((row, y) => {
          row.forEach((cell, x) => {
            if (cell) {
              const posX = currentPiece.x + x;
              const posY = currentPiece.y + y;
              ctx.shadowBlur = 15 * pulse;
              ctx.shadowColor = cell === 'red' ? '#FF3B3F' : cell === 'blue' ? '#4A90E2' : '#FFD700';
              drawCell(ctx, posX, posY, cell);
            }
          });
        });
        ctx.restore();
      }

      // 绘制粒子效果
      drawParticles(ctx);

      animationFrame.current = requestAnimationFrame(draw);
    };

    draw();

    return () => {
      if (animationFrame.current) {
        cancelAnimationFrame(animationFrame.current);
      }
    };
  }, [board, currentPiece, ghostPosition, gameState, clearingCells, matchingCells, fallingOffsets, fallingStartTime, particles]);

  // ============ Combo 动画清理 ============
  useEffect(() => {
    if (combos.length > 0) {
      const timer = setTimeout(() => {
        setCombos(prev => prev.slice(1));
      }, 800);
      return () => clearTimeout(timer);
    }
  }, [combos]);

  // ============ 移动端触摸处理 ============
  const handleTouchAction = (action: string) => {
    if (gameState !== 'playing' || !currentPiece || isSettling || isExploding) return;

    switch (action) {
      case 'left':
        if (canMoveHorizontal(currentPiece, -1, board)) {
          setCurrentPiece(prev => prev ? { ...prev, x: prev.x - 1 } : null);
          // 重置锁定延迟
          if (lockTimerRef.current) {
            clearTimeout(lockTimerRef.current);
            lockTimerRef.current = null;
          }
        }
        break;
      case 'right':
        if (canMoveHorizontal(currentPiece, 1, board)) {
          setCurrentPiece(prev => prev ? { ...prev, x: prev.x + 1 } : null);
          if (lockTimerRef.current) {
            clearTimeout(lockTimerRef.current);
            lockTimerRef.current = null;
          }
        }
        break;
      case 'rotate':
        const rotated = tryRotate(currentPiece, board);
        if (rotated) {
          setCurrentPiece(rotated);
          if (lockTimerRef.current) {
            clearTimeout(lockTimerRef.current);
            lockTimerRef.current = null;
          }
        }
        break;
      case 'drop':
        hardDrop();
        break;
    }
  };

  // ============ 移动端棋盘触摸控制 ============
  const touchStartRef = useRef<{ x: number; y: number; time: number } | null>(null);
  const longPressTimerRef = useRef<number | null>(null);
  const acceleratingRef = useRef(false);
  const accelIntervalRef = useRef<number | null>(null);

  const handleCanvasTouchStart = (e: React.TouchEvent<HTMLCanvasElement>) => {
    if (gameState !== 'playing' || !currentPiece || isSettling || isExploding) return;
    e.preventDefault();

    const touch = e.touches[0];
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const touchX = (touch.clientX - rect.left) * scaleX;
    const touchY = (touch.clientY - rect.top) * scaleY;

    touchStartRef.current = { x: touchX, y: touchY, time: Date.now() };

    // 长按检测 - 开始加速下落
    longPressTimerRef.current = window.setTimeout(() => {
      acceleratingRef.current = true;
      let speed = 150; // 初始速度

      const accelerate = () => {
        if (!acceleratingRef.current) return;
        setIsSoftDropping(true);
        // 逐渐加速
        speed = Math.max(30, speed - 10);
        accelIntervalRef.current = window.setTimeout(accelerate, speed);
      };
      accelerate();
    }, 200);
  };

  const handleCanvasTouchEnd = (e: React.TouchEvent<HTMLCanvasElement>) => {
    e.preventDefault();

    // 清除长按定时器
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }

    // 停止加速下落
    if (acceleratingRef.current) {
      acceleratingRef.current = false;
      setIsSoftDropping(false);
      if (accelIntervalRef.current) {
        clearTimeout(accelIntervalRef.current);
        accelIntervalRef.current = null;
      }
      touchStartRef.current = null;
      return;
    }

    if (!touchStartRef.current || !currentPiece || gameState !== 'playing') return;

    const touchDuration = Date.now() - touchStartRef.current.time;

    // 只有短点击才处理移动/旋转
    if (touchDuration < 200) {
      const canvas = canvasRef.current;
      if (!canvas) return;

      const touchX = touchStartRef.current.x;
      const touchY = touchStartRef.current.y;

      // 计算当前方块的边界
      const pieceLeft = currentPiece.x * CELL_SIZE;
      const pieceRight = (currentPiece.x + currentPiece.shape[0].length) * CELL_SIZE;
      const pieceTop = currentPiece.y * CELL_SIZE;
      const pieceBottom = (currentPiece.y + currentPiece.shape.length) * CELL_SIZE;

      // 判断是否点击在当前方块上 -> 旋转
      if (touchX >= pieceLeft && touchX <= pieceRight &&
          touchY >= pieceTop && touchY <= pieceBottom) {
        handleTouchAction('rotate');
      }
      // 点击棋盘左半边 -> 左移
      else if (touchX < canvas.width / 2) {
        handleTouchAction('left');
      }
      // 点击棋盘右半边 -> 右移
      else {
        handleTouchAction('right');
      }
    }

    touchStartRef.current = null;
  };

  // 清理触摸相关定时器
  useEffect(() => {
    return () => {
      if (longPressTimerRef.current) clearTimeout(longPressTimerRef.current);
      if (accelIntervalRef.current) clearTimeout(accelIntervalRef.current);
    };
  }, []);

  // ============ 渲染下一个方块预览 ============
  const renderNextPiecePreview = (size: 'sm' | 'lg' = 'lg') => {
    if (!nextPiece) return null;
    const cellSize = size === 'sm' ? 16 : 24;
    return (
      <div className="inline-block p-1.5 rounded-lg bg-gray-50 border border-gray-100">
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
                  className={`m-0.5 rounded-sm ${cell ? 'shadow-sm border border-white/20' : ''}`}
                  style={{ backgroundColor: bgColor, width: cellSize, height: cellSize }}
                />
              );
            })}
          </div>
        ))}
      </div>
    );
  };

  // ============ 渲染色魂能量条 ============
  const renderSoulBar = (compact: boolean = false) => (
    <div className={`flex ${compact ? 'flex-row items-center gap-1.5 p-1.5' : 'flex-col gap-2 p-2'} bg-white rounded-lg shadow-sm border border-gray-100 transition-all duration-300 ${activeSoulBomb ? 'ring-2 ring-offset-2 ring-opacity-50' : ''}`}>
      <div className={`${compact ? 'text-[9px]' : 'text-[10px] mb-1'} font-bold text-gray-400`}>能量</div>
      <div className="flex items-center gap-1.5 flex-1">
        <div className={`flex-1 ${compact ? 'h-1.5' : 'h-3'} bg-gray-100 rounded-full overflow-hidden flex gap-0.5`}>
          {[0, 1, 2].map(i => (
            <div
              key={i}
              className={`flex-1 h-full transition-all duration-300 rounded-sm ${
                i < soulCounter
                  ? lastGomokuColor === 'red' ? 'bg-[#FF3B3F]'
                    : lastGomokuColor === 'blue' ? 'bg-[#4A90E2]'
                    : lastGomokuColor === 'yellow' ? 'bg-[#FFD700]'
                    : 'bg-indigo-500'
                  : 'bg-gray-200'
              } ${i < soulCounter && soulCounter >= 2 ? 'animate-pulse' : ''}`}
            />
          ))}
        </div>
        <div className={`${compact ? 'text-[9px]' : 'text-[10px]'} font-bold text-gray-500`}>{soulCounter}/3</div>
      </div>
    </div>
  );

  // ============ 渲染 ============
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-[#F0F2F5] p-1 sm:p-4 font-sans text-[#1A1A1A]">
      {/* 移动端顶部标题 */}
      <div className="lg:hidden text-center mb-2">
        <h1 className="text-2xl font-black tracking-tight" style={{ textShadow: '2px 2px 0 rgba(0,0,0,0.1)' }}>
          <span className="text-[#FF3B3F]">俄</span>
          <span className="text-[#4A90E2]">罗</span>
          <span className="text-[#FFD700]">斯</span>
          <span className="text-[#FF3B3F]">消</span>
          <span className="text-[#4A90E2]">消</span>
          <span className="text-[#FFD700]">乐</span>
        </h1>
        <a
          href="https://joinlearn.com"
          target="_blank"
          rel="noopener noreferrer"
          className="text-[10px] text-gray-400 hover:text-indigo-500 transition-colors"
        >
          就学｜joinlearn.com 出品
        </a>
      </div>

      <div className={`flex flex-col lg:flex-row gap-2 lg:gap-8 items-stretch lg:items-start max-w-full transform transition-transform duration-100 ${isShaking ? 'animate-pulse' : ''}`}>

        {/* 左侧信息栏 (PC端) */}
        <div className="hidden lg:flex flex-col gap-3 w-48">
          <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100">
            <h3 className="text-sm font-semibold text-gray-500 mb-1 uppercase tracking-wider">得分</h3>
            <p className="text-3xl font-black text-indigo-600">{score}</p>
          </div>

          <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100">
            <h3 className="text-sm font-semibold text-gray-500 mb-1 uppercase tracking-wider">等级</h3>
            <p className="text-3xl font-black text-emerald-600">Lv.{level}</p>
          </div>

          <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100">
            <h3 className="text-sm font-semibold text-gray-500 mb-1 uppercase tracking-wider">行数</h3>
            <p className="text-3xl font-black text-purple-600">{linesCleared}</p>
          </div>

          {/* 色魂能量条 */}
          {renderSoulBar()}
        </div>

        {/* 核心棋盘区 */}
        <div className="flex flex-col items-center">
          {/* 移动端顶部信息栏 - 紧凑版 */}
          <div className="lg:hidden w-full max-w-sm mb-1.5">
            <div className="flex items-center justify-between gap-1 bg-white p-1.5 rounded-lg shadow-sm border border-gray-100">
              {/* 得分 */}
              <div className="flex-1 text-center">
                <div className="text-[9px] text-gray-400 font-semibold">得分</div>
                <div className="text-base font-black text-indigo-600">{score}</div>
              </div>
              {/* 下一个方块 */}
              <div className="flex flex-col items-center px-2 border-l border-r border-gray-100">
                <div className="text-[9px] text-gray-400 font-semibold">下一个</div>
                {renderNextPiecePreview('sm')}
              </div>
              {/* 最高分 */}
              <div className="flex-1 text-center">
                <div className="text-[9px] text-gray-400 font-semibold">最高</div>
                <div className="text-base font-black text-amber-500">{highScore}</div>
              </div>
            </div>
            {/* 移动端色魂能量条 */}
            <div className="mt-1">
              {renderSoulBar(true)}
            </div>
          </div>
          <div className="bg-white p-1.5 lg:p-4 rounded-2xl shadow-xl border-4 border-white mb-1 lg:mb-4">
            {/* PC端标题 */}
            <h1 className="hidden lg:block text-4xl font-black text-center mb-4 tracking-tighter text-gray-800 italic">
              俄罗斯消消乐
            </h1>

            <div className="relative">
              <canvas
                ref={canvasRef}
                width={BOARD_SIZE * CELL_SIZE}
                height={BOARD_SIZE * CELL_SIZE}
                className="rounded-lg shadow-inner bg-gray-50 max-w-[90vw] h-auto"
                style={{ touchAction: 'none' }}
                onTouchStart={handleCanvasTouchStart}
                onTouchEnd={handleCanvasTouchEnd}
              />

              {combos.map(combo => (
                <div
                  key={combo.id}
                  className="absolute pointer-events-none"
                  style={{
                    left: combo.x - 24,
                    top: combo.y - 24,
                    animation: 'ping 0.8s cubic-bezier(0, 0, 0.2, 1)'
                  }}
                >
                  <Sparkles className="text-yellow-400 w-12 h-12" />
                </div>
              ))}

              {/* 游戏结束覆盖 */}
              {gameState === 'gameover' && (
                <div
                  className="absolute inset-0 bg-gray-900/80 backdrop-blur-sm flex items-center justify-center rounded-lg z-10 cursor-pointer"
                  onClick={resetGame}
                >
                  <div className="text-center p-8 bg-white rounded-2xl shadow-2xl" onClick={e => e.stopPropagation()}>
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

              {/* 暂停覆盖 */}
              {gameState === 'paused' && (
                <div className="absolute inset-0 bg-gray-900/80 backdrop-blur-sm flex items-center justify-center rounded-lg z-10">
                  <div className="text-center p-8 bg-white rounded-2xl shadow-2xl">
                    <h2 className="text-3xl font-black mb-4 text-gray-800">暂停</h2>
                    <p className="text-gray-500 mb-6">按 P 或 ESC 继续</p>
                    <button
                      onClick={() => setGameState('playing')}
                      className="bg-indigo-600 hover:bg-indigo-700 text-white px-8 py-3 rounded-full font-bold"
                    >
                      继续游戏
                    </button>
                  </div>
                </div>
              )}

              {/* 开始界面 */}
              {gameState === 'idle' && (
                <div
                  className="absolute inset-0 flex items-center justify-center z-10 cursor-pointer group"
                  onClick={startGame}
                >
                  <div className="bg-white/90 backdrop-blur px-6 py-3 rounded-full shadow-xl border border-indigo-100 transform group-hover:scale-110 transition-all duration-300">
                    <p className="text-indigo-600 font-black text-xl flex items-center gap-2">
                      <Sparkles className="w-5 h-5 animate-pulse" />
                      点击开始游戏
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* 移动端底部按钮 */}
          <div className="lg:hidden flex gap-2 w-full max-w-sm mt-1">
            <button
              onClick={() => handleTouchAction('rotate')}
              className="flex-1 py-2.5 bg-indigo-600 rounded-lg text-white font-bold text-sm shadow active:bg-indigo-700 active:scale-95 transition-transform select-none touch-manipulation"
            >
              旋转
            </button>
            <button
              onTouchStart={(e) => { e.preventDefault(); setIsSoftDropping(true); }}
              onTouchEnd={(e) => { e.preventDefault(); setIsSoftDropping(false); }}
              onMouseDown={() => setIsSoftDropping(true)}
              onMouseUp={() => setIsSoftDropping(false)}
              onMouseLeave={() => setIsSoftDropping(false)}
              className={`flex-1 py-2.5 rounded-lg text-white font-bold text-sm shadow active:scale-95 transition-all select-none touch-manipulation ${isSoftDropping ? 'bg-amber-600' : 'bg-amber-500'}`}
            >
              {isSoftDropping ? '加速中...' : '加速下坠'}
            </button>
          </div>
          {/* 移动端操作提示 */}
          <div className="lg:hidden text-center text-[10px] text-gray-400 mt-1.5">
            点棋盘左/右侧移动
          </div>
        </div>

        {/* 右侧辅助栏 (PC端) */}
        <div className="hidden lg:flex flex-col gap-4 w-56">
          <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 text-center">
            <h3 className="font-bold text-gray-500 mb-3 uppercase tracking-widest text-xs">下一个</h3>
            {renderNextPiecePreview('lg')}
          </div>

          <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100">
            <h3 className="font-bold text-gray-500 mb-3 uppercase tracking-widest text-xs">操作</h3>
            <div className="text-sm text-gray-600 space-y-1">
              <p>← → / A D : 移动</p>
              <p>↑ / W : 旋转</p>
              <p>↓ / S : 加速下落</p>
              <p>空格 : 硬降</p>
              <p>P / ESC : 暂停</p>
            </div>
          </div>

          <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100">
            <h3 className="font-bold text-gray-500 mb-2 uppercase tracking-widest text-xs">最高分</h3>
            <p className="text-2xl font-black text-amber-500">{highScore}</p>
          </div>

          <button
            onClick={resetGame}
            className="w-full bg-white text-gray-700 py-4 rounded-xl font-bold shadow-sm border border-gray-200 hover:bg-gray-50 transition-colors"
          >
            重开一局
          </button>

          {/* 手机扫码区 */}
          <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 text-center">
            <div className="flex items-center justify-center gap-2 mb-3">
              <Smartphone className="w-4 h-4 text-gray-500" />
              <h3 className="font-bold text-gray-500 uppercase tracking-widest text-xs">手机扫码玩</h3>
            </div>
            <div className="bg-white p-2 rounded-lg inline-block border border-gray-200">
              <img
                src="https://api.qrserver.com/v1/create-qr-code/?size=100x100&data=https://tm.joinlearn.com"
                alt="扫码在手机上玩"
                className="w-24 h-24"
              />
            </div>
            <p className="text-xs text-gray-400 mt-2">tm.joinlearn.com</p>
          </div>
        </div>

      </div>
    </div>
  );
};

export default GomokuTetris;
