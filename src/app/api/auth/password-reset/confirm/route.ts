import { z } from "zod";
import { defineRoute } from "@/lib/route";
import { resetPasswordWithToken } from "@/modules/identity";

const resetConfirmSchema = z.object({
  token: z.string().min(1, "Reset token is required"),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

export const POST = defineRoute({
  public: true,
  input: resetConfirmSchema,
  rateLimit: { bucket: "auth", limit: 10, windowSeconds: 60 },
  handler: async (_tx, _actor, input) => {
    if (!input) {
      throw new Error("Missing reset confirmation parameters.");
    }
    await resetPasswordWithToken({
      token: input.token,
      newPassword: input.password,
    });
    return {
      success: true,
      message: "Password successfully updated.",
    };
  },
});
