import * as Joi from 'joi';

export interface EnvConfig {
  DATABASE_URL: string;
  REDIS_URL: string;
  PORT: number;
  NODE_ENV: 'development' | 'production' | 'test';
  DISCORD_BOT_TOKEN?: string;
  DISCORD_CLIENT_ID?: string;
  AI_SERVICE_URL?: string;
}

const baseSchema = Joi.object({
  DATABASE_URL: Joi.string().uri().required().messages({
    'string.uri': 'DATABASE_URL must be a valid URL',
    'any.required': 'DATABASE_URL is required',
  }),
  REDIS_URL: Joi.string().uri().required().messages({
    'string.uri': 'REDIS_URL must be a valid URL',
    'any.required': 'REDIS_URL is required',
  }),
  PORT: Joi.number().default(4000),
  NODE_ENV: Joi.string().valid('development', 'production', 'test').default('development'),
  DISCORD_BOT_TOKEN: Joi.string().allow(''),
  DISCORD_CLIENT_ID: Joi.string().allow(''),
  AI_SERVICE_URL: Joi.string().uri().allow(''),
});

const productionSchema = baseSchema.keys({
  DISCORD_BOT_TOKEN: Joi.string().min(1).required().messages({
    'any.required': 'DISCORD_BOT_TOKEN is required in production',
    'string.min': 'DISCORD_BOT_TOKEN must not be empty in production',
  }),
  DISCORD_CLIENT_ID: Joi.string().min(1).required().messages({
    'any.required': 'DISCORD_CLIENT_ID is required in production',
    'string.min': 'DISCORD_CLIENT_ID must not be empty in production',
  }),
  AI_SERVICE_URL: Joi.string().uri().required().messages({
    'string.uri': 'AI_SERVICE_URL must be a valid URL',
    'any.required': 'AI_SERVICE_URL is required in production',
  }),
});

export function validateEnv(config: Record<string, unknown>): EnvConfig {
  const nodeEnv = (config.NODE_ENV ?? 'development') as string;
  const schema = nodeEnv === 'production' ? productionSchema : baseSchema;

  const { error, value } = schema.validate(config, {
    allowUnknown: true,
    stripUnknown: true,
    abortEarly: false,
  });

  if (error) {
    const messages = error.details.map((d) => d.message).join('; ');
    throw new Error(`Environment validation failed: ${messages}`);
  }

  const result = value as EnvConfig;
  result.PORT = Number(result.PORT) || 4000;

  if (nodeEnv !== 'production') {
    const missing: string[] = [];
    if (!result.DISCORD_BOT_TOKEN?.trim()) missing.push('DISCORD_BOT_TOKEN');
    if (!result.DISCORD_CLIENT_ID?.trim()) missing.push('DISCORD_CLIENT_ID');
    if (!result.AI_SERVICE_URL?.trim()) missing.push('AI_SERVICE_URL');
    if (missing.length > 0) {
      console.warn(
        `[Config] Warning: optional env vars missing in ${nodeEnv}: ${missing.join(', ')}. App will start but Discord/AI features may not work.`,
      );
    }
  }

  return result;
}
