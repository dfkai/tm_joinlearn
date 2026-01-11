// 导出所有游戏逻辑函数
export {
  canPlaceAt,
  findValidPosition,
  generatePiece,
  rotatePiece,
} from './pieceGenerator';

export {
  checkGomoku,
  checkLines,
  applyGravity,
  removeCells,
  findCellsByColor,
} from './clearing';
