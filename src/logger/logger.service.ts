import { Injectable, LoggerService } from "@nestjs/common";
import { createLogger, format, transports, Logger } from "winston";
import { ConfigService } from "@nestjs/config";

@Injectable()
export class CustomLogger implements LoggerService {
  private context?: string;
  private logger: Logger;

  constructor(private configService: ConfigService) {
    const customStringify = (obj: any) => {
      if (!obj) return "";
      const seen = new WeakSet();
      return JSON.stringify(
        obj,
        (key, value) => {
          if (typeof value === "object" && value !== null) {
            if (seen.has(value)) {
              return "[Circular]";
            }
            seen.add(value);
          }
          return value;
        },
        2
      );
    };

    this.logger = createLogger({
      level: this.configService.get("LOG_LEVEL") || "info",
      format: format.combine(
        format.timestamp(),
        format.ms(),
        format.errors({ stack: true }),
        format.json()
      ),
      defaultMeta: { service: "post-service" },
      transports: [
        new transports.Console({
          format: format.combine(
            format.colorize(),
            format.printf(
              ({ timestamp, level, message, context, ms, ...meta }) => {
                // Remove the array-like keys from meta
                const cleanMeta = Object.fromEntries(
                  Object.entries(meta).filter(([key]) => !/^\d+$/.test(key))
                );

                const metaString = Object.keys(cleanMeta).length
                  ? `\n${customStringify(cleanMeta)}`
                  : "";

                return `${timestamp} [${level}] ${context ? `[${context}] ` : ""}${message}${metaString} ${ms}`;
              }
            )
          ),
        }),
        new transports.File({
          filename: "logs/error.log",
          level: "error",
          format: format.combine(format.timestamp(), format.json()),
        }),
        new transports.File({
          filename: "logs/combined.log",
          format: format.combine(format.timestamp(), format.json()),
        }),
      ],
    });
  }

  setContext(context: string) {
    this.context = context;
  }

  log(message: string, meta?: any) {
    this.logger.info(message, { context: this.context, ...meta });
  }

  error(message: string, trace?: string, meta?: any) {
    this.logger.error(message, { context: this.context, trace, ...meta });
  }

  warn(message: string, meta?: any) {
    this.logger.warn(message, { context: this.context, ...meta });
  }

  debug(message: string, meta?: any) {
    this.logger.debug(message, { context: this.context, ...meta });
  }

  verbose(message: string, meta?: any) {
    this.logger.verbose(message, { context: this.context, ...meta });
  }
}
