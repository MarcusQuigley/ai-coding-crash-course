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
import { action, loader } from "./courses.$slug";
import { setCurrentUserId } from "~/lib/session";
import {
  rateCourse,
  getRatingByUserAndCourse,
  getCourseRatingSummary,
} from "~/services/courseRatingService";

type ActionArgs = Parameters<typeof action>[0];
type LoaderArgs = Parameters<typeof loader>[0];

let otherStudent: typeof schema.users.$inferSelect;
let otherCourse: typeof schema.courses.$inferSelect;

function enroll(userId: number, courseId: number) {
  testDb.insert(schema.enrollments).values({ userId, courseId }).run();
}

async function removeRequest(
  userId: number | null,
  slug = base.course.slug,
  extraFields: Record<string, string> = {}
) {
  const headers = new Headers();
  if (userId !== null) {
    const setCookie = await setCurrentUserId(new Request("http://test/"), userId);
    headers.set("Cookie", setCookie.split(";")[0]);
  }
  const request = new Request(`http://test/courses/${slug}`, {
    method: "POST",
    headers,
    body: new URLSearchParams({ intent: "remove", ...extraFields }),
  });
  return action({ params: { slug }, request } as unknown as ActionArgs);
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

describe("courses.$slug action — remove rating", () => {
  beforeEach(() => {
    testDb = createTestDb();
    base = seedBaseData(testDb);

    otherStudent = testDb
      .insert(schema.users)
      .values({
        name: "Other Student",
        email: "other@example.com",
        role: schema.UserRole.Student,
      })
      .returning()
      .get();

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

    enroll(otherStudent.id, base.course.id);
  });

  it("throws 401 when not logged in", async () => {
    rateCourse(base.course.id, otherStudent.id, 4);

    await expectStatus(removeRequest(null), 401);
    expect(getRatingByUserAndCourse(otherStudent.id, base.course.id)).toBeDefined();
  });

  it("throws 404 when the course doesn't exist", async () => {
    await expectStatus(removeRequest(base.user.id, "no-such-course"), 404);
  });

  it("throws 403 when not enrolled and leaves the rating in place", async () => {
    rateCourse(base.course.id, base.user.id, 2);

    await expectStatus(removeRequest(base.user.id), 403);
    expect(getRatingByUserAndCourse(base.user.id, base.course.id)!.rating).toBe(2);
  });

  it("throws 404 when enrolled with no rating", async () => {
    enroll(base.user.id, base.course.id);
    rateCourse(base.course.id, otherStudent.id, 4);

    await expectStatus(removeRequest(base.user.id), 404);
    expect(getRatingByUserAndCourse(otherStudent.id, base.course.id)!.rating).toBe(4);
  });

  it("removes the user's rating", async () => {
    enroll(base.user.id, base.course.id);
    rateCourse(base.course.id, base.user.id, 2);

    expect(await removeRequest(base.user.id)).toEqual({ rating: null });
    expect(getRatingByUserAndCourse(base.user.id, base.course.id)).toBeUndefined();
  });

  it("keeps another student's rating and updates the summary", async () => {
    enroll(base.user.id, base.course.id);
    rateCourse(base.course.id, base.user.id, 2);
    rateCourse(base.course.id, otherStudent.id, 4);
    expect(getCourseRatingSummary(base.course.id)).toEqual({ average: 3, count: 2 });

    await removeRequest(base.user.id);

    expect(getRatingByUserAndCourse(otherStudent.id, base.course.id)!.rating).toBe(4);
    expect(getCourseRatingSummary(base.course.id)).toEqual({ average: 4, count: 1 });
  });

  it("leaves the user's ratings on other courses untouched", async () => {
    enroll(base.user.id, base.course.id);
    enroll(base.user.id, otherCourse.id);
    rateCourse(base.course.id, base.user.id, 2);
    rateCourse(otherCourse.id, base.user.id, 5);

    await removeRequest(base.user.id);

    expect(getRatingByUserAndCourse(base.user.id, otherCourse.id)!.rating).toBe(5);
  });

  it("ignores userId and courseId sent in the form", async () => {
    enroll(base.user.id, base.course.id);
    enroll(otherStudent.id, otherCourse.id);
    rateCourse(base.course.id, base.user.id, 2);
    rateCourse(base.course.id, otherStudent.id, 4);
    rateCourse(otherCourse.id, otherStudent.id, 3);

    await removeRequest(base.user.id, base.course.slug, {
      userId: String(otherStudent.id),
      courseId: String(otherCourse.id),
    });

    expect(getRatingByUserAndCourse(base.user.id, base.course.id)).toBeUndefined();
    expect(getRatingByUserAndCourse(otherStudent.id, base.course.id)!.rating).toBe(4);
    expect(getRatingByUserAndCourse(otherStudent.id, otherCourse.id)!.rating).toBe(3);
  });

  it("throws 404 when removing twice", async () => {
    enroll(base.user.id, base.course.id);
    rateCourse(base.course.id, base.user.id, 2);

    await removeRequest(base.user.id);
    await expectStatus(removeRequest(base.user.id), 404);
  });
});

describe("courses.$slug loader — announcements", () => {
  async function load(userId: number | null) {
    const headers = new Headers();
    if (userId !== null) {
      const setCookie = await setCurrentUserId(new Request("http://test/"), userId);
      headers.set("Cookie", setCookie.split(";")[0]);
    }
    const slug = base.course.slug;
    const request = new Request(`http://test/courses/${slug}`, { headers });
    return loader({ params: { slug }, request } as unknown as LoaderArgs);
  }

  let admin: typeof schema.users.$inferSelect;

  beforeEach(() => {
    testDb = createTestDb();
    base = seedBaseData(testDb);

    admin = testDb
      .insert(schema.users)
      .values({ name: "Admin", email: "admin@example.com", role: schema.UserRole.Admin })
      .returning()
      .get();

    testDb
      .insert(schema.courseAnnouncements)
      .values([
        { courseId: base.course.id, authorId: base.instructor.id, body: "old", createdAt: "2026-01-01T00:00:00.000Z" },
        { courseId: base.course.id, authorId: base.instructor.id, body: "new", createdAt: "2026-02-01T00:00:00.000Z" },
      ])
      .run();
  });

  it("returns announcements newest first, without the author, to an enrolled student", async () => {
    enroll(base.user.id, base.course.id);

    const result = await load(base.user.id);

    expect(result.announcements.map((a) => a.body)).toEqual(["new", "old"]);
    expect(result.announcements[0]).not.toHaveProperty("authorId");
  });

  it("returns none to a logged-out visitor", async () => {
    expect((await load(null)).announcements).toEqual([]);
  });

  it("returns none to a logged-in student who isn't enrolled", async () => {
    expect((await load(base.user.id)).announcements).toEqual([]);
  });

  it("returns none to the course's instructor viewing the course page", async () => {
    expect((await load(base.instructor.id)).announcements).toEqual([]);
  });

  it("returns none to an admin who isn't enrolled", async () => {
    expect((await load(admin.id)).announcements).toEqual([]);
  });
});
