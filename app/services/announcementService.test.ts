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
  createAnnouncement,
  getAnnouncementsForCourse,
  deleteAnnouncement,
} from "./announcementService";

let otherCourse: typeof schema.courses.$inferSelect;

function announcementRows() {
  return testDb.select().from(schema.courseAnnouncements).all();
}

function insertAt(courseId: number, body: string, createdAt: string) {
  return testDb
    .insert(schema.courseAnnouncements)
    .values({ courseId, authorId: base.instructor.id, body, createdAt })
    .returning()
    .get();
}

describe("announcementService", () => {
  beforeEach(() => {
    testDb = createTestDb();
    base = seedBaseData(testDb);
    otherCourse = testDb
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
  });

  describe("createAnnouncement", () => {
    it("stores the course, author and body", () => {
      const row = createAnnouncement(base.course.id, base.instructor.id, "Hello class");

      expect(row.courseId).toBe(base.course.id);
      expect(row.authorId).toBe(base.instructor.id);
      expect(row.body).toBe("Hello class");
      expect(row.createdAt).toBeTruthy();
      expect(announcementRows()).toHaveLength(1);
    });
  });

  describe("getAnnouncementsForCourse", () => {
    it("returns an empty list when there are none", () => {
      expect(getAnnouncementsForCourse(base.course.id)).toEqual([]);
    });

    it("returns newest first", () => {
      insertAt(base.course.id, "oldest", "2026-01-01T00:00:00.000Z");
      insertAt(base.course.id, "newest", "2026-03-01T00:00:00.000Z");
      insertAt(base.course.id, "middle", "2026-02-01T00:00:00.000Z");

      expect(getAnnouncementsForCourse(base.course.id).map((a) => a.body)).toEqual([
        "newest",
        "middle",
        "oldest",
      ]);
    });

    it("only returns the given course's announcements", () => {
      createAnnouncement(base.course.id, base.instructor.id, "mine");
      createAnnouncement(otherCourse.id, base.instructor.id, "theirs");

      expect(getAnnouncementsForCourse(base.course.id).map((a) => a.body)).toEqual(["mine"]);
    });

    it("returns only id, body and createdAt", () => {
      createAnnouncement(base.course.id, base.instructor.id, "Hello");

      const [row] = getAnnouncementsForCourse(base.course.id);
      expect(Object.keys(row).sort()).toEqual(["body", "createdAt", "id"]);
    });
  });

  describe("deleteAnnouncement", () => {
    it("deletes an announcement in the given course", () => {
      const row = createAnnouncement(base.course.id, base.instructor.id, "bye");

      expect(deleteAnnouncement(row.id, base.course.id)).toBe(true);
      expect(announcementRows()).toHaveLength(0);
    });

    it("refuses to delete another course's announcement", () => {
      const row = createAnnouncement(otherCourse.id, base.instructor.id, "keep me");

      expect(deleteAnnouncement(row.id, base.course.id)).toBe(false);
      expect(announcementRows()).toHaveLength(1);
    });

    it("returns false for a missing id", () => {
      expect(deleteAnnouncement(99999, base.course.id)).toBe(false);
    });

    it("returns false when deleting twice", () => {
      const row = createAnnouncement(base.course.id, base.instructor.id, "once");

      deleteAnnouncement(row.id, base.course.id);
      expect(deleteAnnouncement(row.id, base.course.id)).toBe(false);
    });
  });
});
