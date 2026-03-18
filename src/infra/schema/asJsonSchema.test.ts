import { given, then, when } from 'test-fns';
import { z } from 'zod';

import { asJsonSchema } from './asJsonSchema';

describe('asJsonSchema', () => {
  given('a schema with only required properties', () => {
    const schema = z.object({
      path: z.string(),
      content: z.string(),
    });

    when('converted to json schema', () => {
      const result = asJsonSchema({ schema }) as {
        type: string;
        properties: Record<string, unknown>;
        required: string[];
      };

      then('all properties should be in required array', () => {
        expect(result.required).toContain('path');
        expect(result.required).toContain('content');
        expect(result.required).toHaveLength(2);
      });
    });
  });

  given('a schema with optional properties', () => {
    const schema = z.object({
      path: z.string(),
      offset: z.number().optional(),
      limit: z.number().optional(),
    });

    when('converted to json schema', () => {
      const result = asJsonSchema({ schema }) as {
        type: string;
        properties: Record<string, { type: string | string[] }>;
        required: string[];
        additionalProperties: boolean;
      };

      then(
        'all properties should be in required array (openai strict mode)',
        () => {
          // openai strict mode requires ALL properties in required array
          expect(result.required).toContain('path');
          expect(result.required).toContain('offset');
          expect(result.required).toContain('limit');
          expect(result.required).toHaveLength(3);
        },
      );

      then('optional properties should have nullable type', () => {
        // openai strict mode: optional props need type: ["number", "null"]
        expect(result.properties.offset!.type).toContain('number');
        expect(result.properties.offset!.type).toContain('null');
        expect(result.properties.limit!.type).toContain('number');
        expect(result.properties.limit!.type).toContain('null');
      });

      then('required properties should have simple type', () => {
        expect(result.properties.path!.type).toEqual('string');
      });

      then('additionalProperties should be false', () => {
        expect(result.additionalProperties).toEqual(false);
      });
    });
  });

  given('a schema with nested optional properties', () => {
    const schema = z.object({
      path: z.string(),
      options: z
        .object({
          encoding: z.string().optional(), // note: encoding is a standard term for file charset
          flag: z.string(),
        })
        .optional(),
    });

    when('converted to json schema', () => {
      const result = asJsonSchema({ schema }) as {
        type: string;
        properties: Record<
          string,
          {
            type: string | string[];
            properties?: Record<string, unknown>;
            required?: string[];
          }
        >;
        required: string[];
      };

      then('nested optional properties should also be handled', () => {
        // top level: options should be in required and nullable
        expect(result.required).toContain('options');
        expect(result.properties.options!.type).toContain('object');
        expect(result.properties.options!.type).toContain('null');

        // nested: encoding should be in required and nullable
        expect(result.properties.options!.required).toContain('encoding');
        expect(result.properties.options!.required).toContain('flag');
      });
    });
  });
});
