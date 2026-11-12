import ts from 'typescript';

const TS_FILE_RE = /\.(ts|tsx|mts|cts)$/;

function stripQuery(id) {
  const queryIndex = id.indexOf('?');
  return queryIndex === -1 ? id : id.slice(0, queryIndex);
}

/**
 * 用 TypeScript 编译器自带的 transpileModule 替代 esbuild 做 TS/TSX 转译。
 * 目标环境禁止执行 esbuild 原生二进制，因此构建链路不依赖它。
 * define 常量也在此替换，避免 Vite 的 vite:define 插件调用 esbuild。
 */
export function typescriptTransform(options = {}) {
  const version = typeof options.version === 'string' ? options.version : '1.0.0';
  const single = options.single === true;
  const replacements = [
    ['import.meta.env.DEV', 'false'],
    ['import.meta.env.PROD', 'true'],
    ['__APP_VERSION__', JSON.stringify(version)],
    ['__SINGLE_FILE__', single ? 'true' : 'false'],
  ];

  return {
    name: 'cls-typescript-transform',
    enforce: 'pre',
    transform(code, id) {
      const cleanId = stripQuery(id);
      if (!TS_FILE_RE.test(cleanId)) return null;

      let source = code;
      for (const [from, to] of replacements) {
        if (source.includes(from)) {
          source = source.split(from).join(to);
        }
      }

      const result = ts.transpileModule(source, {
        fileName: cleanId,
        reportDiagnostics: false,
        compilerOptions: {
          target: ts.ScriptTarget.ES2020,
          module: ts.ModuleKind.ESNext,
          moduleResolution: ts.ModuleResolutionKind.Bundler,
          jsx: ts.JsxEmit.ReactJSX,
          esModuleInterop: true,
          isolatedModules: true,
          allowSyntheticDefaultImports: true,
          resolveJsonModule: true,
          sourceMap: false,
          inlineSourceMap: false,
          removeComments: false,
        },
      });

      return { code: result.outputText, map: null };
    },
  };
}