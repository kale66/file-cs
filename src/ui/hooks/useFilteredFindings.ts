import { useMemo } from 'react';
import { LIMITS } from '@/types';
import type {
  FilterState,
  FilteredFindingsResult,
  Finding,
  FindingGroup,
  Severity,

} from '@/types';

function emptyCounts(): Record<Severity, number> {
  return { critical: 0, high: 0, medium: 0, low: 0 };
}

export function useFilteredFindings(
  findings: readonly Finding[],
  filter: FilterState,
  page: number,
): FilteredFindingsResult {
  return useMemo(() => {
    const severitySet = new Set<Severity>(filter.severities);
    const ruleSet = new Set(filter.ruleIds);
    const query = filter.pathQuery.trim().toLowerCase();

    const filtered = findings.filter((finding) => {
      if (severitySet.size > 0 && !severitySet.has(finding.severity)) return false;
      if (ruleSet.size > 0 && !ruleSet.has(finding.ruleId)) return false;
      if (query.length > 0 && !finding.filePath.toLowerCase().includes(query)) {
        return false;
      }
      if (filter.onlyFenceSamples) return finding.inCodeFence;
      if (!filter.includeFenceSamples && finding.inCodeFence) return false;
      return true;
    });

    const totalCount = filtered.length;
    const pageSize = LIMITS.resultsPageSize;
    const pageCount = Math.max(1, Math.ceil(totalCount / pageSize));
    const safePage = Math.min(Math.max(1, page), pageCount);
    const visible = filtered.slice((safePage - 1) * pageSize, safePage * pageSize);

    const groups: FindingGroup[] = [];
    const groupByPath = new Map<string, Finding[]>();
    for (const finding of visible) {
      const list = groupByPath.get(finding.filePath);
      if (list) {
        list.push(finding);
      } else {
        groupByPath.set(finding.filePath, [finding]);
      }
    }

    for (const [filePath, groupFindings] of groupByPath) {
      const severityCounts = emptyCounts();
      for (const finding of groupFindings) {
        severityCounts[finding.severity] += 1;
      }
      groups.push({
        filePath,
        findings: groupFindings,
        severityCounts,
        collapsed: false,
      });
    }

    return {
      groups,
      visibleCount: visible.length,
      totalCount,
      pageCount,
    };
  }, [findings, filter, page]);
}