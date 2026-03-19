import winston from 'winston';
import 'winston-daily-rotate-file';

// Configured for 10 file rotation constraint and zipped archives (.gz natively acts like .tgz for Node streams)
const transport = new winston.transports.DailyRotateFile({
  filename: 'logs/application-%DATE%.log',
  datePattern: 'YYYY-MM-DD',
  zippedArchive: true, 
  maxSize: '20m',      
  maxFiles: '10d'      
});

transport.on('rotate', function(oldFilename, newFilename) {
  // Callback for log rotation
});

export const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    transport,
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      )
    })
  ]
});
