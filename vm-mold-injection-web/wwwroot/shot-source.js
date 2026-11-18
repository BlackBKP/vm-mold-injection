export async function createShotSource() {
  const response = await fetch("./dashboard-config.json", {
    cache: "no-store",
    signal: AbortSignal.timeout(10000)
  });
  if (!response.ok) throw new Error("Unable to load dashboard configuration");
  const configuration = await response.json();

  if (configuration.mode === "demo") {
    const { generateDemoShots } = await import("./demo-data.js");
    return { mode: "demo", readShots: async () => generateDemoShots() };
  }

  if (configuration.mode !== "api") throw new Error("Dashboard mode must be api or demo");
  const shotsUrl = configuration.shotsUrl ?? "/data/shots";
  if (typeof shotsUrl !== "string" || !shotsUrl.trim()) {
    throw new Error("Configure a non-empty shotsUrl");
  }
  const endpoint = new URL(shotsUrl, location.href);
  if (!["http:", "https:"].includes(endpoint.protocol)) {
    throw new Error("shotsUrl must use HTTP or HTTPS");
  }

  return {
    mode: "api",
    async readShots() {
      const response = await fetch(endpoint, {
        cache: "no-store",
        signal: AbortSignal.timeout(10000)
      });
      if (!response.ok) throw new Error("Shot request failed");
      return response.json();
    }
  };
}
