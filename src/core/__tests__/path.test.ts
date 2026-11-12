import { describe, expect, it } from 'vitest';
import {
  comparePathAsc,
  isIllegalArchivePath,
  normalizeArchivePath,
  toDisplayPath,
} from '@/core/path';

describe('路径规范化与安全判定', () => {
  it('反斜杠、空段与点段规范化', () => {
    expect(normalizeArchivePath('src\\a\\..\\b.js')).toBe('src/a/../b.js');
    expect(normalizeArchivePath('./src//a.js')).toBe('src/a.js');
    expect(normalizeArchivePath('src/./a.js')).toBe('src/a.js');
  });

  it('拒绝父目录段（ACC-12）', () => {
    const result = isIllegalArchivePath('../../etc/passwd.js');
    expect(result.legal).toBe(false);
    expect(result.reason).toBe('parent-segment');
  });

  it('拒绝绝对路径与盘符', () => {
    expect(isIllegalArchivePath('/etc/passwd').reason).toBe('absolute-path');
    expect(isIllegalArchivePath('C:\\windows\\a.txt').reason).toBe('drive-letter');
  });

  it('拒绝控制字符', () => {
    expect(isIllegalArchivePath('a\u0000b.js').reason).toBe('control-character');
  });

  it('拒绝超长路径', () => {
    expect(isIllegalArchivePath('a'.repeat(300)).reason).toBe('path-too-long');
  });

  it('合法路径返回规范化结果', () => {
    const result = isIllegalArchivePath('src/config/app.js');
    expect(result.legal).toBe(true);
    expect(result.normalized).toBe('src/config/app.js');
    expect(result.reason).toBeNull();
  });

  it('码点排序稳定', () => {
    expect(comparePathAsc('a.js', 'b.js')).toBe(-1);
    expect(comparePathAsc('b.js', 'a.js')).toBe(1);
    expect(comparePathAsc('a.js', 'a.js')).toBe(0);
    expect(['b', 'A', 'a'].sort(comparePathAsc)).toEqual(['A', 'a', 'b']);
  });

  it('显示路径中间省略并保留扩展名', () => {
    const path = `very/long/${'x'.repeat(120)}/main.py`;
    const display = toDisplayPath(path, 40);
    expect(display.length).toBeLessThanOrEqual(41);
    expect(display).toContain('…');
    expect(display.endsWith('main.py')).toBe(true);
  });
});