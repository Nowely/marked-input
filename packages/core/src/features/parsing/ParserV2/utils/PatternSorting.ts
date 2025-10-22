import {MarkupDescriptor} from '../core/MarkupDescriptor'
import {PatternChain} from './PatternChainManager'
import {PatternMatch} from './PatternBuilder'

/**
 * Static sorting utilities for pattern matching
 * Consolidated from PriorityResolver class to avoid cascading dependencies
 */
export class PatternSorting {
  /**
   * Comparator for descriptor priority (used for pre-sorting in MarkupRegistry)
   * Priority rules:
   * 1. Longer first segments first (avoid conflicts like * vs **)
   * 2. More segments = more specific patterns = higher priority
   * 
   * Returns: negative if a has higher priority, positive if b has higher priority
   */
  static compareDescriptorPriority(a: MarkupDescriptor, b: MarkupDescriptor): number {
    // Special case: prefer longer first segments to avoid conflicts like * vs ** or # vs ##
    const firstSegmentLenA = a.segments[0].length
    const firstSegmentLenB = b.segments[0].length
    if (firstSegmentLenA !== firstSegmentLenB) {
      return firstSegmentLenB - firstSegmentLenA // longer first segments first
    }

    // General case: longer patterns first (more segments = more specific = higher priority)
    const segmentsA = a.segments.length
    const segmentsB = b.segments.length
    return segmentsB - segmentsA // more segments first
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

