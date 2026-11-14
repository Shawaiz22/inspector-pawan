import "server-only";
import { checkQuality } from "../data/quality";
import { groupSeries } from "../data/readings";
import { POLLUTANTS } from "../data/naqi";
import { normalizeTable } from "../data/normalize";
import type { ColumnMap, QualityFlag, RawTable, RepairProposal } from "../types";

/**
 * Quality flags for the data check screen: normalizes with every proposal
 * accepted, then runs the code checks. Cheap, no stats or events.
 */
export function analyzeFlagsOnly(table: RawTable, map: ColumnMap, proposals: RepairProposal[]): QualityFlag[] {
  const normalized = normalizeTable(table, map, proposals, new Set(proposals.map((proposal) => proposal.id)));
  const pollutants = POLLUTANTS.filter((pollutant) => map[pollutant] !== undefined);
  return [...normalized.flags, ...checkQuality(groupSeries(normalized.rows, pollutants))];
}
