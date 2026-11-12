import type { ChannelFailureCategory, ClsErrorCode, RetryAction } from '@/types';

export interface ErrorInfo {
  readonly code: ClsErrorCode;
  readonly message: string;
  readonly hint: string;
  readonly fatal: boolean;
}

export const ERROR_CATALOG: Readonly<Record<ClsErrorCode, ErrorInfo>> = {
  'CLS-E-1001': {
    code: 'CLS-E-1001',
    message: '请选择 zip 压缩包或文件夹。',
    hint: '仅支持 .zip 压缩包；若需扫描目录，请使用“选择文件夹”或拖入文件夹。',
    fatal: true,
  },
  'CLS-E-1002': {
    code: 'CLS-E-1002',
    message: '压缩包体积超过 100MB 上限，已停止读取。',
    hint: '请先在本地拆分压缩包后重新上传；工具不会读取超大文件内容。',
    fatal: true,
  },
  'CLS-E-1003': {
    code: 'CLS-E-1003',
    message: '压缩包已损坏，无法读取条目数据。',
    hint: '请重新导出压缩包（选择“存储”而非分卷/增量压缩）后再试。',
    fatal: true,
  },
  'CLS-E-1004': {
    code: 'CLS-E-1004',
    message: '压缩包包含加密条目，无法在本地读取。',
    hint: '请先解压并去除密码，再重新打包为未加密 zip 后上传。',
    fatal: true,
  },
  'CLS-E-1005': {
    code: 'CLS-E-1005',
    message: '检测到疑似 zip 炸弹（解压总量或压缩比异常），已中止扫描。',
    hint: '请确认压缩包来源可信；不要在本地直接解压未经验证的压缩包。',
    fatal: true,
  },
  'CLS-E-1006': {
    code: 'CLS-E-1006',
    message: '输入内容为空，没有可处理的文件。',
    hint: '请选择非空压缩包或包含文件的文件夹。',
    fatal: true,
  },
  'CLS-E-1007': {
    code: 'CLS-E-1007',
    message: '压缩包内未找到可扫描的文本文件。',
    hint: '请查看“已跳过文件”了解原因；可尝试关闭部分忽略开关后重新扫描。',
    fatal: false,
  },
  'CLS-E-1008': {
    code: 'CLS-E-1008',
    message: '后台扫描通道异常（未能归因）。',
    hint: '请重新上传后重试；若反复出现，可展开诊断信息并反馈错误码与诊断编号。',
    fatal: true,
  },
  'CLS-E-1009': {
    code: 'CLS-E-1009',
    message: '当前浏览器不支持读取文件夹。',
    hint: '请将目录打包为 zip 后再上传。',
    fatal: true,
  },
  'CLS-E-1010': {
    code: 'CLS-E-1010',
    message: '个别文件读取失败，已跳过并继续扫描。',
    hint: '请查看“已跳过文件”中的详情；必要时重新打包后重试。',
    fatal: false,
  },
  'CLS-E-1011': {
    code: 'CLS-E-1011',
    message: '后台扫描引擎未能加载，已切换为主线程处理。',
    hint: '无需操作，扫描已继续；若反复出现，请刷新页面或在标准构建（http/https）下打开。',
    fatal: false,
  },
  'CLS-E-1012': {
    code: 'CLS-E-1012',
    message: '扫描结果传输异常，可重新尝试。',
    hint: '点击“重新上传”重跑；若反复出现，展开诊断信息并反馈非法消息计数。',
    fatal: false,
  },
  'CLS-E-1013': {
    code: 'CLS-E-1013',
    message: '页面与后台扫描引擎版本不一致，请刷新页面以更新。',
    hint: '使用 Ctrl/Cmd+Shift+R 强制刷新；页面与引擎必须同源同版本构建。',
    fatal: false,
  },
  'CLS-E-1014': {
    code: 'CLS-E-1014',
    message: '后台扫描引擎未在启动窗口内响应，已切换为主线程处理。',
    hint: '无需操作，扫描已继续；若反复出现，请刷新页面以更新引擎。',
    fatal: false,
  },
  'CLS-E-1015': {
    code: 'CLS-E-1015',
    message: '后台扫描引擎已停止响应，已切换为主线程继续扫描。',
    hint: '无需操作，扫描已在主线程继续；若特定压缩包反复触发，可拆分后分批扫描。',
    fatal: false,
  },
  'CLS-E-1016': {
    code: 'CLS-E-1016',
    message: '后台扫描引擎运行异常，已切换为主线程重新扫描。',
    hint: '无需操作，扫描将重跑一次；若反复出现，展开诊断信息并反馈阶段与计数。',
    fatal: false,
  },
  'CLS-E-1017': {
    code: 'CLS-E-1017',
    message: '扫描任务无法发送到后台引擎。',
    hint: '请点击“重新上传”重试；压缩包数据可能已被占用，需要重新选择文件。',
    fatal: false,
  },
  'CLS-E-1018': {
    code: 'CLS-E-1018',
    message: '已有扫描正在进行，请等待完成或先取消。',
    hint: '等待当前扫描完成，或点击“取消扫描”后再提交；不要重复点击开始。',
    fatal: false,
  },
  'CLS-E-2001': {
    code: 'CLS-E-2001',
    message: '内部规则或统计校验失败。',
    hint: '这是工具内部问题，请反馈复现步骤；当前结果可能不完整。',
    fatal: true,
  },
  'CLS-E-2002': {
    code: 'CLS-E-2002',
    message: '内部结果不变量不一致。',
    hint: '请重新扫描；若持续出现，请反馈复现步骤。',
    fatal: true,
  },
  'CLS-E-3001': {
    code: 'CLS-E-3001',
    message: '文件下载失败，浏览器可能拦截了下载。',
    hint: '请允许本站下载，或使用下方提供的手动下载链接。',
    fatal: false,
  },
  'CLS-E-3002': {
    code: 'CLS-E-3002',
    message: '剪贴板不可用。',
    hint: '已展开只读文本框，请手动选中并复制。',
    fatal: false,
  },
  'CLS-E-4001': {
    code: 'CLS-E-4001',
    message: '当前浏览器不支持后台扫描，已降级为主线程处理。',
    hint: '处理大文件时页面可能短暂卡顿；功能仍可正常使用。若为单文件版，可尝试改用标准构建。',
    fatal: false,
  },
};

