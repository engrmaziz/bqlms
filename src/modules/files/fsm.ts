import { defineMachine } from "@/lib/fsm";
import type { FileStatus } from "./schema";

export type FileEvent = "COMPLETE_UPLOAD" | "VERIFY" | "REJECT" | "DELETE";

export const fileStateMachine = defineMachine<FileStatus, FileEvent>({
  pending: {
    COMPLETE_UPLOAD: "uploaded",
    DELETE: "deleted",
  },
  uploaded: {
    VERIFY: "verified",
    REJECT: "rejected",
    DELETE: "deleted",
  },
  verified: {
    DELETE: "deleted",
  },
  rejected: {
    DELETE: "deleted",
  },
  deleted: {},
});
