import { AppError } from "@/lib/errors";

export type TransitionMap<
  TState extends string,
  TEvent extends string,
> = Record<TState, Partial<Record<TEvent, TState>>>;

export interface StateMachine<TState extends string, TEvent extends string> {
  (state: TState, event: TEvent): TState;
  transition(state: TState, event: TEvent): TState;
  can(state: TState, event: TEvent): boolean;
  readonly transitions: Readonly<TransitionMap<TState, TEvent>>;
}

export function defineMachine<TState extends string, TEvent extends string>(
  transitions: TransitionMap<TState, TEvent>,
): StateMachine<TState, TEvent> {
  function transition(state: TState, event: TEvent): TState {
    const stateTransitions = transitions[state];
    const nextState = stateTransitions?.[event];

    if (!nextState) {
      throw new AppError({
        code: "PRECONDITION_FAILED",
        message: `Illegal state transition from "${state}" on event "${event}".`,
        details: { state, event },
      });
    }

    return nextState;
  }

  function can(state: TState, event: TEvent): boolean {
    const stateTransitions = transitions[state];
    return Boolean(stateTransitions?.[event]);
  }

  const machine = transition as StateMachine<TState, TEvent>;
  machine.transition = transition;
  machine.can = can;
  Object.defineProperty(machine, "transitions", {
    value: Object.freeze({ ...transitions }),
    writable: false,
    enumerable: true,
  });

  return machine;
}
