import {eq, or,and} from "drizzle-orm"
import { db } from "~/db";
import {courseRatings} from "~/db/schema"

export function rateCourse(courseId: number, userId: number, rating: number){
    if (rating %1 !=0 ||rating < 1 || rating > 5){
        return { ok: false, error: "rating needs to whole number between 1 and 5" };
    }
    const ratedCourse = getRatingByUserAndCourse(userId,courseId)
    if (ratedCourse==null){
        return db
            .insert(courseRatings)
            .values({
                courseId,
                userId,
                rating
            })
            .returning()
            .get();
    }
    return db
        .update(courseRatings)
        .set({rating,updatedAt:new Date().toISOString()})
        .where(and(eq(courseRatings.courseId ,courseId) , eq(courseRatings.userId,userId)))
        .returning()
        .get();
    
}

export function getCourseRatingSummaries() {
    return db
    .select()
    .from(courseRatings)
    .all();
}

 

export function getCourseRatingSummary(courseId: number){
     const recs = db
    .select()
    .from(courseRatings)
    .where(eq(courseRatings.courseId, courseId))
    .all();

    if (recs.length > 0){
    //     const sum = recs.reduce(a,b)=>a+b.
    //    // return {3,recs.length};

       const total = recs.reduce((sum,r)=>sum+r.rating,0);
        return total/recs.length
      //(f, l):number => f.rating +  l.rating);
    }
    return null
}


export function findRating(ratingId:number){
    return db
    .select()
    .from(courseRatings)
    .where(eq(courseRatings.id,ratingId))
    .all();
}

export function findRatingByCourse(courseId:number){
    return db
    .select()
    .from(courseRatings)
    .where(eq(courseRatings.courseId,courseId))
    .all();
}

export function getRatingByUserAndCourse(userId:number,courseId:number){
    return db
        .select()
        .from(courseRatings)
        .where(and(eq(courseRatings.userId,userId),eq(courseRatings.courseId,courseId)))
        .get();
}


