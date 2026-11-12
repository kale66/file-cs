export interface PrivacyNoticeProps {
  readonly variant: 'top' | 'bottom';
}

const STATEMENT =
  '所有处理均在浏览器本地完成，代码不会上传到任何服务器。请确认页面无外部网络请求后再使用。';

export function PrivacyNotice({ variant }: PrivacyNoticeProps): JSX.Element {
  if (variant === 'bottom') {
    return (
      <div className="sticky bottom-0 z-20 border-t border-emerald-200 bg-emerald-50 px-4 py-2 text-center text-xs font-medium text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-300">
        {STATEMENT}
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 dark:border-emerald-900 dark:bg-emerald-950">
      <p className="text-xs font-medium text-emerald-800 dark:text-emerald-300">
        {STATEMENT}
      </p>
      <details className="mt-2">
        <summary className="cls-focus cursor-pointer text-xs text-emerald-700 underline decoration-emerald-400 underline-offset-2 dark:text-emerald-300">
          工具边界与免责说明
        </summary>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-xs text-emerald-800 dark:text-emerald-300">
          <li>本工具是“提交前自查”辅助工具，不替代 gitleaks / trufflehog 等专业密钥扫描。</li>
          <li>只扫描当前压缩包/文件夹中的注释与指定文档，不扫描 git 历史、提交记录或远端仓库。</li>
          <li>一旦密钥曾进入 git 历史，仅删除注释不足，必须轮换密钥。</li>
          <li>浏览器扩展可读取页面 DOM，请确认无不可信扩展后再处理敏感代码。</li>
          <li>仅做本地内存处理，不使用 localStorage、IndexedDB 或任何持久化存储。</li>
        </ul>
      </details>
    </div>
  );
}