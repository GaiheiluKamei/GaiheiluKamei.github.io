import rss from '@astrojs/rss'
import { getCollection } from 'astro:content'

export async function GET(context) {
    const jsPosts = await getCollection('js')
    return rss({
        title: 'Rubyist Run',
        description: 'Personal Blog about Ruby and JavaScript, written by Gaiheilu Kamei',
        site: context.site,
        items: jsPosts.map(p => ({
            title: p.data.title,
            pubDate: p.data.publishedAt,
            link: `/js/${p.slug}`
        }))
    })
}