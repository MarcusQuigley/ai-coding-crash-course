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

// Import after mock so the modules pick up our test db
import { loader, action } from "./instructor.$courseId";
import { setCurrentUserId } from "~/lib/session";
import { getCourseById } from "~/services/courseService";
import { rateCourse } from "~/services/courseRatingService";

type LoaderArgs = Parameters<typeof loader>[0];
type ActionArgs = Parameters<typeof action>[0];

const MISSING_USER_ID = 99999;
const MISSING_COURSE_ID = "99999";

let admin: typeof schema.users.$inferSelect;
let otherInstructor: typeof schema.users.$inferSelect;
let otherCourse: typeof schema.courses.$inferSelect;

async function cookieHeaders(userId: number | null) {
  const headers = new Headers();
  if (userId !== null) {
    const setCookie = await setCurrentUserId(new Request("http://test/"), userId);
    headers.set("Cookie", setCookie.split(";")[0]);
  }
  return headers;
}

async function loadRequest(userId: number | null, courseId = String(base.course.id)) {
  const request = new Request(`http://test/instructor/${courseId}`, {
    headers: await cookieHeaders(userId),
  });
  return loader({ params: { courseId }, request } as unknown as LoaderArgs);
}

async function updateTitleRequest(userId: number | null, courseId = String(base.course.id)) {
  const request = new Request(`http://test/instructor/${courseId}`, {
    method: "POST",
    headers: await cookieHeaders(userId),
    body: new URLSearchParams({ intent: "update-title", title: "Hijacked" }),
  });
  return action({ params: { courseId }, request } as unknown as ActionArgs);
}

async function expectStatus(promise: Promise<unknown>, status: number) {
  const error = await promise.then(
    () => {
      throw new Error(`Expected action to throw ${status}`);
    },
    (e) => e
  );
  expect(error.init?.status).toBe(status);
}

function expectTitleUnchanged() {
  expect(getCourseById(base.course.id)!.title).toBe("Test Course");
}

describe("instructor.$courseId barriers", () => {
  beforeEach(() => {
    testDb = createTestDb();
    base = seedBaseData(testDb);

    admin = testDb
      .insert(schema.users)
      .values({
        name: "Admin",
        email: "admin@example.com",
        role: schema.UserRole.Admin,
      })
      .returning()
      .get();

    otherInstructor = testDb
      .insert(schema.users)
      .values({
        name: "Other Instructor",
        email: "other-instructor@example.com",
        role: schema.UserRole.Instructor,
      })
      .returning()
      .get();

    otherCourse = testDb
      .insert(schema.courses)
      .values({
        title: "Other Course",
        slug: "other-course",
        description: "Another",
        instructorId: otherInstructor.id,
        categoryId: base.category.id,
        status: schema.CourseStatus.Published,
      })
      .returning()
      .get();
  });

  describe("loader", () => {
    it("throws 401 when not logged in", async () => {
      await expectStatus(loadRequest(null), 401);
    });

    it("throws 403 when the session user doesn't exist", async () => {
      await expectStatus(loadRequest(MISSING_USER_ID), 403);
    });

    it("throws 403 for a student", async () => {
      await expectStatus(loadRequest(base.user.id), 403);
    });

    it("throws 400 for a non-numeric course id", async () => {
      await expectStatus(loadRequest(base.instructor.id, "abc"), 400);
    });

    it("throws 404 when the course doesn't exist", async () => {
      await expectStatus(loadRequest(base.instructor.id, MISSING_COURSE_ID), 404);
    });

    it("throws 403 when another instructor owns the course", async () => {
      await expectStatus(loadRequest(otherInstructor.id), 403);
    });

    it("returns the course and ratings to the owning instructor", async () => {
      rateCourse(base.course.id, base.user.id, 4);

      const result = await loadRequest(base.instructor.id);

      expect(result.course.id).toBe(base.course.id);
      expect(result.ratingSummary).toEqual({ average: 4, count: 1 });
      expect(result.ratingBreakdown).toEqual({ 1: 0, 2: 0, 3: 0, 4: 1, 5: 0 });
    });

    it("returns the course and ratings to an admin who doesn't own it", async () => {
      rateCourse(base.course.id, base.user.id, 4);

      const result = await loadRequest(admin.id);

      expect(result.course.id).toBe(base.course.id);
      expect(result.ratingSummary).toEqual({ average: 4, count: 1 });
      expect(result.ratingBreakdown).toEqual({ 1: 0, 2: 0, 3: 0, 4: 1, 5: 0 });
    });
  });

  describe("action", () => {
    it("throws 401 when not logged in and leaves the title unchanged", async () => {
      await expectStatus(updateTitleRequest(null), 401);
      expectTitleUnchanged();
    });

    it("throws 403 when the session user doesn't exist and leaves the title unchanged", async () => {
      await expectStatus(updateTitleRequest(MISSING_USER_ID), 403);
      expectTitleUnchanged();
    });

    it("throws 403 for a student and leaves the title unchanged", async () => {
      await expectStatus(updateTitleRequest(base.user.id), 403);
      expectTitleUnchanged();
    });

    it("throws 400 for a non-numeric course id", async () => {
      await expectStatus(updateTitleRequest(base.instructor.id, "abc"), 400);
    });

    it("throws 404 when the course doesn't exist", async () => {
      await expectStatus(updateTitleRequest(base.instructor.id, MISSING_COURSE_ID), 404);
    });

    it("throws 403 when another instructor owns the course and leaves the title unchanged", async () => {
      await expectStatus(updateTitleRequest(otherInstructor.id), 403);
      expectTitleUnchanged();
    });

    it("lets the owning instructor change the title", async () => {
      expect(await updateTitleRequest(base.instructor.id)).toEqual({ success: true, field: "title" });
      expect(getCourseById(base.course.id)!.title).toBe("Hijacked");
    });

    it("lets an admin change the title of a course they don't own", async () => {
      expect(await updateTitleRequest(admin.id)).toEqual({ success: true, field: "title" });
      expect(getCourseById(base.course.id)!.title).toBe("Hijacked");
    });
  });

  describe("order checks", () => {
    describe.each([
      ["loader", loadRequest],
      ["action", updateTitleRequest],
    ] as const)("%s", (_name, request) => {
      it("throws 403, not 400, for a student with a non-numeric course id", async () => {
        await expectStatus(request(base.user.id, "abc"), 403);
      });

      it("throws 403, not 404, for a student with a missing course", async () => {
        await expectStatus(request(base.user.id, MISSING_COURSE_ID), 403);
      });

      it("throws 404, not 403, for another instructor with a missing course", async () => {
        await expectStatus(request(otherInstructor.id, MISSING_COURSE_ID), 404);
      });
    });
  });
});
