declare module 'theredoc' {
    function theredoc(str: TemplateStringsArray, ...args: unknown[]): string;
    export = theredoc;
}
