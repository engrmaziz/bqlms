"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import type React from "react";
import {
  type DefaultValues,
  type FieldValues,
  type Resolver,
  type SubmitHandler,
  type UseFormReturn,
  useForm,
} from "react-hook-form";

export function useZodForm<TFieldValues extends FieldValues = FieldValues>({
  schema,
  defaultValues,
}: {
  schema: Parameters<typeof zodResolver>[0];
  defaultValues?: DefaultValues<TFieldValues>;
}): UseFormReturn<TFieldValues, unknown, TFieldValues> {
  const resolver = zodResolver(schema) as unknown as Resolver<
    TFieldValues,
    unknown
  >;
  const options: Parameters<
    typeof useForm<TFieldValues, unknown, TFieldValues>
  >[0] = {
    resolver,
    mode: "onBlur",
  };
  if (defaultValues !== undefined) {
    options.defaultValues = defaultValues;
  }
  return useForm<TFieldValues, unknown, TFieldValues>(options);
}

export function Form<TFieldValues extends FieldValues>({
  form,
  onSubmit,
  children,
  className,
}: {
  form: UseFormReturn<TFieldValues, unknown, TFieldValues>;
  onSubmit: SubmitHandler<TFieldValues>;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <form
      onSubmit={form.handleSubmit(onSubmit)}
      className={className}
      noValidate
    >
      {children}
    </form>
  );
}

export function FieldError({ error }: { error?: { message?: string } }) {
  if (!error?.message) {
    return null;
  }
  return (
    <p role="alert" className="mt-1 text-xs text-red-400 font-medium">
      {error.message}
    </p>
  );
}
