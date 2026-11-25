import { Router } from 'express';
import { z } from 'zod';
import rateLimit from 'express-rate-limit';
import { whatsappService } from '../services/whatsapp.js';

export const whatsappRouter = Router();

const pairingLimiter = rateLimit({
  windowMs: 60_000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many pairing requests. Please wait a moment.' },
});

const connectSchema = z.object({
  phoneNumber: z.string().min(6).max(20).regex(/^[0-9+\-\s()]+$/, 'Invalid phone number format'),
});

function normalizePhone(input: string): string {
  // Keep digits only; user should include country code.
  return input.replace(/[^0-9]/g, '');
}

whatsappRouter.get('/status', async (_req, res, next) => {
  try {
    const health = await whatsappService.getConnectionHealth();
    res.json(health);
  } catch (e) { next(e); }
});

whatsappRouter.post('/connect', pairingLimiter, async (req, res, next) => {
  try {
    const parsed = connectSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Invalid phone number', details: parsed.error.flatten() });
    }
    const phoneNumber = normalizePhone(parsed.data.phoneNumber);
    if (phoneNumber.length < 8 || phoneNumber.length > 15) {
      return res.status(400).json({ error: 'Phone number must include country code and be 8-15 digits.' });
    }
    const result = await whatsappService.connect(phoneNumber);
    res.json({ ok: true, ...result, state: whatsappService.getState() });
  } catch (e: any) {
    next(e);
  }
});

whatsappRouter.post('/reconnect', pairingLimiter, async (_req, res, next) => {
  try {
    const state = whatsappService.getState();
    const result = await whatsappService.connect(state.phoneNumber || undefined);
    res.json({ ok: true, ...result, state: whatsappService.getState() });
  } catch (e) { next(e); }
});

whatsappRouter.post('/disconnect', async (_req, res, next) => {
  try {
    await whatsappService.disconnect();
    res.json({ ok: true, state: whatsappService.getState() });
  } catch (e) { next(e); }
});

whatsappRouter.delete('/session', async (_req, res, next) => {
  try {
    await whatsappService.deleteSession();
    res.json({ ok: true, state: whatsappService.getState() });
  } catch (e) { next(e); }
});
