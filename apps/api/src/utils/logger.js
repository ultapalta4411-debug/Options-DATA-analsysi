function formatMessage(level, ...args) {
  const timestamp = new Date().toISOString();
  const message = args.map((arg) => {
    if (arg instanceof Error) {
      return arg.stack || arg.message;
    }
    if (typeof arg === 'object') {
      try {
        return JSON.stringify(arg);
      } catch {
        return String(arg);
      }
    }
    return String(arg);
  }).join(' ');
  return `[${timestamp}] [${level.toUpperCase()}] ${message}`;
}

const logger = {
  info(...args) {
    console.log(formatMessage('info', ...args));
  },
  warn(...args) {
    console.warn(formatMessage('warn', ...args));
  },
  error(...args) {
    console.error(formatMessage('error', ...args));
  },
  debug(...args) {
    if (process.env.DEBUG === 'true' || process.env.DEBUG === '1') {
      console.debug(formatMessage('debug', ...args));
    }
  },
};

export default logger;
