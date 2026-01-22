import { dividePrice } from 'iso-price';
import type { BrainSpec } from 'rhachet';

/**
 * .what = supported openai brain atom slugs
 * .why = enables type-safe slug specification with model variants
 */
export type OpenaiBrainAtomSlug =
  // gpt-4 family
  | 'openai/gpt/4o'
  | 'openai/gpt/4o-mini'
  | 'openai/gpt/4-turbo'
  // gpt-4.1 family
  | 'openai/gpt/4.1'
  | 'openai/gpt/4.1-mini'
  | 'openai/gpt/4.1-nano'
  // o1 family
  | 'openai/o/1'
  | 'openai/o/1-mini'
  | 'openai/o/1-preview'
  // o3 family
  | 'openai/o/3'
  | 'openai/o/3-mini'
  | 'openai/o/3-pro'
  // o4 family
  | 'openai/o/4-mini'
  // gpt-5 family
  | 'openai/gpt/5'
  | 'openai/gpt/5-mini'
  | 'openai/gpt/5-pro'
  | 'openai/gpt/5-thoughtful'
  | 'openai/gpt/5-thoughtful-mini'
  // gpt-5.1 family
  | 'openai/gpt/5.1-instant'
  | 'openai/gpt/5.1-thoughtful'
  // gpt-5.2 family
  | 'openai/gpt/5.2-instant'
  | 'openai/gpt/5.2-pro'
  | 'openai/gpt/5.2-thoughtful'
  // codex family (agentic code via codex sdk)
  | 'openai/gpt/codex/5.1-max'
  | 'openai/gpt/codex/5.1-mini'
  | 'openai/gpt/codex/5.2';

/**
 * .what = atom config type
 * .why = shared type for model configs
 */
export type BrainAtomConfig = {
  model: string;
  description: string;
  spec: BrainSpec;
};

/**
 * .what = brain spec configuration by atom slug
 * .why = maps slugs to api model names, descriptions, and specs
 *
 * .refs
 *   - https://openai.com/api/pricing/
 *   - https://platform.openai.com/docs/models
 *   - https://platform.openai.com/docs/api-reference/responses
 */
