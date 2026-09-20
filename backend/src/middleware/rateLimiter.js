import rateLimit from 'express-rate-limit'

export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { error: 'Too many auth attempts. Try again in 15 minutes.' },
  standardHeaders: true,
  legacyHeaders: false
})

export const aiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  message: { error: 'AI query rate limit exceeded. Max 10 requests per minute.' },
  standardHeaders: true,
  legacyHeaders: false
})
