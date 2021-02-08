export interface StringifyConfig {
    indent: number;
    omitKeyPattern: RegExp;
    maskKeyPattern: RegExp;
    maxStringLength: number;
    replacer: (k: string, v: any) => any;
}

export const DEFAULT_STRINGIFY_OPTS: StringifyConfig = {
    indent: 0,
    omitKeyPattern: /^_|^\$/,
    maskKeyPattern: /password|secret/i,
    maxStringLength: 400,
    replacer: errorReplacer,
};

export function errorReplacer(_k: string, v: any): any {
    if (v instanceof Error) {
        return {
            name: v.name,
            message: v.stack,
            code: (v as any).code,
            details: (v as any).details,
            status: (v as any).status,
        };
    }
    return v;
}

export function safeStringify(obj: any, options: Partial<StringifyConfig> = {}) {
    try {
        const config = { ...DEFAULT_STRINGIFY_OPTS, ...options };
        const omitRe = new RegExp(config.omitKeyPattern.source, config.omitKeyPattern.flags);
        const maskRe = new RegExp(config.maskKeyPattern.source, config.maskKeyPattern.flags);
        const refs = new Set();
        return JSON.stringify(obj, (k, v) => {
            // Drop circular deps
            if (typeof v === 'object') {
                if (refs.has(v)) {
                    return;
                }
                refs.add(v);
            }
            // Drop omitted keys
            if (omitRe.test(String(k))) {
                return;
            }
            // Mask keys
            if (maskRe.test(String(k))) {
                return '***';
            }
            // Trim excess strings
            if (typeof v === 'string') {
                const l = Math.floor(config.maxStringLength / 2);
                if (v.length > config.maxStringLength) {
                    v = v.substring(0, l) + '...' + v.substring(v.length - l);
                }
            }
            return config.replacer(k, v);
        }, config.indent);
    } catch (err) {
        return JSON.stringify({
            error: {
                name: 'JsonSerializationError',
                message: `Could not serialize JSON data: ${err.message}`,
            },
        });
    }
}
