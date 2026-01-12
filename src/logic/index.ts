// 导出所有游戏逻辑函数
export {
  canPlaceAt,
  canMoveDown,
  canMoveHorizontal,
  calculateGhostPosition,
  spawnPiece,
  rotatePiece,
  tryRotate,
  wouldTriggerElimination,
} from './pieceGenerator';

export {
  checkGomoku,
  checkLines,
  checkCluster,
  applyGravity,
  removeCells,
  findCellsByColor,
} from './clearing';
