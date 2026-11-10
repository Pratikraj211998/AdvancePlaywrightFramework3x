import winston from 'winston';

const { combine, timestamp, printf, colorize } = winston.format;

const logFormat = printf(({ level, message, timestamp: ts, label }) => {
    return `${ts} [${label}] ${level}: ${message}`;
});

export function createLogger(label: string): winston.Logger {
    return winston.createLogger({
        level: process.env.LOG_LEVEL ?? 'info',
        format: combine(
            winston.format.label({ label }),
            timestamp({ format: 'HH:mm:ss' }),
            logFormat,
        ),
        transports: [
            new winston.transports.Console({
                format: combine(colorize(), winston.format.label({ label }), timestamp({ format: 'HH:mm:ss' }), logFormat),
            }),
            new winston.transports.File({ filename: 'reports/framework.log' }),
        ],
    });
}
