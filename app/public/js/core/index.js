/**
 * @fileoverview Exportaciones centralizadas del módulo core
 * @description Facilita importaciones: import { SocketEventManager, GameStateManager } from './core'
 * @created 2025-02-05
 * @week Semana 19 - Frontend Cleanup
 */

export { SocketEventManager } from './SocketEventManager.js?v=20260708162526';
export { GameStateManager, GameStates } from './GameStateManager.js?v=20260708162526';
export { EventEmitter } from './EventEmitter.js?v=20260708162526';
export * from './socket-events.js?v=20260708162526';
