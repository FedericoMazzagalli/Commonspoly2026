import process from "node:process";
import 'dotenv/config';
import http from 'node:http';
import express from 'express';
import type { Request, Response } from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { GoogleGenAI, ThinkingLevel, Type } from '@google/genai';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT) || 3000;
const MODEL_NAME = 'gemini-4-hydrogen';
const MODEL_TTS = 'gemini-3.8-flash-lite-tts';
const ALLOWED_TTS_VOICES = new Set(['Puck', 'Charon', 'Kore', 'Fenrir', 'Zephyr']);

interface TutorialTtsRequestBody {
  text: string;
  voiceName?: string;
  style?: string;
  lang?: string;
}

interface MeteorologicalInsightRequestBody {
  round: number;
  phase: string;
  activePlayer: {
    name: string;
    wellness: number;
    legitimacy: number;
    positionName: string;
    inAgora: boolean;
    skills: {
      care: number;
      occupy: number;
      share: number;
      regenerate: number;
    };
  };
  collectiveLegitimacy: number;
  requiredLegitimacyForAgora: number;
  currentWeather: {
    type: string;
    mode: string;
    intensity: number;
    label: string;
    description: string;
    envCommonCount: number;
    envPublicCount: number;
    envPrivateCount: number;
    totalEnvTiles: number;
  };
  forecast: Array<{
    turnOffset: number;
    round: number;
    weatherType: string;
    label: string;
    intensity: number;
    situationSuccessPercent: number;
  }>;
  resourceBreakdown: Array<{
    category: string;
    common: number;
    publicCount: number;
    privateCount: number;
    total: number;
    priorityPrivateNames: string[];
  }>;
  neighborhoodDecision: {
    title: string;
    description: string;
    targetTileNames: string[];
    votesCastCount: number;
    totalPlayers: number;
    rewardSummary: string;
  } | null;
  currentGlobalCard: {
    title: string;
    description: string;
  } | null;
  activeCrisis?: {
    title: string;
    affectedGoodType: string;
    unlockCostDelta: number;
    commonYieldDelta: number;
    turnsRemaining: number;
  } | null;
  recentLogs: Array<{
    round: number;
    actor: string;
    type: string;
    message: string;
  }>;
}

function getGenAIClient(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') {
    return null;
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build'
      }
    }
  });
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function extractStatusCode(err: unknown): number {
  if (err && typeof err === 'object') {
    const maybe = err as { status?: number; statusCode?: number; code?: number };
    if (typeof maybe.status === 'number') return maybe.status;
    if (typeof maybe.statusCode === 'number') return maybe.statusCode;
    if (typeof maybe.code === 'number') return maybe.code;
  }
  return 500;
}

