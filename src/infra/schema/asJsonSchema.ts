import { z } from 'zod';

/**
 * .what = json schema property shape
 */
type JsonSchemaProperty = {
  type?: string | string[];
  properties?: Record<string, JsonSchemaProperty>;
  required?: string[];
  additionalProperties?: boolean;
  [key: string]: unknown;
};

/**
 * .what = json schema object shape
 */
type JsonSchemaObject = {
  type: string;
  properties?: Record<string, JsonSchemaProperty>;
  required?: string[];
  additionalProperties?: boolean;
  [key: string]: unknown;
};

/**
 * .what = transform schema for openai strict mode compatibility
 * .why = openai strict mode requires:
 *   1. all properties in `required` array
 *   2. optional properties have nullable type: ["type", "null"]
 *
 * .note = recursively handles nested objects
 */
const asOpenaiStrictSchema = (schema: JsonSchemaObject): JsonSchemaObject => {
  // if no properties, return as-is
  if (!schema.properties) return schema;

  const requiredSet = new Set(schema.required ?? []);
  const allPropertyNames = Object.keys(schema.properties);

  // transform each property
  const propertiesTransformed: Record<string, JsonSchemaProperty> = {};
  for (const [name, prop] of Object.entries(schema.properties)) {
    const isOptional = !requiredSet.has(name);

    // recurse into nested objects
    let propTransformed = { ...prop };
    if (prop.type === 'object' && prop.properties) {
      propTransformed = asOpenaiStrictSchema(prop as JsonSchemaObject);
    }

    // make optional properties nullable
    if (isOptional && propTransformed.type) {
      const currentType = propTransformed.type;
      if (Array.isArray(currentType)) {
        // already an array, add null if not present
        if (!currentType.includes('null')) {
          propTransformed = {
            ...propTransformed,
            type: [...currentType, 'null'],
          };
        }
      } else {
        // single type, convert to array with null
        propTransformed = { ...propTransformed, type: [currentType, 'null'] };
      }
    }

    propertiesTransformed[name] = propTransformed;
  }

  return {
    ...schema,
    properties: propertiesTransformed,
    required: allPropertyNames,
  };
};

/**
 * .what = convert a zod schema to JSON schema for native SDK enforcement
 * .why = enables native structured output support in SDKs to reduce
 *   token waste on validation retries
 *
 * .note = different SDKs require different conversion options:
 *   - claude-agent-sdk: { $refStrategy: 'root' }
 *   - codex-sdk: { target: 'openAi' }
 *
 * .note = openai strict mode requires all properties in required array
 *   with optional properties marked as nullable types
 */
export const asJsonSchema = (input: { schema: z.ZodSchema }): object => {
  const schema = z.toJSONSchema(input.schema, { target: 'openAi' });
  return asOpenaiStrictSchema(schema as JsonSchemaObject);
};
