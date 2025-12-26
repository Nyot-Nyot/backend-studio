// Helper to format axe violations in a readable way
export const formatViolations = (violations: any[]) => violations.map(v => ({
  id: v.id,
  impact: v.impact,
  nodes: v.nodes.length,
  help: v.help
}));
