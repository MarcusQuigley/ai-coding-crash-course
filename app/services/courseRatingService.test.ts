import { describe, it, expect, beforeEach, vi } from "vitest";
import { createTestDb, seedBaseData } from "~/test/setup";
import * as schema from "~/db/schema";

let testDb: ReturnType<typeof createTestDb>;
let base: ReturnType<typeof seedBaseData>;

vi.mock("~/db", () => ({
  get db() {
    return testDb;
  },
}));

// Import after mock so the module picks up our test db
import {
  rateCourse,
  getCourseRatingSummary,
  getCourseRatingSummaries,
} from "./courseRatingService";

function ratingRows() {
  return testDb.select().from(schema.courseRatings).all();
}

describe("courseRatingService", () => {
  beforeEach(() => {
    testDb = createTestDb();
    base = seedBaseData(testDb);
  });

  describe("rateCourse", () => {
    it("inserts a new rating", () => {
      const row = rateCourse(base.course.id, base.user.id, 4);

      expect(row).not.toBeNull();
      expect(row!.rating).toBe(4);
      expect(ratingRows()).toHaveLength(1);
    });

    it("updates the existing row when re-rating", () => {
      const first = rateCourse(base.course.id, base.user.id, 2);
      const second = rateCourse(base.course.id, base.user.id, 5);

      expect(second!.id).toBe(first!.id);
      expect(second!.rating).toBe(5);
      expect(ratingRows()).toHaveLength(1);
    });

    it.each([0, 6, 99, 2.5, NaN, -1])("rejects %s and writes nothing", (bad) => {
      expect(rateCourse(base.course.id, base.user.id, bad)).toBeNull();
      expect(ratingRows()).toHaveLength(0);
    });

    it("leaves an existing rating unchanged when the new one is invalid", () => {
      rateCourse(base.course.id, base.user.id, 3);
      rateCourse(base.course.id, base.user.id, 99);

      expect(ratingRows()[0].rating).toBe(3);
    });
  });

  describe("getCourseRatingSummary", () => {
    it("returns null average and zero count with no ratings", () => {
      expect(getCourseRatingSummary(base.course.id)).toEqual({
        average: null,
        count: 0,
      });
    });

    it("returns average and count", () => {
      rateCourse(base.course.id, base.user.id, 2);
      rateCourse(base.course.id, base.instructor.id, 5);

      expect(getCourseRatingSummary(base.course.id)).toEqual({
        average: 3.5,
        count: 2,
      });
    });
  });

  describe("getCourseRatingSummaries", () => {
    it("groups ratings by course", () => {
      const other = testDb
        .insert(schema.courses)
        .values({
          title: "Other Course",
          slug: "other-course",
          description: "Another",
          instructorId: base.instructor.id,
          categoryId: base.category.id,
          status: schema.CourseStatus.Published,
        })
        .returning()
        .get();

      rateCourse(base.course.id, base.user.id, 4);
      rateCourse(base.course.id, base.instructor.id, 2);
      rateCourse(other.id, base.user.id, 5);

      const summaries = getCourseRatingSummaries();
      expect(summaries.get(base.course.id)).toEqual({ average: 3, count: 2 });
      expect(summaries.get(other.id)).toEqual({ average: 5, count: 1 });
    });

    it("omits courses with no ratings", () => {
      expect(getCourseRatingSummaries().has(base.course.id)).toBe(false);
    });
  });
});
