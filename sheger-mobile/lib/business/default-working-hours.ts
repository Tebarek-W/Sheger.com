export type DefaultWorkingHoursInput = {
  day_of_week: number;
  open_time: string;
  close_time: string;
  is_closed: boolean;
};

/** 2 ጠዋት in Ethiopian time (08:00 GC / Addis civil). */
export const DEFAULT_OPEN_TIME_GC = "08:00";

/** 4 ማታ in Ethiopian time (22:00 GC / Addis civil). */
export const DEFAULT_CLOSE_TIME_GC = "22:00";

/** day_of_week 0 = Sunday */
export const DEFAULT_CLOSED_DAY_OF_WEEK = 0;

export function buildDefaultWorkingHours(): DefaultWorkingHoursInput[] {
  return Array.from({ length: 7 }, (_, day) => ({
    day_of_week: day,
    open_time: DEFAULT_OPEN_TIME_GC,
    close_time: DEFAULT_CLOSE_TIME_GC,
    is_closed: day === DEFAULT_CLOSED_DAY_OF_WEEK,
  }));
}