async function generateInsightWithRetry(
  ai: GoogleGenAI,
  prompt: string
): Promise<string> {
  let lastError: unknown;
  const maxAttempts = 3;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const response = await ai.models.generateContent({
        model: MODEL_NAME,
        contents: prompt,
        config: {
          systemInstruction:
            'Eres el Observatorio Meteorológico Estratégico de Commonspoly (Edición Verde). ' +
            'Analizas el estado actual del tablero, los registros recientes de turnos y la previsión climática. ' +
            'Reglas de juego clave: en climas favorables (RAIN, SUNNY, TEMPERATE) las Cartas de Situación tienen 92% de éxito; ' +
            'en climas adversos (SNOW, DROUGHT) el éxito cae al 68%. Comunalizar casillas de Medioambiente (ENVIRONMENT) estabiliza el clima hacia lluvia/sol en modo AUTO; ' +
            'si hay 4 o más casillas ambientales privadas, el clima deriva a Sequía Extrema o Nevada. ' +
            'Las Decisiones Barriales in-situ requieren mover peones a las casillas objetivo antes de votar. ' +
            'Responde siempre en español claro, conciso y accionable usando exclusivamente los datos proporcionados.',
          thinkingConfig: {
            thinkingLevel: ThinkingLevel.LOW
          },
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              headline: {
                type: Type.STRING,
                description: 'Titular táctico breve (máximo 12 palabras) resumiendo el panorama climático y estratégico.'
              },
              riskLevel: {
                type: Type.STRING,
                description: 'Uno de exactamente estos valores: FAVORABLE, PRECAUCIÓN, CRÍTICO.'
              },
              forecastSummary: {
                type: Type.STRING,
                description: 'Análisis de 2-3 frases explicando cómo el pronóstico de los próximos turnos afecta las probabilidades de éxito y el clima ecológico.'
              },
              prioritizedResources: {
                type: Type.ARRAY,
                description: 'Lista de 2 a 3 recursos o categorías concretas del tablero que conviene priorizar ahora.',
                items: {
                  type: Type.OBJECT,
                  properties: {
                    target: {
                      type: Type.STRING,
                      description: 'Nombre de la casilla o categoría de recurso (p. ej. Medioambiente / Bosque).'
                    },
                    action: {
                      type: Type.STRING,
                      description: 'Acción recomendada: Comunizar, Proteger o Desbloquear.'
                    },
                    reason: {
                      type: Type.STRING,
                      description: 'Justificación breve ligada al clima y al historial reciente.'
                    }
                  }
                }
              },
              neighborhoodAdvice: {
                type: Type.STRING,
                description: 'Consejo específico sobre Decisiones Barriales in-situ o posicionamiento cooperativo en el tablero según el clima.'
              },
              nextTurnAction: {
                type: Type.STRING,
                description: 'Acción inmediata sugerida en 1 frase para el jugador activo.'
              }
            }
          }
        }
      });

      const text = response.text;
      if (!text) {
        throw new Error('Gemini devolvió una respuesta vacía.');
      }
      return text;
    } catch (err) {
      lastError = err;
      const status = extractStatusCode(err);
      const isRetryable = status === 429 || status >= 500;
      if (!isRetryable || attempt === maxAttempts) {
        throw err;
      }
      await sleep(350 * Math.pow(2, attempt - 1));
    }
  }

  throw lastError;
}

async function generateSpeechWithRetry(
  ai: GoogleGenAI,
  params: {
    text: string;
    voiceName: string;
    style: string;
  }
): Promise<string> {
  let lastError: unknown;
  const maxAttempts = 3;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const response = await ai.models.generateContent({
        model: MODEL_TTS,
        contents: [
          {
            role: 'user',
            parts: [
              {
                text: params.text,
                speechMetadata: {
                  style: params.style
                }
              }
            ]
          }
        ],
        config: {
          responseModalities: ['AUDIO'],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: {
                voiceName: params.voiceName
              }
            }
          }
        }
      });

      const parts = response.candidates?.[0]?.content?.parts ?? [];
      const base64Audio = parts.find(part => part.inlineData?.data)?.inlineData?.data;
      if (!base64Audio) {
        throw new Error('Gemini TTS no devolvió audio WAV.');
      }
      return base64Audio;
    } catch (err) {
      lastError = err;
      const status = extractStatusCode(err);
      const isRetryable = status === 429 || status >= 500;
      if (!isRetryable || attempt === maxAttempts) {
        throw err;
      }
      await sleep(350 * Math.pow(2, attempt - 1));
    }
  }

  throw lastError;
}

