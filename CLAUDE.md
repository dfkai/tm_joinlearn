# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a React-based Gomoku-Tetris hybrid puzzle game (俄罗斯消消乐 / 技能五子棋). Players place colored Tetromino pieces on a 10x10 board, aiming to create either:
- Full rows/columns (Tetris-style line clears)
- 5-in-a-row color matches (Gomoku-style)

## Commands

All commands should be run from the `gomoku-tetris-app/` directory:

```bash
# Development server (Vite with HMR)
npm run dev

# Production build (TypeScript + Vite)
npm run build

# Lint (ESLint with TypeScript support)
npm run lint

# Preview production build
npm run preview
```

## Architecture

**Tech Stack:** React 19 + TypeScript + Vite + Tailwind CSS v4

**Single-Component Design:** The entire game logic lives in `src/App.tsx` (or `src/GomokuTetris.tsx`), which contains:

- **Game state:** 10x10 board grid, current/next piece, scores, timers, drag state
- **Tetromino definitions:** Standard shapes (I, O, T, L, J, S, Z) with per-cell random coloring (red/blue/yellow)
- **Canvas rendering:** Uses `requestAnimationFrame` loop for smooth animations (piece glow, clearing effects, gravity)
- **Input handling:** Unified mouse/touch handlers for drag-and-drop piece placement and tap-to-rotate
- **Game mechanics:**
  - 10-second turn timer with auto-placement
  - Line clearing (rows always clear, columns only clear if same color)
  - Gomoku detection (5+ consecutive same-color cells in any direction)
  - Gravity system (blocks fall after clears)
  - "Color Soul" meter that triggers screen-wide color bombs

**Entry Point:** `src/main.tsx` renders the App component into `#root`

## Styling

- Tailwind CSS v4 with PostCSS (`@tailwindcss/postcss`)
- Main styles in `src/index.css`
- Component-level inline Tailwind classes
- Icons from `lucide-react`