export const CONFIG_BY_ATOM_SLUG: Record<OpenaiBrainAtomSlug, BrainAtomConfig> =
  {
    // =========================================================================
    // gpt-4 family
    // =========================================================================
    'openai/gpt/4o': {
      model: 'gpt-4o',
      description: 'gpt-4o - multimodal model for reason and vision',
      spec: {
        cost: {
          time: {
            speed: { tokens: 100, per: { seconds: 1 } },
            latency: { milliseconds: 500 },
          },
          cash: {
            per: 'token',
            cache: {
              get: dividePrice({ of: '$1.25', by: 1_000_000 }),
              set: dividePrice({ of: '$2.50', by: 1_000_000 }),
            },
            input: dividePrice({ of: '$2.50', by: 1_000_000 }),
            output: dividePrice({ of: '$10.00', by: 1_000_000 }),
          },
        },
        gain: {
          size: { context: { tokens: 128_000 } },
          grades: { swe: 33.2, mmlu: 88.7, humaneval: 90.2 },
          cutoff: '2023-10-01',
          domain: 'ALL',
          skills: { tooluse: true, vision: true },
        },
      },
    },
    'openai/gpt/4o-mini': {
      model: 'gpt-4o-mini',
      description: 'gpt-4o-mini - fast and cost-effective multimodal model',
      spec: {
        cost: {
          time: {
            speed: { tokens: 150, per: { seconds: 1 } },
            latency: { milliseconds: 300 },
          },
          cash: {
            per: 'token',
            cache: {
              get: dividePrice({ of: '$0.075', by: 1_000_000 }),
              set: dividePrice({ of: '$0.15', by: 1_000_000 }),
            },
            input: dividePrice({ of: '$0.15', by: 1_000_000 }),
            output: dividePrice({ of: '$0.60', by: 1_000_000 }),
          },
        },
        gain: {
          size: { context: { tokens: 128_000 } },
          grades: { mmlu: 82.0, humaneval: 87.0 },
          cutoff: '2023-10-01',
          domain: 'ALL',
          skills: { tooluse: true, vision: true },
        },
      },
    },
    'openai/gpt/4-turbo': {
      model: 'gpt-4-turbo',
      description: 'gpt-4-turbo - high capability with vision support',
      spec: {
        cost: {
          time: {
            speed: { tokens: 80, per: { seconds: 1 } },
            latency: { milliseconds: 600 },
          },
          cash: {
            per: 'token',
            cache: {
              get: dividePrice({ of: '$5.00', by: 1_000_000 }),
              set: dividePrice({ of: '$10.00', by: 1_000_000 }),
            },
            input: dividePrice({ of: '$10.00', by: 1_000_000 }),
            output: dividePrice({ of: '$30.00', by: 1_000_000 }),
          },
        },
        gain: {
          size: { context: { tokens: 128_000 } },
          grades: { mmlu: 86.4, humaneval: 87.1 },
          cutoff: '2023-12-01',
          domain: 'ALL',
          skills: { tooluse: true, vision: true },
        },
      },
    },

    // =========================================================================
    // gpt-4.1 family (april 2025)
    // =========================================================================
    'openai/gpt/4.1': {
      model: 'gpt-4.1',
      description: 'gpt-4.1 - 1M context with improved instruction follow',
      spec: {
        cost: {
          time: {
            speed: { tokens: 100, per: { seconds: 1 } },
            latency: { milliseconds: 400 },
          },
          cash: {
            per: 'token',
            cache: {
              get: dividePrice({ of: '$0.50', by: 1_000_000 }),
              set: dividePrice({ of: '$2.00', by: 1_000_000 }),
            },
            input: dividePrice({ of: '$2.00', by: 1_000_000 }),
            output: dividePrice({ of: '$8.00', by: 1_000_000 }),
          },
        },
        gain: {
          size: { context: { tokens: 1_000_000 } },
          grades: {},
          cutoff: '2024-06-01',
          domain: 'ALL',
          skills: { tooluse: true, vision: true },
        },
      },
    },
    'openai/gpt/4.1-mini': {
      model: 'gpt-4.1-mini',
      description: 'gpt-4.1-mini - fast and cost-effective',
      spec: {
        cost: {
          time: {
            speed: { tokens: 150, per: { seconds: 1 } },
            latency: { milliseconds: 250 },
          },
          cash: {
            per: 'token',
            cache: {
              get: dividePrice({ of: '$0.10', by: 1_000_000 }),
              set: dividePrice({ of: '$0.40', by: 1_000_000 }),
            },
            input: dividePrice({ of: '$0.40', by: 1_000_000 }),
            output: dividePrice({ of: '$1.60', by: 1_000_000 }),
          },
        },
        gain: {
          size: { context: { tokens: 128_000 } },
          grades: {},
          cutoff: '2024-06-01',
          domain: 'ALL',
          skills: { tooluse: true, vision: true },
        },
      },
    },
    'openai/gpt/4.1-nano': {
      model: 'gpt-4.1-nano',
      description: 'gpt-4.1-nano - ultra low cost for simple tasks',
      spec: {
        cost: {
          time: {
            speed: { tokens: 200, per: { seconds: 1 } },
            latency: { milliseconds: 150 },
          },
          cash: {
            per: 'token',
            cache: {
              get: dividePrice({ of: '$0.025', by: 1_000_000 }),
              set: dividePrice({ of: '$0.10', by: 1_000_000 }),
            },
            input: dividePrice({ of: '$0.10', by: 1_000_000 }),
            output: dividePrice({ of: '$0.40', by: 1_000_000 }),
          },
        },
        gain: {
          size: { context: { tokens: 1_000_000 } },
          grades: {},
          cutoff: '2024-06-01',
          domain: 'ALL',
          skills: { tooluse: true },
        },
      },
    },

    // =========================================================================
    // o1 family
    // =========================================================================
    'openai/o/1': {
      model: 'o1',
      description: 'o1 - advanced reason model for complex problems',
      spec: {
        cost: {
          time: {
            speed: { tokens: 50, per: { seconds: 1 } },
            latency: { seconds: 2 },
          },
          cash: {
            per: 'token',
            cache: {
              get: dividePrice({ of: '$7.50', by: 1_000_000 }),
              set: dividePrice({ of: '$15.00', by: 1_000_000 }),
            },
            input: dividePrice({ of: '$15.00', by: 1_000_000 }),
            output: dividePrice({ of: '$60.00', by: 1_000_000 }),
          },
        },
        gain: {
          size: { context: { tokens: 200_000 } },
          grades: { swe: 48.9, mmlu: 92.3, humaneval: 94.8 },
          cutoff: '2023-10-01',
          domain: 'ALL',
          skills: { tooluse: true, vision: true },
        },
      },
    },
    'openai/o/1-mini': {
      model: 'o1-mini',
      description: 'o1-mini - fast reason model for code and math',
      spec: {
        cost: {
          time: {
            speed: { tokens: 80, per: { seconds: 1 } },
            latency: { seconds: 1 },
          },
          cash: {
            per: 'token',
            cache: {
              get: dividePrice({ of: '$1.50', by: 1_000_000 }),
              set: dividePrice({ of: '$3.00', by: 1_000_000 }),
            },
            input: dividePrice({ of: '$3.00', by: 1_000_000 }),
            output: dividePrice({ of: '$12.00', by: 1_000_000 }),
          },
        },
        gain: {
          size: { context: { tokens: 128_000 } },
          grades: { humaneval: 92.4 },
          cutoff: '2023-10-01',
          domain: 'ALL',
          skills: { tooluse: true },
        },
      },
    },
    'openai/o/1-preview': {
      model: 'o1-preview',
      description: 'o1-preview - preview of advanced reason capabilities',
      spec: {
        cost: {
          time: {
            speed: { tokens: 40, per: { seconds: 1 } },
            latency: { seconds: 3 },
          },
          cash: {
            per: 'token',
            cache: {
              get: dividePrice({ of: '$7.50', by: 1_000_000 }),
              set: dividePrice({ of: '$15.00', by: 1_000_000 }),
            },
            input: dividePrice({ of: '$15.00', by: 1_000_000 }),
            output: dividePrice({ of: '$60.00', by: 1_000_000 }),
          },
        },
        gain: {
          size: { context: { tokens: 128_000 } },
          grades: { mmlu: 90.8 },
          cutoff: '2023-10-01',
          domain: 'ALL',
          skills: { tooluse: true },
        },
      },
    },

    // =========================================================================
    // o3 family (april 2025)
    // =========================================================================
    'openai/o/3': {
      model: 'o3',
      description: 'o3 - frontier reason model for code, math, science',
      spec: {
        cost: {
          time: {
            speed: { tokens: 60, per: { seconds: 1 } },
            latency: { seconds: 2 },
          },
          cash: {
            per: 'token',
            cache: {
              get: dividePrice({ of: '$0.10', by: 1_000_000 }),
              set: dividePrice({ of: '$0.40', by: 1_000_000 }),
            },
            input: dividePrice({ of: '$0.40', by: 1_000_000 }),
            output: dividePrice({ of: '$1.60', by: 1_000_000 }),
          },
        },
        gain: {
          size: { context: { tokens: 200_000 } },
          grades: {},
          cutoff: '2024-06-01',
          domain: 'ALL',
          skills: { tooluse: true, vision: true },
        },
      },
    },
    'openai/o/3-mini': {
      model: 'o3-mini',
      description: 'o3-mini - fast reason for code and math',
      spec: {
        cost: {
          time: {
            speed: { tokens: 100, per: { seconds: 1 } },
            latency: { seconds: 1 },
          },
          cash: {
            per: 'token',
            cache: {
              get: dividePrice({ of: '$0.275', by: 1_000_000 }),
              set: dividePrice({ of: '$1.10', by: 1_000_000 }),
            },
            input: dividePrice({ of: '$1.10', by: 1_000_000 }),
            output: dividePrice({ of: '$4.40', by: 1_000_000 }),
          },
        },
        gain: {
          size: { context: { tokens: 200_000 } },
          grades: {},
          cutoff: '2024-06-01',
          domain: 'ALL',
          skills: { tooluse: true },
        },
      },
    },
    'openai/o/3-pro': {
      model: 'o3-pro',
      description: 'o3-pro - highest tier with extended compute',
      spec: {
        cost: {
          time: {
            speed: { tokens: 30, per: { seconds: 1 } },
            latency: { seconds: 5 },
          },
          cash: {
            per: 'token',
            cache: {
              get: dividePrice({ of: '$5.00', by: 1_000_000 }),
              set: dividePrice({ of: '$20.00', by: 1_000_000 }),
            },
            input: dividePrice({ of: '$20.00', by: 1_000_000 }),
            output: dividePrice({ of: '$80.00', by: 1_000_000 }),
          },
        },
        gain: {
          size: { context: { tokens: 200_000 } },
          grades: {},
          cutoff: '2024-06-01',
          domain: 'ALL',
          skills: { tooluse: true, vision: true },
        },
      },
    },

    // =========================================================================
    // o4 family (april 2025)
    // =========================================================================
    'openai/o/4-mini': {
      model: 'o4-mini',
      description: 'o4-mini - fast efficient reason model',
      spec: {
        cost: {
          time: {
            speed: { tokens: 100, per: { seconds: 1 } },
            latency: { seconds: 1 },
          },
          cash: {
            per: 'token',
            cache: {
              get: dividePrice({ of: '$0.275', by: 1_000_000 }),
              set: dividePrice({ of: '$1.10', by: 1_000_000 }),
            },
            input: dividePrice({ of: '$1.10', by: 1_000_000 }),
            output: dividePrice({ of: '$4.40', by: 1_000_000 }),
          },
        },
        gain: {
          size: { context: { tokens: 200_000 } },
          grades: {},
          cutoff: '2024-06-01',
          domain: 'ALL',
          skills: { tooluse: true, vision: true },
        },
      },
    },

    // =========================================================================
    // gpt-5 family (august 2025)
    // =========================================================================
    'openai/gpt/5': {
      model: 'gpt-5',
      description: 'gpt-5 - frontier multimodal model',
      spec: {
        cost: {
          time: {
            speed: { tokens: 120, per: { seconds: 1 } },
            latency: { milliseconds: 400 },
          },
          cash: {
            per: 'token',
            cache: {
              get: dividePrice({ of: '$0.125', by: 1_000_000 }),
              set: dividePrice({ of: '$1.25', by: 1_000_000 }),
            },
            input: dividePrice({ of: '$1.25', by: 1_000_000 }),
            output: dividePrice({ of: '$10.00', by: 1_000_000 }),
          },
        },
        gain: {
          size: { context: { tokens: 400_000 } },
          grades: {},
          cutoff: '2024-09-01',
          domain: 'ALL',
          skills: { tooluse: true, vision: true },
        },
      },
    },
    'openai/gpt/5-mini': {
      model: 'gpt-5-mini',
      description: 'gpt-5-mini - fast and cost-effective',
      spec: {
        cost: {
          time: {
            speed: { tokens: 180, per: { seconds: 1 } },
            latency: { milliseconds: 200 },
          },
          cash: {
            per: 'token',
            cache: {
              get: dividePrice({ of: '$0.025', by: 1_000_000 }),
              set: dividePrice({ of: '$0.25', by: 1_000_000 }),
            },
            input: dividePrice({ of: '$0.25', by: 1_000_000 }),
            output: dividePrice({ of: '$2.00', by: 1_000_000 }),
          },
        },
        gain: {
          size: { context: { tokens: 400_000 } },
          grades: {},
          cutoff: '2024-05-01',
          domain: 'ALL',
          skills: { tooluse: true, vision: true },
        },
      },
    },
    'openai/gpt/5-pro': {
      model: 'gpt-5-pro',
      description: 'gpt-5-pro - highest tier with xhigh reason support',
      spec: {
        cost: {
          time: {
            speed: { tokens: 40, per: { seconds: 1 } },
            latency: { seconds: 3 },
          },
          cash: {
            per: 'token',
            cache: {
              get: dividePrice({ of: '$1.50', by: 1_000_000 }),
              set: dividePrice({ of: '$15.00', by: 1_000_000 }),
            },
            input: dividePrice({ of: '$15.00', by: 1_000_000 }),
            output: dividePrice({ of: '$120.00', by: 1_000_000 }),
          },
        },
        gain: {
          size: { context: { tokens: 272_000 } },
          grades: {},
          cutoff: '2024-09-01',
          domain: 'ALL',
          skills: { tooluse: true, vision: true },
        },
      },
    },
    'openai/gpt/5-thoughtful': {
      model: 'gpt-5-thinking',
      description: 'gpt-5-thinking - deep reason for complex problems',
      spec: {
        cost: {
          time: {
            speed: { tokens: 60, per: { seconds: 1 } },
            latency: { seconds: 2 },
          },
          cash: {
            per: 'token',
            cache: {
              get: dividePrice({ of: '$0.125', by: 1_000_000 }),
              set: dividePrice({ of: '$1.25', by: 1_000_000 }),
            },
            input: dividePrice({ of: '$1.25', by: 1_000_000 }),
            output: dividePrice({ of: '$10.00', by: 1_000_000 }),
          },
        },
        gain: {
          size: { context: { tokens: 400_000 } },
          grades: {},
          cutoff: '2024-09-01',
          domain: 'ALL',
          skills: { tooluse: true, vision: true },
        },
      },
    },
    'openai/gpt/5-thoughtful-mini': {
      model: 'gpt-5-thinking-mini',
      description: 'gpt-5-thinking-mini - fast reason model',
      spec: {
        cost: {
          time: {
            speed: { tokens: 100, per: { seconds: 1 } },
            latency: { seconds: 1 },
          },
          cash: {
            per: 'token',
            cache: {
              get: dividePrice({ of: '$0.025', by: 1_000_000 }),
              set: dividePrice({ of: '$0.25', by: 1_000_000 }),
            },
            input: dividePrice({ of: '$0.25', by: 1_000_000 }),
            output: dividePrice({ of: '$2.00', by: 1_000_000 }),
          },
        },
        gain: {
          size: { context: { tokens: 400_000 } },
          grades: {},
          cutoff: '2024-09-01',
          domain: 'ALL',
          skills: { tooluse: true },
        },
      },
    },

    // =========================================================================
    // gpt-5.1 family (november 2025)
    // =========================================================================
    'openai/gpt/5.1-instant': {
      model: 'gpt-5.1-chat-latest',
      description: 'gpt-5.1-instant - fast model for everyday tasks',
      spec: {
        cost: {
          time: {
            speed: { tokens: 150, per: { seconds: 1 } },
            latency: { milliseconds: 300 },
          },
          cash: {
            per: 'token',
            cache: {
              get: dividePrice({ of: '$0.125', by: 1_000_000 }),
              set: dividePrice({ of: '$1.25', by: 1_000_000 }),
            },
            input: dividePrice({ of: '$1.25', by: 1_000_000 }),
            output: dividePrice({ of: '$10.00', by: 1_000_000 }),
          },
        },
        gain: {
          size: { context: { tokens: 400_000 } },
          grades: {},
          cutoff: '2024-09-01',
          domain: 'ALL',
          skills: { tooluse: true, vision: true },
        },
      },
    },
    'openai/gpt/5.1-thoughtful': {
      model: 'gpt-5.1',
      description: 'gpt-5.1 - deep reason with adaptive thought',
      spec: {
        cost: {
          time: {
            speed: { tokens: 80, per: { seconds: 1 } },
            latency: { seconds: 1 },
          },
          cash: {
            per: 'token',
            cache: {
              get: dividePrice({ of: '$0.125', by: 1_000_000 }),
              set: dividePrice({ of: '$1.25', by: 1_000_000 }),
            },
            input: dividePrice({ of: '$1.25', by: 1_000_000 }),
            output: dividePrice({ of: '$10.00', by: 1_000_000 }),
          },
        },
        gain: {
          size: { context: { tokens: 400_000 } },
          grades: {},
          cutoff: '2024-09-01',
          domain: 'ALL',
          skills: { tooluse: true, vision: true },
        },
      },
    },

    // =========================================================================
    // gpt-5.2 family (december 2025)
    // =========================================================================
    'openai/gpt/5.2-instant': {
      model: 'gpt-5.2-instant',
      description: 'gpt-5.2-instant - low latency for daily tasks',
      spec: {
        cost: {
          time: {
            speed: { tokens: 150, per: { seconds: 1 } },
            latency: { milliseconds: 300 },
          },
          cash: {
            per: 'token',
            cache: {
              get: dividePrice({ of: '$0.175', by: 1_000_000 }),
              set: dividePrice({ of: '$1.75', by: 1_000_000 }),
            },
            input: dividePrice({ of: '$1.75', by: 1_000_000 }),
            output: dividePrice({ of: '$14.00', by: 1_000_000 }),
          },
        },
        gain: {
          size: { context: { tokens: 400_000 } },
          grades: {},
          cutoff: '2025-08-01',
          domain: 'ALL',
          skills: { tooluse: true, vision: true },
        },
      },
    },
    'openai/gpt/5.2-pro': {
      model: 'gpt-5.2-pro',
      description: 'gpt-5.2-pro - highest tier with xhigh reason support',
      spec: {
        cost: {
          time: {
            speed: { tokens: 40, per: { seconds: 1 } },
            latency: { seconds: 3 },
          },
          cash: {
            per: 'token',
            cache: {
              get: dividePrice({ of: '$2.10', by: 1_000_000 }),
              set: dividePrice({ of: '$21.00', by: 1_000_000 }),
            },
            input: dividePrice({ of: '$21.00', by: 1_000_000 }),
            output: dividePrice({ of: '$168.00', by: 1_000_000 }),
          },
        },
        gain: {
          size: { context: { tokens: 400_000 } },
          grades: {},
          cutoff: '2025-08-01',
          domain: 'ALL',
          skills: { tooluse: true, vision: true },
        },
      },
    },
    'openai/gpt/5.2-thoughtful': {
      model: 'gpt-5.2',
      description: 'gpt-5.2 - most advanced frontier model for deep reason',
      spec: {
        cost: {
          time: {
            speed: { tokens: 60, per: { seconds: 1 } },
            latency: { seconds: 2 },
          },
          cash: {
            per: 'token',
            cache: {
              get: dividePrice({ of: '$0.175', by: 1_000_000 }),
              set: dividePrice({ of: '$1.75', by: 1_000_000 }),
            },
            input: dividePrice({ of: '$1.75', by: 1_000_000 }),
            output: dividePrice({ of: '$14.00', by: 1_000_000 }),
          },
        },
        gain: {
          size: { context: { tokens: 400_000 } },
          grades: {},
          cutoff: '2025-08-01',
          domain: 'ALL',
          skills: { tooluse: true, vision: true },
        },
      },
    },

    // =========================================================================
    // codex family (agentic code via codex sdk)
    // =========================================================================
    'openai/gpt/codex/5.1-max': {
      model: 'gpt-5.1-codex-max',
      description:
        'gpt-5.1-codex-max - optimized for long-horizon agentic code',
      spec: {
        cost: {
          time: {
            speed: { tokens: 80, per: { seconds: 1 } },
            latency: { seconds: 2 },
          },
          cash: {
            per: 'token',
            cache: {
              get: dividePrice({ of: '$3.75', by: 1_000_000 }),
              set: dividePrice({ of: '$7.50', by: 1_000_000 }),
            },
            input: dividePrice({ of: '$7.50', by: 1_000_000 }),
            output: dividePrice({ of: '$30.00', by: 1_000_000 }),
          },
        },
        gain: {
          size: { context: { tokens: 400_000 } },
          grades: { swe: 72.0 },
          cutoff: '2024-09-01',
          domain: 'SOFTWARE',
          skills: { tooluse: true },
        },
      },
    },
    'openai/gpt/codex/5.1-mini': {
      model: 'gpt-5.1-codex-mini',
      description: 'gpt-5.1-codex-mini - fast and cost-effective',
      spec: {
        cost: {
          time: {
            speed: { tokens: 120, per: { seconds: 1 } },
            latency: { seconds: 1 },
          },
          cash: {
            per: 'token',
            cache: {
              get: dividePrice({ of: '$1.50', by: 1_000_000 }),
              set: dividePrice({ of: '$3.00', by: 1_000_000 }),
            },
            input: dividePrice({ of: '$3.00', by: 1_000_000 }),
            output: dividePrice({ of: '$12.00', by: 1_000_000 }),
          },
        },
        gain: {
          size: { context: { tokens: 400_000 } },
          grades: { swe: 55.0 },
          cutoff: '2024-09-01',
          domain: 'SOFTWARE',
          skills: { tooluse: true },
        },
      },
    },
    'openai/gpt/codex/5.2': {
      model: 'gpt-5.2-codex',
      description: 'gpt-5.2-codex - most advanced agentic code model',
      spec: {
        cost: {
          time: {
            speed: { tokens: 60, per: { seconds: 1 } },
            latency: { seconds: 3 },
          },
          cash: {
            per: 'token',
            cache: {
              get: dividePrice({ of: '$5.00', by: 1_000_000 }),
              set: dividePrice({ of: '$10.00', by: 1_000_000 }),
            },
            input: dividePrice({ of: '$10.00', by: 1_000_000 }),
            output: dividePrice({ of: '$40.00', by: 1_000_000 }),
          },
        },
        gain: {
          size: { context: { tokens: 400_000 } },
          grades: { swe: 78.0 },
          cutoff: '2025-08-01',
          domain: 'SOFTWARE',
          skills: { tooluse: true },
        },
      },
    },
  };
