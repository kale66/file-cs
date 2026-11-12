import { LIMITS } from '@/types';
import type { ConfigChangeNotice, IgnoreGroups, ScanConfig } from '@/types';
import { RULE_SET_VERSION } from '@/core/rules';

export const DEFAULT_IGNORE_GROUPS: IgnoreGroups = {
  ignoreDirectories: true,
  ignoreBuildOutput: true,
  ignoreLockFiles: true,
  ignoreBinaryTypes: true,
  ignoreLargeFiles: true,
  ignoreUnknownExtensions: true,
};

export function createDefaultScanConfig(overrides?: Partial<ScanConfig>): ScanConfig {
  const base: ScanConfig = {
    ignoreGroups: { ...DEFAULT_IGNORE_GROUPS },
    scanPythonDocstring: true,
    scanContactInfo: false,
    maxFileSizeBytes: LIMITS.maxFileSizeBytes,
    maxTotalUnzipBytes: LIMITS.maxTotalUnzipBytes,
    maxArchiveBytes: LIMITS.maxArchiveBytes,
    ruleSetVersion: RULE_SET_VERSION,
    scannedAt: new Date().toISOString(),
  };
  return {
    ...base,
    ...overrides,
    ignoreGroups: { ...(overrides?.ignoreGroups ?? base.ignoreGroups) },
  };
}

export function withConfigChange(
  current: ScanConfig,
  patch: Partial<
    Pick<ScanConfig, 'ignoreGroups' | 'scanPythonDocstring' | 'scanContactInfo'>
  >,
): { config: ScanConfig; notice: ConfigChangeNotice } {
  const next: ScanConfig = {
    ...current,
    ...(patch.scanPythonDocstring === undefined
      ? {}
      : { scanPythonDocstring: patch.scanPythonDocstring }),
    ...(patch.scanContactInfo === undefined
      ? {}
      : { scanContactInfo: patch.scanContactInfo }),
    ignoreGroups: patch.ignoreGroups
      ? { ...patch.ignoreGroups }
      : { ...current.ignoreGroups },
    scannedAt: new Date().toISOString(),
  };
  return {
    config: next,
    notice: {
      changed: true,
      message: '规则已变更，重新扫描后生效',
    },
  };
}

export function snapshotConfig(config: ScanConfig): ScanConfig {
  return Object.freeze({
    ...config,
    ignoreGroups: Object.freeze({ ...config.ignoreGroups }),
  });
}