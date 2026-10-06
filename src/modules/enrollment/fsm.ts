import { AppError } from "@/lib/errors";
import { defineMachine, type TransitionMap } from "@/lib/fsm";
import type { EnrollmentStatus } from "./schema";

export type EnrollmentEvent =
  | "ENROLL"
  | "PROMOTE"
  | "DROP"
  | "WITHDRAW"
  | "COMPLETE"
  | "OVERRIDE_DROP"
  | "OVERRIDE_WITHDRAW";

export const enrollmentTransitions: TransitionMap<
  EnrollmentStatus,
  EnrollmentEvent
> = {
  enrolled: {
    DROP: "dropped",
    WITHDRAW: "withdrawn",
    COMPLETE: "completed",
    OVERRIDE_DROP: "dropped",
    OVERRIDE_WITHDRAW: "withdrawn",
  },
  waitlisted: {
    PROMOTE: "enrolled",
    DROP: "dropped",
    OVERRIDE_DROP: "dropped",
  },
  dropped: {
    ENROLL: "enrolled",
  },
  withdrawn: {
    ENROLL: "enrolled",
  },
  completed: {},
};

export const enrollmentMachine = defineMachine(enrollmentTransitions);

export interface ResolveDropParams {
  censusDate: Date;
  termStatus: "planned" | "active" | "closed";
  now?: Date | undefined;
  isRegistrarOrAdmin?: boolean | undefined;
  overrideReason?: string | null | undefined;
}

export function resolveDropEvent(params: ResolveDropParams): {
  event: EnrollmentEvent;
  targetStatus: "dropped" | "withdrawn";
} {
  const now = params.now ?? new Date();

  if (params.termStatus === "closed") {
    if (!params.isRegistrarOrAdmin || !params.overrideReason?.trim()) {
      throw new AppError({
        code: "PRECONDITION_FAILED",
        message:
          "Enrollment changes in a closed term require a registrar override with a reason.",
      });
    }

    const isBeforeCensus = now.getTime() <= params.censusDate.getTime();
    return {
      event: isBeforeCensus ? "OVERRIDE_DROP" : "OVERRIDE_WITHDRAW",
      targetStatus: isBeforeCensus ? "dropped" : "withdrawn",
    };
  }

  const isBeforeCensus = now.getTime() <= params.censusDate.getTime();
  return {
    event: isBeforeCensus ? "DROP" : "WITHDRAW",
    targetStatus: isBeforeCensus ? "dropped" : "withdrawn",
  };
}
