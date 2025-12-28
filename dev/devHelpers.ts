import { MockEndpoint, Project } from "../types";

// Pasang helper khusus DEV ke window untuk keperluan e2e dan debugging.
// Fungsi-fungsi ini harus dipasang hanya di mode DEV.
export function pasangDevHelpers(api: {
  setProyek: (p: Project[]) => void;
  setRute: (m: MockEndpoint[]) => void;
  setProyekAktifId: (id: string) => void;
  referensiRute: { current: MockEndpoint[] };
  referensiVariabelLingkungan: { current: any };
  setPenghitungFitur?: (fn: (n: number) => number) => void;
}) {
  // Attach a helper to the window that tests can call to set projects/mocks
  // Cara pakai (page.evaluate): window.__applyTestFixtures(projects, mocks, activeProjectId)
  (window as any).__applyTestFixtures = (
    projectsValue: Project[],
    mocksValue: MockEndpoint[],
    proyekAktifIdValue?: string
  ) => {
    try {
      api.setProyek(projectsValue);
      api.setRute(mocksValue);
      if (proyekAktifIdValue) api.setProyekAktifId(proyekAktifIdValue);
      // Persist to localStorage as well
      localStorage.setItem("api_sim_projects", JSON.stringify(projectsValue));
      localStorage.setItem("api_sim_mocks", JSON.stringify(mocksValue));
      if (proyekAktifIdValue) localStorage.setItem("api_sim_active_project", proyekAktifIdValue);
      return true;
    } catch (err) {
      console.error("applyTestFixtures failed", err);
      return false;
    }
  };

  // Also expose a test helper to directly call simulateRequest with the current in-memory mocks
  (window as any).__simulateRequest = async (
    method: string,
    url: string,
    headersObj: Record<string, string> = {},
    body: string = ""
  ) => {
    try {
      const res = await (window as any).__internalSimulateRequestImpl?.(method, url, headersObj, body);
      return res;
    } catch (err) {
      console.error("Kesalahan helper simulateRequest:", err);
      throw err;
    }
  };

  // Test helper to set mocks directly into the runtime (bypass storage races)
  (window as any).__setMocksDirect = (mocksValue: MockEndpoint[]) => {
    try {
      api.referensiRute.current = mocksValue;
      api.setRute(mocksValue);
      localStorage.setItem("api_sim_mocks", JSON.stringify(mocksValue));
      return true;
    } catch (e) {
      console.error("setMocksDirect gagal", e);
      return false;
    }
  };

  // Helper untuk memudahkan pengembangan: atur feature flag di localStorage dan trigger re-render fitur
  (window as any).__setFeatureFlag = (key: string, value: boolean) => {
    try {
      if (value) localStorage.setItem(key, 'true');
      else localStorage.removeItem(key);
      if (typeof api.setPenghitungFitur === 'function') api.setPenghitungFitur((c) => c + 1);
      return true;
    } catch (e) {
      console.error('setFeatureFlag gagal', e);
      return false;
    }
  };

  // Memudahkan: aktifkan semua fitur yang umum dipakai selama pengembangan
  (window as any).__enableAllFeatures = () => {
    try {
      const keys = [
        'feature_sw',
        'feature_logviewer',
        'feature_email_export',
        'feature_export',
        'feature_ai',
        'feature_openrouter',
        'feature_gemini',
        'feature_proxy',
      ];
      for (const k of keys) localStorage.setItem(k, 'true');
      if (typeof api.setPenghitungFitur === 'function') api.setPenghitungFitur((c) => c + 1);
      return true;
    } catch (e) {
      console.error('enableAllFeatures gagal', e);
      return false;
    }
  };

  (window as any).__disableAllFeatures = () => {
    try {
      const keys = [
        'feature_sw',
        'feature_logviewer',
        'feature_email_export',
        'feature_export',
        'feature_ai',
        'feature_openrouter',
        'feature_gemini',
        'feature_proxy',
      ];
      for (const k of keys) localStorage.removeItem(k);
      if (typeof api.setPenghitungFitur === 'function') api.setPenghitungFitur((c) => c + 1);
      return true;
    } catch (e) {
      console.error('disableAllFeatures gagal', e);
      return false;
    }
  };
}
