import { and, desc, eq } from "drizzle-orm";
import { db } from "~/db";
import { courseAnnouncements } from "~/db/schema";

export function createAnnouncement(courseId: number, authorId: number, body: string) {
  return db
    .insert(courseAnnouncements)
    .values({ courseId, authorId, body })
    .returning()
    .get();
}

// authorId is recorded but never shown, so it is left out of what pages receive.
export function getAnnouncementsForCourse(courseId: number) {
  return db
    .select({
      id: courseAnnouncements.id,
      body: courseAnnouncements.body,
      createdAt: courseAnnouncements.createdAt,
    })
    .from(courseAnnouncements)
    .where(eq(courseAnnouncements.courseId, courseId))
    .orderBy(desc(courseAnnouncements.createdAt), desc(courseAnnouncements.id))
    .all();
}

// Only deletes when the announcement belongs to the given course.
export function deleteAnnouncement(id: number, courseId: number): boolean {
  const deleted = db
    .delete(courseAnnouncements)
    .where(and(eq(courseAnnouncements.id, id), eq(courseAnnouncements.courseId, courseId)))
    .returning()
    .get();
  return deleted !== undefined;
}
