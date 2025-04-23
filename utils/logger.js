/**
 * logger.js
 * Unified logging utility for the application
 */

const fs = require('fs-extra');
const path = require('path');
const { format } = require('util');

// Log levels
const LOG_LEVELS = {
  DEBUG: 0,
  INFO: 1,
  WARN: 2,
  ERROR: 3
};

// Default configuration
const defaultConfig = {
  level: 'INFO',
  logToConsole: true,
  logToFile: true,
  logDir: path.join(process.cwd(), 'logs'),
  logFile: 'depla.log',
  maxLogSize: 10 * 1024 * 1024, // 10 MB
  maxLogFiles: 5
};

// Current configuration
let config = { ...defaultConfig };

// Ensure log directory exists
if (config.logToFile) {
  fs.ensureDirSync(config.logDir);
}

/**
 * Format a log message
 * @param {string} level - Log level
 * @param {string} message - Log message
 * @param {Object} [data] - Additional data
 * @returns {string} Formatted log message
 */
function formatLogMessage(level, message, data) {
  const timestamp = new Date().toISOString();
  let formattedMessage = `[${timestamp}] [${level}] ${message}`;
  
  if (data) {
    if (data instanceof Error) {
      formattedMessage += `\\n${data.stack || data.message}`;
    } else if (typeof data === 'object') {
      try {
        formattedMessage += `\\n${JSON.stringify(data, null, 2)}`;
      } catch (error) {
        formattedMessage += `\\n[Object]`;
      }
    } else {
      formattedMessage += `\\n${data}`;
    }
  }
  
  return formattedMessage;
}

/**
 * Write a log message to file
 * @param {string} message - Log message
 */
function writeToFile(message) {
  if (!config.logToFile) return;
  
  const logFilePath = path.join(config.logDir, config.logFile);
  
  try {
    // Check if log file exists and is too large
    if (fs.existsSync(logFilePath)) {
      const stats = fs.statSync(logFilePath);
      
      if (stats.size >= config.maxLogSize) {
        // Rotate log files
        for (let i = config.maxLogFiles - 1; i > 0; i--) {
          const oldFile = path.join(config.logDir, `${config.logFile}.${i}`);
          const newFile = path.join(config.logDir, `${config.logFile}.${i + 1}`);
          
          if (fs.existsSync(oldFile)) {
            fs.renameSync(oldFile, newFile);
          }
        }
        
        // Rename current log file
        fs.renameSync(
          logFilePath,
          path.join(config.logDir, `${config.logFile}.1`)
        );
      }
    }
    
    // Append to log file
    fs.appendFileSync(logFilePath, message + '\\n');
  } catch (error) {
    console.error(`Failed to write to log file: ${error.message}`);
  }
}

/**
 * Log a message
 * @param {string} level - Log level
 * @param {string} message - Log message
 * @param {Object} [data] - Additional data
 */
function log(level, message, data) {
  const logLevel = LOG_LEVELS[level];
  const configLevel = LOG_LEVELS[config.level];
  
  if (logLevel < configLevel) return;
  
  const formattedMessage = formatLogMessage(level, message, data);
  
  // Log to console
  if (config.logToConsole) {
    const consoleMethod = level === 'ERROR' ? 'error' : level === 'WARN' ? 'warn' : 'log';
    console[consoleMethod](formattedMessage);
  }
  
  // Log to file
  writeToFile(formattedMessage);
}

/**
 * Configure the logger
 * @param {Object} newConfig - New configuration
 */
function configure(newConfig) {
  config = { ...config, ...newConfig };
  
  // Ensure log directory exists
  if (config.logToFile) {
    fs.ensureDirSync(config.logDir);
  }
}

/**
 * Log a debug message
 * @param {string} message - Log message
 * @param {Object} [data] - Additional data
 */
function debug(message, data) {
  log('DEBUG', message, data);
}

/**
 * Log an info message
 * @param {string} message - Log message
 * @param {Object} [data] - Additional data
 */
function info(message, data) {
  log('INFO', message, data);
}

/**
 * Log a warning message
 * @param {string} message - Log message
 * @param {Object} [data] - Additional data
 */
function warn(message, data) {
  log('WARN', message, data);
}

/**
 * Log an error message
 * @param {string} message - Log message
 * @param {Object} [data] - Additional data
 */
function error(message, data) {
  log('ERROR', message, data);
}

/**
 * Log an error with stack trace
 * @param {string} message - Log message
 * @param {Error} error - Error object
 */
function logError(message, error) {
  log('ERROR', message, error);
}

module.exports = {
  configure,
  debug,
  info,
  warn,
  error,
  logError
};