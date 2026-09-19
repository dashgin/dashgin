import rss from '@astrojs/rss';
import { getCollection } from 'astro:content';
import MarkdownIt from 'markdown-it';
import sanitizeHtml from 'sanitize-html';

const parser = new MarkdownIt();

// Full-content feed. dev.to and Hashnode import <content:encoded>, so shipping
// the whole post here is what makes RSS-based syndication actually work: a
// description-only feed imports a stub. Relative links are rewritten to
// absolute below, since off-site readers have no origin to resolve them against.
export async function GET(context) {
  const site = context.site.origin;

  const posts = (await getCollection('blog'))
    .filter((p) => !p.data.draft)
    .sort((a, b) => b.data.pubDate.valueOf() - a.data.pubDate.valueOf());

  return rss({
    title: 'dashgin · field reports',
    description:
      'Writing on self-hosting, AI agents, cost, and shipping full-stack products.',
    site: context.site,
    trailingSlash: false,
    items: posts.map((post) => ({
      title: post.data.title,
      description: post.data.description,
      pubDate: post.data.pubDate,
      categories: post.data.tags,
      link: `/blog/${post.slug}`,
      content: sanitizeHtml(
        parser.render(post.body).replace(/(href|src)="\//g, `$1="${site}/`),
        { allowedTags: sanitizeHtml.defaults.allowedTags.concat(['img']) },
      ),
    })),
  });
}
