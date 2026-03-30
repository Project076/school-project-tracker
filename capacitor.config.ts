import type { CapacitorConfig } from "@capacitor/cli";

const serverUrl = process.env.CAPACITOR_SERVER_URL?.trim();

const config: CapacitorConfig = {
  appId: "com.school.projecttracker",
  appName: "School Project Tracker",
  webDir: "out",
  server: serverUrl
    ? {
        url: serverUrl,
        cleartext: serverUrl.startsWith("http://"),
        androidScheme: serverUrl.startsWith("http://") ? "http" : "https"
      }
    : {
        androidScheme: "https"
      }
};

export default config;
