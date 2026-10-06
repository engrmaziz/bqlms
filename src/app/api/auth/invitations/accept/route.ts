import { z } from "zod";
import { defineRoute } from "@/lib/route";
import { acceptInvitation } from "@/modules/identity";

const acceptSchema = z.object({
  token: z.string().min(1, "Invitation token is required"),
  name: z.string().trim().min(1, "Name is required"),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

export const POST = defineRoute({
  public: true,
  input: acceptSchema,
  rateLimit: { bucket: "auth", limit: 10, windowSeconds: 60 },
  handler: async (_tx, _actor, input) => {
    if (!input) {
      throw new Error("Missing invitation input parameters.");
    }
    const { user, profile } = await acceptInvitation(input);
    return {
      success: true,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        roles: profile.roles,
      },
    };
  },
});
