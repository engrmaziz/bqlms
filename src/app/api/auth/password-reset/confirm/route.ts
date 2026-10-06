import { z } from "zod";
import { defineRoute } from "@/lib/route";
import { resetPasswordWithToken } from "@/modules/identity";

const resetConfirmSchema = z.object({
  token: z.string().min(1, "Reset token is required"),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

export const POST = defineRoute({
  schema: resetConfirmSchema,
  handler: async (input) => {
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
