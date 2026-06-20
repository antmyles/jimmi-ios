import "dotenv/config";
import express from "express";
import { createServer } from "http";
import net from "net";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { registerOAuthRoutes } from "./oauth";
import { registerGoogleSignInRoutes } from "../google-signin";
import { registerOuraRoutes } from "../oura";
import { registerWhoopRoutes } from "../whoop";
import { registerGoogleHealthRoutes } from "../google-health";
import { registerStorageProxy } from "./storageProxy";
import { registerStripeRoutes } from "../stripe";
import { appRouter } from "../routers";
import { createContext } from "./context";
import { serveStatic, setupVite } from "./vite";
import { cleanupExpiredChats, sendScheduledReminders } from "../scheduled";

function isPortAvailable(port: number): Promise<boolean> {
  return new Promise(resolve => {
    const server = net.createServer();
    server.listen(port, () => server.close(() => resolve(true)));
    server.on("error", () => resolve(false));
  });
}

async function findAvailablePort(startPort: number = 3000): Promise<number> {
  for (let port = startPort; port < startPort + 20; port++) {
    if (await isPortAvailable(port)) return port;
  }
  throw new Error(`No available port found starting from ${startPort}`);
}

async function startServer() {
  const app = express();
  const server = createServer(app);
  // Stripe webhook must be registered before express.json() middleware
  registerStripeRoutes(app);
  app.use(express.json({
    limit: "50mb",
    verify: (req, _res, buf) => {
      (req as unknown as { rawBody?: Buffer }).rawBody = Buffer.from(buf);
    },
  }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));
  registerStorageProxy(app);
  registerOAuthRoutes(app);
  registerGoogleSignInRoutes(app);
  registerOuraRoutes(app);
  registerWhoopRoutes(app);
  registerGoogleHealthRoutes(app);
  app.post("/api/scheduled/send-reminders", sendScheduledReminders);
  app.post("/api/scheduled/cleanup-expired-chats", cleanupExpiredChats);
  app.use("/api/trpc", createExpressMiddleware({ router: appRouter, createContext }));
  if (process.env.NODE_ENV === "development") await setupVite(app, server); else serveStatic(app);
  const preferredPort = parseInt(process.env.PORT || "3000");
  const port = await findAvailablePort(preferredPort);
  if (port !== preferredPort) console.log(`Port ${preferredPort} is busy, using port ${port} instead`);
  server.listen(port, () => console.log(`Server running on http://localhost:${port}/`));
}

startServer().catch(console.error);