export class ClsError extends Error {
  readonly code: ClsErrorCode;
  readonly hint: string;

  constructor(code: ClsErrorCode, hint?: string) {
    const info = ERROR_CATALOG[code];
    super(hint && hint.length > 0 ? hint : info.message);
    this.name = 'ClsError';
    this.code = code;
    this.hint = info.hint;
  }
}

export function isClsError(value: unknown): value is ClsError {
  return value instanceof ClsError;
}

export function toErrorInfo(value: unknown): ErrorInfo {
  if (isClsError(value)) {
    return ERROR_CATALOG[value.code];
  }
  return ERROR_CATALOG['CLS-E-2001'];
}
export interface ChannelCatalogEntry {
  readonly code: ClsErrorCode;
  readonly retryable: RetryAction;
  readonly degradable: boolean;
}

/** 通道故障类别 → 错误码的唯一映射，workerClient 只按类别查码。 */
export const CHANNEL_CATALOG: Readonly<
  Record<ChannelFailureCategory, ChannelCatalogEntry>
> = {
  construct: { code: 'CLS-E-4001', retryable: 'none', degradable: true },
  load: { code: 'CLS-E-1011', retryable: 'refresh', degradable: true },
  parse: { code: 'CLS-E-1012', retryable: 'retry', degradable: true },
  protocol: { code: 'CLS-E-1013', retryable: 'refresh', degradable: true },
  timeout: { code: 'CLS-E-1014', retryable: 'none', degradable: true },
  engine: { code: 'CLS-E-1016', retryable: 'none', degradable: true },
  delivery: { code: 'CLS-E-1017', retryable: 'reupload', degradable: true },
  concurrency: { code: 'CLS-E-1018', retryable: 'none', degradable: false },
  unclassified: { code: 'CLS-E-1008', retryable: 'reupload', degradable: false },
};

export function channelErrorInfo(category: ChannelFailureCategory): ErrorInfo {
  return ERROR_CATALOG[CHANNEL_CATALOG[category].code];
}