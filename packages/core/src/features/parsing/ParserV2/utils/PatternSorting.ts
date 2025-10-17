import {MarkupDescriptor} from '../core/MarkupDescriptor'
import {PatternChain} from './PatternChainManager'
import {PatternMatch} from './PatternBuilder'

/**
 * Static sorting utilities for pattern matching
 * Consolidated from PriorityResolver class to avoid cascading dependencies
 */
export class PatternSorting {
  /**
   * Sorts waiting chains by priority for processing
   * Extracted from PatternProcessor.processWaitingChains (lines 154-185)
   *
   * Priority rules:
   * 1. Chains completing on this segment first (highest priority)
   * 2. For chains at same start position: more progress = higher priority
   * 3. For different start positions: later start (inner) = higher priority (LIFO)
   */
  static sortWaitingChains(
    waiting: PatternChain[],
    nextMatch: {value: string; start: number},
    descriptors: MarkupDescriptor[]
  ): PatternChain[] {
    return [...waiting].sort((a, b) => {
      const aDescriptor = descriptors[a.descriptorIndex]
      const bDescriptor = descriptors[b.descriptorIndex]

      // Check if chains would be complete after this segment
      const aWouldComplete = a.nextSegmentIndex === aDescriptor.segments.length - 1
      const bWouldComplete = b.nextSegmentIndex === bDescriptor.segments.length - 1

      // Prioritize completing chains over extending ones
      if (aWouldComplete && !bWouldComplete) return -1
      if (!aWouldComplete && bWouldComplete) return 1

      // Both complete or both extend: check if they started at the same position
      const aStart = a.parts[0].start
      const bStart = b.parts[0].start

      // If chains started at the SAME position (potential conflict), prioritize by progress
      // More collected segments = more specific pattern = higher priority
      if (aStart === bStart) {
        const aProgress = a.nextSegmentIndex // How many segments already collected
        const bProgress = b.nextSegmentIndex
        if (aProgress !== bProgress) {
          return bProgress - aProgress // More progress first
        }

        // Same progress: prioritize longer patterns (more total segments = more specific)
        return bDescriptor.segments.length - aDescriptor.segments.length
      }

      // Different start positions: later start = inner = higher priority (LIFO)
      return bStart - aStart
    })
  }

  /**
   * Sorts descriptors by priority when starting new chains
   * Extracted from PatternProcessor.startNewChains (lines 279-298)
   *
   * Priority rules:
   * 1. Longer first segments first (avoid conflicts like * vs **)
   * 2. More segments = more specific patterns = higher priority
   */
  static sortDescriptors(
    descInfos: Array<{descriptorIndex: number; segmentIndex: number}>,
    descriptors: MarkupDescriptor[]
  ): Array<{descriptorIndex: number; segmentIndex: number}> {
    return descInfos.sort((a, b) => {
      const descA = descriptors[a.descriptorIndex]
      const descB = descriptors[b.descriptorIndex]

      // Special case: prefer longer first segments to avoid conflicts like * vs ** or # vs ##
      const firstSegmentLenA = descA.segments[0].length
      const firstSegmentLenB = descB.segments[0].length
      if (firstSegmentLenA !== firstSegmentLenB) {
        return firstSegmentLenB - firstSegmentLenA // longer first segments first
      }

      // General case: longer patterns first (more segments = more specific = higher priority)
      // This ensures that patterns like <__label__ __value__>__nested__</__label__> (5 segments)
      // are tried before <__label__>__nested__</__label__> (4 segments)
      const segmentsA = descA.segments.length
      const segmentsB = descB.segments.length
      return segmentsB - segmentsA // more segments first
    })
  }

  /**
   * Final sort of pattern matches before passing to buildTree
   * Extracted from MatchPostProcessor.sortByPositionAndLength (lines 17-28)
   *
   * Sorts by:
   * 1. Start position (ascending)
   * 2. Length (descending - longest first for greedy matching)
   */
  static sortPatternMatches(matches: PatternMatch[]): PatternMatch[] {
    return matches.sort((a, b) => {
      const startA = PatternSorting.getMatchStart(a)
      const startB = PatternSorting.getMatchStart(b)
      if (startA !== startB) {
        return startA - startB
      }
      // Same start: prefer longer match (greedy by default)
      const lengthA = PatternSorting.getMatchEnd(a) - startA
      const lengthB = PatternSorting.getMatchEnd(b) - startB
      return lengthB - lengthA
    })
  }

  /**
   * Gets the start position of a pattern match
   */
  private static getMatchStart(match: PatternMatch): number {
    return match.parts.length > 0 ? match.parts[0].start : 0
  }

  /**
   * Gets the end position of a pattern match (exclusive)
   */
  private static getMatchEnd(match: PatternMatch): number {
    return match.parts.length > 0 ? match.parts[match.parts.length - 1].end + 1 : 0
  }
}

