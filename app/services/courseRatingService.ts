import {eq, count,and, sql} from "drizzle-orm"
import { db } from "~/db";
import {courseRatings} from "~/db/schema"

export type RatingSummary={ average:number | null; count:number };

export function rateCourse(courseId: number, userId: number, rating: number){
    if (!Number.isInteger(rating)||rating<1||rating>5){
        return null
    }
    // if (rating %1 !=0 ||rating < 1 || rating > 5){
    //     return { ok: false, error: "rating needs to whole number between 1 and 5" };
    // }
    const now = new Date().toISOString();
    
    // const ratedCourse = getRatingByUserAndCourse(userId,courseId)
    // if (ratedCourse==null){
    //     return db
    //         .insert(courseRatings)
    //         .values({
    //             courseId,
    //             userId,
    //             rating
    //         })
    //         .returning()
    //         .get();
    // }
    return db
        .insert(courseRatings)
        .values({courseId,userId,rating})
        .onConflictDoUpdate({
            target:[courseRatings.userId,courseRatings.courseId],            
            set: {rating, updatedAt:now},
        })
        .returning()
        .get();
        //.update(courseRatings)
        // .set({rating,updatedAt:new Date().toISOString()})
        // .where(and(eq(courseRatings.courseId ,courseId) , eq(courseRatings.userId,userId)))
    }

export function getCourseRatingSummaries() {
   const rows = db
    .select({
        courseId: courseRatings.courseId,
        average: sql<number>`avg(${courseRatings.rating})`,
        count: count(),
    })
    .from(courseRatings)
    .groupBy(courseRatings.courseId)
    .all()

    const summaries = new Map<number,RatingSummary>();
    for(const row of rows){
        summaries.set(row.courseId,{average:row.average, count:row.count});
    }
    return summaries
}

 

export function getCourseRatingSummary(courseId: number):RatingSummary{
     const row = db
        .select({
            average:sql<number|null>`avg(${courseRatings.rating})`,
            count:count(),
    })

    .from(courseRatings)
    .where(eq(courseRatings.courseId, courseId))
    .get();

    return { average: row?.average ?? null, count: row?.count ?? 0};
    // if (recs.length > 0){
    // //     const sum = recs.reduce(a,b)=>a+b.
    // //    // return {3,recs.length};

    //    const total = recs.reduce((sum,r)=>sum+r.rating,0);
    //     return total/recs.length
    //   //(f, l):number => f.rating +  l.rating);
    // }
    // return null
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
        .where(
            and(eq(courseRatings.userId,userId),eq(courseRatings.courseId,courseId))
        )
        .get();
}


