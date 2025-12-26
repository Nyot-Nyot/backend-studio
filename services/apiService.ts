// Minimal apiService stub used by ScenarioService
export const fetchRandomUser = async () => {
  // Return a stable shaped object for tests and scenarios
  return {
    id: crypto.randomUUID().split('-')[0],
    name: 'Random User'
  };
};
