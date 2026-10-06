"use server";

import { z } from "zod";
import { defineAction } from "@/lib/actions/define-action";
import {
  addHoliday,
  addSchedule,
  assignInstructor,
  createCourse,
  createSection,
  createTerm,
  removeInstructor,
  removeSchedule,
  updateCourse,
  updateSection,
  updateTerm,
} from "./service";

export const createTermAction = defineAction({
  permission: "course:create",
  input: z.object({
    name: z.string().min(1).max(100),
    startsOn: z.string().datetime(),
    endsOn: z.string().datetime(),
    censusDate: z.string().datetime(),
    status: z.enum(["planned", "active", "closed"]).optional(),
  }),
  audit: {
    action: "term:create",
    resourceType: "term",
    resourceId: (_, output) => (output as { id: string }).id,
  },
  handler: async (tx, _actor, input) => {
    return await createTerm(tx, {
      name: input.name,
      startsOn: new Date(input.startsOn),
      endsOn: new Date(input.endsOn),
      censusDate: new Date(input.censusDate),
      status: input.status,
    });
  },
});

export const updateTermAction = defineAction({
  permission: "course:update",
  input: z.object({
    id: z.string().uuid(),
    name: z.string().min(1).max(100).optional(),
    startsOn: z.string().datetime().optional(),
    endsOn: z.string().datetime().optional(),
    censusDate: z.string().datetime().optional(),
    status: z.enum(["planned", "active", "closed"]).optional(),
  }),
  audit: {
    action: "term:update",
    resourceType: "term",
    resourceId: (input) => input.id,
  },
  handler: async (tx, _actor, input) => {
    return await updateTerm(tx, input.id, {
      name: input.name,
      startsOn: input.startsOn ? new Date(input.startsOn) : undefined,
      endsOn: input.endsOn ? new Date(input.endsOn) : undefined,
      censusDate: input.censusDate ? new Date(input.censusDate) : undefined,
      status: input.status,
    });
  },
});

export const createCourseAction = defineAction({
  permission: "course:create",
  input: z.object({
    code: z.string().min(2).max(20),
    title: z.string().min(1).max(200),
    credits: z.number().int().min(1).max(20).optional(),
  }),
  audit: {
    action: "course:create",
    resourceType: "course",
    resourceId: (_, output) => (output as { id: string }).id,
  },
  handler: async (tx, _actor, input) => {
    return await createCourse(tx, input);
  },
});

export const updateCourseAction = defineAction({
  permission: "course:update",
  input: z.object({
    id: z.string().uuid(),
    code: z.string().min(2).max(20).optional(),
    title: z.string().min(1).max(200).optional(),
    credits: z.number().int().min(1).max(20).optional(),
  }),
  audit: {
    action: "course:update",
    resourceType: "course",
    resourceId: (input) => input.id,
  },
  handler: async (tx, _actor, input) => {
    return await updateCourse(tx, input.id, input);
  },
});

export const createSectionAction = defineAction({
  permission: "section:create",
  input: z.object({
    courseId: z.string().uuid(),
    termId: z.string().uuid(),
    code: z.string().min(1).max(20),
    capacity: z.number().int().min(1).max(500),
    delivery: z.enum(["in_person", "online", "hybrid"]).optional(),
    status: z.enum(["draft", "published", "archived"]).optional(),
  }),
  audit: {
    action: "section:create",
    resourceType: "section",
    resourceId: (_, output) => (output as { id: string }).id,
  },
  handler: async (tx, _actor, input) => {
    return await createSection(tx, input);
  },
});

export const updateSectionAction = defineAction({
  permission: "section:update",
  input: z.object({
    id: z.string().uuid(),
    capacity: z.number().int().min(1).max(500).optional(),
    delivery: z.enum(["in_person", "online", "hybrid"]).optional(),
    status: z.enum(["draft", "published", "archived"]).optional(),
  }),
  audit: {
    action: "section:update",
    resourceType: "section",
    resourceId: (input) => input.id,
  },
  handler: async (tx, _actor, input) => {
    return await updateSection(tx, input.id, input);
  },
});

export const assignInstructorAction = defineAction({
  permission: "section:update",
  input: z.object({
    sectionId: z.string().uuid(),
    userId: z.string().min(1),
    role: z.enum(["lead", "co", "ta"]).optional(),
  }),
  audit: {
    action: "section_instructor:assign",
    resourceType: "section",
    resourceId: (input) => input.sectionId,
  },
  handler: async (tx, _actor, input) => {
    return await assignInstructor(tx, input);
  },
});

export const removeInstructorAction = defineAction({
  permission: "section:update",
  input: z.object({
    sectionId: z.string().uuid(),
    userId: z.string().min(1),
  }),
  audit: {
    action: "section_instructor:remove",
    resourceType: "section",
    resourceId: (input) => input.sectionId,
  },
  handler: async (tx, _actor, input) => {
    const success = await removeInstructor(tx, input.sectionId, input.userId);
    return { success };
  },
});

export const addScheduleAction = defineAction({
  permission: "section:update",
  input: z.object({
    sectionId: z.string().uuid(),
    weekday: z.number().int().min(1).max(7),
    startTime: z.string(),
    endTime: z.string(),
    room: z.string().max(100).nullable().optional(),
    effectiveFrom: z.string().datetime().nullable().optional(),
    effectiveTo: z.string().datetime().nullable().optional(),
  }),
  audit: {
    action: "section_schedule:add",
    resourceType: "section",
    resourceId: (input) => input.sectionId,
  },
  handler: async (tx, _actor, input) => {
    return await addSchedule(tx, {
      ...input,
      effectiveFrom: input.effectiveFrom ? new Date(input.effectiveFrom) : null,
      effectiveTo: input.effectiveTo ? new Date(input.effectiveTo) : null,
    });
  },
});

export const removeScheduleAction = defineAction({
  permission: "section:update",
  input: z.object({
    scheduleId: z.string().uuid(),
  }),
  audit: {
    action: "section_schedule:remove",
    resourceType: "schedule",
    resourceId: (input) => input.scheduleId,
  },
  handler: async (tx, _actor, input) => {
    const success = await removeSchedule(tx, input.scheduleId);
    return { success };
  },
});

export const addHolidayAction = defineAction({
  permission: "settings:update",
  input: z.object({
    date: z.string().datetime(),
    name: z.string().min(1).max(100),
  }),
  audit: {
    action: "holiday:add",
    resourceType: "holiday",
    resourceId: (_, output) => (output as { id: string }).id,
  },
  handler: async (tx, _actor, input) => {
    return await addHoliday(tx, {
      date: new Date(input.date),
      name: input.name,
    });
  },
});
