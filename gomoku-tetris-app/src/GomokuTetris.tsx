import React, { useState, useEffect, useRef } from 'react';
import { Sparkles, Clock } from 'lucide-react';

const BOARD_SIZE = 10;
const CELL_SIZE = 40;
const COLORS = ['#FF3B3F', '#4A90E2', '#FFD700']; // 鲜红、亮蓝、亮黄
const COLOR_IDS = ['red', 'blue', 'yellow'];
const TIME_LIMIT = 10;

const TETROMINOS = {
  I: [[1,1,1,1]],
  O: [[1,1],[1,1]],
  T: [[0,1,0],[1,1,1]],
  L: [[1,0],[1,0],[1,1]],
  J: [[0,1],[0,1],[1,1]],
  S: [[0,1,1],[1,1,0]],
  Z: [[1,1,0],[0,1,1]]
};

const GomokuTetris = () => {
  const [board, setBoard] = useState(Array(BOARD_SIZE).fill(null).map(() => Array(BOARD_SIZE).fill(null)));
  const [score, setScore] = useState(0);
  const [currentPiece, setCurrentPiece] = useState(null);
  const [nextPiece, setNextPiece] = useState(null);
  const [dragging, setDragging] = useState(false);
  const [dragPos, setDragPos] = useState({ x: 0, y: 0 });
  const [dragStartPos, setDragStartPos] = useState(null);
  const [previewPos, setPreviewPos] = useState(null);
  const [timeLeft, setTimeLeft] = useState(TIME_LIMIT);
  const [gameOver, setGameOver] = useState(false);
  const [combos, setCombos] = useState([]);
  const [justDropped, setJustDropped] = useState(false);
  const canvasRef = useRef(null);
  const animationFrame = useRef(0);

  // 生成随机方块（严格检查不能有任何重叠）
  const generatePiece = (currentBoard = board) => {
    const shapes = Object.keys(TETROMINOS);
    const randomShape = shapes[Math.floor(Math.random() * shapes.length)];
    const shape = TETROMINOS[randomShape];
    // 每个格子随机颜色
    const coloredShape = shape.map(row => 
      row.map(cell => cell ? COLOR_IDS[Math.floor(Math.random() * COLORS.length)] : null)
    );
    
    // 尝试所有可能的位置
    const possiblePositions = [];
    for (let y = 0; y <= BOARD_SIZE - shape.length; y++) {
      for (let x = 0; x <= BOARD_SIZE - shape[0].length; x++) {
        if (canPlaceAt(coloredShape, x, y, currentBoard)) {
          possiblePositions.push({ x, y });
        }
      }
    }
    
    // 如果没有可用位置，游戏结束
    if (possiblePositions.length === 0) {
      return null;
    }
    
    // 从可用位置中随机选择一个
    const randomPos = possiblePositions[Math.floor(Math.random() * possiblePositions.length)];
    
    return { shape: coloredShape, x: randomPos.x, y: randomPos.y };
  };

  // 检查是否可以放置
  const canPlaceAt = (shape, boardX, boardY, currentBoard) => {
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

  // 初始化游戏
  useEffect(() => {
    const first = generatePiece();
    const second = generatePiece();
    if (first) setCurrentPiece(first);
    if (second) setNextPiece(second);
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

  // 固定当前方块（倒计时结束时调用）
  const fixCurrentPiece = () => {
    if (!currentPiece) return;
    
    const newBoard = board.map(row => [...row]);
    for (let y = 0; y < currentPiece.shape.length; y++) {
      for (let x = 0; x < currentPiece.shape[y].length; x++) {
        if (currentPiece.shape[y][x]) {
          newBoard[currentPiece.y + y][currentPiece.x + x] = currentPiece.shape[y][x];
        }
      }
    }
    
    processPlacement(newBoard);
  };

  // 处理方块放置（放置瞬间调用）
  const processPlacement = (newBoard) => {
    const clearedBoard = processClear(newBoard);
    setBoard(clearedBoard);
    
    // 使用清理后的棋盘生成新方块
    const newPiece = generatePiece(clearedBoard);
    if (!newPiece) {
      setGameOver(true);
      setCurrentPiece(null);
      setNextPiece(null);
    } else {
      setCurrentPiece(nextPiece);
      const nextNewPiece = generatePiece(clearedBoard);
      setNextPiece(nextNewPiece);
      setTimeLeft(TIME_LIMIT);
    }
  };

  // 旋转方块
  const rotatePiece = (piece) => {
    const rotated = piece.shape[0].map((_, i) =>
      piece.shape.map(row => row[i]).reverse()
    );
    return { ...piece, shape: rotated };
  };

  // 检查五子棋连线
  const checkGomoku = (board) => {
    let newBoard = board.map(row => [...row]);
    let cleared = false;
    let clearCount = 0;
    const toRemove = new Set();

    const directions = [
      [0, 1], [1, 0], [1, 1], [1, -1]
    ];

    for (let y = 0; y < BOARD_SIZE; y++) {
      for (let x = 0; x < BOARD_SIZE; x++) {
        const color = newBoard[y][x];
        if (!color) continue;

        for (const [dy, dx] of directions) {
          const line = [[y, x]];
          for (let i = 1; i < 5; i++) {
            const ny = y + dy * i;
            const nx = x + dx * i;
            if (ny < 0 || ny >= BOARD_SIZE || nx < 0 || nx >= BOARD_SIZE) break;
            if (newBoard[ny][nx] !== color) break;
            line.push([ny, nx]);
          }

          if (line.length >= 5) {
            line.forEach(([ly, lx]) => toRemove.add(`${ly},${lx}`));
            cleared = true;
            clearCount++;
          }
        }
      }
    }

    toRemove.forEach(key => {
      const [y, x] = key.split(',').map(Number);
      newBoard[y][x] = null;
    });

    return { board: newBoard, cleared, count: clearCount };
  };

  // 检查行/列消除
  const checkLines = (board) => {
    let newBoard = board.map(row => [...row]);
    let cleared = false;
    let clearCount = 0;

    for (let y = 0; y < BOARD_SIZE; y++) {
      if (newBoard[y].every(cell => cell !== null)) {
        newBoard[y] = Array(BOARD_SIZE).fill(null);
        cleared = true;
        clearCount++;
      }
    }

    for (let x = 0; x < BOARD_SIZE; x++) {
      if (newBoard.every(row => row[x] !== null)) {
        newBoard.forEach(row => row[x] = null);
        cleared = true;
        clearCount++;
      }
    }

    return { board: newBoard, cleared, count: clearCount };
  };

  // 应用重力，让方块逐格下落（只下落一格）
  const applyGravity = (board) => {
    let newBoard = board.map(row => [...row]);
    let changed = false;

    // 从倒数第二行开始向上扫描
    for (let y = BOARD_SIZE - 2; y >= 0; y--) {
      for (let x = 0; x < BOARD_SIZE; x++) {
        // 如果当前格有方块，且下方是空的
        if (newBoard[y][x] && !newBoard[y + 1][x]) {
          newBoard[y + 1][x] = newBoard[y][x];
          newBoard[y][x] = null;
          changed = true;
        }
      }
    }

    return { board: newBoard, changed };
  };

  // 处理消除
  const processClear = (boardAfterPlace) => {
    let currentBoard = boardAfterPlace;
    let totalScore = 0;

    // 持续循环：消除 → 重力 → 再检查消除
    let continueProcessing = true;
    while (continueProcessing) {
      continueProcessing = false;

      // 1. 检查并消除
      let comboParts = 0;
      const lineResult = checkLines(currentBoard);
      const gomokuResult = checkGomoku(lineResult.board);

      if (lineResult.cleared) {
        totalScore += lineResult.count * 10;
        comboParts++;
        continueProcessing = true;
      }
      if (gomokuResult.cleared) {
        totalScore += gomokuResult.count * 30;
        comboParts++;
        continueProcessing = true;
      }

      if (comboParts > 1) {
        totalScore += 100;
        setCombos(prev => [...prev, { 
          x: BOARD_SIZE * CELL_SIZE / 2, 
          y: BOARD_SIZE * CELL_SIZE / 2, 
          id: Date.now() 
        }]);
      }

      currentBoard = gomokuResult.board;

      // 2. 应用重力直到稳定
      if (continueProcessing) {
        let gravityChanged = true;
        while (gravityChanged) {
          const gravityResult = applyGravity(currentBoard);
          currentBoard = gravityResult.board;
          gravityChanged = gravityResult.changed;
        }
        // 重力稳定后，继续检查是否有新的可消除项
      }
    }

    if (totalScore > 0) setScore(prev => prev + totalScore);
    return currentBoard;
  };

  // 鼠标/触摸事件处理
  const handleStart = (e) => {
    if (gameOver || !currentPiece || justDropped) return;
    
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const clientX = e.type.includes('touch') ? e.touches[0].clientX : e.clientX;
    const clientY = e.type.includes('touch') ? e.touches[0].clientY : e.clientY;
    const x = clientX - rect.left;
    const y = clientY - rect.top;
    
    const boardX = Math.floor(x / CELL_SIZE);
    const boardY = Math.floor(y / CELL_SIZE);

    const clickedCurrent = boardX >= currentPiece.x && 
                          boardX < currentPiece.x + currentPiece.shape[0].length &&
                          boardY >= currentPiece.y && 
                          boardY < currentPiece.y + currentPiece.shape.length &&
                          currentPiece.shape[boardY - currentPiece.y][boardX - currentPiece.x];

    if (clickedCurrent) {
      setDragging(true);
      setDragPos({ x, y });
      setDragStartPos({ x, y });
    }
  };

  const handleMove = (e) => {
    if (!dragging || !currentPiece || gameOver) return;
    
    e.preventDefault();
    
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const clientX = e.type.includes('touch') ? e.touches[0].clientX : e.clientX;
    const clientY = e.type.includes('touch') ? e.touches[0].clientY : e.clientY;
    const x = clientX - rect.left;
    const y = clientY - rect.top;
    
    setDragPos({ x, y });
    
    // 计算预览位置
    const boardX = Math.floor(x / CELL_SIZE);
    const boardY = Math.floor(y / CELL_SIZE);
    const canPlace = canPlaceAt(currentPiece.shape, boardX, boardY, board);
    setPreviewPos({ x: boardX, y: boardY, valid: canPlace });
  };

  const handleEnd = (e) => {
    if (!dragging || !currentPiece || gameOver) return;
    
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const clientX = e.type.includes('touch') ? (e.changedTouches?.[0]?.clientX || dragPos.x + rect.left) : e.clientX;
    const clientY = e.type.includes('touch') ? (e.changedTouches?.[0]?.clientY || dragPos.y + rect.top) : e.clientY;
    const x = clientX - rect.left;
    const y = clientY - rect.top;
    
    // 检查是否是点击（没有移动或移动很小）
    const deltaX = Math.abs(x - dragStartPos.x);
    const deltaY = Math.abs(y - dragStartPos.y);
    const isClick = deltaX < 5 && deltaY < 5;
    
    if (isClick && !justDropped) {
      // 快速点击 → 旋转（不放置）
      const rotated = rotatePiece(currentPiece);
      if (canPlaceAt(rotated.shape, rotated.x, rotated.y, board)) {
        setCurrentPiece(rotated);
      } else {
        // 尝试微调位置
        let adjusted = false;
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            if (canPlaceAt(rotated.shape, rotated.x + dx, rotated.y + dy, board)) {
              setCurrentPiece({ ...rotated, x: rotated.x + dx, y: rotated.y + dy });
              adjusted = true;
              break;
            }
          }
          if (adjusted) break;
        }
      }
      setDragging(false);
      setPreviewPos(null);
      setDragStartPos(null);
    } else if (previewPos && previewPos.valid) {
      // 拖动放置 → 立即固定并消除
      const newBoard = board.map(row => [...row]);
      const newPiece = { ...currentPiece, x: previewPos.x, y: previewPos.y };
      
      for (let y = 0; y < newPiece.shape.length; y++) {
        for (let x = 0; x < newPiece.shape[y].length; x++) {
          if (newPiece.shape[y][x]) {
            newBoard[newPiece.y + y][newPiece.x + x] = newPiece.shape[y][x];
          }
        }
      }
      
      setDragging(false);
      setPreviewPos(null);
      setDragStartPos(null);
      setJustDropped(true);
      setTimeout(() => setJustDropped(false), 300);
      processPlacement(newBoard);
    } else {
      // 无效位置，取消拖动
      setDragging(false);
      setPreviewPos(null);
      setDragStartPos(null);
    }
  };

  // 绘制单个方块
  const drawCell = (ctx, x, y, colorId, alpha = 1) => {
    let color;
    if (colorId === 'red') color = '#FF3B3F';
    else if (colorId === 'blue') color = '#4A90E2';
    else if (colorId === 'yellow') color = '#FFD700';
    else return;
    
    ctx.globalAlpha = alpha;
    ctx.fillStyle = color;
    ctx.fillRect(x * CELL_SIZE + 2, y * CELL_SIZE + 2, CELL_SIZE - 4, CELL_SIZE - 4);
    
    // 添加高光效果
    const highlight = ctx.createRadialGradient(
      x * CELL_SIZE + CELL_SIZE * 0.3, 
      y * CELL_SIZE + CELL_SIZE * 0.3, 
      0,
      x * CELL_SIZE + CELL_SIZE * 0.5, 
      y * CELL_SIZE + CELL_SIZE * 0.5, 
      CELL_SIZE * 0.7
    );
    highlight.addColorStop(0, 'rgba(255,255,255,0.4)');
    highlight.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = highlight;
    ctx.fillRect(x * CELL_SIZE + 2, y * CELL_SIZE + 2, CELL_SIZE - 4, CELL_SIZE - 4);
    
    ctx.globalAlpha = 1;
    
    ctx.strokeStyle = alpha < 1 ? 'rgba(255,255,255,0.5)' : '#fff';
    ctx.lineWidth = 2;
    ctx.strokeRect(x * CELL_SIZE + 2, y * CELL_SIZE + 2, CELL_SIZE - 4, CELL_SIZE - 4);
  };

  // 绘制游戏
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    
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
            drawCell(ctx, x, y, cell);
          }
        });
      });

      // 绘制预览位置
      if (dragging && previewPos && currentPiece) {
        currentPiece.shape.forEach((row, y) => {
          row.forEach((cell, x) => {
            if (cell) {
              const px = previewPos.x + x;
              const py = previewPos.y + y;
              if (px >= 0 && px < BOARD_SIZE && py >= 0 && py < BOARD_SIZE) {
                ctx.fillStyle = previewPos.valid ? 'rgba(0,255,0,0.2)' : 'rgba(255,0,0,0.2)';
                ctx.fillRect(px * CELL_SIZE + 2, py * CELL_SIZE + 2, CELL_SIZE - 4, CELL_SIZE - 4);
                ctx.strokeStyle = previewPos.valid ? 'rgba(0,255,0,0.5)' : 'rgba(255,0,0,0.5)';
                ctx.lineWidth = 2;
                ctx.strokeRect(px * CELL_SIZE + 2, py * CELL_SIZE + 2, CELL_SIZE - 4, CELL_SIZE - 4);
              }
            }
          });
        });
      }

      // 绘制当前方块
      if (currentPiece && !dragging) {
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

      // 绘制拖拽中的方块（紧贴鼠标下方）
      if (dragging && currentPiece) {
        ctx.save();
        const offsetX = dragPos.x - (currentPiece.shape[0].length * CELL_SIZE) / 2;
        const offsetY = dragPos.y + 10;
        
        // 阴影效果
        ctx.shadowBlur = 20;
        ctx.shadowColor = 'rgba(0,0,0,0.3)';
        ctx.shadowOffsetX = 3;
        ctx.shadowOffsetY = 3;
        
        currentPiece.shape.forEach((row, y) => {
          row.forEach((cell, x) => {
            if (cell) {
              const px = offsetX + x * CELL_SIZE;
              const py = offsetY + y * CELL_SIZE;
              
              let color;
              if (cell === 'red') color = '#FF3B3F';
              else if (cell === 'blue') color = '#4A90E2';
              else if (cell === 'yellow') color = '#FFD700';
              
              ctx.globalAlpha = 0.9;
              ctx.fillStyle = color;
              ctx.fillRect(px + 2, py + 2, CELL_SIZE - 4, CELL_SIZE - 4);
              
              // 高光
              const highlight = ctx.createRadialGradient(
                px + CELL_SIZE * 0.3, py + CELL_SIZE * 0.3, 0,
                px + CELL_SIZE * 0.5, py + CELL_SIZE * 0.5, CELL_SIZE * 0.7
              );
              highlight.addColorStop(0, 'rgba(255,255,255,0.4)');
              highlight.addColorStop(1, 'rgba(255,255,255,0)');
              ctx.fillStyle = highlight;
              ctx.fillRect(px + 2, py + 2, CELL_SIZE - 4, CELL_SIZE - 4);
              
              ctx.globalAlpha = 1;
              
              ctx.strokeStyle = '#fff';
              ctx.lineWidth = 3;
              ctx.strokeRect(px + 2, py + 2, CELL_SIZE - 4, CELL_SIZE - 4);
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
  }, [board, currentPiece, dragging, dragPos, previewPos]);

  useEffect(() => {
    if (combos.length > 0) {
      const timer = setTimeout(() => {
        setCombos(prev => prev.slice(1));
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [combos]);

  const resetGame = () => {
    setBoard(Array(BOARD_SIZE).fill(null).map(() => Array(BOARD_SIZE).fill(null)));
    setScore(0);
    const first = generatePiece();
    const second = generatePiece();
    setCurrentPiece(first);
    setNextPiece(second);
    setTimeLeft(TIME_LIMIT);
    setGameOver(false);
    setDragging(false);
    setPreviewPos(null);
    setDragStartPos(null);
    setJustDropped(false);
    setCombos([]);
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gradient-to-br from-indigo-100 via-purple-100 to-pink-100 p-4">
      <div className="bg-white rounded-xl shadow-2xl p-6">
        <h1 className="text-4xl font-bold text-center mb-6 bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
          技能五子棋
        </h1>
        
        <div className="flex gap-6 items-start">
          <div className="relative">
            <canvas
              ref={canvasRef}
              width={BOARD_SIZE * CELL_SIZE}
              height={BOARD_SIZE * CELL_SIZE}
              className="border-4 border-purple-400 rounded-lg shadow-lg"
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
              <div className="absolute inset-0 bg-black bg-opacity-70 flex items-center justify-center rounded-lg">
                <div className="text-center text-white">
                  <h2 className="text-3xl font-bold mb-4">游戏结束!</h2>
                  <p className="text-xl mb-4">最终得分: {score}</p>
                  <button
                    onClick={resetGame}
                    className="bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white px-8 py-3 rounded-lg font-bold shadow-lg transform hover:scale-105 transition"
                  >
                    重新开始
                  </button>
                </div>
              </div>
            )}
          </div>
          
          <div className="flex flex-col gap-4 w-48">
            <div className="bg-gradient-to-br from-purple-50 to-purple-100 p-4 rounded-lg shadow">
              <h3 className="font-bold text-lg mb-2 text-purple-700">得分</h3>
              <p className="text-4xl font-bold text-purple-600">{score}</p>
            </div>
            
            <div className="bg-gradient-to-br from-pink-50 to-pink-100 p-4 rounded-lg shadow">
              <div className="flex items-center gap-2 mb-2">
                <Clock className="text-pink-600" />
                <h3 className="font-bold text-lg text-pink-700">倒计时</h3>
              </div>
              <p className={`text-4xl font-bold ${timeLeft <= 3 ? 'text-red-600 animate-pulse' : 'text-pink-600'}`}>
                {timeLeft}s
              </p>
            </div>
            
            <div className="bg-gradient-to-br from-blue-50 to-blue-100 p-4 rounded-lg shadow">
              <h3 className="font-bold text-lg mb-2 text-blue-700">下一个</h3>
              {nextPiece && (
                <div className="inline-block bg-white p-2 rounded shadow-sm">
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
                            className="w-6 h-6 border border-gray-200 rounded-sm"
                            style={{ backgroundColor: bgColor }}
                          />
                        );
                      })}
                    </div>
                  ))}
                </div>
              )}
            </div>
            
            <div className="bg-gradient-to-br from-green-50 to-green-100 p-4 rounded-lg shadow text-sm">
              <h3 className="font-bold mb-2 text-green-700">游戏规则</h3>
              <ul className="space-y-1 text-gray-700">
                <li>• 点击方块旋转</li>
                <li>• 拖拽放下立即固定</li>
                <li>• 消除后重力下落</li>
                <li>• 连锁反应得分!</li>
                <li>• 5连珠 (30分)</li>
                <li>• 满行列 (10分)</li>
                <li>• COMBO +100分!</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default GomokuTetris;