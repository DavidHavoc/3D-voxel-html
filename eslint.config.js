// Flat ESLint config. No plugins are required, so it works with the
// pre-installed global ESLint without installing anything.

const browserGlobals = {
    window: "readonly",
    document: "readonly",
    navigator: "readonly",
    console: "readonly",
    requestAnimationFrame: "readonly",
    cancelAnimationFrame: "readonly",
    setTimeout: "readonly",
    clearTimeout: "readonly",
    performance: "readonly",
    devicePixelRatio: "readonly",
    HTMLElement: "readonly",
    HTMLCanvasElement: "readonly",
    WebGLRenderingContext: "readonly",
    WebGL2RenderingContext: "readonly",
    Float32Array: "readonly",
    Uint16Array: "readonly",
    Uint32Array: "readonly",
};

const nodeGlobals = {
    process: "readonly",
    console: "readonly",
    globalThis: "readonly",
    Buffer: "readonly",
    __dirname: "readonly",
    __filename: "readonly",
};

const sharedRules = {
    "no-unused-vars": "error",
    "no-undef": "error",
    "no-var": "error",
    "prefer-const": "error",
    eqeqeq: ["error", "smart"],
};

export default [
    {
        files: ["src/**/*.js"],
        languageOptions: {
            ecmaVersion: 2022,
            sourceType: "module",
            globals: browserGlobals,
        },
        rules: sharedRules,
    },
    {
        files: ["test/**/*.js"],
        languageOptions: {
            ecmaVersion: 2022,
            sourceType: "module",
            globals: nodeGlobals,
        },
        rules: sharedRules,
    },
];
