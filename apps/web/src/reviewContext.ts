import { createContext } from "react";
import type { WorkoutAttachment } from "./api.js";

/** Starts a workout review in the chat tab. */
export const ReviewContext = createContext<(workout: WorkoutAttachment) => void>(() => {});
