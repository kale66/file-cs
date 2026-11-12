import { useState } from 'react';
import type { Finding } from '@/types';
import { Button } from '@/ui/Button';
import { rawSnippetStore } from '@/ui/hooks/rawSnippetStore';

export interface RevealDialogProps {
  readonly finding: Finding;
  readonly onClose: () => void;
}

export function RevealDialog({ finding, onClose }: RevealDialogProps): JSX.Element {
  const [confirmed, setConfirmed] = useState(false);
  const raw = confirmed ? rawSnippetStore.get(finding.id) : undefined;

  const handleClose = (): void => {
    rawSnippetStore.delete(finding.id);
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center bg-slate-900/60 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="reveal-title"
    >
      <div className="max-h-[85vh] w-full max-w-3xl overflow-auto rounded-xl border border-slate-200 bg-white p-5 shadow-xl dark:border-slate-700 dark:bg-slate-900">
        <h2
          id="reveal-title"
          className="text-sm font-semibold text-slate-900 dark:text-slate-100"
        >
          临时查看完整内容
        </h2>
        <p className="mt-2 text-xs text-slate-600 dark:text-slate-300">
          该内容可能包含真实密钥。查看后请勿截图、复制或上传到其他位置。内容仅保存在当前页面内存中，关闭对话框或刷新页面即清除，且不会进入任何导出文件。
        </p>
        <p className="mt-1 font-mono text-xs text-slate-500 dark:text-slate-400">
          {finding.filePath} : {finding.line} · {finding.ruleName}
        </p>

        {!confirmed ? (
          <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-3 dark:border-amber-900 dark:bg-amber-950">
            <p className="text-xs text-amber-800 dark:text-amber-300">
              请在确认周围环境安全后再展开。展开内容不提供“复制”按钮，也不写入日志。
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button variant="danger" onClick={() => setConfirmed(true)}>
                确认仅本地临时展开
              </Button>
              <Button onClick={handleClose}>取消</Button>
            </div>
          </div>
        ) : (
          <div className="mt-4 space-y-3">
            <pre className="max-h-[50vh] overflow-auto whitespace-pre-wrap break-all rounded-lg border border-slate-200 bg-slate-50 p-3 font-mono text-xs text-slate-800 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100">
              {raw ?? '该条完整内容不可展开（超出内存预算）'}
            </pre>
            <Button variant="primary" onClick={handleClose}>
              收起并清除
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}