async function startServer() {
  const app = express();
  const httpServer = http.createServer(app);
  app.use(express.json({ limit: '1mb' }));

  app.post('/api/meteorological-insight', async (req: Request, res: Response) => {
    const body = req.body as Partial<MeteorologicalInsightRequestBody> | undefined;
    if (!body || !body.currentWeather || !body.activePlayer) {
      res.status(400).json({
        error: 'Faltan datos del estado de la partida o del clima para generar el análisis.'
      });
      return;
    }

    const ai = getGenAIClient();
    if (!ai) {
      res.status(503).json({
        error:
          'No se encontró GEMINI_API_KEY en el servidor. Configura tu clave en el panel Settings > Secrets para activar Meteorological Insight.'
      });
      return;
    }

    const promptPayload = {
      ronda: `${body.round ?? 1}/20`,
      fase: body.phase,
      jugadorActivo: body.activePlayer,
      legitimidadColectiva: `${body.collectiveLegitimacy}/${body.requiredLegitimacyForAgora}`,
      climaActual: body.currentWeather,
      pronosticoProximosTurnos: body.forecast ?? [],
      estadoRecursos: body.resourceBreakdown ?? [],
      decisionBarrialActiva: body.neighborhoodDecision ?? null,
      cartaGlobalVigente: body.currentGlobalCard ?? null,
      crisisInesperadaActiva: body.activeCrisis ?? null,
      registrosRecientes: (body.recentLogs ?? []).slice(0, 12)
    };

    const prompt =
      'Analiza el siguiente estado de partida de Commonspoly, su pronóstico meteorológico y los registros recientes de turnos para emitir un parte estratégico:\n' +
      JSON.stringify(promptPayload, null, 2);

    try {
      const rawJson = await generateInsightWithRetry(ai, prompt);
      const parsed = JSON.parse(rawJson);
      res.json({
        insight: parsed,
        model: MODEL_NAME,
        generatedAt: new Date().toISOString()
      });
    } catch (err) {
      const status = extractStatusCode(err);
      const message =
        err instanceof Error ? err.message : 'Error inesperado al consultar Gemini.';

      if (status === 400 || status === 403) {
        res.status(status).json({
          error:
            'La clave de Gemini no es válida o no tiene permisos. Verifica GEMINI_API_KEY en Settings > Secrets.',
          details: message
        });
        return;
      }

      if (status === 429) {
        res.status(429).json({
          error:
            'Límite de peticiones alcanzado al consultar Gemini. Intenta de nuevo en unos segundos o revisa la cuota en Settings > Secrets.',
          details: message
        });
        return;
      }

      res.status(502).json({
        error: 'No se pudo completar el análisis meteorológico con Gemini.',
        details: message
      });
    }
  });

  app.post('/api/tutorial-tts', async (req: Request, res: Response) => {
    const body = req.body as Partial<TutorialTtsRequestBody> | undefined;
    const rawText = typeof body?.text === 'string' ? body.text.trim() : '';

    if (!rawText) {
      res.status(400).json({
        error: 'Falta el texto a narrar.',
        fallbackRecommended: false
      });
      return;
    }

    if (rawText.length > 1800) {
      res.status(400).json({
        error: 'El texto de narración excede el máximo permitido (1800 caracteres).',
        fallbackRecommended: false
      });
      return;
    }

    const ai = getGenAIClient();
    if (!ai) {
      res.status(503).json({
        error:
          'GEMINI_API_KEY no configurada en el servidor; usando voz mejorada del sistema.',
        fallbackRecommended: true
      });
      return;
    }

    const requestedVoice = typeof body?.voiceName === 'string' ? body.voiceName.trim() : '';
    const voiceName = ALLOWED_TTS_VOICES.has(requestedVoice) ? requestedVoice : 'Kore';
    const rawStyle = typeof body?.style === 'string' ? body.style.trim().slice(0, 280) : '';
    const langHint = typeof body?.lang === 'string' && body.lang.trim() ? body.lang.trim() : 'es';
    const style =
      rawStyle ||
      `Natural, warm, expressive, conversational human narrator speaking ${langHint} with clear diction and gentle pauses.`;

    try {
      const audioBase64 = await generateSpeechWithRetry(ai, {
        text: rawText,
        voiceName,
        style
      });

      res.json({
        audioBase64,
        mimeType: 'audio/wav',
        model: MODEL_TTS,
        voiceName
      });
    } catch (err) {
      const status = extractStatusCode(err);
      const message =
        err instanceof Error ? err.message : 'Error inesperado al generar voz con Gemini.';

      if (status === 400 || status === 403) {
        res.status(status).json({
          error:
            'La clave de Gemini no es válida o no tiene permisos para generar voz neural.',
          details: message,
          fallbackRecommended: true
        });
        return;
      }

      if (status === 429) {
        res.status(429).json({
          error: 'Límite temporal de peticiones de voz alcanzado. Usando voz del sistema.',
          details: message,
          fallbackRecommended: true
        });
        return;
      }

      res.status(502).json({
        error: 'No se pudo sintetizar la voz neural con Gemini.',
        details: message,
        fallbackRecommended: true
      });
    }
  });

  if (process.env.NODE_ENV === 'production') {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  } else {
    const { createServer: createViteServer } = await import('vite');
    const hmrDisabled = process.env.DISABLE_HMR === 'true';
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        allowedHosts: true,
        hmr: hmrDisabled ? false : { server: httpServer },
        ws: { server: httpServer }
      },
      appType: 'spa'
    });
    app.use(vite.middlewares);
  }

  httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`Commonspoly server running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch(err => {
  console.error('Failed to start Commonspoly server:', err);
  process.exit(1);
});
