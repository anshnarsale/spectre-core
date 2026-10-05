import chalk from 'chalk';
import { EventEmitter } from 'events';

export type LogLevel = 'debug' | 'info' | 'success' | 'warn' | 'error' | 'step';

/** Emits 'log' events: { level, text } — used by the SSE server to stream to browser */
export const logEmitter = new EventEmitter();
logEmitter.setMaxListeners(50);

const icons: Record<LogLevel, string> = {
  debug: '·',
  info: 'ℹ',
  success: '✔',
  warn: '⚠',
  error: '✖',
  step: '▶',
};

const colors: Record<LogLevel, (s: string) => string> = {
  debug: chalk.gray,
  info: chalk.cyan,
  success: chalk.green,
  warn: chalk.yellow,
  error: chalk.red,
  step: chalk.magenta,
};

let _verbose = false;

export function setVerbose(v: boolean): void {
  _verbose = v;
}

export function log(level: LogLevel, ...args: unknown[]): void {
  if (level === 'debug' && !_verbose) return;
  const icon = colors[level](icons[level]);
  const prefix = colors[level](`[${level.toUpperCase()}]`);
  const text = args.map(String).join(' ');
  console.log(icon, prefix, text);
  // Emit plain text (no ANSI) for SSE consumers
  logEmitter.emit('log', { level, text: `[${level.toUpperCase()}] ${text}` });
}

export const logger = {
  debug: (...args: unknown[]) => log('debug', ...args),
  info: (...args: unknown[]) => log('info', ...args),
  success: (...args: unknown[]) => log('success', ...args),
  warn: (...args: unknown[]) => log('warn', ...args),
  error: (...args: unknown[]) => log('error', ...args),
  step: (...args: unknown[]) => log('step', ...args),
  banner: (text: string) => {
    const line = '─'.repeat(text.length + 4);
    console.log(chalk.bold.cyan(`\n┌${line}┐`));
    console.log(chalk.bold.cyan(`│  ${text}  │`));
    console.log(chalk.bold.cyan(`└${line}┘\n`));
    logEmitter.emit('log', { level: 'info', text: `=== ${text} ===` });
  },
  section: (text: string) => {
    console.log(chalk.bold.blue(`\n══ ${text} ══`));
    logEmitter.emit('log', { level: 'step', text: `--- ${text} ---` });
  },
  raw: (text: string, level: LogLevel = 'info') => {
    console.log(text);
    logEmitter.emit('log', { level, text });
  }
};
