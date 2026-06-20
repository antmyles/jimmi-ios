import { z } from "zod";
import { notifyOwner } from "./notification";
import { adminProcedure, publicProcedure, router } from "./trpc";
import { invokeLLM } from "./llm";

export const systemRouter = router({
  health: publicProcedure
    .input(
      z.object({
        timestamp: z.number().min(0, "timestamp cannot be negative"),
      })
    )
    .query(() => ({
      ok: true,
    })),

  llmDiag: publicProcedure.query(async () => {
    const start = Date.now();
    try {
      const resp = await invokeLLM({
        messages: [{ role: "user", content: "Say: OK" }],
        disableThinking: true,
      });
      const content = resp.choices?.[0]?.message?.content ?? "(empty)";
      return { ok: true, ms: Date.now() - start, content: content.slice(0, 100) };
    } catch (err: any) {
      return { ok: false, ms: Date.now() - start, error: String(err?.message ?? err).slice(0, 400) };
    }
  }),

  notifyOwner: adminProcedure
    .input(
      z.object({
        title: z.string().min(1, "title is required"),
        content: z.string().min(1, "content is required"),
      })
    )
    .mutation(async ({ input }) => {
      const delivered = await notifyOwner(input);
      return {
        success: delivered,
      } as const;
    }),
});
