export function validateWorkspaceImport(data: any) {
  if (!data || typeof data !== 'object') throw new Error('Invalid file format');
  if (!Array.isArray(data.projects)) throw new Error('Invalid file format: projects');
  if (!Array.isArray(data.mocks)) throw new Error('Invalid file format: mocks');

  // Validate basic shape of projects
  data.projects.forEach((p: any, i: number) => {
    if (!p || typeof p !== 'object') throw new Error(`Invalid project at index ${i}`);
    if (!p.id || !p.name) throw new Error(`Invalid project: missing id/name at index ${i}`);
  });

  // Validate basic shape of mocks
  data.mocks.forEach((m: any, i: number) => {
    if (!m || typeof m !== 'object') throw new Error(`Invalid mock at index ${i}`);
    if (!m.id || !m.path || !m.method) throw new Error(`Invalid mock: missing id/path/method at index ${i}`);
  });

  return true;
}
