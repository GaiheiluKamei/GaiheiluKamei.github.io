import {defineCollection, z} from 'astro:content'

const posts = defineCollection({
    schema: z.object({
        title: z.string(),
        // z.coerce is a method used to transform the data type of a field, z.coerce.date() is used to transform a string into a Date object
        publishedAt: z.coerce.date().optional(),
        updatedAt: z.coerce.date().optional(),
    })
})

export const collections = {
    ruby: posts,
    js: posts,
    go: posts,
    other: posts,
    hidden: posts,
}
